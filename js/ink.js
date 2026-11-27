// 슬라이드 위 필기 레이어 (애플펜슬 / 마우스 / 선택 시 손가락)
// 획 좌표는 0~1로 정규화해서 저장하므로 화면 크기가 바뀌어도 그대로 맞습니다.

const round = (n) => Math.round(n * 10000) / 10000;

export function createInk(canvas, opts) {
  // opts: getTool() -> {tool:'pen'|'hl'|'eraser'|'play', color, w, finger}
  //       now() -> 녹음 기준 초 (없으면 null)
  //       onChange(), onPick(stroke)
  const ctx = canvas.getContext('2d');
  let strokes = [];
  let cur = null;
  let replayT = null; // 재생 위치(초). 이 시각 이후에 그린 획은 흐리게 표시
  const later = (st) => replayT != null && st.t != null && st.t > replayT;

  const W = () => canvas.width;
  const H = () => canvas.height;

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    return [round((e.clientX - r.left) / r.width), round((e.clientY - r.top) / r.height), round(e.pressure || 0.5)];
  }

  function applyStyle(st) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = st.color;
    ctx.globalAlpha = (st.tool === 'hl' ? 0.3 : 1) * (later(st) ? 0.12 : 1);
  }

  function lineWidth(st, p) {
    const base = (st.w * W()) / 1000;
    return st.tool === 'hl' ? base : base * (0.4 + (p ?? 0.5) * 1.2);
  }

  function drawSegment(st, i) {
    const a = st.pts[Math.max(0, i - 1)], b = st.pts[i];
    applyStyle(st);
    ctx.lineWidth = lineWidth(st, b[2]);
    ctx.beginPath();
    ctx.moveTo(a[0] * W(), a[1] * H());
    ctx.lineTo(b[0] * W() + (i === 0 ? 0.1 : 0), b[1] * H());
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawStroke(st) {
    if (st.tool === 'hl') {
      // 형광펜은 겹쳐서 진해지지 않게 한 번에 그림
      applyStyle(st);
      ctx.lineWidth = lineWidth(st);
      ctx.beginPath();
      st.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * W(), y * H()) : ctx.moveTo(x * W(), y * H())));
      if (st.pts.length === 1) ctx.lineTo(st.pts[0][0] * W() + 0.1, st.pts[0][1] * H());
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      for (let i = 0; i < st.pts.length; i++) drawSegment(st, i);
    }
  }

  function redraw() {
    ctx.clearRect(0, 0, W(), H());
    strokes.forEach(drawStroke);
  }

  function distToStroke(st, p) {
    let best = Infinity;
    for (const q of st.pts) {
      const dx = (q[0] - p[0]) * W(), dy = (q[1] - p[1]) * H();
      best = Math.min(best, Math.hypot(dx, dy));
    }
    return best;
  }

  function erase(p) {
    const r = W() * 0.015;
    let changed = false;
    for (let i = strokes.length - 1; i >= 0; i--) {
      if (distToStroke(strokes[i], p) < r) { strokes.splice(i, 1); changed = true; }
    }
    if (changed) redraw();
    return changed;
  }

  // 애플펜슬(또는 손가락 필기 모드)일 때만 화면 스크롤을 막고, 손가락은 스크롤에 양보
  const blockScroll = (e) => {
    const t = opts.getTool();
    if (t.finger || [...e.touches].some((x) => x.touchType === 'stylus')) e.preventDefault();
  };
  canvas.addEventListener('touchstart', blockScroll, { passive: false });
  canvas.addEventListener('touchmove', blockScroll, { passive: false });

  canvas.addEventListener('pointerdown', (e) => {
    const t = opts.getTool();
    const p = pos(e);
    if (t.tool === 'play') {
      let pick = null, best = W() * 0.03;
      for (const st of strokes) { const d = distToStroke(st, p); if (d < best && st.t != null) { best = d; pick = st; } }
      if (pick) opts.onPick(pick);
      return;
    }
    const canDraw = e.pointerType === 'pen' || e.pointerType === 'mouse' || t.finger;
    if (!canDraw) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    if (t.tool === 'eraser') { cur = { erasing: true, changed: erase(p) }; return; }
    cur = { tool: t.tool, color: t.color, w: t.w, t: opts.now(), pts: [p] };
    drawSegment(cur, 0);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!cur) return;
    const evs = e.getCoalescedEvents?.() || [e];
    if (cur.erasing) { for (const ev of evs) cur.changed = erase(pos(ev)) || cur.changed; return; }
    for (const ev of evs) {
      cur.pts.push(pos(ev));
      if (cur.tool !== 'hl') drawSegment(cur, cur.pts.length - 1);
    }
    if (cur.tool === 'hl') { redraw(); drawStroke(cur); }
  });

  function end() {
    if (!cur) return;
    if (cur.erasing) { if (cur.changed) opts.onChange(); }
    else { strokes.push(cur); opts.onChange(); }
    cur = null;
  }
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  return {
    setStrokes(arr) { strokes = arr; redraw(); },
    redraw,
    // 재생 위치에 맞춰 필기 보여주기 (null이면 전부 보통으로)
    setReplayTime(t) {
      const visible = (x) => strokes.filter((st) => !(x != null && st.t != null && st.t > x)).length;
      const changed = (t == null) !== (replayT == null) || visible(t) !== visible(replayT);
      replayT = t;
      if (changed) redraw();
    },
    undo() { if (strokes.length) { strokes.pop(); redraw(); opts.onChange(); } },
  };
}
