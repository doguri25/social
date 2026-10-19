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
    const b = btn(it.label || '?', 'hs' + (it.cls ? ' ' + it.cls : ''), e => { e.stopPropagation(); onPick(it); });
    b.setAttribute('aria-label', it.label || `${BOOK.castById[it.on] ? BOOK.castById[it.on].name : '물건'} 살펴보기`);
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
function showPop(it, text) {
  const pop = $('#pop');
  pop.textContent = text;
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
function pickChar(id) {
  selectCard(id);
  turnTo(id);
  showPop({ on: id }, sayOf(id));
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
    const b = btn('', '', () => { sfx('tap'); pickChar(id); });
    b.dataset.id = id;
    b.setAttribute('aria-pressed', id === narrator().id);
    b.setAttribute('aria-label', `${d.name} 살펴보기`);
    const img = new Image();
    img.alt = '';
    img.style.setProperty('--c', d.card || '#f6ead7');
    if (cardPic[id]) img.src = cardPic[id];
    else portrait(CH[id], 'joy').then(u => { cardPic[id] = u; img.src = u; }, () => {});
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
    row(i, `${i + 1}권 · ${B.title}`, `${B.sub} · 본 결말 ${seenEnds(bookRec(id), B)} / ${B.endings.length}${res ? ` · 이어 보기: ${res.place.split(' · ').pop()}` : ''}`, true, () => openBook(id));
  });
  // 다섯째 칸: 1~4권에서 결말을 하나씩 보면 열리는 「이후의 이야기」
  const read = ids.slice(0, 4).filter(id => (bookRec(id).endings || []).length).length;
  row(4, '이후의 이야기 쓰기', unlockedAfter() ? (afterText() ? '쓴 글이 있어요 · 고쳐 쓸 수 있어요' : '네 권을 다 읽었어요. 이제 쓸 수 있어요') : `${read} / 4권 읽음 · 네 권에서 결말을 하나씩 보면 열려요`, unlockedAfter(), openAfter);
  const head = h('div', 'endcard');
  const who = h('p', 'whoami');
  if (NET.mode === 'student') who.append(`${NET.me.alias}(${NET.me.no}번)으로 들어왔어요 · 기록은 학급 서버에 `, btn('나가기', 'chip', async () => { await logout(); showShelf(); showGate(); }));
  else who.append('로그인 없이 하는 중 · 기록은 이 기기에만 ', NET.server ? btn('학급 접속하기', 'chip', showGate) : '');
  head.append(h('div', 'eyebrow', '마음 극장 책장'), h('h3', '', '읽을 책을 골라요'), who);
  storyEl.replaceChildren(head, books);
  rise();
  setAsk('shelf', () => [heading('그림책을 펼쳐요'), h('p', '', '3D 무대와 웹툰으로 읽고, 갈림길에서 직접 골라 보는 이야기예요. 무대의 노란 책을 눌러도 돼요.')]);
  const next = lastBook || ids[0];
  setNext(() => openBook(next), `${ids.indexOf(next) + 1}권 읽기`);
  buildHot(stageNow.books.map(b => { const id = b.i < 4 && ids[b.i]; return { pos: b.pos, book: id, cls: 'book' + (id || unlockedAfter() ? ' ready' : ''), label: id ? `${b.i + 1}권` : '이후' }; }), it => (it.book ? openBook(it.book) : openAfter())); // 책등 점 글은 짧게 (다섯 개가 겹치지 않게)
}
// 이어 볼 자리가 있으면 먼저 묻는다
async function openBook(id) {
  sfx('pick');
  const res = save.resume[id];
  if (res && !ARGS.get('scene')) {
    const pick = await waitFor(done => {
      setAsk('resume', () => {
        const r = h('div', 'btnrow');
        r.append(btn(`이어 보기 · ${res.place}`, 'sbtn primary', () => done('resume')), btn('처음부터', 'sbtn', () => done('start')), btn('책장으로', 'sbtn', () => done('cancel')));
        return [heading(`${STORIES[id].title}`), h('p', '', '지난번에 읽던 곳이 있어요. 이어서 볼까요?'), r];
      });
      setNext(() => done('resume'), '이어 보기');
      focusFirst('.sbtn');
      return doneAsk;
    }).catch(() => 'cancel');
    if (pick === 'cancel') return showShelf();
    if (pick === 'resume') return startBook(id, null, res);
  }
  startBook(id, ARGS.get('scene'));
}
// ---- 이후의 이야기: 1~4권에서 결말을 하나씩 본 뒤에 열린다. 선생님이 들려주는 이야기 시작(여섯 가지 가운데 하나, 무작위)을 읽고 이어 쓴다.
// 학생은 학급 서버로 내고, 로그인 없이 쓰면 이 기기에만
const AFTER_PROMPT = '선생님이 들려준 이야기의 시작을 읽고, 그다음에 벌어질 일을 상상해서 이어 써 보세요.';
const AFTER_RULES = ['유나·지우·민준·서아 가운데 한 명 이상이 나오고, 이야기 흐름이 이어지게', '중심 문장 하나 + 뒷받침 문장', "'대포알·숟가락·수첩' 같은 감각적 표현(비유) 한 가지"];
const afterDoc = () => (NET.mode === 'student' ? NET.me.story : save.after) || null;
const afterText = () => (afterDoc() || {}).text || '';
const draftKey = () => `social-draft-${NET.mode === 'student' ? NET.me.no : 'guest'}`;
function readDraft() {
  let raw = null;
  try { raw = localStorage.getItem(draftKey()); const d = JSON.parse(raw); if (d && typeof d === 'object') return d; } catch (e) { /* v0.7 은 글만 그대로 저장했다 */ }
  return raw ? { text: raw } : null;
}
function openAfter() {
  if (!unlockedAfter()) return toast('1~4권에서 결말을 하나씩 보면 열려요.');
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
  ta.value = (draft && draft.text) || afterText();
  ta.placeholder = '이야기 시작 바로 다음부터 이어서 써요.';
  ta.setAttribute('aria-label', '이후의 이야기');
  const count = h('div', 'aftercount');
  const box = h('div', 'starter');
  const drawStarter = () => {
    const st = STARTERS.find(x => x.id === starter);
    box.replaceChildren(h('b', '', `「${st.title}」 · ${st.who}가 들려주는 이야기`), ...st.text.split('\n').map(l => h('p', '', l)));
  };
  const keep = () => { try { localStorage.setItem(draftKey(), JSON.stringify({ text: ta.value, starter })); } catch (e) { /* 저장 못 해도 쓰기는 계속 */ } };
  const submit = async () => {
    const text = ta.value.trim();
    try {
      if (student) { await api('story', { text, starter }); NET.me.story = { text, starter, at: Date.now() }; }
      else { save.after = { text, starter, at: Date.now() }; store(); }
      try { localStorage.removeItem(draftKey()); } catch (e) { /* 없음 */ }
      sfx('end');
      toast(student ? '냈어요! 선생님이 읽어 볼 거예요. 짝과 바꿔 읽은 뒤 고쳐서 다시 낼 수도 있어요.' : '이 기기에 저장했어요.');
    } catch (e) { toast(e.message); }
  };
  const upd = () => {
    const n = [...ta.value.replace(/\s/g, '')].length;
    count.textContent = `${n}자 · ${min}~${max}자 (띄어쓰기 빼고)`;
    count.classList.toggle('ok', n >= min && n <= max);
    count.classList.toggle('over', n > max);
    setNext(n >= min && n <= max ? submit : null, student ? '선생님께 내기' : '이 기기에 저장');
    keep();
    renderAsk();
  };
  ta.addEventListener('input', upd);
  drawStarter();
  const card = h('div', 'endcard after');
  card.append(h('div', 'eyebrow', '이후의 이야기'), h('h3', '', '그다음 이야기를 써요'), box, h('p', 'aprompt', student ? NET.me.prompt : AFTER_PROMPT), ta, count);
  storyEl.replaceChildren(card);
  rise();
  setAsk('after', () => {
    const r = h('div', 'btnrow');
    // 아직 한 글자도 쓰지 않았을 때만 다른 이야기 시작으로 바꿀 수 있다
    if (!ta.value.trim()) r.append(btn('다른 이야기 시작', 'sbtn', () => { const rest = STARTERS.filter(x => x.id !== starter); starter = rest[Math.floor(Math.random() * rest.length)].id; drawStarter(); keep(); sfx('tap'); }));
    r.append(btn('책장으로', 'sbtn', showShelf));
    const rules = h('ul', 'rules');
    AFTER_RULES.forEach(t2 => rules.appendChild(h('li', '', t2)));
    return [heading('이렇게 써 보세요', 'spark'), rules, h('p', '', student ? '다 쓰면 선생님께 내요. 짝과 바꿔 읽고 한 문장을 고친 뒤 다시 낼 수 있어요.' : '로그인 없이 쓰는 글은 이 기기에만 저장되고 선생님께 가지 않아요.'), r];
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
  card.setAttribute('aria-label', '설정');
  const row = (name, note, ctrl) => { const r = h('div', 'setrow'); const t = h('span', '', name); if (note) t.appendChild(h('small', '', note)); r.append(t, ctrl); return r; };
  const onOff = (key, after) => seg([[true, '켬'], [false, '끔']], !!save.set[key], v => { save.set[key] = v; store(); if (after) after(v); });
  const read = onOff('read', v => { if (!v) hush(); });
  if (!koVoice) read.querySelectorAll('button').forEach(b => { b.disabled = true; });
  const link = h('div', 'linkbox', '');
  link.hidden = true;
  const copy = btn('수업 링크 복사', 'sbtn', () => {
    const url = `${location.origin}${location.pathname}?book=${(lastBook || 'book1').slice(4)}${save.set.cls ? '&mode=class' : ''}`;
    link.textContent = url;
    link.hidden = false;
    try { navigator.clipboard.writeText(url).then(() => toast('수업 링크를 복사했어요.'), () => toast('아래 주소를 길게 눌러 복사해 주세요.')); } catch (e) { toast('아래 주소를 길게 눌러 복사해 주세요.'); }
  });
  let sure = false;
  const wipe = btn('기록 지우기', 'sbtn', () => {
    if (!sure) { sure = true; wipe.textContent = '한 번 더 누르면 지워져요'; return; }
    save.books = {};
    store();
    wipe.textContent = '지웠어요';
    wipe.disabled = true;
  });
  const close = btn('닫기', 'btn go', () => { ov.hidden = true; $('#btnSet').focus({ preventScroll: true }); });
  close.style.justifySelf = 'end';
  card.append(
    h('h2', '', '설정'),
    row('읽어 주기', koVoice ? '글과 말풍선을 소리 내어 읽어요' : '이 기기에는 한국어 목소리가 없어요', read),
    row('언어', '다른 언어는 번역을 넣으면 고를 수 있어요. 책을 새로 열 때부터 바뀌어요', (() => { const sg = seg(LANGS.map(([c, n]) => [c, n]), LANG, v => { LANG = save.set.lang = v; store(); findVoice(); }); sg.querySelectorAll('button').forEach((b, i) => { b.disabled = !langReady(LANGS[i][0]); }); return sg; })()),
    row('글자 크기', '', seg([[0.9, '작게'], [1, '보통'], [1.2, '크게']], save.set.fs, v => { save.set.fs = v; store(); document.documentElement.style.setProperty('--fs', v); fitSide(); })),
    row('화질', '높음: 그늘과 빛 번짐까지 / 느리면 「낮음」', seg([['auto', '자동'], ['low', '낮음'], ['high', '높음']], save.set.q, v => { save.set.q = v; slowDevice = false; store(); applyTier(); })),
    row('효과음', '', onOff('sound')),
    row('함께 보기', '전자칠판용: 고를 때 선생님 질문, 생각 시간, 손든 사람 수', onOff('cls')),
    row('수업 링크', '이 설정 그대로 마지막에 연 책을 바로 여는 주소 (GitHub Pages 주소에서 쓰세요)', copy),
    link,
    row('기록', '본 결말과 감정 카드 답은 이 기기에만 저장돼요', wipe),
    h('small', 'ver', `마음 극장 v${VERSION}`),
    close,
  );
  ov.replaceChildren(card);
  ov.hidden = false;
  close.focus({ preventScroll: true });
}
function setPaused(on) {
  paused = on;
  $('#pause').hidden = !on;
  if (on) { hush(); $('#btnResume').focus({ preventScroll: true }); } else { poke(); $('#btnPause').focus({ preventScroll: true }); }
}
$('#btnSet').addEventListener('click', openSettings);
$('#btnPause').addEventListener('click', () => setPaused(true));
$('#btnResume').addEventListener('click', () => setPaused(false));
// 처음 화면으로: 지금 장면을 이어 보기 자리로 저장하고(장면을 시작할 때 이미 적어 둠) 책장으로
$('#btnHome').addEventListener('click', () => { sfx('tap'); flush(true); toast(`지금까지 ${NET.mode === 'student' ? '학급 서버' : '이 기기'}에 저장했어요. 다음에 이 장면부터 이어 볼 수 있어요.`); toShelf(); });
addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (!$('#settings').hidden) $('#settings').hidden = true; else if (paused) setPaused(false); return; }
  if (!$('#settings').hidden || paused) return;
  if (document.activeElement !== canvas && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { alphaGoal = camera.alpha + (e.key === 'ArrowLeft' ? 0.35 : -0.35); poke(); return; }
  if ((e.key === 'Enter' || e.key === 'PageDown') && !e.target.closest('button, [role="button"]')) { e.preventDefault(); $('#btnNext').click(); }
});

