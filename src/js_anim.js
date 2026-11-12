// ===== 컷 애니메이션: 컷마다 인물이 움직이고 카메라가 다가간 뒤, 지금의 멈춘 삽화와 같은 장면에서 끝난다 =====
// 영상은 미리 만들어 assets/cuts/<책>/<장면>-<컷 번호>.mp4 로 둔다 (tools/cuts.mjs 가 이 창구로 한 장씩 찍는다).
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
  scene.render();
  placeShot(p);
  const end = { pos: shotCam.position.clone(), look: shotCam.getTarget().clone(), fov: shotCam.fov };
  const A = p.anim || {}, cm = Object.assign({ turn: p.shot === 'wide' || !p.shot ? 12 : 7, back: p.shot === 'wide' || !p.shot ? 1.1 : 1.32, up: 0.06 }, A.cam);
  const off = end.pos.subtract(end.look);
  const start = { pos: end.look.add(turnY(off, cm.turn).scale(cm.back)).add(V3(0, cm.up, 0)), look: end.look.add(V3(0, cm.up * 0.4, 0)), fov: end.fov * 1.04 };
  const talkers = new Set(asList(p.lines).map(l => l.who));
  const acts = [];
  for (const id in CH) {
    const c = CH[id];
    if (!shown(c)) continue;
    const f1 = (p.faces && p.faces[id]) || c.face0, o1 = p.poses && p.poses[id];
    const f0 = prev ? (prev.faces && prev.faces[id]) || c.face0 : c.face0, o0 = prev && prev.poses && prev.poses[id];
    // 열쇠 장면: [때, 자세 값, 표정]. 마지막은 늘 이 컷의 자세·표정
    const keys = [[0, poseVals(c.base, o0), f0], ...asList(A[id]).map(([t, pose, face]) => [t, poseVals(c.base, pose), face]), [A[id] ? 0.8 : 0.5, poseVals(c.base, o1), f1]];
    acts.push({ c, keys, talk: talkers.has(id), hd: poseVals(c.base, o1).hd });
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
      const talk = a.talk ? Math.abs(Math.sin(sec * 11 + c.phase)) * sstep(0.2, 0.3, t) * (1 - sstep(0.82, 0.92, t)) : 0;
      if (face !== c.face || blink !== c.blinking || Math.abs(talk - (c.talk || 0)) > 0.05) { c.face = face; c.blinking = blink; c.talk = talk; paintFace(c, blink); }
    }
    kids.forEach(o => { // 배경 아이들: 들썩이고 살짝 기웃거린다
      o.n.position.y = o.y + Math.abs(Math.sin(sec * 3.1 + o.ph)) * 0.035 * cheer * live;
      o.n.rotation.z = o.rz + Math.sin(sec * 2.3 + o.ph) * 0.05 * cheer * live;
    });
  };
}
// 영상 찍기 창구 (?rec): 밖(tools/cuts.mjs)에서 한 장씩 불러 간다
if (ARGS.has('rec')) {
  window.__rec = {
    ready: () => !!(stageNow && stageNow.name) && !capBusy,
    panels: id => BOOK.scenes[id].panels.map((p, i) => ({ i, video: p.text == null && !p.phone && !p.note })),
    // 컷 i 의 영상 장면들을 차례로 찍어 onFrame(jpeg 주소) 에 넘긴다
    async cut(id, i, { fps = 24, sec = 3.6, w = 900 } = {}, onFrame = window.__frame) {
      const ps = BOOK.scenes[id].panels, p = ps[i], hh = Math.round(w / 1.6), n = Math.round(fps * sec);
      await serial(async () => {
        const at = cutAnim(p, ps[i - 1]);
        wallsForShot(shotCam.position);
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = hh;
        const g = cv.getContext('2d', { willReadFrequently: true });
        try {
          for (let f = 0; f <= n; f++) {
            at(f / n, f / fps);
            scene.render();
            g.drawImage(await loadImg(await snap(shotCam, w, hh)), 0, 0);
            screentone(g, w, hh);
            await onFrame(cv.toDataURL('image/jpeg', 0.93));
          }
        } finally { restoreWalls(); hiddenKids.forEach(k => k.setEnabled(true)); hiddenKids = []; for (const k in CH) CH[k].talk = 0; applyCut(p); }
      });
    },
    snapP: (p, w = 900) => { applyCut(p); return shoot(p, w, Math.round(w / 1.6)); },
    still: (id, i, w = 900) => { const p = BOOK.scenes[id].panels[i]; applyCut(p); return shoot(p, w, Math.round(w / 1.6)); },
  };
}
