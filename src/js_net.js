// ===== 학급 접속: 접속 코드·QR(?c=코드)로 들어온 학생은 서버에 저장, 「로그인 없이 하기」는 이 기기에만 =====
// 서버(버셀 서버리스 함수 api/student)가 없는 곳(GitHub Pages, 아티팩트, 파일로 열기)에서는 「로그인 없이 하기」만 보인다
const APP_URL = 'https://social-ruddy-gamma.vercel.app/';
const NET = { server: false, mode: 'guest', me: null, queue: [], timer: 0 };
const GUEST = { books: save.books, resume: save.resume || {}, answers: save.answers || [] }; // 이 기기 기록 (학생으로 들어와도 지우지 않는다)
save.resume = save.resume || {};
save.answers = GUEST.answers;

async function api(action, data = {}, keepalive = false) {
  const r = await fetch('api/student', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', keepalive, body: JSON.stringify({ action, ...data }) });
  const j = await r.json().catch(() => null);
  if (!j) throw new Error('서버에 닿지 않아요.');
  if (!r.ok) throw Object.assign(new Error(j.error || '문제가 생겼어요.'), { status: r.status });
  return j;
}
// 처음에 한 번: 서버가 있는지, 이미 들어와 있는지(쿠키), QR 로 왔는지
async function netBoot() {
  if (location.protocol === 'file:') return false;
  try { NET.server = !!(await api('ping')).ready; } catch (e) { return false; }
  if (!NET.server) return false; // 서버는 있지만 선생님이 학급 저장소(MONGODB_URI)를 아직 연결하지 않음
  const code = ARGS.get('c');
  if (code) {
    ARGS.delete('c');
    history.replaceState(null, '', location.pathname + (ARGS.toString() ? '?' + ARGS : ''));
    try { await api('login', { code }); } catch (e) { toast(e.message); }
  }
  try { enterStudent(await api('me')); return true; } catch (e) { return false; }
}
async function loginCode(code) { await api('login', { code }); enterStudent(await api('me')); }
function enterStudent(me) {
  NET.mode = 'student';
  NET.me = me;
  save.books = me.progress.books || {}; // 이 기기 기록과 섞지 않는다
  save.resume = me.progress.resume || {};
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
  try { await api('logout'); } catch (e) { /* 그래도 나간다 */ }
  enterGuest();
}
// store() 가 부른다: 학생이면 설정만 이 기기에, 진행은 잠시 모았다가 서버로
function netStore() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ set: save.set, books: GUEST.books, resume: GUEST.resume, answers: GUEST.answers })); } catch (e) { /* 저장 실패해도 놀이는 계속 */ }
  clearTimeout(NET.timer);
  NET.timer = setTimeout(() => flush(), 2500);
}
async function flush(now) {
  if (NET.mode !== 'student') return;
  clearTimeout(NET.timer);
  const answers = NET.queue.splice(0, 60);
  try { await api('save', { progress: { books: save.books, resume: save.resume }, answers }, !!now); }
  catch (e) { NET.queue.unshift(...answers); if (e.status === 401) { toast(e.message); enterGuest(); } } // 못 보내면 다음에 다시
  if (NET.queue.length) NET.timer = setTimeout(() => flush(), 2500);
}
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(true); });
// 고른 답 하나를 쌓는다 (감정 카드, 갈림길, 만약에, 하고 싶은 말, 활동, 결말)
function logAnswer(kind, q, a) {
  const row = { book: BOOK.id, scene: curScene, kind, q: String(q || ''), a, t: Date.now() };
  if (NET.mode === 'student') { NET.queue.push(row); netStore(); return; }
  GUEST.answers.push(row);
  if (GUEST.answers.length > 400) GUEST.answers.splice(0, GUEST.answers.length - 400);
  store();
}
// 이어 보기 자리: 장면을 시작할 때마다 저장, 결말에 닿으면 지운다
function markResume() {
  save.resume[BOOK.id] = { scene: curScene, place: BOOK.scenes[curScene].place, flags: Object.assign({}, flags), trail: trail.slice(), at: Date.now() };
  store();
}
function clearResume() { delete save.resume[BOOK.id]; store(); }
const unlockedAfter = () => ['book1', 'book2', 'book3', 'book4'].every(id => ((save.books[id] || {}).endings || []).length > 0);
