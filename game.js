// キャンバスのセットアップ
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// ゲーム定数
const GRAVITY = 0.6;
const JUMP_POWER = -12;
const ENEMY_JUMP_POWER = -24;
const MOVE_SPEED = 5;
const GROUND_Y = 550; // 地面の基準Y座標
const CHUNK_WIDTH = 400; // チャンク幅
const FALL_DEATH_Y = 800; // この位置より下に落ちたらライフ減少

// カメラオブジェクト
const camera = {
	x: 0,
	y: 0,
	targetY: 0,
};

// プレイヤーオブジェクト
const player = {
	x: 100,
	y: 300,
	width: 40,
	height: 40,
	velocityX: 0,
	velocityY: 0,
	isJumping: false,
	color: "#FF6B6B",
	life: 5,
	maxLife: 5,
	invincibleTimer: 0,
	invincibleDuration: 120,
	powerInvincibleTimer: 0, // パワーアップ無敵タイマー
	powerInvincibleDuration: 300, // パワーアップ無敵時間（5秒）
};

// プラットフォーム配列（動的に生成）
const platforms = [];

// 装飾オブジェクト（電柱など）
const decorations = [];

// 雲配列（パララックス用）
const clouds = [];

// 無敵アイテム配列
const powerups = [];

// 敵キャラクター配列
const enemies = [];

// 敵の弾配列
const enemyBullets = [];

// 敵スポーンタイマー
let enemySpawnTimer = 0;
const ENEMY_SPAWN_INTERVAL = 150;

// ゲーム状態
let gameOver = false;

// スコア関連
let score = 0;
let highScore = Number.parseInt(localStorage.getItem("highScore"), 10) || 0;
let distanceTraveled = 0; // 移動距離スコア

// 通常弾の配列
const normalBullets = [];
const MAX_NORMAL_BULLETS = 10;
let normalBulletCooldown = 0;
const NORMAL_BULLET_COOLDOWN_TIME = 10; // 連射可能（約0.17秒）

// 爆発エフェクト配列
const explosions = [];

// ホーミングミサイルの配列
const bullets = [];

// 弾の発射クールダウン
let bulletCooldown = 0;
const BULLET_COOLDOWN_TIME = 45;
const MAX_BULLETS = 12;
const SALVO_COUNT = 4;

// チャンク管理（無限スクロール用）
let generatedChunkMax = -1; // 生成済みの最大チャンクインデックス

// キーボードの状態
const keys = {};

// シード付き乱数（チャンクごとに再現可能なランダム）
function seededRandom(seed) {
	let s = seed;
	return () => {
		s = (s * 1664525 + 1013904223) & 0xffffffff;
		return (s >>> 0) / 0xffffffff;
	};
}

// チャンクを生成する関数
function generateChunk(chunkIndex) {
	const chunkX = chunkIndex * CHUNK_WIDTH;
	const rand = seededRandom(chunkIndex * 7919 + 12345);

	// 最初のチャンクは安全な地面を保証
	if (chunkIndex <= 1) {
		platforms.push({
			x: chunkX,
			y: GROUND_Y,
			width: CHUNK_WIDTH,
			height: 50,
			color: "#6B8E23",
			isGround: true,
		});
	} else {
		// 地面を生成（ランダムに穴を開ける）
		const hasGap = rand() < 0.25; // 25%の確率で穴
		if (hasGap) {
			// 穴の前半分に地面
			const groundWidth = 80 + rand() * 120;
			platforms.push({
				x: chunkX,
				y: GROUND_Y,
				width: groundWidth,
				height: 50,
				color: "#6B8E23",
				isGround: true,
			});
			// 穴の後に地面（穴幅は80〜160px）
			const gapWidth = 80 + rand() * 80;
			const afterGapX = chunkX + groundWidth + gapWidth;
			const afterGapWidth = CHUNK_WIDTH - groundWidth - gapWidth;
			if (afterGapWidth > 20) {
				platforms.push({
					x: afterGapX,
					y: GROUND_Y,
					width: afterGapWidth,
					height: 50,
					color: "#6B8E23",
					isGround: true,
				});
			}
		} else {
			platforms.push({
				x: chunkX,
				y: GROUND_Y,
				width: CHUNK_WIDTH,
				height: 50,
				color: "#6B8E23",
				isGround: true,
			});
		}
	}

	// 上空に向かって登れる足場を階段状に生成
	// ジャンプ到達範囲：高さ約100px、横幅約180px以内に次の足場を配置
	const MAX_JUMP_HEIGHT = 95; // 余裕を持たせた最大ジャンプ高さ
	const MAX_JUMP_HORIZONTAL = 170; // 余裕を持たせた最大横距離
	const VERTICAL_LEVELS = 15 + Math.floor(rand() * 10); // このチャンクで何段上まで生成するか
	let prevX = chunkX + rand() * (CHUNK_WIDTH - 100); // 最初の足場のX
	let prevY = GROUND_Y - 80 - rand() * 40; // 地面の少し上からスタート

	// 最初の低い足場（地面から登れる入口）
	platforms.push({
		x: prevX,
		y: prevY,
		width: 80 + rand() * 60,
		height: 20,
		color: "#8B4513",
		isGround: false,
	});

	for (let level = 1; level < VERTICAL_LEVELS; level++) {
		// 次の足場を前の足場からジャンプ到達範囲内に配置
		const offsetX = (rand() - 0.5) * MAX_JUMP_HORIZONTAL;
		const offsetY = -(40 + rand() * (MAX_JUMP_HEIGHT - 40)); // 40〜95px上

		let nextX = prevX + offsetX;
		const nextY = prevY + offsetY;

		// チャンク内に収まるように調整
		const platWidth = 70 + rand() * 60;
		if (nextX < chunkX) nextX = chunkX + rand() * 30;
		if (nextX + platWidth > chunkX + CHUNK_WIDTH) {
			nextX = chunkX + CHUNK_WIDTH - platWidth - rand() * 30;
		}

		platforms.push({
			x: nextX,
			y: nextY,
			width: platWidth,
			height: 20,
			color: "#8B4513",
			isGround: false,
		});

		prevX = nextX;
		prevY = nextY;
	}

	// 隣のチャンクへの接続用：各高度帯に横移動しやすい中継足場を追加
	const bridgeCount = 2 + Math.floor(rand() * 3);
	for (let b = 0; b < bridgeCount; b++) {
		const bridgeY = GROUND_Y - 150 - b * 200 - rand() * 150;
		const bridgeX = chunkX + rand() * (CHUNK_WIDTH - 120);
		platforms.push({
			x: bridgeX,
			y: bridgeY,
			width: 90 + rand() * 70,
			height: 20,
			color: "#8B4513",
			isGround: false,
		});
	}

	// 電柱を配置（30%の確率）
	if (rand() < 0.3 && chunkIndex > 0) {
		const poleX = chunkX + 50 + rand() * (CHUNK_WIDTH - 100);
		decorations.push({
			x: poleX,
			y: GROUND_Y,
			type: "pole",
			chunkIndex: chunkIndex,
		});
	}

	// 無敵アイテムを配置（8%の確率）
	if (rand() < 0.08 && chunkIndex > 2) {
		const itemX = chunkX + rand() * (CHUNK_WIDTH - 30);
		const itemY = 250 + rand() * 200;
		powerups.push({
			x: itemX,
			y: itemY,
			width: 25,
			height: 25,
			collected: false,
			chunkIndex: chunkIndex,
		});
	}
}

