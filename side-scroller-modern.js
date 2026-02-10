const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const stage = document.querySelector(".canvas-shell");

const overlayStart = document.getElementById("overlay-start");
const overlayPause = document.getElementById("overlay-pause");
const overlayGameOver = document.getElementById("overlay-gameover");
const finalScoreEl = document.getElementById("final-score");

const statDistance = document.getElementById("stat-distance");
const statScore = document.getElementById("stat-score");
const statCombo = document.getElementById("stat-combo");
const statEnergy = document.getElementById("stat-energy");
const statLives = document.getElementById("stat-lives");

const btnPause = document.getElementById("btn-pause");
const btnRestart = document.getElementById("btn-restart");
const btnStart = document.getElementById("btn-start");
const btnResume = document.getElementById("btn-resume");
const btnRetry = document.getElementById("btn-retry");

const toggleReduceMotion = document.getElementById("toggle-reduce-motion");
const toggleHighContrast = document.getElementById("toggle-high-contrast");
const toggleAutoRun = document.getElementById("toggle-auto-run");

const BASE_WIDTH = 960;
const BASE_HEIGHT = 540;

const world = {
	gravity: 1800,
	groundY: 420,
	chunkLength: 520,
	deathY: 680,
};

const settings = {
	reduceMotion: false,
	highContrast: false,
	autoRun: false,
};

const input = {
	left: false,
	right: false,
	jumpHeld: false,
	jumpPressed: false,
	dashPressed: false,
};

const camera = { x: 0, shake: 0 };

const player = {
	x: 120,
	y: 200,
	w: 36,
	h: 48,
	vx: 0,
	vy: 0,
	dir: 1,
	onGround: false,
	coyote: 0,
	jumpBuffer: 0,
	dashTime: 0,
	dashCooldown: 0,
	energy: 100,
	lives: 3,
	invuln: 0,
	score: 0,
	distance: 0,
	combo: 1,
	comboTimer: 0,
};

const platforms = [];
const orbs = [];
const drones = [];
const particles = [];

let gameStarted = false;
let paused = false;
let gameOver = false;
let lastTime = 0;
let generatedChunk = 0;

function seededRandom(seed) {
	let s = seed >>> 0;
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 0xffffffff;
	};
}

function loadSettings() {
	const stored = JSON.parse(localStorage.getItem("sideScrollerSettings") || "{}");
	Object.assign(settings, stored);
	toggleReduceMotion.checked = settings.reduceMotion;
	toggleHighContrast.checked = settings.highContrast;
	toggleAutoRun.checked = settings.autoRun;
	document.body.classList.toggle("high-contrast", settings.highContrast);
}

function saveSettings() {
	localStorage.setItem("sideScrollerSettings", JSON.stringify(settings));
}

function setupTabs() {
	document.querySelectorAll(".panel-tabs .tab").forEach((tab) => {
		tab.addEventListener("click", () => {
			document.querySelectorAll(".panel-tabs .tab").forEach((btn) => btn.classList.remove("active"));
			document.querySelectorAll(".panel-content").forEach((panel) => panel.classList.remove("active"));
			tab.classList.add("active");
			const target = document.getElementById(`panel-${tab.dataset.tab}`);
			if (target) target.classList.add("active");
		});
	});
}

function resizeCanvas() {
	const rect = stage.getBoundingClientRect();
	const scale = Math.min(rect.width / BASE_WIDTH, rect.height / BASE_HEIGHT);
	const width = Math.floor(BASE_WIDTH * scale);
	const height = Math.floor(BASE_HEIGHT * scale);
	const dpr = window.devicePixelRatio || 1;

	canvas.style.width = `${width}px`;
	canvas.style.height = `${height}px`;
	canvas.width = Math.floor(width * dpr);
	canvas.height = Math.floor(height * dpr);

	ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
}

function addParticle(x, y, color, life, size, vx, vy) {
	particles.push({ x, y, color, life, size, vx, vy });
}

function addOrb(x, y) {
	orbs.push({ x, y, r: 8, collected: false });
}

