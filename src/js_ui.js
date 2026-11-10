// ===== 무대 둘러보기(노란 점, 인물 카드, 인물 누르기), 책장, 설정, 시작 =====

// ---- 둘러보기 점: 3D 위치를 화면에 옮긴 HTML 버튼 (키보드로도 누를 수 있게) ----
let hots = [], popFor = null, alphaGoal = null;
function anchorOf(it) {
  if (it.pos) return it.pos;
  const c = CH[it.on];
  if (c && shown(c)) return BABYLON.Vector3.TransformCoordinates(V3(0, c.r * 2 + 0.2, 0), c.head.getWorldMatrix()); // 머리 꼭대기 20cm 위
  const item = stageNow.def.items[it.on];
  return item ? V3(...(item.at || item.t)).add(V3(0, 0.15, 0)) : null;
}
function toScreen(p) {
  const w = engine.getRenderWidth(), hh = engine.getRenderHeight();
  const v = BABYLON.Vector3.Project(p, BABYLON.Matrix.IdentityReadOnly, camera.getViewMatrix().multiply(camera.getProjectionMatrix()), camera.viewport.toGlobal(w, hh));
  const k = canvas.clientWidth / w;
  return { x: v.x * k, y: v.y * k, ok: v.z > 0 && v.z < 1 };
}
function buildHot(list, onPick) {
  $('#hot').replaceChildren();
  hidePop();
  hots = list.map(it => {
    const a = h('div', 'hs-a');
    const b = btn(it.label || '?', 'hs' + (it.cls ? ' ' + it.cls : ''), e => { e.stopPropagation(); if (e.detail > 0) b.blur(); onPick(it); });
    b.setAttribute('aria-label', it.label || t('look', { name: BOOK.castById[it.on] ? BOOK.castById[it.on].name : t('thing') }));
    a.appendChild(b);
    $('#hot').appendChild(a);
    return { it, a };
  });
  placeHot();
}
function placeHot() {
  hots.forEach(({ it, a }) => {
    const p = anchorOf(it);
    const s = p && toScreen(p);
    a.hidden = !s || !s.ok;
    if (s) a.style.transform = `translate(${s.x}px, ${s.y}px)`;
  });
  if (popFor) placePop();
}
scene.onAfterRenderObservable.add(placeHot);
function showPop(it, text, koText) {
  const pop = $('#pop');
  pop.textContent = text;
  if (koText && showKo()) { const k = h('span', 'ko', koText); k.lang = 'ko'; pop.appendChild(k); }
  pop.hidden = false;
  popFor = it;
  placePop();
  sfx('tap');
  speak(text);
}
function placePop() {
  const pop = $('#pop'), p = anchorOf(popFor);
  if (!p) return hidePop();
  const s = toScreen(p), W = canvas.clientWidth, half = pop.offsetWidth / 2 + 8;
  pop.style.left = clamp(s.x, half, W - half) + 'px';
  pop.style.top = Math.max(pop.offsetHeight + 8, s.y - 22) + 'px';
}
function hidePop() { $('#pop').hidden = true; popFor = null; }
// 그 인물을 눌렀을 때 하는 말: 지금 장면의 둘러보기 말, 없으면 인물 소개
function sayOf(id) {
  const ex = curScene && asList(BOOK.scenes[curScene].explore).find(x => x.on === id);
  return ex ? ex.text : BOOK.castById[id].intro;
}
function sayKo(id) {
  const ex = curScene && asList(BOOK.scenes[curScene].explore).find(x => x.on === id);
  return ex ? ex['~text'] : BOOK.castById[id]['~intro'];
}
function pickChar(id) {
  selectCard(id);
  turnTo(id);
  showPop({ on: id }, sayOf(id), sayKo(id));
}
scene.onPointerObservable.add(pi => {
  if (pi.type === BABYLON.PointerEventTypes.POINTERDOWN) { hidePop(); $('#hint').hidden = true; alphaGoal = null; return; }
  if (pi.type !== BABYLON.PointerEventTypes.POINTERTAP) return;
  const hit = scene.pick(scene.pointerX, scene.pointerY, m => !!(m.metadata && m.metadata.char) && m.isEnabled());
  if (hit && hit.pickedMesh) pickChar(hit.pickedMesh.metadata.char);
});
// 그 인물 얼굴이 보이는 쪽(인물 앞)으로 카메라를 돌린다
function turnTo(id) {
  const f = facing(CH[id]), keep = [camera.alpha, camera.beta, camera.radius];
  camera.setPosition(camera.target.add(V3(f.x, 0, f.z).scale(camera.radius * Math.sin(camera.beta))).add(V3(0, camera.radius * Math.cos(camera.beta), 0)));
  alphaGoal = camera.alpha;
  [camera.alpha, camera.beta, camera.radius] = keep;
  poke();
}
scene.onBeforeRenderObservable.add(() => {
  if (alphaGoal == null) return;
  const d = ((alphaGoal - camera.alpha + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  camera.alpha += d * 0.12;
  if (Math.abs(d) < 0.003) alphaGoal = null;
  poke();
});

// ---- 인물 카드 (무대 왼쪽 아래): 지금 무대에 있는 인물. 카드 사진은 웃는 얼굴로 한 번 찍어 둔다 ----
const cardPic = {};
function selectCard(id) { $('#cast').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.id === id)); }
// 지금 장면에서 할 말이 있는 인물 카드에 ? 표시
function markCards() {
  const ex = curScene ? asList(BOOK.scenes[curScene].explore).map(x => x.on) : [];
  $('#cast').querySelectorAll('button').forEach(b => b.classList.toggle('ask', ex.includes(b.dataset.id)));
}
function updateCast() {
  const ids = BOOK.cast.map(d => d.id).filter(id => shown(CH[id]));
  const nav = $('#cast');
  if (nav.dataset.ids === ids.join()) return markCards();
  nav.dataset.ids = ids.join();
  nav.replaceChildren(...ids.map(id => {
    const d = BOOK.castById[id];
    const b = btn('', '', e => { if (e.detail > 0) b.blur(); sfx('tap'); pickChar(id); });
    b.dataset.id = id;
    b.setAttribute('aria-pressed', id === narrator().id);
    b.setAttribute('aria-label', t('look', { name: d.name }));
    const img = new Image();
    img.alt = '';
    img.style.setProperty('--c', d.card || '#f6ead7');
    if (cardPic[id]) img.src = cardPic[id];
    else portrait(CH[id], 'joy').then(u => { if (u) { cardPic[id] = u; img.src = u; } }, () => {});
    b.append(img, h('span', '', d.name));
    return b;
  }));
  markCards();
}

