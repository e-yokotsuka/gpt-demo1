// fable52/side-scroller.html（LUMEN RUN）用の自動操縦ボット。
// ブラウザのコンソール等から読み込み、window.__lumenBot(秒数) でステージを高速シミュレーションして
// クリア可能かどうか・どこでダメージを受けたかを確認するための検証用スクリプト。
window.__lumenBot = (maxT = 300) => {
	const L = window.__lumen, { G, P, input, solids, enemies, spikes } = L;
	L.start();
	const log = [];
	let lastHp = P.hp, lastRetry = G.retries, n = 0;
	// x の真下にある足場の高さ（yMax 以下で最も高いもの）
	const topAt = (x, yMax) => {
		let b = -99;
		for (const s of solids) if (s.active && x >= s.x0 && x <= s.x1 && s.y1 <= yMax + 0.05 && s.y1 > b) b = s.y1;
		return b;
	};
	while (G.state === "play" && G.time < maxT && n++ < 120 * 600) {
		input.r = true; input.l = false; input.jump = true;
		const g = P.ground;
		// 進行方向で次に乗る足場（壁は除外）
		let next = null;
		for (const s of solids) {
			if (!s.active || s === g || s.y1 - s.y0 > 10) continue;
			if (s.x1 > P.x + 0.4 && s.x0 > P.x - 0.5 && (!next || s.x0 < next.x0)) next = s;
		}
		if (g) {
			const ahead = topAt(P.x + 0.7, P.y + 0.1);
			let wall = false, hazard = false;
			for (const s of solids) if (s.active && s !== g && s.y1 - s.y0 <= 10 && s.x0 > P.x && s.x0 < P.x + 0.9 && s.y1 > P.y + 0.2 && s.y0 < P.y + 1.4) wall = true;
			for (const sp of spikes) if (Math.abs(sp.y0 - P.y) < 0.5 && sp.x0 - P.x > 0 && sp.x0 - P.x < 1.5) hazard = true;
			const aheadFar = topAt(P.x + 1.4, P.y + 0.1);
			const gap = next ? Math.max(0, next.x0 - P.x) : 0, rise = next ? next.y1 - P.y : 0;
			const ok = !next || (gap < 4.6 && rise < 2.2) || (!next.mover && !g.mover && gap < 8 && rise < 1.5);
			if (ahead < P.y - 0.2 || wall) {
				// 端や段差：届く距離・高さになるまで待つ（動く足場対策）
				if (ok) input.jumpP = true;
				else input.r = false;
			} else if (aheadFar < P.y - 0.2 && !ok) {
				input.r = false; // 崖の手前で減速して待機
			} else if (hazard) input.jumpP = true;
		} else {
			// 空中：着地先（真下〜前方で最も近い足場）に合わせて減速し、届かないときだけ二段ジャンプ
			let tgt = null;
			for (const s of solids) {
				if (!s.active || s.y1 - s.y0 > 10 || s.x1 < P.x - 0.2 || s.y1 > P.y + 3.2) continue;
				if (!tgt || s.x0 < tgt.x0) tgt = s;
			}
			if (tgt) {
				const over = P.x > tgt.x0 + 0.45 && P.x < tgt.x1 - 0.45, small = tgt.x1 - tgt.x0 < 4;
				if (over && small) { input.r = false; if (P.x > (tgt.x0 + tgt.x1) / 2 + 0.4 + (tgt.dx > 0 ? 0.5 : 0)) input.l = true; }
				if (P.vy < -1 && P.airJumps > 0 && P.x < tgt.x0 + 0.3 && P.y < tgt.y1 + 0.5) input.jumpP = true;
			} else if (P.vy < -1 && P.airJumps > 0 && P.y < 0) input.jumpP = true;
		}
		for (const e of enemies) {
			if (!e.alive) continue;
			const dx = e.x - P.x, ey = e.type === "drone" ? e.y - 0.5 : e.y;
			if (dx > -0.5 && dx < 1.7 + e.hw && Math.abs(ey - P.y) < 1.6) input.punchP = true;
			// ボス戦：間合いを保ってパンチ
			if (e.type === "boss" && P.x > 212) {
				if (dx > 0 && dx < 1.3 + e.hw) input.r = false;
				if (dx < 0) { input.r = false; input.l = true; }
				if (e.inv > 0 && Math.abs(dx) < 3) { input.r = false; input.l = dx > 0; }
			}
		}
		L.step(1 / 120);
		if (P.hp !== lastHp || G.retries !== lastRetry) {
			log.push(`t=${G.time.toFixed(1)} x=${P.x.toFixed(1)} y=${P.y.toFixed(1)} hp=${P.hp} retries=${G.retries}`);
			lastHp = P.hp; lastRetry = G.retries;
		}
	}
	input.r = input.l = input.jump = false;
	return { state: G.state, time: G.time.toFixed(1), x: P.x.toFixed(1), y: P.y.toFixed(1), got: G.got, total: L.orbs.length, retries: G.retries, log: log.slice(0, 30) };
};
