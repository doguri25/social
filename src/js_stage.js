// ===== 무대(디오라마): 둥근 나무 받침 위 작은 세트. 처음 쓸 때 만들고, 한 번에 하나만 보인다 =====
// 방은 벽 네 개를 묶음으로 만들어, 카메라 쪽 벽은 저절로 걷힌다(js_world 의 벽 자르기). 자리와 카메라 값은 data/defs.json
const WALL_H = 2.5, WALL_T = 0.12, SILL = 0.85, TABLE_H = 0.64;
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
const SKY = 4; // 하늘색 색연필
function pencilMesh(color, len = 0.17, r = 0.0055) {
  const p = put(MB.CreateCylinder('pencil', { diameter: r * 2, height: len, tessellation: 6 }, scene), color, 0, 0, 0, null, false);
  const tip = put(MB.CreateCylinder('tip', { diameterTop: 0, diameterBottom: r * 2, height: 0.025, tessellation: 6 }, scene), '#f6d9b0', 0, len / 2 + 0.0125, 0, p, false);
  tip.isPickable = false;
  return p;
}

// ---- 모둠 지도: 탁자 위 한 장, 찢어진 두 장, 전시 벽에 세운 것 ----
const MAP_SIZE = [1.05, 1.05 * MAP_H / MAP_W];
const mapCache = {};
// half: 'L' | 'R' 이면 찢어진 반쪽만 남기고 나머지는 투명
function mapTex(st, half) {
  const key = st + (half || '');
  if (mapCache[key]) return mapCache[key];
  return (mapCache[key] = canvasTex(MAP_W, MAP_H, g => {
    if (!half) return paintMap(g, st);
    const full = document.createElement('canvas');
    full.width = MAP_W; full.height = MAP_H;
    paintMap(full.getContext('2d'), st);
    g.save();
    g.beginPath();
    g.moveTo(half === 'L' ? 0 : MAP_W, 0);
    TEAR.forEach(([x, y]) => g.lineTo(x, y));
    g.lineTo(half === 'L' ? 0 : MAP_W, MAP_H);
    g.closePath();
    g.clip();
    g.drawImage(full, 0, 0);
    g.restore();
    g.beginPath();
    TEAR.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.strokeStyle = '#ffffff'; g.lineWidth = 5; g.stroke();
  }, !!half));
}
function paperMat(m, tex) {
  const t = m.material;
  t.diffuseTexture = tex;
  t.useAlphaFromDiffuseTexture = tex.hasAlpha;
  t.transparencyMode = tex.hasAlpha ? BABYLON.Material.MATERIAL_ALPHATEST : BABYLON.Material.MATERIAL_OPAQUE;
  t.alphaCutOff = 0.5;
}
function makeMapProp(parent, scale = 1, standing = false) {
  const g = node('map', parent);
  const [w, d] = MAP_SIZE.map(v => v * scale);
  const mk = () => (standing ? sheet(w, d, null, 0, 0, 0, 0, g) : lay(w, d, null, 0, 0, 0, g));
  const full = mk(), L = mk(), R = mk();
  let cur = null;
  return {
    g,
    set(st) {
      if (st === cur) return;
      cur = st;
      g.setEnabled(st !== 'none');
      if (st === 'none') return;
      const torn = st === 'torn' || st === 'halves';
      full.setEnabled(!torn);
      L.setEnabled(torn);
      R.setEnabled(torn);
      if (!torn) return paperMat(full, mapTex(st));
      paperMat(L, mapTex('scribbled', 'L'));
      paperMat(R, mapTex('scribbled', 'R'));
      const gap = (st === 'halves' ? 0.32 : 0.26) * scale;
      if (standing) { L.position.set(-gap, 0, 0.002); R.position.set(gap, 0, 0.004); }
      else { L.position.set(-gap, 0, 0.02); L.rotation.y = 0.07; R.position.set(gap, 0.001, -0.02); R.rotation.y = -0.05; }
    },
  };
}
// 서아의 새 색연필: 닫힌 상자(box) / 뚜껑 연 상자(open) / 하늘색을 유나가 쥠(taken) / 바닥에 쏟아짐(scattered)
let handPencil = null;
function makePencils(parent) {
  const bx = node('pencilBox', parent, -0.4, TABLE_H, -0.45);
  bx.rotation.y = 0.75;
  box(0.2, 0.02, 0.12, '#ffffff', 0, 0.01, 0, bx);
  const lidShut = box(0.205, 0.008, 0.125, '#6fbfee', 0, 0.024, 0, bx);
  const lidOpen = box(0.205, 0.008, 0.125, '#6fbfee', 0, 0.062, -0.07, bx);
  lidOpen.rotation.x = Math.PI / 2 - 0.25;
  const inBox = PENCIL_COLS.map((c, i) => { const p = pencilMesh(c); p.parent = bx; p.rotation.z = Math.PI / 2; p.position.set(0, 0.026, -0.049 + i * 0.014); return p; });
  const floor = node('floorPencils', parent);
  PENCIL_COLS.forEach((c, i) => {
    const p = pencilMesh(c);
    const a = i * 0.8 + 0.3;
    p.parent = floor;
    p.position.set(0.4 + Math.cos(a) * (0.15 + i * 0.035), 0.007, 1.0 + Math.sin(a) * 0.22);
    p.rotation.set(0, a * 1.7, Math.PI / 2);
    shadows.addShadowCaster(p);
  });
  return {
    set(st) {
      bx.setEnabled(st !== 'scattered');
      floor.setEnabled(st === 'scattered');
      lidShut.setEnabled(st === 'box');
      lidOpen.setEnabled(st === 'open' || st === 'taken');
      inBox[SKY].setEnabled(st !== 'taken');
      if (st === 'taken' && !handPencil && CH.yuna) {
        handPencil = pencilMesh(PENCIL_COLS[SKY], 0.17, 0.007);
        handPencil.parent = CH.yuna.armA.hand;
        handPencil.position.set(0, -0.045, 0.015);
        handPencil.rotation.x = Math.PI; // 손 너머로 뾰족한 끝
      }
      if (handPencil) handPencil.setEnabled(st === 'taken');
    },
  };
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
    const titles = [[STORIES.book1.title, '#ffcf3f'], ['2권 준비 중', '#6fbfee'], ['3권 준비 중', '#f497b6'], ['4권 준비 중', '#78c78a'], ['5권 준비 중', '#b48ad8']];
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

  // 학교 가는 길: 길, 집 세 채(지붕 색으로 누구 집인지), 학교, 나무, 가로등
  street(s) {
    const g = s.root;
    stageBase(g, 14, 10);
    put(MB.CreateGround('grass', { width: 14, height: 10 }, scene), '#a9d98f', 0, 0, 0, g, false);
    box(2.0, 0.03, 10, '#e9e3d5', 0, 0.012, 0, g, false);
    box(0.12, 0.08, 10, '#c9c2b4', 1.06, 0.04, 0, g, false);
    box(3.0, 0.02, 10, '#8f96a3', 2.6, 0.01, 0, g, false);
    for (let z = -4.6; z < 4.8; z += 1.2) box(0.1, 0.012, 0.6, '#ffffff', 2.6, 0.022, z, g, false);
    box(1.6, 0.03, 10, '#e9e3d5', 4.9, 0.012, 0, g, false);
    model('building-type-c', { h: 6.2, x: -4.6, z: -0.6, ry: 90, roof: '#6fbfee', parent: g });
    model('building-type-k', { h: 6.6, x: 7.6, z: -2.6, ry: -90, roof: '#e8708f', parent: g });
    model('building-type-p', { h: 6.0, x: 7.4, z: 3.2, ry: -90, roof: '#61cb8b', parent: g });
    const sc = node('school', g, -1.5, 0, -5.4);
    box(7, 4.2, 1.2, '#f6efe2', 0, 2.1, 0, sc);
    box(7.3, 0.25, 1.4, '#e57f5c', 0, 4.3, 0, sc);
    [-2.6, -1.3, 1.3, 2.6].forEach(x => { box(0.9, 0.8, 0.05, '#bfe6ff', x, 2.9, 0.61, sc, false); box(0.9, 0.8, 0.05, '#bfe6ff', x, 1.4, 0.61, sc, false); });
    box(1.4, 2.1, 0.06, '#b98a5e', 0, 1.05, 0.61, sc, false);
    const clockM = cyl(0.35, 0.35, 0.06, '#ffffff', 0, 3.4, 0.62, sc);
    clockM.rotation.x = Math.PI / 2;
    [[-1.7, -2.8, 4.6], [-2.2, 2.6, 4.2], [4.2, 0.4, 3.8], [-6.4, 3.6, 5]].forEach(([x, z, h]) => model('tree_default', { h, x, z, ry: x * 40, parent: g }));
    [[-1.6, -1.0], [-1.7, 0.4], [-1.6, 1.6]].forEach(([x, z], i) => model(i % 2 ? 'plant_bush' : 'plant_bushSmall', { h: 0.32, x, z, parent: g }));
    [[-1.4, -0.4, 'flower_redA'], [-1.45, 1.0, 'flower_yellowB'], [-1.35, 2.2, 'flower_purpleA']].forEach(([x, z, m]) => model(m, { h: 0.3, x, z, parent: g }));
    cyl(0.05, 0.06, 3.2, '#5a6278', -1.25, 1.6, -1.8, g);
    ball(0.16, '#ffe9a0', -1.25, 3.25, -1.8, g).material = Object.assign(new BABYLON.StandardMaterial('lampGlow', scene), { emissiveColor: C3('#fff1b8'), disableLighting: true });
  },

  // 교실: 둥근 모둠 탁자, 칠판과 전시판(뒤), 창(왼쪽), 문과 약속판(오른쪽), 사물함(앞)
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
      write(c, '우리 동네 지도', 300, 80, 74, 'rgba(250,250,240,.92)');
      c.strokeStyle = 'rgba(250,250,240,.85)'; c.lineWidth = 5; c.lineJoin = c.lineCap = 'round';
      c.beginPath(); c.moveTo(120, 340); c.lineTo(120, 260); c.lineTo(190, 205); c.lineTo(260, 260); c.lineTo(260, 340); c.closePath();
      c.rect(170, 290, 36, 50); c.moveTo(70, 350); c.lineTo(560, 350);
      c.moveTo(330, 340); c.lineTo(330, 250); c.lineTo(390, 250); c.lineTo(390, 340);
      c.moveTo(470, 340); c.lineTo(470, 290); c.stroke();
      c.beginPath(); c.arc(470, 260, 40, 0, 7); c.stroke();
      c.beginPath(); c.moveTo(640, 225); c.bezierCurveTo(600, 180, 560, 240, 640, 290); c.bezierCurveTo(720, 240, 680, 180, 640, 225); c.stroke();
      c.setLineDash([14, 14]); c.beginPath(); c.moveTo(560, 350); c.quadraticCurveTo(760, 340, 900, 240); c.stroke();
    }), -0.35, 1.6, 0.111, 0, b);
    box(2.3, 0.035, 0.1, '#c99a69', -0.35, 1.0, 0.11, b, false);
    sheet(0.56, 0.76, paper(0.56, 0.76, [['함께', 64, '#e8705a'], ['만드는', 56, '#3b302b'], ['좋은 교실', 54, '#3f9c7d']]), -2.25, 1.68, 0.075, 0, b);
    // 전시판: 「우리 주변 장소 지도 전시회」
    box(1.55, 1.05, 0.03, '#d9ae78', 1.85, 1.45, 0.075, b, false);
    sheet(1.5, 0.2, paper(1.5, 0.2, [['우리 주변 장소 지도 전시회', 50, '#3b302b']], '#fff6d6', null), 1.85, 2.12, 0.075, 0, b);
    const wallMap = makeMapProp(b, 1, true);
    wallMap.g.position.set(1.85, 1.43, 0.1);
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
    sheet(1.1, 0.34, paper(1.1, 0.34, [['4학년 2반', 64, '#2f6b55']], '#fff6d6'), -0.6, 1.55, 0.075, 0, f);

    // 모둠 탁자 (높이 0.64, 지름 1.44)와 의자 넷
    const t = node('table', g);
    cyl(0.72, 0.72, 0.045, '#f0d6aa', 0, TABLE_H - 0.0225, 0, t, 48); // 윤곽선을 달면 그 깊이가 위에 놓인 지도를 덮어 뺀다
    cyl(0.69, 0.69, 0.05, '#dcb385', 0, TABLE_H - 0.06, 0, t, 48);
    [45, 135, 225, 315].forEach(a => cyl(0.022, 0.022, TABLE_H - 0.05, '#a9aeb8', Math.cos(a * DEG) * 0.5, (TABLE_H - 0.05) / 2, Math.sin(a * DEG) * 0.5, t));
    const map = makeMapProp(t);
    map.g.position.set(0.02, TABLE_H + 0.002, 0.04);
    map.g.rotation.y = 0.12;
    const pencils = makePencils(g);
    const cup = node('cup', t, 0.46, TABLE_H, 0.3);
    cyl(0.045, 0.04, 0.1, '#f2a99a', 0, 0.05, 0, cup);
    [0, 1, 2, 3, 5, 6].forEach((k, i) => { const p = pencilMesh(PENCIL_COLS[k], 0.15, 0.005); p.parent = cup; p.position.set(Math.cos(i) * 0.018, 0.1, Math.sin(i) * 0.018); p.rotation.set(Math.sin(i) * 0.15, 0, Math.cos(i) * 0.15); });
    const pouch = put(MB.CreateCapsule('pouch', { radius: 0.035, height: 0.22, tessellation: 12 }, scene), '#9fd6b5', 0.12, TABLE_H + 0.03, 0.5, t);
    pouch.rotation.set(0, 0.3, Math.PI / 2);
    pouch.scaling.z = 0.7;
    ['seat_nw', 'seat_ne', 'seat_w', 'seat_e'].forEach(k => {
      const [x, , z, ry] = s.def.spots[k];
      model('chair', { h: 0.78, x: x - Math.sin(ry * DEG) * 0.04, z: z - Math.cos(ry * DEG) * 0.04, ry, color: { wood: '#e8c18e' }, ink: 0.004, parent: g });
    });
    model('rugRectangle', { w: 1.7, d: 1.1, x: 1.55, z: 1.55, ry: 8, color: { carpet: '#efb08a', carpetDarker: '#d98a6a' }, cast: false, parent: g });
    s.apply = set => { map.set(set.map || 'none'); pencils.set(set.pencils || 'box'); wallMap.set(set.wall || 'none'); };
  },

  // 그날 밤, 유나 방: 창밖은 밤하늘, 스탠드 불빛
  bedroom(s) {
    const g = s.root, W = 5, D = 4.4;
    stageBase(g, W, D);
    floorTiles(g, W, D, '#dccaa8', '#d6c3a0', '#c4ae88', 0.55);
    const r = room(g, W, D);
    windowWall(r.back, W, [[-0.65, 0.65]], 1.1, 2.0, outsideTex(true), '#c9d4f0');
    plainWall(r.left, D, '#d6def2');
    plainWall(r.right, D, '#d6def2');
    plainWall(r.front, W, '#c9d4f0');
    model('bookcaseOpen', { h: 1.3, x: 0.6, z: 0.31, parent: r.right, color: { wood: WOOD }, ink: 0.005 });
    model('bedSingle', { w: 1.0, d: 2.0, h: 0.55, x: -1.95, z: -1.15, color: { carpet: '#ffc94a' }, ink: 0.005, parent: g });
    model('bear', { h: 0.3, x: -2.2, y: 0.55, z: -1.95, ry: 20, parent: g });
    model('cabinetBedDrawerTable', { h: 0.5, x: -2.25, z: 0.2, ry: 90, parent: g });
    model('desk', { w: 1.0, h: 0.66, d: 0.55, x: 1.2, z: -1.9, ink: 0.005, parent: g });
    model('chair', { h: 0.8, x: 1.2, z: -1.35, color: { wood: '#f2b5c8' }, ink: 0.004, parent: g });
    model('lampRoundTable', { h: 0.4, x: 1.5, y: 0.66, z: -1.95, parent: g });
    ball(0.06, '#fff1b8', 1.5, 0.98, -1.95, g).material = Object.assign(new BABYLON.StandardMaterial('lampGlow2', scene), { emissiveColor: C3('#ffe2a0'), disableLighting: true });
    model('rugRound', { w: 1.7, d: 1.7, x: 0.2, z: 0.4, color: { carpet: '#f2b5c8', carpetDarker: '#e8708f' }, cast: false, parent: g });
  },

  // 학교 계단: 한 칸 높이 0.16, 깊이 0.3. 찢어진 지도 반쪽이 계단에
  stairs(s) {
    const g = s.root;
    stageBase(g, 5, 6);
    floorTiles(g, 5, 6, '#d3dae4', '#ccd4df', '#b8c1cf', 0.6);
    for (let i = 0; i < 8; i++) {
      box(2.2, 0.16 * (i + 1), 0.3, '#d9d3c7', 0, 0.08 * (i + 1), 1.25 - 0.3 * i, g);
      box(2.2, 0.025, 0.04, '#5a6278', 0, 0.16 * (i + 1) - 0.01, 1.38 - 0.3 * i, g, false);
    }
    box(2.2, 1.28, 1.4, '#d9d3c7', 0, 0.64, -1.7, g);
    windowWall(wallGroup(g, 'left', -1.16, 0), 6, [[-0.95, 0.15]], 1.25, 2.15, outsideTex(false), '#dde9e2');
    plainWall(wallGroup(g, 'back', 0, -2.46), 5, '#d5e0ea');
    for (let i = 0; i < 8; i += 2) cyl(0.02, 0.02, 0.9, '#7a8aa3', 1.02, 0.16 * (i + 1) + 0.45, 1.25 - 0.3 * i, g, 8);
    const rail = cyl(0.03, 0.03, 2.4, '#7a8aa3', 1.02, 1.62, 0.2, g, 10);
    rail.rotation.x = Math.atan2(0.16, 0.3) + Math.PI / 2;
    const half = lay(MAP_SIZE[0] * 0.75, MAP_SIZE[1] * 0.75, null, -0.75, 0.483, 0.66, g);
    paperMat(half, mapTex('scribbled', 'L'));
    half.rotation.y = 0.15;
    s.apply = set => { half.setEnabled(!!set.half); };
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
    sheet(0.7, 0.2, paper(0.7, 0.2, [['4학년 2반', 60, '#3b302b']], '#fff6d6'), -0.2, 2.3, 0.08, 0, left);
  },

  // 햇살유치원 (기억 장면)
  kinder(s) {
    const g = s.root;
    stageBase(g, 5, 4);
    put(MB.CreateGround('yard', { width: 5, height: 4 }, scene), '#f3e3b5', 0, 0, 0, g, false);
    box(5, 2.6, 0.15, '#ffe9a8', 0, 1.3, -1.62, g, false);
    model('doorway', { h: 2.0, x: -0.45, z: -1.52, parent: g });
    box(0.86, 1.92, 0.04, '#f2a99a', -0.45, 0.96, -1.53, g, false);
    sheet(1.6, 0.4, paper(1.6, 0.4, [['☀ 햇살유치원', 64, '#e8708f']], '#ffffff', '#f2a99a'), 0.9, 2.1, -1.53, 0, g);
    ['flower_redA', 'flower_yellowB', 'flower_purpleA', 'flower_redA', 'flower_yellowB', 'flower_purpleA'].forEach((m, i) => model(m, { h: 0.28, x: 0.4 + i * 0.32, z: -1.32, ry: i * 50, parent: g }));
    model('plant_bush', { h: 0.45, x: -1.5, z: -1.3, parent: g });
    for (let i = 0; i < 3; i++) model('fence_simple', { w: 1.0, h: 0.6, x: -2.0 + i * 1.0, z: 1.75, parent: g });
    model('tree_oak', { h: 3.0, x: 1.9, z: 0.9, parent: g });
    model('grass', { h: 0.2, x: -1.2, z: 0.9, parent: g });
    model('grass', { h: 0.2, x: 0.9, z: 1.3, parent: g });
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
  if (handPencil) handPencil.setEnabled(false);
  setLight(stageNow.def.light, stageNow.def.lamp);
  homeCam(stageNow.def);
  stageNow.walls.forEach(w => { w.vis = -1; });
  updateWalls(true);
  return stageNow;
}
