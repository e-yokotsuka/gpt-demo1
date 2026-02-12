const canvas = document.getElementById("codexCanvas");
const ctx = canvas.getContext("2d");
const frame = document.querySelector(".canvas-frame");

const overlayStart = document.getElementById("codex-overlay-start");
const overlayPause = document.getElementById("codex-overlay-pause");
const overlayOver = document.getElementById("codex-overlay-over");
const finalScoreEl = document.getElementById("codex-final");

const hudDistance = document.getElementById("hud-distance");
const hudScore = document.getElementById("hud-score");
const hudCombo = document.getElementById("hud-combo");
const hudEnergy = document.getElementById("hud-energy");
const hudLives = document.getElementById("hud-lives");

const btnPause = document.getElementById("btn-codex-pause");
const btnRestart = document.getElementById("btn-codex-restart");
const btnFullscreen = document.getElementById("btn-codex-fullscreen");
const btnStart = document.getElementById("btn-codex-start");
const btnResume = document.getElementById("btn-codex-resume");
const btnRetry = document.getElementById("btn-codex-retry");

const toggleReduceMotion = document.getElementById("codex-reduce-motion");
const toggleHighContrast = document.getElementById("codex-high-contrast");
const toggleAutoRun = document.getElementById("codex-auto-run");

const BASE_W = 960;
const BASE_H = 540;

const settings = {
	reduceMotion: false,
	highContrast: false,
	autoRun: false,
};

const world = {
	gravity: 2000,
	groundY: 430,
	chunk: 620,
	deathY: 680,
};

const input = {
	left: false,
	right: false,
	jumpHeld: false,
	jumpPressed: false,
	dashPressed: false,
};

const player = {
	x: 140,
	y: 140,
	w: 36,
	h: 48,
	vx: 0,
	vy: 0,
	dir: 1,
	onGround: false,
	wallSlide: false,
	wallDir: 0,
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
	checkpointX: 140,
};

const camera = { x: 0, shake: 0 };

const platforms = [];
const orbs = [];
const sentries = [];
const sparks = [];

let lastTime = 0;
let gameStarted = false;
let paused = false;
let gameOver = false;
let generated = -1;

function seededRandom(seed) {
	let s = seed >>> 0;
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 0xffffffff;
	};
}

function loadSettings() {
	const stored = JSON.parse(localStorage.getItem("codexSideScroller") || "{}");
	Object.assign(settings, stored);
	toggleReduceMotion.checked = settings.reduceMotion;
	toggleHighContrast.checked = settings.highContrast;
	toggleAutoRun.checked = settings.autoRun;
	document.body.classList.toggle("high-contrast", settings.highContrast);
}

function saveSettings() {
	localStorage.setItem("codexSideScroller", JSON.stringify(settings));
}

function resizeCanvas() {
	const rect = frame.getBoundingClientRect();
	const availableW = Math.max(320, rect.width - 2);
	const availableH = Math.max(220, window.innerHeight - rect.top - 20);
	let width = Math.min(availableW, BASE_W);
	let height = (width * BASE_H) / BASE_W;
	if (height > availableH) {
		height = availableH;
		width = (height * BASE_W) / BASE_H;
	}
	const scale = width / BASE_W;
	const dpr = window.devicePixelRatio || 1;

	canvas.style.width = `${Math.floor(width)}px`;
	canvas.style.height = `${Math.floor(height)}px`;
	canvas.width = Math.floor(width * dpr);
	canvas.height = Math.floor(height * dpr);
	ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
}

function addSpark(x, y, color, life, size, vx, vy) {
	sparks.push({ x, y, color, life, size, vx, vy });
}

function addOrb(x, y) {
	orbs.push({ x, y, r: 8, collected: false });
}

function addSentry(x, y) {
	sentries.push({ x, y, w: 28, h: 28, vx: -120, pulse: Math.random() * Math.PI * 2 });
}