function addDrone(x, y) {
	drones.push({ x, y, w: 30, h: 24, vx: -120, vy: 0, hover: Math.random() * Math.PI * 2 });
}

function generateChunk(index) {
	const startX = index * world.chunkLength;
	const rand = seededRandom(index * 999 + 77);

	let x = startX;
	while (x < startX + world.chunkLength) {
		const groundWidth = 140 + rand() * 220;
		const gap = rand() < 0.22 ? 60 + rand() * 120 : 0;

		if (groundWidth > 60) {
			platforms.push({ x, y: world.groundY, w: groundWidth, h: 40, type: "ground" });
			if (rand() < 0.6) {
				const orbCount = 3 + Math.floor(rand() * 4);
				for (let i = 0; i < orbCount; i++) {
					addOrb(x + 20 + i * 18, world.groundY - 50 - rand() * 30);
				}
			}
		}
		x += groundWidth + gap;
	}

	const platformCount = 2 + Math.floor(rand() * 3);
	for (let i = 0; i < platformCount; i++) {
		const px = startX + 60 + rand() * (world.chunkLength - 160);
		const py = world.groundY - 120 - rand() * 180;
		const pw = 90 + rand() * 120;
		platforms.push({ x: px, y: py, w: pw, h: 18, type: "ledge" });
		if (rand() < 0.7) {
			addOrb(px + pw * 0.5, py - 26);
		}
		if (rand() < 0.35) {
			addDrone(px + pw * 0.5, py - 60);
		}
	}

	if (rand() < 0.5) {
		addDrone(startX + world.chunkLength * 0.8, world.groundY - 80 - rand() * 80);
	}
}

function ensureChunks() {
	const currentChunk = Math.floor(camera.x / world.chunkLength);
	const needed = currentChunk + 4;
	while (generatedChunk < needed) {
		generatedChunk++;
		generateChunk(generatedChunk);
	}
}

function resetRun() {
	player.x = 120;
	player.y = 200;
	player.vx = 0;
	player.vy = 0;
	player.dir = 1;
	player.onGround = false;
	player.coyote = 0;
	player.jumpBuffer = 0;
	player.dashTime = 0;
	player.dashCooldown = 0;
	player.energy = 100;
	player.lives = 3;
	player.invuln = 0;
	player.score = 0;
	player.distance = 0;
	player.combo = 1;
	player.comboTimer = 0;

	camera.x = 0;
	camera.shake = 0;
	platforms.length = 0;
	orbs.length = 0;
	drones.length = 0;
	particles.length = 0;
	generatedChunk = 0;

	for (let i = 0; i < 4; i++) {
		generatedChunk++;
		generateChunk(generatedChunk);
	}
}

function startRun() {
	gameStarted = true;
	paused = false;
	gameOver = false;
	overlayStart.classList.remove("show");
	overlayPause.classList.remove("show");
	overlayGameOver.classList.remove("show");
}

function setPaused(value) {
	paused = value;
	overlayPause.classList.toggle("show", paused);
}

function endRun() {
	gameOver = true;
	finalScoreEl.textContent = `Score ${Math.floor(player.score)}`;
	overlayGameOver.classList.add("show");
}

function handleInput(e, active) {
	switch (e.code) {
		case "ArrowLeft":
		case "KeyA":
			input.left = active;
			break;
		case "ArrowRight":
		case "KeyD":
			input.right = active;
			break;
		case "Space":
		case "KeyW":
		case "ArrowUp":
			input.jumpHeld = active;
			if (active) input.jumpPressed = true;
			break;
		case "ShiftLeft":
		case "ShiftRight":
		case "KeyK":
			if (active) input.dashPressed = true;
			break;
		default:
	}
}

function applyJump() {
	const jumpSpeed = 620;
	player.vy = -jumpSpeed;
	player.onGround = false;
	player.coyote = 0;
}

function resolvePlatforms(nextX, nextY) {
	let landed = false;
	for (const platform of platforms) {
		const overlapX = nextX < platform.x + platform.w && nextX + player.w > platform.x;
		if (!overlapX) continue;
		if (player.y + player.h <= platform.y && nextY + player.h >= platform.y) {
			nextY = platform.y - player.h;
			player.vy = 0;
			landed = true;
		}
	}
	player.onGround = landed;
	return { x: nextX, y: nextY };
}