// 시험용으로 지금 상태만 읽을 수 있게 (바꾸지는 못함)
window.__maum = { state: () => ({ scene: curScene, stage: stageNow && stageNow.name, kind: askKind, flags: Object.assign({}, flags), trail: trail.length, ending: lastEnd && lastEnd.id, cuts: hist.length, at: hi, next: !$('#btnNext').disabled, walls: stageNow ? stageNow.walls.map(w => +w.vis.toFixed(2)) : [], tier, busy: capBusy }) };

async function boot() {
  document.documentElement.style.setProperty('--fs', save.set.fs);
  // 캔버스에 쓰는 글씨(칠판, 포스터, 지도)가 제 글꼴로 그려지도록 글꼴을 먼저 받는다
  try { await Promise.race([document.fonts.load('32px Jua'), sleep(2500)]); } catch (e) { /* 기본 글꼴로 */ }
  try { await loadModels(); } catch (e) { console.error(e); $('#loading').textContent = '그림을 불러오지 못했어요. 인터넷 연결을 확인하고 새로 고쳐 주세요.'; return; }
  applyTier();
  loadBook('book1');
  showShelf();
  $('#loading').hidden = true;
  const logged = await netBoot(); // 학급 서버가 있으면: QR(?c=)·쿠키로 학생 로그인
  const want = 'book' + ARGS.get('book');
  if (STORIES[want]) startBook(want, ARGS.get('scene')); // 수업 링크는 첫 화면을 건너뛴다
  else { showShelf(); if (!logged) showGate(); }
  ARGS.delete('scene'); // 장면 바로 열기는 처음 한 번만 (책장에서 다른 책을 열 때는 처음부터)
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
    const b = btn(ready ? name : `${name} · ${t('soon')}`, 'chip', () => { LANG = save.set.lang = code; store(); findVoice(); showGate(); });
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
    const go = async () => { try { await loginCode(inp.value.trim()); sfx('pick'); close(); } catch (e) { err.textContent = e.message; } };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    const r = h('div', 'coderow');
    r.append(inp, btn(t('enter'), 'btn go', go));
    card.append(h('label', 'lab', t('code')), r, h('p', 'soft', t('codeHint')), err);
  } else if (!/vercel\.app$/.test(location.hostname)) {
    const a = h('a', '', APP_URL);
    a.href = APP_URL;
    card.append(h('p', 'soft', t('noServer')), a);
  } else card.append(h('p', 'soft', '학급 서버가 아직 준비되지 않아 지금은 「로그인 없이 하기」만 할 수 있어요.'));
  card.append(btn(t('guest'), 'btn ghost wide', () => { enterGuest(); close(); }), h('p', 'soft small', t('guestNote')), h('p', 'soft small', t('privacy')));
  if (NET.server) { const a = h('a', 'small', t('teacher')); a.href = 'teacher.html'; card.appendChild(a); }
  ov.replaceChildren(card);
  ov.hidden = false;
  setTimeout(() => (card.querySelector('.codein') || card.querySelector('button.wide')).focus({ preventScroll: true }), 60);
}
boot();
