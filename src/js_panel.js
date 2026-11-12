// ===== 옆 칸 위: 웹툰 컷 한 장씩. 아래 막대: 이전 / 진행 점 / 다음 =====
const storyEl = $('#story');
const asList = v => (v == null ? [] : [].concat(v));
const readText = p => [p.pre, ...asList(p.lines).map(l => l.say || l.think || l.shout || l.whisper), p.cap, p.text].flat().filter(Boolean).join(' ');
let hist = [], hi = -1; // 지금 장면에서 본 컷 (「이전」으로 다시 보기)
let actView = null; // 활동(숨 고르기·몸 신호·바구니)이 옆 칸 위를 쓰는 동안 그 화면을 다시 그리는 함수
let nextFn = null, nextLabel = t('next');
let making = 0; // 컷을 찍는 중 (이때 「이전」으로 무대를 바꾸면 새 컷이 엉뚱한 무대·표정으로 찍힌다)
let shownAt = 0; // 새 컷이 나온 때 (더블클릭·Enter 되풀이로 글·수첩 컷을 건너뛰지 않게)
function resetHist() { hist = []; hi = -1; renderFoot(); }
function setNext(fn, label = t('next')) { if (fn && fn !== nextFn) shownAt = performance.now(); nextFn = fn; nextLabel = label; renderFoot(); } // 새 할 일(첫 장·결말 카드)도 두 번 누름에 건너뛰지 않게
function renderFoot() {
  const live = hi === hist.length - 1;
  $('#btnPrev').disabled = hi <= 0 || making > 0;
  const nb = $('#btnNext');
  nb.disabled = live && !nextFn;
  nb.firstChild.textContent = (live ? nextLabel : t('next')) + ' ';
}
// 「다음」을 누를 때까지 기다린다. 지난 컷을 보는 중이면 「다음」은 먼저 지금 컷으로 돌아온다
function waitNext(label) { if (skipAhead) { skipAhead = false; return Promise.resolve(); } return waitFor(done => { setNext(done, label); return () => { if (nextFn === done) setNext(null); }; }); }
$('#btnNext').addEventListener('click', e => {
  if (hi === hist.length - 1 && e.timeStamp - shownAt < 300) return; // 누른 때(timeStamp)로 잰다: 앞 클릭 처리가 길어 뒤 클릭이 늦게 와도 막히게
  sfx('tap');
  if (hi < hist.length - 1) { hi++; renderEntry(true); return; }
  if (nextFn) nextFn();
});
$('#btnPrev').addEventListener('click', e => { if (e.detail > 0) e.currentTarget.blur(); if (hi > 0 && !making) { sfx('tap'); hi--; renderEntry(true); } }); // 마우스로 누른 뒤의 Enter 는 「다음」

