// ===== 무대(디오라마): 둥근 나무 받침 위 작은 세트. 처음 쓸 때 만들고, 한 번에 하나만 보인다 =====
// 방은 벽 네 개를 묶음으로 만들어, 카메라 쪽 벽은 저절로 걷힌다(js_world 의 벽 자르기). 자리와 카메라 값은 data/defs.json
const WALL_H = 2.5, WALL_T = 0.12, SILL = 0.85, TABLE_H = 0.56; // 2등신 아이에게 맞춘 낮은 모둠 탁자
const WALL_C = '#f8efdf', WAINS_C = '#ecd6b2', RAIL_C = '#d6b084', WOOD = '#e3bf8f', FRAME = '#ffffff';

// ---- 공통 ----
function stageBase(g, w, d) {
  ink(roundSlab(w + 1.3, d + 1.3, 0.75, 0.34, -0.2, '#d2a576', g), 0.012);
  roundSlab(w + 1.0, d + 1.0, 0.6, 0.04, -0.025, '#efd6b0', g);
}
// 바닥 타일 그림 (한 장에 n x n 칸), cell: 한 칸 크기(m)
function floorTiles(g, w, d, a, b, line, cell = 0.5, n = 4) {
  const t = canvasTex(512, 512, (c, W) => {
    const s = W / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { c.fillStyle = (i + j) % 2 ? a : b; c.fillRect(i * s, j * s, s, s); }
    c.fillStyle = line;
    for (let i = 0; i <= n; i++) { c.fillRect(i * s - 2, 0, 4, W); c.fillRect(0, i * s - 2, W, 4); }
  });
  t.uScale = w / (cell * n);
  t.vScale = d / (cell * n);
  return lay(w, d, t, 0, 0, 0, g);
}
// 방: 바닥 + 네 벽 묶음 (벽 묶음 안에서 x 는 벽을 따라, +z 는 방 안쪽)
function room(g, w, d) {
  return {
    back: wallGroup(g, 'back', 0, -d / 2 - WALL_T / 2),
    left: wallGroup(g, 'left', -w / 2 - WALL_T / 2, 0),
    right: wallGroup(g, 'right', w / 2 + WALL_T / 2, 0),
    front: wallGroup(g, 'front', 0, d / 2 + WALL_T / 2),
  };
}
function plainWall(wg, len, color = WALL_C) { box(len + WALL_T * 2, WALL_H, WALL_T, color, 0, WALL_H / 2, 0, wg, false); }
function wainscot(wg, len) {
  box(len, SILL, 0.02, WAINS_C, 0, SILL / 2, WALL_T / 2 + 0.01, wg, false);
  box(len, 0.05, 0.05, RAIL_C, 0, SILL, WALL_T / 2 + 0.025, wg, false);
}
// 창 난 벽: wins 는 벽 묶음 x 범위 [[x0, x1], …]. 창틀과 창살, 창밖 그림(out)까지
function windowWall(wg, len, wins, sill, top, out, color = WALL_C) {
  const full = len + WALL_T * 2;
  box(full, sill, WALL_T, color, 0, sill / 2, 0, wg, false);
  box(full, WALL_H - top, WALL_T, color, 0, (WALL_H + top) / 2, 0, wg, false);
  const edges = [-full / 2, ...wins.slice().sort((a, b) => a[0] - b[0]).flat(), full / 2];
  for (let i = 0; i < edges.length; i += 2) box(edges[i + 1] - edges[i], top - sill, WALL_T, color, (edges[i] + edges[i + 1]) / 2, (sill + top) / 2, 0, wg, false);
  const hm = (sill + top) / 2, wh = top - sill;
  wins.forEach(([x0, x1]) => {
    const xm = (x0 + x1) / 2, ww = x1 - x0;
    box(ww + 0.12, 0.04, 0.2, FRAME, xm, sill + 0.02, 0.06, wg);
    box(ww, 0.05, 0.08, FRAME, xm, top - 0.025, 0, wg, false);
    [x0 + 0.025, x1 - 0.025, xm].forEach(x => box(0.05, wh, 0.07, FRAME, x, hm, 0, wg, false));
    box(ww, 0.04, 0.06, FRAME, xm, hm + 0.1, 0, wg, false);
  });
  if (out) sheet(full, WALL_H * 0.75, out, 0, (sill + top) / 2 + 0.1, -0.9, 0, wg, { glow: true });
}
// 창밖 그림: 하늘, 구름, 먼 건물, 나무 (밤이면 달과 별)
function outsideTex(night) {
  return canvasTex(1024, 420, (c, W, H) => {
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, night ? '#1f2850' : '#a9dcf7');
    sky.addColorStop(0.7, night ? '#3a4577' : '#e3f4fb');
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    if (night) {
      c.fillStyle = '#fff4c2';
      for (let i = 0; i < 60; i++) { c.globalAlpha = 0.4 + Math.random() * 0.6; c.beginPath(); c.arc(Math.random() * W, Math.random() * H * 0.7, 1.5 + Math.random() * 2, 0, 7); c.fill(); }
      c.globalAlpha = 1;
      c.beginPath(); c.arc(640, 110, 46, 0, 7); c.fill();
      c.fillStyle = '#1f2850'; c.beginPath(); c.arc(662, 96, 42, 0, 7); c.fill();
    } else {
      c.fillStyle = 'rgba(255,255,255,.9)';
      [[160, 70], [520, 50], [820, 90]].forEach(([x, y]) => [0, 34, 70].forEach((dx, k) => { c.beginPath(); c.arc(x + dx, y + (k === 1 ? -14 : 0), k === 1 ? 32 : 24, 0, 7); c.fill(); }));
    }
    [['#f6c7a7', 60, 170, 120, 250], ['#d8e6f2', 230, 200, 90, 220], ['#f2dfb4', 690, 160, 140, 260], ['#cfe5d2', 880, 210, 100, 210]].forEach(([col, x, y, w, h]) => {
      c.fillStyle = night ? '#2c3460' : col; c.fillRect(x, y, w, h);
      c.fillStyle = night ? 'rgba(255,214,120,.8)' : 'rgba(255,255,255,.7)';
      for (let yy = y + 20; yy < y + h - 20; yy += 40) for (let xx = x + 15; xx < x + w - 20; xx += 34) if (!night || (xx + yy) % 3) c.fillRect(xx, yy, 18, 22);
    });
    c.fillStyle = night ? '#2a3b40' : '#a8d48d'; c.fillRect(0, H - 60, W, 60);
    [[110, 300, 70], [380, 290, 90], [600, 310, 60], [950, 300, 80], [780, 320, 55]].forEach(([x, y, r]) => {
      c.fillStyle = night ? '#23302f' : '#9b6b43'; c.fillRect(x - 8, y, 16, H - y);
      c.fillStyle = night ? '#2f4a3c' : '#74bf6e'; c.beginPath(); c.arc(x, y - r * 0.3, r, 0, 7); c.fill();
    });
  });
}
// 종이 한 장 (포스터, 간판): 글 줄마다 [글, 크기, 색]
function paper(w, h, lines, bg = '#fffaf0', border = '#e8c9a0') {
  return canvasTex(Math.round(w * 500), Math.round(h * 500), (c, W, H) => {
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    if (border) { c.strokeStyle = border; c.lineWidth = 10; c.strokeRect(5, 5, W - 10, H - 10); }
    const gap = H / (lines.length + 1);
    lines.forEach(([t, size, col], i) => write(c, t, W / 2, gap * (i + 1), size, col));
  });
}
const PENCIL_COLS = ['#e8505b', '#f39c6b', '#ffcf3f', '#78c78a', '#6fbfee', '#5b6ee8', '#b48ad8', '#f497b6'];
function pencilMesh(color, len = 0.17, r = 0.0055) {
  const p = put(MB.CreateCylinder('pencil', { diameter: r * 2, height: len, tessellation: 6 }, scene), color, 0, 0, 0, null, false);
  const tip = put(MB.CreateCylinder('tip', { diameterTop: 0, diameterBottom: r * 2, height: 0.025, tessellation: 6 }, scene), '#f6d9b0', 0, len / 2 + 0.0125, 0, p, false);
  tip.isPickable = false;
  return p;
}

