// ===== 인물: 몸은 기본 도형, 얼굴은 캔버스 그림을 머리에 붙인 무늬, 머리카락은 공 여러 개 =====
const SKIN = '#ffe2cc';
// 인물 재질: 무광 + 가장자리가 살짝 밝아지는 테두리 빛(만화 같은 입체감). 살색은 그늘에서도 밝게
const cmats = {};
function charMat(color) {
  if (cmats[color]) return cmats[color];
  const m = Object.assign(new BABYLON.StandardMaterial('c' + color, scene), { diffuseColor: C3(color), specularColor: BLACK });
  m.emissiveFresnelParameters = Object.assign(new BABYLON.FresnelParameters(), { bias: 0.2, power: 2.2, leftColor: C3('#fff3e0').scale(0.32), rightColor: color === SKIN ? C3(SKIN).scale(0.22) : BLACK });
  return (cmats[color] = m);
}
// 윤곽선: 같은 모양을 법선 방향으로 조금 부풀려 뒷면만 진하게 그린다 (renderOutline 의 깊이 문제가 없다)
const inkMat = Object.assign(new BABYLON.StandardMaterial('ink', scene), { diffuseColor: BLACK, specularColor: BLACK, emissiveColor: C3('#3b2a22'), disableLighting: true, cullBackFaces: false });
function hull(m, w) {
  const h = m.clone('ink', m, true);
  h.makeGeometryUnique();
  h.position.setAll(0);
  h.rotation.setAll(0);
  h.scaling.setAll(1);
  const pos = h.getVerticesData(BABYLON.VertexBuffer.PositionKind), nor = h.getVerticesData(BABYLON.VertexBuffer.NormalKind), s = m.scaling;
  for (let i = 0; i < pos.length; i += 3) { pos[i] += nor[i] * w / s.x; pos[i + 1] += nor[i + 1] * w / s.y; pos[i + 2] += nor[i + 2] * w / s.z; }
  h.setVerticesData(BABYLON.VertexBuffer.PositionKind, pos);
  h.refreshBoundingInfo();
  Object.assign(h, { material: inkMat, isPickable: false, receiveShadows: false, metadata: null });
  return h;
}
// ---- 몸 비율 (m): 2등신 SD 캐릭터. 아이는 키 약 1.09에 머리 지름 0.54(키의 절반), 어른은 키 약 1.42, 머리 약 2.8개 ----
const KID = { r: 0.27, hip: 0.27, thigh: 0.13, shin: 0.12, legR: 0.055, sh: 0.5, shX: 0.135, upper: 0.12, fore: 0.11, armR: 0.045, neck: 0.53, torsoY: 0.4, torsoR: 0.13, torsoL: 0.12 };
const ADULT = { r: 0.25, hip: 0.5, thigh: 0.24, shin: 0.23, legR: 0.065, sh: 0.86, shX: 0.17, upper: 0.2, fore: 0.18, armR: 0.052, neck: 0.9, torsoY: 0.7, torsoR: 0.15, torsoL: 0.22 };
const SEAT = 0.41; // 앉았을 때 엉덩이 관절 높이 (아이 의자 앉는 면 약 0.36)

