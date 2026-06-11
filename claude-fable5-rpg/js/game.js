// ゲームエンジン本体
const VIEW_W = 960, VIEW_H = 576, HUD_H = 96; // canvas は 960x672
const PSIZE = 12; // 当たり判定サイズ(ソースpx単位)

const Game = {
  canvas: null, ctx: null,
  state: "title", // title / play / dialog / menu / shop / ending / gameover
  mapId: "town",
  map: null,
  player: null,
  enemies: [],
  chests: [],
  npcs: [],
  floaties: [],
  camera: { x: 0, y: 0 },
  keys: {},
  lastTime: 0,
  playTime: 0,
  flags: {},
  stillTime: 0,
  regenTimer: 0,
  curseTimer: 0,
  cursedFloorTimer: 0,
  freezeUntil: 0,
  lastEnemy: null,
  lastEnemyTime: 0,
  dialogQueue: [],
  dialogCb: null,
  npcCooldown: 0,
  menuSel: 0,
  menuList: [],
  toastTimer: null,

  // ===== 初期化 =====
  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
    window.addEventListener("keydown", (e) => this.onKeyDown(e));
    window.addEventListener("keyup", (e) => { this.keys[e.key.toLowerCase()] = false; });
    requestAnimationFrame((t) => this.loop(t));
  },

  newGame() {
    this.player = {
      x: 10 * TILE, y: 8 * TILE, facing: "down", moving: false,
      lv: 1, maxhp: 30, hp: 30, str: 5, def: 2, exp: 0, gold: 60,
      equip: { weapon: "sword1", shield: null, armor: null, tool: null, accessory: null },
      inv: { sword1: 1, potion: 1 },
      docs: [], docsRead: [],
      invulnUntil: 0,
    };
    this.flags = { openedChests: {}, brokenWalls: {}, dungeonUnlocked: false, elderQuestDone: false, bossDefeated: false };
    this.playTime = 0;
    this.loadMap("town", 10, 8);
    this.state = "play";
  },

  // ===== マップ =====
  loadMap(id, tx, ty) {
    this.mapId = id;
    this.map = MAPS[id];
    this.player.x = tx * TILE;
    this.player.y = ty * TILE;
    this.enemies = [];
    for (const e of this.map.enemies) {
      const def = ENEMIES[e.type];
      if (def.boss && this.flags.bossDefeated) continue;
      this.enemies.push({
        type: e.type, def, x: e.x * TILE, y: e.y * TILE,
        hp: def.hp, dir: { x: 0, y: 1 }, facing: "down",
        moveTimer: 0, hitTimer: 0, alive: true, size: def.size || 12,
      });
    }
    this.chestFx = [];
    this.chests = this.map.chests.filter((c) => !this.flags.openedChests[c.id]);
    this.npcs = this.map.npcs.map((n) => ({ ...n, px: n.x * TILE, py: n.y * TILE }));
    this.lastEnemy = null;
    if (this.map.bossRoom && !this.flags.bossDefeated) {
      this.toast("魔王の間 ― セーブ・回復薬は使用できない!");
    }
  },

  tileAt(tx, ty) {
    const g = this.map.grid;
    if (ty < 0 || ty >= g.length || tx < 0 || tx >= g[0].length) return "#";
    let ch = g[ty][tx];
    if (ch === "L" && this.flags.dungeonUnlocked) return "D";
    if (ch === "B" && this.flags.brokenWalls[`${this.mapId}:${tx},${ty}`]) return ".";
    return ch;
  },

  isWalkable(tx, ty) {
    const ch = this.tileAt(tx, ty);
    return ".,~XDH".includes(ch);
  },

  // 矩形(ソースpx)がマップと衝突するか
  collides(x, y, w, h) {
    const x0 = Math.floor(x / TILE), y0 = Math.floor(y / TILE);
    const x1 = Math.floor((x + w - 1) / TILE), y1 = Math.floor((y + h - 1) / TILE);
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++)
        if (!this.isWalkable(tx, ty)) return true;
    return false;
  },

  // ===== メインループ =====
  loop(t) {
    const dt = Math.min(0.05, (t - this.lastTime) / 1000 || 0);
    this.lastTime = t;
    if (this.state === "play") {
      this.playTime += dt;
      this.update(dt, t);
    }
    this.render(t);
    requestAnimationFrame((tt) => this.loop(tt));
  },

  // ===== 更新 =====
  update(dt, t) {
    const p = this.player;
    // --- プレイヤー移動 ---
    let dx = 0, dy = 0;
    if (this.keys["arrowup"] || this.keys["w"]) dy = -1;
    else if (this.keys["arrowdown"] || this.keys["s"]) dy = 1;
    else if (this.keys["arrowleft"] || this.keys["a"]) dx = -1;
    else if (this.keys["arrowright"] || this.keys["d"]) dx = 1;

    p.moving = dx !== 0 || dy !== 0;
    if (p.moving) {
      p.dirX = dx; p.dirY = dy;
      p.facing = dy < 0 ? "up" : dy > 0 ? "down" : dx < 0 ? "left" : "right";
      const speed = 70;
      const nx = p.x + dx * speed * dt;
      const ny = p.y + dy * speed * dt;
      if (!this.collides(nx, p.y, PSIZE, PSIZE)) p.x = nx;
      else this.onWallContact(nx, p.y, dx, dy);
      if (!this.collides(p.x, ny, PSIZE, PSIZE)) p.y = ny;
      else this.onWallContact(p.x, ny, dx, dy);
      this.stillTime = 0;
    } else {
      this.stillTime += dt;
    }
    if (this.npcCooldown > 0) this.npcCooldown -= dt;

    // --- 自然回復 ---
    const acc = p.equip.accessory;
    const cursed = acc === "ringCurse";
    const tileUnder = this.tileAt(Math.floor((p.x + PSIZE / 2) / TILE), Math.floor((p.y + PSIZE / 2) / TILE));
    const onSpring = tileUnder === "~";
    const canRegen = !cursed && (acc === "ringHeal" || (!this.map.dungeon && (this.map.regenAll || onSpring)));
    if (canRegen && this.stillTime > 0.8 && p.hp < p.maxhp) {
      this.regenTimer += dt;
      if (this.regenTimer >= 0.5) { this.regenTimer = 0; p.hp = Math.min(p.maxhp, p.hp + 1); }
    } else this.regenTimer = 0;

    // --- 呪い指輪のペナルティ ---
    if (cursed) {
      this.curseTimer += dt;
      if (this.curseTimer >= 1.2) {
        this.curseTimer = 0;
        if (p.hp > 1) { p.hp -= 1; this.addFloaty(p.x, p.y, "-1", "#c060ff"); }
      }
    }

    // --- 呪いの床 ---
    if (tileUnder === "X" && p.equip.tool !== "amulet") {
      this.cursedFloorTimer += dt;
      if (this.cursedFloorTimer >= 0.5) {
        this.cursedFloorTimer = 0;
        this.hurtPlayer(3, null);
        this.addFloaty(p.x, p.y, "呪い!", "#c060ff");
      }
    } else this.cursedFloorTimer = 0;

    // --- 敵更新 ---
    const frozen = t < this.freezeUntil;
    const slowMult = acc === "ringTime" ? 0.6 : 1;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (!frozen) this.updateEnemy(e, dt, slowMult);
      this.checkCombat(e, t);
    }

    // --- 宝箱 ---
    for (const c of this.chests) {
      if (this.overlap(p.x, p.y, PSIZE, PSIZE, c.x * TILE + 2, c.y * TILE + 2, 12, 12)) this.openChest(c);
    }

    // --- NPC ---
    if (this.npcCooldown <= 0) {
      for (const n of this.npcs) {
        if (this.overlap(p.x - 1, p.y - 1, PSIZE + 2, PSIZE + 2, n.px + 2, n.py + 2, 12, 12)) {
          this.pushBack(p, n.px, n.py, 6);
          this.talkTo(n);
          break;
        }
      }
    }

    // --- マップ遷移 ---
    const ptx = (p.x + PSIZE / 2) / TILE, pty = (p.y + PSIZE / 2) / TILE;
    for (const tr of this.map.transitions) {
      if (ptx >= tr.x && ptx < tr.x + tr.w && pty >= tr.y && pty < tr.y + tr.h) {
        this.loadMap(tr.to, tr.tx, tr.ty);
        this.toast(MAPS[tr.to].name);
        return;
      }
    }

    // --- フローティングテキスト ---
    this.floaties = this.floaties.filter((f) => (f.t -= dt) > 0);
    for (const f of this.floaties) f.y -= 20 * dt;
    // --- 宝箱開封アニメ ---
    this.chestFx = (this.chestFx || []).filter((fx) => (fx.t += dt) < 0.8);

    // --- ゲームオーバー ---
    if (p.hp <= 0) { this.state = "gameover"; Sound.play("gameover"); }
  },

  // 壁接触時のギミック(施錠扉・ひび割れ壁)
  onWallContact(x, y, dx, dy) {
    const cx = Math.floor((x + PSIZE / 2 + dx * 7) / TILE);
    const cy = Math.floor((y + PSIZE / 2 + dy * 7) / TILE);
    const ch = this.tileAt(cx, cy);
    if (ch === "L") {
      if (this.player.inv.templeKey) {
        this.flags.dungeonUnlocked = true;
        this.toast("神殿鍵で扉を開けた!");
        Sound.play("unlock");
      } else if (!this._lockedMsg || this.lastTime - this._lockedMsg > 2000) {
        this._lockedMsg = this.lastTime;
        this.toast("固く施錠されている。神殿鍵が必要だ");
      }
    } else if (ch === "B") {
      if (this.player.equip.tool === "crusher") {
        this.flags.brokenWalls[`${this.mapId}:${cx},${cy}`] = true;
        this.toast("破砕槌で壁を打ち砕いた!");
        Sound.play("break");
      } else if (!this._crackMsg || this.lastTime - this._crackMsg > 2000) {
        this._crackMsg = this.lastTime;
        this.toast("壁にひびが入っている…");
      }
    }
  },

  updateEnemy(e, dt, slowMult) {
    const p = this.player;
    const dist = Math.hypot(p.x - e.x, p.y - e.y);
    e.moveTimer -= dt;
    const chaseRange = e.def.boss ? 999 : 6 * TILE;
    if (dist < chaseRange) {
      const mx = p.x - e.x, my = p.y - e.y;
      if (Math.abs(mx) > Math.abs(my)) e.dir = { x: Math.sign(mx), y: 0 };
      else e.dir = { x: 0, y: Math.sign(my) };
    } else if (e.moveTimer <= 0) {
      e.moveTimer = 0.8 + Math.random() * 1.2;
      const dirs = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }];
      e.dir = dirs[Math.floor(Math.random() * dirs.length)];
    }
    e.facing = e.dir.y < 0 ? "up" : e.dir.y > 0 ? "down" : e.dir.x < 0 ? "left" : e.dir.x > 0 ? "right" : e.facing;
    let spd = e.def.speed * slowMult;
    if (e.def.boss && e.hp < e.def.hp * 0.5) spd *= 1.5; // ボス第二形態
    const nx = e.x + e.dir.x * spd * dt;
    const ny = e.y + e.dir.y * spd * dt;
    if (!this.collides(nx, e.y, e.size, e.size)) e.x = nx; else e.moveTimer = 0;
    if (!this.collides(e.x, ny, e.size, e.size)) e.y = ny; else e.moveTimer = 0;
  },

  // ===== 戦闘(接触判定) =====
  checkCombat(e, t) {
    const p = this.player;
    if (!this.overlap(p.x, p.y, PSIZE, PSIZE, e.x, e.y, e.size, e.size)) return;
    if (t < e.hitTimer && t < p.invulnUntil) return;

    this.lastEnemy = e;
    this.lastEnemyTime = t;

    const playerAttacks = p.moving && this.movingToward(p, e);
    const enemyAttacks = this.movingToward2(e, p);

    if (playerAttacks && t >= e.hitTimer) {
      // 接触方向の判定
      const atkDir = { x: p.dirX || 0, y: p.dirY || 0 };
      const eDir = this.facingVec(e.facing);
      // オフセット接触: 攻撃軸と垂直方向のずれ
      const perpOff = atkDir.x !== 0 ? Math.abs((p.y + PSIZE / 2) - (e.y + e.size / 2)) : Math.abs((p.x + PSIZE / 2) - (e.x + e.size / 2));
      let contact, mult, counterChance;
      if (perpOff > (PSIZE + e.size) / 2 * 0.58) { contact = "offset"; mult = 1.1; counterChance = 0; }
      else {
        const dot = atkDir.x * eDir.x + atkDir.y * eDir.y;
        if (dot < -0.5) { contact = "front"; mult = 1.0; counterChance = 0.6; }
        else if (dot > 0.5) { contact = "back"; mult = 1.5; counterChance = 0; }
        else { contact = "side"; mult = 1.2; counterChance = 0.3; }
      }
      // プレイヤーの攻撃
      let dmg = this.calcDamage(this.effSTR(), e.def.def, p.lv, e.def.lv, mult);
      if (p.equip.weapon === "sword5" && e.def.undead) dmg = Math.round(dmg * 1.6); // 炎剣特効
      e.hp -= dmg;
      e.hitTimer = t + 350;
      this.addFloaty(e.x, e.y, `${dmg}`, contact === "back" ? "#ffd040" : "#fff");
      Sound.play("hit");
      this.pushBack(e, p.x, p.y, 14);
      if (e.hp <= 0) { this.killEnemy(e); return; }
      // 反撃
      if (counterChance > 0 && Math.random() < counterChance && t >= p.invulnUntil) {
        this.enemyHitPlayer(e, t);
      }
    } else if (enemyAttacks && t >= p.invulnUntil) {
      this.enemyHitPlayer(e, t);
      this.pushBack(e, p.x, p.y, 6);
    }
  },

  enemyHitPlayer(e, t) {
    const p = this.player;
    const dmg = this.calcDamage(e.def.str, this.effDEF(), e.def.lv, p.lv, 1);
    this.hurtPlayer(dmg, e);
    p.invulnUntil = t + 600;
    this.pushBack(p, e.x, e.y, 12);
    // 反射鎧
    if (p.equip.armor === "armor3") {
      const ref = Math.max(1, Math.round(dmg * 0.25));
      e.hp -= ref;
      this.addFloaty(e.x, e.y, `反${ref}`, "#80d0ff");
      if (e.hp <= 0) this.killEnemy(e);
    }
  },

  hurtPlayer(dmg, e) {
    this.player.hp -= dmg;
    this.addFloaty(this.player.x, this.player.y, `-${dmg}`, "#ff6060");
    Sound.play("hurt");
  },

  calcDamage(atk, def, lvA, lvD, mult) {
    let base = atk * mult - def * 0.8;
    base += Math.max(-3, Math.min(3, lvA - lvD)) * 1.5;
    base *= 0.85 + Math.random() * 0.3;
    return Math.max(1, Math.round(base));
  },

  killEnemy(e) {
    e.alive = false;
    Sound.play("kill");
    this.addFloaty(e.x, e.y, `EXP+${e.def.exp}`, "#80ff80");
    this.gainExp(e.def.exp);
    this.player.gold += e.def.gold;
    if (e.def.boss) {
      this.flags.bossDefeated = true;
      setTimeout(() => UI.showEnding(), 1200);
    }
  },

  gainExp(exp) {
    const p = this.player;
    if (p.lv >= LEVEL_CAP) return;
    p.exp += exp;
    while (p.lv < LEVEL_CAP && p.exp >= expForLevel(p.lv)) {
      p.exp -= expForLevel(p.lv);
      p.lv++;
      p.maxhp += LEVEL_GAIN.hp;
      p.str += LEVEL_GAIN.str;
      p.def += LEVEL_GAIN.def;
      p.hp = p.maxhp;
      this.toast(`レベルアップ! Lv${p.lv}`);
      Sound.play("levelup");
      if (p.lv >= LEVEL_CAP) { p.exp = 0; this.toast(`レベル上限に達した。ここからは腕で勝負だ!`); }
    }
  },

  // ===== 実効ステータス =====
  effSTR() {
    const p = this.player;
    let s = p.str + (p.equip.weapon ? ITEMS[p.equip.weapon].str : 0);
    if (p.equip.accessory === "ringAtk") s *= 1.25;
    if (p.equip.accessory === "ringCurse") s *= 2;
    return Math.round(s);
  },
  effDEF() {
    const p = this.player;
    let d = p.def + (p.equip.shield ? ITEMS[p.equip.shield].def : 0) + (p.equip.armor ? ITEMS[p.equip.armor].def : 0);
    if (p.equip.accessory === "ringDef") d *= 1.25;
    return Math.round(d);
  },

  // ===== アイテム =====
  openChest(c) {
    if (c.locked && !this.player.inv.chestKey) {
      if (!this._chestMsg || this.lastTime - this._chestMsg > 2000) {
        this._chestMsg = this.lastTime;
        this.toast("施錠された宝箱だ。宝箱鍵が必要");
      }
      this.pushBack(this.player, c.x * TILE, c.y * TILE, 8);
      return;
    }
    if (c.locked) {
      this.removeItem("chestKey", 1);
      this.toast("宝箱鍵を使った");
    }
    this.flags.openedChests[c.id] = true;
    this.chests = this.chests.filter((x) => x !== c);
    this.chestFx.push({ x: c.x, y: c.y, t: 0 });
    Sound.play("chest");
    if (c.doc) {
      this.player.docs.push(c.doc);
      const d = DOCUMENTS.find((x) => x.id === c.doc);
      this.toast(`「${d.name}」を手に入れた!`);
    } else {
      this.addItem(c.item, 1);
      this.toast(`「${ITEMS[c.item].name}」を手に入れた!`);
    }
  },

  addItem(id, qty) { this.player.inv[id] = (this.player.inv[id] || 0) + qty; },
  removeItem(id, qty) {
    this.player.inv[id] -= qty;
    if (this.player.inv[id] <= 0) {
      delete this.player.inv[id];
      for (const slot in this.player.equip) if (this.player.equip[slot] === id) this.player.equip[slot] = null;
    }
  },

  useTool() {
    const p = this.player;
    const id = p.equip.tool;
    if (!id) { this.toast("ツールを装備していない (Iでインベントリ)"); return; }
    const item = ITEMS[id];
    if (id === "potion") {
      if (this.map.bossRoom && !this.flags.bossDefeated) { this.toast("ボス戦では回復薬を使えない!"); return; }
      if (p.hp >= p.maxhp) { this.toast("HPは満タンだ"); return; }
      p.hp = p.maxhp;
      this.removeItem(id, 1);
      this.toast("回復薬を使った。HP全回復!");
      Sound.play("heal");
    } else if (id === "feather") {
      this.removeItem(id, 1);
      this.loadMap("town", MAPS.town.home.x, MAPS.town.home.y);
      this.toast("帰還羽で町へ戻った");
      Sound.play("warp");
    } else if (id === "mirror") {
      this.removeItem(id, 1);
      this.freezeUntil = this.lastTime + 5000;
      this.toast("停止鏡が光る…敵の動きが止まった!");
      Sound.play("freeze");
    } else {
      this.toast(`${item.name}は装備中常に効果を発揮する`);
    }
  },

  // ===== NPC会話 =====
  talkTo(n) {
    const d = DIALOGS[n.dialog];
    this.npcCooldown = 0.8;
    if (d.shop) { UI.openShop(); return; }
    if (d.heal) {
      if (this.player.gold >= d.heal) {
        this.player.gold -= d.heal;
        this.player.hp = this.player.maxhp;
        UI.startDialog(d.name, [`${d.heal}ゴールドだよ。\n…はい、すっかり良くなった! お大事に。`]);
        Sound.play("heal");
      } else {
        UI.startDialog(d.name, [`治療には${d.heal}ゴールド必要だよ。\n持ち合わせが足りないようだね。`]);
      }
      return;
    }
    // 村長クエスト
    if (d.questItem) {
      if (this.flags.elderQuestDone) { UI.startDialog(d.name, d.afterLines); return; }
      if (this.player.inv[d.questItem]) {
        this.flags.elderQuestDone = true;
        this.removeItem(d.questItem, 1);
        this.addItem(d.questReward, 1);
        UI.startDialog(d.name, [...d.questLines, `「${ITEMS[d.questReward].name}」を手に入れた!`]);
        Sound.play("chest");
        return;
      }
    }
    UI.startDialog(d.name, d.lines);
  },

  // ===== セーブ / ロード =====
  save() {
    if (this.map.bossRoom && !this.flags.bossDefeated) { this.toast("ボス戦中はセーブできない!"); return; }
    if (this.state !== "play") { this.toast("今はセーブできない"); return; }
    const data = {
      mapId: this.mapId,
      player: this.player,
      flags: this.flags,
      playTime: this.playTime,
    };
    localStorage.setItem("rpg_save", JSON.stringify(data));
    this.toast("セーブした");
    Sound.play("save");
  },

  loadSave() {
    const raw = localStorage.getItem("rpg_save");
    if (!raw) return false;
    const data = JSON.parse(raw);
    this.player = data.player;
    this.flags = data.flags;
    this.playTime = data.playTime;
    this.loadMap(data.mapId, data.player.x / TILE, data.player.y / TILE);
    this.state = "play";
    return true;
  },

  // ===== ユーティリティ =====
  overlap(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
  },
  movingToward(p, e) {
    const dx = (e.x + e.size / 2) - (p.x + PSIZE / 2);
    const dy = (e.y + e.size / 2) - (p.y + PSIZE / 2);
    return (p.dirX || 0) * dx + (p.dirY || 0) * dy > 0;
  },
  movingToward2(e, p) {
    if (e.dir.x === 0 && e.dir.y === 0) return false;
    const dx = (p.x + PSIZE / 2) - (e.x + e.size / 2);
    const dy = (p.y + PSIZE / 2) - (e.y + e.size / 2);
    return e.dir.x * dx + e.dir.y * dy > 0;
  },
  facingVec(f) {
    return { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[f];
  },
  pushBack(obj, fromX, fromY, dist) {
    const dx = obj.x - fromX, dy = obj.y - fromY;
    const len = Math.hypot(dx, dy) || 1;
    const nx = obj.x + (dx / len) * dist;
    const ny = obj.y + (dy / len) * dist;
    if (!this.collides(nx, obj.y, PSIZE, PSIZE)) obj.x = nx;
    if (!this.collides(obj.x, ny, PSIZE, PSIZE)) obj.y = ny;
  },
  addFloaty(x, y, text, color) {
    this.floaties.push({ x: x + PSIZE / 2, y, text, color, t: 1 });
  },
  toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.add("hidden"), 2200);
  },

  // ===== 入力 =====
  onKeyDown(e) {
    const k = e.key.toLowerCase();
    this.keys[k] = true;
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
    UI.onKey(k, e);
  },

  // ===== 描画 =====
  render(t) {
    const ctx = this.ctx;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H + HUD_H);
    if (this.state === "title" || this.state === "ending") return;
    if (!this.map) return;

    const p = this.player;
    const g = this.map.grid;
    const mw = g[0].length * TS, mh = g.length * TS;
    // カメラ
    this.camera.x = Math.max(0, Math.min(mw - VIEW_W, p.x * SCALE + (PSIZE * SCALE) / 2 - VIEW_W / 2));
    this.camera.y = Math.max(0, Math.min(mh - VIEW_H, p.y * SCALE + (PSIZE * SCALE) / 2 - VIEW_H / 2));
    if (mw < VIEW_W) this.camera.x = -(VIEW_W - mw) / 2;
    if (mh < VIEW_H) this.camera.y = -(VIEW_H - mh) / 2;
    this.camera.x = Math.round(this.camera.x);
    this.camera.y = Math.round(this.camera.y);
    const cam = this.camera;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, VIEW_W, VIEW_H);
    ctx.clip();

    // --- タイル ---
    const x0 = Math.max(0, Math.floor(cam.x / TS)), y0 = Math.max(0, Math.floor(cam.y / TS));
    const x1 = Math.min(g[0].length - 1, Math.ceil((cam.x + VIEW_W) / TS));
    const y1 = Math.min(g.length - 1, Math.ceil((cam.y + VIEW_H) / TS));
    const maskOn = p.equip.tool === "mask";
    const FLOOR_VARIANTS = ["floor_1", "floor_1", "floor_1", "floor_1", "floor_2", "floor_1", "floor_1", "floor_1", "floor_1", "floor_3", "floor_1", "floor_1", "floor_1", "floor_4", "floor_1", "floor_1", "floor_1"];
    const drawFloor = (dx, dy, tx, ty) => {
      Assets.draw(ctx, FLOOR_VARIANTS[(tx * 7 + ty * 13) % FLOOR_VARIANTS.length], dx, dy);
    };
    // 壁: 下が床なら正面(レンガ面)、上が床なら上端、それ以外は闇
    const drawWall = (dx, dy, tx, ty) => {
      if (this.isWalkable(tx, ty + 1)) Assets.draw(ctx, "wall_mid", dx, dy);
      else {
        ctx.fillStyle = "#100d18";
        ctx.fillRect(dx, dy, TS, TS);
        if (this.isWalkable(tx, ty - 1)) Assets.draw(ctx, "wall_top", dx, dy);
      }
    };
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const ch = this.tileAt(tx, ty);
        const dx = tx * TS - cam.x, dy = ty * TS - cam.y;
        switch (ch) {
          case "#": drawWall(dx, dy, tx, ty); break;
          case ",":
            drawFloor(dx, dy, tx, ty);
            Assets.draw(ctx, (tx + ty) % 2 ? "floor_5" : "floor_6", dx, dy);
            break;
          case "~": // 回復の泉(アニメする水盤)
            drawFloor(dx, dy, tx, ty);
            Assets.draw(ctx, `basin_f${1 + Math.floor(t / 180) % 3}`, dx, dy);
            break;
          case "T": drawFloor(dx, dy, tx, ty); Assets.draw(ctx, "crate", dx, dy); break;
          case "F": drawFloor(dx, dy, tx, ty); Assets.draw(ctx, "column_base", dx, dy); break;
          case "D": drawFloor(dx, dy, tx, ty); Assets.drawFit(ctx, "door_open", dx, dy); break;
          case "L": drawWall(dx, dy, tx, ty); Assets.drawFit(ctx, "door_closed", dx, dy); break;
          case "B":
            drawWall(dx, dy, tx, ty);
            ctx.strokeStyle = "rgba(0,0,0,.55)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(dx + 12, dy + 8); ctx.lineTo(dx + 24, dy + 22); ctx.lineTo(dx + 18, dy + 38);
            ctx.moveTo(dx + 30, dy + 12); ctx.lineTo(dx + 26, dy + 28);
            ctx.stroke();
            break;
          case "H":
            if (maskOn) {
              drawFloor(dx, dy, tx, ty);
              ctx.fillStyle = "rgba(120,220,255,.25)";
              ctx.fillRect(dx, dy, TS, TS);
            } else drawWall(dx, dy, tx, ty);
            break;
          case "X": { // 呪いの床(スパイク)
            drawFloor(dx, dy, tx, ty);
            const safe = p.equip.tool === "amulet";
            Assets.draw(ctx, safe ? "spikes_f1" : `spikes_f${1 + Math.floor(t / 160 + tx + ty) % 4}`, dx, dy);
            if (!safe) { ctx.fillStyle = "rgba(150,40,210,.18)"; ctx.fillRect(dx, dy, TS, TS); }
            break;
          }
          default: drawFloor(dx, dy, tx, ty);
        }
      }
    }

    // --- アクター描画ヘルパー(足元基準・等身大) ---
    const drawActor = (base, moving, x, y, size, flip, alpha = 1) => {
      const name = animFrame(base, moving ? "run" : "idle", t);
      const f = ATLAS_FRAMES[name];
      if (!f) return;
      const dx = x * SCALE + (size * SCALE - f[2] * SCALE) / 2 - cam.x;
      const dy = (y + size) * SCALE - f[3] * SCALE - cam.y;
      Assets.draw(ctx, name, dx, dy, flip, alpha);
    };

    // --- 宝箱 ---
    for (const c of this.chests) {
      const cx = c.x * TS - cam.x, cy = c.y * TS - cam.y;
      Assets.draw(ctx, "chest_closed", cx, cy);
      if (c.locked) { // 鍵マーク
        ctx.fillStyle = "#ffd040";
        ctx.fillRect(cx + TS / 2 - 4, cy + TS / 2 - 2, 8, 8);
        ctx.fillStyle = "#15100a";
        ctx.fillRect(cx + TS / 2 - 1, cy + TS / 2 + 1, 2, 3);
      }
      if (c.doc) { // 文書はキラキラ表示
        ctx.fillStyle = `rgba(255,240,150,${0.5 + 0.5 * Math.sin(t / 200)})`;
        ctx.fillRect(cx + TS / 2 - 3, cy - 8, 6, 6);
      }
    }
    // 開封アニメ
    for (const fx of this.chestFx || []) {
      const fi = Math.min(3, 1 + Math.floor(fx.t / 0.15));
      Assets.draw(ctx, `chest_open_f${fi}`, fx.x * TS - cam.x, fx.y * TS - cam.y);
    }

    // --- NPC ---
    for (const n of this.npcs) drawActor(n.spr, false, n.px, n.py, 12, false);

    // --- 敵 ---
    const frozen = t < this.freezeUntil;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (maskOn && e.def.maskHidden) continue; // 真視の仮面の副作用
      const moving = !frozen && (e.dir.x !== 0 || e.dir.y !== 0);
      drawActor(e.def.spr, moving, e.x, e.y, e.size, e.facing === "left", frozen ? 0.55 : 1);
    }

    // --- プレイヤー ---
    const blink = t < p.invulnUntil && Math.floor(t / 80) % 2 === 0;
    if (!blink) drawActor("knight_m", p.moving, p.x, p.y, PSIZE, p.facing === "left");

    // --- マップごとの環境光 ---
    if (this.mapId === "field") { ctx.fillStyle = "rgba(120,150,50,.14)"; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
    else if (this.mapId === "town") { ctx.fillStyle = "rgba(255,190,90,.08)"; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
    else if (this.mapId === "boss") { ctx.fillStyle = "rgba(255,40,20,.06)"; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }

    // --- フローティングテキスト ---
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";
    for (const f of this.floaties) {
      ctx.fillStyle = f.color;
      ctx.globalAlpha = Math.min(1, f.t * 2);
      ctx.fillText(f.text, f.x * SCALE - cam.x, f.y * SCALE - cam.y);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = "left";

    ctx.restore();

    this.renderHUD(ctx, t);

    if (this.state === "gameover") {
      ctx.fillStyle = "rgba(0,0,0,.75)";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.fillStyle = "#ff6060";
      ctx.font = "bold 42px monospace";
      ctx.textAlign = "center";
      ctx.fillText("GAME OVER", VIEW_W / 2, VIEW_H / 2 - 20);
      ctx.fillStyle = "#e8d8b0";
      ctx.font = "18px monospace";
      ctx.fillText("Enterでタイトルへ", VIEW_W / 2, VIEW_H / 2 + 30);
      ctx.textAlign = "left";
    }
  },

  // ===== HUD =====
  renderHUD(ctx, t) {
    const p = this.player;
    ctx.fillStyle = "#15100a";
    ctx.fillRect(0, VIEW_H, VIEW_W, HUD_H);
    ctx.strokeStyle = "#c9a05a";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, VIEW_H + 1, VIEW_W - 2, HUD_H - 2);

    const y = VIEW_H + 14;
    ctx.font = "bold 15px monospace";
    ctx.fillStyle = "#e8d8b0";
    ctx.fillText(`HP ${Math.max(0, Math.ceil(p.hp))}/${p.maxhp}`, 20, y + 8);
    // プレイヤーHPゲージ(黄=残存 / 赤=消失)
    const gw = 260;
    ctx.fillStyle = "#d03030";
    ctx.fillRect(150, y - 4, gw, 14);
    ctx.fillStyle = "#f0c020";
    ctx.fillRect(150, y - 4, gw * Math.max(0, p.hp / p.maxhp), 14);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.strokeRect(150, y - 4, gw, 14);

    ctx.fillStyle = "#e8d8b0";
    const expNext = p.lv >= LEVEL_CAP ? "---" : expForLevel(p.lv);
    ctx.fillText(`Lv${p.lv}  EXP ${p.exp}/${expNext}`, 20, y + 34);
    ctx.fillStyle = "#ffd980";
    ctx.fillText(`GOLD ${p.gold}G`, 20, y + 58);

    // 装備ツール表示
    ctx.fillStyle = "#a08c64";
    const tool = p.equip.tool ? ITEMS[p.equip.tool].name + (ITEMS[p.equip.tool].consumable ? ` x${p.inv[p.equip.tool] || 0}` : "") : "なし";
    ctx.fillText(`ツール[Space]: ${tool}`, 250, y + 34);
    const acc = p.equip.accessory ? ITEMS[p.equip.accessory].name : "なし";
    ctx.fillText(`アクセサリ: ${acc}`, 250, y + 58);

    // 敵HPゲージ
    if (this.lastEnemy && this.lastEnemy.alive && t - this.lastEnemyTime < 5000) {
      const e = this.lastEnemy;
      ctx.fillStyle = "#e8d8b0";
      ctx.fillText(e.def.name + (e.def.boss ? " 【BOSS】" : ""), 620, y + 8);
      ctx.fillStyle = "#d03030";
      ctx.fillRect(620, y + 16, 300, 14);
      ctx.fillStyle = "#f0c020";
      ctx.fillRect(620, y + 16, 300 * Math.max(0, e.hp / e.def.hp), 14);
      ctx.strokeStyle = "#000";
      ctx.strokeRect(620, y + 16, 300, 14);
    }

    // プレイ時間 & 現在地
    ctx.fillStyle = "#8a7450";
    const pt = Math.floor(this.playTime);
    const hh = String(Math.floor(pt / 3600)).padStart(2, "0");
    const mm = String(Math.floor((pt % 3600) / 60)).padStart(2, "0");
    const ss = String(pt % 60).padStart(2, "0");
    ctx.fillText(`${this.map.name}  ${hh}:${mm}:${ss}`, 620, y + 58);
  },
};

