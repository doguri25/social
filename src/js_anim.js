// ===== 컷 애니메이션: 컷이 처음 나올 때 한 번, 인물이 움직이고 카메라가 다가간 뒤 멈춘 삽화가 된다 =====
// 그림은 무대 그대로다 (컷 카메라로 작게 여러 장 찍어 이어 보여 주고, 끝나면 원래 크기의 삽화 한 장으로 바꾼다).
// 컷의 anim: { 인물 id: [[때(0~1), 자세, 표정], ...], cam: { turn 도, back 배, up m }, cheer: 반 아이들이 들썩이는 정도 }
const easeIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
function mixPose(c, a, b, t) {
  const o = {}, y = p => (p.sit ? SEAT - c.D.hip : p.y);
  ['aA', 'aB', 'lA', 'lB', 'hd'].forEach(k => { o[k] = a[k].map((v, i) => lerp(v, b[k][i], t)); });
  ['eA', 'eB', 'kA', 'kB', 'lean', 'tilt'].forEach(k => { o[k] = lerp(a[k], b[k], t); });
  o.yy = lerp(y(a), y(b), t);
  return o;
}
// ---- 표정에 맞는 연기: 자세 값 pv 에 움직임을 더한다. w: 세기(처음과 끝에 0), s: 지난 초, c: 인물, sit: 앉아 있음 ----
const addV = (pv, k, i, v) => { pv[k] = pv[k].slice(); pv[k][i] += v; };
const toward = (pv, tg, k) => { for (const key in tg) pv[key] = Array.isArray(tg[key]) ? pv[key].map((v, i) => lerp(v, tg[key][i], k)) : lerp(pv[key], tg[key], k); };
const MOVES = {
  // 기쁨: 폴짝폴짝 뛰며 한 팔을 높이 흔든다
  joy(pv, w, s, c, sit) {
    const hop = Math.abs(Math.sin(s * 5.2));
    pv.yy += hop * (sit ? 0.02 : 0.075) * w;
    if (!sit) { pv.kA += (1 - hop) * 0.5 * w; pv.kB += (1 - hop) * 0.5 * w; addV(pv, 'lA', 0, -(1 - hop) * 0.25 * w); addV(pv, 'lB', 0, -(1 - hop) * 0.25 * w); }
    toward(pv, { aB: [0, 0, 2.5 + Math.sin(s * 6.5) * 0.3], eB: -0.5 - Math.sin(s * 6.5) * 0.25 }, w * 0.9);
    addV(pv, 'hd', 2, Math.sin(s * 5.2) * 0.1 * w);
  },
  // 웃음: 몸을 젖히고 어깨를 들썩인다
  laugh(pv, w, s, c, sit) {
    pv.yy += (Math.sin(s * 7) * 0.5 + 0.5) * 0.012 * w;
    pv.lean -= (0.1 + Math.sin(s * 2.6) * 0.06) * w;
    addV(pv, 'hd', 0, (-0.16 + Math.sin(s * 7) * 0.04) * w);
    toward(pv, { aA: [-0.5, 0, 0.3], eA: -1.7, aB: [-0.5, 0, -0.3], eB: -1.7 }, w * (c.held ? 0 : 0.7));
    pv.tilt += Math.sin(s * 3.1) * 0.08 * w;
  },
  // 화남: 몸을 내밀고 주먹 쥔 팔을 떨며 발을 구른다
  angry(pv, w, s, c, sit) {
    pv.lean += 0.14 * w;
    const st = Math.max(0, Math.sin(s * 5));
    if (!sit) { addV(pv, 'lA', 0, -st * 0.55 * w); pv.kA += st * 0.8 * w; pv.yy += (st < 0.1 ? -0.008 : 0) * w; }
    toward(pv, { aA: [0.1, 0, -0.5], eA: -0.5, aB: [0.1, 0, 0.5], eB: -0.5 }, w * 0.8);
    addV(pv, 'hd', 0, 0.08 * w);
  },
  // 슬픔·속상함: 고개와 어깨가 처지고 천천히 흔들린다, 가끔 훌쩍
  sad(pv, w, s) {
    addV(pv, 'hd', 0, (0.22 + (Math.sin(s * 4.2) > 0.93 ? 0.08 : 0)) * w);
    addV(pv, 'hd', 2, Math.sin(s * 1.6) * 0.07 * w);
    pv.yy -= 0.015 * w;
    pv.tilt += Math.sin(s * 1.3) * 0.05 * w;
    addV(pv, 'aA', 2, 0.12 * w); addV(pv, 'aB', 2, -0.12 * w);
  },
  // 놀람: 움찔 뒤로 물러서며 팔을 벌린다 (아래 jolt)
  surprised(...a) { MOVES.jolt(...a); },
  // 걱정: 두리번거리고 손을 모았다 놓는다
  worried(pv, w, s) {
    addV(pv, 'hd', 1, Math.sin(s * 2.8) * 0.4 * w);
    toward(pv, { aA: [-0.5, 0, 0.32], eA: -1.9, aB: [-0.5, 0, -0.32], eB: -1.9 }, w * (0.5 + 0.3 * Math.sin(s * 2.8)));
    pv.yy += Math.sin(s * 5.6) * 0.004 * w;
  },
  // 수줍음: 몸을 배배 꼬고 발끝으로 바닥을 민다
  shy(pv, w, s, c, sit) {
    c.root.rotation.y = c.ry0 + Math.sin(s * 2.4) * 0.3 * w;
    addV(pv, 'hd', 0, 0.15 * w); addV(pv, 'hd', 2, Math.sin(s * 2.4) * 0.12 * w);
    if (!sit) { addV(pv, 'lB', 0, (-0.25 + Math.sin(s * 4.8) * 0.15) * w); pv.kB += 0.3 * w; }
    toward(pv, { aA: [0.25, 0, 0.25], eA: -0.4, aB: [0.25, 0, -0.25], eB: -0.4 }, w * 0.8);
  },
  // 하품·울음
  yawn(pv, w, s) { toward(pv, { aA: [0, 0, -2.6], eA: -0.9, aB: [-0.6, 0, -0.3], eB: -2.2 }, w * 0.9); pv.lean -= 0.1 * w; addV(pv, 'hd', 0, -0.2 * w); },
  cry(pv, w, s) { toward(pv, { aA: [-0.55, 0, 0.35], eA: -2.35, aB: [-0.55, 0, -0.35], eB: -2.35 }, w * 0.9); addV(pv, 'hd', 0, (0.2 + (Math.sin(s * 5) * 0.5 + 0.5) * 0.08) * w); pv.yy += (Math.sin(s * 5) * 0.5 + 0.5) * 0.01 * w; },
  // 평온: 몸무게를 옮기며 고개를 끄덕인다
  calm(pv, w, s, c, sit) {
    pv.tilt += Math.sin(s * 1.9) * 0.05 * w;
    addV(pv, 'hd', 0, Math.max(0, Math.sin(s * 4)) * 0.12 * w);
    if (sit) { pv.kA += Math.sin(s * 3.2) * 0.3 * w; pv.kB -= Math.sin(s * 3.2) * 0.3 * w; } // 앉은 아이는 다리를 흔든다
  },
};
MOVES.hurt = MOVES.sad;
// ---- 이야기에 맞춰 컷에서 고르는 동작 (anim 의 넷째 값) ----
Object.assign(MOVES, {
  // 엉덩이춤: 엉덩이를 좌우로 씰룩이며 두 팔을 번갈아 든다
  dance(pv, w, s, c) {
    const b = Math.sin(s * 6.5);
    pv.tilt += b * 0.3 * w; pv.yy += Math.abs(b) * 0.03 * w;
    c.root.rotation.y = c.ry0 + Math.sin(s * 3.25) * 0.5 * w;
    toward(pv, { aA: [0, 0, -2.2 - b * 0.5], eA: -0.6, aB: [0, 0, 2.2 - b * 0.5], eB: -0.6 }, w * 0.9);
    addV(pv, 'hd', 2, -b * 0.2 * w);
    pv.kA += Math.max(0, b) * 0.5 * w; pv.kB += Math.max(0, -b) * 0.5 * w;
  },
  // 적기: 한 손에 든 수첩에 다른 손으로 또박또박 적고, 가끔 고개를 들어 본다
  write(pv, w, s) {
    const look = sstep(0.75, 0.9, Math.sin(s * 1.7));
    toward(pv, { aA: [-1.05, 0, 0.2], eA: -1.75, aB: [-1.05, 0, -0.5 + Math.sin(s * 8) * 0.05], eB: -1.6 + Math.sin(s * 4) * 0.08 }, w * 0.95); // 수첩과 적는 손을 얼굴 가까이 올려 가까운 컷에서도 보이게
    addV(pv, 'hd', 0, (0.3 - look * 0.3) * w);
    
  },
  // 여럿과 인사: 이쪽저쪽을 보며 손을 흔든다
  greet(pv, w, s) {
    const side = Math.sin(s * 2.6);
    addV(pv, 'hd', 1, side * 0.55 * w);
    toward(pv, { aB: [0, 0, 2.5 + Math.sin(s * 6.5) * 0.3], eB: -0.6 }, w * sstep(-0.2, 0.3, side));
    toward(pv, { aA: [0, 0, -2.5 - Math.sin(s * 6.5) * 0.3], eA: -0.6 }, w * sstep(-0.2, 0.3, -side));
    pv.yy += Math.abs(Math.sin(s * 5.2)) * 0.02 * w;
  },
  // 든 것을 번쩍번쩍 들어 올린다 (공 자랑)
  pump(pv, w, s) {
    const b = Math.max(0, Math.sin(s * 6));
    toward(pv, { aA: [-2.2 - b * 0.7, 0, -0.1], eA: -0.9 + b * 0.7 }, w);
    pv.yy += b * 0.03 * w; addV(pv, 'hd', 0, -0.1 * w);
  },
  // 만세: 두 팔을 들고 폴짝폴짝
  cheer(pv, w, s, c, sit) {
    const hop = Math.abs(Math.sin(s * 5.6));
    pv.yy += hop * (sit ? 0.025 : 0.09) * w;
    toward(pv, { aA: [0, 0, -2.7], eA: -0.3, aB: [0, 0, 2.7], eB: -0.3 }, w);
    if (!sit) { pv.kA += (1 - hop) * 0.5 * w; pv.kB += (1 - hop) * 0.5 * w; }
  },
  // 손뼉
  clap(pv, w, s) { const b = Math.sin(s * 8) * 0.5 + 0.5; toward(pv, { aA: [-0.9, 0, 0.3 + b * 0.25], eA: -1.5, aB: [-0.9, 0, -0.3 - b * 0.25], eB: -1.5 }, w); pv.yy += b * 0.008 * w; },
  // 끄덕임, 고개 젓기, 두리번, 몸 흔들기
  nod(pv, w, s) { addV(pv, 'hd', 0, Math.max(0, Math.sin(s * 6)) * 0.3 * w); },
  shake(pv, w, s) { addV(pv, 'hd', 1, Math.sin(s * 5) * 0.45 * w); },
  look(pv, w, s) { addV(pv, 'hd', 1, Math.sin(s * 2.4) * 0.6 * w); },
  sway(pv, w, s) { pv.tilt += Math.sin(s * 3) * 0.14 * w; addV(pv, 'hd', 2, -Math.sin(s * 3) * 0.1 * w); },
  // 손가락질하며 따진다
  blame(pv, w, s) { const b = Math.sin(s * 5.5); toward(pv, { aB: [-1.4 + b * 0.12, 0, -0.1], eB: -0.1 }, w); pv.lean += 0.12 * w; addV(pv, 'hd', 0, Math.max(0, b) * 0.08 * w); },
  // 달리기 (제자리): 팔다리를 빠르게 젓는다
  run(pv, w, s) { const b = Math.sin(s * 10); addV(pv, 'lA', 0, b * 0.8 * w); addV(pv, 'lB', 0, -b * 0.8 * w); pv.kA += Math.max(0, -b) * 1.0 * w; pv.kB += Math.max(0, b) * 1.0 * w; toward(pv, { aA: [-b * 0.9, 0, -0.1], eA: -1.4, aB: [b * 0.9, 0, 0.1], eB: -1.4 }, w); pv.lean += 0.18 * w; pv.yy += Math.abs(b) * 0.02 * w; },
  // 가만히 (자동 동작을 끈다)
  still() {},
  // 움찔 (dt: 이 동작이 시작되고 지난 때)
  jolt(pv, w, s, c, sit, t, dt) {
    const j = Math.exp(-Math.max(0, dt) * 11);
    pv.lean -= 0.22 * j; pv.yy += 0.06 * j * (sit ? 0.3 : 1);
    toward(pv, { aA: [-0.3, 0, -1.0], eA: -0.6, aB: [-0.3, 0, 1.0], eB: -0.6 }, Math.min(1, j * 1.2) * (c.held ? 0.3 : 1));
    addV(pv, 'hd', 0, -0.15 * j);
  },
  // 경기 준비: 무릎을 굽혔다 폈다 하며 좌우로 움직인다
  ready(pv, w, s) { const b = Math.sin(s * 5); pv.kA += (0.35 + b * 0.15) * w; pv.kB += (0.35 - b * 0.15) * w; addV(pv, 'lA', 0, -0.2 * w); addV(pv, 'lB', 0, -0.2 * w); pv.tilt += b * 0.1 * w; pv.yy -= 0.02 * w; pv.lean += 0.08 * w; },
  // 던지기 직전: 팔을 젖힌 채 힘을 모아 떤다
  windup(pv, w, s) { pv.lean += (0.06 + Math.sin(s * 3) * 0.05) * w; pv.tilt += Math.sin(s * 3) * 0.06 * w; pv.kB += 0.15 * w; },
  // 공 피하기: 좌우로 폴짝 비킨다
  dodge(pv, w, s) { const b = Math.sin(s * 6); pv.tilt += b * 0.3 * w; pv.yy += Math.abs(b) * 0.04 * w; addV(pv, 'aA', 2, -Math.abs(b) * 0.5 * w); addV(pv, 'aB', 2, Math.abs(b) * 0.5 * w); pv.kA += Math.max(0, b) * 0.5 * w; pv.kB += Math.max(0, -b) * 0.5 * w; },
  // 받을 준비: 팔을 벌린 채 무릎을 굽혔다 편다
  brace(pv, w, s) { const b = Math.sin(s * 2.6); pv.kA += (0.25 + b * 0.12) * w; pv.kB += (0.25 + b * 0.12) * w; pv.yy -= (0.5 + b * 0.5) * 0.015 * w; pv.lean += 0.06 * w; }, // 긴장해서 무릎을 살짝 굽혔다 펴는 정도만
  // 주먹을 꼭 쥐고 부르르 (발은 구르지 않는다)
  fist(pv, w, s) { toward(pv, { aA: [0.1, 0, -0.35], eA: -0.6 - (Math.sin(s * 2.5) * 0.5 + 0.5) * 0.25, aB: [0.1, 0, 0.35], eB: -0.6 - (Math.sin(s * 2.5) * 0.5 + 0.5) * 0.25 }, w * 0.85); addV(pv, 'hd', 0, 0.12 * w); },
  // 깊은 숨: 어깨가 천천히 오르내린다
  breath(pv, w, s) { const b = Math.sin(s * 2.2); pv.yy += b * 0.018 * w; pv.lean -= b * 0.05 * w; addV(pv, 'aA', 2, -b * 0.08 * w); addV(pv, 'aB', 2, b * 0.08 * w); addV(pv, 'hd', 0, -b * 0.06 * w); },
  // 한숨: 어깨가 툭 떨어진다
  sigh(pv, w, s, c, sit, t, dt) { const j = sstep(0, 0.15, dt); pv.yy -= 0.02 * j * w; addV(pv, 'hd', 0, 0.2 * j * w); addV(pv, 'aA', 2, 0.1 * w); addV(pv, 'aB', 2, -0.1 * w); },
  // 머쓱하게 뒷머리를 긁는다
  scratch(pv, w, s) { toward(pv, { aB: [-0.3, 0, 2.6], eB: -2.2 + Math.sin(s * 6) * 0.15 }, w); addV(pv, 'hd', 2, 0.15 * w); addV(pv, 'hd', 0, 0.1 * w); },
  // 꾸벅 (사과·인사)
  bow(pv, w, s, c, sit, t, dt) { const b = Math.sin(clamp(dt / 0.22, 0, 1) * Math.PI); pv.lean += 0.4 * b * w; addV(pv, 'hd', 0, 0.3 * b * w); },
  // 발끝으로 바닥을 꾹꾹
  toe(pv, w, s) { const b = Math.max(0, Math.sin(s * 5)); addV(pv, 'lB', 0, (-0.35 + b * 0.2) * w); pv.kB += (0.5 - b * 0.3) * w; addV(pv, 'hd', 0, 0.1 * w); },
  // 어깨 토닥이기
  pat(pv, w, s) { addV(pv, 'aA', 0, Math.sin(s * 6) * 0.14 * w); pv.eA += Math.sin(s * 6) * 0.2 * w; addV(pv, 'hd', 0, 0.1 * w); },
  // 품에 안은 것을 꽉 쥔다
  squeeze(pv, w, s) { const b = Math.sin(s * 4) * 0.5 + 0.5; addV(pv, 'aA', 2, 0.14 * b * w); addV(pv, 'aB', 2, -0.14 * b * w); pv.eA -= 0.2 * b * w; pv.eB -= 0.2 * b * w; addV(pv, 'hd', 0, 0.16 * w); pv.yy -= 0.008 * b * w; },
  // 걷기 (제자리)
  walk(pv, w, s) { const b = Math.sin(s * 7); addV(pv, 'lA', 0, b * 0.5 * w); addV(pv, 'lB', 0, -b * 0.5 * w); pv.kA += Math.max(0, -b) * 0.6 * w; pv.kB += Math.max(0, b) * 0.6 * w; addV(pv, 'aA', 0, -b * 0.35 * w); addV(pv, 'aB', 0, b * 0.35 * w); pv.yy += Math.abs(b) * 0.012 * w; },
  // 먹기: 한 손을 입으로 가져갔다 내린다
  eat(pv, w, s) { const b = Math.sin(s * 3.2) * 0.5 + 0.5; toward(pv, { aA: [-0.7 - b * 0.35, 0, 0.25], eA: -1.3 - b * 0.9 }, w); addV(pv, 'hd', 0, (1 - b) * 0.15 * w); },
  // 코에 붙인 숟가락이 떨어지지 않게 고개를 젖히고 팔로 균형을 잡는다
  balance(pv, w, s) { addV(pv, 'hd', 0, -0.25 * w); addV(pv, 'hd', 2, Math.sin(s * 5) * 0.14 * w); toward(pv, { aA: [0, 0, -1.3 + Math.sin(s * 5) * 0.3], eA: -0.3, aB: [0, 0, 1.3 + Math.sin(s * 5) * 0.3], eB: -0.3 }, w * 0.9); pv.tilt += Math.sin(s * 5) * 0.07 * w; },
  // 고개를 돌려 외면한다 (끝에 돌아온다)
  away(pv, w, s) { addV(pv, 'hd', 1, -0.75 * w); addV(pv, 'hd', 0, 0.1 * w); },
  // 젓가락으로 콕콕
  poke(pv, w, s) { const b = Math.max(0, Math.sin(s * 4.5)); toward(pv, { aA: [-0.95, 0, 0.1], eA: -0.9 + b * 0.35 }, w); addV(pv, 'hd', 0, 0.25 * w); },
  // 손 씻기: 내민 두 손을 비빈다
  wash(pv, w, s) { const b = Math.sin(s * 6.5); toward(pv, { aA: [-1.15 + b * 0.08, 0, 0.3], eA: -0.4, aB: [-1.15 - b * 0.08, 0, -0.3], eB: -0.4 }, w); addV(pv, 'hd', 0, 0.25 * w); pv.lean += 0.1 * w; },
  // 손을 만지작거린다
  fidget(pv, w, s, c) { const b = Math.sin(s * 3.5); toward(pv, { aA: [-0.45, 0, 0.34 + b * 0.05], eA: -1.75 + b * 0.12, aB: [-0.45, 0, -0.34 + b * 0.05], eB: -1.75 - b * 0.12 }, w * (c.held ? 0 : 0.9)); addV(pv, 'hd', 0, 0.14 * w); addV(pv, 'hd', 1, Math.sin(s * 1.9) * 0.12 * w); },
  // 크게 외친다: 몸을 내밀며 힘을 준다
  shout(pv, w, s) { const b = Math.max(0, Math.sin(s * 6)); pv.lean += b * 0.18 * w; pv.yy += b * 0.02 * w; addV(pv, 'hd', 0, -b * 0.12 * w); },
  // 엉덩방아: 뒤로 벌렁 넘어져 주저앉았다가 일어난다
  tumble(pv, w, s, c, sit, t, dt) {
    const j = Math.pow(sstep(0, 0.13, dt), 2) * w; // 처음엔 천천히, 갈수록 빨리 쓰러진다
    pv.lean -= 1.3 * j; pv.yy += 0.1 * j + Math.sin(clamp((dt - 0.13) / 0.06, 0, 1) * Math.PI) * 0.03 * w; // 바닥에 닿으며 살짝 튄다
    toward(pv, { lA: [-1.2, 0, 0.25], lB: [-1.2, 0, -0.25], kA: 0.5, kB: 0.5, aA: [0.5, 0, -1.0], eA: -0.3, aB: [0.5, 0, 1.0], eB: -0.3 }, j);
    addV(pv, 'hd', 0, 0.5 * j);
  },
  // 앞으로 고꾸라질 뻔: 크게 휘청하고 팔을 허우적댄다
  trip(pv, w, s, c, sit, t, dt) {
    const j = sstep(0, 0.05, dt) * Math.exp(-Math.max(0, dt - 0.05) * 4.5); // 밀려 숙였다가 천천히 몸을 세운다
    pv.lean += 0.9 * j; pv.yy -= 0.04 * j;
    toward(pv, { aA: [-2.2, 0, -0.6], eA: -0.3, aB: [-2.0, 0, 0.6], eB: -0.3, lA: [0.6, 0, 0], kA: 0.8 }, Math.min(1, j * 1.2));
  },
  // 한 바퀴 빙글
  spin(pv, w, s, c, sit, t, dt) { c.root.rotation.y = c.ry0 + easeIO(clamp(dt / 0.25, 0, 1)) * Math.PI * 2; pv.yy += Math.sin(clamp(dt / 0.25, 0, 1) * Math.PI) * 0.05; toward(pv, { aA: [0, 0, -1.4], aB: [0, 0, 1.4] }, w); },
  // 든 것(수첩)을 천천히 덮어 내린다: 손이 내려가고 고개가 숙여진다
  close(pv, w, s, c, sit, t, dt) { const j = sstep(0, 0.2, dt) * w; toward(pv, { aA: [-0.35, 0, 0.25], eA: -1.2, aB: [-0.35, 0, -0.25], eB: -1.2 }, j); addV(pv, 'hd', 0, 0.28 * j); },
  // 든 것을 조용히 내민다
  offer(pv, w, s, c, sit, t, dt) { const j = sstep(0, 0.15, dt) * w; toward(pv, { aA: [-1.25, 0, 0.05], eA: -0.35 }, j); pv.lean += 0.08 * j; addV(pv, 'hd', 0, 0.1 * j); },
  // 건네고 받기: 손을 뻗었다가 거둔다
  give(pv, w, s, c, sit, t, dt) { const j = Math.sin(clamp(dt / 0.3, 0, 1) * Math.PI) * w; toward(pv, { aA: [-1.3, 0, 0.05], eA: -0.25 }, j); pv.lean += 0.1 * j; },
  // 지우개로 지우기: 수첩 위에서 손을 좌우로 문지른다
  erase(pv, w, s) { toward(pv, { aA: [-1.05, 0, 0.2], eA: -1.75, aB: [-1.05, 0, -0.5 + Math.sin(s * 9) * 0.12], eB: -1.6 }, w * 0.95); addV(pv, 'hd', 0, 0.28 * w); },
  // 손바닥 마주치기: 한 손을 높이 들어 짝! 하고 살짝 뛴다
  highfive(pv, w, s, c, sit, t, dt) { const j = sstep(0, 0.06, dt), hit = Math.sin(clamp(dt / 0.12, 0, 1) * Math.PI); toward(pv, { aB: [-2.3, 0, 0.25], eB: -0.3 }, j * w); pv.yy += hit * (sit ? 0.02 : 0.06) * w; pv.lean += hit * 0.08 * w; },
  // 공 튀기기: 한 손으로 아래를 툭툭 누르듯 (든 공은 품에 둔 채)
  bounce(pv, w, s) { const b = Math.sin(s * 5.5) * 0.5 + 0.5; toward(pv, { aB: [-0.55 - b * 0.3, 0, 0.1], eB: -0.5 - b * 0.5 }, w); addV(pv, 'hd', 0, 0.2 * w); pv.yy -= b * 0.012 * w; },
  // 한쪽을 지그시 바라본다 (주인공 쪽. 주인공이면 정면을 가만히)
  gaze(pv, w, s, c) { addV(pv, 'hd', 1, (c.gazeY || 0) * w); addV(pv, 'hd', 0, -0.04 * w); },
  // 한 손 흔들기
  wave(pv, w, s) { toward(pv, { aB: [0, 0, 2.5 + Math.sin(s * 6.5) * 0.35], eB: -0.6 }, w); addV(pv, 'hd', 2, 0.08 * w); },
});
// 말하는 사람: 한 손으로 박자를 맞추고 고개를 끄덕인다
function talkAct(pv, w, s, c) {
  const b = Math.sin(s * 5);
  if (!c.held) toward(pv, { aA: [-0.9 + b * 0.18, 0, -0.15], eA: -1.3 - b * 0.35 }, w * 0.85);
  else toward(pv, { aB: [-0.9 + b * 0.18, 0, 0.15], eB: -1.3 - b * 0.35 }, w * 0.85);
  addV(pv, 'hd', 0, Math.max(0, b) * 0.1 * w);
  pv.yy += Math.max(0, b) * 0.008 * w;
}
// 컷 p 의 움직임을 준비한다. prev: 앞 컷 (없으면 무대에서 정한 자세·표정에서 시작). 카메라는 삽화 자리에 그대로 둔다 (anim.cam 을 준 컷만 움직인다)
// 돌려주는 함수에 0~1 을 넣으면 그때의 장면이 된다
function cutAnim(p, prev, n = 0) {
  applyCut(p);
  for (const id in CH) if (shown(CH[id])) [CH[id].root, ...CH[id].root.getChildTransformNodes(false)].forEach(nd => nd.computeWorldMatrix(true)); // 그리지 않고 끝 자세의 자리만 계산 (무대가 깜빡이지 않게)
  placeShot(p);
  const end = { pos: shotCam.position.clone(), look: shotLook.clone(), fov: shotCam.fov };
  const A = p.anim || {};
  // 카메라: 필요한 컷에만 움직인다. 따로 정하지 않았으면 컷의 성격에 맞춰 —
  // 장면을 여는 넓은 컷은 조금 가까이서 물러나며 무대를 보여 주고, 외치는 말·효과음·집중선 컷은 빠르게 다가가고,
  // 물건 컷과 속상한 얼굴 컷은 천천히 다가간다. 나머지는 고정
  const f1s = Object.values(p.faces || {}), loud = asList(p.lines).some(l => l.shout) || p.sfx || p.fx === 'focus';
  const auto = loud ? { back: 1.22 }
    : (p.shot === 'wide' || !p.shot) && !prev ? { back: 0.86, turn: 6 }
    : p.shot === 'item' ? { back: 1.14 }
    : (p.shot === 'close' && f1s.some(f => ['sad', 'hurt', 'worried', 'cry', 'shy'].includes(f))) ? { back: 1.1 }
    : null;
  const cm = Object.assign({ turn: 0, back: 1, up: 0 }, A.cam === false ? null : A.cam || auto);
  const off = end.pos.subtract(end.look);
  const start = { pos: end.look.add(turnY(off, cm.turn).scale(cm.back)).add(V3(0, cm.up, 0)), look: end.look.clone(), fov: end.fov };
  const talkers = new Set(asList(p.lines).map(l => l.who));
  const focus = new Set([...asList(p.on), ...talkers, ...Object.keys(p.faces || {}), ...Object.keys(p.poses || {})]);
  const star = CH[asList(p.on)[0]] || CH[[...talkers][0]] || null; // 다른 아이들이 바라볼 사람
  const acts = [];
  for (const id in CH) {
    const c = CH[id];
    if (!shown(c)) continue;
    const f1 = (p.faces && p.faces[id]) || c.face0, o1 = p.poses && p.poses[id];
    const f0 = prev ? (prev.faces && prev.faces[id]) || c.face0 : c.face0, o0 = prev && prev.poses && prev.poses[id];
    // 열쇠 장면: [때, 자세 값, 표정]. 마지막은 늘 이 컷의 자세·표정
    // anim 의 한 줄: [때, 자세, 표정, 동작] — 그때까지 그 자세가 되고, 다음 줄로 넘어가기 전까지 그 동작을 한다
    // 다섯째 값: 그 자세로 바뀌는 데 걸리는 때 (천천히 바꿀 때). ['end', 0, 0, 동작]: 마지막 자세가 된 뒤의 동작
    const all = asList(A[id]), au = all.filter(k => k[0] !== 'end'), endMv = (all.find(k => k[0] === 'end') || [])[3];
    const endT = au.length ? Math.min(0.84, au[au.length - 1][0] + 0.34) : 0.3;
    const keys = [[0, poseVals(c.base, o0), f0], ...au.map(([t, pose, face, mv, dur]) => [t, poseVals(c.base, pose || o1), face || f1, mv, dur]), [endT, poseVals(c.base, o1), f1, endMv]];
    c.ry0 = c.root.rotation.y;
    c.held = c.armA.hand.getChildren().some(x => x.isEnabled()) || ['show', 'hold', 'phone', 'throw'].includes(o1 || c.base); // 오른손에 든 것이 있으면 그 팔은 연기에 쓰지 않는다
    let look = 0; // 주인공이 아닌 아이는 주인공 쪽으로 고개를 돌렸다가 돌아온다
    if (star && star !== c) { const d = star.root.position.subtract(c.root.position); look = clamp(Math.atan2(d.x, d.z) - c.ry0, -Math.PI, Math.PI); look = clamp(Math.atan2(Math.sin(look), Math.cos(look)), -0.8, 0.8); }
    c.gazeY = look;
    acts.push({ c, keys, f1, talk: talkers.has(id), k: focus.has(id) || !star ? 1 : 0.45, look, sit: !!poseVals(c.base, o1).sit });
  }
  // ---- 이동: 앞 컷 뒤로 자리가 바뀐 인물은 그 자리에서 걸어(멀면 뛰어) 온다. 새로 나온 인물은 뒤쪽에서 걸어 들어온다 ----
  const old = lastSpots.stage === stageNow.name ? lastSpots : null;
  for (const a of acts) {
    const c = a.c, P1 = c.root.position.clone(), o = old && old.pos[c.id];
    a.P1 = P1; a.stand = poseVals('stand');
    let p0 = null;
    if (o && BABYLON.Vector3.Distance(o, P1) > 0.3) p0 = o;
    else if (old && !o && A.enter !== false) p0 = P1.subtract(facing(c).scale(2.4));
    if (A.from && A.from[c.id]) { const f = A.from[c.id], fw = facing(c); p0 = P1.add(V3(fw.z * f[0] + fw.x * f[1], 0, -fw.x * f[0] + fw.z * f[1])); } // [오른쪽, 앞] m 만큼 떨어진 데서 시작
    if (p0) {
      const d = BABYLON.Vector3.Distance(p0, P1), run = (A.run && A.run.includes(c.id)) || d > 2.6;
      a.trav = { p0, run, dur: clamp(d / ((run ? 3.6 : 1.5) * CUT_SEC), 0.14, 0.5), head: Math.atan2(P1.x - p0.x, P1.z - p0.z) };
    }
    a.path = A.path && A.path[c.id]; // [[때, 오른쪽, 앞], ...] 제자리에서 벗어났다 돌아오는 길
  }
  // ---- 공: 앞 컷 뒤로 자리가 바뀌었으면 그 자리에서 날아온다. 중력을 받는 포물선으로 날고,
  // 사람 몸에 맞으면 튕겨 나와 바닥에 떨어져 구른다 (맞은 사람은 공이 온 반대쪽으로 밀리며 넘어지거나 휘청인다).
  // 품에 받으면 받은 사람이 살짝 밀리고, 아직 날아가는 중을 그린 컷이면 컷이 끝나는 순간 그 자리에 닿는다 ----
  const bn = PROPS.ball;
  let fly = null;
  if (bn && bn.isEnabled() && old && A.ball !== false) {
    const par = bn.parent, loc = bn.position.clone(), rot = bn.rotation.clone();
    const target = () => { if (!par) return loc.clone(); par.computeWorldMatrix(true); return BABYLON.Vector3.TransformCoordinates(loc, par.getWorldMatrix()); };
    const to = target();
    let from = old.ball;
    if (!from) { const fc = star ? star.root.position : V3(0, 0, 0), dir0 = to.subtract(fc); dir0.y = 0; from = to.add((dir0.length() > 0.3 ? dir0.normalize() : V3(1, 0, 0)).scale(6)).add(V3(0, 0.3, 0)); } // 없던 공은 멀리서 날아든다
    const d = BABYLON.Vector3.Distance(from, to);
    if (d > 0.35) {
      const dir = to.subtract(from); dir.y = 0; dir.normalize();
      const holder = acts.find(a => { let n = par; while (n) { if (n === a.c.root) return true; n = n.parent; } return false; }) || null; // 품이나 손에 받는 사람
      const air = !holder && to.y > 0.3;
      const victim = (air && A.hit && acts.find(a => a.c.id === A.hit)) || null; // 이 컷에서 공에 맞는 사람 (anim.hit 에 적은 컷만. 적지 않으면 공은 아직 날아가는 중)
      const dur = clamp(d / (8 * CUT_SEC), 0.1, 0.32), mid = air && !victim;
      const t0 = A.ballFrom != null ? A.ballFrom : mid ? 0.97 - dur : 0.12;
      fly = { par, loc, rot, target, from, to, dir, t0, dur, tb: t0 + dur, holder, victim, mid, T: dur * CUT_SEC, floor: !holder && !air };
      if (victim) { // 맞는 사람: 맞는 순간부터 앞에서 맞으면 엉덩방아, 뒤에서 맞으면 앞으로 휘청 (anim.hitLight 면 움찔만)
        const K = victim.keys, fin = K[K.length - 1], front = BABYLON.Vector3.Dot(dir, facing(victim.c)) < 0;
        const mv = A.hitLight ? 'jolt' : front ? 'tumble' : 'trip';
        const kept = K.filter((k, i) => i < K.length - 1 && k[0] < fly.tb - 0.02);
        victim.keys = [...kept, [fly.tb + 0.01, fin[1], 'surprised', mv, 0.02], [Math.min(0.88, fly.tb + (mv === 'tumble' ? 0.5 : 0.36)), fin[1], fin[2], 'still', mv === 'tumble' ? 0.2 : 0.1]];
        victim.push = { t: fly.tb, dir, k: mv === 'jolt' ? 0.08 : 0.3 };
        // 튕겨 나온 공: 맞은 자리에서 뒤쪽 위로 튀어 올랐다가 떨어져 바닥에서 몇 번 튀고 구른다
        const v0 = dir.scale(-1.3).add(V3(dir.z * 0.5, 2.1, -dir.x * 0.5));
        fly.reb = tau => {
          const pz = to.clone(); let vy = v0.y, vx = v0.x, vz = v0.z, left = tau;
          for (let n = 0; n < 400 && left > 0; n++) {
            const h = Math.min(0.01, left); left -= h;
            vy -= 9.8 * h; pz.x += vx * h; pz.y += vy * h; pz.z += vz * h;
            if (pz.y < 0.085) { pz.y = 0.085; vy = Math.abs(vy) > 0.6 ? -vy * 0.5 : 0; vx *= 0.75; vz *= 0.75; }
            if (pz.y <= 0.086 && vy === 0) { vx *= 1 - 1.6 * h; vz *= 1 - 1.6 * h; } // 구르다 멈춘다
          }
          return pz;
        };
      } else if (holder) holder.push = { t: fly.tb, dir, k: 0.12 }; // 받은 사람은 공의 힘에 살짝 밀린다
    }
  }
  // 던진 사람: 앞 컷에서 팔을 젖히고 있었고 공이 손을 떠났으면, 공이 떠나는 순간 팔을 앞으로 휘두른 뒤 이 컷의 자세가 된다
  if (old && old.holder && fly && !(fly.holder && fly.holder.c.id === old.holder)) {
    const a = acts.find(x => x.c.id === old.holder);
    if (a && prev && prev.poses && prev.poses[old.holder] === 'throw') {
      const sw = poseVals(a.c.base, 'reach'), K = a.keys, fin = K[K.length - 1]; sw.lean = 0.3;
      a.keys = [K[0], [fly.t0 + 0.03, sw, K[0][2], 'still', 0.06], ...K.slice(1, -1).filter(k => k[0] > fly.t0 + 0.2), [clamp(Math.max(fin[0], fly.t0 + 0.26), 0.3, 0.95), fin[1], fin[2], fin[3], 0.18]];
    }
  }
  const kids = (stageNow.kids || []).map((nd, i) => ({ n: nd, y: nd.position.y, rz: nd.rotation.z, ry: nd.rotation.y, ph: i * 2.4 }));
  const cheer = A.cheer == null ? 0 : A.cheer * 0.7;
  return function at(t, sec) { // t: 0~1, sec: 지난 초
    const live = 1 - sstep(0.82, 0.97, t); // 끝에서는 움직임이 멎어 멈춘 삽화와 같아진다
    const k = easeIO(clamp(t / 0.9, 0, 1));
    shotCam.position.copyFrom(BABYLON.Vector3.Lerp(start.pos, end.pos, k));
    shotCam.setTarget(BABYLON.Vector3.Lerp(start.look, end.look, k));
    shotCam.fov = lerp(start.fov, end.fov, k);
    for (const a of acts) {
      const c = a.c, K = a.keys;
      let i = 1;
      while (i < K.length - 1 && t > K[i][0]) i++;
      const t0 = Math.max(K[i - 1][0], K[i][0] - (K[i][4] || 0.2)), u = clamp((t - t0) / Math.max(0.01, K[i][0] - t0), 0, 1);
      const e = u < 1 ? easeIO(u) + Math.sin(u * Math.PI) * 0.08 : 1; // 살짝 지나쳤다 돌아온다
      const pv = mixPose(c, K[i - 1][1], K[i][1], e);
      const s = sec + c.phase * 0.3;
      const face = (u > 0.5 ? K[i][2] : K[i - 1][2]) || K[i - 1][2] || c.face0;
      c.root.rotation.y = c.ry0;
      c.root.position.copyFrom(a.P1); // 자리도 매번 제자리에서 다시 셈한다 (밀림이 쌓이지 않게)
      // 동작: 열쇠 장면에 닿은 뒤부터 다음 장면으로 넘어가기 전까지. 따로 정하지 않았으면 표정에 맞는 동작
      const last = t >= K[K.length - 1][0], j = last ? K.length - 1 : i - 1;
      const mvName = K[j][3] || (j === K.length - 1 ? a.f1 : K[j][2] || face);
      const w = sstep(K[j][0], K[j][0] + 0.07, t) * (last ? live : 1 - sstep(t0 - 0.05, t0 + 0.03, t)) * (K[j][3] ? 1 : a.k);
      (MOVES[mvName] || MOVES.calm)(pv, w, s, c, a.sit, t, t - K[j][0]);
      if (a.talk) talkAct(pv, sstep(0.15, 0.3, t) * live, s, c);
      if (a.look) addV(pv, 'hd', 1, a.look * sstep(0.05, 0.25, t) * live);
      pv.yy += Math.sin(s * 2.9) * 0.005 * live;
      // 이동
      if (a.trav) {
        const m = clamp((t - 0.03) / a.trav.dur, 0, 1);
        if (m < 1) {
          const wk = mixPose(c, a.stand, a.stand, 0);
          MOVES[a.trav.run ? 'run' : 'walk'](wk, 1, sec, c, false, t, t);
          for (const key in wk) pv[key] = wk[key];
          c.root.position.copyFrom(BABYLON.Vector3.Lerp(a.trav.p0, a.P1, m));
          let dy = c.ry0 - a.trav.head; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
          c.root.rotation.y = a.trav.head + dy * sstep(0.8, 1, m);
        } else {
          c.root.position.copyFrom(a.P1);
          const b = sstep(0, 0.07, t - 0.03 - a.trav.dur);
          if (b < 1) { const st = mixPose(c, a.stand, pv, b); for (const key in st) pv[key] = st[key]; }
        }
      }
      if (a.path && !(a.trav && t - 0.03 < a.trav.dur)) {
        const P = [[0, 0, 0], ...a.path, [Math.max(0.86, a.path[a.path.length - 1][0] + 0.1), 0, 0]];
        let q = 1;
        while (q < P.length - 1 && t > P[q][0]) q++;
        const e2 = easeIO(clamp((t - P[q - 1][0]) / Math.max(0.01, P[q][0] - P[q - 1][0]), 0, 1)), ox = lerp(P[q - 1][1], P[q][1], e2), oz = lerp(P[q - 1][2], P[q][2], e2);
        const fx = Math.sin(c.ry0), fz = Math.cos(c.ry0);
        c.root.position.set(a.P1.x + fz * ox + fx * oz, a.P1.y, a.P1.z - fx * ox + fz * oz);
      }
      if (a.push && t > a.push.t) { // 공에 맞거나 받은 힘: 공이 가던 쪽으로 밀렸다가 제자리로 돌아온다
        const dt3 = t - a.push.t, k3 = a.push.k * (1 - Math.exp(-dt3 * 14)) * (1 - sstep(0.62, 0.9, t));
        c.root.position.x += a.push.dir.x * k3; c.root.position.z += a.push.dir.z * k3;
      }
      if (t >= 1) { c.root.position.copyFrom(a.P1); c.root.rotation.y = c.ry0; }
      applyPose(c, pv);
      const blink = live > 0.5 && ((sec + c.phase * 0.37) % 2.3) < 0.12;
      if (face !== c.face || blink !== c.blinking) { c.face = face; c.blinking = blink; paintFace(c, blink); }
    }
    if (fly) { // 공이 날아간다: 옆으로는 같은 빠르기, 위아래는 중력 (포물선)
      const u = clamp((t - fly.t0) / fly.dur, 0, 1), tg = fly.target();
      if (t < fly.t0) { bn.parent = null; bn.position.copyFrom(fly.from); }
      else if (u < 1 && t < 0.995) {
        bn.parent = null;
        const pos = BABYLON.Vector3.Lerp(fly.from, tg, u);
        pos.y += 0.5 * 9.8 * fly.T * fly.T * u * (1 - u);
        bn.position.copyFrom(pos);
        bn.rotation.x = u * fly.T * 9;
      } else if (fly.reb) { // 몸에 맞고 튕겨 나와 바닥에 떨어져 구른다 (컷이 끝나도 떨어진 자리에 남는다)
        bn.parent = null;
        bn.position.copyFrom(fly.reb((t - fly.tb) * CUT_SEC));
        bn.rotation.x = fly.T * 9 - (t - fly.tb) * 6;
        bn.getChildMeshes().forEach(m => { m.layerMask = 1; });
      } else {
        bn.parent = fly.par; bn.position.copyFrom(fly.loc); bn.rotation.copyFrom(fly.rot);
        const dt2 = (t - fly.tb) * CUT_SEC; // 바닥에 떨어진 공: 점점 낮게 튄다
        if (fly.floor && t < 0.995) bn.position.y += Math.abs(Math.sin(dt2 * 9)) * 0.28 * Math.exp(-dt2 * 3.2);
      }
    }
    kids.forEach(o => { // 배경 아이들: 들썩이고 기웃거린다
      const kw = cheer * live * sstep(0.02, 0.2, t);
      o.n.position.y = o.y + (Math.sin(sec * 3 + o.ph) * 0.5 + 0.5) * 0.03 * kw;
      o.n.rotation.z = o.rz + Math.sin(sec * 1.5 + o.ph) * 0.05 * kw;
      o.n.rotation.y = o.ry + Math.sin(sec * 1.1 + o.ph * 1.3) * 0.2 * kw;
    });
  };
}
// 앞 컷이 끝났을 때 인물과 공이 있던 자리 (다음 컷에서 자리가 바뀌었으면 거기서부터 움직인다)
let lastSpots = { stage: null, pos: {}, ball: null, holder: null };
function saveSpots() {
  const pos = {};
  for (const id in CH) if (shown(CH[id])) pos[id] = CH[id].root.position.clone();
  const bn = PROPS.ball;
  let ball = null, holder = null;
  if (bn && bn.isEnabled()) { bn.computeWorldMatrix(true); ball = bn.getAbsolutePosition().clone(); for (const id in CH) if (bn.parent === CH[id].armA.hand) holder = id; }
  lastSpots = { stage: stageNow && stageNow.name, pos, ball, holder };
}
const CUT_SEC = 3.6, CUT_W = 520; // 움직이는 시간, 움직이는 동안 찍는 그림 너비 (작게 찍어야 느린 기기에서도 끊기지 않는다)
const canAnim = p => !REDUCED && save.set.anim !== false && p.text == null && !p.phone && !p.note;
let skipCut = false; // 그림을 누르면 바로 끝 장면으로
storyEl.addEventListener('click', e => { if (e.target.closest('.pic.playing')) skipCut = true; });
// 컷 e 를 옆 칸의 캔버스에 한 번 재생한다. 끝나면 인물·카메라는 삽화와 같은 자리에 있다
// 움직이는 컷의 한 장: 큰 무대를 먼저 그리고(벽·아이들은 제대로 보이게), 찍는 그 순간에만 컷 카메라 기준으로 벽과 가리는 아이를 뺐다가 바로 되돌린다.
// 벽은 삽화 자리(endPos) 기준으로 늘 같게 — 카메라가 움직이는 동안 벽이나 물건이 깜빡이지 않는다
async function cutFrame(endPos, hk, w, hh) {
  scene.render();
  wallsForShot(endPos);
  hk.forEach(k => k.setEnabled(false));
  try { return await loadImg(await snap(shotCam, w, hh)); } finally { restoreWalls(); hk.forEach(k => k.setEnabled(true)); }
}
let skipAhead = false; // 움직이는 동안 「다음」을 눌렀다: 끝 장면으로 건너뛰고 바로 다음 컷으로
function playCut(e, prev, my) {
  return serial(async () => {
    const cv = storyEl.querySelector('.pic > canvas');
    if (!cv || my !== runId) return;
    const w = CUT_W, hh = Math.round(w / 1.6), g = cv.getContext('2d', { willReadFrequently: true });
    cv.width = w; cv.height = hh;
    const at = cutAnim(e.p, prev, hist.length);
    const endPos = shotCam.position.clone(), hk = hiddenKids;
    hiddenKids = []; hk.forEach(k => k.setEnabled(true));
    skipCut = false; skipAhead = false;
    const skipNext = () => { skipCut = true; skipAhead = true; };
    setNext(skipNext); // 움직이는 동안에도 「다음」을 누를 수 있다
    cv.parentElement.classList.add('playing');
    const t0 = performance.now();
    try {
      for (;;) {
        const sec = (performance.now() - t0) / 1000, t = skipCut ? 1 : Math.min(1, sec / CUT_SEC);
        at(t, sec);
        if (t >= 1) break;
        const img = await cutFrame(endPos, hk, w, hh);
        if (my !== runId || !cv.isConnected) break;
        g.drawImage(img, 0, 0);
        screentone(g, w, hh);
      }
    } finally {
      at(1, CUT_SEC);
      if (nextFn === skipNext) setNext(null);
      for (const k in CH) if (CH[k].blinking) setFace(CH[k], CH[k].face);
      cv.parentElement.classList.remove('playing');
    }
  });
}
// 시험·소개 영상용 창구 (?rec): 장면을 처음부터 따라가며 고른 컷의 움직임을 정해진 장수로 찍어 넘긴다 (느린 기기에서도 매끄러운 영상을 만들 수 있게)
if (ARGS.has('rec')) window.__rec = {
  ready: () => !!(stageNow && stageNow.name) && !capBusy,
  keys: () => [...Object.keys(BOOK.scenes), ...BOOK.endings.map(e => 'end:' + e.id)],
  run: (id, cuts, fps = 24, w = 900) => serial(async () => {
    const ps = id.startsWith('end:') ? BOOK.endings.find(e => e.id === id.slice(4)).panels : BOOK.scenes[id].panels, hh = Math.round(w / 1.6), n = Math.round(fps * CUT_SEC);
    if (!id.startsWith('end:')) applySet(BOOK.scenes[id].stage, BOOK.scenes[id].set || {}, false);
    const cv = Object.assign(document.createElement('canvas'), { width: w, height: hh }), g = cv.getContext('2d', { willReadFrequently: true });
    let prev = null;
    saveSpots();
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (p.stage || p.set) { applyItemSet(p); continue; }
      if (!p.shot) continue;
      if (!cuts || cuts.includes(i)) {
        await window.__cut(i);
        const at = cutAnim(p, prev);
        const endPos = shotCam.position.clone(), hk = hiddenKids;
        hiddenKids = []; hk.forEach(k => k.setEnabled(true));
        try {
          if (!fps) { for (let f = 0; f <= 40; f++) at(f / 40, f * CUT_SEC / 40); await window.__frame(''); } // 그리지 않고 동작만 돌려 보기 (오류 점검)
          else for (let f = 0; f <= n; f++) {
            at(f / n, f / fps);
            g.drawImage(await cutFrame(endPos, hk, w, hh), 0, 0);
            screentone(g, w, hh);
            await window.__frame(cv.toDataURL('image/jpeg', 0.93));
          }
        } finally { restoreWalls(); }
      }
      applyCut(p);
      saveSpots();
      prev = p;
    }
  }),
};
