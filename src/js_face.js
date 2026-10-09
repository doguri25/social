// ===== 얼굴 그림 (캔버스): three 판과 바빌론 판이 함께 쓴다 =====
const FACE_W = 256;
const INK_C = '#2a2433';

// 얼굴은 머리 앞쪽 반구에 붙는 투명 그림. 가운데(128,128)가 머리 정면 가운데.
// 디오라마처럼 멀리서 봐도 보이게 선을 굵게, 눈과 입을 크게 그린다.
function drawFace(g, kind) {
  const L = 88, R = 168, EY = 136, MY = 184;
  g.clearRect(0, 0, FACE_W, FACE_W);
  g.lineCap = g.lineJoin = 'round';
  g.strokeStyle = g.fillStyle = INK_C;
  g.lineWidth = 10;
  const path = fn => { g.beginPath(); fn(); };
  const fill = (c, fn) => { g.fillStyle = c; path(fn); g.fill(); g.fillStyle = INK_C; };
  const eye = (x, y, rx = 14, ry = 19) => {
    fill(INK_C, () => g.ellipse(x, y, rx, ry, 0, 0, 7));
    fill('#fff', () => g.arc(x - rx * .3, y - ry * .38, rx * .36, 0, 7));
  };
  const lidEye = (x, y) => { // 내리깐 눈: 아래 반쪽만
    fill(INK_C, () => { g.ellipse(x, y, 14, 15, 0, 0, Math.PI); g.closePath(); });
    path(() => { g.moveTo(x - 17, y - 1); g.lineTo(x + 17, y + 1); g.stroke(); });
  };
  const happy = (x, y) => path(() => { g.arc(x, y + 10, 17, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); });
  const shut = (x, y) => path(() => { g.arc(x, y - 8, 17, Math.PI * .15, Math.PI * .85); g.stroke(); });
  const brows = (inner, outer, y = EY - 30) => {
    g.lineWidth = 8;
    path(() => { g.moveTo(L - 18, y + outer); g.lineTo(L + 16, y + inner); g.moveTo(R + 18, y + outer); g.lineTo(R - 16, y + inner); g.stroke(); });
    g.lineWidth = 10;
  };
  const blush = (a = .45, big = false) => [L - 10, R + 10].forEach(x => fill(`rgba(255,118,140,${a})`, () => g.ellipse(x, MY - 12, big ? 22 : 17, big ? 12 : 9, 0, 0, 7)));
  const drop = (c, x, y, s = 1) => fill(c, () => { g.moveTo(x, y); g.quadraticCurveTo(x - 9 * s, y + 16 * s, x, y + 20 * s); g.quadraticCurveTo(x + 9 * s, y + 16 * s, x, y); });
  const smile = w => path(() => { g.arc(128, MY - 10, w, Math.PI * .15, Math.PI * .85); g.stroke(); });
  const frown = (w = 18) => path(() => { g.arc(128, MY + 12, w, Math.PI * 1.2, Math.PI * 1.8); g.stroke(); });
  const open = (w, d, tongue = true) => {
    fill(INK_C, () => { g.moveTo(128 - w, MY - 6); g.quadraticCurveTo(128, MY - 6 + d * 2, 128 + w, MY - 6); g.closePath(); });
    if (tongue) fill('#ff8fa3', () => g.ellipse(128, MY - 6 + d * .78, w * .45, d * .28, 0, 0, 7));
  };
  const oval = (rx, ry, y = MY) => fill(INK_C, () => g.ellipse(128, y, rx, ry, 0, 0, 7));
  const wave = (w = 20) => path(() => { g.moveTo(128 - w, MY); g.quadraticCurveTo(128 - w / 2, MY - 7, 128, MY); g.quadraticCurveTo(128 + w / 2, MY + 7, 128 + w, MY); g.stroke(); });
  switch (kind) {
    case 'joy': happy(L, EY); happy(R, EY); open(22, 18); blush(); break;
    case 'laugh': g.lineWidth = 11; happy(L, EY); happy(R, EY); open(28, 25); blush(.55); break;
    case 'sad': brows(-9, 3); eye(L, EY + 4); eye(R, EY + 4); frown(); drop('#6fc3ff', L + 6, EY + 18); break;
    case 'angry':
      brows(11, -6); eye(L, EY + 3, 14, 14); eye(R, EY + 3, 14, 14); frown(20); blush(.3);
      g.strokeStyle = '#e8505b'; g.lineWidth = 5;
      path(() => { [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { g.moveTo(206 + a * 5, 70 + b * 14); g.lineTo(206 + a * 5, 70 + b * 5); g.moveTo(206 + a * 14, 70 + b * 5); g.lineTo(206 + a * 5, 70 + b * 5); }); g.stroke(); });
      break;
    case 'worried': brows(-10, 2); eye(L, EY, 13, 17); eye(R, EY, 13, 17); wave(); drop('#9fd8ff', R + 36, EY - 34, 1.1); break;
    case 'surprised': brows(-4, -4, EY - 46); eye(L, EY, 16, 21); eye(R, EY, 16, 21); oval(12, 16, MY + 2); break;
    case 'shy':
      shut(L, EY); shut(R, EY); blush(.65, true); wave(13);
      g.lineWidth = 3; g.strokeStyle = '#e8708f';
      path(() => { [L - 18, L - 8, R + 4, R + 14].forEach(x => { g.moveTo(x, MY - 4); g.lineTo(x + 6, MY - 18); }); g.stroke(); });
      break;
    case 'hurt': brows(-7, 2); lidEye(L, EY + 4); lidEye(R, EY + 4); path(() => { g.arc(128, MY + 11, 12, Math.PI * 1.25, Math.PI * 1.75); g.stroke(); }); blush(.25); break;
    case 'yawn': shut(L, EY - 4); shut(R, EY - 4); oval(18, 25, MY + 4); drop('#9fd8ff', R + 16, EY - 2, .7); break;
    case 'cry':
      path(() => { g.moveTo(L - 12, EY - 10); g.lineTo(L + 10, EY); g.lineTo(L - 12, EY + 10); g.moveTo(R + 12, EY - 10); g.lineTo(R - 10, EY); g.lineTo(R + 12, EY + 10); g.stroke(); });
      open(24, 20, false);
      [L - 4, R + 4].forEach(x => fill('rgba(111,195,255,.85)', () => g.ellipse(x, EY + 34, 7, 22, 0, 0, 7)));
      break;
    default: eye(L, EY); eye(R, EY); smile(17); blush(.3);
  }
}
