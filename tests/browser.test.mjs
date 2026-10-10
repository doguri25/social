// 브라우저 시험: 크롬을 화면 없이 띄워 1권을 처음부터 결말까지 자동으로 넘겨 본다.
//   node tests/browser.test.mjs [warm|okay|sorry] [phone] [every] [사진 폴더]
// 교실 첫 장면에서는 둘러보기 점 누르기, 무대 돌리기(카메라 쪽 벽이 걷히는지), 이전 컷 보기도 확인한다.
// 콘솔 오류가 하나라도 나거나 결말에 닿지 못하면 실패. 고비마다 화면을 찍어 둔다.
import { resolve } from 'node:path';
import { openPage, sleep } from './cdp.mjs';

const want = ['warm', 'okay', 'sorry'].find(a => process.argv.includes(a)) || 'warm';
const phone = process.argv.includes('phone');
const every = process.argv.includes('every'); // 컷마다 사진
const shots = resolve(process.argv.slice(2).find(a => a.startsWith('/')) || 'dist/shots');
const { send, run, snap, quit, badErrors } = await openPage({ url: 'file://' + resolve('index.html') + '?book=1', shots, phone, prefix: phone ? 'phone-' : '', limit: 720000 });
const state = async () => JSON.parse(await run('JSON.stringify(window.__maum ? window.__maum.state() : null)') || 'null');

// 결말마다 고르는 방법: 갈림길 번호, 말 조각 고르기 (만약에는 돌아가며)
const PLAN = {
  warm: { choice: 0, pieces: t => !/근데|됐지/.test(t) },
  okay: { choice: 2, pieces: t => /색연필|지도를/.test(t) },
  sorry: { choice: 1, pieces: t => /됐지|근데/.test(t) },
}[want];

// 화면에 보이는 것 하나를 눌러 한 걸음 나아간다
const STEP = `(() => {
  const vis = s => { const e = document.querySelector(s); return e && !e.hidden && e.getClientRects().length ? e : null; };
  if (vis('#loading')) return 'loading';
  const ask = document.querySelector('#ask'), kind = ask.dataset.kind;
  if (kind === 'ending') return 'ending';
  if (kind === 'breathe') { ask.querySelector('.skip').click(); return 'breathe'; }
  if (kind === 'feel' && ask.querySelector('.emo:not(:disabled)')) { ask.querySelectorAll('.emo')[__EMO__].click(); return 'feel'; }
  if (kind === 'compose' && !ask.querySelector('.piece[aria-pressed="true"]')) {
    const pcs = [...ask.querySelectorAll('.piece')];
    pcs.forEach(b => { if ((__PIECES__)(b.textContent)) b.click(); });
    if (!ask.querySelector('.piece[aria-pressed="true"]')) pcs[0].click();
    return 'compose';
  }
  if (kind === 'choice' || kind === 'whatif') {
    const opts = ask.querySelectorAll('.opt');
    const i = kind === 'choice' ? __CHOICE__ : (window.__wi = (window.__wi || 0) + 1) % opts.length;
    opts[Math.min(i, opts.length - 1)].click();
    return kind;
  }
  const nb = document.querySelector('#btnNext');
  if (!nb.disabled) { nb.click(); return kind === 'intro' ? 'stage' : 'next'; }
  return 'idle';
})()`;
const step = STEP.replace('__PIECES__', PLAN.pieces.toString()).replace('__CHOICE__', PLAN.choice).replace('__EMO__', '6');

// 무대 끌어 돌리기 (노란 점이 없는 바닥 쪽에서)
async function drag(dx) {
  const r = JSON.parse(await run(`JSON.stringify(document.querySelector('#gl').getBoundingClientRect())`));
  const x0 = r.x + r.width * 0.85, y0 = r.y + r.height * 0.82, d = Math.sign(dx) * Math.max(r.width * Math.abs(dx), 220); // 좁은 휴대전화 화면에서도 충분히 돌게
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: 'left', clickCount: 1 });
  for (let i = 1; i <= 12; i++) await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + d * i / 12, y: y0, button: 'left', buttons: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x0 + d, y: y0, button: 'left', clickCount: 1 });
  await sleep(1500);
}
const checks = { pop: false, walls: false, back: false };
async function classroomChecks() {
  await run(`document.querySelector('.hs')?.click()`);
  await sleep(500);
  checks.pop = !!(await run(`(() => { const p = document.querySelector('#pop'); return p.hidden ? '' : p.textContent; })()`));
  await snap('c1-pop');
  const w0 = (await state()).walls.join();
  await drag(-0.25); // 관성 때문에 조금만 끌어도 많이 돈다
  const w1 = (await state()).walls.join();
  checks.walls = w0 !== w1;
  await snap('c2-rotated');
  await drag(0.25);
  console.log(`  벽 ${w0} → 돌린 뒤 ${w1}`);
}

const counts = {};
const marks = new Set();
let idleRun = 0; // 컷 찍기를 기다리며 연달아 쉰 횟수
for (let i = 0; i < 600; i++) {
  await sleep(i < 3 ? 2000 : 450);
  const st = await state();
  if (!st) continue;
  const key = ['intro', 'choice', 'whatif', 'feel', 'compose', 'breathe', 'ending'].includes(st.kind) ? `${st.kind}-${st.scene}` : null;
  if (key && !marks.has(key) && marks.size < 40) { marks.add(key); await sleep(300); await snap(String(marks.size).padStart(2, '0') + '-' + key); }
  if (st.kind === 'intro' && st.stage === 'classroom' && !checks.pop) await classroomChecks();
  if (!checks.back && st.kind !== 'intro' && st.cuts >= 3 && st.at === st.cuts - 1 && st.next) {
    await run(`document.querySelector('#btnPrev').click()`);
    await sleep(500);
    const b = await state();
    checks.back = b.at === b.cuts - 2;
    await snap('c3-back');
    await run(`document.querySelector('#btnNext').click()`);
    await sleep(400);
  }
  const act = await run(step);
  if (every && act === 'next') { await sleep(600); await snap(`p-${String(i).padStart(3, '0')}-${st.scene}`); }
  counts[act] = (counts[act] || 0) + 1;
  if (act === 'ending') break;
  idleRun = act === 'idle' ? idleRun + 1 : 0;
  if (idleRun > 60) break;
}
await sleep(600);
await snap('90-ending');
const s = await state();
console.log('마지막 상태: ' + JSON.stringify(Object.assign({}, s, { flags: undefined, walls: undefined })));
// 내가 고른 길 화면도 한 번 열어 본다
await run(`document.querySelector('#ask .sbtn.primary')?.click()`);
await sleep(700);
await snap('91-review');
const reviewStops = await run(`document.querySelectorAll('#story .stop').length`);
console.log(`걸음: ${JSON.stringify(counts)}`);
console.log(`결말: ${s.ending} (원하는 결말 ${want}), 내가 고른 길 정류장 ${reviewStops}개, 화질 ${s.tier}`);
console.log(`둘러보기 말: ${checks.pop ? '나옴' : '안 나옴'}, 벽 걷힘: ${checks.walls ? '됨' : '안 됨'}, 이전 컷: ${checks.back ? '됨' : '안 됨'}`);
const bad = badErrors();
bad.forEach(e => console.log('✗ 콘솔 오류: ' + e));
const ok = !bad.length && s.ending === want && reviewStops >= 6 && checks.pop && checks.walls && checks.back;
console.log(ok ? `통과 · 사진: ${shots}` : '실패');
quit(ok ? 0 : 1);