function generateChunk(index) {
	const startX = index * world.chunk;
	const rand = seededRandom(index * 913 + 19);

	let x = startX;
	while (x < startX + world.chunk) {
		const width = 160 + rand() * 240;
		const gap = rand() < 0.25 ? 80 + rand() * 140 : 0;
		platforms.push({ x, y: world.groundY, w: width, h: 40, type: "ground" });
		if (rand() < 0.65) {
			const orbCount = 3 + Math.floor(rand() * 4);
			for (let i = 0; i < orbCount; i++) {
				addOrb(x + 30 + i * 20, world.groundY - 60 - rand() * 30);
			}
		}
		x += width + gap;
	}

	const ledges = 2 + Math.floor(rand() * 3);
	for (let i = 0; i < ledges; i++) {
		const px = startX + 60 + rand() * (world.chunk - 200);
		const py = world.groundY - 120 - rand() * 200;
		const pw = 90 + rand() * 130;
		platforms.push({ x: px, y: py, w: pw, h: 18, type: "ledge" });
		if (rand() < 0.7) addOrb(px + pw * 0.5, py - 24);
		if (rand() < 0.35) addSentry(px + pw * 0.4, py - 50);
	}

	if (rand() < 0.5) {
		const wallX = startX + world.chunk * 0.7;
		platforms.push({ x: wallX, y: world.groundY - 220, w: 28, h: 220, type: "wall" });
		addOrb(wallX + 60, world.groundY - 260);
	}
}

function ensureChunks() {
	const current = Math.floor(camera.x / world.chunk);
	const needed = current + 4;
	while (generated < needed) {
		generated++;
		generateChunk(generated);
	}
}

function resetRun() {
	player.x = 140;
	player.y = 140;
	player.vx = 0;
	player.vy = 0;
	player.dir = 1;
	player.onGround = false;
	player.wallSlide = false;
	player.wallDir = 0;
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
	player.checkpointX = 140;

	camera.x = 0;
	camera.shake = 0;
	platforms.length = 0;
	orbs.length = 0;
	sentries.length = 0;
	sparks.length = 0;
	generated = -1;

	// Always provide a guaranteed safe floor at run start.
	platforms.push({ x: -260, y: world.groundY, w: 1320, h: 40, type: "ground" });

	for (let i = 0; i < 5; i++) {
		generated++;
		generateChunk(generated);
	}
}

function startRun() {
	gameStarted = true;
	paused = false;
	gameOver = false;
	overlayStart.classList.remove("show");
	overlayPause.classList.remove("show");
	overlayOver.classList.remove("show");
	if (btnPause) btnPause.textContent = "Pause";
}

function setPaused(value) {
	paused = value;
	overlayPause.classList.toggle("show", paused);
	if (btnPause) btnPause.textContent = paused ? "Resume" : "Pause";
}