// 雲を初期化
function initClouds() {
	for (let i = 0; i < 15; i++) {
		clouds.push({
			x: Math.random() * 2000 - 500,
			y: Math.random() * 200 + 20,
			width: 60 + Math.random() * 100,
			height: 25 + Math.random() * 30,
			speed: 0.1 + Math.random() * 0.3, // パララックス速度
			alpha: 0.3 + Math.random() * 0.4,
		});
	}
}

// 初期チャンクを生成
function initWorld() {
	platforms.length = 0;
	decorations.length = 0;
	powerups.length = 0;
	generatedChunkMax = -1;
	// 画面分＋余裕を持って生成
	for (let i = 0; i <= 5; i++) {
		generatedChunkMax = i;
		generateChunk(i);
	}
}

// キーボードイベントリスナー
document.addEventListener("keydown", (e) => {
	keys[e.key] = true;

	// ジャンプ
	if (
		(e.key === " " || e.key === "w" || e.key === "W" || e.key === "ArrowUp") &&
		!player.isJumping &&
		!gameOver
	) {
		player.velocityY = JUMP_POWER;
		player.isJumping = true;
	}

	// リスタート
	if ((e.key === "r" || e.key === "R") && gameOver) {
		restartGame();
	}

	// ホーミング弾を発射
	if ((e.key === "z" || e.key === "Z") && !gameOver) {
		shootBullet();
	}

	// 通常弾を発射
	if ((e.key === "x" || e.key === "X") && !gameOver) {
		shootNormalBullet();
	}
});

document.addEventListener("keyup", (e) => {
	keys[e.key] = false;
});

// ゲームをリスタートする関数
function restartGame() {
	player.x = 100;
	player.y = 300;
	player.velocityX = 0;
	player.velocityY = 0;
	player.isJumping = false;
	player.life = player.maxLife;
	player.invincibleTimer = 0;
	player.powerInvincibleTimer = 0;

	camera.x = 0;
	camera.y = 0;
	camera.targetY = 0;

	enemies.length = 0;
	enemyBullets.length = 0;
	enemySpawnTimer = 0;
	bullets.length = 0;
	bulletCooldown = 0;
	normalBullets.length = 0;
	normalBulletCooldown = 0;
	explosions.length = 0;
	score = 0;
	distanceTraveled = 0;
	gameOver = false;

	initWorld();
}

// 通常弾を発射する関数
function shootNormalBullet() {
	if (normalBulletCooldown > 0 || normalBullets.length >= MAX_NORMAL_BULLETS) {
		return;
	}

	normalBullets.push({
		x: player.x + player.width,
		y: player.y + player.height / 2 - 3,
		width: 10,
		height: 6,
		velocityX: 10,
		velocityY: 0,
	});

	normalBulletCooldown = NORMAL_BULLET_COOLDOWN_TIME;
}

// 爆発を生成する関数
function createExplosion(x, y) {
	explosions.push({
		x: x,
		y: y,
		radius: 5,
		maxRadius: 30,
		expandSpeed: 3,
		alpha: 1.0,
		fadeSpeed: 0.05,
	});
}

// 板野サーカス風ホーミングミサイルを発射する関数
function shootBullet() {
	if (bulletCooldown > 0 || bullets.length >= MAX_BULLETS) {
		return;
	}

	for (let s = 0; s < SALVO_COUNT; s++) {
		if (bullets.length >= MAX_BULLETS) break;

		const spreadAngle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
		const initialSpeed = 4 + Math.random() * 3;

		const bullet = {
			x: player.x + player.width / 2,
			y: player.y + player.height / 2,
			width: 10,
			height: 5,
			velocityX: Math.cos(spreadAngle) * initialSpeed,
			velocityY: Math.sin(spreadAngle) * initialSpeed,
			speed: initialSpeed,
			maxSpeed: 9,
			acceleration: 0.15,
			turnSpeed: 0.06,
			fuel: 150,
			fuelConsumption: 1,
			angle: spreadAngle,
			color: "#FFD700",
			targetEnemy: null,
			retargetTimer: 0,
			retargetInterval: 20,
			launchPhase: 25 + Math.floor(Math.random() * 15),
		};
		bullets.push(bullet);
	}

	bulletCooldown = BULLET_COOLDOWN_TIME;
}

// レイキャスティングで障害物チェック
function hasLineOfSight(x1, y1, x2, y2) {
	const dx = x2 - x1;
	const dy = y2 - y1;
	const distance = Math.sqrt(dx * dx + dy * dy);
	const steps = Math.ceil(distance / 10); // 10ピクセルごとにチェック（最適化）

	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		const checkX = x1 + dx * t;
		const checkY = y1 + dy * t;

		for (const platform of platforms) {
			// 画面近くのプラットフォームのみチェック
			if (
				Math.abs(platform.x - camera.x) > canvas.width + 200 &&
				Math.abs(platform.x + platform.width - camera.x) > canvas.width + 200
			) {
				continue;
			}
			if (
				checkX >= platform.x &&
				checkX <= platform.x + platform.width &&
				checkY >= platform.y &&
				checkY <= platform.y + platform.height
			) {
				return false;
			}
		}
	}
	return true;
}

