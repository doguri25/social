// ===== 이야기 진행: 장면, 표시(flag), 갈림길, 결말, 내가 고른 길 =====
let BOOK = null;
let flags = {};
let trail = []; // 지나온 갈림길 기록
let curScene = null, curPart = null, curSet = null, runId = 0, lastEnd = null;

function loadBook(id) {
  BOOK = STORIES[id];
  BOOK.castById = {};
  BOOK.cast.forEach((c, i) => { BOOK.castById[c.id] = c; if (!CH[c.id]) makeChar(c, i); });
}
// "자리 자세 표정 [크기]"
function parseCast(str) { const [spot, pose = 'stand', face = 'calm', sc] = str.split(/\s+/); return { spot, pose, face, scale: sc ? +sc : 1 }; }
// 무대 상태 적용. merge 이면 지금 상태에 덧씌운다 (인물을 빼려면 "hide")
function applySet(stageName, set, merge) {
  if (stageName && (!stageNow || stageNow.name !== stageName)) showStage(stageName);
  curSet = merge
    ? Object.assign({}, curSet, set, { cast: Object.assign({}, curSet && curSet.cast, set.cast) })
    : Object.assign({}, set, { cast: Object.assign({}, set.cast) });
  for (const id in CH) {
    const c = CH[id];
    const spec = curSet.cast[id];
    const spot = spec && spec !== 'hide' && stageNow.def.spots[parseCast(spec).spot];
    if (!spot) { c.root.setEnabled(false); continue; }
    const s = parseCast(spec);
    placeChar(c, spot, s.scale);
    c.base = s.pose;
    c.face0 = s.face;
    setPose(c, s.pose);
    setFace(c, s.face);
  }
  if (stageNow.apply) stageNow.apply(curSet);
  updateCast();
  poke();
}
function applyItemSet(it) { if (it.stage) applySet(it.stage, it.set || {}, false); else applySet(null, it.set || {}, true); }
function addFlags(add) { for (const k in add || {}) flags[k] = (flags[k] || 0) + add[k]; }
// 조건: { 이름: 수 } 는 그 수 이상, { 이름: { max: 수 } } 는 그 수 이하
function meets(cond, f = flags) {
  return Object.entries(cond || {}).every(([k, c]) => {
    const v = f[k] || 0;
    return typeof c === 'number' ? v >= c : !((c.max != null && v > c.max) || (c.min != null && v < c.min));
  });
}

function startBook(id, sceneId) {
  loadBook(id);
  flags = {};
  trail = [];
  curPart = null;
  runFrom(sceneId && BOOK.scenes[sceneId] ? sceneId : BOOK.start, {});
}
// 새 흐름을 시작하면 앞 흐름의 기다림은 모두 취소된다
async function runFrom(sceneId, opt) {
  cancelFlow();
  const my = ++runId;
  try {
    let id = sceneId, o = opt;
    while (id && my === runId) { id = await playScene(id, o, my); o = {}; }
  } catch (e) {
    if (e !== CANCEL) { console.error(e); toast('문제가 생겼어요. 책장으로 돌아가 다시 열어 주세요.'); }
  }
}
function chk(my) { if (my !== runId) throw CANCEL; }

async function showAndWait(p, my) { await showPanel(p, my); await waitNext(); chk(my); }

async function playScene(id, opt, my) {
  const sc = BOOK.scenes[id];
  curScene = id;
  const from = opt.from || 0;
  const stageChanged = !stageNow || sc.stage !== stageNow.name;
  applySet(sc.stage, sc.set || {}, false);
  for (let i = 0; i < from && i < sc.panels.length; i++) if (sc.panels[i].stage || sc.panels[i].set) applyItemSet(sc.panels[i]);
  const partChanged = !!sc.part && sc.part !== curPart;
  if (sc.part) curPart = sc.part;
  setHeader(parseInt(sc.page, 10) || 1);
  resetHist();
  buildHot(asList(sc.explore), it => showPop(it, it.text));
  if (!from && (stageChanged || partChanged || asList(sc.explore).length)) { await askIntro(sc, partChanged ? sc.part : null); chk(my); }
  if (opt.note) await showAndWait({ text: opt.note, tone: 'note' }, my);
  let pick = opt.pick;
  for (let i = from; i < sc.panels.length; i++) {
    const it = sc.panels[i];
    if (it.stage || it.set) { applyItemSet(it); continue; }
    if (it.feel) {
      const k = await askFeel(it.feel); chk(my);
      bookRec(BOOK.id).feels[`${id}:${i}`] = k;
      store();
      continue;
    }
    if (it.whatif) { await playWhatif(it.whatif, id, i, pick, my); pick = undefined; continue; }
    if (it.activity === 'breathe') { await breathe(); chk(my); if (hist.length) renderEntry(); continue; }
    await showAndWait(it, my);
  }
  if (sc.choices) {
    const before = Object.assign({}, flags);
    const k = pick != null ? pick : await askChoice(sc.choices, 'choice');
    chk(my);
    const o = sc.choices.opts[k];
    trail.push({ type: 'choice', scene: id, at: sc.panels.length, q: sc.choices.q, opts: sc.choices.opts.map(x => x.text), pick: k, flags: before });
    addFlags(o.add);
    return o.go;
  }
  if (sc.compose) { await playCompose(sc, id, opt.pieces, my); return null; }
  return sc.go || null;
}

