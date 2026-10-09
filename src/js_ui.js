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
function updateCast() {
  const ids = BOOK.cast.map(d => d.id).filter(id => shown(CH[id]));
  const nav = $('#cast');
  if (nav.dataset.ids === ids.join()) return;
  nav.dataset.ids = ids.join();
  nav.replaceChildren(...ids.map(id => {
    const d = BOOK.castById[id];
    const b = btn('', '', () => { sfx('tap'); pickChar(id); });
    b.dataset.id = id;
    b.setAttribute('aria-pressed', id === 'yuna');
    b.setAttribute('aria-label', `${d.name} 살펴보기`);
    const img = new Image();
    img.alt = '';
    img.style.setProperty('--c', d.card || '#f6ead7');
    if (cardPic[id]) img.src = cardPic[id];
    else portrait(CH[id], 'joy').then(u => { cardPic[id] = u; img.src = u; }, () => {});
    b.append(img, h('span', '', d.name));
    return b;
  }));
}

// ---- 책장: 처음 화면 ----
function showShelf() {
  runId++;
  cancelFlow();
  curScene = null;
  curPart = null;
  applySet('shelf', { cast: { yuna: 'shelf_l wave joy', seoa: 'shelf_r stand joy' } }, false);
  setHeader(null);
  resetHist();
  const rec = bookRec('book1');
  const title = STORIES.book1.title;
  const books = h('div', 'books');
  [[title, '#ffcf3f'], ['2권', '#6fbfee'], ['3권', '#f497b6'], ['4권', '#78c78a'], ['5권', '#b48ad8']].forEach(([t, col], i) => {
    const row = btn('', 'bookrow' + (i ? '' : ' ready'), () => (i ? toast('아직 준비 중인 책이에요.') : openBook('book1')));
    const sp = h('i', 'spine');
    sp.style.setProperty('--c', col);
    const txt = h('span', '');
    txt.append(h('b', '', i ? `${t} · 준비 중` : `1권 · ${t}`), h('small', '', i ? '곧 만나요' : `${STORIES.book1.sub} · 본 결말 ${rec.endings.length} / ${STORIES.book1.endings.length}`));
    row.append(sp, txt);
    if (i) row.disabled = true;
    books.appendChild(row);
  });
  const head = h('div', 'endcard');
  head.append(h('div', 'eyebrow', '마음 극장 책장'), h('h3', '', '읽을 책을 골라요'));
  storyEl.replaceChildren(head, books);
  rise();
  setAsk('shelf', () => [heading('그림책을 펼쳐요'), h('p', '', '3D 무대와 웹툰으로 읽고, 갈림길에서 직접 골라 보는 이야기예요. 무대의 노란 책을 눌러도 돼요.')]);
  setNext(() => openBook('book1'), '1권 읽기');
  buildHot(stageNow.books.map(b => ({ pos: b.pos, book: b.i, cls: 'book' + (b.i ? '' : ' ready'), label: b.i ? `${b.i + 1}권 준비 중` : `1권 · ${title}` })), it => (it.book ? toast('아직 준비 중인 책이에요.') : openBook('book1')));
}
function openBook(id) {
  sfx('pick');
  startBook(id, ARGS.get('scene'));
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
    const url = `${location.origin}${location.pathname}?book=1${save.set.cls ? '&mode=class' : ''}`;
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
    row('글자 크기', '', seg([[0.9, '작게'], [1, '보통'], [1.2, '크게']], save.set.fs, v => { save.set.fs = v; store(); document.documentElement.style.setProperty('--fs', v); fitSide(); })),
    row('화질', '높음: 그늘과 빛 번짐까지 / 느리면 「낮음」', seg([['auto', '자동'], ['low', '낮음'], ['high', '높음']], save.set.q, v => { save.set.q = v; slowDevice = false; store(); applyTier(); })),
    row('효과음', '', onOff('sound')),
    row('함께 보기', '전자칠판용: 고를 때 선생님 질문, 생각 시간, 손든 사람 수', onOff('cls')),
    row('수업 링크', '이 설정 그대로 1권을 바로 여는 주소 (GitHub Pages 주소에서 쓰세요)', copy),
    link,
    row('기록', '본 결말과 감정 카드 답은 이 기기에만 저장돼요', wipe),
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
$('#btnHome').addEventListener('click', () => { sfx('tap'); toShelf(); });
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
  if (ARGS.get('book') === '1') startBook('book1', ARGS.get('scene'));
}
boot();
