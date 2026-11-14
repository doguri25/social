// ===== 화질 올리기 (WebGL GLSL 셰이더 + Canvas2D): 화질 '높음'에서만 켠다 =====
// 1) 인물 재질: 빛과 그늘 경계를 부드러운 두 단계로, 그늘은 보랏빛, 밝은 쪽 가장자리에 따뜻한 빛 (게임 색과 60% 만 섞어 모습은 그대로)
// 2) 색 보정 (무대·컷 카메라 마지막 단계): 가벼운 선명도, 칙칙한 색만 맑게, 따뜻한 빛·보랏빛 그늘, 중간 밝기 대비, 가장자리, 종이 결
// 3) 창으로 드는 햇살 기둥 (sunPatches 가 만든다)
// 주소에 fx=0 을 주면 끈다 (견주어 보기), fps=1 이면 왼쪽 위에 초당 장면 수를 띄운다 (학교 기기 확인)
const FX = { want: ARGS.get('fx') !== '0', on: false, pps: [], beams: [] };

const FX_TOON = `
#ifdef FXTOON
{
  vec3 fxAlb = diffuseColor * baseColor.rgb;
  float fxL = dot(diffuseBase, vec3(0.3333));
  float fxBand = smoothstep(0.32, 0.58, fxL);
  vec3 fxTone = mix(fxAlb * vec3(0.8, 0.76, 0.87), fxAlb * vec3(1.04, 1.01, 0.97), fxBand);
  vec3 fxGlow = max(color.rgb - fxAlb * diffuseBase, vec3(0.0));
  float fxRim = pow(1.0 - clamp(dot(normalize(normalW), viewDirectionW), 0.0, 1.0), 3.0);
  color.rgb = mix(color.rgb, fxTone + fxGlow, 0.6) + fxRim * fxBand * 0.1 * vec3(1.0, 0.95, 0.86);
}
#endif
`;
class FxToon extends BABYLON.MaterialPluginBase {
  constructor(m) { super(m, 'FxToon', 210, { FXTOON: false }); this._on = FX.on; this._enable(true); }
  get on() { return this._on; }
  set on(v) { if (this._on === v) return; this._on = v; this.markAllDefinesAsDirty(); }
  prepareDefines(d) { d.FXTOON = this._on; }
  getClassName() { return 'FxToon'; }
  getCustomCode(type) { return type === 'fragment' ? { CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: FX_TOON } : null; }
}
BABYLON.RegisterClass('BABYLON.FxToon', FxToon); // 머리카락 재질은 몸 재질을 복제해 만든다 (복제할 때 이 이름으로 다시 만든다)
const fxPlugin = m => m && m.pluginManager && m.pluginManager.getPlugin('FxToon');
function fxToon(m) { if (!fxPlugin(m)) new FxToon(m); return m; }

BABYLON.Effect.ShadersStore.fxGradeFragmentShader = `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform sampler2D paperSampler;
uniform vec2 uTexel;
uniform vec2 uPaperScale;
uniform float uVignette;
void main(void) {
  vec4 src = texture2D(textureSampler, vUV);
  vec3 c = src.rgb;
  vec3 n = texture2D(textureSampler, vUV + vec2(uTexel.x, 0.0)).rgb + texture2D(textureSampler, vUV - vec2(uTexel.x, 0.0)).rgb
         + texture2D(textureSampler, vUV + vec2(0.0, uTexel.y)).rgb + texture2D(textureSampler, vUV - vec2(0.0, uTexel.y)).rgb;
  c += (c - n * 0.25) * 0.35;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  c = mix(vec3(l), c, 1.0 + 0.22 * (1.0 - sat));
  c *= mix(vec3(0.955, 0.96, 1.03), vec3(1.0, 0.995, 0.97), smoothstep(0.2, 0.8, l));
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.14 * (1.0 - smoothstep(0.62, 0.9, l)));
  vec2 q = vUV - 0.5;
  c *= 1.0 - uVignette * smoothstep(0.2, 0.9, dot(q, q) * 2.0);
  float p = texture2D(paperSampler, vUV * uPaperScale).r;
  c *= mix(0.978, 1.012, p);
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), src.a);
}`;
// 종이 결 (Canvas2D): 이음매 없이 되풀이되는 회색 점과 섬유
let fxPaperTex = null;
function fxPaper() {
  if (fxPaperTex) return fxPaperTex;
  fxPaperTex = canvasTex(512, 512, (g, W, H) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, W, H);
    let s = 7; const R = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 2600; i++) {
      const x = R() * W, y = R() * H, r = 0.6 + R() * 2, v = R() < 0.5 ? 0 : 255, a = 0.05 + R() * 0.07;
      [-W, 0, W].forEach(dx => [-H, 0, H].forEach(dy => { g.fillStyle = `rgba(${v},${v},${v},${a})`; g.beginPath(); g.arc(x + dx, y + dy, r, 0, 7); g.fill(); }));
    }
    for (let i = 0; i < 360; i++) {
      const x = R() * W, y = R() * H, a = R() * 6.28, l = 6 + R() * 20, v = R() < 0.6 ? 255 : 40;
      g.strokeStyle = `rgba(${v},${v},${v},${0.06 + R() * 0.07})`; g.lineWidth = 0.7;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
  });
  fxPaperTex.wrapU = fxPaperTex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
  return fxPaperTex;
}
function fxGrade(cam, vignette) {
  const pp = new BABYLON.PostProcess('fxGrade', 'fxGrade', ['uTexel', 'uPaperScale', 'uVignette'], ['paperSampler'], 1.0, null, BABYLON.Texture.BILINEAR_SAMPLINGMODE, engine);
  pp.onApply = e => {
    e.setFloat2('uTexel', 1 / pp.width, 1 / pp.height);
    e.setFloat2('uPaperScale', pp.width / 512, pp.height / 512);
    e.setFloat('uVignette', vignette);
    e.setTexture('paperSampler', fxPaper());
  };
  pp.fxCam = cam;
  return pp;
}

