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
// 컷 p 의 움직임을 준비한다. prev: 앞 컷 (없으면 무대에서 정한 자세·표정에서 시작). 돌려주는 함수에 0~1 을 넣으면 그때의 장면이 된다
function cutAnim(p, prev) {
  applyCut(p);
  for (const id in CH) if (shown(CH[id])) [CH[id].root, ...CH[id].root.getChildTransformNodes(false)].forEach(n => n.computeWorldMatrix(true)); // 그리지 않고 끝 자세의 자리만 계산 (무대가 깜빡이지 않게)
  placeShot(p);
  const end = { pos: shotCam.position.clone(), look: shotCam.getTarget().clone(), fov: shotCam.fov };
  const A = p.anim || {}, cm = Object.assign({ turn: p.shot === 'wide' || !p.shot ? 12 : 7, back: p.shot === 'wide' || !p.shot ? 1.1 : 1.32, up: 0.06 }, A.cam);
  const off = end.pos.subtract(end.look);
  const start = { pos: end.look.add(turnY(off, cm.turn).scale(cm.back)).add(V3(0, cm.up, 0)), look: end.look.add(V3(0, cm.up * 0.4, 0)), fov: end.fov * 1.04 };
  const acts = [];
  for (const id in CH) {
    const c = CH[id];
    if (!shown(c)) continue;
    const f1 = (p.faces && p.faces[id]) || c.face0, o1 = p.poses && p.poses[id];
    const f0 = prev ? (prev.faces && prev.faces[id]) || c.face0 : c.face0, o0 = prev && prev.poses && prev.poses[id];
    // 열쇠 장면: [때, 자세 값, 표정]. 마지막은 늘 이 컷의 자세·표정
    const keys = [[0, poseVals(c.base, o0), f0], ...asList(A[id]).map(([t, pose, face]) => [t, poseVals(c.base, pose), face]), [A[id] ? 0.8 : 0.5, poseVals(c.base, o1), f1]];
    acts.push({ c, keys });
  }
  const kids = (stageNow.kids || []).map((n, i) => ({ n, y: n.position.y, rz: n.rotation.z, ph: i * 2.4 }));
  const cheer = A.cheer == null ? 0.25 : A.cheer;
  return function at(t, sec) { // t: 0~1, sec: 지난 초 (숨·깜빡임·말하는 입)
    const live = 1 - sstep(0.8, 0.98, t); // 끝에서는 잔움직임이 멎어 멈춘 삽화와 같아진다
    const k = easeIO(clamp(t / 0.86, 0, 1));
    shotCam.position.copyFrom(BABYLON.Vector3.Lerp(start.pos, end.pos, k));
    shotCam.setTarget(BABYLON.Vector3.Lerp(start.look, end.look, k));
    shotCam.fov = lerp(start.fov, end.fov, k);
    for (const a of acts) {
      const c = a.c, K = a.keys;
      let i = 1;
      while (i < K.length - 1 && t > K[i][0]) i++;
      const t0 = Math.max(K[i - 1][0], K[i][0] - 0.24), u = clamp((t - t0) / Math.max(0.01, K[i][0] - t0), 0, 1);
      const e = u < 1 ? easeIO(u) + Math.sin(u * Math.PI) * 0.06 : 1; // 살짝 지나쳤다 돌아온다
      const pv = mixPose(c, K[i - 1][1], K[i][1], e);
      const s = sec * 2.2 + c.phase;
      pv.hd = [pv.hd[0] + Math.sin(s * 0.9) * 0.03 * live, pv.hd[1] + Math.sin(s * 0.6) * 0.07 * live, pv.hd[2] + Math.sin(s * 0.7 + 1) * 0.03 * live];
      pv.aA = [pv.aA[0] + Math.sin(s) * 0.03 * live, pv.aA[1], pv.aA[2]];
      pv.aB = [pv.aB[0] - Math.sin(s) * 0.03 * live, pv.aB[1], pv.aB[2]];
      pv.yy += Math.sin(s * 1.3) * 0.006 * live;
      applyPose(c, pv);
      const face = (u > 0.5 ? K[i][2] : K[i - 1][2]) || K[i - 1][2] || c.face0;
      const blink = live > 0.5 && ((sec + c.phase * 0.37) % 2.3) < 0.12;
      if (face !== c.face || blink !== c.blinking) { c.face = face; c.blinking = blink; paintFace(c, blink); }
    }
    kids.forEach(o => { // 배경 아이들: 들썩이고 살짝 기웃거린다
      o.n.position.y = o.y + Math.abs(Math.sin(sec * 3.1 + o.ph)) * 0.035 * cheer * live;
      o.n.rotation.z = o.rz + Math.sin(sec * 2.3 + o.ph) * 0.05 * cheer * live;
    });
  };
}
const CUT_SEC = 2.6, CUT_W = 520; // 움직이는 시간, 움직이는 동안 찍는 그림 너비 (작게 찍어야 느린 기기에서도 끊기지 않는다)
const canAnim = p => !REDUCED && save.set.anim !== false && p.text == null && !p.phone && !p.note;
let skipCut = false; // 그림을 누르면 바로 끝 장면으로
storyEl.addEventListener('click', e => { if (e.target.closest('.pic.playing')) skipCut = true; });
// 컷 e 를 옆 칸의 캔버스에 한 번 재생한다. 끝나면 인물·카메라는 삽화와 같은 자리에 있다
function playCut(e, prev, my) {
  return serial(async () => {
    const cv = storyEl.querySelector('.pic > canvas');
    if (!cv || my !== runId) return;
    const w = CUT_W, hh = Math.round(w / 1.6), g = cv.getContext('2d', { willReadFrequently: true });
    cv.width = w; cv.height = hh;
    const at = cutAnim(e.p, prev);
    wallsForShot(shotCam.position);
    skipCut = false;
    cv.parentElement.classList.add('playing');
    const t0 = performance.now();
    try {
      for (;;) {
        const sec = (performance.now() - t0) / 1000, t = skipCut ? 1 : Math.min(1, sec / CUT_SEC);
        at(t, sec);
        if (t >= 1) break;
        scene.render();
        const img = await loadImg(await snap(shotCam, w, hh));
        if (my !== runId || !cv.isConnected) break;
        g.drawImage(img, 0, 0);
        screentone(g, w, hh);
      }
    } finally {
      at(1, CUT_SEC);
      restoreWalls(); hiddenKids.forEach(k => k.setEnabled(true)); hiddenKids = [];
      for (const k in CH) if (CH[k].blinking) setFace(CH[k], CH[k].face);
      cv.parentElement.classList.remove('playing');
    }
  });
}
// 시험·소개 영상용 창구 (?rec): 컷 하나의 움직임을 정해진 장수로 찍어 넘긴다 (느린 기기에서도 매끄러운 영상을 만들 수 있게)
if (ARGS.has('rec')) window.__rec = {
  ready: () => !!(stageNow && stageNow.name) && !capBusy,
  cut: (id, i, fps = 24, w = 900) => serial(async () => {
    const ps = BOOK.scenes[id].panels, p = ps[i], hh = Math.round(w / 1.6), n = Math.round(fps * CUT_SEC);
    const cv = Object.assign(document.createElement('canvas'), { width: w, height: hh }), g = cv.getContext('2d', { willReadFrequently: true });
    const at = cutAnim(p, ps[i - 1]);
    wallsForShot(shotCam.position);
    try {
      for (let f = 0; f <= n; f++) {
        at(f / n, f / fps);
        scene.render();
        g.drawImage(await loadImg(await snap(shotCam, w, hh)), 0, 0);
        screentone(g, w, hh);
        await window.__frame(cv.toDataURL('image/jpeg', 0.93));
      }
    } finally { restoreWalls(); hiddenKids.forEach(k => k.setEnabled(true)); hiddenKids = []; applyCut(p); }
  }),
};
