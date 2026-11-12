// ===== 인물: 몸은 기본 도형, 얼굴은 캔버스 그림을 머리에 붙인 무늬, 머리카락은 깎은 껍데기 하나. 배경 아이는 한 자세로 굳혀 합친다 =====
const SKIN = '#ffe2cc';
// 인물 재질: 만화 음영(밝은 면과 그늘 두 단계) + 가장자리 빛. StandardMaterial 의 조명 결과(diffuseBase)를 단계로 나눠 다시 칠한다
class ToonPlugin extends BABYLON.MaterialPluginBase {
  constructor(m) { super(m, 'Toon', 200, { TOON: false }); this._enable(true); }
  prepareDefines(d) { d.TOON = true; }
  getClassName() { return 'ToonPlugin'; }
  getCustomCode(type) {
    return type !== 'fragment' ? null : { CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: `
#ifdef TOON
{
  vec3 tAlb = diffuseColor * baseColor.rgb;
  vec3 tN = normalize(normalW);
  float tK = smoothstep(-0.02, 0.05, dot(normalize((view * vec4(tN, 0.0)).xyz), normalize(vec3(-0.5, 0.55, 0.62))));
  vec3 tEnv = min(diffuseBase * 1.7, vec3(1.0));
  tEnv = mix(vec3(dot(tEnv, vec3(0.3333))), tEnv, 0.5) * 0.5 + 0.5 * step(0.85, dot(tEnv, vec3(0.3333))) + 0.5 * (1.0 - step(0.85, dot(tEnv, vec3(0.3333)))) * tEnv;
  vec3 tShade = tAlb * vec3(0.90, 0.80, 0.86) * mix(vec3(1.0), tAlb, 0.15);
  float tRim = pow(1.0 - max(dot(tN, viewDirectionW), 0.0), 3.0) * tK;
  color.rgb = mix(tShade, tAlb, tK) * tEnv + tRim * 0.14 * vec3(1.0, 0.95, 0.86);
}
#endif` };
  }
}
BABYLON.RegisterClass('BABYLON.ToonPlugin', ToonPlugin);
const cmats = {};
function toon(m) { m.toon = new ToonPlugin(m); return m; }
function charMat(color) {
  if (cmats[color]) return cmats[color];
  return (cmats[color] = toon(Object.assign(new BABYLON.StandardMaterial('c' + color, scene), { diffuseColor: C3(color), specularColor: BLACK })));
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
const KID = { r: 0.24, hip: 0.27, thigh: 0.13, shin: 0.12, legR: 0.055, sh: 0.5, shX: 0.135, upper: 0.12, fore: 0.11, armR: 0.045, neck: 0.53, torsoY: 0.4, torsoR: 0.13, torsoL: 0.12 };
const ADULT = { r: 0.25, hip: 0.5, thigh: 0.24, shin: 0.23, legR: 0.065, sh: 0.86, shX: 0.17, upper: 0.2, fore: 0.18, armR: 0.052, neck: 0.9, torsoY: 0.7, torsoR: 0.15, torsoL: 0.22 };
const SEAT = 0.41; // 앉았을 때 엉덩이 관절 높이 (아이 의자 앉는 면 약 0.36)

// ---- 자세: 어깨(aA 오른팔 x<0, aB 왼팔), 팔꿈치(eA, eB), 엉덩이(lA, lB), 무릎(kA, kB), 머리, 몸 기울기(lean 앞뒤, tilt 옆) ----
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
  throw: { aA: [-3.3, 0, -0.2], eA: -1.2, aB: [-1.0, 0, 0.2], eB: -0.3, lA: [0.3, 0, 0], lB: [-0.4, 0, 0], kB: 0.25, lean: 0.12 }, // 오른팔을 머리 뒤로 젖혀 던지려는 참
  open: { aA: [-1.15, 0, -0.5], eA: -0.45, aB: [-1.15, 0, 0.5], eB: -0.45, lA: [-0.45, 0, 0.15], lB: [-0.45, 0, -0.15], kA: 0.85, kB: 0.85, lean: -0.12, y: -0.035 }, // 무릎을 굽히고 두 팔을 벌려 공을 받으려 한다
  dodge: { aA: [-0.2, 0, -1.0], eA: -0.4, aB: [-0.2, 0, 1.0], eB: -0.4, lA: [0, 0, -0.3], lB: [0, 0, 0.15], kA: 0.3, tilt: 0.28 }, // 몸을 옆으로 비킨다
  call: { aA: [-0.85, 0, 0.42], eA: -2.25, aB: [-0.85, 0, -0.42], eB: -2.25, hd: [-0.12, 0, 0] }, // 두 손을 입가에 모아 외친다
  dance: { aA: [0, 0, -2.3], eA: -0.5, aB: [0, 0, 2.3], eB: -0.5, lA: [0, 0, -0.2], kB: 0.4, tilt: -0.22, hd: [0, 0, 0.15] }, // 엉덩이춤
};
const POSE0 = { aA: [0.04, 0, -0.1], aB: [0.04, 0, 0.1], eA: -0.15, eB: -0.15, lA: [0, 0, 0], lB: [0, 0, 0], kA: 0, kB: 0, hd: [0, 0, 0], lean: 0, tilt: 0, y: 0 };

