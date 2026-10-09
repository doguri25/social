// ===== 모둠 지도 그림 (캔버스): three 판과 바빌론 판이 함께 쓴다 =====
// 이야기 흐름에 따라 상태가 바뀐다
const MAP_W = 1024, MAP_H = 648;
const TEAR = (() => {
  const pts = [];
  for (let i = 0, y = 0; y <= MAP_H + 26; i++, y += 27) pts.push([512 + (i % 2 ? 15 : -13) + Math.sin(y * 0.05) * 9, Math.min(y, MAP_H)]);
  return pts;
})();
const ROADS = [
  [[230, 190], [230, 300], [960, 300]],
  [[230, 300], [230, 360], [170, 360], [170, 425]],
  [[220, 490], [600, 490], [600, 445]],
  [[860, 300], [860, 210]],
  [[860, 300], [860, 452]],
  [[690, 155], [690, 300]],
];
function mapFlags(st) {
  const lvl = ['torn', 'joined', 'taped', 'mended'].includes(st) ? 4 : ['sketch', 'school', 'playground', 'colored', 'scribbled'].indexOf(st);
  return { school: lvl >= 1, playground: lvl >= 2, houses: lvl >= 3, scribble: lvl >= 4, tear: ['joined', 'taped', 'mended'].includes(st), tape: st === 'taped', mended: st === 'mended' };
}
function paintMap(g, st) {
  const f = mapFlags(st);
  g.fillStyle = '#fffdf6';
  g.fillRect(0, 0, MAP_W, MAP_H);
  g.strokeStyle = 'rgba(111,191,238,.2)';
  g.lineWidth = 2;
  g.beginPath();
  for (let x = 32; x < MAP_W; x += 64) { g.moveTo(x, 0); g.lineTo(x, MAP_H); }
  for (let y = 32; y < MAP_H; y += 64) { g.moveTo(0, y); g.lineTo(MAP_W, y); }
  g.stroke();
  const line = (pts, color, w) => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.strokeStyle = color; g.lineWidth = w; g.lineJoin = g.lineCap = 'round';
    g.stroke();
  };
  ROADS.forEach(p => line(p, '#8a8f9c', 30));
  ROADS.forEach(p => line(p, '#fffdf6', 22));
  // 색연필로 빗금 칠하기
  const hatch = (shape, color) => {
    g.save(); shape(); g.clip();
    g.strokeStyle = color; g.lineWidth = 6; g.globalAlpha = .8;
    g.beginPath();
    for (let i = -MAP_H; i < MAP_W; i += 10) { g.moveTo(i, 0); g.lineTo(i + MAP_H * .6, MAP_H); }
    g.stroke();
    g.restore();
  };
  const outline = shape => { shape(); g.strokeStyle = '#4b5263'; g.lineWidth = 4; g.stroke(); };
  const label = (t, x, y, size) => { g.fillStyle = '#232a3d'; g.font = `${size}px Jua, "Apple SD Gothic Neo", sans-serif`; g.textAlign = 'center'; g.fillText(t, x, y); };
  const house = (x, y, s) => () => { g.beginPath(); g.moveTo(x - 50 * s, y); g.lineTo(x - 50 * s, y - 55 * s); g.lineTo(x, y - 95 * s); g.lineTo(x + 50 * s, y - 55 * s); g.lineTo(x + 50 * s, y); g.closePath(); };
  const place = (shape, color, on, text, lx, ly, size) => { if (on) hatch(shape, color); outline(shape); label(text, lx, ly, size); };
  place(() => { g.beginPath(); g.rect(130, 70, 200, 120); }, '#f39c6b', f.school, '학교', 230, 142, 32);
  place(house(170, 520, 1), '#6fbfee', f.mended, '유나네 집', 170, 560, 26);
  place(() => { g.beginPath(); g.rect(620, 60, 140, 95); }, '#ffd36a', f.houses, '햇살유치원', 690, 116, 22);
  place(() => { g.beginPath(); g.ellipse(640, 390, 95, 55, 0, 0, 7); }, '#9ad47f', f.playground, '놀이터', 640, 400, 26);
  place(house(860, 200, .9), '#f497b6', f.houses, '서아네 집', 860, 232, 24);
  place(house(860, 540, .9), '#78c78a', f.houses, '지우네 집', 860, 576, 24);
  if (f.scribble) { // 유나가 서아의 길 위에 쓱쓱 칠한 자국
    g.strokeStyle = 'rgba(80,170,230,.85)'; g.lineWidth = 7; g.lineCap = 'round';
    g.beginPath();
    for (let y = 300; y < 450; y += 12) { g.moveTo(838, y); g.lineTo(882, y + 9); }
    for (let x = 700; x < 850; x += 14) { g.moveTo(x, 286); g.lineTo(x + 11, 316); }
    g.stroke();
  }
  if (f.tear) line(TEAR, '#5a6278', 3);
  if (f.mended) {
    line([[170, 425], [170, 360], [230, 360], [230, 300], [860, 300], [860, 210]], 'rgba(111,191,238,.9)', 14);
    line(TEAR, '#232a3d', 24);
    line(TEAR, '#ffcf3f', 18);
  }
  if (f.tape) [110, 300, 490].forEach(y => {
    g.save(); g.translate(512, y); g.rotate(-.12);
    g.fillStyle = 'rgba(255,255,255,.62)'; g.fillRect(-46, -16, 92, 32);
    g.strokeStyle = 'rgba(140,150,170,.6)'; g.lineWidth = 2; g.strokeRect(-46, -16, 92, 32);
    g.restore();
  });
  g.strokeStyle = '#c9cfdb'; g.lineWidth = 6; g.strokeRect(3, 3, MAP_W - 6, MAP_H - 6);
}