function respawn() {
	player.lives -= 1;
	player.energy = 100;
	player.invuln = 1.6;
	player.dashTime = 0;
	player.dashCooldown = 0;

	if (player.lives <= 0) {
		endRun();
		return;
	}

	player.x = camera.x + 140;
	player.y = world.groundY - player.h - 20;
	player.vx = 0;
	player.vy = 0;
}

function updateStats() {
	statDistance.textContent = Math.floor(player.distance);
	statScore.textContent = Math.floor(player.score);
	statCombo.textContent = `x${player.combo}`;
	statEnergy.textContent = `${Math.floor(player.energy)}%`;
	statLives.textContent = player.lives;
}

function updateGame(dt) {
	const moveAccel = 5000;
	const maxSpeed = 320;
	const airControl = 0.65;
	const drag = 2600;

	if (input.jumpPressed) {
		player.jumpBuffer = 0.12;
	}
	input.jumpPressed = false;

	player.coyote = Math.max(0, player.coyote - dt);
	player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);
	player.dashCooldown = Math.max(0, player.dashCooldown - dt);
	player.invuln = Math.max(0, player.invuln - dt);

	if (player.onGround) {
		player.coyote = 0.14;
	}

	const moving = input.left || input.right || settings.autoRun;
	if (moving) {
		let dir = 0;
		if (settings.autoRun) dir = 1;
		else if (input.left) dir -= 1;
		if (input.right) dir += 1;

		if (dir !== 0) {
			player.dir = dir;
		}

		const accel = player.onGround ? moveAccel : moveAccel * airControl;
		player.vx += dir * accel * dt;
	}

	if (!moving || (!input.left && !input.right && !settings.autoRun)) {
		const friction = drag * dt;
		if (player.vx > friction) player.vx -= friction;
		else if (player.vx < -friction) player.vx += friction;
		else player.vx = 0;
	}

	player.vx = Math.max(-maxSpeed, Math.min(maxSpeed, player.vx));

	if (player.jumpBuffer > 0 && player.coyote > 0) {
		applyJump();
		player.jumpBuffer = 0;
	}

	if (input.jumpHeld && player.vy < -140) {
		player.vy -= world.gravity * 0.4 * dt;
	}

	if (input.dashPressed && player.dashCooldown === 0 && player.energy >= 35) {
		player.dashTime = 0.16;
		player.dashCooldown = 0.5;
		player.energy -= 35;
		player.invuln = 0.25;
		camera.shake = settings.reduceMotion ? 0 : 8;
	}
	input.dashPressed = false;

	if (player.dashTime > 0) {
		player.dashTime -= dt;
		player.vx = player.dir * 820;
		player.vy = 0;
	} else {
		player.vy += world.gravity * dt;
	}

	player.energy = Math.min(100, player.energy + (player.onGround ? 28 : 16) * dt);

	let nextX = player.x + player.vx * dt;
	let nextY = player.y + player.vy * dt;

	const resolved = resolvePlatforms(nextX, nextY);
	player.x = resolved.x;
	player.y = resolved.y;

	if (player.onGround && Math.abs(player.vx) > 140 && !settings.reduceMotion) {
		if (Math.random() < 0.2) {
			addParticle(player.x + player.w * 0.5, player.y + player.h, "rgba(255,255,255,0.5)", 0.4, 3, -player.dir * 40, -40);
		}
	}

	if (player.y > world.deathY) {
		respawn();
	}

	camera.x = Math.max(0, player.x - BASE_WIDTH * 0.35);
	camera.shake = Math.max(0, camera.shake - dt * 30);

	player.distance = Math.max(player.distance, Math.floor(player.x / 10));
	player.score += dt * 12 * player.combo;

	player.comboTimer = Math.max(0, player.comboTimer - dt);
	if (player.comboTimer === 0) player.combo = 1;

	ensureChunks();

	for (const orb of orbs) {
		if (orb.collected) continue;
		const dx = player.x + player.w * 0.5 - orb.x;
		const dy = player.y + player.h * 0.5 - orb.y;
		if (dx * dx + dy * dy < 34 * 34) {
			orb.collected = true;
			player.score += 100 * player.combo;
			player.combo = Math.min(8, player.combo + 1);
			player.comboTimer = 2.5;
			player.energy = Math.min(100, player.energy + 8);
			if (!settings.reduceMotion) {
				for (let i = 0; i < 6; i++) {
					addParticle(orb.x, orb.y, "rgba(45,212,191,0.8)", 0.6, 3, (Math.random() - 0.5) * 140, (Math.random() - 0.5) * 140);
				}
			}
		}
	}

	for (const drone of drones) {
		drone.hover += dt * 2;
		drone.y += Math.sin(drone.hover) * 12 * dt;
		drone.x += drone.vx * dt;

		const overlapX = player.x < drone.x + drone.w && player.x + player.w > drone.x;
		const overlapY = player.y < drone.y + drone.h && player.y + player.h > drone.y;
		if (overlapX && overlapY) {
			if (player.dashTime > 0) {
				drone.x -= 80;
				player.score += 120;
				camera.shake = settings.reduceMotion ? 0 : 10;
			} else if (player.invuln === 0) {
				respawn();
				break;
			}
		}
	}

	for (const particle of particles) {
		particle.life -= dt;
		particle.x += particle.vx * dt;
		particle.y += particle.vy * dt;
		particle.vx *= 0.96;
		particle.vy += world.gravity * dt * 0.15;
	}

	for (let i = particles.length - 1; i >= 0; i--) {
		if (particles[i].life <= 0) particles.splice(i, 1);
	}

	const cleanupX = camera.x - 300;
	for (let i = platforms.length - 1; i >= 0; i--) {
		if (platforms[i].x + platforms[i].w < cleanupX) platforms.splice(i, 1);
	}
	for (let i = orbs.length - 1; i >= 0; i--) {
		if (orbs[i].x < cleanupX) orbs.splice(i, 1);
	}
	for (let i = drones.length - 1; i >= 0; i--) {
		if (drones[i].x + drones[i].w < cleanupX) drones.splice(i, 1);
	}

	updateStats();
}

