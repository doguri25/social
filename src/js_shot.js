// ===== 웹툰 컷 찍기: 컷마다 카메라 자리를 정해 무대를 찍고, 망점을 입힌다 =====
const shotCam = new BABYLON.UniversalCamera('shot', V3(0, 1, 3), scene);
const faceCam = new BABYLON.UniversalCamera('faceCam', V3(0, 1, 3), scene);
// Babylon 9.27: 후처리가 없는 카메라로 화면 밖 찍기를 하면 빈 그림이 나온다. 그대로 옮기는 후처리를 하나씩 붙인다
[shotCam, faceCam].forEach(c => { c.minZ = 0.05; c.maxZ = 80; c.inputs.clear(); c.pass = new BABYLON.PassPostProcess('pass', 1, c); });
shotCam.pass.samples = 4;
faceCam.pass.clearColor = new BABYLON.Color4(1, 1, 1, 0); // 얼굴 사진은 배경 없이
const turnY = (v, deg) => { const a = deg * DEG, s = Math.sin(a), co = Math.cos(a); return V3(v.x * co + v.z * s, v.y, -v.x * s + v.z * co); };
// 컷의 기준 방향은 무대의 처음 카메라 쪽 (아이가 무대를 어떻게 돌려 놓았든 같은 컷이 나오게)
function camDir() {
  const w = stageNow.def.wide;
  const d = V3(...w.pos).subtract(V3(...w.target));
  d.y = 0;
  return d.normalize();
}
// 카메라에서 주인공까지 가는 시선 가까이, 주인공보다 카메라 쪽에 있는 아이는 이 컷에서 뺀다
function blocks(c, pos, look) {
  const p = headPos(c).add(V3(0, -0.25, 0));
  const dir = look.subtract(pos);
  const L = dir.length();
  dir.normalize();
  const t = BABYLON.Vector3.Dot(p.subtract(pos), dir);
  return t > 0 && t < L - 0.2 && BABYLON.Vector3.Distance(pos.add(dir.scale(t)), p) < 0.45;
}
function placeShot(p) {
  const on = [].concat(p.on || []);
  const cs = on.map(id => CH[id]).filter(c => c && shown(c));
  const w = stageNow.def.wide;
  const turn = p.angle || 0;
  let pos, look, fov = 38;
  let shot = p.shot;
  if ((shot === 'close' || shot === 'high') && !cs[0]) shot = 'wide';
  if ((shot === 'two' || shot === 'over') && cs.length < 2) shot = cs[0] ? 'close' : 'wide';
  if (shot === 'group' && !cs.length) shot = 'wide';
  if (shot === 'item') {
    const it = stageNow.def.items[on[0]];
    pos = V3(...it.c); look = V3(...it.t); fov = it.fov || 40;
  } else if (shot === 'close') {
    const c = cs[0], hp = headPos(c), f = turnY(facing(c), p.angle == null ? 18 : p.angle);
    const r = c.r * c.root.scaling.x;
    const down = c.head.rotation.x > 0.2; // 고개 숙인 얼굴은 조금 아래에서
    pos = hp.add(f.scale(r * 5.6)).add(V3(0, down ? -r * 1.2 : r * 0.4, 0));
    look = hp.add(V3(0, -r * (down ? 0.75 : 0.45), 0));
    fov = 34;
  } else if (shot === 'two') {
    const a = headPos(cs[0]), b = headPos(cs[1]);
    const mid = a.add(b).scale(0.5);
    const line = b.subtract(a);
    line.y = 0;
    let perp = V3(-line.z, 0, line.x).normalize();
    const score = BABYLON.Vector3.Dot(perp, facing(cs[0]).add(facing(cs[1]))) + 0.6 * BABYLON.Vector3.Dot(perp, camDir());
    if (score < 0) perp.scaleInPlace(-1);
    // 서로 마주 보면 옆얼굴이 큰 머리에 가려서, 앞사람(말하는 사람) 얼굴 쪽으로 카메라를 돌린다
    const f0 = facing(cs[0]);
    if (BABYLON.Vector3.Dot(f0, facing(cs[1])) < -0.3) perp = perp.add(f0.scale(0.8)).normalize();
    perp = turnY(perp, turn);
    const r = Math.max(...cs.slice(0, 2).map(c => c.r * c.root.scaling.x)); // 2등신 큰 머리: 머리 크기에 맞춰 물러선다
    pos = mid.add(perp.scale(Math.max(r * 7, line.length() * 0.9 + r * 4))).add(V3(0, r * 1.2, 0));
    look = mid.add(V3(0, -r * 0.7, 0));
  } else if (shot === 'over') {
    const a = headPos(cs[0]), b = headPos(cs[1]);
    const dir = b.subtract(a);
    dir.y = 0;
    dir.normalize();
    const r = cs[0].r * cs[0].root.scaling.x; // 앞사람 큰 머리 뒤, 어깨 옆에서
    pos = a.subtract(dir.scale(r * 2.4)).add(V3(-dir.z * r * 1.2, r * 0.6, dir.x * r * 1.2));
    look = b.add(V3(0, -0.05, 0));
    fov = 42;
  } else if (shot === 'group') {
    const hs = cs.map(headPos);
    const ctr = hs.reduce((s, v) => s.add(v), V3()).scale(1 / hs.length);
    const r = Math.max(0.5, ...hs.map(v => Math.hypot(v.x - ctr.x, v.z - ctr.z)));
    pos = ctr.add(turnY(camDir(), turn).scale(r * 2.0 + 1.15)).add(V3(0, 0.75, 0));
    look = ctr.add(V3(0, -0.25, 0));
    fov = 40;
  } else if (shot === 'high') {
    const base = cs[0].root.position;
    pos = base.add(turnY(camDir(), turn)).add(V3(0, 2.8, 0));
    look = base.add(V3(0, 0.35, 0));
    fov = 42;
  } else {
    const tgt = V3(...w.target);
    pos = turnY(V3(...w.pos).subtract(tgt), turn).add(tgt);
    look = tgt;
    fov = w.fov || 40;
  }
  shotCam.position.copyFrom(pos);
  shotCam.setTarget(look);
  shotCam.fov = fov * DEG;
  // 넓은 컷, 모둠 컷, 물건 컷(전시판 앞에 선 아이들처럼 함께 찍히는 것)은 모두 보이게, 나머지는 가리는 아이를 뺀다
  const keepAll = shot !== 'close' && shot !== 'two' && shot !== 'over';
  let mask = 1;
  for (const id in CH) { const c = CH[id]; if (shown(c) && (keepAll || on.includes(id) || !blocks(c, pos, look))) mask |= c.mask; }
  shotCam.layerMask = mask;
}
const snap = (cam, w, hh) => BABYLON.CreateScreenshotUsingRenderTargetAsync(engine, cam, { width: w, height: hh }, 'image/png', 1, false, undefined, false, true, true);
// 찍기는 한 번에 하나씩 (Babylon 의 화면 밖 찍기가 겹치지 않게)
let capQ = Promise.resolve(), capBusy = 0;
function serial(fn) {
  capBusy++;
  const r = capQ.then(() => {
    blinkOff = true; // 감은 눈으로 찍히지 않게 눈을 뜨게 하고 깜빡임을 멈춘다
    for (const id in CH) if (CH[id].blinking) setFace(CH[id], CH[id].face);
    return fn();
  }).finally(() => { capBusy--; blinkOff = false; });
  capQ = r.catch(() => {});
  return r;
}
// 망점: 어두운 곳일수록 45도 격자 점이 커진다
function screentone(g, W, H) {
  const img = g.getImageData(0, 0, W, H), d = img.data;
  const s = Math.SQRT1_2 / 6;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const l = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
    if (l > 0.62) continue;
    const u = (x + y) * s, v = (x - y) * s;
    const fu = u - Math.floor(u) - 0.5, fv = v - Math.floor(v) - 0.5;
    const rad = Math.sqrt((0.62 - l) / 0.62) * 0.5;
    if (fu * fu + fv * fv < rad * rad) { d[i] *= 0.84; d[i + 1] *= 0.82; d[i + 2] *= 0.8; }
  }
  g.putImageData(img, 0, 0);
}
async function loadImg(src) { const img = new Image(); img.src = src; await img.decode(); return img; }
// 컷 한 장: 지금 무대(표정·자세는 applyCut 으로 맞춘 상태)를 컷 카메라로 찍어 jpeg 주소로
function shoot(p, w, hh) {
  return serial(async () => {
    scene.render(); // 자세를 바꾼 뒤의 위치로 컷 자리를 계산한다
    placeShot(p);
    wallsForShot(shotCam.position);
    let url;
    try { url = await snap(shotCam, w, hh); } finally { restoreWalls(); }
    const img = await loadImg(url);
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = hh;
    const g = cv.getContext('2d');
    g.drawImage(img, 0, 0);
    screentone(g, w, hh);
    return cv.toDataURL('image/jpeg', 0.86);
  });
}
// 얼굴 사진 (말풍선 옆, 인물 카드): 그 인물만 보이게 앞에서 찍는다. face 를 주면 그 표정으로
const portraits = {};
function portrait(c, face) {
  const key = `${c.id}:${face || c.face}:${face ? '' : c.pose}`;
  if (portraits[key]) return Promise.resolve(portraits[key]);
  return serial(async () => {
    const keep = c.face, night = stageNow.def.light === 'night';
    if (face) setFace(c, face);
    if (night) setLight('day'); // 얼굴 사진은 밤 장면에서도 밝게
    scene.render();
    const hp = headPos(c), f = facing(c), r = c.r * c.root.scaling.x;
    faceCam.position.copyFrom(hp.add(f.scale(r * 7)).add(V3(0, r * 0.9, 0)));
    faceCam.setTarget(hp.add(V3(0, r * 0.05, 0)));
    faceCam.fov = 0.42;
    faceCam.layerMask = c.mask;
    try { return (portraits[key] = await snap(faceCam, 160, 160)); } finally { if (face) setFace(c, keep); if (night) setLight('night', stageNow.def.lamp); }
  });
}
// 컷 하나의 표정과 자세를 무대 인물에게도 (다른 인물은 무대에서 정한 표정·자세로)
function applyCut(p) {
  for (const id in CH) {
    const c = CH[id];
    if (!shown(c)) continue;
    setFace(c, (p.faces && p.faces[id]) || c.face0);
    setPose(c, c.base, p.poses && p.poses[id]);
  }
  poke();
}
