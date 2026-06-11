// ゲームデータ定義(アイテム・敵・文書)

// ===== 装備・アイテム =====
// type: weapon / shield / armor / tool / accessory / key
const ITEMS = {
  // 武器
  sword1: { name: "初級剣", type: "weapon", str: 3,  price: 50,  desc: "駆け出し用の剣" },
  sword2: { name: "長剣",   type: "weapon", str: 6,  price: 120, desc: "標準的な長剣" },
  sword3: { name: "湾刀",   type: "weapon", str: 10, price: 300, desc: "鋭く曲がった刀" },
  sword4: { name: "銀剣",   type: "weapon", str: 15, price: 800, desc: "銀で鍛えた剣" },
  sword5: { name: "炎剣",   type: "weapon", str: 20, price: 0,   desc: "炎を宿す剣。アンデッドに強い", special: "flame" },
  // 盾
  shield1: { name: "小盾", type: "shield", def: 1,  price: 40,  desc: "小型の盾" },
  shield2: { name: "中盾", type: "shield", def: 3,  price: 100, desc: "扱いやすい盾" },
  shield3: { name: "大盾", type: "shield", def: 5,  price: 250, desc: "大型の盾" },
  shield4: { name: "銀盾", type: "shield", def: 8,  price: 600, desc: "銀の盾" },
  shield5: { name: "戦盾", type: "shield", def: 12, price: 0,   desc: "歴戦の戦士の盾" },
  // 鎧
  armor1: { name: "鎖鎧",   type: "armor", def: 2,  price: 60,  desc: "鎖かたびら" },
  armor2: { name: "板金鎧", type: "armor", def: 4,  price: 150, desc: "板金の鎧" },
  armor3: { name: "反射鎧", type: "armor", def: 6,  price: 400, desc: "受けた傷を敵に返す", special: "reflect" },
  armor4: { name: "銀鎧",   type: "armor", def: 9,  price: 700, desc: "銀の鎧" },
  armor5: { name: "戦鎧",   type: "armor", def: 13, price: 0,   desc: "歴戦の戦士の鎧" },
  // ツール
  potion:  { name: "回復薬",     type: "tool", price: 20, consumable: true, desc: "HPを全回復(ボス戦使用不可)" },
  feather: { name: "帰還羽",     type: "tool", price: 15, consumable: true, desc: "拠点の町へ瞬時に戻る" },
  mirror:  { name: "停止鏡",     type: "tool", price: 30, consumable: true, desc: "一定時間敵を停止させる" },
  mask:    { name: "真視の仮面", type: "tool", price: 0, desc: "装備中、隠し通路が見える。ただし一部の敵が見えなくなる" },
  amulet:  { name: "封印の護符", type: "tool", price: 0, desc: "装備中、呪いの床の影響を無効化する" },
  crusher: { name: "破砕槌",     type: "tool", price: 0, desc: "装備中、ひび割れた壁に触れると破壊できる" },
  // アクセサリ
  ringAtk:   { name: "攻撃指輪", type: "accessory", price: 200, desc: "攻撃力1.25倍", special: "atkUp" },
  ringDef:   { name: "防護指輪", type: "accessory", price: 200, desc: "防御力1.25倍", special: "defUp" },
  ringTime:  { name: "時間指輪", type: "accessory", price: 300, desc: "敵の移動速度を低下させる", special: "slow" },
  ringHeal:  { name: "治癒指輪", type: "accessory", price: 400, desc: "どこでも自然回復できる", special: "regen" },
  ringCurse: { name: "呪い指輪", type: "accessory", price: 0,   desc: "攻撃力2倍。だがHPが蝕まれ続ける…", special: "curse" },
  // 重要アイテム
  templeKey:  { name: "神殿鍵",     type: "key", desc: "古代神殿の扉を開く鍵" },
  chestKey:   { name: "宝箱鍵",     type: "key", price: 30, desc: "施錠された宝箱を開ける" },
  lostItem:   { name: "村の遺失物", type: "key", desc: "村長が探していた形見の指輪" },
  glasses:    { name: "解読眼鏡",   type: "key", desc: "古代文字を解読できる眼鏡" },
  crystal:    { name: "転送結晶",   type: "key", desc: "強い魔力を放つ結晶" },
  instrument: { name: "楽器",       type: "key", desc: "古びた竪琴" },
};

// ショップ品揃え
const SHOP_STOCK = [
  "sword1", "sword2", "sword3", "sword4",
  "shield1", "shield2", "shield3", "shield4",
  "armor1", "armor2", "armor3", "armor4",
  "potion", "feather", "mirror", "chestKey",
  "ringAtk", "ringDef", "ringTime", "ringHeal",
];

