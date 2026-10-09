// ===== 3D 기본 (Babylon.js): 엔진, 카메라, 빛, 재질, 모델, 벽 자르기, 화질, 그리기 =====
const canvas = $('#gl');
const engine = new BABYLON.Engine(canvas, true, { stencil: true, powerPreference: 'high-performance' }, true);
const scene = new BABYLON.Scene(engine);
// three 판에서 쓰던 오른손 좌표계: 인물의 앞이 +z 라서 자세와 자리 값을 그대로 쓴다
scene.useRightHandedSystem = true;
const BG = '#f3eadb', BG_NIGHT = '#2c3350';
scene.clearColor = BABYLON.Color4.FromHexString(BG + 'ff');
scene.skipPointerMovePicking = true;
const MB = BABYLON.MeshBuilder;
const V3 = (x = 0, y = 0, z = 0) => new BABYLON.Vector3(x, y, z);
const C3 = s => BABYLON.Color3.FromHexString(s);
const BLACK = BABYLON.Color3.Black();
const DEG = Math.PI / 180;

// ---- 카메라: 무대 가운데를 보며 빙 돌린다 (끌기, 두 손가락, 휠, 방향키) ----
const camera = new BABYLON.ArcRotateCamera('cam', 1.1, 0.95, 7, V3(0, 0.6, 0), scene);
Object.assign(camera, {
  lowerBetaLimit: 0.35, upperBetaLimit: 1.5, panningSensibility: 0, wheelDeltaPercentage: 0.01, pinchDeltaPercentage: 0.004,
  angularSensibilityX: 900, angularSensibilityY: 1500, inertia: 0.86, minZ: 0.1, maxZ: 80,
});
camera.layerMask = 0xffffffff;
camera.attachControl(canvas, true);
let camFov = 40;
// 무대마다 처음 카메라 자리 (defs 의 wide)
function homeCam(def) {
  const w = def.wide;
  camera.target = V3(...w.target);
  camera.lowerRadiusLimit = camera.upperRadiusLimit = null; // 앞 무대의 확대 한계에 거리가 잘리지 않게
  camera.setPosition(V3(...w.pos));
  camera.lowerRadiusLimit = camera.radius * 0.5;
  camera.upperRadiusLimit = camera.radius * 1.6;
  camFov = w.fov || 40;
  fitCam();
  poke();
}
// 세로로 긴 화면에서는 가로 시야를 고정해 무대 양옆이 잘리지 않게
function fitCam() {
  const narrow = engine.getAspectRatio(camera) < 1.15;
  const v = camFov * DEG;
  camera.fovMode = narrow ? BABYLON.Camera.FOVMODE_HORIZONTAL_FIXED : BABYLON.Camera.FOVMODE_VERTICAL_FIXED;
  camera.fov = narrow ? 2 * Math.atan(Math.tan(v / 2) * 1.5) : v;
}

// ---- 빛: 하늘빛 + 햇빛(부드러운 그림자) + 밤에 켜는 스탠드 ----
const hemi = new BABYLON.HemisphericLight('hemi', V3(0.25, 1, 0.35), scene);
const SUN_DIR = V3(0.62, -0.72, 0.32).normalize();
const sun = new BABYLON.DirectionalLight('sun', SUN_DIR, scene);
sun.position = SUN_DIR.scale(-12);
const lamp = new BABYLON.PointLight('lamp', V3(0, 1, 0), scene);
Object.assign(lamp, { diffuse: C3('#ffc27a'), range: 6, intensity: 0 });
[hemi, sun, lamp].forEach(l => { l.specular = BLACK; });
const shadows = new BABYLON.ShadowGenerator(2048, sun);
Object.assign(shadows, { usePercentageCloserFiltering: true, bias: 0.0015, normalBias: 0.012 });
shadows.setDarkness(0.15);
scene.imageProcessingConfiguration.contrast = 1.08;
function setLight(mode, lampAt) {
  const night = mode === 'night';
  Object.assign(hemi, { diffuse: C3(night ? '#9aa8e0' : '#fff7ec'), groundColor: C3(night ? '#2c3150' : '#c9b597'), intensity: night ? 0.38 : 0.72 });
  Object.assign(sun, { diffuse: C3(night ? '#8fa3ff' : '#ffe7c2'), intensity: night ? 0.25 : 1.05 });
  lamp.intensity = night ? 1.6 : 0;
  if (lampAt) lamp.position = V3(...lampAt);
  scene.clearColor = BABYLON.Color4.FromHexString((night ? BG_NIGHT : BG) + 'ff');
  canvas.parentElement.style.background = night ? BG_NIGHT : BG;
}

