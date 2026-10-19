// 학급 접속 시험: node tests/class.test.mjs [사진 폴더]
// 이 컴퓨터 서버(tools/dev.mjs, 임시 저장소)를 띄우고 크롬으로: 첫 화면 → 접속 코드 → 책 읽기(답 쌓기) → 처음 화면으로 → 다시 들어와 이어 보기 → 선생님 화면
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { openPage, sleep } from './cdp.mjs';

const shots = resolve(process.argv.slice(2).find(a => a.startsWith('/')) || 'dist/shots-class');
const dir = mkdtempSync(join(tmpdir(), 'maum-db-'));
const port = 4200 + Math.floor(Math.random() * 300);
const srv = spawn(process.execPath, ['tools/dev.mjs', String(port)], { env: { ...process.env, DATA_FILE: join(dir, 'db.json'), MONGODB_URI: '', VERCEL: '' }, stdio: 'ignore' });
process.on('exit', () => { srv.kill(); rmSync(dir, { recursive: true, force: true }); });
const base = `http://localhost:${port}/`;
let jar = '';
const teacher = async (action, data = {}) => {
  const r = await fetch(base + 'api/teacher', { method: 'POST', headers: { 'content-type': 'application/json', cookie: jar }, body: JSON.stringify({ action, ...data }) });
  const c = r.headers.getSetCookie()[0]; if (c) jar = c.split(';')[0];
  return r.json();
};
for (let i = 0; i < 40; i++) { try { await fetch(base); break; } catch { await sleep(150); } }
await teacher('login', { password: '1324' });
await teacher('changePin', { current: '1324', next: '246813' }); // 처음 비밀번호로는 명단을 만들 수 없다
const code = (await teacher('roster', { text: '1 햇살\n2 구름' })).students[0].code;

let fails = 0;
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++; };
const { run, snap, quit, badErrors, send } = await openPage({ url: base, shots, limit: 420000 });
const wait = async (expr, ms = 30000) => { for (let t = 0; t < ms; t += 300) { if (await run(expr)) return true; await sleep(300); } return false; };
const state = async () => JSON.parse(await run('JSON.stringify(window.__maum.state())'));