function drawBackground() {
	const gradient = ctx.createLinearGradient(0, 0, 0, BASE_HEIGHT);
	gradient.addColorStop(0, "#0b1320");
	gradient.addColorStop(0.5, "#122133");
	gradient.addColorStop(1, "#1f3a46");
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

	ctx.save();
	ctx.translate(-camera.x * 0.15, 0);
	ctx.fillStyle = "rgba(56,189,248,0.08)";
	for (let i = 0; i < 12; i++) {
		ctx.fillRect(i * 160, 120 + Math.sin(i) * 10, 80, 220);
	}
	ctx.restore();

	ctx.save();
	ctx.translate(-camera.x * 0.3, 0);
	ctx.strokeStyle = "rgba(255,255,255,0.08)";
	ctx.lineWidth = 2;
	for (let i = 0; i < 16; i++) {
		ctx.beginPath();
		ctx.moveTo(i * 140, 320);
		ctx.lineTo(i * 140 + 60, 260);
		ctx.lineTo(i * 140 + 120, 320);
		ctx.stroke();
	}
	ctx.restore();
}

function drawPlatforms() {
	for (const platform of platforms) {
		if (platform.x + platform.w < camera.x - 100 || platform.x > camera.x + BASE_WIDTH + 100) continue;
		if (platform.type === "ground") {
			ctx.fillStyle = "#1f2937";
			ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
			ctx.fillStyle = "rgba(45,212,191,0.2)";
			ctx.fillRect(platform.x, platform.y + 6, platform.w, 3);
		} else {
			ctx.fillStyle = "#334155";
			ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
			ctx.fillStyle = "rgba(245,158,11,0.35)";
			ctx.fillRect(platform.x, platform.y + platform.h - 3, platform.w, 3);
		}
	}
}