// 敵をスポーンする関数
function spawnEnemy() {
	const spawnX = camera.x + canvas.width + 50;
	// 地面に近い場所にスポーン
	const spawnY = GROUND_Y - 40 - Math.random() * 100;

	const typeRoll = Math.random();
	let enemy;

	if (typeRoll < 0.4) {
		// 通常の敵：左に歩く
		enemy = {
			x: spawnX,
			y: spawnY,
			width: 35,
			height: 35,
			speed: 1.5 + Math.random() * 1.5,
			velocityY: 0,
			isJumping: false,
			jumpChance: 0.02,
			color: "#E74C3C",
			direction: -1,
			type: "normal",
		};
	} else if (typeRoll < 0.7) {
		// 射撃型の敵：定期的に弾を撃つ
		enemy = {
			x: spawnX,
			y: spawnY,
			width: 35,
			height: 35,
			speed: 1.0 + Math.random() * 1.0,
			velocityY: 0,
			isJumping: false,
			jumpChance: 0.01,
			color: "#9B59B6",
			direction: -1,
			type: "shooter",
			shootTimer: 0,
			shootInterval: 90 + Math.floor(Math.random() * 60), // 1.5〜2.5秒ごとに射撃
		};
	} else {
		// ダッシュ型の敵：速度が変わる
		enemy = {
			x: spawnX,
			y: spawnY,
			width: 30,
			height: 30,
			speed: 2.0,
			velocityY: 0,
			isJumping: false,
			jumpChance: 0.03,
			color: "#E67E22",
			direction: -1,
			type: "dasher",
			dashTimer: 0,
			dashInterval: 120,
			isDashing: false,
			normalSpeed: 2.0,
			dashSpeed: 6.0,
		};
	}

	enemies.push(enemy);
}

// プレイヤーに最も近い安全な足場を見つける
function findSafeRespawnPoint() {
	let bestPlatform = null;
	let bestDist = Number.POSITIVE_INFINITY;

	for (const platform of platforms) {
		// カメラ付近のプラットフォームから探す
		if (platform.x + platform.width < camera.x - 200) continue;
		if (platform.x > camera.x + canvas.width + 200) continue;

		const platCenterX = platform.x + platform.width / 2;
		const dx = platCenterX - player.x;
		const dist = Math.abs(dx);

		if (dist < bestDist) {
			bestDist = dist;
			bestPlatform = platform;
		}
	}

	if (bestPlatform) {
		return {
			x: bestPlatform.x + bestPlatform.width / 2 - player.width / 2,
			y: bestPlatform.y - player.height - 10,
		};
	}
	// フォールバック
	return { x: camera.x + canvas.width / 2, y: 300 };
}