function endRun() {
	gameOver = true;
	finalScoreEl.textContent = `Score ${Math.floor(player.score)}`;
	overlayOver.classList.add("show");
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

function applyJump(forceX = 0) {
	player.vy = -650;
	player.vx += forceX;
	player.onGround = false;
	player.wallSlide = false;
	player.coyote = 0;
}

function resolveVertical(nextY) {
	player.onGround = false;
	for (const platform of platforms) {
		const overlapX = player.x + player.w > platform.x && player.x < platform.x + platform.w;
		if (!overlapX) continue;
		if (player.y + player.h <= platform.y && nextY + player.h >= platform.y) {
			nextY = platform.y - player.h;
			player.vy = 0;
			player.onGround = true;
		}
	}
	return nextY;
}

function resolveHorizontal(nextX) {
	player.wallSlide = false;
	player.wallDir = 0;
	for (const platform of platforms) {
		const overlapY = player.y + player.h > platform.y && player.y < platform.y + platform.h;
		if (!overlapY) continue;
		if (player.x + player.w <= platform.x && nextX + player.w >= platform.x) {
			nextX = platform.x - player.w;
			player.vx = 0;
			if (!player.onGround && player.vy > 0) {
				player.wallSlide = true;
				player.wallDir = -1;
			}
		}
		if (player.x >= platform.x + platform.w && nextX <= platform.x + platform.w) {
			nextX = platform.x + platform.w;
			player.vx = 0;
			if (!player.onGround && player.vy > 0) {
				player.wallSlide = true;
				player.wallDir = 1;
			}
		}
	}
	return nextX;
}

function respawn() {
	player.lives -= 1;
	player.energy = 100;
	player.invuln = 1.4;
	player.dashTime = 0;
	player.dashCooldown = 0;
	player.combo = 1;
	player.comboTimer = 0;

	if (player.lives <= 0) {
		endRun();
		return;
	}

	player.x = Math.max(120, player.checkpointX);
	player.y = world.groundY - player.h - 20;
	player.vx = 0;
	player.vy = 0;
	camera.x = Math.max(0, player.x - BASE_W * 0.35);
}

function updateHUD() {
	hudDistance.textContent = Math.floor(player.distance);
	hudScore.textContent = Math.floor(player.score);
	hudCombo.textContent = `x${player.combo}`;
	hudEnergy.textContent = `${Math.floor(player.energy)}%`;
	hudLives.textContent = player.lives;
}

function updateGame(dt) {
	const moveAccel = 5200;
	const maxSpeed = 340;
	const airControl = 0.7;
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
		player.coyote = 0.16;
	}

	const moving = input.left || input.right || settings.autoRun;
	let dir = 0;
	if (settings.autoRun) dir = 1;
	else {
		if (input.left) dir -= 1;
		if (input.right) dir += 1;
	}

	if (dir !== 0) player.dir = dir;

	if (moving && dir !== 0) {
		const accel = player.onGround ? moveAccel : moveAccel * airControl;
		player.vx += dir * accel * dt;
	} else {
		const friction = drag * dt;
		if (player.vx > friction) player.vx -= friction;
		else if (player.vx < -friction) player.vx += friction;
		else player.vx = 0;
	}

	player.vx = Math.max(-maxSpeed, Math.min(maxSpeed, player.vx));

	if (player.jumpBuffer > 0 && (player.coyote > 0 || player.wallSlide)) {
		const wallKick = player.wallSlide ? 320 * player.wallDir : 0;
		applyJump(wallKick);
		player.jumpBuffer = 0;
	}

	if (input.jumpHeld && player.vy < -160) {
		player.vy -= world.gravity * 0.4 * dt;
	}

	if (input.dashPressed && player.dashCooldown === 0 && player.energy >= 35) {
		player.dashTime = 0.18;
		player.dashCooldown = 0.6;
		player.energy -= 35;
		player.invuln = 0.3;
		camera.shake = settings.reduceMotion ? 0 : 10;
	}
	input.dashPressed = false;

	if (player.dashTime > 0) {
		player.dashTime -= dt;
		player.vx = player.dir * 860;
		player.vy = 0;
	} else {
		player.vy += world.gravity * dt;
	}

	if (player.wallSlide) {
		player.vy = Math.min(player.vy, 260);
	}

	player.energy = Math.min(100, player.energy + (player.onGround ? 30 : 18) * dt);

	let nextY = player.y + player.vy * dt;
	nextY = resolveVertical(nextY);
	player.y = nextY;

	let nextX = player.x + player.vx * dt;
	nextX = resolveHorizontal(nextX);
	player.x = nextX;

	if (player.y > world.deathY) {
		respawn();
	}

	camera.x = Math.max(0, player.x - BASE_W * 0.35);
	camera.shake = Math.max(0, camera.shake - dt * 30);

	const overdrive = player.combo >= 5;
	if (player.onGround) {
		player.checkpointX = Math.max(player.checkpointX, player.x);
	}
	player.distance = Math.max(player.distance, Math.floor(player.x / 10));
	player.score += dt * (overdrive ? 30 : 16) * player.combo;

	player.comboTimer = Math.max(0, player.comboTimer - dt);
	if (player.comboTimer === 0) player.combo = 1;

	ensureChunks();

	for (const orb of orbs) {
		if (orb.collected) continue;
		const dx = player.x + player.w * 0.5 - orb.x;
		const dy = player.y + player.h * 0.5 - orb.y;
		if (dx * dx + dy * dy < 34 * 34) {
			orb.collected = true;
			player.score += 120 * player.combo;
			player.combo = Math.min(9, player.combo + 1);
			player.comboTimer = 2.6;
			player.energy = Math.min(100, player.energy + 10);
			if (!settings.reduceMotion) {
				for (let i = 0; i < 7; i++) {
					addSpark(orb.x, orb.y, "rgba(244,114,182,0.85)", 0.6, 3, (Math.random() - 0.5) * 160, (Math.random() - 0.5) * 160);
				}
			}
		}
	}

	for (const sentry of sentries) {
		sentry.pulse += dt * 2;
		sentry.x += sentry.vx * dt;
		const overlapX = player.x < sentry.x + sentry.w && player.x + player.w > sentry.x;
		const overlapY = player.y < sentry.y + sentry.h && player.y + player.h > sentry.y;
		if (overlapX && overlapY) {
			if (player.dashTime > 0) {
				sentry.x -= 90;
				player.score += 160;
				camera.shake = settings.reduceMotion ? 0 : 12;
			} else if (player.invuln === 0) {
				respawn();
				break;
			}
		}
	}

	for (const spark of sparks) {
		spark.life -= dt;
		spark.x += spark.vx * dt;
		spark.y += spark.vy * dt;
		spark.vx *= 0.94;
		spark.vy += world.gravity * dt * 0.2;
	}
	for (let i = sparks.length - 1; i >= 0; i--) {
		if (sparks[i].life <= 0) sparks.splice(i, 1);
	}

	const cleanupX = camera.x - 320;
	for (let i = platforms.length - 1; i >= 0; i--) {
		if (platforms[i].x + platforms[i].w < cleanupX) platforms.splice(i, 1);
	}
	for (let i = orbs.length - 1; i >= 0; i--) {
		if (orbs[i].x < cleanupX) orbs.splice(i, 1);
	}
	for (let i = sentries.length - 1; i >= 0; i--) {
		if (sentries[i].x + sentries[i].w < cleanupX) sentries.splice(i, 1);
	}

	updateHUD();
}