// ---- 재질과 기본 도형 ----
const mats = {};
function mat(color) {
  return mats[color] || (mats[color] = Object.assign(new BABYLON.StandardMaterial(color, scene), { diffuseColor: C3(color), specularColor: BLACK }));
}
const INK = C3('#4a3428');
// 윤곽선: 오른손 좌표계에서는 부풀린 깊이가 앞면에 쓰여서, 윤곽선 두께 안쪽에 붙은 물건(종이, 얼굴 무늬)은 가려진다
function ink(m, w = 0.006) { m.renderOutline = true; m.outlineColor = INK; m.outlineWidth = w; return m; }
// 층(layerMask): 무대 물건은 1번 칸, 인물은 저마다 한 칸씩 (컷에서 가리는 아이를 빼고, 얼굴 사진에는 그 아이만 나오게).
// 모든 물건은 solid / sheet / lay 를 거치므로 여기서 정한다 (onNewMeshAddedObservable 은 늦게 불려 인물 칸을 덮어써서 쓰지 않는다)
function solid(m, cast = true) { m.receiveShadows = true; m.isPickable = false; m.layerMask = 1; if (cast) shadows.addShadowCaster(m); return m; }
function node(name, parent, x = 0, y = 0, z = 0) { const n = new BABYLON.TransformNode(name, scene); n.parent = parent || null; n.position.set(x, y, z); return n; }
function put(m, color, x, y, z, parent, cast) { m.material = typeof color === 'string' ? mat(color) : color; m.position.set(x, y, z); m.parent = parent || null; return solid(m, cast); }
const box = (w, h, d, color, x, y, z, parent, cast = true) => put(MB.CreateBox('box', { width: w, height: h, depth: d }, scene), color, x, y, z, parent, cast);
const cyl = (rt, rb, h, color, x, y, z, parent, seg = 24) => put(MB.CreateCylinder('cyl', { diameterTop: rt * 2, diameterBottom: rb * 2, height: h, tessellation: seg }, scene), color, x, y, z, parent);
const ball = (r, color, x, y, z, parent, seg = 18) => put(MB.CreateSphere('ball', { diameter: r * 2, segments: seg }, scene), color, x, y, z, parent);
function canvasTex(w, h, draw, alpha = false) {
  const t = new BABYLON.DynamicTexture('tex', { width: w, height: h }, scene, true);
  draw(t.getContext(), w, h);
  t.update();
  t.hasAlpha = alpha;
  t.anisotropicFilteringLevel = 8;
  return t;
}
function texMat(tex, o = {}) {
  const m = new BABYLON.StandardMaterial('texMat', scene);
  m.diffuseTexture = tex;
  m.specularColor = BLACK;
  if (tex && tex.hasAlpha) m.useAlphaFromDiffuseTexture = true;
  if (o.glow) { m.emissiveTexture = tex; m.disableLighting = true; }
  if (o.both) m.backFaceCulling = false;
  return m;
}
// 오른손 좌표계에서는 판에 붙인 그림이 좌우로 뒤집혀 보여서 u 를 되돌린다
function flipU(m) {
  const uv = m.getVerticesData(BABYLON.VertexBuffer.UVKind);
  for (let i = 0; i < uv.length; i += 2) uv[i] = 1 - uv[i];
  m.setVerticesData(BABYLON.VertexBuffer.UVKind, uv);
  return m;
}
// 그림 붙인 세운 판: ry=0 이면 그림 면이 +z 쪽을 본다
function sheet(w, h, tex, x, y, z, ry, parent, o = {}) {
  const m = flipU(MB.CreatePlane('sheet', { width: w, height: h }, scene));
  m.material = texMat(tex, o);
  m.position.set(x, y, z);
  m.rotation.y = Math.PI + ry * DEG;
  m.parent = parent || null;
  m.receiveShadows = !o.glow;
  m.isPickable = false;
  m.layerMask = 1;
  return m;
}
// 바닥에 눕힌 그림 (지도, 바닥 무늬, 햇빛 자국): 위에서 보면 그림 윗변이 -z 쪽
function lay(w, d, tex, x, y, z, parent, o = {}) {
  const m = flipU(MB.CreateGround('lay', { width: w, height: d }, scene));
  m.material = texMat(tex, o);
  m.position.set(x, y, z);
  m.parent = parent || null;
  m.receiveShadows = !o.glow;
  m.isPickable = false;
  m.layerMask = 1;
  return m;
}
// 글씨 한 줄 쓰기
function write(g, text, x, y, size, color) {
  g.font = `${size}px Jua, "Apple SD Gothic Neo", sans-serif`;
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, x, y);
}
// 둥근 네모 판 (상자 둘 + 모서리 원기둥 넷을 하나로)
function roundSlab(w, d, r, h, y, color, parent) {
  const parts = [MB.CreateBox('s', { width: w - 2 * r, height: h, depth: d }, scene), MB.CreateBox('s', { width: w, height: h, depth: d - 2 * r }, scene)];
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const c = MB.CreateCylinder('s', { diameter: r * 2, height: h, tessellation: 40 }, scene);
    c.position.set(sx * (w / 2 - r), 0, sz * (d / 2 - r));
    parts.push(c);
  });
  return put(BABYLON.Mesh.MergeMeshes(parts, true), color, 0, y, 0, parent, false);
}