ok(await wait(`!document.querySelector('#gate').hidden`, 60000), '첫 화면이 뜸');
ok(await run(`!!document.querySelector('.codein')`) && await run(`/로그인 없이 하기/.test(document.querySelector('#gate').textContent)`), '접속 코드 칸과 로그인 없이 하기');
await snap('01-gate');
await run(`(() => { const i = document.querySelector('.codein'); i.value = '${code}'; document.querySelector('.coderow .btn').click(); })()`);
ok(await wait(`document.querySelector('#gate').hidden && /햇살/.test(document.querySelector('.whoami').textContent)`), '코드로 들어가 책장에 가명이 보임');
await snap('02-shelf');
// 1권을 열고 첫 갈림길까지 넘긴 뒤 하나 고르기
await run(`document.querySelector('.bookrow').click()`);
for (let i = 0; i < 80; i++) {
  const st = await state();
  if (st.kind === 'choice') { await run(`document.querySelector('#ask .opt').click()`); break; }
  await run(`(() => { const b = document.querySelector('#btnNext'); if (!b.disabled) b.click(); })()`);
  await sleep(700);
}
await sleep(1500);
const scene = (await state()).scene;
await run(`document.querySelector('#btnHome').click()`);
await sleep(2500);
const d = await teacher('student', { no: 1 });
ok(d.answers.some(a => a.kind === 'choice'), '고른 답이 학급 서버에 쌓임');
ok(d.progress && d.progress.resume && d.progress.resume.book1 && d.progress.resume.book1.scene === scene, `처음 화면으로 누르면 이어 볼 자리(${scene}) 저장`);
await snap('03-home');
// 다시 들어오기: 쿠키로 바로 들어오고, 1권을 누르면 이어 보기를 묻는다
await send('Page.navigate', { url: base });
ok(await wait(`window.__maum && document.querySelector('#loading').hidden && document.querySelector('#gate').hidden && /햇살/.test((document.querySelector('.whoami') || {}).textContent || '')`, 60000), '다시 열면 첫 화면 없이 바로 들어옴');
await run(`document.querySelector('.bookrow').click()`);
ok(await wait(`document.querySelector('#ask').dataset.kind === 'resume'`), '이어 보기를 물음');
await snap('04-resume');
await run(`document.querySelector('#ask .sbtn.primary').click()`);
ok(await wait(`window.__maum.state().scene === '${scene}'`), '이어 보기로 그 장면부터');
// 이후의 이야기는 아직 잠김
await run(`document.querySelector('#btnHome').click()`);
await sleep(1200);
ok(await run(`/0 \\/ 4권 읽음|1 \\/ 4권 읽음/.test(document.querySelector('#story').textContent)`), '이후의 이야기는 네 권을 다 읽기 전엔 잠김');
// 네 권을 다 읽은 것으로 서버에 적고 다시 들어오면 이후의 이야기가 열린다
// (페이지가 떠날 때 자기 진행을 보내므로, 먼저 떠난 뒤에 이 컴퓨터에서 같은 학생으로 적는다)
await send('Page.navigate', { url: 'about:blank' });
await sleep(1500);
const lr = await fetch(base + 'api/student', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'login', code }) });
const sc = lr.headers.getSetCookie()[0].split(';')[0];
await fetch(base + 'api/student', { method: 'POST', headers: { 'content-type': 'application/json', cookie: sc }, body: JSON.stringify({ action: 'save', progress: { books: { book1: { endings: ['palm'] }, book2: { endings: ['busy'] }, book3: { endings: ['clap'] }, book4: { endings: ['board'] } } } }) });
await send('Page.navigate', { url: base });
ok(await wait(`document.querySelector('#loading').hidden && /이제 쓸 수 있어요/.test(document.querySelector('#story').textContent)`, 60000), '네 권을 다 읽으면 이후의 이야기가 열림');
await run(`[...document.querySelectorAll('.bookrow')].pop().click()`);
ok(await wait(`!!document.querySelector('.afterta')`), '이후의 이야기 쓰는 화면');
ok(await run(`document.querySelector('#btnNext').disabled`), '200자 전에는 낼 수 없음');
await run(`(() => { const t = document.querySelector('.afterta'); t.value = '다음 주 월요일, 지우가 먼저 공을 받아 보겠다고 했어요. '.repeat(10); t.dispatchEvent(new Event('input')); })()`);
await snap('05-after');
ok(!(await run(`document.querySelector('#btnNext').disabled`)), '200자를 넘기면 낼 수 있음');
await run(`document.querySelector('#btnNext').click()`);
await sleep(1500);
const ys = (await teacher('stories')).stories;
ok(ys.length === 1 && ys[0].text.startsWith('다음 주 월요일'), '낸 글이 학급 서버에 저장됨');
// 선생님 화면
await send('Page.navigate', { url: base + 'teacher.html' });
ok(await wait(`!!document.querySelector('input[type=password]')`), '선생님 로그인 화면');
await run(`(() => { document.querySelector('input[type=password]').value = '246813'; document.querySelector('.btn').click(); })()`);
ok(await wait(`/명단·QR/.test(document.querySelector('#tabs').textContent) && document.querySelectorAll('.qr img').length === 2`), '명단과 QR 카드 2장');
await snap('05-teacher-roster');
await run(`[...document.querySelectorAll('#tabs button')].find(b => b.textContent === '학생 기록').click()`);
ok(await wait(`document.querySelectorAll('tbody tr').length === 2`), '학생 기록 표');
await run(`document.querySelector('tbody tr').click()`);
ok(await wait(`document.querySelectorAll('.answer').length > 0`), '학생을 누르면 답이 시간순으로');
await snap('06-teacher-records');
await run(`[...document.querySelectorAll('#tabs button')].find(b => b.textContent === '이후의 이야기').click()`);
ok(await wait(`document.querySelectorAll('.story').length === 1 && document.querySelectorAll('.rub fieldset').length === 4`), '이후의 이야기 글과 채점 기준 4가지');
await run(`(() => { document.querySelectorAll('.rub fieldset').forEach(f => f.querySelectorAll('input')[2].click()); [...document.querySelectorAll('.btn')].find(b => b.textContent === '선생님 채점 저장').click(); })()`);
await sleep(800);
ok((await teacher('stories')).stories[0].teacher.scores.link === 3, '선생님 채점 저장');
await run(`[...document.querySelectorAll('.sub')].find(b => b.textContent === 'AI 채점').click()`);
ok(await wait(`/키가 없어요/.test(document.querySelector('main').textContent)`), 'AI 키가 없으면 알려 줌');
await snap('08-teacher-stories');
await run(`[...document.querySelectorAll('#tabs button')].find(b => b.textContent === '설정').click()`);
ok(await wait(`document.querySelectorAll('.prov').length === 4`), '설정에 AI 4종');
await snap('07-teacher-settings');
const bad = badErrors().filter(e => !/401|Unauthorized|400 \(Bad Request\) .*api\/teacher/.test(e)); // 로그인 전 401, AI 키 없을 때 400 은 일부러 낸 것
bad.forEach(e => console.log('✗ 콘솔 오류: ' + e));
console.log(fails || bad.length ? `실패 ${fails + bad.length}개` : `통과 · 사진: ${shots}`);
quit(fails || bad.length ? 1 : 0);