function drawBackground() {
	const gradient = ctx.createLinearGradient(0, 0, 0, BASE_H);
	gradient.addColorStop(0, "#05060b");
	gradient.addColorStop(0.5, "#0e1726");
	gradient.addColorStop(1, "#1b2b3a");
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, BASE_W, BASE_H);

	ctx.save();
	ctx.translate(-camera.x * 0.2, 0);
	ctx.fillStyle = "rgba(34,211,238,0.08)";
	for (let i = 0; i < 12; i++) {
		ctx.fillRect(i * 180, 120 + Math.sin(i) * 12, 90, 240);
	}
	ctx.restore();

	ctx.save();
	ctx.translate(-camera.x * 0.35, 0);
	ctx.strokeStyle = "rgba(244,114,182,0.12)";
	ctx.lineWidth = 2;
	for (let i = 0; i < 14; i++) {
		ctx.beginPath();
		ctx.moveTo(i * 160, 320);
		ctx.lineTo(i * 160 + 80, 260);
		ctx.lineTo(i * 160 + 140, 330);
		ctx.stroke();
	}
	ctx.restore();
}

function drawPlatforms() {
	for (const platform of platforms) {
		if (platform.x + platform.w < camera.x - 120 || platform.x > camera.x + BASE_W + 120) continue;
		if (platform.type === "ground") {
			ctx.fillStyle = "#1f2937";
			ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
			ctx.fillStyle = "rgba(34,211,238,0.25)";
			ctx.fillRect(platform.x, platform.y + 6, platform.w, 3);
		} else if (platform.type === "wall") {
			ctx.fillStyle = "#0f172a";
			ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
			ctx.fillStyle = "rgba(244,114,182,0.4)";
			ctx.fillRect(platform.x, platform.y, platform.w, 4);
		} else {
			ctx.fillStyle = "#334155";
			ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
			ctx.fillStyle = "rgba(244,114,182,0.3)";
			ctx.fillRect(platform.x, platform.y + platform.h - 3, platform.w, 3);
		}
	}
}

function drawOrbs() {
	for (const orb of orbs) {
		if (orb.collected) continue;
		ctx.beginPath();
		ctx.fillStyle = "rgba(244,114,182,0.9)";
		ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = "rgba(255,255,255,0.5)";
		ctx.stroke();
	}
}

function drawSentries() {
	for (const sentry of sentries) {
		ctx.fillStyle = "#22d3ee";
		ctx.fillRect(sentry.x, sentry.y, sentry.w, sentry.h);
		ctx.fillStyle = "rgba(0,0,0,0.6)";
		ctx.fillRect(sentry.x + 6, sentry.y + 6, 6, 6);
		ctx.fillRect(sentry.x + sentry.w - 12, sentry.y + 6, 6, 6);
		ctx.fillStyle = "rgba(244,114,182,0.4)";
		ctx.fillRect(sentry.x + 4, sentry.y + sentry.h - 4, sentry.w - 8, 3);
	}
}

