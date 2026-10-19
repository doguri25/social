// 서버 시험: node tests/server.test.mjs
// 이 컴퓨터 저장소(임시 파일)로 tools/dev.mjs 를 띄워, 교사 로그인 → 명단·코드 → 학생 코드 로그인 → 진행·답 저장 → 이후의 이야기 → 교사 채점까지 따라간다
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'maum-db-'));
const port = 3900 + Math.floor(Math.random() * 300);
const srv = spawn(process.execPath, ['tools/dev.mjs', String(port)], { env: { ...process.env, DATA_FILE: join(dir, 'db.json'), MONGODB_URI: '', VERCEL: '' }, stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (cond, msg) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) fails++; };
// 쿠키를 기억하는 간단한 손님(교사 한 명, 학생 한 명)
function client() {
  let jar = {};
  return async (path, action, data = {}) => {
    const r = await fetch(`http://localhost:${port}/api/${path}`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') }, body: JSON.stringify({ action, ...data }) });
    for (const c of r.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); }
    return { status: r.status, body: await r.json() };
  };
}
try {
  for (let i = 0; i < 40; i++) { try { await fetch(`http://localhost:${port}/`); break; } catch { await sleep(150); } }
  const T = client(), S = client(), X = client();
  ok((await S('student', 'ping')).body.ok, '서버 확인(ping)');
  ok((await T('teacher', 'overview')).status === 401, '로그인 전 교사 기록은 막힘');
  ok((await T('teacher', 'login', { password: '0000' })).status === 401, '틀린 비밀번호는 거절');
  ok((await T('teacher', 'login', { password: '1324' })).status === 200, '처음 비밀번호 1324 로 로그인');
  ok((await T('teacher', 'roster', { text: '1 햇살' })).status === 403, '처음 비밀번호로는 비밀번호 바꾸기만 됨');
  ok((await T('teacher', 'changePin', { current: '1324', next: '5678' })).status === 400, '새 비밀번호는 6자리 이상');
  ok((await T('teacher', 'changePin', { current: '1324', next: '246813' })).status === 200, '비밀번호 바꾸기');
  const r = await T('teacher', 'roster', { text: '1 햇살\n2 구름\n2 중복\n잘못된 줄\n3 단풍' });
  ok(r.body.students.length === 3 && /^[2-9A-HJ-NP-Z]{6}$/.test(r.body.students[0].code), '명단 3명, 코드 여섯 글자');
  const code = r.body.students[0].code;
  ok((await S('student', 'login', { code: 'WRONG1' })).status === 401, '틀린 코드는 거절');
  ok((await S('student', 'login', { code: code.toLowerCase() })).body.alias === '햇살', '코드로 학생 로그인(소문자도)');
  const progress = { books: { book1: { endings: ['palm'], feels: { 's05b:3': 'hurt' }, acts: {} } }, resume: { book2: { scene: 's06', flags: { say: 1 }, trail: [] } } };
  const sv = await S('student', 'save', { progress, answers: [{ book: 'book1', scene: 's05', kind: 'choice', q: '어떻게 할까요?', a: '묻는다', t: 1 }, { book: 'book1', scene: 's15', kind: 'compose', q: '할 말', a: ['미안해', '네 얘기도'], t: 2 }] });
  ok(sv.body.saved === 2, '진행과 답 저장');
  const me = (await S('student', 'me')).body;
  ok(me.progress.books.book1.endings[0] === 'palm' && me.progress.resume.book2.scene === 's06', '다시 들어오면 진행·이어 보기 자리가 돌아옴');
  ok((await S('student', 'story', { text: '가'.repeat(250) })).status === 403, '네 권을 다 읽기 전에는 이후의 이야기 못 씀');
  progress.books.book2 = progress.books.book3 = progress.books.book4 = { endings: ['x'] };
  await S('student', 'save', { progress });
  ok((await S('student', 'story', { text: '짧아요' })).status === 400, '200자 안 되면 거절');
  ok((await S('student', 'story', { text: '다음 주 월요일 '.repeat(40) })).status === 200, '네 권을 다 읽고 200자 넘게 쓰면 저장');
  const ov = (await T('teacher', 'overview')).body;
  const s1 = ov.students.find(s => s.no === 1);
  ok(s1.answers === 2 && s1.books.book1 === 1 && s1.story.chars >= 200, '교사 한눈에 보기에 답 수·결말 수·글이 나옴');
  const st = (await T('teacher', 'student', { no: 1 })).body;
  ok(st.answers.length === 2 && st.answers[1].a === '미안해 / 네 얘기도', '학생 한 명의 답이 시간순으로');
  ok((await T('teacher', 'grade', { no: 1, scores: { link: 3, heart: 2, solve: 2, write: 3 }, comment: '잘 이어 썼어요' })).status === 200, '교사 채점');
  ok((await T('teacher', 'stories')).body.stories[0].teacher.scores.link === 3, '채점이 저장됨');
  ok(/키가 없어요/.test((await T('teacher', 'aiGrade', { no: 1 })).body.error || ''), 'AI 키가 없으면 알려 줌');
  await T('teacher', 'settings', { keys: { claude: 'sk-ant-test-1234567890' }, minChars: 300 });
  const pub = (await T('teacher', 'overview')).body.settings;
  ok(pub.keys.claude === 'sk-a••••7890' && pub.minChars === 300, 'AI 키는 가린 모양으로만 돌아옴');
  ok(!JSON.stringify(await T('teacher', 'overview')).includes('test-1234567890'), '어떤 응답에도 키 원문이 없음');
  ok((await X('teacher', 'login', { password: '1324' })).status === 401, '바꾼 뒤 처음 비밀번호는 거절');
  ok((await X('teacher', 'login', { password: '246813' })).status === 200, '새 비밀번호로 로그인');
  await T('teacher', 'changePin', { current: '246813', next: '975310' });
  ok((await X('teacher', 'overview')).status === 401, '비밀번호를 또 바꾸면 다른 기기 로그인은 풀림');
  await T('teacher', 'newCode', { no: 1 });
  ok((await S('student', 'me')).status === 401, '코드를 새로 만들면 예전 로그인은 풀림');
  await T('teacher', 'clear', { no: 1 });
  ok(!(await T('teacher', 'student', { no: 1 })).body.answers.length, '한 학생 기록 지우기');
  let locked = false;
  for (let i = 0; i < 6; i++) if ((await X('teacher', 'login', { password: '999999' })).status === 429) locked = true;
  ok(locked, '한 기기에서 1분에 5번 넘게 틀리면 잠김');
  let codeLocked = false;
  for (let i = 0; i < 22; i++) if ((await X('student', 'login', { code: 'ZZZZZ' + (i % 10) })).status === 429) codeLocked = true;
  ok(codeLocked, '접속 코드를 10분에 20번 넘게 틀리면 잠김');
  ok((await fetch(`http://localhost:${port}/api/student`, { method: 'POST', headers: { 'content-type': 'text/plain; x=application/json' }, body: '{"action":"ping"}' })).status === 415, 'JSON 이 아닌 보내기는 거절');
  ok((await fetch(`http://localhost:${port}/api/student`, { method: 'POST', headers: { 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' }, body: '{"action":"ping"}' })).status === 403, '다른 사이트에서 부르면 거절');
  for (const u of ['/.GIT/config', '/SERVER/core.js', '/.DATA/db.json', '/%', '/..%2f..%2fetc%2fpasswd']) ok([400, 404].includes((await fetch(`http://localhost:${port}${u}`)).status), `개발 서버가 ${u} 를 내주지 않음`);
} catch (e) {
  console.log('✗ ' + e.stack);
  fails++;
} finally {
  srv.kill();
  rmSync(dir, { recursive: true, force: true });
}
console.log(fails ? `실패 ${fails}개` : '통과');
process.exit(fails ? 1 : 0);