// ---- 손에 드는 소품: 피구공, 서아 수첩, 민준이 숟가락 ----
// set.ball / set.note / set.spoon: 인물 id 면 그 아이 손(공은 'id:hug' 면 품에), 무대 defs.balls 의 이름이면 그 자리, 없으면 숨김
const PROPS = {};
function makeProp(kind) {
  const n = node(kind);
  let m;
  if (kind === 'ball') {
    m = ball(0.085, texMat(canvasTex(256, 128, (c, w, hh) => {
      c.fillStyle = '#e8505b'; c.fillRect(0, 0, w, hh);
      c.strokeStyle = '#fff3e6'; c.lineWidth = 5;
      [0.25, 0.75].forEach(k => { c.beginPath(); c.moveTo(w * k, 0); c.bezierCurveTo(w * k + 30, hh * 0.35, w * k - 30, hh * 0.65, w * k, hh); c.stroke(); });
      c.beginPath(); c.moveTo(0, hh / 2); c.lineTo(w, hh / 2); c.stroke();
    })), 0, 0, 0, n, 20);
  } else if (kind === 'note') {
    m = box(0.11, 0.15, 0.018, '#ffcf3f', 0, 0, 0, n);
    box(0.1, 0.14, 0.012, '#ffffff', 0.006, 0, 0.004, m, false);
  } else {
    m = cyl(0.006, 0.006, 0.13, '#c9ced6', 0, -0.065, 0, n, 8);
    ball(0.02, '#c9ced6', 0, -0.135, 0.004, n, 10).scaling.set(1, 1.3, 0.5);
  }
  hull(m, 0.004).layerMask = 1;
  n.setEnabled(false);
  return (PROPS[kind] = n);
}
const HELD = {
  ball: (c, how) => (how === 'hug' ? [c.body, 0, c.D.torsoY + 0.03, c.D.torsoR + 0.1] : [c.armA.hand, 0, -0.08, 0.03]),
  note: c => [c.armA.hand, 0, -0.06, 0.03],
  spoon: c => [c.head, 0, c.r * 0.9, c.r * 1.07],
};
function setProp(kind, v) {
  const n = PROPS[kind] || makeProp(kind);
  const [id, how] = String(v || 'none').split(':');
  const c = CH[id], at = stageNow.def.balls && stageNow.def.balls[id];
  if (c && shown(c)) {
    const [parent, x, y, z] = HELD[kind](c, how);
    n.parent = parent;
    n.position.set(x, y, z);
  } else if (at) {
    n.parent = stageNow.root;
    n.position.set(...at);
  } else return n.setEnabled(false);
  n.getChildMeshes().forEach(m => { m.layerMask = c && shown(c) ? c.mask : 1; }); // 든 소품은 그 아이와 같은 층: 컷에서 아이를 빼면 소품도 빠진다
  n.setEnabled(true);
}

