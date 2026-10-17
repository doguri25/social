// ===== 서아 수첩 한 장: 컷 자리에 그리는 그림 (note 컷). 글씨가 또렷하게 보이도록 3D 대신 캔버스로 =====
const NOTE_W = 960, NOTE_H = 600;
const CLASS22 = ['유나', '서아', '지우', '민준', '하준', '도윤', '서준', '예준', '시우', '주원', '하은', '수아', '지아', '서윤', '하린', '아린', '채원', '지호', '은우', '태오', '다은', '윤서'];
const noteCache = {};
function notePage(g, title) {
  g.fillStyle = '#c99a69'; g.fillRect(0, 0, NOTE_W, NOTE_H); // 책상
  g.save();
  g.translate(NOTE_W / 2, NOTE_H / 2);
  g.rotate(-0.015);
  g.fillStyle = 'rgba(60,40,20,.25)'; g.fillRect(-412, -262, 840, 540);
  g.fillStyle = '#fffdf4'; g.fillRect(-420, -270, 840, 540);
  g.strokeStyle = '#bcd7ee'; g.lineWidth = 2;
  for (let y = -190; y < 260; y += 52) { g.beginPath(); g.moveTo(-420, y); g.lineTo(420, y); g.stroke(); }
  g.strokeStyle = '#f2a99a'; g.beginPath(); g.moveTo(-340, -270); g.lineTo(-340, 270); g.stroke();
  for (let x = -380; x <= 380; x += 64) { g.fillStyle = '#8a8f9c'; g.beginPath(); g.arc(x, -270, 11, 0, 7); g.fill(); g.fillStyle = '#c99a69'; g.beginPath(); g.arc(x, -270, 5, 0, 7); g.fill(); }
  g.restore();
  g.save();
  g.translate(NOTE_W / 2 - 420, NOTE_H / 2 - 270); // 이제부터 종이 왼쪽 위가 (0, 0), 종이 840 x 540
  g.rotate(-0.015);
  hand(g, title, 450, 50, 40, '#3b5b8c');
  return g;
}
// 연필 글씨 (왼쪽 맞춤 또는 가운데)
function hand(g, text, x, y, size, color = '#3b302b', left = false) {
  g.font = `${size}px Jua, "Apple SD Gothic Neo", sans-serif`;
  g.fillStyle = color;
  g.textAlign = left ? 'left' : 'center';
  g.textBaseline = 'middle';
  g.fillText(text, x, y);
}
// 작은 코트 그림: 왼쪽 반이 우리 반. names 는 [이름, x, y] (코트 안 좌표 0~1)
function noteCourt(g, x0, y0, w, hh, names, arrow) {
  g.strokeStyle = '#3b302b'; g.lineWidth = 4;
  g.strokeRect(x0, y0, w, hh);
  g.beginPath(); g.moveTo(x0 + w / 2, y0); g.lineTo(x0 + w / 2, y0 + hh); g.stroke();
  const at = {};
  names.forEach(([n, u, v]) => {
    const x = x0 + u * w, y = y0 + v * hh;
    at[n] = [x, y];
    g.fillStyle = n === '유나' || n === '지우' ? '#ffcf3f' : '#ffe9d6';
    g.beginPath(); g.arc(x, y, 15, 0, 7); g.fill();
    g.strokeStyle = '#3b302b'; g.lineWidth = 2; g.stroke();
    hand(g, n, x, y + 27, 19);
  });
  if (arrow && at[arrow[0]] && at[arrow[1]]) {
    const [ax, ay] = at[arrow[0]], [bx, by] = at[arrow[1]];
    g.strokeStyle = '#e8505b'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(ax + 16, ay - 8); g.quadraticCurveTo((ax + bx) / 2, Math.min(ay, by) - 50, bx - 18, by - 10); g.stroke();
    const t = Math.atan2(by - 10 - (Math.min(ay, by) - 50), bx - 18 - (ax + bx) / 2);
    g.beginPath(); g.moveTo(bx - 18, by - 10); g.lineTo(bx - 18 - 18 * Math.cos(t - 0.5), by - 10 - 18 * Math.sin(t - 0.5)); g.moveTo(bx - 18, by - 10); g.lineTo(bx - 18 - 18 * Math.cos(t + 0.5), by - 10 - 18 * Math.sin(t + 0.5)); g.stroke();
  }
}
// 우리 반 스물두 명 자리: 코트 안 열여섯, 밖(상대 코트 뒤) 여섯
function allNames() {
  return CLASS22.map((n, i) => (i < 16 ? [n, 0.07 + (i % 4) * 0.12, 0.15 + Math.floor(i / 4) * 0.23] : [n, 0.9 + ((i - 16) % 2) * 0.08, 0.15 + Math.floor((i - 16) / 2) * 0.33]));
}
const NOTE_PAGES = {
  // 2면, 서아 말을 먼저 들으면: 서아가 알아 온 것
  tips(g) {
    notePage(g, '작전 메모');
    [['1반은 공 받기를 잘한대!', '#3b302b'], ['세게만 던지면 잡힐 수 있음', '#3b302b'], ['→ 밖에 있는 친구에게 패스하기', '#e8505b'], ['→ 공 받을 사람 이름 크게 부르기', '#e8505b']].forEach(([t, c], i) => hand(g, t, 110, 128 + i * 52, 36, c, true));
  },
  // 13면: 월요일 경기 기록. 유나 줄은 세 줄
  record(g, finger) {
    notePage(g, '월요일 1반 경기 (밖에서 본 것)');
    const rows = ['민준 · 춤추다 맞음', '유나 · 던진 공 잡힘 → 1반 1명 다시 들어옴', '유나 · 던진 공 잡힘 → 1반 1명 다시 들어옴', '유나 · 던진 공 잡힘 → 1반 1명 다시 들어옴', '지우 · 끝까지 피함 · 마지막 공 받으려고 함'];
    rows.forEach((t, i) => hand(g, t, 110, 128 + i * 52, 33, '#3b302b', true));
    hand(g, '끝까지 남은 사람: 지우.', 420, 440, 44, '#e8505b');
    g.strokeStyle = '#e8505b'; g.lineWidth = 4; g.beginPath(); g.moveTo(205, 470); g.lineTo(635, 470); g.stroke();
    if (finger) { // 유나 줄 세 개 위에 올린 손가락 (두 줄도 다 못 가린다)
      g.fillStyle = '#ffe2cc'; g.strokeStyle = '#4a3428'; g.lineWidth = 4;
      g.beginPath(); g.roundRect(70, 160, 70, 128, 34); g.fill(); g.stroke();
      g.fillStyle = '#fff3ea'; g.beginPath(); g.ellipse(105, 185, 22, 18, 0, 0, 7); g.fill();
    }
  },
  record2(g) { NOTE_PAGES.record(g, true); },
  // 16·17면: 우리 반 작전판. 스물두 명 이름과 지우가 그린 화살표
  plan(g, arrow = true, title = '우리 반 작전판') {
    notePage(g, title);
    noteCourt(g, 70, 100, 700, 300, allNames(), arrow && ['지우', '유나']);
    hand(g, '공은 서로 보내 주기 · 이름 크게 부르기(민준) · 또 받아 보기(지우)', 420, 455, 28, '#3b5b8c');
  },
  // 다른 길에서 일찍 함께 짠 작전 (화살표 없이)
  plan0(g) { NOTE_PAGES.plan(g, false, '다 같이 짠 작전'); },
  // 16면에서 혼자 정한 작전: 화살표가 모두 유나에게
  boss(g) {
    notePage(g, '유나 작전');
    const names = CLASS22.slice(0, 12).map((n, i) => [n, i ? 0.08 + ((i - 1) % 3) * 0.12 : 0.42, i ? 0.12 + Math.floor((i - 1) / 3) * 0.26 : 0.5]);
    noteCourt(g, 70, 100, 700, 300, names);
    g.strokeStyle = '#3b302b'; g.lineWidth = 3;
    names.slice(1).forEach(([, u, v]) => { g.beginPath(); g.moveTo(70 + u * 700 + 16, 100 + v * 300); g.lineTo(70 + 0.42 * 700 - 18, 100 + 0.5 * 300); g.stroke(); });
    hand(g, '공 잡으면 무조건 유나에게!', 420, 455, 34, '#e8505b');
  },
};
function noteImg(kind) {
  if (noteCache[kind]) return noteCache[kind];
  const c = document.createElement('canvas');
  c.width = NOTE_W;
  c.height = NOTE_H;
  const g = c.getContext('2d');
  NOTE_PAGES[kind](g);
  g.restore();
  return (noteCache[kind] = c.toDataURL('image/jpeg', 0.9));
}
