// UI制御とブート処理
const UI = {
  el(id) { return document.getElementById(id); },
  show(id) { this.el(id).classList.remove("hidden"); },
  hide(id) { this.el(id).classList.add("hidden"); },

  titleSel: 0,
  invSel: 0,
  invList: [],
  shopSel: 0,
  docsSel: 0,
  docsReading: false,

  // ===== キールーティング =====
  onKey(k, e) {
    const G = Game;
    switch (G.state) {
      case "title": this.titleKey(k); break;
      case "play": this.playKey(k); break;
      case "dialog":
        if (k === "enter" || k === " " || k === "z") this.advanceDialog();
        break;
      case "status":
        if (k === "c" || k === "escape") this.closeSub("status-screen");
        break;
      case "inventory": this.inventoryKey(k); break;
      case "docs": this.docsKey(k); break;
      case "shop": this.shopKey(k); break;
      case "gameover":
        if (k === "enter") { this.hideAll(); G.state = "title"; this.showTitle(); }
        break;
      case "ending":
        if (k === "enter") { this.hide("ending-screen"); G.state = "title"; this.showTitle(); }
        break;
    }
  },

  playKey(k) {
    const G = Game;
    if (k === " " || k === "z") G.useTool();
    else if (k === "c") this.openStatus();
    else if (k === "e") this.openInventory();
    else if (k === "b") this.openDocs();
    else if (k === "k") G.save();
  },

  hideAll() {
    for (const id of ["title-screen", "status-screen", "inventory-screen", "docs-screen", "shop-screen", "dialog-box", "ending-screen"])
      this.hide(id);
  },

  // ===== タイトル =====
  showTitle() {
    this.hideAll();
    this.show("title-screen");
    this.titleSel = 0;
    this.renderTitle();
  },
  renderTitle() {
    const hasSave = !!localStorage.getItem("rpg_save");
    const items = this.el("title-menu").children;
    items[1].classList.toggle("disabled", !hasSave);
    for (let i = 0; i < items.length; i++) items[i].classList.toggle("selected", i === this.titleSel);
  },
  titleKey(k) {
    if (k === "arrowup" || k === "w") { this.titleSel = (this.titleSel + 1) % 2; this.renderTitle(); }
    else if (k === "arrowdown" || k === "s") { this.titleSel = (this.titleSel + 1) % 2; this.renderTitle(); }
    else if (k === "enter" || k === "z" || k === " ") {
      Sound.play("buy");
      if (this.titleSel === 0) {
        this.hideAll();
        Game.newGame();
        this.startDialog("???", [
          "リーフの町へようこそ、旅の剣士よ。",
          "東の神殿に蘇った魔王ゾルガを倒してほしい。\nまずは町の村長に話を聞くといい。",
          "【操作】移動: 矢印/WASD　アイテム使用: Space\nステータス: C　インベントリ: E　古文書: B　セーブ: K",
          "この世界では敵に「ぶつかる」ことが攻撃になる。\n正面からのぶつかり合いは危険だ。\n側面や背後を狙え!",
        ]);
      } else if (localStorage.getItem("rpg_save")) {
        this.hideAll();
        Game.loadSave();
        Game.toast("ロードした");
      }
    }
  },

  // ===== ダイアログ =====
  startDialog(name, lines) {
    if (!lines || lines.length === 0) return;
    Game.state = "dialog";
    Game.dialogQueue = [...lines];
    this.el("dialog-name").textContent = name;
    this.el("dialog-text").textContent = Game.dialogQueue[0];
    this.show("dialog-box");
  },
  advanceDialog() {
    Game.dialogQueue.shift();
    if (Game.dialogQueue.length === 0) {
      this.hide("dialog-box");
      Game.state = "play";
      Game.npcCooldown = 0.6;
      return;
    }
    this.el("dialog-text").textContent = Game.dialogQueue[0];
  },

  // ===== ステータス画面 =====
  openStatus() {
    Game.state = "status";
    const p = Game.player;
    const eq = (id) => (id ? ITEMS[id].name : "---");
    const expNext = p.lv >= LEVEL_CAP ? "---(上限)" : expForLevel(p.lv);
    const pt = Math.floor(Game.playTime);
    const time = `${String(Math.floor(pt / 3600)).padStart(2, "0")}:${String(Math.floor((pt % 3600) / 60)).padStart(2, "0")}:${String(pt % 60).padStart(2, "0")}`;
    this.el("status-body").innerHTML = `<table>
      <tr><td>LEVEL</td><td>${p.lv} / ${LEVEL_CAP}</td></tr>
      <tr><td>HP</td><td>${Math.ceil(p.hp)} / ${p.maxhp}</td></tr>
      <tr><td>STR(実効)</td><td>${p.str} (${Game.effSTR()})</td></tr>
      <tr><td>DEF(実効)</td><td>${p.def} (${Game.effDEF()})</td></tr>
      <tr><td>EXP</td><td>${p.exp} / ${expNext}</td></tr>
      <tr><td>GOLD</td><td>${p.gold}G</td></tr>
      <tr><td>武器</td><td>${eq(p.equip.weapon)}</td></tr>
      <tr><td>盾</td><td>${eq(p.equip.shield)}</td></tr>
      <tr><td>鎧</td><td>${eq(p.equip.armor)}</td></tr>
      <tr><td>ツール</td><td>${eq(p.equip.tool)}</td></tr>
      <tr><td>アクセサリ</td><td>${eq(p.equip.accessory)}</td></tr>
      <tr><td>プレイ時間</td><td>${time}</td></tr>
    </table>`;
    this.show("status-screen");
  },

  // ===== インベントリ画面 =====
  openInventory() {
    Game.state = "inventory";
    this.invSel = 0;
    this.renderInventory();
    this.show("inventory-screen");
  },
  renderInventory() {
    const p = Game.player;
    const equipTypes = ["weapon", "shield", "armor", "tool", "accessory"];
    // 左: 装備可能品 / 右: 一般・重要アイテム
    const equipables = Object.keys(p.inv).filter((id) => equipTypes.includes(ITEMS[id].type));
    const keyItems = Object.keys(p.inv).filter((id) => ITEMS[id].type === "key");
    this.invList = equipables;
    const typeLabel = { weapon: "武", shield: "盾", armor: "鎧", tool: "具", accessory: "飾" };
    this.el("inv-equip").innerHTML = equipables.map((id, i) => {
      const it = ITEMS[id];
      const equipped = p.equip[it.type] === id;
      const qty = it.consumable ? ` x${p.inv[id]}` : "";
      return `<li class="${i === this.invSel ? "selected" : ""}">[${typeLabel[it.type]}] ${it.name}${qty} ${equipped ? '<span class="equipped-mark">E</span>' : ""}<span class="item-desc">${it.desc}</span></li>`;
    }).join("") || "<li>(なし)</li>";
    this.el("inv-items").innerHTML = "<li class='item-desc'>消耗品はツールとして装備しSpaceで使用</li>";
    this.el("inv-keyitems").innerHTML = keyItems.map((id) => `<li>◆ ${ITEMS[id].name}<span class="item-desc">${ITEMS[id].desc}</span></li>`).join("") || "<li>(なし)</li>";
  },
  inventoryKey(k) {
    if (k === "e" || k === "escape") { this.closeSub("inventory-screen"); return; }
    if (this.invList.length === 0) return;
    if (k === "arrowup" || k === "w") { this.invSel = (this.invSel - 1 + this.invList.length) % this.invList.length; this.renderInventory(); }
    else if (k === "arrowdown" || k === "s") { this.invSel = (this.invSel + 1) % this.invList.length; this.renderInventory(); }
    else if (k === "enter" || k === "z" || k === " ") {
      const id = this.invList[this.invSel];
      const it = ITEMS[id];
      const p = Game.player;
      if (p.equip[it.type] === id) p.equip[it.type] = null; // 解除
      else p.equip[it.type] = id; // 装備(カテゴリ毎に1つ)
      Sound.play("buy");
      this.renderInventory();
    }
  },

  // ===== 古文書画面 =====
  openDocs() {
    Game.state = "docs";
    this.docsSel = 0;
    this.docsReading = false;
    this.renderDocs();
    this.show("docs-screen");
  },
  renderDocs() {
    const p = Game.player;
    const hasGlasses = !!p.inv.glasses;
    let html = "<ul>";
    DOCUMENTS.forEach((d, i) => {
      const owned = p.docs.includes(d.id);
      const read = p.docsRead.includes(d.id);
      html += `<li class="${i === this.docsSel ? "selected" : ""} ${owned ? "" : "locked"}">${owned ? "📜" : "❔"} ${owned ? d.name : "???"}${read ? " ✓解読済" : ""}</li>`;
    });
    html += "</ul>";
    if (this.docsReading) {
      const d = DOCUMENTS[this.docsSel];
      if (!p.docs.includes(d.id)) html += `<div class="doc-content">(未入手)</div>`;
      else if (!hasGlasses) html += `<div class="doc-content">古代文字で書かれていて読めない…。\n「解読眼鏡」が必要だ。</div>`;
      else {
        html += `<div class="doc-content">${d.text}</div>`;
        if (!p.docsRead.includes(d.id)) {
          p.docsRead.push(d.id);
          if (p.docsRead.length === DOCUMENTS.length) Game.toast("すべての古代文書を解読した…!");
        }
      }
    } else if (!hasGlasses) {
      html += `<div class="doc-content">※古代文書の解読には「解読眼鏡」が必要</div>`;
    }
    this.el("docs-body").innerHTML = html;
  },
  docsKey(k) {
    if (k === "b" || k === "escape") { this.closeSub("docs-screen"); return; }
    if (k === "arrowup" || k === "w") { this.docsSel = (this.docsSel - 1 + DOCUMENTS.length) % DOCUMENTS.length; this.docsReading = false; this.renderDocs(); }
    else if (k === "arrowdown" || k === "s") { this.docsSel = (this.docsSel + 1) % DOCUMENTS.length; this.docsReading = false; this.renderDocs(); }
    else if (k === "enter" || k === "z" || k === " ") { this.docsReading = true; this.renderDocs(); }
  },

  // ===== ショップ =====
  openShop() {
    Game.state = "shop";
    this.shopSel = 0;
    this.renderShop();
    this.show("shop-screen");
  },
  renderShop() {
    const p = Game.player;
    this.el("shop-gold").textContent = `所持金: ${p.gold}G`;
    this.el("shop-list").innerHTML = SHOP_STOCK.map((id, i) => {
      const it = ITEMS[id];
      const owned = !it.consumable && it.type !== "key" && p.inv[id];
      return `<li class="${i === this.shopSel ? "selected" : ""} ${owned ? "owned" : ""}">
        <span>${it.name} ${owned ? "(所持)" : ""} <span class="item-desc" style="display:inline">${it.desc}</span></span>
        <span class="price">${it.price}G</span></li>`;
    }).join("");
  },
  shopKey(k) {
    if (k === "escape") { this.closeSub("shop-screen"); return; }
    if (k === "arrowup" || k === "w") { this.shopSel = (this.shopSel - 1 + SHOP_STOCK.length) % SHOP_STOCK.length; this.renderShop(); }
    else if (k === "arrowdown" || k === "s") { this.shopSel = (this.shopSel + 1) % SHOP_STOCK.length; this.renderShop(); }
    else if (k === "enter" || k === "z" || k === " ") {
      const id = SHOP_STOCK[this.shopSel];
      const it = ITEMS[id];
      const p = Game.player;
      if (!it.consumable && it.type !== "key" && p.inv[id]) { Game.toast("すでに持っている"); return; }
      if (p.gold < it.price) { Game.toast("ゴールドが足りない!"); return; }
      p.gold -= it.price;
      Game.addItem(id, 1);
      Game.toast(`「${it.name}」を購入した`);
      Sound.play("buy");
      this.renderShop();
    }
  },

  closeSub(id) {
    this.hide(id);
    Game.state = "play";
  },

  // ===== エンディング =====
  showEnding() {
    Game.state = "ending";
    const trueEnd = Game.player.docsRead.length === DOCUMENTS.length;
    this.el("ending-body").textContent = (trueEnd ? ENDING_TRUE : ENDING_NORMAL) + "\n\n\nEnterでタイトルへ";
    this.show("ending-screen");
    localStorage.removeItem("rpg_save"); // クリア後はニューゲームから
  },
};

// ===== ブート =====
window.addEventListener("load", async () => {
  await Assets.load();
  Game.init(document.getElementById("game"));
  UI.showTitle();
});