// ---- 배경 아이 무리: defs 의 crowds 에 적은 자리마다 굳힌 아이. 처음 쓸 때 만든다 ----
function setCrowd(s, name) {
  s.crowds = s.crowds || {};
  if (name && !s.crowds[name]) {
    const g = node('crowd-' + name, s.root);
    const list = s.def.crowds[name];
    g.kids = list.map((spot, k) => makeExtra(spot, k + name.length, g));
    s.crowds[name] = g;
  }
  for (const k in s.crowds) s.crowds[k].setEnabled(k === name);
  s.kids = name ? s.crowds[name].kids : [];
}

// ---- 무대별 세트 ----
const BUILD = {
  // 책장 앞: 다섯 권의 그림책
  shelf(s) {
    const g = s.root;
    stageBase(g, 6, 3);
    floorTiles(g, 6, 3, '#ecd9b8', '#e6d1ad', '#d6bd94', 0.4);
    const back = wallGroup(g, 'back', 0, -1.56);
    plainWall(back, 6, '#eaf0f6');
    wainscot(back, 6);
    const W = '#c08a58';
    box(3.4, 0.1, 0.55, W, 0, 0.05, -0.75, g);
    box(3.4, 0.08, 0.55, W, 0, 0.75, -0.75, g);
    box(3.4, 0.08, 0.55, W, 0, 1.7, -0.75, g);
    [-1.65, 1.65].forEach(x => box(0.1, 1.75, 0.55, W, x, 0.87, -0.75, g));
    box(3.4, 1.75, 0.05, '#d9b48a', 0, 0.87, -1.0, g);
    const titles = SPINES.map((col, i) => { const B = STORIES[bookIds()[i]]; return [B && i < 4 ? B.title : '이후의 이야기', col]; });
    s.books = titles.map(([title, col], i) => {
      const x = -1.08 + i * 0.54;
      ink(box(0.34, 0.86, 0.44, col, x, 1.22, -0.72, g), 0.006);
      sheet(0.26, 0.78, canvasTex(96, 288, (c, w, hh) => {
        c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(8, 8, w - 16, hh - 16);
        write(c, String(i + 1), w / 2, 40, 30, '#3b302b');
        [...title.replace(/\s/g, '')].slice(0, 8).forEach((ch, k) => write(c, ch, w / 2, 84 + k * 24, 22, '#3b302b'));
      }), x, 1.22, -0.485, 0, g); // 책등 그림은 윤곽선 깊이(6mm) 밖에 있도록 책 앞면보다 1.5cm 앞에
      return { i, title, pos: V3(x, 1.22, -0.45) };
    });
    model('rugRound', { w: 2.4, d: 1.4, x: 0, z: 0.6, color: { carpet: '#f2b5c8', carpetDarker: '#e8708f' }, cast: false, parent: g });
    model('pottedPlant', { h: 1.0, x: 2.5, z: -1.0, parent: g });
    model('plantSmall2', { h: 0.4, x: -2.6, z: -1.1, parent: g });
  },

  // 교실: 둥근 모둠 탁자(set.circle 이면 치우고 의자 열 개를 둥글게), 칠판과 대진표(뒤), 창(왼쪽), 문과 약속판(오른쪽), 사물함(앞)
  classroom(s) {
    const g = s.root, W = 6, D = 5;
    stageBase(g, W, D);
    floorTiles(g, W, D, '#f6ead4', '#f1e2c6', '#e2cfac');
    const r = room(g, W, D);
    // 왼쪽 벽의 창 (바닥 좌표 z 범위). 벽 묶음 x 는 -z 방향이라 뒤집어 쓴다
    const WIN_TOP = 2.15, WINS = [[-2.15, -1.05], [-0.75, 0.35], [0.65, 1.75]];
    sunPatches(g, W, D, WINS, SILL, WIN_TOP);

    // 뒤 벽
    const b = r.back;
    plainWall(b, W);
    wainscot(b, W);
    box(2.3, 1.15, 0.05, '#c99a69', -0.35, 1.6, 0.08, b, false);
    sheet(2.16, 0.98, canvasTex(1024, 464, (c, w, h) => {
      c.fillStyle = '#2f5d50'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(255,255,255,${0.015 + Math.random() * 0.025})`; c.fillRect(Math.random() * w, Math.random() * h, 60 + Math.random() * 200, 8 + Math.random() * 30); }
      write(c, '3학년 피구 대회', 330, 80, 74, 'rgba(250,250,240,.92)');
      write(c, '월요일  2반 : 1반', 300, 200, 56, 'rgba(250,250,240,.88)');
      write(c, '금요일  2반 : 3반', 300, 300, 56, 'rgba(250,250,240,.88)');
      c.strokeStyle = 'rgba(250,250,240,.85)'; c.lineWidth = 5;
      c.strokeRect(640, 150, 300, 200); c.beginPath(); c.moveTo(790, 150); c.lineTo(790, 350); c.stroke(); // 코트
      c.beginPath(); c.arc(720, 250, 26, 0, 7); c.stroke();
      write(c, '시간이 끝났을 때 더 많이 남은 반이 이겨요', 512, 410, 34, 'rgba(255,236,150,.9)');
    }), -0.35, 1.6, 0.111, 0, b);
    box(2.3, 0.035, 0.1, '#c99a69', -0.35, 1.0, 0.11, b, false);
    sheet(0.56, 0.76, paper(0.56, 0.76, [['함께', 64, '#e8705a'], ['만드는', 56, '#3b302b'], ['좋은 교실', 54, '#3f9c7d']]), -2.25, 1.68, 0.075, 0, b);
    // 게시판: 우리 반 이름표와 피구 대회 포스터
    box(1.55, 1.05, 0.03, '#d9ae78', 1.85, 1.45, 0.075, b, false);
    sheet(1.5, 0.2, paper(1.5, 0.2, [['우리 반 스물두 명', 50, '#3b302b']], '#fff6d6', null), 1.85, 2.12, 0.075, 0, b);
    sheet(1.4, 0.78, canvasTex(700, 390, (c, w, hh) => {
      c.fillStyle = '#fffaf0'; c.fillRect(0, 0, w, hh);
      const cols = ['#f6a5a5', '#ffd98a', '#9fd6b5', '#c7b2e6', '#f7c59f', '#a5d8f6'];
      for (let i = 0; i < 22; i++) {
        const x = 40 + (i % 8) * 88, y = 40 + Math.floor(i / 8) * 120;
        c.fillStyle = cols[i % 6]; c.beginPath(); c.arc(x + 20, y + 30, 30, 0, 7); c.fill();
        c.fillStyle = '#3b302b'; c.fillRect(x - 6, y + 70, 52, 8);
      }
    }), 1.85, 1.38, 0.09, 0, b);
    [-1.75, -0.45, 0.85].forEach(x => {
      model('bookcaseOpen', { w: 1.25, h: 0.8, d: 0.36, x, z: 0.26, parent: b, color: { wood: WOOD }, ink: 0.005 });
      model('books', { h: 0.15, x: x - 0.3, y: 0.8, z: 0.26, parent: b, ry: 10 });
    });
    model('plantSmall2', { h: 0.26, x: -0.95, y: 0.8, z: 0.26, parent: b });
    const bun = node('bunny', b, -0.7, 0.8, 0.27);
    ball(0.055, '#ffffff', 0, 0.055, 0, bun); ball(0.042, '#ffffff', 0, 0.14, 0.01, bun);
    [-0.018, 0.018].forEach(x => { cyl(0.012, 0.014, 0.08, '#ffe4ec', x, 0.2, 0, bun).rotation.z = x * 6; });
    const globe = node('globe', b, -2.1, 0.8, 0.26);
    cyl(0.07, 0.09, 0.03, '#c99a69', 0, 0.015, 0, globe);
    cyl(0.008, 0.008, 0.1, '#8a7a6a', 0, 0.07, 0, globe);
    ball(0.11, texMat(canvasTex(256, 128, (c, w, h) => {
      c.fillStyle = '#7cc3ea'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#8fd17d';
      [[40, 50, 30, 22], [70, 85, 18, 26], [140, 45, 40, 20], [150, 80, 16, 22], [210, 60, 26, 18]].forEach(([x, y, rx, ry]) => { c.beginPath(); c.ellipse(x, y, rx, ry, 0.4, 0, 7); c.fill(); });
    })), 0, 0.22, 0, globe).rotation.z = 0.4;
    [['#bfe3f5', -0.1], ['#f8d3a5', 0.25]].forEach(([c, x]) => box(0.3, 0.16, 0.24, c, x, 0.88, 0.25, b));
    const bin = node('bin', b, 2.55, 0, 0.32);
    cyl(0.17, 0.15, 0.42, '#a9dbe9', 0, 0.21, 0, bin);
    model('pottedPlant', { h: 0.95, x: -2.62, z: 0.33, parent: b });

    // 왼쪽 벽: 창 셋, 창턱 화분, 창 아래 낮은 책장과 곰 인형
    const l = r.left;
    windowWall(l, D, WINS.map(([z0, z1]) => [-z1, -z0]), SILL, WIN_TOP, outsideTex(false));
    wainscot(l, D);
    WINS.forEach(([z0, z1], i) => { if (i !== 1) model('plantSmall2', { h: 0.24, x: -(z0 + z1) / 2 + (i ? -0.3 : 0.3), y: SILL + 0.04, z: 0.08, parent: l }); });
    [1.55, 0.2, -1.15].forEach(x => model('bookcaseOpen', { w: 1.2, h: 0.7, d: 0.34, x, z: 0.3, parent: l, color: { wood: WOOD }, ink: 0.005 }));
    model('books', { h: 0.14, x: 0.4, y: 0.7, z: 0.3, ry: -10, parent: l });
    model('bear', { h: 0.3, x: -1.45, y: 0.7, z: 0.3, ry: 10, parent: l });
    model('pottedPlant', { h: 0.55, x: -0.75, y: 0.7, z: 0.3, parent: l });

    // 오른쪽 벽: 문, 우리 반 약속, 키 큰 책장
    const rt = r.right;
    plainWall(rt, D);
    wainscot(rt, D);
    box(1.02, 2.08, 0.04, RAIL_C, 1.45, 1.04, 0.07, rt, false);
    box(0.92, 2.0, 0.04, '#e9b783', 1.45, 1.0, 0.09, rt, false);
    box(0.4, 0.5, 0.03, '#cfe9f5', 1.45, 1.45, 0.115, rt, false);
    ball(0.035, '#c9a227', 1.1, 1.0, 0.13, rt);
    sheet(1.7, 1.0, canvasTex(680, 400, (c, w, h) => {
      c.fillStyle = '#d9ae78'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#a97a49'; c.lineWidth = 18; c.strokeRect(9, 9, w - 18, h - 18);
      write(c, '우리 반 약속', w / 2, 62, 48, '#3b302b');
      [['먼저 물어보기', '#fff3b8', 40, 110], ['고운 말 쓰기', '#cfeedd', 350, 120], ['차례 지키기', '#fde0d8', 60, 245], ['마음 들어 주기', '#d9e9fb', 360, 250]].forEach(([t, col, x, y], i) => {
        c.save(); c.translate(x + 135, y + 55); c.rotate((i % 2 ? 1 : -1) * 0.04);
        c.fillStyle = col; c.fillRect(-135, -55, 270, 110);
        write(c, t, 0, 4, 38, '#3b302b');
        c.fillStyle = '#e8705a'; c.beginPath(); c.arc(0, -46, 8, 0, 7); c.fill();
        c.restore();
      });
    }), -0.55, 1.5, 0.075, 0, rt);
    model('bookcaseOpen', { w: 0.95, h: 1.55, d: 0.36, x: -1.85, z: 0.26, parent: rt, color: { wood: WOOD }, ink: 0.005 });
    model('books', { h: 0.15, x: -1.85, y: 1.55, z: 0.26, parent: rt });
    model('pottedPlant', { h: 0.85, x: 0.35, z: 0.35, parent: rt });

    // 앞 벽: 사물함, 시계, 반 이름
    const f = r.front;
    plainWall(f, W);
    wainscot(f, W);
    const cub = node('cubby', f, -0.6, 0, 0.26);
    box(2.6, 0.8, 0.36, WOOD, 0, 0.4, 0, cub);
    const cols = ['#bfe3f5', '#fde0d8', '#cfeedd', '#fff3b8', '#e9def7', '#f8d3a5'];
    for (let k = 0; k < 2; k++) for (let i = 0; i < 6; i++) box(0.36, 0.28, 0.06, cols[(i + k * 2) % 6], -1.05 + i * 0.42, 0.22 + k * 0.38, 0.17, cub, false);
    sheet(0.42, 0.42, canvasTex(256, 256, c => {
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(128, 128, 120, 0, 7); c.fill();
      c.lineWidth = 14; c.strokeStyle = '#e8705a'; c.stroke();
      c.fillStyle = '#3b302b';
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; c.beginPath(); c.arc(128 + Math.sin(a) * 92, 128 - Math.cos(a) * 92, 6, 0, 7); c.fill(); }
      c.lineWidth = 10; c.lineCap = 'round'; c.strokeStyle = '#3b302b';
      c.beginPath(); c.moveTo(128, 128); c.lineTo(128, 62); c.moveTo(128, 128); c.lineTo(178, 140); c.stroke();
    }, true), 1.7, 1.95, 0.075, 0, f);
    sheet(1.1, 0.34, paper(1.1, 0.34, [['3학년 2반', 64, '#2f6b55']], '#fff6d6'), -0.6, 1.55, 0.075, 0, f);

    // 모둠 탁자 (높이 0.64, 지름 1.44)와 의자 넷
    const t = node('table', g);
    cyl(0.72, 0.72, 0.045, '#f0d6aa', 0, TABLE_H - 0.0225, 0, t, 48);
    cyl(0.69, 0.69, 0.05, '#dcb385', 0, TABLE_H - 0.06, 0, t, 48);
    [45, 135, 225, 315].forEach(a => cyl(0.022, 0.022, TABLE_H - 0.05, '#a9aeb8', Math.cos(a * DEG) * 0.5, (TABLE_H - 0.05) / 2, Math.sin(a * DEG) * 0.5, t));
    const sheetMap = lay(0.62, 0.42, paper(0.62, 0.42, [['작전', 60, '#3b302b']], '#ffffff', '#cfd6dd'), 0.05, TABLE_H + 0.002, 0.1, t);
    sheetMap.rotation.y = 0.15;
    const cup = node('cup', t, 0.46, TABLE_H, 0.3);
    cyl(0.045, 0.04, 0.1, '#f2a99a', 0, 0.05, 0, cup);
    [0, 1, 2, 3, 5, 6].forEach((k, i) => { const p = pencilMesh(PENCIL_COLS[k], 0.15, 0.005); p.parent = cup; p.position.set(Math.cos(i) * 0.018, 0.1, Math.sin(i) * 0.018); p.rotation.set(Math.sin(i) * 0.15, 0, Math.cos(i) * 0.15); });
    const pouch = put(MB.CreateCapsule('pouch', { radius: 0.035, height: 0.22, tessellation: 12 }, scene), '#9fd6b5', 0.12, TABLE_H + 0.03, 0.5, t);
    pouch.rotation.set(0, 0.3, Math.PI / 2);
    pouch.scaling.z = 0.7;
    const chairsAt = (keys, parent) => keys.forEach(k => {
      const [x, , z, ry] = s.def.spots[k];
      model('chair', { h: 0.7, x: x - Math.sin(ry * DEG) * 0.06, z: z - Math.cos(ry * DEG) * 0.06, ry, color: { wood: '#e8c18e' }, ink: 0.004, parent }); // 아이 의자: 앉는 면 약 0.36
    });
    chairsAt(['seat_nw', 'seat_ne', 'seat_w', 'seat_e'], t);
    const ring = node('ring', g);
    chairsAt(Object.keys(s.def.spots).filter(k => k.startsWith('ring_')), ring);
    model('rugRectangle', { w: 1.7, d: 1.1, x: 1.55, z: 1.55, ry: 8, color: { carpet: '#efb08a', carpetDarker: '#d98a6a' }, cast: false, parent: g });
    s.apply = set => { t.setEnabled(!set.circle); ring.setEnabled(!!set.circle); };
  },

  // 교실 앞 복도: 창, 교실 문과 반 이름, 사물함, 의자
  hallway(s) {
    const g = s.root;
    stageBase(g, 6.4, 3.8);
    floorTiles(g, 6.4, 3.8, '#e3e7ee', '#dce1e9', '#c9d0dc', 0.8);
    const back = wallGroup(g, 'back', 0, -1.96);
    windowWall(back, 6.4, [[-1.15, -0.05], [0.35, 1.45], [1.85, 2.95]], 1.35, 2.15, outsideTex(false), '#f1ede4');
    wainscot(back, 6.4);
    for (let i = 0; i < 4; i++) box(0.48, 1.3, 0.4, i % 2 ? '#7fb3d5' : '#8fc0de', 0.6 + i * 0.5, 0.65, 0.28, back);
    model('bench', { w: 1.1, h: 0.42, x: -0.6, z: 0.41, parent: back, ink: 0.004 });
    const left = wallGroup(g, 'left', -3.26, 0);
    plainWall(left, 3.8, '#ece7dc');
    wainscot(left, 3.8);
    model('doorway', { h: 2.05, x: -0.2, z: 0.08, parent: left });
    box(0.9, 1.98, 0.04, '#e9b783', -0.2, 0.99, 0.08, left, false);
    sheet(0.7, 0.2, paper(0.7, 0.2, [['3학년 2반', 60, '#3b302b']], '#fff6d6'), -0.2, 2.3, 0.08, 0, left);
  },

  // 운동장: 피구 코트(x -3~3, z -1.8~1.8, 가운데 선으로 두 편), 뒤에 스탠드 세 칸, 왼쪽 앞 수돗가와 긴 의자, 나무
  court(s) {
    const g = s.root, W = 11, D = 9;
    stageBase(g, W, D);
    lay(W, D, canvasTex(1100, 900, (c, w, hh) => {
      c.fillStyle = '#e9cf9f'; c.fillRect(0, 0, w, hh);
      for (let i = 0; i < 1400; i++) { c.fillStyle = Math.random() < 0.5 ? 'rgba(160,120,70,.12)' : 'rgba(255,250,235,.2)'; c.fillRect(Math.random() * w, Math.random() * hh, 3 + Math.random() * 5, 2 + Math.random() * 3); }
      const px = x => (x + W / 2) * 100, pz = z => (z + D / 2) * 100;
      c.strokeStyle = 'rgba(255,255,255,.92)'; c.lineWidth = 6;
      c.strokeRect(px(-3), pz(-1.8), 600, 360);
      c.beginPath(); c.moveTo(px(0), pz(-1.8)); c.lineTo(px(0), pz(1.8)); c.stroke();
    }), 0, 0.002, 0, g);
    // 스탠드: 한 칸 높이 0.36(앉는 면), 깊이 0.6. 칸마다 앉는 면 색
    [['#8fc0de', 0], ['#f6d77a', 1], ['#f2a99a', 2]].forEach(([col, i]) => {
      const top = 0.36 * (i + 1), z = -2.6 - 0.6 * i;
      box(7.4, top, 0.6, '#d9d3c7', 0, top / 2, z, g);
      box(7.4, 0.03, 0.6, col, 0, top + 0.015, z, g, false);
    });
    box(7.4, 1.08, 0.3, '#d9d3c7', 0, 0.54, -4.25, g);
    box(1.9, 0.5, 0.04, '#c99a69', 0, 1.6, -4.1, g, false);
    sheet(1.8, 0.42, paper(1.8, 0.42, [['3학년 피구 대회', 64, '#e8705a']], '#fffaf0', '#f2a99a'), 0, 1.6, -4.07, 0, g);
    [-3.8, 3.8].forEach(x => cyl(0.04, 0.04, 1.4, '#7a8aa3', x, 0.7, -4.1, g, 8));
    // 수돗가: 긴 개수대와 꼭지 셋. 아이는 -z 쪽에 서서 +z 를 본다
    const sk = node('sink', g, -4.1, 0, 2.75);
    box(1.4, 0.5, 0.45, '#cfd6dd', 0, 0.25, 0, sk);
    box(1.28, 0.06, 0.33, '#9aa6b2', 0, 0.48, 0, sk, false);
    box(1.4, 0.16, 0.08, '#cfd6dd', 0, 0.58, 0.2, sk);
    [-0.45, 0, 0.45].forEach(x => {
      cyl(0.02, 0.02, 0.1, '#e9eef1', x, 0.71, 0.16, sk, 10);
      box(0.03, 0.03, 0.12, '#e9eef1', x, 0.76, 0.1, sk, false);
    });
    box(1.4, 0.04, 1.2, '#c9c2b4', 0, 0.02, -0.2, sk, false);
    const bench = node('bench', g, -2.2, 0, 3.04);
    box(1.4, 0.06, 0.34, '#c08a58', 0, 0.33, 0, bench);
    [-0.6, 0.6].forEach(x => box(0.08, 0.3, 0.28, '#8a6a4a', x, 0.15, 0, bench));
    [[-4.6, -4.6, 3.4], [-1.9, -4.7, 3.0], [1.9, -4.6, 3.2], [4.6, -4.5, 3.6], [-5.0, -1.2, 2.8], [5.0, 0.8, 3.0]].forEach(([x, z, h], i) => model(i % 2 ? 'tree_default' : 'tree_oak', { h, x, z, ry: x * 30, parent: g }));
    [[-5.0, 1.6], [5.1, -1.6], [4.9, 2.6], [-0.5, 4.2], [2.4, 4.1]].forEach(([x, z], i) => model(i % 2 ? 'plant_bushSmall' : 'plant_bush', { h: 0.35, x, z, parent: g }));
    [[3.3, 3.6, 'flower_redA'], [3.7, 3.9, 'flower_yellowB'], [-3.0, 4.0, 'flower_purpleA']].forEach(([x, z, m]) => model(m, { h: 0.28, x, z, parent: g }));
  },

  // 급식실: 긴 식탁 둘(z 0.8, -0.8)과 긴 의자, 식판. 뒤에 배식대와 오늘의 급식
  cafeteria(s) {
    const g = s.root, W = 6.4, D = 5;
    stageBase(g, W, D);
    floorTiles(g, W, D, '#e6eef0', '#dde7ea', '#c6d3d8', 0.5);
    const r = room(g, W, D), WALL2 = '#f3efe6';
    plainWall(r.back, W, WALL2);
    wainscot(r.back, W);
    box(3.2, 0.8, 0.55, '#c9d2d8', -0.8, 0.4, 0.35, r.back);
    box(3.3, 0.04, 0.6, '#e9eef1', -0.8, 0.82, 0.35, r.back, false);
    [-1.9, -1.1, -0.3, 0.5].forEach((x, i) => cyl(0.16, 0.15, 0.22, ['#d9dfe4', '#e8b4a0', '#d9dfe4', '#f6d77a'][i], x, 0.95, 0.35, r.back, 16));
    sheet(1.1, 0.72, paper(1.1, 0.72, [['오늘의 급식', 54, '#e8705a'], ['달걀말이', 46, '#3b302b'], ['미역국 · 밥 · 김치', 40, '#3b302b']]), 1.75, 1.55, 0.075, 0, r.back);
    windowWall(r.left, D, [[-1.7, -0.5], [0.5, 1.7]], SILL, 2.15, outsideTex(false), WALL2);
    wainscot(r.left, D);
    plainWall(r.right, D, WALL2);
    wainscot(r.right, D);
    model('pottedPlant', { h: 0.9, x: -1.8, z: 0.33, parent: r.right });
    plainWall(r.front, W, WALL2);
    wainscot(r.front, W);
    const tray = (x, z, ry) => {
      const t = node('tray', g, x, TABLE_H, z);
      t.rotation.y = ry * DEG;
      box(0.34, 0.02, 0.24, '#d9dfe4', 0, 0.01, 0, t, false);
      box(0.12, 0.022, 0.08, '#f6d77a', -0.09, 0.022, -0.05, t, false);
      box(0.12, 0.022, 0.08, '#e8705a', 0.06, 0.022, -0.05, t, false);
      cyl(0.05, 0.045, 0.04, '#f8f4ea', -0.08, 0.04, 0.06, t, 14);
      cyl(0.05, 0.045, 0.04, '#9cc17a', 0.07, 0.04, 0.06, t, 14);
    };
    [0.8, -0.8].forEach(z => {
      box(3.0, 0.04, 0.7, '#f0d6aa', 0, TABLE_H - 0.02, z, g);
      [-1.35, 1.35].forEach(x => box(0.05, TABLE_H - 0.04, 0.6, '#a9aeb8', x, (TABLE_H - 0.04) / 2, z, g));
      [-0.55, 0.55].forEach(dz => {
        box(3.0, 0.05, 0.3, '#c08a58', 0, 0.335, z + dz * 1.04, g);
        [-1.3, 1.3].forEach(x => box(0.06, 0.31, 0.24, '#8a6a4a', x, 0.155, z + dz * 1.04, g));
      });
    });
    // 앉는 자리(l_ 로 시작하는 자리와 반 친구 자리)마다 앞에 식판
    [...Object.entries(s.def.spots).filter(([k]) => k.startsWith('l_')).map(([, v]) => v), ...s.def.crowds.lunch].forEach(([x, , z, ry]) => tray(x + Math.sin(ry * DEG) * 0.37, z + Math.cos(ry * DEG) * 0.37, ry));
  },

  // 그날 저녁, 유나네 부엌: 식탁과 의자, 달걀말이 접시, 창밖은 저녁 하늘
  kitchen(s) {
    const g = s.root, W = 4.6, D = 3.8, WALL3 = '#f1e3cf';
    stageBase(g, W, D);
    floorTiles(g, W, D, '#e8d5b5', '#e2cdab', '#cdb48e', 0.45);
    const r = room(g, W, D);
    windowWall(r.back, W, [[0.5, 1.5]], 1.1, 2.0, outsideTex(true), WALL3);
    box(1.6, 0.85, 0.55, '#f6efe2', -1.2, 0.425, 0.3, r.back);
    box(1.65, 0.04, 0.6, '#d9c6a8', -1.2, 0.87, 0.3, r.back, false);
    box(1.6, 0.6, 0.35, '#f6efe2', -1.2, 1.8, 0.2, r.back);
    cyl(0.12, 0.12, 0.14, '#e8705a', -1.5, 0.96, 0.3, r.back, 16);
    plainWall(r.left, D, WALL3);
    box(0.7, 1.6, 0.6, '#e8eef2', 0.9, 0.8, 0.33, r.left);
    plainWall(r.right, D, WALL3);
    model('pottedPlant', { h: 0.8, x: 1.2, z: 0.33, parent: r.right });
    plainWall(r.front, W, WALL3);
    const t = node('table', g, 0, 0, -0.2);
    box(1.3, 0.04, 0.85, '#e3bf8f', 0, TABLE_H - 0.02, 0, t);
    [[-0.58, -0.36], [0.58, -0.36], [-0.58, 0.36], [0.58, 0.36]].forEach(([x, z]) => box(0.05, TABLE_H - 0.04, 0.05, '#a97a49', x, (TABLE_H - 0.04) / 2, z, t));
    const [yx, , yz] = s.def.spots.k_y;
    model('chair', { h: 0.7, x: yx, z: yz - 0.06, color: { wood: '#f2b5c8' }, ink: 0.004, parent: g });
    model('chair', { h: 0.7, x: 0, z: 0.41, ry: 180, color: { wood: '#e8c18e' }, ink: 0.004, parent: g }); // 엄마 자리 (식탁 앞쪽)
    const meal = node('meal', g); // 유나네 저녁(달걀말이): set.meal 일 때만
    cyl(0.12, 0.1, 0.02, '#ffffff', yx, TABLE_H + 0.01, yz + 0.32, meal, 20);
    for (let i = 0; i < 5; i++) { const e = box(0.05, 0.045, 0.06, '#ffd45a', yx - 0.08 + i * 0.04, TABLE_H + 0.04, yz + 0.32, meal); e.rotation.y = 0.1; }
    cyl(0.06, 0.05, 0.06, '#f8f4ea', yx + 0.2, TABLE_H + 0.03, yz + 0.25, meal, 14);
    cyl(0.005, 0.005, 0.2, '#3b302b', yx - 0.17, TABLE_H + 0.008, yz + 0.3, meal, 6).rotation.x = Math.PI / 2;
    s.apply = set => meal.setEnabled(!!set.meal);
    const lampAt = s.def.lamp;
    cyl(0.005, 0.005, 2.5 - lampAt[1], '#3b302b', lampAt[0], (2.5 + lampAt[1]) / 2, lampAt[2], g, 6);
    cyl(0.06, 0.2, 0.14, '#f6d77a', lampAt[0], lampAt[1] + 0.05, lampAt[2], g, 20);
    ball(0.05, '#fff1b8', lampAt[0], lampAt[1] - 0.02, lampAt[2], g).material = Object.assign(new BABYLON.StandardMaterial('lampGlow3', scene), { emissiveColor: C3('#ffe2a0'), disableLighting: true });
  },
};
// 교실 왼쪽 창으로 든 햇빛 자국 (창살 그림자까지)
function sunPatches(g, W, D, wins, sill, top) {
  const kx = SUN_DIR.x / -SUN_DIR.y, kz = SUN_DIR.z / -SUN_DIR.y;
  const SW = 1024, SH = Math.round(1024 * D / W);
  const px = (x, z) => [(x + W / 2) / W * SW, (z + D / 2) / D * SH];
  const tex = canvasTex(SW, SH, c => {
    c.filter = 'blur(9px)';
    c.fillStyle = 'rgba(255, 222, 160, .22)';
    wins.forEach(([z0, z1]) => {
      const pt = (h, z) => px(-W / 2 + h * kx, z + h * kz);
      c.beginPath();
      [pt(sill, z0), pt(sill, z1), pt(top, z1), pt(top, z0)].forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.fill();
    });
    c.globalCompositeOperation = 'destination-out';
    c.filter = 'blur(3px)';
    c.strokeStyle = '#000';
    c.lineWidth = 9;
    wins.forEach(([z0, z1]) => {
      const zm = (z0 + z1) / 2, hm = (sill + top) / 2;
      c.beginPath();
      c.moveTo(...px(-W / 2 + sill * kx, zm + sill * kz)); c.lineTo(...px(-W / 2 + top * kx, zm + top * kz));
      c.moveTo(...px(-W / 2 + hm * kx, z0 + hm * kz)); c.lineTo(...px(-W / 2 + hm * kx, z1 + hm * kz));
      c.stroke();
    });
  }, true);
  // 그림 윗변이 -z 쪽이 되도록 lay 의 u 뒤집기를 한 번 더 되돌린다
  const m = flipU(lay(W, D, tex, 0, 0.004, 0, g, { glow: true }));
  m.material.alphaMode = BABYLON.Engine.ALPHA_ADD;
}

const STAGES = {};
let stageNow = null;
function getStage(name) {
  if (!STAGES[name]) {
    const s = { name, root: node(name), def: DEFS.stages[name], walls: [], apply: null };
    building = s;
    BUILD[name](s);
    building = null;
    s.root.setEnabled(false);
    STAGES[name] = s;
  }
  return STAGES[name];
}
function showStage(name) {
  for (const k in STAGES) STAGES[k].root.setEnabled(false);
  stageNow = getStage(name);
  stageNow.root.setEnabled(true);
  setLight(stageNow.def.light, stageNow.def.lamp);
  homeCam(stageNow.def);
  stageNow.walls.forEach(w => { w.vis = -1; });
  updateWalls(true);
  return stageNow;
}