// 更新関数
function update() {
	if (gameOver) return;

	// 弾のクールダウンを減少
	if (bulletCooldown > 0) bulletCooldown--;
	if (normalBulletCooldown > 0) normalBulletCooldown--;

	// 水平方向の移動
	player.velocityX = 0;
	if (keys.ArrowLeft || keys.a || keys.A) {
		player.velocityX = -MOVE_SPEED;
	}
	if (keys.ArrowRight || keys.d || keys.D) {
		player.velocityX = MOVE_SPEED;
	}

	// 重力を適用
	player.velocityY += GRAVITY;

	// 位置を更新
	player.x += player.velocityX;
	player.y += player.velocityY;

	// 左端制限のみ（右は無限）
	if (player.x < 0) player.x = 0;

	// 移動距離スコアを加算
	const newDist = Math.floor(player.x / 50);
	if (newDist > distanceTraveled) {
		score += (newDist - distanceTraveled) * 5;
		distanceTraveled = newDist;
	}

	// カメラをプレイヤーに追従させる（X軸）
	camera.x = player.x - canvas.width / 3;
	if (camera.x < 0) camera.x = 0;

	// カメラをプレイヤーに追従させる（Y軸：デッドゾーン付き滑らか追従）
	// プレイヤーがデッドゾーン内にいる間はカメラを動かさない（ジャンプ時のガタつき抑制）
	const cameraCenterY = camera.y + canvas.height / 2;
	const deadZoneY = 100; // この範囲内ならカメラは追従しない
	if (player.y < cameraCenterY - deadZoneY) {
		camera.targetY = player.y + deadZoneY - canvas.height / 2;
	} else if (player.y > cameraCenterY + deadZoneY) {
		camera.targetY = player.y - deadZoneY - canvas.height / 2;
	}
	if (camera.targetY > 0) camera.targetY = 0; // 地面より下にはスクロールしない
	camera.y += (camera.targetY - camera.y) * 0.04;

	// 無限スクロール：新しいチャンクを必要に応じて生成
	const currentChunk = Math.floor(camera.x / CHUNK_WIDTH);
	const neededMax = currentChunk + Math.ceil(canvas.width / CHUNK_WIDTH) + 2;
	while (generatedChunkMax < neededMax) {
		generatedChunkMax++;
		generateChunk(generatedChunkMax);
	}

	// 古いプラットフォーム・装飾を削除（メモリ節約）
	const cleanupX = camera.x - canvas.width - CHUNK_WIDTH;
	for (let i = platforms.length - 1; i >= 0; i--) {
		if (platforms[i].x + platforms[i].width < cleanupX) {
			platforms.splice(i, 1);
		}
	}
	for (let i = decorations.length - 1; i >= 0; i--) {
		if (decorations[i].x < cleanupX - 100) {
			decorations.splice(i, 1);
		}
	}
	for (let i = powerups.length - 1; i >= 0; i--) {
		if (powerups[i].x < cleanupX) {
			powerups.splice(i, 1);
		}
	}

	// プラットフォームとの衝突判定
	let onGround = false;

	for (const platform of platforms) {
		if (
			player.x < platform.x + platform.width &&
			player.x + player.width > platform.x &&
			player.y + player.height > platform.y &&
			player.y + player.height < platform.y + platform.height + Math.max(player.velocityY, 5) &&
			player.velocityY >= 0
		) {
			player.y = platform.y - player.height;
			player.velocityY = 0;
			player.isJumping = false;
			onGround = true;
		}
	}

	if (onGround) {
		player.isJumping = false;
	}

	// 落下死判定
	if (player.y > FALL_DEATH_Y) {
		player.life--;
		player.invincibleTimer = player.invincibleDuration;

		if (player.life <= 0) {
			gameOver = true;
		} else {
			// 安全な場所にリスポーン
			const respawn = findSafeRespawnPoint();
			player.x = respawn.x;
			player.y = respawn.y;
			player.velocityX = 0;
			player.velocityY = 0;
			player.isJumping = false;
		}
	}

	// 敵のスポーン
	enemySpawnTimer++;
	if (enemySpawnTimer >= ENEMY_SPAWN_INTERVAL) {
		spawnEnemy();
		enemySpawnTimer = 0;
	}

	// 敵の更新
	for (let i = enemies.length - 1; i >= 0; i--) {
		const enemy = enemies[i];

		// タイプ別行動
		if (enemy.type === "shooter") {
			enemy.shootTimer++;
			if (enemy.shootTimer >= enemy.shootInterval) {
				enemy.shootTimer = 0;
				// プレイヤー方向に弾を撃つ
				const dx = player.x - enemy.x;
				const dy = player.y - enemy.y;
				const dist = Math.sqrt(dx * dx + dy * dy);
				if (dist < 500) {
					enemyBullets.push({
						x: enemy.x + enemy.width / 2,
						y: enemy.y + enemy.height / 2,
						velocityX: (dx / dist) * 4,
						velocityY: (dy / dist) * 4,
						width: 6,
						height: 6,
						life: 180, // 3秒で消える
					});
				}
			}
		} else if (enemy.type === "dasher") {
			enemy.dashTimer++;
			if (enemy.isDashing) {
				if (enemy.dashTimer >= 30) {
					// ダッシュ終了
					enemy.isDashing = false;
					enemy.speed = enemy.normalSpeed;
					enemy.dashTimer = 0;
				}
			} else {
				if (enemy.dashTimer >= enemy.dashInterval) {
					// ダッシュ開始
					enemy.isDashing = true;
					enemy.speed = enemy.dashSpeed;
					enemy.dashTimer = 0;
				}
			}
		}

		// 水平方向の移動
		enemy.x += enemy.speed * enemy.direction;

		// 重力を適用
		enemy.velocityY += GRAVITY;
		enemy.y += enemy.velocityY;

		// プラットフォームとの衝突判定
		let enemyOnGround = false;
		for (const platform of platforms) {
			if (
				Math.abs(platform.x - enemy.x) > canvas.width + 200 &&
				Math.abs(platform.x + platform.width - enemy.x) > canvas.width + 200
			) {
				continue;
			}
			if (
				enemy.x < platform.x + platform.width &&
				enemy.x + enemy.width > platform.x &&
				enemy.y + enemy.height > platform.y &&
				enemy.y + enemy.height < platform.y + platform.height + Math.max(enemy.velocityY, 5) &&
				enemy.velocityY >= 0
			) {
				enemy.y = platform.y - enemy.height;
				enemy.velocityY = 0;
				enemy.isJumping = false;
				enemyOnGround = true;
			}
		}

		if (enemyOnGround) {
			enemy.isJumping = false;
			if (Math.random() < enemy.jumpChance) {
				enemy.velocityY = ENEMY_JUMP_POWER;
				enemy.isJumping = true;
			}
		}

		// 画面外に出たら削除（落下含む）
		if (enemy.x + enemy.width < camera.x - 300 || enemy.y > FALL_DEATH_Y) {
			enemies.splice(i, 1);
		}
	}

	// 敵の弾の更新
	for (let i = enemyBullets.length - 1; i >= 0; i--) {
		const eb = enemyBullets[i];
		eb.x += eb.velocityX;
		eb.y += eb.velocityY;
		eb.life--;

		// プレイヤーとの衝突判定
		const isInvincible = player.invincibleTimer > 0 || player.powerInvincibleTimer > 0;
		if (
			!isInvincible &&
			eb.x < player.x + player.width &&
			eb.x + eb.width > player.x &&
			eb.y < player.y + player.height &&
			eb.y + eb.height > player.y
		) {
			player.life--;
			player.invincibleTimer = player.invincibleDuration;
			enemyBullets.splice(i, 1);
			if (player.life <= 0) gameOver = true;
			continue;
		}

		// 寿命切れまたは画面外
		if (
			eb.life <= 0 ||
			eb.x < camera.x - 100 ||
			eb.x > camera.x + canvas.width + 100 ||
			eb.y > FALL_DEATH_Y
		) {
			enemyBullets.splice(i, 1);
		}
	}

	// 無敵時間タイマーを減少
	if (player.invincibleTimer > 0) player.invincibleTimer--;
	if (player.powerInvincibleTimer > 0) player.powerInvincibleTimer--;

	// 無敵アイテムとの衝突判定
	for (let i = powerups.length - 1; i >= 0; i--) {
		const pu = powerups[i];
		if (pu.collected) continue;
		if (
			player.x < pu.x + pu.width &&
			player.x + player.width > pu.x &&
			player.y < pu.y + pu.height &&
			player.y + player.height > pu.y
		) {
			pu.collected = true;
			player.powerInvincibleTimer = player.powerInvincibleDuration;
			powerups.splice(i, 1);
		}
	}

	// プレイヤーと敵の衝突判定
	for (let i = enemies.length - 1; i >= 0; i--) {
		const enemy = enemies[i];
		if (
			player.x < enemy.x + enemy.width &&
			player.x + player.width > enemy.x &&
			player.y < enemy.y + enemy.height &&
			player.y + player.height > enemy.y
		) {
			if (player.powerInvincibleTimer > 0) {
				// パワーアップ無敵中は敵を倒す
				enemies.splice(i, 1);
				score += 150;
				if (score > highScore) {
					highScore = score;
					localStorage.setItem("highScore", highScore.toString());
				}
			} else if (player.invincibleTimer === 0) {
				player.life--;
				player.invincibleTimer = player.invincibleDuration;
				if (player.life <= 0) gameOver = true;
			}
		}
	}

	// 通常弾の更新
	for (let i = normalBullets.length - 1; i >= 0; i--) {
		const nb = normalBullets[i];
		nb.x += nb.velocityX;
		nb.y += nb.velocityY;

		// プラットフォームとの衝突
		let nbHitPlatform = false;
		for (const platform of platforms) {
			if (
				Math.abs(platform.x - nb.x) > canvas.width + 200 &&
				Math.abs(platform.x + platform.width - nb.x) > canvas.width + 200
			) {
				continue;
			}
			if (
				nb.x + nb.width >= platform.x &&
				nb.x <= platform.x + platform.width &&
				nb.y + nb.height >= platform.y &&
				nb.y <= platform.y + platform.height
			) {
				nbHitPlatform = true;
				break;
			}
		}

		if (nbHitPlatform) {
			createExplosion(nb.x + nb.width / 2, nb.y + nb.height / 2);
			normalBullets.splice(i, 1);
			continue;
		}

		// 画面外に出たら削除
		if (
			nb.x > camera.x + canvas.width + 100 ||
			nb.x < camera.x - 100 ||
			nb.y > FALL_DEATH_Y
		) {
			normalBullets.splice(i, 1);
			continue;
		}

		// 敵との衝突判定
		for (let j = enemies.length - 1; j >= 0; j--) {
			const enemy = enemies[j];
			if (
				nb.x < enemy.x + enemy.width &&
				nb.x + nb.width > enemy.x &&
				nb.y < enemy.y + enemy.height &&
				nb.y + nb.height > enemy.y
			) {
				createExplosion(nb.x + nb.width / 2, nb.y + nb.height / 2);
				normalBullets.splice(i, 1);
				enemies.splice(j, 1);
				score += 50;
				if (score > highScore) {
					highScore = score;
					localStorage.setItem("highScore", highScore.toString());
				}
				break;
			}
		}
	}

	// 爆発エフェクトの更新
	for (let i = explosions.length - 1; i >= 0; i--) {
		const ex = explosions[i];
		ex.radius += ex.expandSpeed;
		ex.alpha -= ex.fadeSpeed;
		// 膨張速度を減衰
		ex.expandSpeed *= 0.9;
		if (ex.alpha <= 0 || ex.radius >= ex.maxRadius) {
			explosions.splice(i, 1);
		}
	}

	// ホーミング弾の更新
	for (let i = bullets.length - 1; i >= 0; i--) {
		const bullet = bullets[i];

		if (bullet.fuel > 0) {
			bullet.fuel -= bullet.fuelConsumption;

			// 打ち上げフェーズ
			if (bullet.launchPhase > 0) {
				bullet.launchPhase--;
				bullet.velocityY += GRAVITY * 0.3;
				bullet.speed = Math.min(bullet.speed + bullet.acceleration, bullet.maxSpeed);
				const currentAngle = Math.atan2(bullet.velocityY, bullet.velocityX);
				bullet.velocityX = Math.cos(currentAngle) * bullet.speed;
				bullet.velocityY = Math.sin(currentAngle) * bullet.speed;
				bullet.angle = currentAngle;
			} else {
				// 追尾フェーズ
				bullet.angle = Math.atan2(bullet.velocityY, bullet.velocityX);
				bullet.speed = Math.min(bullet.speed + bullet.acceleration, bullet.maxSpeed);

				bullet.retargetTimer++;
				if (
					bullet.retargetTimer >= bullet.retargetInterval ||
					!bullet.targetEnemy
				) {
					bullet.retargetTimer = 0;
					let newTarget = null;
					let closestDistance = Number.POSITIVE_INFINITY;

					for (const enemy of enemies) {
						const enemyCenterX = enemy.x + enemy.width / 2;
						const enemyCenterY = enemy.y + enemy.height / 2;
						const dx = enemyCenterX - bullet.x;
						const dy = enemyCenterY - bullet.y;
						const angleToEnemy = Math.atan2(dy, dx);

						let angleDiff = angleToEnemy - bullet.angle;
						while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
						while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

						const viewAngle = (Math.PI * 5) / 6;
						if (Math.abs(angleDiff) > viewAngle / 2) continue;
						if (!hasLineOfSight(bullet.x, bullet.y, enemyCenterX, enemyCenterY)) continue;

						const distance = Math.sqrt(dx * dx + dy * dy);
						if (distance < closestDistance) {
							closestDistance = distance;
							newTarget = enemy;
						}
					}
					bullet.targetEnemy = newTarget;
				}

				if (bullet.targetEnemy) {
					const targetX = bullet.targetEnemy.x + bullet.targetEnemy.width / 2;
					const targetY = bullet.targetEnemy.y + bullet.targetEnemy.height / 2;
					const dx = targetX - bullet.x;
					const dy = targetY - bullet.y;
					const distToTarget = Math.sqrt(dx * dx + dy * dy);
					const targetAngle = Math.atan2(dy, dx);

					let angleDiff = targetAngle - bullet.angle;
					while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
					while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

					let effectiveTurnSpeed = bullet.turnSpeed;
					if (distToTarget < 120) {
						effectiveTurnSpeed *= distToTarget / 120;
					}

					const turnAmount =
						Math.min(Math.abs(angleDiff), effectiveTurnSpeed) *
						Math.sign(angleDiff);
					bullet.angle += turnAmount;
				}

				bullet.velocityX = Math.cos(bullet.angle) * bullet.speed;
				bullet.velocityY = Math.sin(bullet.angle) * bullet.speed;
			}
		} else {
			bullet.velocityY += GRAVITY;
			bullet.color = "#888";
		}

		bullet.x += bullet.velocityX;
		bullet.y += bullet.velocityY;

		// プラットフォームとの衝突判定
		let hitPlatform = false;
		for (const platform of platforms) {
			if (
				Math.abs(platform.x - bullet.x) > canvas.width + 200 &&
				Math.abs(platform.x + platform.width - bullet.x) > canvas.width + 200
			) {
				continue;
			}
			if (
				bullet.x + bullet.width / 2 >= platform.x &&
				bullet.x - bullet.width / 2 <= platform.x + platform.width &&
				bullet.y + bullet.width / 2 >= platform.y &&
				bullet.y - bullet.width / 2 <= platform.y + platform.height
			) {
				hitPlatform = true;
				break;
			}
		}

		if (hitPlatform) {
			bullets.splice(i, 1);
			continue;
		}

		if (
			bullet.y > FALL_DEATH_Y ||
			bullet.x < camera.x - 300 ||
			bullet.x > camera.x + canvas.width + 300
		) {
			bullets.splice(i, 1);
			continue;
		}

		// 弾と敵の衝突判定
		for (let j = enemies.length - 1; j >= 0; j--) {
			const enemy = enemies[j];
			if (
				bullet.x < enemy.x + enemy.width &&
				bullet.x + bullet.width > enemy.x &&
				bullet.y < enemy.y + enemy.height &&
				bullet.y + bullet.height > enemy.y
			) {
				bullets.splice(i, 1);
				enemies.splice(j, 1);
				score += 100;
				if (score > highScore) {
					highScore = score;
					localStorage.setItem("highScore", highScore.toString());
				}
				break;
			}
		}
	}

	// ハイスコアを更新
	if (score > highScore) {
		highScore = score;
		localStorage.setItem("highScore", highScore.toString());
	}
}