// ---- 컷 만들기: 무대를 찍고, 말하는 사람 얼굴 사진을 붙인다 ----
const panelW = () => Math.round(clamp(storyEl.clientWidth * 2, 560, 900));
const stageKey = () => stageNow.name + JSON.stringify(curSet);
async function makeEntry(p, my, anim) {
  const e = { p, stage: stageNow.name, set: curSet, key: stageKey(), img: null, photo: null, lines: [] };
  applyCut(p);
  const ph = p.phone && p.phone.profile && p.phone.profile.photo;
  if (ph) { applyCut(ph); e.photo = await shoot(ph, 320, 320, my); chk(my); applyCut(p); }
  if (p.note) e.img = noteImg(p.note);
  else if (p.text == null && !p.phone && !anim) { const w = panelW(); e.img = await shoot(p, w, Math.round(w / 1.6), my); }
  e.lines = await makeLines(p, my);
  return e;
}
async function makeLines(p, my) {
  const out = [];
  for (const l of asList(p.lines)) {
    const kind = ['shout', 'think', 'whisper', 'say'].find(k => l[k]);
    const c = l.who && CH[l.who];
    out.push({ who: l.who, kind, text: l[kind], ko: l['~' + kind], img: c ? (shown(c) && await portrait(c, undefined, my)) || cardPic[c.id] || null : null });
  }
  return out;
}
async function showPanel(p, my) {
  if (hi < hist.length - 1) { hi = hist.length - 1; renderEntry(); } // 지난 컷을 보는 사이 흐름이 이어지면(숨 고르기가 저절로 끝남) 지금 무대로 돌아와서 찍는다
  making++;
  renderFoot();
  skipAhead = false;
  let e;
  const anim = canAnim(p), last = hist[hist.length - 1];
  const prev = anim && last && last.key === stageKey() ? last.p : null; // 같은 무대의 앞 컷에서 이어서 움직인다
  try {
    if (anim) { // 처음 한 번은 움직이는 컷으로: 앞 컷의 자세에서 시작해 이 컷의 삽화에서 멈춘다
      e = { p, stage: stageNow.name, set: curSet, key: stageKey(), img: null, photo: null,
        lines: asList(p.lines).map(l => { const kind = ['shout', 'think', 'whisper', 'say'].find(k => l[k]); return { who: l.who, kind, text: l[kind], ko: l['~' + kind], img: (l.who && cardPic[l.who]) || null }; }) }; // 얼굴 사진은 움직임이 끝난 뒤에 이 컷의 표정으로 찍는다
      if (my !== runId) throw CANCEL;
      e.anim = true; e.prev = prev; e.spots = lastSpots; // 「이전」으로 돌아오면 같은 자리에서 다시 움직인다
      hist.push(e);
      hi = hist.length - 1;
      storyEl.replaceChildren(...panelNodes(e, false));
      rise(); renderAsk(); renderFoot();
      sfx('page');
      speak(readText(p));
      await playCut(e, prev, my);
      chk(my);
      applyCut(p);
      const w = panelW();
      e.img = await shoot(p, w, Math.round(w / 1.6), my);
      e.lines = await makeLines(p, my);
    } else e = await makeEntry(p, my);
  } finally { making--; renderFoot(); }
  if (my !== runId) throw CANCEL;
  saveSpots();
  if (!anim) hist.push(e);
  hi = hist.length - 1;
  renderEntry();
  shownAt = performance.now();
  if (!anim) { sfx('page'); speak(readText(p)); }
}
function rise() { storyEl.classList.remove('rise'); void storyEl.offsetWidth; storyEl.classList.add('rise'); }
// replay: 「이전」·「다음」으로 옮겨 온 컷이면 그 컷의 움직임을 한 번 다시 보여 준다
function renderEntry(replay = false) {
  const e = hist[hi], live = hi === hist.length - 1;
  if (replay) console.warn('재생 조건', !!e.anim, !!e.img, canAnim(e.p), !!actView, live);
  replay = replay && !!e.anim && !!e.img && canAnim(e.p) && !(actView && live);
  if (replay || e.key !== stageKey()) applySet(e.stage, e.set, false); // 다른 무대에서 찍은 컷을 다시 볼 때는 그 무대로 (다시 움직일 때는 공·인물 자리도 그 컷의 처음으로)
  applyCut(e.p);
  if (actView && live) actView(); // 지난 컷을 보고 돌아오면 하던 활동 화면으로
  else storyEl.replaceChildren(...panelNodes(e, !live, replay));
  if (replay) playCut(e, e.prev, runId, true).catch(err => { if (err !== CANCEL) console.warn('다시 재생 실패', err && err.message); });
  rise();
  renderAsk();
  renderFoot();
}
function lineNodes(lines) {
  return lines.map(l => {
    const row = h('div', 'line');
    const who = l.who && BOOK.castById[l.who];
    if (l.img) {
      const img = new Image();
      img.src = l.img;
      img.alt = '';
      img.style.setProperty('--c', (who && who.card) || '#f6ead7');
      row.appendChild(img);
    }
    const b = h('div', 'bub ' + l.kind);
    if (who) b.appendChild(h('small', '', who.name));
    b.appendChild(document.createTextNode(l.text));
    if (l.ko && showKo()) { const k = h('span', 'ko', l.ko); k.lang = 'ko'; b.appendChild(k); }
    row.appendChild(b);
    return row;
  });
}
function panelNodes(e, past, replay) {
  const p = e.p, out = [];
  if (p.text != null) {
    const t = h('div', 'textp ' + (p.tone || ''));
    String(p.text).split('\n').forEach(s => t.appendChild(h('p', '', s)));
    withKo(t, p, 'text');
    return [t];
  }
  if (p.pre) out.push(withKo(h('p', 'cap pre', p.pre), p, 'pre'));
  const pic = h('div', 'pic' + (p.tone ? ' ' + p.tone : '') + (p.phone ? ' phonepic' : ''));
  if (p.phone) pic.appendChild(device(p.phone, e.photo));
  else {
    if (e.img && !replay) { const img = new Image(); img.src = e.img; img.alt = ''; pic.appendChild(img); }
    else pic.appendChild(h('canvas')); // 움직이는 동안은 캔버스, 끝나면 삽화로 바뀐다
  }
  if (p.tone === 'memory') pic.appendChild(h('span', 'tag', t('tagThen')));
  if (p.tone === 'whatif') pic.appendChild(h('span', 'tag', t('tagWhatif')));
  if (past) pic.appendChild(h('span', 'tag past', t('tagPast')));
  if (p.fx) pic.appendChild(h('div', 'fx fx-' + p.fx));
  if (p.sfx) pic.appendChild(h('div', 'sfx', p.sfx));
  out.push(pic);
  out.push(...lineNodes(e.lines));
  if (p.cap) out.push(withKo(h('p', 'cap', p.cap), p, 'cap'));
  return out;
}
// 휴대전화 화면: 메시지 또는 프로필
function device(ph, photo) {
  const dev = h('div', 'device');
  if (ph.chat) {
    dev.appendChild(h('div', 'dev-head', ph.chat.with));
    const body = h('div', 'dev-body');
    ph.chat.msgs.forEach(m => {
      const row = h('div', 'msg' + (m.me ? ' me' : ''));
      if (m.me && m.read) row.appendChild(h('small', 'read', t('msgRead')));
      if (m.time && m.me) row.appendChild(h('small', '', m.time));
      row.appendChild(h('span', 'txt', m.text));
      if (m.time && !m.me) row.appendChild(h('small', '', m.time));
      body.appendChild(row);
    });
    if (ph.chat.wait) body.appendChild(h('div', 'wait', t('noReply', { wait: ph.chat.wait })));
    dev.appendChild(body);
    return dev;
  }
  const pr = ph.profile;
  dev.classList.add('profile');
  const av = h('div', 'avatar');
  if (photo) { const img = new Image(); img.src = photo; img.alt = ''; av.appendChild(img); } else av.classList.add('empty');
  dev.append(av, h('div', 'pname', pr.name), h('div', 'pnote', photo ? t('profilePhoto') : t('noProfilePhoto')));
  return dev;
}
// 장면 첫 장: 어디인지 (면 번호와 기·승·전·결은 쓰지 않는다)
function titleCard(sc) {
  const t = h('div', 'textp title');
  const segs = sc.place.split(' · '); // 「월요일 · 교실」 → 크게 「교실」, 작게 「월요일」
  t.appendChild(h('div', 'page', segs.pop()));
  if (segs.length) t.appendChild(h('div', 'place', segs.join(' · ')));
  withKo(t, sc, 'place');
  storyEl.replaceChildren(t);
  rise();
}
// 고를 칸이 커지면 세로로 넘치지 않게 컷 그림을 줄인다 (가로세로 비율은 그대로, 가운데 정렬)
function fitSide() {
  const pic = storyEl.querySelector('.pic');
  if (!pic) return;
  pic.style.width = '';
  const over = storyEl.scrollHeight - storyEl.clientHeight;
  if (over > 1) pic.style.width = Math.round(Math.max(120, (pic.offsetHeight - over - 4) * 1.6)) + 'px';
}
new ResizeObserver(() => fitSide()).observe($('.side'));

// ---- 위 막대: 책 제목, 이야기 마디, 몇 면 ----
function setHeader(page) {
  const inBook = page != null;
  $('#bookTitle').textContent = inBook ? BOOK.title : t('appTitle');
  $('#bookSub').textContent = inBook ? BOOK.sub : t('appSub');
  $('#count').hidden = !inBook;
  $('#btnHome').hidden = !inBook;
  $('#dots').replaceChildren();
  if (!inBook) return;
  $('#count').textContent = `${page} / ${BOOK.pages}`;
  $('#dots').replaceChildren(...Array.from({ length: BOOK.pages }, (_, i) => h('i', i < page - 1 ? 'on' : i === page - 1 ? 'on now' : '')));
}