// ===== 敵 ===== (spr は 0x72 DungeonTileset II のアクター名)
const ENEMIES = {
  slime:   { name: "チビゾンビ", spr: "zombie_tiny", lv: 1, hp: 8,   str: 4,  def: 1,  exp: 3,  gold: 2,  speed: 18 },
  bat:     { name: "インプ",     spr: "imp",         lv: 2, hp: 10,  str: 6,  def: 1,  exp: 5,  gold: 3,  speed: 42, maskHidden: true },
  goblin:  { name: "ゴブリン",   spr: "goblin",      lv: 3, hp: 16,  str: 9,  def: 3,  exp: 8,  gold: 6,  speed: 26 },
  scarab:  { name: "オーク兵",   spr: "orc_warrior", lv: 4, hp: 22,  str: 12, def: 5,  exp: 12, gold: 8,  speed: 24 },
  ghost:   { name: "ゾンビ",     spr: "zombie",      lv: 5, hp: 26,  str: 15, def: 6,  exp: 16, gold: 10, speed: 22, undead: true },
  skull:   { name: "スケルトン", spr: "skelet",      lv: 6, hp: 34,  str: 18, def: 8,  exp: 22, gold: 14, speed: 28, undead: true },
  cyclops: { name: "オーガ",     spr: "ogre",        lv: 7, hp: 50,  str: 22, def: 10, exp: 40, gold: 30, speed: 20, size: 20 },
  demon:   { name: "魔王ゾルガ", spr: "demon_big",   lv: 9, hp: 120, str: 26, def: 12, exp: 0,  gold: 0,  speed: 30, boss: true, size: 24 },
};

// ===== レベル =====
const LEVEL_CAP = 10;
const expForLevel = (lv) => lv * 20 + (lv - 1) * 10; // 次レベルまでの必要EXP
const LEVEL_GAIN = { hp: 6, str: 2, def: 1 };

// ===== 古代文書 =====
const DOCUMENTS = [
  {
    id: "doc1", name: "古代文書・第一巻",
    text: "「我ら、地の底に眠る災いを封じたり。\n封印は三つの理にて保たれる。\n剣は炎を宿し、盾は戦を語り、\n心は呪いに惑わされぬこと。」\n\n…神殿の奥に「炎剣」が眠るという記述がある。",
  },
  {
    id: "doc2", name: "古代文書・第二巻",
    text: "「災いの王は正面より来る者を喰らう。\n横より、背より、影より討つべし。\n力に頼る者は力に滅ぼされる。」\n\n…魔王には正面から挑んではならない、という戒めらしい。",
  },
  {
    id: "doc3", name: "古代文書・第三巻",
    text: "「すべてを知りし者が王を討つとき、\n地は癒え、緑は戻り、民は再び歌う。\n知らずして討つ者には、静寂のみが残る。」\n\n…三巻すべてを読み解いた者だけが、真の救済をもたらすようだ。",
  },
];

// ===== ダイアログ =====
const DIALOGS = {
  elder: {
    name: "村長",
    lines: [
      "よく来たな、若者よ。",
      "東の神殿に魔王ゾルガが蘇り、大地が枯れ始めておる…。",
      "神殿の扉は「神殿鍵」がなければ開かぬ。\n野原のどこかの宝箱に眠っているそうじゃ。",
    ],
    questItem: "lostItem",
    questLines: [
      "おお…! それは儂が失くした形見の指輪!\nよく見つけてくれた!",
      "礼にこの「破砕槌」を授けよう。\nひび割れた壁を打ち砕けるはずじゃ。",
    ],
    questReward: "crusher",
    afterLines: ["神殿の奥は呪いの床が広がっておる。\n護符なしでは進めぬぞ。"],
  },
  oldwoman: {
    name: "老婆",
    lines: [
      "野原の泉のそばで休むと、傷が癒えるんだよ。",
      "じっと立ち止まるのがコツさね。",
    ],
  },
  child: {
    name: "子供",
    lines: [
      "ねえ知ってる? 敵にまっすぐぶつかると痛いんだって!",
      "横とか後ろからぶつかると、一方的に勝てるらしいよ!\nあと、ちょっと体をずらしてぶつかるのもいいって!",
    ],
  },
  doctor: {
    name: "医者",
    lines: [],
    heal: 20,
  },
  shopkeeper: {
    name: "店主",
    lines: [],
    shop: true,
  },
  scholar: {
    name: "学者",
    lines: [
      "古代文書を集めているのかい?\nあれは「解読眼鏡」がないと読めない代物だ。",
      "眼鏡は神殿の入口近くの宝箱で見たことがある。\n…ああ、それと文書は全部で三巻あるはずだ。",
    ],
  },
  guard: {
    name: "門番",
    lines: [
      "町の外は魔物だらけだ。気をつけろよ。",
      "回復薬はボス戦じゃ使えないって話だ。\n挑む前に体勢を整えておけ。",
    ],
  },
};

// ===== エンディングテキスト =====
const ENDING_NORMAL =
  "魔王ゾルガは倒れ、神殿は静寂に包まれた。\n\nしかし大地の呪いは完全には解けず、\n枯れた野に風だけが吹いていた…。\n\n― 終 ―\n\n(真のエンディングには古代文書三巻の解読が必要)";
const ENDING_TRUE =
  "魔王ゾルガは倒れ、封印の理は成就した。\n\nすべてを知りし者の剣によって大地は癒え、\n緑は戻り、民は再び歌い始めた。\n\nあなたの名は永く語り継がれるだろう。\n\n― 真エンディング 完 ―";