// ---- 책장: 처음 화면 ----
const SPINES = ['#ffcf3f', '#6fbfee', '#f497b6', '#78c78a', '#b48ad8'];
const bookIds = () => Object.keys(STORIES).sort(); // book1, book2 …
function showShelf() {
  runId++;
  cancelFlow();
  curScene = null;
  curPart = null;
  applySet('shelf', { cast: { yuna: 'shelf_l wave joy', seoa: 'shelf_r stand joy' } }, false);
  setHeader(null);
  resetHist();
  const ids = bookIds();
  const books = h('div', 'books');
  const row = (i, title, note, ready, onClick) => {
    const r = btn('', 'bookrow' + (ready ? ' ready' : ''), onClick);
    const sp = h('i', 'spine');
    sp.style.setProperty('--c', SPINES[i]);
    const txt = h('span', '');
    txt.append(h('b', '', title), h('small', '', note));
    r.append(sp, txt);
    books.appendChild(r);
  };
  ids.slice(0, 4).forEach((id, i) => {
    const B = STORIES[id], res = save.resume[id];
    row(i, t('bookRow', { n: i + 1, title: bookTitle(id) }), t('bookNote', { sub: bookSub(id), seen: seenEnds(bookRec(id), B), all: B.endings.length }) + (res ? ' · ' + t('resumeAt', { place: placeOf(id, res).split(' · ').pop() }) : ''), true, () => openBook(id));
  });
  // 다섯째 칸: 1~4권에서 결말을 하나씩 보면 열리는 「이후의 이야기」
  const read = ids.slice(0, 4).filter(id => seenEnds(bookRec(id), STORIES[id])).length;
  row(4, t('writeAfter'), unlockedAfter() ? (afterText() ? t('afterHasText') : t('afterReady')) : t('afterLocked', { n: read }), unlockedAfter(), openAfter);
  const head = h('div', 'endcard');
  const who = h('p', 'whoami');
  if (NET.mode === 'student') who.append(t('whoStudent', { alias: NET.me.alias, no: NET.me.no }), btn(t('logout'), 'chip', async () => { await logout(); showShelf(); showGate(); }));
  else who.append(t('whoGuest'), NET.server ? btn(t('joinClass'), 'chip', showGate) : '');
  head.append(h('div', 'eyebrow', t('shelfEyebrow')), h('h3', '', t('shelfTitle')), who);
  storyEl.replaceChildren(head, books);
  rise();
  setAsk('shelf', () => [heading(t('shelfAskTitle')), h('p', '', t('shelfAskBody'))]);
  const next = lastBook || ids[0];
  setNext(() => openBook(next), t('readBook', { n: ids.indexOf(next) + 1 }));
  buildHot(stageNow.books.map(b => { const id = b.i < 4 && ids[b.i]; return { pos: b.pos, book: id, cls: 'book' + (id || unlockedAfter() ? ' ready' : ''), label: id ? t('bookN', { n: b.i + 1 }) : t('afterShort') }; }), it => (it.book ? openBook(it.book) : openAfter())); // 책등 점 글은 짧게 (다섯 개가 겹치지 않게)
}
// 이어 볼 자리가 있으면 먼저 묻는다
async function openBook(id) {
  sfx('pick');
  cancelFlow(); // 앞서 띄운 이어 보기 물음은 거둔다
  const my = ++runId;
  const res = save.resume[id];
  if (res && !ARGS.get('scene')) {
    const pick = await waitFor(done => {
      setAsk('resume', () => {
        const r = h('div', 'btnrow');
        r.append(btn(t('resumeFrom', { place: placeOf(id, res) }), 'sbtn primary', () => done('resume')), btn(t('restart'), 'sbtn', () => done('start')), btn(t('toShelf'), 'sbtn', () => done('cancel')));
        return [heading(bookTitle(id)), h('p', '', t('resumeAsk')), r];
      });
      setNext(() => done('resume'), t('resume'));
      focusFirst('.sbtn');
      return doneAsk;
    }).catch(() => 'cancel');
    if (my !== runId) return; // 그새 다른 책·이후의 이야기·책장으로 갔으면 그쪽을 둔다
    if (pick === 'cancel') return showShelf();
    if (pick === 'resume') return startBook(id, null, res);
  }
  startBook(id, ARGS.get('scene'));
}
// ---- 이후의 이야기: 1~4권에서 결말을 하나씩 본 뒤에 열린다. 선생님이 들려주는 이야기 시작(여섯 가지 가운데 하나, 무작위)을 읽고 이어 쓴다.
// 학생은 학급 서버로 내고, 로그인 없이 쓰면 이 기기에만
const AFTER_PROMPT = UI_KO.afterPrompt; // 선생님이 바꾸지 않은 안내 (다른 언어면 번역해 보여 준다)
const afterRules = () => [t('afterRule1'), t('afterRule2'), t('afterRule3')];
const afterDoc = () => (NET.mode === 'student' ? NET.me.story : save.after) || null;
const afterText = () => (afterDoc() || {}).text || '';
const draftKey = () => `social-draft-${NET.mode === 'student' ? NET.me.no : 'guest'}`;
function readDraft() {
  let raw = null;
  try { raw = localStorage.getItem(draftKey()); const d = JSON.parse(raw); if (d && typeof d === 'object') return d; } catch (e) { /* v0.7 은 글만 그대로 저장했다 */ }
  return raw ? { text: raw } : null;
}
function openAfter() {
  if (!unlockedAfter()) return toast(t('afterLockedToast'));
  sfx('pick');
  runId++;
  cancelFlow();
  buildHot([], () => {});
  setHeader(null);
  const student = NET.mode === 'student';
  const min = student ? NET.me.minChars : 200, max = student ? NET.me.maxChars || 500 : 500;
  const draft = readDraft(), doc = afterDoc();
  // 이야기 시작: 낸 글이나 쓰던 글의 시작을 그대로, 없으면 여섯 가지 가운데 하나를 무작위로
  let starter = [draft && draft.starter, doc && doc.starter].find(v => STARTERS.some(x => x.id === v));
  if (starter == null) starter = STARTERS[Math.floor(Math.random() * STARTERS.length)].id;
  const ta = h('textarea', 'afterta');
  ta.value = (draft && draft.text && !(doc && draft.at != null && doc.at > draft.at) && draft.text) || afterText(); // 이 기기 초안보다 나중에 낸 글(다른 기기)이 있으면 그 글 (시각이 없는 예전 초안은 예전처럼 초안 먼저)
  ta.placeholder = t('afterPlaceholder');
  ta.setAttribute('aria-label', t('afterLabel'));
  const count = h('div', 'aftercount');
  const box = h('div', 'starter');
  const drawStarter = () => {
    const st = STARTERS.find(x => x.id === starter);
    box.replaceChildren(h('b', '', t('starterBy', { title: starterT(st, 'title'), who: starterT(st, 'who') })), ...starterT(st, 'text').split('\n').map(l => h('p', '', l)));
    if (showKo()) { const k = h('div', 'ko', st.text); k.lang = 'ko'; box.appendChild(k); }
  };
  const keep = () => { try { localStorage.setItem(draftKey(), JSON.stringify({ text: ta.value, starter, at: srvNow() })); } catch (e) { /* 저장 못 해도 쓰기는 계속 */ } };
  let sending = false;
  const submit = async () => {
    if (sending) return;
    sending = true;
    const text = ta.value.trim();
    try {
      if (student) { await api('story', { text, starter }); NET.me.story = { text, starter, at: srvNow() }; }
      else { save.after = { text, starter, at: Date.now() }; store(); }
      try { localStorage.removeItem(draftKey()); } catch (e) { /* 없음 */ }
      sfx('end');
      toast(student ? t('afterSent') : t('afterSaved'));
    } catch (e) { toast(e.message); } finally { sending = false; }
  };
  const upd = () => {
    const n = [...ta.value.replace(/\s/g, '')].length;
    count.textContent = t('charCount', { n, min, max });
    count.classList.toggle('ok', n >= min && n <= max);
    count.classList.toggle('over', n > max);
    setNext(n >= min && n <= max ? submit : null, student ? t('sendTeacher') : t('saveHere'));
    renderAsk();
  };
  ta.addEventListener('input', () => { upd(); keep(); }); // 열기만 해서는 초안을 만들지 않는다
  drawStarter();
  const card = h('div', 'endcard after');
  const prompt = student && NET.me.prompt && (LANG === 'ko' || NET.me.prompt !== AFTER_PROMPT) ? NET.me.prompt : t('afterPrompt'); // 선생님이 고친 안내는 그대로
  card.append(h('div', 'eyebrow', t('afterLabel')), h('h3', '', t('afterTitle')), box, h('p', 'aprompt', prompt), ta, count);
  if (LANG !== 'ko') card.insertBefore(h('p', 'soft', t('afterAnyLang')), ta);
  storyEl.replaceChildren(card);
  rise();
  setAsk('after', () => {
    const r = h('div', 'btnrow');
    // 아직 한 글자도 쓰지 않았을 때만 다른 이야기 시작으로 바꿀 수 있다
    if (!ta.value.trim()) r.append(btn(t('otherStarter'), 'sbtn', () => { const rest = STARTERS.filter(x => x.id !== starter); starter = rest[Math.floor(Math.random() * rest.length)].id; drawStarter(); keep(); sfx('tap'); }));
    r.append(btn(t('toShelf'), 'sbtn', showShelf));
    const rules = h('ul', 'rules');
    afterRules().forEach(t2 => rules.appendChild(h('li', '', t2)));
    return [heading(t('howWrite'), 'spark'), rules, h('p', '', student ? t('afterStudentNote') : t('afterGuestNote')), r];
  });
  upd();
  setTimeout(() => ta.focus({ preventScroll: true }), 80);
}
function toShelf() {
  loadBook('book1');
  showShelf();
}

