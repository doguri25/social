// ===== 옆 칸 위: 웹툰 컷 한 장씩. 아래 막대: 이전 / 진행 점 / 다음 =====
const storyEl = $('#story');
const asList = v => (v == null ? [] : [].concat(v));
const readText = p => [p.pre, ...asList(p.lines).map(l => l.say || l.think || l.shout || l.whisper), p.cap, p.text].flat().filter(Boolean).join(' ');
let hist = [], hi = -1; // 지금 장면에서 본 컷 (「이전」으로 다시 보기)
let nextFn = null, nextLabel = '다음';
function resetHist() { hist = []; hi = -1; renderFoot(); }
function setNext(fn, label = '다음') { nextFn = fn; nextLabel = label; renderFoot(); }
function renderFoot() {
  const live = hi === hist.length - 1;
  $('#btnPrev').disabled = hi <= 0;
  const nb = $('#btnNext');
  nb.disabled = live && !nextFn;
  nb.firstChild.textContent = (live ? nextLabel : '다음') + ' ';
}
// 「다음」을 누를 때까지 기다린다. 지난 컷을 보는 중이면 「다음」은 먼저 지금 컷으로 돌아온다
function waitNext(label) { return waitFor(done => { setNext(done, label); return () => { if (nextFn === done) setNext(null); }; }); }
$('#btnNext').addEventListener('click', () => {
  sfx('tap');
  if (hi < hist.length - 1) { hi++; renderEntry(); return; }
  if (nextFn) nextFn();
});
$('#btnPrev').addEventListener('click', () => { if (hi > 0) { sfx('tap'); hi--; renderEntry(); } });

// ---- 컷 만들기: 무대를 찍고, 말하는 사람 얼굴 사진을 붙인다 ----
const panelW = () => Math.round(clamp(storyEl.clientWidth * 2, 560, 900));
const stageKey = () => stageNow.name + JSON.stringify(curSet);
async function makeEntry(p) {
  const e = { p, stage: stageNow.name, set: curSet, key: stageKey(), img: null, photo: null, lines: [] };
  applyCut(p);
  const ph = p.phone && p.phone.profile && p.phone.profile.photo;
  if (ph) { applyCut(ph); e.photo = await shoot(ph, 320, 320); applyCut(p); }
  if (p.text == null && !p.phone) { const w = panelW(); e.img = await shoot(p, w, Math.round(w / 1.6)); }
  for (const l of asList(p.lines)) {
    const kind = ['shout', 'think', 'whisper', 'say'].find(k => l[k]);
    const c = l.who && CH[l.who];
    e.lines.push({ who: l.who, kind, text: l[kind], img: c ? (shown(c) ? await portrait(c) : cardPic[c.id] || null) : null });
  }
  return e;
}
async function showPanel(p, my) {
  const e = await makeEntry(p);
  if (my !== runId) throw CANCEL;
  hist.push(e);
  hi = hist.length - 1;
  renderEntry();
  sfx('page');
  speak(readText(p));
}
function rise() { storyEl.classList.remove('rise'); void storyEl.offsetWidth; storyEl.classList.add('rise'); }
function renderEntry() {
  const e = hist[hi];
  if (e.key !== stageKey()) applySet(e.stage, e.set, false); // 다른 무대에서 찍은 컷을 다시 볼 때는 그 무대로
  applyCut(e.p);
  storyEl.replaceChildren(...panelNodes(e, hi < hist.length - 1));
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
    row.appendChild(b);
    return row;
  });
}
function panelNodes(e, past) {
  const p = e.p, out = [];
  if (p.text != null) {
    const t = h('div', 'textp ' + (p.tone || ''));
    String(p.text).split('\n').forEach(s => t.appendChild(h('p', '', s)));
    return [t];
  }
  if (p.pre) out.push(h('p', 'cap pre', p.pre));
  const pic = h('div', 'pic' + (p.tone ? ' ' + p.tone : '') + (p.phone ? ' phonepic' : ''));
  if (p.phone) pic.appendChild(device(p.phone, e.photo));
  else {
    const img = new Image();
    img.src = e.img;
    img.alt = '';
    pic.appendChild(img);
  }
  if (p.tone === 'memory') pic.appendChild(h('span', 'tag', '그때'));
  if (p.tone === 'whatif') pic.appendChild(h('span', 'tag', '만약에…'));
  if (past) pic.appendChild(h('span', 'tag past', '다시 보는 중'));
  if (p.fx) pic.appendChild(h('div', 'fx fx-' + p.fx));
  if (p.sfx) pic.appendChild(h('div', 'sfx', p.sfx));
  out.push(pic);
  out.push(...lineNodes(e.lines));
  if (p.cap) out.push(h('p', 'cap', p.cap));
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
      if (m.me && m.read) row.appendChild(h('small', 'read', '읽음'));
      if (m.time && m.me) row.appendChild(h('small', '', m.time));
      row.appendChild(h('span', 'txt', m.text));
      if (m.time && !m.me) row.appendChild(h('small', '', m.time));
      body.appendChild(row);
    });
    if (ph.chat.wait) body.appendChild(h('div', 'wait', `${ph.chat.wait} · 아직 답장이 없어요`));
    dev.appendChild(body);
    return dev;
  }
  const pr = ph.profile;
  dev.classList.add('profile');
  const av = h('div', 'avatar');
  if (photo) { const img = new Image(); img.src = photo; img.alt = ''; av.appendChild(img); } else av.classList.add('empty');
  dev.append(av, h('div', 'pname', pr.name), h('div', 'pnote', photo ? '프로필 사진' : '프로필 사진 없음'));
  return dev;
}
// 장면 첫 장: 어디인지, 이야기 마디 (면 번호는 쓰지 않는다)
function titleCard(sc, part) {
  const t = h('div', 'textp title');
  const segs = sc.place.split(' · '); // 「월요일 · 교실」 → 크게 「교실」, 작게 「월요일」
  t.appendChild(h('div', 'page', segs.pop()));
  if (segs.length) t.appendChild(h('div', 'place', segs.join(' · ')));
  if (part) t.appendChild(h('div', 'part', part));
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
  $('#bookTitle').textContent = inBook ? BOOK.title : '마음 극장';
  $('#bookSub').textContent = inBook ? BOOK.sub : '사회정서 그림책 놀이';
  $('#part').hidden = !inBook || !curPart;
  $('#part').textContent = curPart || '';
  $('#count').hidden = !inBook;
  $('#btnHome').hidden = !inBook;
  $('#dots').replaceChildren();
  if (!inBook) return;
  $('#count').textContent = `${page} / ${BOOK.pages}`;
  $('#dots').replaceChildren(...Array.from({ length: BOOK.pages }, (_, i) => h('i', i < page - 1 ? 'on' : i === page - 1 ? 'on now' : '')));
}
function partBanner(text) {
  document.querySelectorAll('#partTitle').forEach(e => e.remove());
  const t = h('div', '', text);
  t.id = 'partTitle';
  canvas.parentElement.appendChild(t);
  setTimeout(() => t.remove(), 2700);
}
