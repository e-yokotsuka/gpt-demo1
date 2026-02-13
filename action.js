// PixiJSを使用した横スクロールアクションゲーム
document.addEventListener("DOMContentLoaded", function() {
    // PixiJSアプリケーションの初期化
    const app = new PIXI.Application({
      width: 800,
      height: 450,
      backgroundColor: 0x87CEEB, // 空色の背景
      resolution: window.devicePixelRatio || 1
    });
    document.body.appendChild(app.view);
  
    // ゲーム変数
    const gameState = {
      playerSpeed: 5,
      gravity: 0.5,
      jumpForce: -12,
      enemySpeed: 2,
      score: 0,
      gameOver: false
    };
  
    // プレイヤーの作成
    const player = new PIXI.Graphics();
    player.beginFill(0xFF0000);
    player.drawRect(0, 0, 40, 60);
    player.endFill();
    player.x = 100;
    player.y = app.renderer.height - 100;
    player.vx = 0;
    player.vy = 0;
    player.isJumping = false;
    app.stage.addChild(player);
  
    // 地面の作成
    const ground = new PIXI.Graphics();
    ground.beginFill(0x00AA00);
    ground.drawRect(0, 0, app.renderer.width * 3, 40);
    ground.endFill();
    ground.x = 0;
    ground.y = app.renderer.height - 40;
    app.stage.addChild(ground);
  
    // 背景の作成
    const background = new PIXI.Container();
    app.stage.addChildAt(background, 0);
  
    // 山の描画
    function createMountain(x, height, color) {
      const mountain = new PIXI.Graphics();
      mountain.beginFill(color);
      mountain.moveTo(0, 0);
      mountain.lineTo(120, -height);
      mountain.lineTo(240, 0);
      mountain.endFill();
      mountain.x = x;
      mountain.y = ground.y;
      return mountain;
    }
  
    // 複数の山を追加
    for (let i = 0; i < 10; i++) {
      const height = 100 + Math.random() * 150;
      const color = 0x996633 + i * 0x001100;
      const mountain = createMountain(i * 200, height, color);
      background.addChild(mountain);
    }
  
    // 雲の追加
    for (let i = 0; i < 15; i++) {
      const cloud = new PIXI.Graphics();
      cloud.beginFill(0xFFFFFF);
      cloud.drawEllipse(0, 0, 30 + Math.random() * 40, 20);
      cloud.endFill();
      cloud.x = Math.random() * app.renderer.width * 3;
      cloud.y = 50 + Math.random() * 100;
      background.addChild(cloud);
    }
  
    // 敵の配列
    const enemies = [];
  
    // 敵を生成する関数
    function spawnEnemy() {
      if (gameState.gameOver) return;
  
      const enemy = new PIXI.Graphics();
      enemy.beginFill(0x0000FF);
      enemy.drawRect(0, 0, 30, 30);
      enemy.endFill();
      enemy.x = app.renderer.width + Math.random() * 200;
      enemy.y = ground.y - 30;
      app.stage.addChild(enemy);
      enemies.push(enemy);
  
      // ランダムな間隔で敵を生成
      setTimeout(spawnEnemy, 1000 + Math.random() * 2000);
    }
  
    // 最初の敵を生成
    spawnEnemy();
  
    // スコア表示
    const scoreText = new PIXI.Text('スコア: 0', {
      fontFamily: 'Arial',
      fontSize: 24,
      fill: 0xFFFFFF,
      stroke: 0x000000,
      strokeThickness: 4
    });
    scoreText.x = 20;
    scoreText.y = 20;
    app.stage.addChild(scoreText);
  
    // ゲームオーバーテキスト
    const gameOverText = new PIXI.Text('ゲームオーバー\nスペースキーでリスタート', {
      fontFamily: 'Arial',
      fontSize: 36,
      fill: 0xFFFFFF,
      stroke: 0x000000,
      strokeThickness: 6,
      align: 'center'
    });
    gameOverText.anchor.set(0.5);
    gameOverText.x = app.renderer.width / 2;
    gameOverText.y = app.renderer.height / 2;
    gameOverText.visible = false;
    app.stage.addChild(gameOverText);
  
    // キー入力の処理
    const keys = {};
    
    window.addEventListener('keydown', e => {
      keys[e.key] = true;
      
      // スペースキーでゲームリスタート
      if (e.key === ' ' && gameState.gameOver) {
        restartGame();
      }
    });
    
    window.addEventListener('keyup', e => {
      keys[e.key] = false;
    });
  
    // ゲームをリスタートする関数
    function restartGame() {
      // 敵をクリア
      for (let enemy of enemies) {
        app.stage.removeChild(enemy);
      }
      enemies.length = 0;
  
      // ゲーム状態のリセット
      gameState.gameOver = false;
      gameState.score = 0;
      scoreText.text = 'スコア: 0';
      gameOverText.visible = false;
  
      // プレイヤーの位置リセット
      player.x = 100;
      player.y = app.renderer.height - 100;
      player.vy = 0;
  
      // カメラのリセット
      app.stage.x = 0;
      
      // 敵の生成を再開
      spawnEnemy();
    }
  
    // メインゲームループ
    app.ticker.add(() => {
      if (gameState.gameOver) return;
  
      // プレイヤーの移動処理
      if (keys['ArrowRight']) {
        player.x += gameState.playerSpeed;
        app.stage.x -= gameState.playerSpeed;
      }
      
      if (keys['ArrowLeft'] && player.x > 50) {
        player.x -= gameState.playerSpeed;
        if (app.stage.x < 0) {
          app.stage.x += gameState.playerSpeed;
        }
      }
      
      // ジャンプ処理
      if (keys['ArrowUp'] && !player.isJumping) {
        player.vy = gameState.jumpForce;
        player.isJumping = true;
      }
      
      // 重力の適用
      player.vy += gameState.gravity;
      player.y += player.vy;
      
      // 地面との衝突判定
      if (player.y + player.height > ground.y) {
        player.y = ground.y - player.height;
        player.vy = 0;
        player.isJumping = false;
      }
      
      // 敵の更新
      for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        enemy.x -= gameState.enemySpeed;
        
        // 画面外の敵を削除
        if (enemy.x < -50) {
          app.stage.removeChild(enemy);
          enemies.splice(i, 1);
          i--;
          
          // スコア加算
          gameState.score++;
          scoreText.text = `スコア: ${gameState.score}`;
        }
        
        // プレイヤーとの衝突判定
        if (collision(player, enemy)) {
          gameState.gameOver = true;
          gameOverText.visible = true;
        }
      }
    });
  
    // 衝突判定関数
    function collision(a, b) {
      const aBox = a.getBounds();
      const bBox = b.getBounds();
      
      return aBox.x < bBox.x + bBox.width &&
             aBox.x + aBox.width > bBox.x &&
             aBox.y < bBox.y + bBox.height &&
             aBox.y + aBox.height > bBox.y;
    }
  });