// ---- 설정 ----
function seg(options, value, onPick) {
  const s = h('div', 'seg');
  options.forEach(([v, text]) => {
    const b = btn(text, '', () => { s.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); onPick(v); });
    b.setAttribute('aria-pressed', v === value);
    s.appendChild(b);
  });
  return s;
}
function openSettings() {
  const ov = $('#settings');
  const card = h('div', 'card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', t('settings'));
  const row = (name, note, ctrl) => { const r = h('div', 'setrow'); const t = h('span', '', name); if (note) t.appendChild(h('small', '', note)); r.append(t, ctrl); return r; };
  const onOff = (key, after) => seg([[true, t('on')], [false, t('off')]], !!save.set[key], v => { save.set[key] = v; store(); if (after) after(v); });
  const read = onOff('read', v => { if (!v) hush(); });
  if (!koVoice) read.querySelectorAll('button').forEach(b => { b.disabled = true; });
  const link = h('div', 'linkbox', '');
  link.hidden = true;
  const copy = btn(t('copyLink'), 'sbtn', () => {
    const url = `${location.origin}${location.pathname}?book=${(lastBook || 'book1').slice(4)}${classMode() ? '&mode=class' : ''}`;
    link.textContent = url;
    link.hidden = false;
    try { navigator.clipboard.writeText(url).then(() => toast(t('linkCopied')), () => toast(t('linkHold'))); } catch (e) { toast(t('linkHold')); }
  });
  let sure = false;
  const wipe = btn(t('wipe'), 'sbtn', () => {
    if (!sure) { sure = true; wipe.textContent = t('wipeSure'); return; }
    for (const k of Object.keys(GUEST.books)) delete GUEST.books[k]; // 이 기기 기록만, 같은 그릇을 비운다 (학급 서버 기록은 그대로)
    store();
    wipe.textContent = t('wiped');
    wipe.disabled = true;
  });
  const close = btn(t('close'), 'btn go', e => { ov.hidden = true; if (e.detail > 0) document.activeElement.blur(); else $('#btnSet').focus({ preventScroll: true }); }); // 마우스로 닫은 뒤의 Enter 는 「다음」
  close.style.justifySelf = 'end';
  card.append(
    h('h2', '', t('settings')),
    row(t('readAloud'), koVoice ? t('readAloudNote') : t('noVoice', { lang: langName(LANG) }), read),
    row(t('lang'), t('langNote'), (() => { const sg = seg(LANGS.map(([c, n]) => [c, n]), LANG, v => { setLang(v); openSettings(); }); sg.querySelectorAll('button').forEach((b, i) => { b.disabled = !langReady(LANGS[i][0]); }); return sg; })()),
    ...(LANG !== 'ko' ? [row(t('both'), t('bothNote'), onOff('both', () => { if (hist.length) renderEntry(); else renderAsk(); }))] : []),
    row(t('fontSize'), '', seg([[0.9, t('small')], [1, t('normal')], [1.2, t('large')]], save.set.fs, v => { save.set.fs = v; store(); document.documentElement.style.setProperty('--fs', v); fitSide(); })),
    row(t('quality'), t('qualityNote'), seg([['auto', t('auto')], ['low', t('low')], ['high', t('high')]], save.set.q, v => { save.set.q = v; slowDevice = false; frames = ftime = 0; store(); applyTier(); })),
    row(t('sound'), '', onOff('sound')),
    row(t('classMode'), t('classModeNote'), seg([[true, t('on')], [false, t('off')]], classMode(), v => { save.set.cls = v; if (!v) CLS_LINK = false; store(); renderAsk(); })),
    row(t('classLink'), t('classLinkNote'), copy),
    link,
    row(t('records'), t('recordsNote'), wipe),
    h('small', 'ver', t('version', { v: VERSION })),
    close,
  );
  ov.replaceChildren(card);
  ov.hidden = false;
  close.focus({ preventScroll: true });
}
function setPaused(on, mouse) {
  paused = on;
  $('#pause').hidden = !on;
  if (on) { hush(); $('#btnResume').focus({ preventScroll: true }); } else { poke(); if (mouse) document.activeElement.blur(); else $('#btnPause').focus({ preventScroll: true }); } // 마우스로 닫은 뒤의 Enter 는 「다음」
}
$('#btnSet').addEventListener('click', openSettings);
$('#btnPause').addEventListener('click', () => setPaused(true));
$('#btnResume').addEventListener('click', e => setPaused(false, e.detail > 0));
// 처음 화면으로: 지금 장면을 이어 보기 자리로 저장하고(장면을 시작할 때 이미 적어 둠) 책장으로
$('#btnHome').addEventListener('click', () => { sfx('tap'); flush(true); toast(NET.mode === 'student' ? t('homeToastServer') : t('homeToastDevice')); toShelf(); });
addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (!$('#settings').hidden) $('#settings').hidden = true; else if (paused) setPaused(false); return; }
  if (!$('#settings').hidden || !$('#gate').hidden || paused) return;
  if (e.isComposing || e.target.closest('input, textarea, select, [contenteditable]')) return; // 글 쓰는 칸에서는 Enter·화살표를 그대로
  if (e.repeat && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); return; } // 누르고 있어도 새로 초점을 받은 단추(선택지·감정 카드·바구니)가 저절로 눌리지 않게
  if (document.activeElement !== canvas && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { alphaGoal = camera.alpha + (e.key === 'ArrowLeft' ? 0.35 : -0.35); poke(); return; }
  if ((e.key === 'Enter' || e.key === 'PageDown') && !e.target.closest('button, [role="button"]')) { e.preventDefault(); if (!e.repeat) $('#btnNext').click(); } // 누르고 있어도 한 컷만
});