// 夕焼け背景を描画
function renderSunsetBackground() {
	// 夕焼けグラデーション
	const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
	gradient.addColorStop(0, "#1a0533"); // 上部：深い紫
	gradient.addColorStop(0.3, "#6B2FA0"); // 紫
	gradient.addColorStop(0.5, "#D4587A"); // ピンク
	gradient.addColorStop(0.7, "#F0934A"); // オレンジ
	gradient.addColorStop(0.85, "#FCCF4D"); // 黄色
	gradient.addColorStop(1.0, "#F0934A"); // 下部：オレンジ
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	// 太陽（画面右下寄り、地平線近く）
	const sunX = canvas.width * 0.75;
	const sunY = canvas.height * 0.65 + camera.y * 0.02;
	const sunGradient = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 80);
	sunGradient.addColorStop(0, "rgba(255, 255, 200, 1)");
	sunGradient.addColorStop(0.3, "rgba(255, 200, 100, 0.8)");
	sunGradient.addColorStop(0.7, "rgba(255, 120, 50, 0.3)");
	sunGradient.addColorStop(1, "rgba(255, 80, 30, 0)");
	ctx.fillStyle = sunGradient;
	ctx.beginPath();
	ctx.arc(sunX, sunY, 80, 0, Math.PI * 2);
	ctx.fill();
}

