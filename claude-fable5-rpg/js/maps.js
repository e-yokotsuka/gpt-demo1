// マップ定義
// 凡例: '#'=壁  '.'=床  ','=床(模様)  '~'=回復の泉  'T'=テーブル/木箱  'F'=柵
//       'D'=扉(通行可)  'L'=施錠扉(神殿鍵)  'B'=ひび割れ壁(破砕槌)  'H'=隠し通路  'X'=呪いの床

function blankGrid(w, h) {
  const g = [];
  for (let y = 0; y < h; y++) {
    g.push(new Array(w).fill(y === 0 || y === h - 1 ? "#" : "."));
    if (y > 0 && y < h - 1) { g[y][0] = "#"; g[y][w - 1] = "#"; }
  }
  return g;
}
function rect(g, x, y, w, h, ch) {
  for (let j = y; j < y + h; j++)
    for (let i = x; i < x + w; i++)
      if (g[j] && g[j][i] !== undefined) g[j][i] = ch;
}
function put(g, x, y, ch) { if (g[y] && g[y][x] !== undefined) g[y][x] = ch; }
function scatter(g, ch, points) { for (const [x, y] of points) put(g, x, y, ch); }

// ===== 町 (拠点) =====
function buildTown() {
  const g = blankGrid(20, 14);
  rect(g, 2, 2, 2, 2, "T");   // 家(左上)
  rect(g, 16, 2, 2, 2, "T");  // 家(右上)
  rect(g, 2, 9, 2, 2, "T");   // 家(左下)
  rect(g, 16, 9, 2, 2, "T");  // 家(右下)
  put(g, 13, 3, "F"); put(g, 14, 3, "F"); // 店のカウンター
  scatter(g, ",", [[5, 6], [9, 4], [13, 8], [7, 11], [11, 6]]);
  // 南の出口
  put(g, 9, 13, "."); put(g, 10, 13, ".");
  return g;
}

// ===== 野原(フィールド) =====
function buildField() {
  const g = blankGrid(40, 28);
  // 北の入口(町へ)
  put(g, 19, 0, "."); put(g, 20, 0, ".");
  // 東の入口(神殿へ)
  put(g, 39, 13, "D"); put(g, 39, 14, "D");
  // 岩場・林
  rect(g, 7, 6, 2, 2, "#");
  rect(g, 30, 6, 3, 2, "#");
  rect(g, 11, 9, 4, 1, "#");
  rect(g, 11, 10, 1, 3, "#");
  rect(g, 14, 10, 1, 3, "#");
  rect(g, 24, 11, 5, 2, "#");
  rect(g, 16, 17, 2, 4, "#");
  rect(g, 28, 18, 4, 2, "#");
  rect(g, 5, 22, 3, 1, "#");
  scatter(g, "T", [[4, 3], [5, 3], [34, 3], [35, 3], [22, 8], [9, 16], [33, 16], [20, 22]]);
  scatter(g, "F", [[18, 2], [21, 2]]);
  // 回復の泉
  rect(g, 8, 19, 2, 2, "~");
  rect(g, 34, 8, 2, 2, "~");
  scatter(g, ",", [[6, 8], [15, 5], [25, 4], [12, 15], [22, 16], [30, 23], [10, 25], [36, 20], [18, 12]]);
  return g;
}

// ===== 古代神殿(ダンジョン) =====
function buildDungeon() {
  const g = blankGrid(36, 26);
  // 西の入口(野原から) + 施錠扉
  put(g, 0, 13, "."); put(g, 0, 14, ".");
  put(g, 2, 13, "L"); put(g, 2, 14, "L");
  rect(g, 1, 1, 1, 12, "#"); rect(g, 1, 15, 1, 10, "#"); // 入口通路の壁
  rect(g, 2, 1, 1, 11, "#"); rect(g, 2, 16, 1, 9, "#");
  // 内部の柱・壁
  rect(g, 6, 4, 2, 6, "#");
  rect(g, 6, 16, 2, 6, "#");
  rect(g, 12, 8, 6, 2, "#");
  rect(g, 12, 18, 1, 6, "#");
  rect(g, 16, 14, 2, 5, "#");
  rect(g, 22, 4, 2, 8, "#");
  rect(g, 26, 16, 6, 1, "#");
  rect(g, 30, 8, 2, 4, "#");
  // 炎剣の隠し部屋(ひび割れ壁の奥)
  rect(g, 8, 21, 6, 4, "#");
  rect(g, 9, 22, 4, 2, ".");
  put(g, 11, 21, "B"); // 入口のひび割れ壁
  // 戦盾・戦鎧の隠し部屋(隠し通路の奥)
  rect(g, 26, 2, 8, 4, "#");
  rect(g, 27, 3, 6, 2, ".");
  put(g, 26, 4, "H"); put(g, 25, 4, "H"); // 隠し通路
  // 呪いの床地帯(第三巻の前・ボス扉の前)
  rect(g, 28, 20, 6, 4, "X");
  rect(g, 33, 12, 3, 3, "X");
  // 東のボス扉
  put(g, 35, 13, "D"); put(g, 35, 14, "D");
  scatter(g, ",", [[5, 12], [10, 5], [15, 12], [20, 20], [25, 8], [30, 18], [8, 18], [19, 4]]);
  return g;
}