// ---- 자세: 어깨(aA 오른팔 x<0, aB 왼팔), 팔꿈치(eA, eB), 엉덩이(lA, lB), 무릎(kA, kB), 머리, 몸 기울기 ----
// 회전 x 가 음수면 앞으로. 팔꿈치는 음수로 굽히고, 무릎은 양수로 굽힌다. sit: 의자 높이로 내려앉음
const POSES = {
  stand: {},
  walk: {},
  sit: { lA: [-1.5, 0, 0.05], lB: [-1.5, 0, -0.05], kA: 1.5, kB: 1.5, aA: [-0.55, 0, -0.05], aB: [-0.55, 0, 0.05], eA: -0.9, eB: -0.9, hd: [0.08, 0, 0], sit: true },
  sitlow: { lA: [-1.85, 0, 0.1], lB: [-1.85, 0, -0.1], kA: 2.0, kB: 2.0, aA: [-0.7, 0, 0.12], aB: [-0.7, 0, -0.12], eA: -0.5, eB: -0.5, hd: [0.1, 0, 0], sit: true },
  wave: { aB: [0, 0, 2.7], eB: -0.6, hd: [0, 0, 0.08] },
  down: { hd: [0.42, 0, 0] },
  cross: { aA: [-0.25, 0, 0.3], eA: -2.0, aB: [-0.25, 0, -0.3], eB: -2.0 },
  reach: { aA: [-1.3, 0, -0.05], eA: -0.15, lean: -0.12 },
  tug: { aA: [-1.15, 0, 0.3], eA: -0.35, aB: [-1.15, 0, -0.3], eB: -0.35, lean: -0.15 },
  phone: { aA: [-0.5, 0, 0.25], eA: -2.1, hd: [0.15, 0, 0] },
  hold: { aA: [-0.55, 0, 0.2], eA: -0.9, aB: [-0.55, 0, -0.2], eB: -0.9 },
  cover: { aA: [-0.55, 0, 0.35], eA: -2.35, aB: [-0.55, 0, -0.35], eB: -2.35, hd: [0.25, 0, 0] },
  jump: { aA: [-0.15, 0, -0.55], eA: -0.5, aB: [-0.15, 0, 0.55], eB: -0.5, lA: [-0.2, 0, 0], lB: [-0.2, 0, 0], kA: 0.35, kB: 0.35, y: 0.05 },
  point: { aB: [-1.4, 0, -0.1], eB: -0.1 },
  show: { aA: [-0.75, 0, 0.12], eA: -1.65, hd: [0.02, 0, 0] }, // 쥔 것을 오른손으로 들어 보인다
  clasp: { aA: [-0.5, 0, 0.32], eA: -1.95, aB: [-0.5, 0, -0.32], eB: -1.95, hd: [0.12, 0, 0] }, // 두 손을 모은다
};
const POSE0 = { aA: [0.04, 0, -0.1], aB: [0.04, 0, 0.1], eA: -0.15, eB: -0.15, lA: [0, 0, 0], lB: [0, 0, 0], kA: 0, kB: 0, hd: [0, 0, 0], lean: 0, y: 0 };