// 시험용으로 지금 상태만 읽을 수 있게 (바꾸지는 못함)
window.__maum = { state: () => ({ scene: curScene, stage: stageNow && stageNow.name, kind: askKind, flags: Object.assign({}, flags), trail: trail.length, ending: lastEnd && lastEnd.id, cuts: hist.length, at: hi, next: !$('#btnNext').disabled, walls: stageNow ? stageNow.walls.map(w => +w.vis.toFixed(2)) : [], tier, busy: capBusy }) };

async function boot() {
  document.documentElement.style.setProperty('--fs', save.set.fs);
  // 캔버스에 쓰는 글씨(칠판, 포스터, 지도)가 제 글꼴로 그려지도록 글꼴을 먼저 받는다
  try { await Promise.race([Promise.all([document.fonts.load('32px Jua'), LANG === 'vi' || LANG === 'ru' ? document.fonts.load('600 32px Nunito') : null]), sleep(2500)]); } catch (e) { /* 기본 글꼴로 */ }
  try { await loadModels(); } catch (e) { console.error(e); $('#loading').textContent = t('loadFail'); $('#loading').dataset.err = '1'; return; }
  applyTier();
  loadBook('book1');
  const logged = await netBoot(); // 학급 서버가 있으면: QR(?c=)·쿠키로 학생 로그인 (그 전에 책장을 누르면 「로그인 없이」 기록에 섞인다)
  $('#loading').hidden = true;
  const want = 'book' + ARGS.get('book');
  if (STORIES[want]) { if (ARGS.get('scene')) startBook(want, ARGS.get('scene')); else { showShelf(); openBook(want); } } // 수업 링크는 첫 화면을 건너뛴다 (이어 볼 자리가 있으면 묻는다)
  else { showShelf(); if (!logged) showGate(); }
  ARGS.delete('scene'); // 장면 바로 열기는 처음 한 번만 (책장에서 다른 책을 열 때는 처음부터)
}
// ---- 언어 바꾸기: 화면 글자는 바로, 이야기 글은 책을 다시 열 때부터 (책장이면 바로 다시 그린다) ----
function setLang(code) {
  if (code === LANG || !langReady(code)) return;
  LANG = save.set.lang = code;
  store();
  findVoice();
  applyStatic();
  renderFoot();
  if (askKind === 'shelf') { loadBook('book1'); showShelf(); } else renderAsk(); // 책장은 바로 그 언어로, 읽던 책은 다시 열 때부터
}
// ---- 첫 화면: 언어 고르기, 접속 코드, 로그인 없이 하기, 저장하는 것 안내 ----
function showGate() {
  const ov = $('#gate');
  const card = h('div', 'card gatecard');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', t('gateTitle'));
  const langs = h('div', 'langs');
  LANGS.forEach(([code, name]) => {
    const ready = langReady(code);
    const b = btn(ready ? name : `${name} · ${t('soon')}`, 'chip', () => { setLang(code); showGate(); });
    b.setAttribute('aria-pressed', code === LANG);
    b.disabled = !ready;
    langs.appendChild(b);
  });
  card.append(langs, h('h2', '', t('gateTitle')), h('p', 'soft', t('gateSub')));
  const close = () => { ov.hidden = true; showShelf(); };
  if (NET.server) {
    const inp = h('input', 'codein');
    Object.assign(inp, { maxLength: 6, autocomplete: 'off', placeholder: 'ABC234', spellcheck: false });
    inp.setAttribute('autocapitalize', 'characters');
    inp.setAttribute('aria-label', t('code'));
    const err = h('p', 'err', '');
    let sending = false;
    const go = async () => { if (sending) return; sending = true; try { await loginCode(inp.value.trim()); sfx('pick'); close(); } catch (e) { err.textContent = e.message; } finally { sending = false; } };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.repeat && !e.isComposing) go(); }); // 누르고 있어도 한 번만
    const r = h('div', 'coderow');
    r.append(inp, btn(t('enter'), 'btn go', go));
    card.append(h('label', 'lab', t('code')), r, h('p', 'soft', t('codeHint')), err);
  } else if (!/vercel\.app$/.test(location.hostname)) {
    const a = h('a', '', APP_URL);
    a.href = APP_URL;
    card.append(h('p', 'soft', t('noServer')), a);
  } else card.append(h('p', 'soft', t('serverNotReady')));
  card.append(btn(t('guest'), 'btn ghost wide', () => { enterGuest(); close(); }), h('p', 'soft small', t('guestNote')), h('p', 'soft small', t('privacy')));
  if (NET.server) { const a = h('a', 'small', t('teacher')); a.href = 'teacher.html'; card.appendChild(a); }
  ov.replaceChildren(card);
  ov.hidden = false;
  setTimeout(() => (card.querySelector('.codein') || card.querySelector('button.wide')).focus({ preventScroll: true }), 60);
}
boot();