function drawPlayer() {
	if (player.invuln > 0 && Math.floor(player.invuln * 12) % 2 === 0) return;
	const overdrive = player.combo >= 5;
	ctx.fillStyle = overdrive ? "#fbbf24" : player.dashTime > 0 ? "#f472b6" : "#22d3ee";
	ctx.fillRect(player.x, player.y, player.w, player.h);
	ctx.fillStyle = "#0f172a";
	ctx.fillRect(player.x + 8, player.y + 12, 6, 6);
	ctx.fillRect(player.x + player.w - 14, player.y + 12, 6, 6);
	if (player.wallSlide && !settings.reduceMotion) {
		ctx.fillStyle = "rgba(244,114,182,0.35)";
		ctx.fillRect(player.x + (player.wallDir < 0 ? player.w - 4 : 0), player.y, 4, player.h);
	}
}

function drawSparks() {
	for (const spark of sparks) {
		ctx.globalAlpha = Math.max(0, spark.life);
		ctx.fillStyle = spark.color;
		ctx.beginPath();
		ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
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
	drawSentries();
	drawSparks();
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

function initPanels() {
	document.querySelectorAll(".panel-tab").forEach((tab) => {
		tab.addEventListener("click", () => {
			document.querySelectorAll(".panel-tab").forEach((btn) => btn.classList.remove("active"));
			document.querySelectorAll(".panel-body").forEach((panel) => panel.classList.remove("active"));
			tab.classList.add("active");
			const target = document.getElementById(`panel-${tab.dataset.panel}`);
			if (target) target.classList.add("active");
		});
	});
}

function initControls() {
	document.addEventListener("keydown", (e) => {
		if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space", "ShiftLeft", "ShiftRight"].includes(e.code)) {
			e.preventDefault();
		}
		if (!gameStarted) startRun();
		if (e.code === "Escape" && !gameOver) {
			setPaused(!paused);
			return;
		}
		if (e.code === "KeyR") resetRun();
		handleInput(e, true);
	}, { passive: false });
	document.addEventListener("keyup", (e) => handleInput(e, false));

	if (btnPause) btnPause.addEventListener("click", () => {
		if (!gameStarted) return;
		setPaused(!paused);
	});
	if (btnRestart) btnRestart.addEventListener("click", () => {
		resetRun();
		startRun();
	});
	if (btnStart) btnStart.addEventListener("click", () => startRun());
	if (btnResume) btnResume.addEventListener("click", () => setPaused(false));
	if (btnRetry) btnRetry.addEventListener("click", () => {
		resetRun();
		startRun();
	});
	if (btnFullscreen) btnFullscreen.addEventListener("click", async () => {
		try {
			if (document.fullscreenElement) {
				await document.exitFullscreen();
			} else {
				await frame.requestFullscreen();
			}
		} catch (_e) {
			// Ignore unsupported fullscreen errors.
		}
	});

	const touchMap = {
		left: "left",
		right: "right",
		jump: "jumpHeld",
		dash: "dashPressed",
	};

	document.querySelectorAll("#codex-touch button").forEach((btn) => {
		const control = btn.dataset.control;
		const key = touchMap[control];
		if (!key) return;
		btn.addEventListener("pointerdown", (e) => {
			e.preventDefault();
			if (!gameStarted) startRun();
			if (key === "dashPressed") {
				input.dashPressed = true;
			} else if (key === "jumpHeld") {
				input.jumpHeld = true;
				input.jumpPressed = true;
			} else {
				input[key] = true;
			}
		});
		btn.addEventListener("pointerup", () => {
			if (key !== "dashPressed") input[key] = false;
		});
		btn.addEventListener("pointerleave", () => {
			if (key !== "dashPressed") input[key] = false;
		});
		btn.addEventListener("pointercancel", () => {
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
document.addEventListener("fullscreenchange", resizeCanvas);

loadSettings();
initPanels();
resizeCanvas();
resetRun();
initControls();
initSettings();
requestAnimationFrame(loop);