// ---- 햇살 기둥: 창에서 바닥 빛 자국까지 비스듬히 내려오는 옅은 빛 (더해 그리기, 아래로 갈수록 옅게) ----
BABYLON.Effect.ShadersStore.fxBeamVertexShader = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 worldViewProjection;
varying vec2 vUV;
void main(void) { vUV = uv; gl_Position = worldViewProjection * vec4(position, 1.0); }`;
BABYLON.Effect.ShadersStore.fxBeamFragmentShader = `
precision highp float;
varying vec2 vUV;
uniform vec3 uColor;
uniform float uStrength;
void main(void) {
  float along = vUV.y;                                     // 0: 창, 1: 바닥
  float side = smoothstep(0.0, 0.18, vUV.x) * smoothstep(1.0, 0.82, vUV.x);
  float a = uStrength * side * (1.0 - along * 0.7) * smoothstep(0.0, 0.08, along);
  float stripe = 0.85 + 0.15 * sin(vUV.x * 31.0 + vUV.y * 4.0);  // 먼지 낀 빛줄기 결
  gl_FragColor = vec4(uColor * a * stripe, 1.0);
}`;
let fxBeamMat = null;
// 창 하나: 창 네 귀퉁이(a)와 바닥 빛 자국 네 귀퉁이(b)를 이은 비스듬한 상자의 옆면 넷
function fxBeam(parent, a, b) {
  fxBeamMat = fxBeamMat || Object.assign(new BABYLON.ShaderMaterial('fxBeam', scene, 'fxBeam', { attributes: ['position', 'uv'], uniforms: ['worldViewProjection', 'uColor', 'uStrength'], needAlphaBlending: true }), {
    alphaMode: BABYLON.Engine.ALPHA_ADD, backFaceCulling: false, disableDepthWrite: true,
  });
  fxBeamMat.setColor3('uColor', C3('#ffd9a0'));
  fxBeamMat.setFloat('uStrength', 0.07);
  const pos = [], uv = [], idx = [];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4, k = pos.length / 3;
    [a[i], a[j], b[j], b[i]].forEach(p => pos.push(p.x, p.y, p.z));
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  const m = new BABYLON.Mesh('beam', scene);
  Object.assign(new BABYLON.VertexData(), { positions: pos, uvs: uv, indices: idx }).applyToMesh(m);
  m.material = fxBeamMat;
  m.parent = parent;
  m.isPickable = false;
  m.layerMask = 1;
  m.setEnabled(FX.on);
  FX.beams.push(m);
  return m;
}

// ---- 켜고 끄기: 화질 설정이 바뀔 때마다 (게임의 applyTier 끝에서) ----
function fxApply(hi) {
  FX.on = FX.want && hi;
  if (!FX.pps.length) FX.pps = [fxGrade(camera, 0.16), fxGrade(shotCam, 0.1)];
  FX.pps.forEach(pp => { pp.fxCam.detachPostProcess(pp); if (FX.on) pp.fxCam.attachPostProcess(pp); }); // 게임의 후처리 묶음보다 뒤에
  scene.materials.forEach(m => { const p = fxPlugin(m); if (p) p.on = FX.on; });
  FX.beams.forEach(m => m.setEnabled(FX.on));
}

// ---- 초당 장면 수 (학교 기기에서 느린지 볼 때): ?fps=1 ----
if (ARGS.has('fps')) {
  const box = h('div', '');
  Object.assign(box.style, { position: 'fixed', left: '6px', top: '6px', zIndex: 60, font: '13px monospace', background: 'rgba(0,0,0,.6)', color: '#fff', padding: '3px 7px', borderRadius: '6px', pointerEvents: 'none' });
  document.body.appendChild(box);
  setInterval(() => { box.textContent = `${engine.getFps().toFixed(0)} fps · ${tier}${FX.on ? ' · fx' : ''}`; }, 500);
}