// 遠景の山を描画（パララックス層1）
function renderDistantMountains() {
	const parallaxX = camera.x * 0.05;
	const baseY = canvas.height * 0.55 + camera.y * 0.03;

	ctx.fillStyle = "rgba(60, 20, 80, 0.6)";
	ctx.beginPath();
	ctx.moveTo(0, canvas.height);
	for (let x = 0; x <= canvas.width; x += 20) {
		const worldX = x + parallaxX;
		const h = Math.sin(worldX * 0.003) * 60 + Math.sin(worldX * 0.007) * 30 + Math.sin(worldX * 0.001) * 40;
		ctx.lineTo(x, baseY - h);
	}
	ctx.lineTo(canvas.width, canvas.height);
	ctx.closePath();
	ctx.fill();
}

// 中景のビルシルエットを描画（パララックス層2）
function renderCityscape() {
	const parallaxX = camera.x * 0.15;
	const baseY = canvas.height * 0.65 + camera.y * 0.05;

	ctx.fillStyle = "rgba(40, 15, 50, 0.7)";
	const rand = seededRandom(42);
	for (let i = 0; i < 30; i++) {
		const bx = (i * 80 - (parallaxX % 80) + 2400) % 2400 - 200;
		const bw = 30 + rand() * 40;
		const bh = 40 + rand() * 100;
		ctx.fillRect(bx, baseY - bh, bw, bh + canvas.height);
	}
}

// 雲を描画（パララックス層3）
function renderClouds() {
	for (const cloud of clouds) {
		const cx = cloud.x - camera.x * cloud.speed;
		// 画面外の雲を反対側に再配置
		const wrappedX = ((cx % (canvas.width + 200)) + canvas.width + 200) % (canvas.width + 200) - 100;
		const cy = cloud.y + camera.y * 0.02;

		ctx.fillStyle = `rgba(255, 180, 120, ${cloud.alpha})`;
		ctx.beginPath();
		ctx.ellipse(wrappedX, cy, cloud.width / 2, cloud.height / 2, 0, 0, Math.PI * 2);
		ctx.fill();
		// 雲の2番目の楕円
		ctx.beginPath();
		ctx.ellipse(wrappedX + cloud.width * 0.3, cy - cloud.height * 0.15, cloud.width * 0.35, cloud.height * 0.4, 0, 0, Math.PI * 2);
		ctx.fill();
	}
}

// 電柱を描画
function renderPole(pole) {
	const x = pole.x;
	const groundY = pole.y;

	// 電柱の支柱
	ctx.fillStyle = "#4A3728";
	ctx.fillRect(x - 4, groundY - 200, 8, 200);

	// 横木（腕金）
	ctx.fillStyle = "#5C4033";
	ctx.fillRect(x - 30, groundY - 180, 60, 4);
	ctx.fillRect(x - 25, groundY - 160, 50, 3);

	// 碍子（がいし）
	ctx.fillStyle = "#AAA";
	ctx.fillRect(x - 28, groundY - 184, 4, 8);
	ctx.fillRect(x + 24, groundY - 184, 4, 8);

	// 電線（左右に伸びる）
	ctx.strokeStyle = "#333";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(x - 100, groundY - 178);
	// たるみを表現
	ctx.quadraticCurveTo(x, groundY - 170, x + 100, groundY - 178);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(x - 80, groundY - 158);
	ctx.quadraticCurveTo(x, groundY - 150, x + 80, groundY - 158);
	ctx.stroke();
}

