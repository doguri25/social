// ===== 화질 올리기 (목업): WebGL GLSL 셰이더 + Canvas2D =====
// 게임 코드(엔진·화면·인물·무대)는 하나도 바꾸지 않고, 같은 모듈 끝에서 그 위에 얹는다.
//  1) GLSL 인물 재질: 빛과 그늘 경계를 또렷하게, 그늘은 보랏빛, 밝은 쪽 가장자리에 따뜻한 빛
//  2) GLSL 색 보정: 선명도, 맑은 색, 따뜻한 빛·보랏빛 그늘, 부드러운 대비, 가장자리, 종이 결 (무대와 컷 그림 모두)
//  3) Canvas2D: 얼굴을 네 배(1024)로 그려 눈·입이 또렷하게, 머리카락 결을 두 배로 촘촘하게, 종이 결 그림
// 주소에 fx=0 을 주면 꺼진 채로 시작하고, 위 가운데 단추로 켜고 끄며 견준다.
const FX = { on: ARGS.get('fx') !== '0', pps: [] };

// ---- 1) GLSL 인물 재질 ----
class FxToon extends BABYLON.MaterialPluginBase {
  constructor(m) { super(m, 'FxToon', 210, { FXTOON: false }); this._on = FX.on; this._enable(true); }
  get on() { return this._on; }
  set on(v) { if (this._on === v) return; this._on = v; this.markAllDefinesAsDirty(); }
  prepareDefines(d) { d.FXTOON = this._on; }
  getClassName() { return 'FxToon'; }
  getCustomCode(type) { return type === 'fragment' ? { CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: GLSL.toon } : null; }
}
BABYLON.RegisterClass('BABYLON.FxToon', FxToon); // 머리카락 재질은 몸 재질을 복제해 만든다 (복제할 때 이 이름으로 다시 만든다)
const fxPlugin = m => m && m.pluginManager && m.pluginManager.getPlugin('FxToon');
function fxToonOn(m) { // 인물 몸(c#…)과 머리카락(hair#…) 재질에만
  if (!m || m.getClassName() !== 'StandardMaterial' || !/^(c#|hair)/.test(m.name) || fxPlugin(m)) return;
  new FxToon(m);
}
scene.materials.forEach(fxToonOn);
scene.onNewMaterialAddedObservable.add(m => Promise.resolve().then(() => fxToonOn(m))); // 재질이 다 만들어진 뒤에

// ---- 3) Canvas2D: 종이 결, 높은 해상도 얼굴, 촘촘한 머리카락 결 ----
const fxPaper = canvasTex(512, 512, (g, W, H) => {
  g.fillStyle = '#808080'; g.fillRect(0, 0, W, H);
  let s = 7; const R = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2600; i++) { // 종이 골: 이음매 없이 되풀이되게 가장자리를 넘는 점은 반대편에도
    const x = R() * W, y = R() * H, r = 0.6 + R() * 2, v = R() < 0.5 ? 0 : 255, a = 0.05 + R() * 0.07;
    [-W, 0, W].forEach(dx => [-H, 0, H].forEach(dy => { g.fillStyle = `rgba(${v},${v},${v},${a})`; g.beginPath(); g.arc(x + dx, y + dy, r, 0, 7); g.fill(); }));
  }
  for (let i = 0; i < 360; i++) { // 섬유
    const x = R() * W, y = R() * H, a = R() * 6.28, l = 6 + R() * 20, v = R() < 0.6 ? 255 : 40;
    g.strokeStyle = `rgba(${v},${v},${v},${0.06 + R() * 0.07})`; g.lineWidth = 0.7;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
});
fxPaper.wrapU = fxPaper.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;

const FX_FACE = 1024; // 게임은 512
// 얼굴 그리기: 무늬 크기에 맞춰 늘려 그린다 (게임의 drawFace 를 그대로 쓴다)
paintFace = (c, closed) => {
  const T = c.faceTex.getSize().width, g = c.faceTex.getContext();
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.scale(T / FACE_W, T / FACE_W);
  drawFace(g, c.face, closed);
  g.restore();
  c.faceTex.update();
};
function fxFaceTex() { const t = new BABYLON.DynamicTexture('faceHD', { width: FX_FACE, height: FX_FACE }, scene, true); t.hasAlpha = true; t.anisotropicFilteringLevel = 8; return t; }
const fxMakeChar = makeChar;
makeChar = (d, i, extra) => {
  const c = fxMakeChar(d, i, extra);
  if (!extra) { // 주인공: 얼굴 무늬를 큰 것으로 바꿔 다시 그린다 (배경 아이 얼굴은 아래 faceMatOf)
    const face = c.meshes.find(m => m.material && m.material.diffuseTexture === c.faceTex);
    const t = fxFaceTex();
    face.material.diffuseTexture = t;
    c.faceTex.dispose();
    c.faceTex = t;
    paintFace(c, false);
  }
  return c;
};
faceMatOf = kind => {
  if (faceMats[kind]) return faceMats[kind];
  const t = fxFaceTex(), g = t.getContext();
  g.save(); g.scale(FX_FACE / FACE_W, FX_FACE / FACE_W); drawFace(g, kind, false); g.restore();
  t.update();
  return (faceMats[kind] = Object.assign(new BABYLON.StandardMaterial('faceX', scene), { diffuseTexture: t, useAlphaFromDiffuseTexture: true, specularColor: BLACK, backFaceCulling: false }));
};
const fxHairMat = hairMat;
hairMat = color => {
  const m = fxHairMat(color);
  if (m.fxHair) return m;
  m.fxHair = true;
  const old = m.diffuseTexture;
  const tex = canvasTex(512, 512, (g, W, H) => { // 머리카락 결: 굵기와 밝기가 다른 가는 선을 많이
    g.fillStyle = color; g.fillRect(0, 0, W, H);
    let s = 3; const R = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 260; i++) {
      const x = R() * W, light = R() < 0.45;
      g.strokeStyle = light ? `rgba(255,236,214,${0.05 + R() * 0.07})` : `rgba(20,10,5,${0.07 + R() * 0.12})`;
      g.lineWidth = 0.6 + R() * 2.2;
      g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 5, H * 0.33, x - 5, H * 0.66, x + 2, H); g.stroke();
    }
  });
  tex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
  tex.uScale = 3;
  m.diffuseTexture = tex;
  if (old) old.dispose();
  return m;
};