// ===== サウンド(WebAudio 簡易効果音) =====
const Sound = {
  ctx: null,
  ensure() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === "suspended") this.ctx.resume();
  },
  play(type) {
    try {
      this.ensure();
      const c = this.ctx;
      const o = c.createOscillator();
      const g = c.createGain();
      o.connect(g); g.connect(c.destination);
      const now = c.currentTime;
      const cfg = {
        hit:     [380, 120, "square", 0.06, 0.08],
        hurt:    [180, 80, "sawtooth", 0.08, 0.15],
        kill:    [520, 780, "square", 0.06, 0.18],
        chest:   [660, 990, "triangle", 0.08, 0.25],
        heal:    [520, 1040, "sine", 0.08, 0.3],
        levelup: [440, 880, "triangle", 0.1, 0.5],
        save:    [700, 700, "sine", 0.06, 0.12],
        unlock:  [300, 600, "square", 0.07, 0.2],
        break:   [150, 60, "sawtooth", 0.1, 0.2],
        warp:    [880, 220, "sine", 0.08, 0.4],
        freeze:  [1200, 400, "sine", 0.06, 0.35],
        gameover:[330, 110, "sawtooth", 0.1, 0.8],
        buy:     [880, 1100, "triangle", 0.06, 0.15],
      }[type] || [440, 440, "sine", 0.05, 0.1];
      o.type = cfg[2];
      o.frequency.setValueAtTime(cfg[0], now);
      o.frequency.exponentialRampToValueAtTime(Math.max(40, cfg[1]), now + cfg[4]);
      g.gain.setValueAtTime(cfg[3], now);
      g.gain.exponentialRampToValueAtTime(0.001, now + cfg[4]);
      o.start(now);
      o.stop(now + cfg[4]);
    } catch (e) { /* 音は失敗しても無視 */ }
  },
};