const CH = {};
let blinkOff = false; // 컷과 얼굴 사진을 찍는 동안에는 깜빡이지 않는다
const OUT_W = 0.006; // 인물 윤곽선 두께 (m)
const FACE_TEX = FACE_W * 2; // 얼굴 무늬는 두 배 크기로 그려 가까이서도 또렷하게
// i: 등장 순서 — 층 번호(1 + i)로 써서 컷에서 이 인물만 빼거나 얼굴 사진에 이 인물만 나오게 한다
// extra: 배경 아이로 쓸 몸만 만들어 돌려준다 (소품·윤곽선·CH 등록 없이)
function makeChar(d, i, extra) {
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
    limb(D.legR * 0.9, D.shin, d.skirt || (d.shorts && !d.long) ? SKIN : d.pants, knee); // 반바지면 무릎 아래는 맨살
    const shoe = part(capsule(D.legR * 1.15, 0.075), d.shoe || '#4a4f63', knee, 0, -D.shin, 0.03);
    shoe.rotation.x = Math.PI / 2;
    if (d.shoe) part(MB.CreateBox('sole', { width: D.legR * 2.2, height: 0.022, depth: 0.2 }, scene), d.sole || '#8fa0b8', knee, 0, -D.shin - D.legR * 0.95, 0.03);
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
  if (d.outfit === 'hoodie') { // 후드티: 목 뒤 모자, 밑단, 앞주머니, 가슴 글자
    const hood = part(MB.CreateSphere('hood', { diameter: D.torsoR * 2.5, segments: 14 }, scene), d.top, body, 0, D.sh + 0.005, -D.torsoR * 0.62);
    hood.scaling.set(1, 0.55, 0.72);
    const hem = part(MB.CreateCylinder('hem', { diameter: D.torsoR * 2.2, height: 0.035, tessellation: 20 }, scene), d.top, body, 0, D.hip + 0.045, 0);
    hem.scaling.z = 0.84;
    const pocket = part(capsule(0.04, D.torsoR * 0.9), d.top, body, 0, D.torsoY - D.torsoL * 0.42, D.torsoR * 0.72);
    pocket.rotation.z = Math.PI / 2; pocket.scaling.z = 0.5;
    [-1, 1].forEach(x => part(capsule(0.004, 0.045), d.cord || '#ffffff', body, x * 0.022, D.sh - 0.06, D.torsoR * 0.83));
  }
  if (d.print) { // 가슴에 찍힌 글자·번호
    const tex = canvasTex(256, 128, (g, W, H) => { g.clearRect(0, 0, W, H); g.font = '900 104px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = d.printColor || '#3f8f5f'; g.fillText(d.print, W / 2, H / 2 + 6); }, true);
    const pl = MB.CreateCylinder('print', { diameter: D.torsoR * 2.19, height: 0.085, tessellation: 24, arc: 0.3, enclose: false, cap: BABYLON.Mesh.NO_CAP, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
    part(pl, d.top, body, 0, D.torsoY + 0.03, 0);
    pl.material = toon(texMat(tex, { both: true }));
    pl.scaling.z = 0.8; pl.rotation.y = Math.PI * (d.printTurn == null ? 0.2 : d.printTurn);
    pl.noHull = true;
  }
  part(MB.CreateCylinder('neck', { diameterTop: D.torsoR * 0.8, diameterBottom: D.torsoR * 0.9, height: 0.06, tessellation: 12 }, scene), SKIN, body, 0, D.neck, 0);

  const mkArm = x => {
    const sh = node('shoulder', body, x, D.sh, 0);
    const elbow = node('elbow', sh, 0, -D.upper, 0);
    limb(D.armR, D.upper, d.top, sh);
    limb(D.armR * 0.92, D.fore, d.top, elbow);
    if (d.outfit === 'hoodie') part(MB.CreateCylinder('cuff', { diameter: D.armR * 2.25, height: 0.028, tessellation: 12 }, scene), d.top, elbow, 0, -D.fore + 0.012, 0);
    sh.hand = part(MB.CreateSphere('hand', { diameter: D.armR * 1.9, segments: 12 }, scene), SKIN, elbow, 0, -D.fore - 0.01, 0);
    sh.elbow = elbow;
    return sh;
  };
  const armA = mkArm(-D.shX), armB = mkArm(D.shX);

  // 머리: 처음에는 원점에서 만들어 얼굴 무늬를 머리 공에 바로 붙인 다음 몸에 단다
  const head = node('head');
  const skull = part(MB.CreateSphere('skull', { diameter: D.r * 2, segments: 32 }, scene), SKIN, head, 0, D.r, 0);
  [-1, 1].forEach(x => { part(MB.CreateSphere('ear', { diameter: D.r * 0.34, segments: 10 }, scene), SKIN, head, x * D.r * 0.97, D.r * 0.86, -D.r * 0.02).scaling.set(0.55, 1, 0.8); });
  skull.computeWorldMatrix(true);
  const faceTex = new BABYLON.DynamicTexture('face', { width: FACE_TEX, height: FACE_TEX }, scene, true);
  faceTex.hasAlpha = true;
  const faceMat = toon(new BABYLON.StandardMaterial('face', scene));
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
  if (extra) return { d, D, r: D.r, root, body, head, armA, armB, legA, legB, face, faceTex, meshes };

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
  meshes.forEach(m => { if (m !== face && !m.noHull) hull(m, OUT_W); });
  setPose(c, 'stand');
  setFace(c, 'calm');
  root.setEnabled(false);
  CH[d.id] = c;
  return c;
}
// 머리카락: 머리 위와 뒤를 덮는 큰 공 + 앞머리 + 모양마다 덧붙이는 공. 값은 머리 반지름 r 단위
// 머리카락 결: 머리 색 위에 밝고 어두운 가는 줄을 위아래로 긋는다 (공 모양 대신 머리카락처럼 보이게)
const hairMats = {};
function hairMat(color) {
  if (hairMats[color]) return hairMats[color];
  const tex = canvasTex(256, 256, (g, W, H) => {
    const n = parseInt(color.slice(1), 16), mix = (k, a) => `rgba(${[n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(clamp(v * k + (k > 1 ? 40 : 0), 0, 255))).join(',')},${a})`;
    const gr = g.createLinearGradient(0, 0, 0, H); // 정수리는 밝게, 끝은 조금 짙게
    gr.addColorStop(0, mix(1.12, 1)); gr.addColorStop(0.45, color); gr.addColorStop(1, mix(0.8, 1));
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    g.fillStyle = mix(1.5, 0.5); // 머리 윤기 띠 (톱니 모양)
    g.beginPath(); g.moveTo(0, H * 0.27);
    for (let x = 0; x <= W; x += 8) g.lineTo(x, H * (0.27 + ((x / 8) % 2 ? 0.035 : 0)));
    for (let x = W; x >= 0; x -= 8) g.lineTo(x, H * (0.215 - ((x / 8) % 2 ? 0.02 : 0)));
    g.fill();
    for (let i = 0; i < 110; i++) {
      const x = Math.random() * W;
      g.strokeStyle = Math.random() < 0.5 ? 'rgba(255,236,214,.07)' : 'rgba(20,10,5,.09)';
      g.lineWidth = 1 + Math.random() * 2.5;
      g.beginPath();
      g.moveTo(x, 0);
      g.bezierCurveTo(x + 6, H * 0.33, x - 6, H * 0.66, x + 2, H);
      g.stroke();
    }
  });
  tex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
  tex.uScale = 3;
  const m = toon(Object.assign(new BABYLON.StandardMaterial('hair' + color, scene), { specularColor: BLACK, diffuseTexture: tex }));
  return (hairMats[color] = m);
}
// 머리카락 껍데기: 머리보다 조금 큰 공 하나를 깎는다. 얼굴 쪽(앞머리 선 아래)과 머리 길이 아래는 머리 속으로 넣어 감춘다.
// o.hl: 앞머리 선 높이, o.scallop: 앞머리 끝 물결, o.side: 얼굴 옆을 감싸는 정도, o.bottom(z): 길이(뒤쪽 z<0), o.curl: 곱슬 굴곡
function hairShell(r, o) {
  const m = MB.CreateSphere('hair', { diameter: 2, segments: 48 }, scene);
  const pos = m.getVerticesData(BABYLON.VertexBuffer.PositionKind), idx = m.getIndices(), nor = [];
  const ss = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2];
    const hl = o.hl - o.scallop * (0.5 + 0.5 * Math.cos(x * 9.5));
    const face = ss(0.12, 0.4, z) * (1 - ss(hl - 0.06, hl + 0.06, y)) * (1 - ss(o.side, o.side + 0.12, Math.abs(x)));
    const low = o.bottom(z), below = 1 - ss(low - 0.06, low + 0.06, y);
    const cover = 1 - Math.max(face, below);
    const curl = o.curl ? o.curl * (0.5 + 0.5 * Math.sin(Math.atan2(x, z) * 9) * Math.sin(Math.acos(clamp(y, -1, 1)) * 9)) : 0;
    const k = (0.9 + (0.17 + curl) * cover) * r;
    pos[i] = x * k; pos[i + 1] = y * k + r; pos[i + 2] = z * k - 0.02 * r;
  }
  m.setVerticesData(BABYLON.VertexBuffer.PositionKind, pos);
  BABYLON.VertexData.ComputeNormals(pos, idx, nor);
  m.setVerticesData(BABYLON.VertexBuffer.NormalKind, nor);
  m.refreshBoundingInfo();
  return m;
}
// 머리 가닥: 머리 공 위 (az 좌우 각, el 높이 각) 자리에 길쭉한 덩어리를 붙인다. 값은 머리 반지름 r 단위.
// out: 0 이면 머리를 따라 아래로 흐르고 1 이면 바깥으로 뻗는다. twist: 흐르는 방향을 옆으로 튼다
function hairLock(r, az, el, len, w, t, out = 0, twist = 0, lift = 1.0) {
  const m = MB.CreateSphere('lock', { diameter: 1, segments: 10 }, scene);
  const pos = m.getVerticesData(BABYLON.VertexBuffer.PositionKind), nor = []; // 끝이 뾰족한 물방울 모양으로
  for (let i = 0; i < pos.length; i += 3) if (pos[i + 1] < 0) { const f = 1 - 0.8 * Math.pow(-pos[i + 1] * 2, 1.6); pos[i] *= f; pos[i + 2] *= f; }
  m.setVerticesData(BABYLON.VertexBuffer.PositionKind, pos);
  BABYLON.VertexData.ComputeNormals(pos, m.getIndices(), nor);
  m.setVerticesData(BABYLON.VertexBuffer.NormalKind, nor);
  const n = V3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  const down = V3(Math.sin(az) * Math.sin(el), -Math.cos(el), Math.cos(az) * Math.sin(el));
  const side = V3(Math.cos(az), 0, -Math.sin(az));
  const d = down.scale(1 - out).add(n.scale(out)).add(side.scale(twist)).normalize();
  const x = BABYLON.Vector3.Cross(d, n).normalize(), z = BABYLON.Vector3.Cross(x, d).normalize();
  m.scaling.set(w * r, len * r, t * r);
  m.rotationQuaternion = BABYLON.Quaternion.RotationQuaternionFromAxis(x, d, z);
  m.position = V3(0, r, 0).add(n.scale(r * lift)).add(d.scale(len * r * 0.36));
  return m;
}
const HAIR = {
  // 동화책 인물: 물결 단발(수아), 삐죽 솜털 머리(하준), 단정한 짧은 머리(현우), 높이 묶은 머리(보라)
  wavy: { hl: 0.36, scallop: 0.0, side: 0.86, bottom: z => -0.35 + 0.1 * z },
  fluffy: { hl: 0.46, scallop: 0.05, side: 0.9, bottom: z => -0.2 - 0.3 * Math.max(0, -z), curl: 0.08 },
  neat: { hl: 0.44, scallop: 0.05, side: 0.9, bottom: z => -0.2 - 0.32 * Math.max(0, -z) },
  pony: { hl: 0.38, scallop: 0.04, side: 0.86, bottom: z => -0.42 + 0.3 * z },
  bob: { hl: 0.33, scallop: 0.1, side: 0.8, bottom: z => -0.52 + 0.08 * z },
  long: { hl: 0.33, scallop: 0.08, side: 0.82, bottom: () => -0.4 },
  bun: { hl: 0.36, scallop: 0.06, side: 0.88, bottom: z => -0.5 + 0.3 * z },
  curly: { hl: 0.36, scallop: 0.05, side: 0.88, bottom: z => -0.35 - 0.25 * Math.max(0, -z), curl: 0.12 },
  short: { hl: 0.46, scallop: 0.03, side: 0.9, bottom: z => -0.15 - 0.3 * Math.max(0, -z) },
};
function addHair(d, r, part) {
  const hm = hairMat(d.hairColor);
  const add = (m, x = 0, y = 0, z = 0) => { part(m, d.hairColor, x, y, z); m.material = hm; return m; };
  add(hairShell(r, HAIR[d.hair] || HAIR.bob));
  const L = (...a) => { const m = hairLock(r, ...a), q = m.position; return add(m, q.x, q.y, q.z); };
  if (d.hair === 'wavy') {
    [[-0.85, -0.1], [-0.6, 0.3], [-0.36, 0.1], [-0.12, 0.34], [0.12, 0.12], [0.36, 0.36], [0.6, 0.1], [0.84, 0.3]].forEach(([az, tw]) => L(az, 0.6, 0.72, 0.36, 0.1, 0.04, tw, 1.01)); // 옆으로 넘긴 앞머리
    for (let i = 0; i < 11; i++) { // 옆과 뒤로 어깨까지 내려오는 물결
      const az = 1.12 + i * (Math.PI * 2 - 2.24) / 10;
      L(az, 0.02, 1.18, 0.5, 0.36, i % 2 ? 0.2 : 0.06, 0, 0.96);
      const f = add(MB.CreateSphere('flip', { diameter: r * 0.32, segments: 8 }, scene), Math.sin(az) * r * (i % 2 ? 1.18 : 1.08), r * 0.02, Math.cos(az) * r * (i % 2 ? 1.18 : 1.08)); // 끝이 바깥으로 말린다
      f.scaling.y = 0.8;
    }
  }
  if (d.hair === 'fluffy') {
    [-0.75, -0.4, -0.05, 0.3, 0.68].forEach((az, i) => L(az, 0.6, 0.5, 0.34, 0.15, 0.1, i % 2 ? 0.3 : -0.25));
    for (let k = 0; k < 3; k++) for (let i = 0; i < 9 - k * 2; i++) { // 삐죽삐죽 솟은 가닥
      const az = (i + (k % 2) * 0.5) * Math.PI * 2 / (9 - k * 2), el = 0.35 + k * 0.42;
      if (el < 0.5 && Math.abs(Math.atan2(Math.sin(az), Math.cos(az))) < 0.9) continue; // 얼굴 앞은 비운다
      L(az, el, 0.5, 0.36, 0.3, 0.72, (i % 2 ? 0.35 : -0.35), 0.92).scaling.z *= 1;
    }
    L(0, 1.45, 0.4, 0.34, 0.3, 0.9, 0.2, 0.95);
  }
  if (d.hair === 'neat') {
    [-0.78, -0.45, -0.12, 0.2, 0.52, 0.82].forEach((az, i) => L(az, 0.6, 0.52, 0.34, 0.14, 0.05, 0.3)); // 한쪽으로 빗은 앞머리
    [[-0.5, 1.1], [0.6, 1.2], [2.6, 0.9], [-2.4, 1.0], [3.14, 0.4], [1.9, 0.5], [-1.9, 0.5]].forEach(([az, el]) => L(az, el, 0.42, 0.4, 0.26, 0.45, 0.4, 0.93));
  }
  if (d.hair === 'pony') {
    [-0.6, -0.22, 0.16, 0.54].forEach((az, i) => L(az, 0.56, 0.5, 0.36, 0.14, 0.05, i < 2 ? 0.25 : -0.25));
    [-1.12, 1.12].forEach(az => L(az, 0.12, 0.95, 0.2, 0.15, 0.02, 0, 0.99)); // 귀 앞 옆머리
    const tie = part(MB.CreateTorus('tie', { diameter: 0.5 * r, thickness: 0.2 * r, tessellation: 20 }, scene), d.tie || '#9b6fd0', 0, r + 0.86 * r, -0.72 * r);
    tie.rotation.x = -0.95;
    [[1.98, -1.12, 0.62, 0.3], [1.66, -1.42, 0.66, 0.9], [1.22, -1.56, 0.6, 1.35], [0.8, -1.52, 0.48, 1.6], [0.46, -1.42, 0.32, 1.75]].forEach(([y, z, w, rx]) => { // 묶은 머리 꼬리: 위에서 뒤로 휘어 내려온다
      const m = add(MB.CreateSphere('tail', { diameter: 1, segments: 10 }, scene), 0, y * r, z * r);
      m.scaling.set(w * r, w * r * 1.35, w * r * 0.9);
      m.rotation.x = rx;
    });
  }
  if (d.hair === 'long') { // 어깨까지 내려오는 뒷머리: 위가 좁고 아래가 살짝 퍼지는 반쪽 원통
    const back = add(MB.CreateCylinder('hairBack', { height: 1.3 * r, diameterTop: 1.9 * r, diameterBottom: 2.15 * r, tessellation: 32, arc: 0.5, enclose: false, cap: BABYLON.Mesh.NO_CAP, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene), 0, 0.1 * r, -0.04 * r);
  }
  if (d.hair === 'bun') {
    add(MB.CreateSphere('bun', { diameter: 0.92 * r, segments: 24 }, scene), 0, r + 1.08 * r, -0.42 * r);
    const t = part(MB.CreateTorus('tie', { diameter: 0.62 * r, thickness: 0.16 * r, tessellation: 24 }, scene), d.tie || '#a77fd6', 0, r + 0.78 * r, -0.36 * r);
    t.rotation.x = -0.45;
  }
  if (d.glasses) {
    [-0.34, 0.34].forEach(x => { part(MB.CreateTorus('glass', { diameter: 0.42 * r, thickness: 0.07 * r, tessellation: 24 }, scene), '#2f3442', x * r, r - 0.05 * r, 1.07 * r).rotation.x = Math.PI / 2; });
    part(MB.CreateBox('bridge', { width: 0.24 * r, height: 0.05 * r, depth: 0.05 * r }, scene), '#2f3442', 0, r - 0.03 * r, 1.08 * r);
  }
}
// name: 무대에서 정한 자세, over: 컷 하나에서만 바꾸는 자세 (앉아 있으면 다리와 높이는 앉은 채로)
function poseVals(name, over) {
  const base = Object.assign({}, POSE0, POSES[name]);
  let p = base;
  if (over && over !== name) {
    p = Object.assign({}, POSE0, POSES[over]);
    if (base.sit) Object.assign(p, { lA: base.lA, lB: base.lB, kA: base.kA, kB: base.kB, sit: true });
  }
  return p;
}
function applyPose(c, p) {
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
  c.body.rotation.z = p.tilt;
  c.y0 = p.yy != null ? p.yy : p.sit ? SEAT - c.D.hip : p.y;
  c.body.position.y = c.y0;
}
function setPose(c, name, over) {
  applyPose(c, poseVals(name, over));
  c.pose = over || name;
  if (c.phone) c.phone.setEnabled(c.pose === 'phone');
  if (c.rope) c.rope.setEnabled(c.pose === 'jump');
}
function paintFace(c, closed) {
  const g = c.faceTex.getContext();
  g.save();
  g.scale(FACE_TEX / FACE_W, FACE_TEX / FACE_W);
  drawFace(g, c.face, closed, { eye: c.d.eye, brow: c.d.brow || c.d.hairColor, talk: c.talk });
  g.restore();
  c.faceTex.update();
}
function setFace(c, kind) {
  c.faceN = (c.faceN || 0) + 1; // 얼굴 사진이 표정을 되돌릴 때, 그 사이 새로 정해진 표정이 있는지 본다
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

// ---- 배경 아이 (반 친구, 다른 반): 같은 몸을 한 자세로 굳혀 몸 메시 하나 + 윤곽선 + 얼굴로 합친다. 무대 소품처럼 층 1, 누를 수 없음 ----
const faceMats = {};
function faceMatOf(kind) {
  if (faceMats[kind]) return faceMats[kind];
  const t = new BABYLON.DynamicTexture('faceX', { width: FACE_TEX, height: FACE_TEX }, scene, true);
  t.hasAlpha = true;
  const g = t.getContext();
  g.save();
  g.scale(FACE_TEX / FACE_W, FACE_TEX / FACE_W);
  drawFace(g, kind, false);
  g.restore();
  t.update();
  return (faceMats[kind] = Object.assign(toon(new BABYLON.StandardMaterial('faceX', scene)), { diffuseTexture: t, useAlphaFromDiffuseTexture: true, specularColor: BLACK, backFaceCulling: false }));
}
const EXTRA_TOPS = ['#f6a5a5', '#ffd98a', '#f4a259', '#f2a7c9', '#e9b4e0', '#fbe39a', '#ff8f7a', '#c8e07a']; // 살색과 헷갈리지 않는 밝은 색
const TEAM_TOPS = { b1: '#7da7e0', b3: '#6c86b8' }; // 다른 반은 푸른 옷으로 한눈에
const EXTRA_HAIR = ['short', 'bob', 'curly', 'short', 'bun', 'bob', 'short', 'long'];
function extraLook(k, team) {
  return {
    id: 'x', top: TEAM_TOPS[team] || EXTRA_TOPS[k % EXTRA_TOPS.length], pants: ['#4a5168', '#5b6b8c', '#6b5b8c', '#55606e'][k % 4], shorts: true,
    hair: EXTRA_HAIR[(k * 3 + (team === 'a' ? 0 : 1)) % EXTRA_HAIR.length], hairColor: ['#3a2a22', '#4a3326', '#2d2622', '#5a3d2b'][k % 4], tie: ['#e8708f', '#6fbfee', '#ffcf3f'][k % 3],
  };
}
// spot: [x, y, z, 돌리기(도), 자세, 표정, 반('a' 우리 반, 'b1' 1반, 'b3' 3반)], k: 생김새 번호
function makeExtra(spot, k, parent) {
  const [x, y, z, ry, pose = 'stand', face = 'calm', team = 'a'] = spot;
  const c = makeChar(extraLook(k, team), 0, true);
  setPose(c, pose);
  c.face.material.dispose();
  c.face.material = faceMatOf(face);
  c.faceTex.dispose();
  [c.root, ...c.root.getChildTransformNodes(false), ...c.meshes].forEach(n => n.computeWorldMatrix(true));
  c.face.setParent(null);
  c.face.bakeCurrentTransformIntoVertices();
  const body = BABYLON.Mesh.MergeMeshes(c.meshes.filter(m => m !== c.face), true, true, undefined, false, true);
  c.root.dispose();
  const n = node('extra', parent, x, y, z);
  n.rotation.y = ry * DEG;
  [body, c.face].forEach(m => { m.parent = n; m.isPickable = false; m.layerMask = 1; m.receiveShadows = true; });
  shadows.addShadowCaster(body);
  hull(body, OUT_W).layerMask = 1;
  n.head = V3(x, y + c.D.neck + c.D.r + 0.02 + (POSES[pose] && POSES[pose].sit ? SEAT - c.D.hip : 0), z); // 컷 카메라를 가리는지 볼 때 쓰는 머리 자리
  return n;
}
