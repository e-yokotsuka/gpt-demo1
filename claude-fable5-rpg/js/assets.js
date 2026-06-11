// スプライト管理
// 素材: 0x72 DungeonTileset II (CC0 / https://0x72.itch.io/dungeontileset-ii)
// アトラスは tools/build_atlas.py で生成 (座標は js/atlas_data.js)
const TILE = 16;
const SCALE = 3;
const TS = TILE * SCALE; // 描画タイルサイズ 48px

const Assets = {
  img: null,
  load() {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => { this.img = img; resolve(); };
      img.onerror = reject;
      img.src = "assets/atlas.png";
    });
  },

  // 名前指定でアトラスから描画(等倍 x SCALE)
  draw(ctx, name, dx, dy, flip = false, alpha = 1) {
    const f = ATLAS_FRAMES[name];
    if (!f) return;
    const [sx, sy, w, h] = f;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (flip) {
      ctx.translate(dx + w * SCALE, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(this.img, sx, sy, w, h, 0, 0, w * SCALE, h * SCALE);
    } else {
      ctx.drawImage(this.img, sx, sy, w, h, dx, dy, w * SCALE, h * SCALE);
    }
    ctx.restore();
  },

  // 1タイル(48px)に収めて描画(32pxの扉などの縮小用)
  drawFit(ctx, name, dx, dy, alpha = 1) {
    const f = ATLAS_FRAMES[name];
    if (!f) return;
    const [sx, sy, w, h] = f;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(this.img, sx, sy, w, h, dx, dy, TS, TS);
    ctx.restore();
  },
};

// アニメフレーム名を返す (idle/run、4フレーム、8fps)
function animFrame(base, state, t, frames = 4, fps = 8) {
  const i = 1 + Math.floor(t / (1000 / fps)) % frames;
  return `${base}_${state}_f${i}`;
}