async function playWhatif(w, sceneId, at, preset, my) {
  const k = preset != null ? preset : await askChoice(w, 'whatif');
  chk(my);
  trail.push({ type: 'whatif', scene: sceneId, at, q: w.q, opts: w.opts.map(x => x.text), pick: k, flags: Object.assign({}, flags) });
  const o = w.opts[k];
  if (o.story) return showAndWait({ text: w.same, tone: 'note' }, my);
  const keepStage = stageNow.name, keepSet = curSet;
  for (const p of o.panels) {
    if (p.stage || p.set) { applyItemSet(p); continue; }
    await showAndWait(Object.assign({ tone: 'whatif' }, p), my);
  }
  applySet(keepStage, keepSet, false);
  await showAndWait({ text: w.back, tone: 'note' }, my);
}

async function playCompose(sc, id, preset, my) {
  const spec = sc.compose;
  const before = Object.assign({}, flags);
  const avail = spec.pieces.filter(pc => meets(pc.when, flags));
  const picked = preset || await askCompose(spec, avail);
  chk(my);
  trail.push({ type: 'compose', scene: id, at: sc.panels.length, q: spec.q, opts: picked.map(pc => pc.text), pick: -1, flags: before });
  picked.forEach(pc => addFlags(pc.add));
  for (const pc of picked) {
    await showAndWait({
      shot: pc.shot || 'two', on: pc.on || [spec.who, spec.to], pre: pc.pre,
      faces: { [spec.who]: pc.face || 'shy' }, poses: pc.pose ? { [spec.who]: pc.pose } : undefined,
      lines: [{ who: spec.who, say: pc.text }],
    }, my);
  }
  // 결말: 남은 면을 결말 장면으로 센다
  const end = BOOK.endings.find(e => meets(e.when)) || BOOK.endings[BOOK.endings.length - 1];
  setHeader(BOOK.pages - 2);
  resetHist();
  for (const it of end.panels) {
    if (it.stage || it.set) { applyItemSet(it); continue; }
    await showAndWait(it, my);
  }
  const rec = bookRec(BOOK.id);
  if (!rec.endings.includes(end.id)) rec.endings.push(end.id);
  store();
  lastEnd = end;
  sfx('end');
  await endingMenu(end, my);
}

async function endingMenu(end, my) {
  setHeader(BOOK.pages);
  const act = await endingCard(end);
  chk(my);
  if (act === 'review') return reviewMenu(my);
  if (act === 'retry') { const i = trail.map(t => t.type).lastIndexOf('compose'); return replayFrom(i, undefined); }
  if (act === 'restart') return startBook(BOOK.id);
  toShelf();
}
async function reviewMenu(my) {
  const r = await reviewCard();
  chk(my);
  if (r === 'back') return endingMenu(lastEnd, my);
  if (r === 'restart') return startBook(BOOK.id);
  if (r === 'shelf') return toShelf();
  replayFrom(r.i, r.k);
}
// 지나온 갈림길 하나로 돌아가 다시 고르기 (pick 이 있으면 그 선택으로 바로 간다)
function replayFrom(i, pick) {
  const t = trail[i];
  if (!t) return startBook(BOOK.id);
  flags = Object.assign({}, t.flags);
  trail = trail.slice(0, i);
  const sc = BOOK.scenes[t.scene];
  runFrom(t.scene, { from: t.at, pick, note: `다시, ${sc.place.split(' · ').pop()}에서` });
}