function drawOrbs() {
	for (const orb of orbs) {
		if (orb.collected) continue;
		ctx.beginPath();
		ctx.fillStyle = "rgba(45,212,191,0.9)";
		ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = "rgba(255,255,255,0.5)";
		ctx.stroke();
	}
}

function drawDrones() {
	for (const drone of drones) {
		ctx.fillStyle = "#f97316";
		ctx.fillRect(drone.x, drone.y, drone.w, drone.h);
		ctx.fillStyle = "rgba(255,255,255,0.8)";
		ctx.fillRect(drone.x + 6, drone.y + 6, 6, 6);
		ctx.fillRect(drone.x + drone.w - 12, drone.y + 6, 6, 6);
	}
}

function drawPlayer() {
	if (player.invuln > 0 && Math.floor(player.invuln * 12) % 2 === 0) return;
	ctx.fillStyle = player.dashTime > 0 ? "#2dd4bf" : "#38bdf8";
	ctx.fillRect(player.x, player.y, player.w, player.h);
	ctx.fillStyle = "#0f172a";
	ctx.fillRect(player.x + 8, player.y + 12, 6, 6);
	ctx.fillRect(player.x + player.w - 14, player.y + 12, 6, 6);
}

function drawParticles() {
	for (const particle of particles) {
		ctx.globalAlpha = Math.max(0, particle.life);
		ctx.fillStyle = particle.color;
		ctx.beginPath();
		ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.globalAlpha = 1;
}

function render() {
	const shake = camera.shake * (Math.random() - 0.5);
	ctx.save();
	ctx.translate(shake, shake);
	drawBackground();
	ctx.translate(-camera.x, 0);
	drawPlatforms();
	drawOrbs();
	drawDrones();
	drawParticles();
	drawPlayer();
	ctx.restore();
}

function loop(timestamp) {
	if (!lastTime) lastTime = timestamp;
	const dt = Math.min(0.033, (timestamp - lastTime) / 1000);
	lastTime = timestamp;

	if (!paused && gameStarted && !gameOver) {
		updateGame(dt);
	}
	render();
	requestAnimationFrame(loop);
}

function initControls() {
	document.addEventListener("keydown", (e) => {
		if (!gameStarted) startRun();
		if (e.code === "KeyR") resetRun();
		handleInput(e, true);
	});

	document.addEventListener("keyup", (e) => {
		handleInput(e, false);
	});

	btnPause.addEventListener("click", () => {
		if (!gameStarted) return;
		setPaused(!paused);
	});

	btnRestart.addEventListener("click", () => {
		resetRun();
		startRun();
	});

	btnStart.addEventListener("click", () => {
		startRun();
	});

	btnResume.addEventListener("click", () => {
		setPaused(false);
	});

	btnRetry.addEventListener("click", () => {
		resetRun();
		startRun();
	});

	const touchMap = {
		left: "left",
		right: "right",
		jump: "jumpHeld",
		dash: "dashPressed",
	};

	document.querySelectorAll("#touch-controls button").forEach((btn) => {
		const control = btn.dataset.control;
		const key = touchMap[control];
		if (!key) return;

		btn.addEventListener("pointerdown", (e) => {
			e.preventDefault();
			if (!gameStarted) startRun();
			if (key === "dashPressed") input.dashPressed = true;
			else input[key] = true;
		});

		btn.addEventListener("pointerup", () => {
			if (key !== "dashPressed") input[key] = false;
		});

		btn.addEventListener("pointerleave", () => {
			if (key !== "dashPressed") input[key] = false;
		});
	});
}

function initSettings() {
	toggleReduceMotion.addEventListener("change", (e) => {
		settings.reduceMotion = e.target.checked;
		saveSettings();
	});
	toggleHighContrast.addEventListener("change", (e) => {
		settings.highContrast = e.target.checked;
		document.body.classList.toggle("high-contrast", settings.highContrast);
		saveSettings();
	});
	toggleAutoRun.addEventListener("change", (e) => {
		settings.autoRun = e.target.checked;
		saveSettings();
	});
}

window.addEventListener("resize", resizeCanvas);

loadSettings();
setupTabs();
resizeCanvas();
resetRun();
initControls();
initSettings();
requestAnimationFrame(loop);