// ---- 2) GLSL 색 보정: 무대 카메라와 컷 카메라 끝에 ----
BABYLON.Effect.ShadersStore.fxGradeFragmentShader = GLSL.grade;
function fxGrade(cam, vignette) {
  const pp = new BABYLON.PostProcess('fxGrade', 'fxGrade', ['uTexel', 'uPaperScale', 'uVignette'], ['paperSampler'], 1.0, null, BABYLON.Texture.BILINEAR_SAMPLINGMODE, engine);
  pp.onApply = e => {
    e.setFloat2('uTexel', 1 / pp.width, 1 / pp.height);
    e.setFloat2('uPaperScale', pp.width / 512, pp.height / 512);
    e.setFloat('uVignette', vignette);
    e.setTexture('paperSampler', fxPaper);
  };
  pp.fxCam = cam;
  FX.pps.push(pp);
  return pp;
}
fxGrade(camera, 0.16);
fxGrade(shotCam, 0.1);
// 맨 뒤에 붙인다 (화질 설정을 바꾸면 게임이 후처리 묶음을 새로 만들어서, 그때마다 다시 맨 뒤로)
function fxAttach() {
  FX.pps.forEach(pp => { pp.fxCam.detachPostProcess(pp); if (FX.on) pp.fxCam.attachPostProcess(pp); });
}

// ---- 후처리 붙이기 ----
// 해 본 것: 발밑이 또렷한 그림자(PCSS)는 학교 기기에 너무 무겁고, 화면 해상도를 두 배로 올리면 빛 번짐이 세져 흰 탁자·종이가 날아가서 뺐다
function fxRender() {
  fxAttach();
  poke();
}
const fxApplyTier = applyTier;
applyTier = () => { fxApplyTier(); fxRender(); };

// ---- 켜고 끄며 견주기 ----
async function fxSet(on) {
  FX.on = on;
  scene.materials.forEach(m => { const p = fxPlugin(m); if (p) p.on = on; });
  fxRender();
  fxBtn.textContent = on ? '화질 올림 · 켜짐' : '화질 올림 · 꺼짐 (지금 게임)';
  fxBtn.setAttribute('aria-pressed', on);
  const e = hist[hi]; // 옆 칸의 컷 그림도 다시 찍는다
  if (e && e.img && e.p && e.p.text == null && !e.p.phone && !e.p.note && !making) {
    applyCut(e.p);
    const w = panelW();
    e.img = await shoot(e.p, w, Math.round(w / 1.6));
    renderEntry();
  }
}
const fxBtn = h('button', 'fxchip');
fxBtn.type = 'button';
Object.assign(fxBtn.style, {
  position: 'fixed', top: '6px', left: '50%', transform: 'translateX(-50%)', zIndex: 60, font: '15px Jua, sans-serif',
  padding: '5px 14px', borderRadius: '999px', border: '2px solid #3b302b', background: '#fff6d6', color: '#3b302b', cursor: 'pointer',
});
fxBtn.onclick = () => fxSet(!FX.on);
fxBtn.textContent = FX.on ? '화질 올림 · 켜짐' : '화질 올림 · 꺼짐 (지금 게임)';
document.body.appendChild(fxBtn);

// ---- 목업: 1권 첫 장면의 두 번째 컷까지 저절로 넘긴다 ----
if (ARGS.has('mock')) (async () => {
  const until = async (f, ms = 60000) => { const t0 = performance.now(); while (!f()) { if (performance.now() - t0 > ms) return; await sleep(120); } };
  await until(() => askKind === 'intro' && !$('#btnNext').disabled);
  for (let i = 0; i < 2; i++) {
    await until(() => !$('#btnNext').disabled && !$('.pic.playing'));
    await sleep(500);
    $('#btnNext').click();
    await sleep(600);
    await until(() => $('.pic > img'));
  }
})();
