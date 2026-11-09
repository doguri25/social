// ===== 학급 접속: 접속 코드·QR(?c=코드)로 들어온 학생은 서버에 저장, 「로그인 없이 하기」는 이 기기에만 =====
// 서버(버셀 서버리스 함수 api/student)가 없는 곳(GitHub Pages, 아티팩트, 파일로 열기)에서는 「로그인 없이 하기」만 보인다
const APP_URL = 'https://social-ruddy-gamma.vercel.app/';
const NET = { server: false, mode: 'guest', me: null, queue: [], timer: 0, ended: {}, skew: 0, lost: null }; // ended: 이 화면에서 결말에 닿아 이어 보기를 지운 때
// 학생이면 서버 시계로 적는다 (기기 시계가 틀려도 선생님이 지운 때·다른 기기에서 끝낸 때와 바르게 견주게)
const srvNow = () => Date.now() + (NET.mode === 'student' ? NET.skew : 0);
save.resume = isObj(save.resume) ? save.resume : {};
for (const k in save.resume) { const r = save.resume[k]; if (!isObj(r) || typeof r.scene !== 'string' || typeof r.place !== 'string' || !Array.isArray(r.trail)) delete save.resume[k]; } // 깨진 이어 보기 자리는 버린다
save.answers = Array.isArray(save.answers) ? save.answers : [];
const GUEST = { books: save.books, resume: save.resume, answers: save.answers }; // 이 기기 기록 (학생으로 들어와도 지우지 않는다)