// ---- 모델 (Kenney CC0): 빌드 때 MODELS 에 base64 로 들어온다. 집·나무는 색 지도(colormap) 그림을 쓴다 ----
const MODEL = {};
let colormapImg = null;
async function loadModels() {
  colormapImg = new Image();
  colormapImg.src = COLORMAP;
  await colormapImg.decode();
  const bytes = s => Uint8Array.from(atob(s), ch => ch.charCodeAt(0));
  const opts = { pluginExtension: '.glb', pluginOptions: { gltf: { preprocessUrlAsync: u => Promise.resolve(/colormap\.png$/.test(u) ? COLORMAP : u) } } };
  await Promise.all(Object.entries(MODELS).map(async ([name, data]) => {
    const ct = await BABYLON.LoadAssetContainerAsync(bytes(data), scene, opts);
    // 물리 재질을 무광 그림책 재질로 (glTF 색은 선형값이라 감마로 되돌린다)
    const conv = new Map();
    ct.meshes.forEach(m => {
      const p = m.material;
      if (!p) return;
      if (!conv.has(p)) conv.set(p, Object.assign(new BABYLON.StandardMaterial(p.name, scene), { diffuseColor: (p.albedoColor || BABYLON.Color3.White()).toGammaSpace(), diffuseTexture: p.albedoTexture || null, specularColor: BLACK }));
      m.material = conv.get(p);
    });
    MODEL[name] = ct;
  }));
}
// 집 지붕 색 바꾸기: 색 지도 그림의 초록 지붕 칸만 다른 색으로
const roofCache = {};
function roofTex(hex, like) {
  if (roofCache[hex]) return roofCache[hex];
  const c = document.createElement('canvas');
  c.width = colormapImg.width;
  c.height = colormapImg.height;
  const g = c.getContext('2d');
  g.drawImage(colormapImg, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
  const n = parseInt(hex.slice(1), 16), T = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  for (let i = 0; i < d.length; i += 4) {
    if (Math.abs(d[i] - 97) + Math.abs(d[i + 1] - 203) + Math.abs(d[i + 2] - 139) < 40) { d[i] = T[0]; d[i + 1] = T[1]; d[i + 2] = T[2]; }
  }
  g.putImageData(img, 0, 0);
  return (roofCache[hex] = new BABYLON.Texture(c.toDataURL(), scene, { invertY: like.invertY, samplingMode: like.samplingMode }));
}
// 모델 하나 놓기. w/h/d 가운데 준 값으로 크기를 맞추고(여럿이면 축마다 따로), 바닥을 y 에 둔다.
// color: { 재질이름: 색 }, roof: 지붕 색, ry: 돌리기(도), ink: 윤곽선 두께
function model(name, o = {}) {
  const inst = MODEL[name].instantiateModelsToScene(n => n, true, { doNotInstantiate: true });
  const pivot = node(name);
  const inner = node(name + '-in', pivot);
  inst.rootNodes.forEach(r => { r.parent = inner; });
  const meshes = pivot.getChildMeshes();
  meshes.forEach(m => m.computeWorldMatrix(true));
  const { min, max } = inner.getHierarchyBoundingVectors(true);
  const size = max.subtract(min);
  const ratio = { w: o.w / size.x, h: o.h / size.y, d: o.d / size.z };
  const given = ['w', 'h', 'd'].filter(a => o[a]);
  const base = o.s || (given.length ? ratio[given[0]] : 1);
  const k = V3(o.w ? ratio.w : base, o.h ? ratio.h : base, o.d ? ratio.d : base);
  inner.scaling = k;
  inner.position = V3(-(min.x + max.x) / 2 * k.x, -min.y * k.y, -(min.z + max.z) / 2 * k.z);
  pivot.position.set(o.x || 0, o.y || 0, o.z || 0);
  pivot.rotation.y = (o.ry || 0) * DEG;
  pivot.parent = o.parent || null;
  meshes.forEach(m => {
    solid(m, o.cast !== false);
    if (!m.material) return; // glTF 맨 위 __root__ 는 재질 없는 빈 메시
    const c = o.color && o.color[m.material.name];
    if (c) m.material.diffuseColor = C3(c);
    if (o.roof && m.material.diffuseTexture) m.material.diffuseTexture = roofTex(o.roof, m.material.diffuseTexture);
    if (o.ink) ink(m, o.ink);
  });
  return pivot;
}

// ---- 벽 자르기: 카메라와 무대 사이에 오는 벽 묶음은 스르르 사라진다 ----
// 벽 묶음의 안쪽 좌표: x 는 벽을 따라, +z 는 방 안쪽. side: 이 벽이 방의 어느 쪽인지
const SIDES = { back: [0, 0, -1], left: [90, -1, 0], right: [-90, 1, 0], front: [180, 0, 1] };
let building = null; // 지금 만드는 무대 (벽 묶음을 모은다)
function wallGroup(parent, side, x, z) {
  const [ry, nx, nz] = SIDES[side];
  const n = node(side, parent, x, 0, z);
  n.rotation.y = ry * DEG;
  building.walls.push({ node: n, n: [nx, nz], vis: 1, meshes: null });
  return n;
}
function wallMeshes(w) { return w.meshes || (w.meshes = w.node.getChildMeshes()); }
function updateWalls(instant) {
  if (!stageNow) return;
  const dx = camera.position.x - camera.target.x, dz = camera.position.z - camera.target.z;
  const L = Math.hypot(dx, dz) || 1;
  let moving = false;
  stageNow.walls.forEach(w => {
    const want = (w.n[0] * dx + w.n[1] * dz) / L > 0.05 ? 0 : 1;
    if (Math.abs(w.vis - want) < 0.001) return;
    w.vis = instant || w.vis < 0 ? want : w.vis + clamp(want - w.vis, -0.1, 0.1);
    wallMeshes(w).forEach(m => { m.visibility = w.vis; });
    w.node.setEnabled(w.vis > 0.01);
    moving = true;
  });
  if (moving) poke();
}
scene.onBeforeRenderObservable.add(() => updateWalls(false));
// 컷 찍기: 컷 카메라가 벽 바깥에 있을 때만 그 벽을 뺀다. 찍은 뒤 restoreWalls 로 무대 카메라 기준으로 되돌린다
function wallsForShot(pos) {
  stageNow.walls.forEach(w => {
    const p = w.node.getAbsolutePosition();
    w.node.setEnabled((pos.x - p.x) * w.n[0] + (pos.z - p.z) * w.n[1] < 0);
    wallMeshes(w).forEach(m => { m.visibility = 1; });
    w.vis = -1;
  });
}
function restoreWalls() { updateWalls(true); }

// ---- 화질: 높음(그늘, 빛 번짐, 계단 없는 선) / 낮음. 「자동」은 처음 90장이 느리면 낮춘다 ----
let pipe = null, ssao = null, slowDevice = false, tier = 'high';
function applyTier() {
  tier = save.set.q === 'auto' ? (slowDevice ? 'low' : 'high') : save.set.q;
  const hi = tier === 'high';
  if (pipe) pipe.dispose();
  if (ssao) ssao.dispose();
  ssao = null;
  engine.setHardwareScalingLevel(hi ? 1 / Math.min(window.devicePixelRatio || 1, 1.5) : 1);
  // 순서: 그늘(SSAO)을 먼저 붙여야 그 위에 빛 번짐이 얹힌다
  if (hi && engine.webGLVersion >= 2 && BABYLON.SSAO2RenderingPipeline.IsSupported) {
    ssao = new BABYLON.SSAO2RenderingPipeline('ssao', scene, { ssaoRatio: 0.5, blurRatio: 1 }, [camera]);
    Object.assign(ssao, { radius: 0.45, totalStrength: 1.1, base: 0.12, samples: 16, maxZ: 30, minZAspect: 0.4, expensiveBlur: true });
  }
  pipe = new BABYLON.DefaultRenderingPipeline('pipe', false, scene, [camera]);
  pipe.imageProcessingEnabled = false; // 색 보정은 재질에서 (웹툰 컷 찍기에도 같은 색이 나오게)
  pipe.samples = hi ? 4 : 1;
  pipe.fxaaEnabled = !hi;
  pipe.bloomEnabled = hi;
  Object.assign(pipe, { bloomThreshold: 0.86, bloomWeight: 0.2, bloomKernel: 48, bloomScale: 0.5 });
  shadows.filteringQuality = hi ? BABYLON.ShadowGenerator.QUALITY_HIGH : BABYLON.ShadowGenerator.QUALITY_LOW;
  poke();
}

// ---- 그리기: 무언가 움직일 때만. 15초 가만히 두면 쉰다 ----
let lastPoke = 0, paused = false, frames = 0, ftime = 0;
function poke() { lastPoke = performance.now(); }
camera.onViewMatrixChangedObservable.add(poke);
canvas.addEventListener('pointerdown', poke);
engine.runRenderLoop(() => {
  if (paused || performance.now() - lastPoke > 15000) return;
  scene.render();
  if (save.set.q === 'auto' && !slowDevice && frames < 90) {
    frames++;
    ftime += engine.getDeltaTime();
    if (frames === 90 && ftime / 90 > 45) { slowDevice = true; applyTier(); }
  }
});
new ResizeObserver(() => { engine.resize(); fitCam(); poke(); }).observe(canvas.parentElement);