// ===== 魔王の間 =====
function buildBoss() {
  const g = blankGrid(15, 12);
  // 南の入口
  put(g, 7, 11, "D");
  scatter(g, ",", [[4, 4], [10, 4], [4, 8], [10, 8]]);
  return g;
}

const MAPS = {
  town: {
    name: "リーフの町",
    grid: buildTown(),
    tileset: "sand",
    regenAll: true, // 町全域が自然回復エリア
    npcs: [
      { dialog: "elder",      spr: "wizzard_m", x: 4,  y: 4 },
      { dialog: "shopkeeper", spr: "lizard_m",  x: 13, y: 2 },
      { dialog: "doctor",     spr: "wizzard_f", x: 16, y: 7 },
      { dialog: "oldwoman",   spr: "elf_f",     x: 6,  y: 9 },
      { dialog: "child",      spr: "elf_m",     x: 10, y: 6 },
      { dialog: "guard",      spr: "knight_f",  x: 11, y: 12 },
      { dialog: "scholar",    spr: "archer_m",  x: 3,  y: 11 },
    ],
    enemies: [],
    chests: [],
    transitions: [
      { x: 9, y: 13, w: 2, h: 1, to: "field", tx: 19.5, ty: 1.2 },
    ],
    home: { x: 10, y: 8 },
  },

  field: {
    name: "枯れの野原",
    tileset: "sand",
    grid: buildField(),
    npcs: [],
    enemies: [
      { type: "slime", x: 10, y: 7 }, { type: "slime", x: 14, y: 13 },
      { type: "slime", x: 7, y: 14 }, { type: "slime", x: 24, y: 7 },
      { type: "bat", x: 28, y: 9 }, { type: "bat", x: 20, y: 18 }, { type: "bat", x: 12, y: 22 },
      { type: "goblin", x: 32, y: 13 }, { type: "goblin", x: 34, y: 21 }, { type: "goblin", x: 26, y: 24 },
    ],
    chests: [
      { id: "f_c1", x: 4, y: 5,  item: "potion" },
      { id: "f_c2", x: 33, y: 22, item: "lostItem" },
      { id: "f_c3", x: 12, y: 24, item: "templeKey", locked: true },
      { id: "f_c4", x: 36, y: 3, item: "potion" },
    ],
    transitions: [
      { x: 19, y: 0, w: 2, h: 1, to: "town", tx: 9.5, ty: 12 },
      { x: 39, y: 13, w: 1, h: 2, to: "dungeon", tx: 1, ty: 13.5 },
    ],
  },

  dungeon: {
    name: "古代神殿",
    tileset: "dungeon",
    grid: buildDungeon(),
    dungeon: true, // 治癒指輪がないと自然回復不可
    npcs: [],
    enemies: [
      { type: "scarab", x: 8, y: 12 }, { type: "scarab", x: 14, y: 5 },
      { type: "scarab", x: 10, y: 19 },
      { type: "ghost", x: 19, y: 11 }, { type: "ghost", x: 24, y: 14 },
      { type: "ghost", x: 14, y: 22 },
      { type: "skull", x: 28, y: 10 }, { type: "skull", x: 31, y: 19 },
      { type: "skull", x: 20, y: 6 },
      { type: "cyclops", x: 29, y: 22 }, // 護符の宝箱の守護者
    ],
    chests: [
      { id: "d_c1", x: 4, y: 16,  item: "glasses" },
      { id: "d_c2", x: 18, y: 3,  item: "mask" },
      { id: "d_c3", x: 31, y: 22, item: "amulet" },
      { id: "d_c4", x: 11, y: 23, item: "sword5" },  // 炎剣(ひび割れ壁の奥)
      { id: "d_c5", x: 28, y: 4,  item: "shield5" }, // 戦盾(隠し通路の奥)
      { id: "d_c6", x: 31, y: 4,  item: "armor5" },  // 戦鎧(隠し通路の奥)
      { id: "d_c7", x: 33, y: 2,  item: "ringCurse", locked: true },
      { id: "d_doc1", x: 9, y: 6,   doc: "doc1" },
      { id: "d_doc2", x: 24, y: 19, doc: "doc2" },
      { id: "d_doc3", x: 33, y: 23, doc: "doc3" }, // 呪いの床の奥
    ],
    transitions: [
      { x: 0, y: 13, w: 1, h: 2, to: "field", tx: 37.5, ty: 13.5 },
      { x: 35, y: 13, w: 1, h: 2, to: "boss", tx: 7, ty: 10 },
    ],
  },

  boss: {
    name: "魔王の間",
    tileset: "dungeon",
    grid: buildBoss(),
    dungeon: true,
    bossRoom: true,
    npcs: [],
    enemies: [{ type: "demon", x: 7, y: 4 }],
    chests: [],
    transitions: [
      { x: 7, y: 11, w: 1, h: 1, to: "dungeon", tx: 33.5, ty: 13.5 },
    ],
  },
};
