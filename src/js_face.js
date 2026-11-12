// ===== 얼굴 그림 (캔버스): 애니메이션풍 큰 눈. 머리 앞쪽에 붙는 투명 그림 =====
const FACE_W = 256;
const INK_C = '#2a2433';

// 가운데(128,128)가 머리 정면 가운데.
// closed: 눈 깜빡임 — 뜬 눈만 감은 눈으로 바꿔 그린다 (눈썹, 입은 그대로)
// o.eye: 눈동자 색, o.brow: 눈썹 색, o.talk: 0~1 말하는 입 (애니메이션에서만)
function drawFace(g, kind, closed = false, o = {}) {
  const L = 90, R = 166, EY = 144, MY = 196;
  const IRIS = o.eye || '#553220', BROW = o.brow || '#4a3326';
  g.clearRect(0, 0, FACE_W, FACE_W);
  g.lineCap = g.lineJoin = 'round';
  g.strokeStyle = g.fillStyle = INK_C;
  g.lineWidth = 6;
  const path = fn => { g.beginPath(); fn(); };
  const fill = (c, fn) => { g.fillStyle = c; path(fn); g.fill(); g.fillStyle = INK_C; };
  const line = (w, c, fn) => { g.lineWidth = w; g.strokeStyle = c; path(fn); g.stroke(); g.strokeStyle = INK_C; g.lineWidth = 6; };
  const shade = (c, k) => { const n = parseInt(c.slice(1), 16), f = v => Math.round(clamp(v * k, 0, 255)); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
  // 감은 눈: 속눈썹 선 하나. up 이면 웃는 눈(∩), 아니면 내리감은 눈(∪)
  const lidLine = (x, y, up) => line(7, INK_C, () => { if (up) g.arc(x, y + 12, 21, Math.PI * 1.14, Math.PI * 1.86); else g.arc(x, y - 12, 21, Math.PI * .14, Math.PI * .86); });
  // 뜬 눈. s: 크기, lid: 윗눈꺼풀이 덮는 정도(0~1), small: 놀란 작은 눈동자, wet: 글썽임
  const eye = (x, y, { s = 1, lid = 0, small = false, wet = false, slant = 0 } = {}) => {
    if (closed) return lidLine(x, y + 4, false);
    const rx = 20 * s, ry = 26 * s, side = x < 128 ? -1 : 1;
    g.save();
    path(() => g.ellipse(x, y, rx, ry, 0, 0, 7));
    g.clip();
    g.fillStyle = '#fffdf8'; g.fillRect(x - rx, y - ry, rx * 2, ry * 2);
    const k = small ? 0.62 : 1, ix = rx * 0.86 * k, iy = ry * 0.9 * k;
    const gr = g.createLinearGradient(0, y - iy, 0, y + iy);
    gr.addColorStop(0, shade(IRIS, 0.45)); gr.addColorStop(0.5, IRIS); gr.addColorStop(1, shade(IRIS, 1.55));
    g.fillStyle = gr; path(() => g.ellipse(x, y + ry * 0.06, ix, iy, 0, 0, 7)); g.fill();
    g.fillStyle = shade(IRIS, 0.28); path(() => g.ellipse(x, y, ix * 0.45, iy * 0.5, 0, 0, 7)); g.fill();
    g.fillStyle = 'rgba(30,18,30,.30)'; g.fillRect(x - rx, y - ry, rx * 2, ry * 0.42); // 윗눈꺼풀 그늘
    g.fillStyle = '#fff';
    path(() => g.ellipse(x - rx * 0.32, y - ry * 0.34, rx * 0.3, ry * 0.26, -0.4, 0, 7)); g.fill();
    path(() => g.arc(x + rx * 0.36, y + ry * 0.42, rx * (wet ? 0.24 : 0.15), 0, 7)); g.fill();
    if (wet) { g.fillStyle = 'rgba(255,255,255,.75)'; path(() => g.arc(x - rx * 0.1, y + ry * 0.55, rx * 0.16, 0, 7)); g.fill(); }
    if (lid > 0) { g.fillStyle = '#ffe2cc'; path(() => { g.moveTo(x - rx - 2, y - ry - 2); g.lineTo(x + rx + 2, y - ry - 2); g.lineTo(x + rx + 2, y - ry + ry * 2 * lid - slant * side * 8); g.lineTo(x - rx - 2, y - ry + ry * 2 * lid + slant * side * 8); }); g.fill(); }
    g.restore();
    // 윗속눈썹 (굵게, 바깥 끝이 살짝 올라감), 아래 선은 가늘게
    const top = y - ry + ry * 2 * lid;
    if (lid > 0) line(7, INK_C, () => { g.moveTo(x - rx - 2, top + slant * side * 8); g.lineTo(x + rx + 2, top - slant * side * 8); });
    else line(7, INK_C, () => { g.ellipse(x, y, rx + 1, ry + 1, 0, Math.PI * 1.08, Math.PI * 1.92); });
    line(5, INK_C, () => { g.moveTo(x + side * (rx + 1), y - ry * 0.3 + (lid > 0 ? ry * lid : 0)); g.lineTo(x + side * (rx + 8), y - ry * 0.55 + (lid > 0 ? ry * lid : 0)); });
    line(2.5, 'rgba(60,40,45,.55)', () => g.ellipse(x, y, rx, ry, 0, Math.PI * 0.2, Math.PI * 0.8));
  };
  const happy = (x, y) => lidLine(x, y, true);
  const brows = (inner, outer, y = EY - 42) => line(4.5, BROW, () => { g.moveTo(L - 20, y + outer); g.quadraticCurveTo(L, y + (inner + outer) / 2 - 3, L + 18, y + inner); g.moveTo(R + 20, y + outer); g.quadraticCurveTo(R, y + (inner + outer) / 2 - 3, R - 18, y + inner); });
  const blush = (a = .4, big = false) => [L - 6, R + 6].forEach(x => {
    const gr = g.createRadialGradient(x, MY - 22, 2, x, MY - 22, big ? 30 : 24);
    gr.addColorStop(0, `rgba(255,120,130,${a})`); gr.addColorStop(1, 'rgba(255,120,130,0)');
    g.fillStyle = gr; g.fillRect(x - 32, MY - 54, 64, 64); g.fillStyle = INK_C;
  });
  const drop = (c, x, y, s = 1) => fill(c, () => { g.moveTo(x, y); g.quadraticCurveTo(x - 9 * s, y + 16 * s, x, y + 20 * s); g.quadraticCurveTo(x + 9 * s, y + 16 * s, x, y); });
  const nose = () => line(3, 'rgba(190,110,90,.55)', () => { g.moveTo(126, MY - 30); g.lineTo(130, MY - 27); });
  const smile = w => line(5, '#7a3b33', () => g.arc(128, MY - 14, w, Math.PI * .18, Math.PI * .82));
  const frown = (w = 14) => line(5, '#7a3b33', () => g.arc(128, MY + 10, w, Math.PI * 1.22, Math.PI * 1.78));
  const open = (w, d, tongue = true) => {
    fill('#7a2f2f', () => { g.moveTo(128 - w, MY - 8); g.quadraticCurveTo(128, MY - 12, 128 + w, MY - 8); g.quadraticCurveTo(128, MY - 8 + d * 2, 128 - w, MY - 8); });
    if (tongue) fill('#ff8fa3', () => g.ellipse(128, MY - 8 + d * .72, w * .5, d * .26, 0, 0, 7));
    fill('#fff', () => { g.moveTo(128 - w * 0.7, MY - 8); g.quadraticCurveTo(128, MY - 10, 128 + w * 0.7, MY - 8); g.quadraticCurveTo(128, MY - 2, 128 - w * 0.7, MY - 8); });
  };
  const oval = (rx, ry, y = MY) => fill('#7a2f2f', () => g.ellipse(128, y, rx, ry, 0, 0, 7));
  const wave = (w = 16) => line(5, '#7a3b33', () => { g.moveTo(128 - w, MY - 4); g.quadraticCurveTo(128 - w / 2, MY - 10, 128, MY - 4); g.quadraticCurveTo(128 + w / 2, MY + 2, 128 + w, MY - 4); });
  const talk = o.talk || 0; // 말하는 입: 닫힌 입 대신 작게 벌린다
  const mouth = fn => { if (talk > 0.08) oval(8 + talk * 4, 3 + talk * 9, MY - 4); else fn(); };
  nose();
  switch (kind) {
    case 'joy': brows(-2, 0); eye(L, EY); eye(R, EY); open(17, 13 + talk * 4); blush(.5); break;
    case 'laugh': brows(-4, -2, EY - 46); happy(L, EY); happy(R, EY); open(23, 19 + talk * 4); blush(.6); break;
    case 'sad': brows(-9, 4); eye(L, EY + 4, { lid: .22, wet: true }); eye(R, EY + 4, { lid: .22, wet: true }); mouth(() => frown()); drop('#6fc3ff', L + 12, EY + 34); break;
    case 'angry':
      brows(12, -6, EY - 38); eye(L, EY + 3, { lid: .26, slant: 1 }); eye(R, EY + 3, { lid: .26, slant: 1 }); mouth(() => frown(16)); blush(.3);
      line(4.5, '#e8505b', () => { [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { g.moveTo(216 + a * 5, 62 + b * 14); g.lineTo(216 + a * 5, 62 + b * 5); g.moveTo(216 + a * 14, 62 + b * 5); g.lineTo(216 + a * 5, 62 + b * 5); }); });
      break;
    case 'worried': brows(-10, 3); eye(L, EY, { s: .94, wet: true }); eye(R, EY, { s: .94, wet: true }); mouth(() => wave()); drop('#9fd8ff', R + 40, EY - 40, 1.1); break;
    case 'surprised': brows(-4, -4, EY - 52); eye(L, EY, { s: 1.08, small: true }); eye(R, EY, { s: 1.08, small: true }); oval(9, 12, MY); break;
    case 'shy':
      lidLine(L, EY + 4, false); lidLine(R, EY + 4, false); blush(.75, true); mouth(() => wave(11));
      line(2.5, '#e8708f', () => { [L - 18, L - 8, R + 4, R + 14].forEach(x => { g.moveTo(x, MY - 16); g.lineTo(x + 6, MY - 30); }); });
      break;
    case 'hurt': brows(-8, 3); eye(L, EY + 4, { lid: .42 }); eye(R, EY + 4, { lid: .42 }); mouth(() => frown(10)); blush(.25); break;
    case 'yawn': lidLine(L, EY, false); lidLine(R, EY, false); oval(14, 20, MY); drop('#9fd8ff', R + 22, EY + 2, .7); break;
    case 'cry':
      brows(-10, 4);
      line(7, INK_C, () => { g.moveTo(L - 18, EY - 8); g.lineTo(L + 14, EY + 2); g.lineTo(L - 18, EY + 12); g.moveTo(R + 18, EY - 8); g.lineTo(R - 14, EY + 2); g.lineTo(R + 18, EY + 12); });
      open(20, 17, false);
      [L - 2, R + 2].forEach(x => fill('rgba(111,195,255,.85)', () => g.ellipse(x, EY + 36, 6, 20, 0, 0, 7)));
      break;
    default: brows(-1, 0); eye(L, EY); eye(R, EY); mouth(() => smile(13)); blush(.32);
  }
}