async function api(action, data = {}, keepalive = false, ms = 0) { // ms: 이만큼 기다려도 답이 없으면 그만 (첫 화면이 멈추지 않게)
  const signal = ms && typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined;
  let r;
  try { r = await fetch('api/student', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', keepalive, signal, body: JSON.stringify({ action, ...data }) }); }
  catch (e) { throw new Error('서버에 닿지 않아요. 인터넷 연결을 확인해 주세요.'); }
  const j = await r.json().catch(() => null);
  if (!j) throw new Error('서버에 닿지 않아요.');
  if (!r.ok) throw Object.assign(new Error(j.error || '문제가 생겼어요.'), { status: r.status });
  return j;
}
// 처음에 한 번: 서버가 있는지, 이미 들어와 있는지(쿠키), QR 로 왔는지
async function netBoot() {
  if (location.protocol === 'file:') return false;
  try { NET.server = !!(await api('ping', {}, false, 10000)).ready; } catch (e) { return false; }
  if (!NET.server) return false; // 서버는 있지만 선생님이 학급 저장소(MONGODB_URI)를 아직 연결하지 않음
  let out = false;
  try { out = !!localStorage.getItem('social-out'); } catch (e) { /* 없음 */ }
  if (out) { try { await api('logout', {}, false, 10000); localStorage.removeItem('social-out'); } catch (e) { return false; } } // 나가기 때 못 지운 쿠키를 먼저 지운다
  const code = ARGS.get('c');
  if (code) {
    ARGS.delete('c');
    history.replaceState(null, '', location.pathname + (ARGS.toString() ? '?' + ARGS : ''));
    try { await api('login', { code }, false, 10000); } catch (e) { // 틀린 QR 이면 이 기기에 남은 앞 학생으로 들어가지 않는다
      toast(e.message);
      try { await api('logout', {}, false, 10000); } catch (e2) { /* 없음 */ }
      return false;
    }
  }
  try { enterStudent(await api('me', {}, false, 10000)); return true; } catch (e) { return false; }
}
async function loginCode(code) { await api('login', { code }); enterStudent(await api('me')); }
function enterStudent(me) {
  NET.mode = 'student';
  NET.me = me;
  NET.skew = me.since ? me.since - Date.now() : 0;
  NET.ended = {};
  try { localStorage.removeItem('social-out'); } catch (e) { /* 없음 */ }
  save.books = me.progress.books || {}; // 이 기기 기록과 섞지 않는다
  save.resume = me.progress.resume || {};
  const lost = NET.lost;
  NET.lost = null;
  if (lost && lost.no === me.no) { // 코드가 바뀌어 못 보낸 진행(본 결말·이어 보기)을 새 코드로 들어온 뒤 다시 보낸다
    for (const [id, b] of Object.entries(lost.books)) (b.endings || []).forEach(e => bookRec(id).endings.includes(e) || bookRec(id).endings.push(e));
    for (const [id, r] of Object.entries(lost.resume)) if (!save.resume[id] || save.resume[id].at < r.at) save.resume[id] = r;
    NET.ended = Object.assign({}, lost.ended);
    netStore();
  }
}
function enterGuest() {
  NET.mode = 'guest';
  NET.me = null;
  save.books = GUEST.books;
  save.resume = GUEST.resume;
  save.answers = GUEST.answers;
}
async function logout() {
  await flush(true);
  try { await api('logout'); } catch (e) { try { localStorage.setItem('social-out', '1'); } catch (e2) { /* 없음 */ } } // 쿠키가 남으면 다음에 열 때 지운다
  enterGuest();
}
// store() 가 부른다: 학생이면 설정만 이 기기에, 진행은 잠시 모았다가 서버로
function netStore() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, set: save.set, books: GUEST.books, resume: GUEST.resume, answers: GUEST.answers, after: save.after })); } catch (e) { /* 저장 실패해도 놀이는 계속 */ }
  clearTimeout(NET.timer);
  NET.timer = setTimeout(() => flush(), 2500);
}
async function flush(now) {
  if (NET.mode !== 'student') return;
  clearTimeout(NET.timer);
  NET.queue = NET.queue.filter(a => a.no === NET.me.no); // 앞서 나간 학생이 못 보낸 답을 이 학생 기록에 넣지 않는다
  const answers = NET.queue.splice(0, 60);
  let r = null;
  const who = NET.me; // 저장이 돌아오는 사이 나가거나 다른 학생이 들어오면 돌아온 값을 이 화면에 넣지 않는다
  // since: 진행을 받아 온 때. 그 뒤에 선생님이 기록을 지웠으면 서버는 이 진행을 받지 않고(stale) 화면은 진행을 다시 받아 온다
  try { r = await api('save', { since: NET.me.since, progress: { books: save.books, resume: save.resume }, ended: NET.ended, answers }, !!now); }
  catch (e) { NET.queue.unshift(...answers); if (e.status === 401) { NET.lost = { no: NET.me.no, books: save.books, resume: save.resume, ended: NET.ended }; toast(e.message); enterGuest(); toShelf(); showGate(); } } // 못 보내면 다음에 다시. 코드가 바뀌었으면 손님으로 이어 읽지 않고 첫 화면으로
  if (r && NET.me !== who) r = null;
  if (r && r.stale && NET.mode === 'student') { // 그사이 나가거나 다른 학생이 들어왔으면 바꾸지 않는다
    const old = { books: save.books, resume: save.resume };
    let me = null;
    try { me = await api('me'); } catch (e) { /* 다음 저장 때 다시 */ }
    if (me && NET.me === who && me.no === who.no) {
      enterStudent(me);
      // 지운 뒤에 읽은 것(지금 읽는 자리, 그 뒤에 본 결말)은 다시 넣어 보낸다
      for (const [id, res] of Object.entries(old.resume)) if (res.at > r.wiped) save.resume[id] = res;
      for (const [id, b] of Object.entries(old.books)) for (const [e, t] of Object.entries(b.endAt || {})) if (t > r.wiped && !bookRec(id).endings.includes(e)) bookRec(id).endings.push(e);
      netStore();
    }
  } else if (r && r.ends && NET.mode === 'student') { // 다른 기기에서 본 결말을 이 화면에도
    let gone = false;
    for (const [id, t] of Object.entries(r.ended || {})) if (save.resume[id] && save.resume[id].at <= t) { delete save.resume[id]; gone = true; } // 다른 기기에서 끝낸 책의 옛 자리
    if (gone && askKind === 'shelf') showShelf();
    const was = unlockedAfter();
    for (const [id, list] of Object.entries(r.ends)) { if (!STORIES[id]) continue; const rec = bookRec(id); list.forEach(e => rec.endings.includes(e) || rec.endings.push(e)); }
    if (!was && unlockedAfter() && askKind === 'ending') renderAsk(); // 4권 결말 화면에 「이후의 이야기 쓰기」
  }
  if (NET.queue.length) NET.timer = setTimeout(() => flush(), 2500);
}
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(true); });
// 고른 답 하나를 쌓는다 (감정 카드, 갈림길, 만약에, 하고 싶은 말, 활동, 결말)
function logAnswer(kind, q, a) {
  const row = { book: BOOK.id, scene: curScene, kind, q: String(q || ''), a, t: srvNow() };
  if (NET.mode === 'student') { NET.queue.push(Object.assign(row, { no: NET.me.no })); netStore(); return; }
  GUEST.answers.push(row);
  if (GUEST.answers.length > 400) GUEST.answers.splice(0, GUEST.answers.length - 400);
  store();
}
// 이어 보기 자리: 장면을 시작할 때마다 저장, 결말에 닿으면 지운다
function markResume() {
  save.resume[BOOK.id] = { scene: curScene, place: BOOK.scenes[curScene].place, flags: Object.assign({}, flags), trail: trail.slice(), at: srvNow() };
  store();
}
function clearResume() { delete save.resume[BOOK.id]; if (NET.mode === 'student') NET.ended[BOOK.id] = srvNow(); store(); } // 서버가 다른 기기에 남은 이 책 자리도 지우게
const unlockedAfter = () => ['book1', 'book2', 'book3', 'book4'].every(id => save.books[id] && STORIES[id] && seenEnds(save.books[id], STORIES[id]) > 0); // 지금 책에 있는 결말만 센다 (책장 「본 결말」과 같게)