// 描画関数
function render() {
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	// 背景レイヤー1: 夕焼け空
	renderSunsetBackground();

	// 背景レイヤー2: 遠景の山
	renderDistantMountains();

	// 背景レイヤー3: 中景のビルシルエット
	renderCityscape();

	// 背景レイヤー4: 雲
	renderClouds();

	// カメラオフセットを適用
	ctx.save();
	ctx.translate(-camera.x, -camera.y);

	// プラットフォームを描画
	for (const platform of platforms) {
		if (
			platform.x + platform.width < camera.x - 50 ||
			platform.x > camera.x + canvas.width + 50
		) {
			continue;
		}

		if (platform.isGround) {
			// 地面：アスファルト風
			ctx.fillStyle = "#555";
			ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
			// 白線（道路中央線）
			ctx.fillStyle = "#DDD";
			for (let lx = platform.x; lx < platform.x + platform.width; lx += 40) {
				ctx.fillRect(lx, platform.y + 5, 20, 3);
			}
			// 縁石
			ctx.fillStyle = "#888";
			ctx.fillRect(platform.x, platform.y, platform.width, 4);
		} else {
			// 浮遊プラットフォーム：ブロック塀風
			ctx.fillStyle = "#B8A090";
			ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
			ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
			ctx.fillRect(platform.x, platform.y + platform.height - 4, platform.width, 4);
			// ブロック模様
			ctx.strokeStyle = "rgba(0,0,0,0.1)";
			ctx.lineWidth = 1;
			for (let bx = platform.x + 15; bx < platform.x + platform.width; bx += 15) {
				ctx.beginPath();
				ctx.moveTo(bx, platform.y);
				ctx.lineTo(bx, platform.y + platform.height);
				ctx.stroke();
			}
		}
	}

	// 装飾（電柱）を描画
	for (const deco of decorations) {
		if (deco.x < camera.x - 150 || deco.x > camera.x + canvas.width + 150) continue;
		if (deco.type === "pole") {
			renderPole(deco);
		}
	}

	// 無敵アイテムを描画
	for (const pu of powerups) {
		if (pu.collected) continue;
		if (pu.x + pu.width < camera.x || pu.x > camera.x + canvas.width) continue;

		// 星型の無敵アイテム（キラキラ点滅）
		const pulse = Math.sin(Date.now() * 0.005) * 0.3 + 0.7;
		ctx.save();
		ctx.translate(pu.x + pu.width / 2, pu.y + pu.height / 2);
		ctx.rotate(Date.now() * 0.002);

		// 光彩
		ctx.fillStyle = `rgba(255, 255, 100, ${0.3 * pulse})`;
		ctx.beginPath();
		ctx.arc(0, 0, 18, 0, Math.PI * 2);
		ctx.fill();

		// 星形
		ctx.fillStyle = `rgba(255, 215, 0, ${pulse})`;
		ctx.beginPath();
		for (let s = 0; s < 5; s++) {
			const angle = (s * Math.PI * 2) / 5 - Math.PI / 2;
			const innerAngle = angle + Math.PI / 5;
			if (s === 0) {
				ctx.moveTo(Math.cos(angle) * 12, Math.sin(angle) * 12);
			} else {
				ctx.lineTo(Math.cos(angle) * 12, Math.sin(angle) * 12);
			}
			ctx.lineTo(Math.cos(innerAngle) * 5, Math.sin(innerAngle) * 5);
		}
		ctx.closePath();
		ctx.fill();
		ctx.restore();
	}

	// プレイヤーを描画
	const isPowerInvincible = player.powerInvincibleTimer > 0;
	if (
		player.invincibleTimer === 0 ||
		isPowerInvincible ||
		Math.floor(player.invincibleTimer / 10) % 2 === 0
	) {
		// パワーアップ無敵中は虹色に光る
		if (isPowerInvincible) {
			const hue = (Date.now() * 0.5) % 360;
			ctx.fillStyle = `hsl(${hue}, 100%, 60%)`;
			// 光彩エフェクト
			ctx.save();
			ctx.shadowColor = `hsl(${hue}, 100%, 70%)`;
			ctx.shadowBlur = 15;
		} else {
			ctx.fillStyle = player.color;
		}
		ctx.fillRect(player.x, player.y, player.width, player.height);
		if (isPowerInvincible) ctx.restore();

		// プレイヤーの顔を描画
		ctx.fillStyle = "#000";
		ctx.fillRect(player.x + 10, player.y + 12, 6, 6);
		ctx.fillRect(player.x + 24, player.y + 12, 6, 6);
		ctx.fillRect(player.x + 12, player.y + 26, 16, 4);

		ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
		ctx.fillRect(player.x + 5, player.y + player.height, player.width - 10, 3);
	}

	// 敵を描画
	for (const enemy of enemies) {
		if (enemy.x + enemy.width < camera.x - 50 || enemy.x > camera.x + canvas.width + 50) {
			continue;
		}

		// ダッシュ型がダッシュ中は残像表示
		if (enemy.type === "dasher" && enemy.isDashing) {
			ctx.fillStyle = `rgba(230, 126, 34, 0.3)`;
			ctx.fillRect(enemy.x + 10, enemy.y + 2, enemy.width - 4, enemy.height - 4);
		}

		ctx.fillStyle = enemy.color;
		ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);

		// 敵の目
		ctx.fillStyle = "#FFF";
		const eyeW = Math.min(8, enemy.width * 0.22);
		const eyeH = eyeW;
		ctx.fillRect(enemy.x + enemy.width * 0.17, enemy.y + 8, eyeW, eyeH);
		ctx.fillRect(enemy.x + enemy.width * 0.6, enemy.y + 8, eyeW, eyeH);

		ctx.fillStyle = "#000";
		const eyeOffsetX = enemy.direction > 0 ? eyeW * 0.5 : eyeW * 0.1;
		ctx.fillRect(enemy.x + enemy.width * 0.17 + eyeOffsetX, enemy.y + 10, eyeW * 0.5, eyeH * 0.5);
		ctx.fillRect(enemy.x + enemy.width * 0.6 + eyeOffsetX, enemy.y + 10, eyeW * 0.5, eyeH * 0.5);

		// 射撃型の敵にはマーク表示
		if (enemy.type === "shooter") {
			ctx.fillStyle = "#FFF";
			ctx.font = "bold 10px Arial";
			ctx.textAlign = "center";
			ctx.fillText("!", enemy.x + enemy.width / 2, enemy.y - 5);
		}

		ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
		ctx.fillRect(enemy.x + 5, enemy.y + enemy.height, enemy.width - 10, 3);
	}

	// 敵の弾を描画
	for (const eb of enemyBullets) {
		if (eb.x < camera.x - 50 || eb.x > camera.x + canvas.width + 50) continue;
		ctx.fillStyle = "#FF4444";
		ctx.beginPath();
		ctx.arc(eb.x + eb.width / 2, eb.y + eb.height / 2, eb.width / 2, 0, Math.PI * 2);
		ctx.fill();
		// 光彩
		ctx.fillStyle = "rgba(255, 100, 100, 0.4)";
		ctx.beginPath();
		ctx.arc(eb.x + eb.width / 2, eb.y + eb.height / 2, eb.width, 0, Math.PI * 2);
		ctx.fill();
	}

	// 通常弾を描画
	for (const nb of normalBullets) {
		if (nb.x + nb.width < camera.x || nb.x > camera.x + canvas.width) continue;

		ctx.save();
		ctx.translate(nb.x + nb.width / 2, nb.y + nb.height / 2);

		// 弾本体（オレンジの砲弾型）
		ctx.fillStyle = "#FF8C00";
		ctx.beginPath();
		ctx.ellipse(0, 0, nb.width / 2, nb.height / 2, 0, 0, Math.PI * 2);
		ctx.fill();

		// ハイライト
		ctx.fillStyle = "rgba(255, 255, 200, 0.6)";
		ctx.beginPath();
		ctx.ellipse(2, -1, nb.width / 4, nb.height / 4, 0, 0, Math.PI * 2);
		ctx.fill();

		ctx.restore();
	}

	// 爆発エフェクトを描画
	for (const ex of explosions) {
		if (ex.x < camera.x - 50 || ex.x > camera.x + canvas.width + 50) continue;

		// 外側の爆風（オレンジ）
		ctx.fillStyle = `rgba(255, 120, 0, ${ex.alpha * 0.5})`;
		ctx.beginPath();
		ctx.arc(ex.x, ex.y, ex.radius, 0, Math.PI * 2);
		ctx.fill();

		// 内側の炎（黄色）
		ctx.fillStyle = `rgba(255, 255, 50, ${ex.alpha * 0.7})`;
		ctx.beginPath();
		ctx.arc(ex.x, ex.y, ex.radius * 0.6, 0, Math.PI * 2);
		ctx.fill();

		// 中心の白い閃光
		ctx.fillStyle = `rgba(255, 255, 255, ${ex.alpha * 0.8})`;
		ctx.beginPath();
		ctx.arc(ex.x, ex.y, ex.radius * 0.25, 0, Math.PI * 2);
		ctx.fill();
	}

	// ミサイルを描画
	for (const bullet of bullets) {
		if (
			bullet.x + 20 < camera.x ||
			bullet.x - 20 > camera.x + canvas.width
		) {
			continue;
		}

		ctx.save();
		ctx.translate(bullet.x, bullet.y);
		ctx.rotate(bullet.angle);

		const missileLength = 14;
		const missileWidth = 4;

		if (bullet.fuel > 0) {
			const flameLength = 8 + Math.random() * 6;
			ctx.fillStyle = "rgba(255, 100, 0, 0.7)";
			ctx.beginPath();
			ctx.moveTo(-missileLength / 2, -missileWidth / 2);
			ctx.lineTo(-missileLength / 2 - flameLength, 0);
			ctx.lineTo(-missileLength / 2, missileWidth / 2);
			ctx.closePath();
			ctx.fill();

			ctx.fillStyle = "rgba(255, 255, 100, 0.9)";
			ctx.beginPath();
			ctx.moveTo(-missileLength / 2, -missileWidth / 4);
			ctx.lineTo(-missileLength / 2 - flameLength * 0.6, 0);
			ctx.lineTo(-missileLength / 2, missileWidth / 4);
			ctx.closePath();
			ctx.fill();

			ctx.rotate(-bullet.angle);
			ctx.translate(-bullet.x, -bullet.y);
			for (let t = 1; t <= 5; t++) {
				const alpha = (1 - t / 5) * 0.15;
				const smokeSize = 2 + t * 0.8;
				ctx.fillStyle = `rgba(200, 200, 200, ${alpha})`;
				ctx.beginPath();
				const smokeX = bullet.x - Math.cos(bullet.angle) * t * 5;
				const smokeY = bullet.y - Math.sin(bullet.angle) * t * 5;
				ctx.arc(smokeX, smokeY, smokeSize, 0, Math.PI * 2);
				ctx.fill();
			}
			ctx.translate(bullet.x, bullet.y);
			ctx.rotate(bullet.angle);

			ctx.fillStyle = "#555";
			ctx.fillRect(-missileLength / 2, -missileWidth / 2, missileLength, missileWidth);

			ctx.fillStyle = "#DDD";
			ctx.beginPath();
			ctx.moveTo(missileLength / 2, -missileWidth / 2);
			ctx.lineTo(missileLength / 2 + 5, 0);
			ctx.lineTo(missileLength / 2, missileWidth / 2);
			ctx.closePath();
			ctx.fill();

			ctx.fillStyle = "#888";
			ctx.beginPath();
			ctx.moveTo(-missileLength / 2, -missileWidth / 2);
			ctx.lineTo(-missileLength / 2 - 3, -missileWidth);
			ctx.lineTo(-missileLength / 2 + 3, -missileWidth / 2);
			ctx.closePath();
			ctx.fill();
			ctx.beginPath();
			ctx.moveTo(-missileLength / 2, missileWidth / 2);
			ctx.lineTo(-missileLength / 2 - 3, missileWidth);
			ctx.lineTo(-missileLength / 2 + 3, missileWidth / 2);
			ctx.closePath();
			ctx.fill();

			ctx.fillStyle = "#E74C3C";
			ctx.fillRect(missileLength / 2 - 3, -missileWidth / 2, 3, missileWidth);
		} else {
			ctx.fillStyle = "#444";
			ctx.fillRect(-missileLength / 2, -missileWidth / 2, missileLength, missileWidth);
			ctx.fillStyle = "#777";
			ctx.beginPath();
			ctx.moveTo(missileLength / 2, -missileWidth / 2);
			ctx.lineTo(missileLength / 2 + 5, 0);
			ctx.lineTo(missileLength / 2, missileWidth / 2);
			ctx.closePath();
			ctx.fill();
		}

		ctx.restore();
	}

	// カメラオフセットを復元
	ctx.restore();

	// HUD
	ctx.fillStyle = "#FFF";
	ctx.strokeStyle = "#000";
	ctx.lineWidth = 3;
	ctx.font = "bold 24px Arial";
	ctx.textAlign = "left";

	// ライフ表示
	const lifeText = `ライフ: ${"❤️".repeat(player.life)}${"🖤".repeat(player.maxLife - player.life)}`;
	ctx.strokeText(lifeText, 10, 30);
	ctx.fillText(lifeText, 10, 30);

	// スコア表示
	const scoreText = `スコア: ${score}`;
	ctx.strokeText(scoreText, 10, 60);
	ctx.fillText(scoreText, 10, 60);

	// ハイスコア表示
	const highScoreText = `ハイスコア: ${highScore}`;
	ctx.strokeText(highScoreText, 10, 90);
	ctx.fillText(highScoreText, 10, 90);

	// パワーアップ無敵表示
	if (player.powerInvincibleTimer > 0) {
		const remainSec = (player.powerInvincibleTimer / 60).toFixed(1);
		ctx.fillStyle = "#FFD700";
		ctx.strokeStyle = "#000";
		ctx.font = "bold 20px Arial";
		ctx.textAlign = "center";
		const invText = `★ 無敵 ${remainSec}s ★`;
		ctx.strokeText(invText, canvas.width / 2, 30);
		ctx.fillText(invText, canvas.width / 2, 30);
	}

	// ゲームオーバー表示
	if (gameOver) {
		ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		ctx.fillStyle = "#FFF";
		ctx.strokeStyle = "#000";
		ctx.lineWidth = 2;
		ctx.font = "bold 48px Arial";
		ctx.textAlign = "center";

		ctx.strokeText("ゲームオーバー", canvas.width / 2, canvas.height / 2 - 60);
		ctx.fillText("ゲームオーバー", canvas.width / 2, canvas.height / 2 - 60);

		ctx.font = "32px Arial";
		const finalScoreText = `スコア: ${score}`;
		ctx.strokeText(finalScoreText, canvas.width / 2, canvas.height / 2 - 10);
		ctx.fillText(finalScoreText, canvas.width / 2, canvas.height / 2 - 10);

		const bestScoreText = `ハイスコア: ${highScore}`;
		ctx.strokeText(bestScoreText, canvas.width / 2, canvas.height / 2 + 30);
		ctx.fillText(bestScoreText, canvas.width / 2, canvas.height / 2 + 30);

		ctx.font = "24px Arial";
		ctx.strokeText("Rキーでリスタート", canvas.width / 2, canvas.height / 2 + 70);
		ctx.fillText("Rキーでリスタート", canvas.width / 2, canvas.height / 2 + 70);
	}
}

// ゲームループ
function gameLoop() {
	update();
	render();
	requestAnimationFrame(gameLoop);
}

// 初期化して開始
initClouds();
initWorld();
gameLoop();
