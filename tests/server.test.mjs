// 서버 시험: node tests/server.test.mjs
// 이 컴퓨터 저장소(임시 파일)로 tools/dev.mjs 를 띄워, 교사 로그인 → 명단·코드 → 학생 코드 로그인 → 진행·답 저장 → 이후의 이야기 → 교사 채점까지 따라간다
import { spawn } from 'node:child_process';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'maum-db-'));
const port = 3900 + Math.floor(Math.random() * 300);
// 가짜 쌤비서 중계: 진짜 중계(하루 횟수)를 쓰지 않고, 마음극장 서버가 무엇을 보내는지 본다
const relayReqs = [];
const relay = http.createServer((req, res) => {
  let b = '';
  req.on('data', c => { b += c; });
  req.on('end', () => {
    relayReqs.push({ url: req.url, headers: req.headers, body: JSON.parse(b || '{}') });
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ scores: { link: 2, main: 2, sense: 2, heart: 2 }, comment: '좋아요.' }) } }] }));
  });
});
await new Promise(r => relay.listen(0, r));
// 가짜 Claude: 늘 채점을 사양한다 (그러면 기본 업스테이지 Solar 로 다시 매기는지 본다)
const claudeReqs = [];
const claude = http.createServer((req, res) => { claudeReqs.push(req.url); req.resume(); req.on('end', () => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ stop_reason: 'refusal', content: [] })); }); });
await new Promise(r => claude.listen(0, r));
const srv = spawn(process.execPath, ['tools/dev.mjs', String(port)], { env: { ...process.env, DATA_FILE: join(dir, 'db.json'), MONGODB_URI: '', VERCEL: '', AI_RELAY_URL: `http://localhost:${relay.address().port}`, AI_CLAUDE_URL: `http://localhost:${claude.address().port}/v1/messages` }, stdio: 'ignore' });
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
  ok((await T('teacher', 'roster', { text: '1 햇살' })).status === 200, '처음 비밀번호로도 바로 명단을 만들 수 있음(시연판)');
  ok((await T('teacher', 'changePin', { current: '0000', next: '2468' })).status === 400 && (await T('teacher', 'overview')).status === 200, '지금 비밀번호가 틀려도 로그인은 풀리지 않음');
  ok((await T('teacher', 'changePin', { current: '1324', next: '12' })).status === 400, '새 비밀번호는 4자리 이상');
  ok((await T('teacher', 'changePin', { current: '1324', next: '246813' })).status === 200, '비밀번호 바꾸기');
  const r = await T('teacher', 'roster', { text: '3학년 2반 명단\n1 햇살\n2 구름\n2 중복\n잘못된 줄\n3 단풍' });
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
  // 선생님이 지운 뒤: 그 전에 받아 간 화면(옛 since·since 없음)의 진행과 답은 되살아나지 않는다
  const W = client();
  await W('student', 'login', { code: r.body.students[1].code });
  const wOld = (await W('student', 'me')).body.since;
  await W('student', 'save', { since: wOld, progress: { books: { book4: { endings: ['late'] } } } });
  await sleep(5);
  await T('teacher', 'clear', { no: 2 });
  const st1 = await W('student', 'save', { since: wOld, progress: { books: { book4: { endings: ['late'] } } }, answers: [{ book: 'book4', scene: 's02', kind: 'choice', q: '옛 답', a: 'x', t: wOld - 1 }] });
  const st2 = await W('student', 'save', { progress: { books: { book4: { endings: ['late'] } } } });
  ok(st1.body.stale && st2.body.stale && !(await W('student', 'me')).body.progress.books.book4 && !(await T('teacher', 'student', { no: 2 })).body.answers.some(a => a.q === '옛 답'), '선생님이 지운 뒤 옛 화면의 진행·답은 되살아나지 않음');
  const wNew = (await W('student', 'me')).body.since;
  ok(!(await W('student', 'save', { since: wNew, progress })).body.stale, '다시 받은 뒤에는 저장됨');
  ok((await S('student', 'story', { text: '짧아요' })).status === 400, '200자 안 되면 거절');
  ok((await S('student', 'story', { text: '가'.repeat(501) })).status === 400, '500자 넘으면 거절');
  ok((await S('student', 'story', { text: 'Thu Hai tuan sau '.repeat(35) })).status === 200 && (await S('student', 'story', { text: 'a'.repeat(900) })).status === 200, '로마자 글은 두 자를 한 자로 (455자 → 228자, 900자 → 450자: 200~500 안)');
  ok((await S('student', 'story', { text: 'Привет '.repeat(20) })).status === 400 && (await S('student', 'story', { text: 'a'.repeat(1004) })).status === 400, '키릴 문자 120자(60자)는 짧고, 로마자 1004자(502자)는 넘침');
  ok((await S('student', 'story', { text: '다음 주 월요일 '.repeat(40), starter: 3 })).status === 200, '네 권을 다 읽고 200~500자로 쓰면 저장');
  const ov = (await T('teacher', 'overview')).body;
  const s1 = ov.students.find(s => s.no === 1);
  ok(s1.answers === 2 && s1.books.book1 === 1 && s1.story.chars >= 200, '교사 한눈에 보기에 답 수·결말 수·글이 나옴');
  const st = (await T('teacher', 'student', { no: 1 })).body;
  ok(st.answers.length === 2 && st.answers[1].a === '미안해 / 네 얘기도', '학생 한 명의 답이 시간순으로');
  ok((await T('teacher', 'grade', { no: 1, scores: { link: 3, main: 2, sense: 2, heart: 3 }, comment: '잘 이어 썼어요' })).status === 200, '교사 채점');
  const y1 = (await T('teacher', 'stories')).body.stories[0];
  ok(y1.teacher.scores.link === 3 && y1.starter === 3, '채점과 이야기 시작 번호가 저장됨');
  ok(ov.settings.starters.length === 6 && ov.settings.conditions.length === 3 && ov.settings.maxChars === 500, '이야기 시작 여섯 가지와 쓰기 조건이 나옴');
  // 명단에서 빠졌지만 기록을 남겨 둔 91번: 예시 학생은 그 번호를 건너뛴다
  const gone = (await T('teacher', 'roster', { text: '1 햇살\n2 구름\n3 단풍\n91 떠난' })).body.students.find(x => x.no === 91);
  const Z = client();
  await Z('student', 'login', { code: gone.code });
  await Z('student', 'save', { progress: { books: { book1: { endings: ['palm'] } } } });
  await T('teacher', 'roster', { text: '1 햇살\n2 구름\n3 단풍' });
  ok((await T('teacher', 'seedDemo')).body.added === 5, '예시 학생 다섯 명 넣기');
  await T('teacher', 'seedDemo');
  let d = (await T('teacher', 'overview')).body.students.filter(s => s.demo);
  ok(d.length === 5 && d[0].no === 92 && d[0].story.starter === 0 && d[0].story.teacher > 0 && d[4].answers === 0, '다시 넣어도 다섯 명, 읽은 정도와 글·채점이 서로 다름');
  ok((await T('teacher', 'student', { no: 92 })).body.answers.length > 10, '예시 학생의 답이 쌓여 있음');
  ok((await T('teacher', 'student', { no: 91 })).body.progress.books.book1, '명단에서 빠진 학생의 남은 기록은 예시 학생이 덮지 않음');
  const keep = (await T('teacher', 'roster', { text: '1 햇살\n2 구름\n3 단풍\n93 진짜' })).body.students;
  ok(keep.length === 8 && keep.filter(s => s.demo).length === 4 && !(await T('teacher', 'student', { no: 93 })).body.answers.length, '명단을 저장해도 예시 학생은 남고, 같은 번호를 적으면 실제 학생이 쓰며 예시 기록은 지워짐');
  ok((await T('teacher', 'clearDemo')).body.removed === 4, '예시 학생 지우기');
  d = (await T('teacher', 'overview')).body.students;
  ok(d.length === 4 && !d.some(s => s.demo) && !(await T('teacher', 'student', { no: 92 })).body.answers.length && (await T('teacher', 'student', { no: 91 })).body.progress, '예시 학생과 그 기록만 지워짐');
  await T('teacher', 'roster', { text: '1 햇살\n2 구름\n3 단풍', dropRemoved: true });
  if (Date.now() <= Date.UTC(2027, 2, 31, 14, 59, 59)) { // 시험용 업스테이지 기한 (2027. 3. 31.) 안
    ok((await T('teacher', 'overview')).body.settings.testAI.until === '2027. 3. 31.', '업스테이지 키가 없으면 시험용 업스테이지(쌤비서 중계)를 쓴다고 알려 줌');
    const g1 = await T('teacher', 'aiGrade', { no: 1 });
    const rq = relayReqs[0] || { headers: {}, body: {} };
    ok(g1.body.done === 1 && rq.url === '/api/chat' && rq.headers.origin === 'https://social-ruddy-gamma.vercel.app' && !rq.headers.authorization && /^solar/.test(rq.body.model) && rq.body.response_format, '시험용 채점은 중계로: 마음극장 주소, 키 없이, Solar 모델');
    ok((await T('teacher', 'stories')).body.stories.find(y => y.no === 1).ai.test === true, '시험용으로 채점했다고 남김');
  }
  await T('teacher', 'settings', { provider: 'openai' });
  ok(/키가 없어요/.test((await T('teacher', 'aiGrade', { no: 1 })).body.error || ''), '다른 AI 를 고르고 키가 없으면 알려 줌');
  await T('teacher', 'settings', { provider: 'upstage' });
  await T('teacher', 'settings', { keys: { claude: 'sk-ant-test-1234567890' }, minChars: 300 });
  if (Date.now() <= Date.UTC(2027, 2, 31, 14, 59, 59)) {
    await T('teacher', 'settings', { provider: 'claude' });
    const before = relayReqs.length;
    const gc = await T('teacher', 'aiGrade', { no: 1 });
    const yc = (await T('teacher', 'stories')).body.stories.find(y => y.no === 1).ai;
    ok(gc.body.done === 1 && claudeReqs.length === 1 && relayReqs.length === before + 1 && relayReqs[before].body.model === 'solar-pro4' && yc.instead === 'claude' && yc.model === 'solar-pro4', 'Claude 가 채점을 사양하면 기본 업스테이지 Solar 로 대신 채점');
    await T('teacher', 'settings', { provider: 'upstage' });
  }
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
  // 선생님 화면 두 곳: 옛 명단을 든 화면의 저장이 그사이 다른 화면에서 넣은 학생을 빼거나 그 기록을 지우지 않는다
  const seenNos = (await T('teacher', 'overview')).body.students.filter(s => !s.demo).map(s => s.no);
  const S4 = client();
  await S4('student', 'login', { code: (await T('teacher', 'roster', { text: '1 햇살\n2 구름\n3 단풍\n4 바람' })).body.students.find(s => s.no === 4).code });
  await S4('student', 'save', { progress: { books: { book1: { endings: ['palm'] } } } });
  const staleRoster = await T('teacher', 'roster', { text: '1 햇살\n2 구름', dropRemoved: true, base: seenNos });
  ok(staleRoster.status === 409 && /4 바람/.test(staleRoster.body.error) && (await T('teacher', 'overview')).body.students.length === 4 && (await T('teacher', 'student', { no: 4 })).body.progress, '옛 명단 화면의 저장은 그사이 들어온 학생을 빼거나 기록을 지우지 않음');
  ok((await T('teacher', 'roster', { text: '1 햇살\t' + '메모'.repeat(3100) })).status === 400, '6000자가 넘는 명단은 잘라 받지 않고 알림');
  for (let k = 0; k < 2; k++) await S4('student', 'save', { progress: { books: { book1: { endings: ['palm'], feels: Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`k${k}-${i}`, 'x'])) } } } });
  ok(Object.keys((await T('teacher', 'student', { no: 4 })).body.progress.books.book1.feels).length === 100, '진행을 합쳐도 감정 카드 답은 100개까지 (기록이 끝없이 커지지 않음)');
  // 선생님이 옛 글을 보고 매기는 사이 학생이 고쳐 내면, 그 점수는 고친 글의 채점으로 붙지 않는다
  await S4('student', 'save', { progress: { books: { book1: { endings: ['palm'] }, book2: { endings: ['x'] }, book3: { endings: ['x'] }, book4: { endings: ['x'] } } } });
  await S4('student', 'story', { text: '다음 주 월요일 '.repeat(60) });
  const seenAt = (await T('teacher', 'stories')).body.stories.find(y => y.no === 4).at;
  await sleep(5);
  await S4('student', 'story', { text: '고쳐 씀 ' + '다음 주 월요일 '.repeat(60) });
  const staleGrade = await T('teacher', 'grade', { no: 4, scores: { link: 1 }, comment: '옛 글', textAt: seenAt });
  const y4 = (await T('teacher', 'stories')).body.stories.find(y => y.no === 4);
  ok(staleGrade.body.stale && y4.teacher.at < y4.at && y4.teacher.comment === '옛 글', '옛 글을 보고 매긴 선생님 채점은 남기되, 고친 글의 채점으로 붙지 않음');
  const badKey = await T('teacher', 'settings', { keys: { openai: 'sk-키-1234567890\nsk-zzz' } });
  ok(badKey.status === 400 && !JSON.stringify(badKey.body).includes('1234567890'), 'AI 키에 한글·줄바꿈이 섞이면 저장하지 않고 한국어로 알림 (키 원문을 돌려주지 않음)');
  ok(/최대 글자 수는 최소/.test((await T('teacher', 'settings', { minChars: 600, maxChars: 500 })).body.error || ''), '글자 수 설정이 틀리면 어느 칸인지 알려 줌');
  let locked = false;
  for (let i = 0; i < 6; i++) if ((await X('teacher', 'login', { password: '999999' })).status === 429) locked = true;
  ok(locked, '한 기기에서 1분에 5번 넘게 틀리면 잠김');
  let shortLocked = false;
  for (let i = 0; i < 120; i++) if ((await X('student', 'login', { code: i % 2 ? '' : 'ZZ1' })).status === 429) shortLocked = true;
  ok(!shortLocked, '빈 칸·자릿수가 틀린 코드는 세지 않음');
  let codeLocked = 0;
  for (let i = 0; i < 102; i++) if ((await X('student', 'login', { code: 'ZZZZZ' + 'ABCDEFGHJK'[i % 10] })).status === 429) codeLocked++;
  ok(codeLocked === 2, '접속 코드를 10분에 100번 넘게 틀리면 잠김 (학교는 주소 하나를 함께 씀)');
  ok((await fetch(`http://localhost:${port}/api/student`, { method: 'POST', headers: { 'content-type': 'text/plain; x=application/json' }, body: '{"action":"ping"}' })).status === 415, 'JSON 이 아닌 보내기는 거절');
  ok((await fetch(`http://localhost:${port}/api/student`, { method: 'POST', headers: { 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' }, body: '{"action":"ping"}' })).status === 403, '다른 사이트에서 부르면 거절');
  for (const u of ['/.GIT/config', '/SERVER/core.js', '/.DATA/db.json', '/%', '/..%2f..%2fetc%2fpasswd']) ok([400, 404].includes((await fetch(`http://localhost:${port}${u}`)).status), `개발 서버가 ${u} 를 내주지 않음`);
} catch (e) {
  console.log('✗ ' + e.stack);
  fails++;
} finally {
  srv.kill();
  relay.close();
  claude.close();
  rmSync(dir, { recursive: true, force: true });
}
console.log(fails ? `실패 ${fails}개` : '통과');
process.exit(fails ? 1 : 0);