const CH = {};
let blinkOff = false; // 컷과 얼굴 사진을 찍는 동안에는 깜빡이지 않는다
const OUT_W = 0.006; // 인물 윤곽선 두께 (m)
const FACE_TEX = FACE_W * 2; // 얼굴 무늬는 두 배 크기로 그려 가까이서도 또렷하게
// i: 등장 순서 — 층 번호(1 + i)로 써서 컷에서 이 인물만 빼거나 얼굴 사진에 이 인물만 나오게 한다
function makeChar(d, i) {
  const D = d.tall ? ADULT : KID;
  const mask = 1 << (1 + i);
  const meshes = [];
  const root = node(d.id);
  const body = node('body', root);
  const part = (m, color, parent, x = 0, y = 0, z = 0) => { put(m, charMat(color), x, y, z, parent); meshes.push(m); return m; };
  const capsule = (r, len) => MB.CreateCapsule('cap', { radius: r, height: len + 2 * r, tessellation: 16, capSubdivisions: 5 }, scene);
  const limb = (r, len, color, parent) => part(capsule(r, len), color, parent, 0, -len / 2, 0);

  const mkLeg = x => {
    const hip = node('hip', body, x, D.hip, 0);
    const knee = node('knee', hip, 0, -D.thigh, 0);
    limb(D.legR, D.thigh, d.skirt && !d.tall ? SKIN : d.pants, hip);
    limb(D.legR * 0.9, D.shin, d.skirt ? SKIN : d.pants, knee);
    const shoe = part(capsule(D.legR * 1.1, 0.07), '#4a4f63', knee, 0, -D.shin, 0.03);
    shoe.rotation.x = Math.PI / 2;
    hip.knee = knee;
    return hip;
  };
  const legA = mkLeg(-D.shX * 0.42), legB = mkLeg(D.shX * 0.42);
  const torso = part(capsule(D.torsoR, D.torsoL), d.top, body, 0, D.torsoY, 0);
  torso.scaling.set(1.08, 1, 0.8);
  if (d.inner) { // 가디건 안에 받쳐 입은 옷
    const v = part(capsule(0.045, D.torsoL * 0.85), d.inner, body, 0, D.torsoY + 0.01, D.torsoR * 0.72);
    v.scaling.z = 0.45;
  }
  const hips = d.skirt
    ? part(MB.CreateCylinder('skirt', { diameterTop: D.torsoR * 1.9, diameterBottom: D.torsoR * 3.2, height: D.hip * 0.36, tessellation: 20 }, scene), d.pants, body, 0, D.hip - D.hip * 0.1, 0)
    : part(capsule(D.torsoR * 0.95, 0.05), d.pants, body, 0, D.hip, 0);
  hips.scaling.z = 0.82;
  part(MB.CreateCylinder('neck', { diameterTop: D.torsoR * 0.8, diameterBottom: D.torsoR * 0.9, height: 0.06, tessellation: 12 }, scene), SKIN, body, 0, D.neck, 0);

  const mkArm = x => {
    const sh = node('shoulder', body, x, D.sh, 0);
    const elbow = node('elbow', sh, 0, -D.upper, 0);
    limb(D.armR, D.upper, d.top, sh);
    limb(D.armR * 0.92, D.fore, d.top, elbow);
    sh.hand = part(MB.CreateSphere('hand', { diameter: D.armR * 1.9, segments: 12 }, scene), SKIN, elbow, 0, -D.fore - 0.01, 0);
    sh.elbow = elbow;
    return sh;
  };
  const armA = mkArm(-D.shX), armB = mkArm(D.shX);

  // 머리: 처음에는 원점에서 만들어 얼굴 무늬를 머리 공에 바로 붙인 다음 몸에 단다
  const head = node('head');
  const skull = part(MB.CreateSphere('skull', { diameter: D.r * 2, segments: 32 }, scene), SKIN, head, 0, D.r, 0);
  skull.computeWorldMatrix(true);
  const faceTex = new BABYLON.DynamicTexture('face', { width: FACE_TEX, height: FACE_TEX }, scene, true);
  faceTex.hasAlpha = true;
  const faceMat = new BABYLON.StandardMaterial('face', scene);
  // 오른손 좌표계에서는 무늬 삼각형 방향이 뒤집혀 만들어져 뒷면 숨기기를 끈다
  Object.assign(faceMat, { diffuseTexture: faceTex, useAlphaFromDiffuseTexture: true, specularColor: BLACK, backFaceCulling: false });
  const face = MB.CreateDecal('face', skull, { position: V3(0, D.r, D.r), normal: V3(0, 0, 1), size: V3(D.r * 1.9, D.r * 1.9, D.r * 1.2) });
  // 무늬가 머리 공 표면과 같은 자리라 깊이 싸움에서 지지 않게, 점을 머리 가운데에서 1.2% 바깥으로 옮겨 굳힌다
  const fp = face.getVerticesData(BABYLON.VertexBuffer.PositionKind), fw = face.computeWorldMatrix(true), C = V3(0, D.r, 0);
  for (let k = 0; k < fp.length; k += 3) {
    const v = BABYLON.Vector3.TransformCoordinates(V3(fp[k], fp[k + 1], fp[k + 2]), fw).subtract(C).scale(1.012).add(C);
    fp[k] = v.x; fp[k + 1] = v.y; fp[k + 2] = v.z;
  }
  face.setVerticesData(BABYLON.VertexBuffer.PositionKind, fp);
  face.position.setAll(0);
  face.rotation.setAll(0);
  face.refreshBoundingInfo();
  face.material = faceMat;
  face.parent = head;
  face.receiveShadows = true;
  meshes.push(face);
  addHair(d, D.r, (m, color, x, y, z) => part(m, color, head, x, y, z));
  head.parent = body;
  head.position.y = D.neck + 0.02;

  // 소품: 휴대전화(phone 자세), 줄넘기 줄(jump 자세)
  const phone = part(MB.CreateBox('phone', { width: 0.06, height: 0.11, depth: 0.012 }, scene), '#3a3f52', armA.elbow, 0, -D.fore - 0.02, 0.03);
  const c = { id: d.id, d, D, r: D.r, i, mask, root, body, head, armA, armB, legA, legB, faceTex, meshes, phone, rope: null, base: 'stand', pose: 'stand', face0: 'calm', face: '', phase: i * 1.7, blinkAt: 0, blinking: false };
  setPose(c, 'jump');
  [root, ...root.getChildTransformNodes(false), ...root.getChildMeshes(false)].forEach(n => n.computeWorldMatrix(true));
  const inv = body.getWorldMatrix().clone().invert();
  const ha = BABYLON.Vector3.TransformCoordinates(armA.hand.getAbsolutePosition(), inv), hb = BABYLON.Vector3.TransformCoordinates(armB.hand.getAbsolutePosition(), inv);
  const top = D.neck + D.r * 2 + 0.25;
  const path = BABYLON.Curve3.CreateCatmullRomSpline([ha, V3(ha.x * 1.7, top * 0.75, 0.08), V3(0, top, 0.12), V3(hb.x * 1.7, top * 0.75, 0.08), hb], 10).getPoints();
  c.rope = put(MB.CreateTube('rope', { path, radius: 0.008, tessellation: 6 }, scene), '#e8505b', 0, 0, 0, body);
  meshes.push(c.rope);
  meshes.forEach(m => { m.layerMask = mask; m.isPickable = true; m.metadata = { char: d.id }; });
  meshes.forEach(m => { if (m !== face) hull(m, OUT_W); });
  setPose(c, 'stand');
  setFace(c, 'calm');
  root.setEnabled(false);
  CH[d.id] = c;
  return c;
}
// 머리카락: 머리 위와 뒤를 덮는 큰 공 + 앞머리 + 모양마다 덧붙이는 공. 값은 머리 반지름 r 단위
function addHair(d, r, part) {
  const col = d.hairColor;
  const s = (rad, x, y, z, sx = 1, sy = 1, sz = 1, color = col) => {
    const m = part(MB.CreateSphere('hair', { diameter: rad * 2 * r, segments: 24 }, scene), color, x * r, r + y * r, z * r);
    m.scaling.set(sx, sy, sz);
    return m;
  };
  s(1.08, 0, 0.07, -0.1);
  if (d.hair === 'short') s(0.5, 0.15, 0.78, 0.45, 1.5, 0.45, 0.8);
  else if (d.hair !== 'curly') for (let k = 0; k < 5; k++) { // 앞머리: 이마를 따라 작은 공 다섯 개
    const t = k / 2 - 1;
    s(0.3, t * 0.62, 0.6 - Math.abs(t) * 0.12, 0.62 - Math.abs(t) * 0.15, 1.1, 0.78, 0.7);
  }
  if (d.hair === 'bob') {
    s(0.5, -0.8, -0.38, -0.08, 0.75, 1.25, 1.1);
    s(0.5, 0.8, -0.38, -0.08, 0.75, 1.25, 1.1);
    s(0.9, 0, -0.35, -0.42, 1.15, 0.8, 0.75);
  }
  if (d.hair === 'long') {
    s(0.95, 0, -1.05, -0.5, 1.05, 1.45, 0.5);
    s(0.36, -0.84, -0.8, 0.02, 0.7, 2.0, 0.9);
    s(0.36, 0.84, -0.8, 0.02, 0.7, 2.0, 0.9);
  }
  if (d.hair === 'bun') {
    s(0.46, 0, 1.08, -0.42);
    const t = part(MB.CreateTorus('tie', { diameter: 0.62 * r, thickness: 0.16 * r, tessellation: 24 }, scene), d.tie || '#a77fd6', 0, r + 0.78 * r, -0.36 * r);
    t.rotation.x = -0.45;
  }
  if (d.hair === 'curly') {
    for (let k = 0; k < 9; k++) {
      const a = k / 9 * Math.PI * 2;
      s(0.36, Math.cos(a) * 0.74, 0.55 + Math.sin(a * 2) * 0.05, Math.sin(a) * 0.74 - 0.1);
    }
    s(0.42, -0.2, 0.92, 0.25); s(0.38, 0.25, 0.95, 0.15); s(0.34, 0, 0.75, 0.6, 1.4, 0.7, 0.8);
  }
  if (d.glasses) {
    [-0.34, 0.34].forEach(x => { part(MB.CreateTorus('glass', { diameter: 0.42 * r, thickness: 0.07 * r, tessellation: 24 }, scene), '#2f3442', x * r, r - 0.05 * r, 1.07 * r).rotation.x = Math.PI / 2; });
    part(MB.CreateBox('bridge', { width: 0.24 * r, height: 0.05 * r, depth: 0.05 * r }, scene), '#2f3442', 0, r - 0.03 * r, 1.08 * r);
  }
}
// name: 무대에서 정한 자세, over: 컷 하나에서만 바꾸는 자세 (앉아 있으면 다리와 높이는 앉은 채로)
function setPose(c, name, over) {
  const base = Object.assign({}, POSE0, POSES[name]);
  let p = base;
  if (over && over !== name) {
    p = Object.assign({}, POSE0, POSES[over]);
    if (base.sit) Object.assign(p, { lA: base.lA, lB: base.lB, kA: base.kA, kB: base.kB, sit: true });
  }
  c.armA.rotation.set(...p.aA);
  c.armB.rotation.set(...p.aB);
  c.armA.elbow.rotation.x = p.eA;
  c.armB.elbow.rotation.x = p.eB;
  c.legA.rotation.set(...p.lA);
  c.legB.rotation.set(...p.lB);
  c.legA.knee.rotation.x = p.kA;
  c.legB.knee.rotation.x = p.kB;
  c.head.rotation.set(...p.hd);
  c.body.rotation.x = p.lean;
  c.y0 = p.sit ? SEAT - c.D.hip : p.y;
  c.body.position.y = c.y0;
  c.pose = over || name;
  c.phone.setEnabled(c.pose === 'phone');
  if (c.rope) c.rope.setEnabled(c.pose === 'jump');
}
function paintFace(c, closed) {
  const g = c.faceTex.getContext();
  g.save();
  g.scale(FACE_TEX / FACE_W, FACE_TEX / FACE_W);
  drawFace(g, c.face, closed);
  g.restore();
  c.faceTex.update();
}
function setFace(c, kind) {
  if (c.face === kind && !c.blinking) return;
  c.face = kind;
  c.blinking = false;
  paintFace(c, false);
}
// spot: [x, y, z, 돌리기(도)]
function placeChar(c, spot, scale = 1) {
  c.root.position.set(spot[0], spot[1], spot[2]);
  c.root.rotation.y = spot[3] * DEG;
  c.root.scaling.setAll(scale);
  c.root.setEnabled(true);
}
const shown = c => c.root.isEnabled();
const headPos = c => BABYLON.Vector3.TransformCoordinates(V3(0, c.r, 0), c.head.getWorldMatrix());
const facing = c => V3(Math.sin(c.root.rotation.y), 0, Math.cos(c.root.rotation.y));
// 숨 쉬듯 살짝, 걷는 자세는 제자리 걸음
scene.onBeforeRenderObservable.add(() => {
  const t = performance.now() / 1000;
  for (const id in CH) {
    const c = CH[id];
    if (!shown(c)) continue;
    c.body.position.y = c.y0 + Math.sin(t * 2 + c.phase) * 0.004;
    // 눈 깜빡임: 3~6초마다 0.13초 (그리기가 쉬는 동안에는 깜빡이지 않는다)
    const ms = t * 1000;
    if (!c.blinkAt) c.blinkAt = ms + 1500 + c.phase * 700;
    if (blinkOff) continue;
    if (!c.blinking && ms > c.blinkAt) { c.blinking = true; paintFace(c, true); }
    else if (c.blinking && ms > c.blinkAt + 130) { c.blinking = false; c.blinkAt = ms + 3000 + Math.random() * 3000; paintFace(c, false); }
    if (c.pose === 'walk') {
      const s = Math.sin(t * 6 + c.phase);
      c.legA.rotation.x = s * 0.45;
      c.legB.rotation.x = -s * 0.45;
      c.legA.knee.rotation.x = Math.max(0, -s) * 0.6;
      c.legB.knee.rotation.x = Math.max(0, s) * 0.6;
      c.armA.rotation.x = -s * 0.35;
      c.armB.rotation.x = s * 0.35;
      c.body.position.y += Math.abs(s) * 0.012;
      poke();
    }
  }
});
