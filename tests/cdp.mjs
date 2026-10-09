// 시험 도구: 크롬을 화면 없이 띄워 페이지 하나를 연다 (CDP, node 24 의 WebSocket).
// 크롬 대신 node 가 CDN 파일(three·babylon, 글꼴)을 받아 tests/.cache 에 두고 넘겨 준다 (크롬 네트워크가 불안할 때도 같은 결과)
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const sleep = ms => new Promise(r => setTimeout(r, ms));

// url: 열 페이지, shots: 사진 폴더, prefix: 사진 이름 앞에 붙일 말, phone: 휴대전화 화면 크기
export async function openPage({ url, shots, prefix = '', phone = false, size = [1280, 860], limit = 240000 }) {
  mkdirSync(shots, { recursive: true });
  const PORT = 9300 + Math.floor(Math.random() * 500);
  const profile = mkdtempSync(join(tmpdir(), 'maum-'));
  const chrome = spawn(CHROME, [
    '--headless=new', '--mute-audio', `--remote-debugging-port=${PORT}`, // 시험 중에는 효과음이 컴퓨터 스피커로 나오지 않게 `--user-data-dir=${profile}`,
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    `--window-size=${size[0]},${size[1]}`, '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', 'about:blank',
  ], { stdio: 'ignore' });
  const quit = code => { try { chrome.kill(); } catch {} setTimeout(() => { try { rmSync(profile, { recursive: true, force: true }); } catch {} process.exit(code); }, 300); };
  process.on('unhandledRejection', e => { console.log('✗ ' + (e && e.message)); quit(1); });
  setTimeout(() => { console.log(`✗ 시간 초과 (${limit / 60000}분)`); quit(1); }, limit).unref();

  let targets = null;
  for (let i = 0; i < 50 && !targets; i++) {
    await sleep(200);
    try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); } catch {}
  }
  const tab = targets && targets.find(t => t.type === 'page');
  if (!tab) { console.log('✗ 크롬을 띄우지 못함'); quit(1); }
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  const CACHE = new URL('./.cache/', import.meta.url);
  mkdirSync(CACHE, { recursive: true });
  async function cached(u) {
    const key = createHash('sha1').update(u).digest('hex');
    const body = new URL(key, CACHE), meta = new URL(key + '.type', CACHE);
    if (!existsSync(body)) {
      const r = await fetch(u);
      if (!r.ok) throw new Error(`${r.status} ${u}`);
      writeFileSync(body, Buffer.from(await r.arrayBuffer()));
      writeFileSync(meta, r.headers.get('content-type') || 'application/octet-stream');
    }
    return { data: readFileSync(body).toString('base64'), type: readFileSync(meta, 'utf8') };
  }
  let seq = 0;
  const pending = new Map();
  const errors = [];
  const send = (method, params = {}) => new Promise((r, j) => {
    const id = ++seq;
    const t = setTimeout(() => { pending.delete(id); j(new Error(`${method} 응답 없음`)); }, 60000); // 소프트웨어 그리기로 컷을 찍는 동안 화면이 오래 바쁠 수 있다
    pending.set(id, m => { clearTimeout(t); r(m); });
    ws.send(JSON.stringify({ id, method, params }));
  });
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value || a.description).join(' '));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push(m.params.entry.text + ' ' + (m.params.entry.url || ''));
    if (m.method === 'Fetch.requestPaused') {
      const { requestId, request } = m.params;
      cached(request.url).then(
        f => send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: f.type }, { name: 'Access-Control-Allow-Origin', value: '*' }], body: f.data }),
        e => { errors.push('받기 실패 ' + e.message); send('Fetch.failRequest', { requestId, errorReason: 'Failed' }); },
      );
    }
  });
  const run = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result?.result?.value; };
  const snap = async name => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(shots, `${prefix}${name}.png`), Buffer.from(r.result.data, 'base64')); };

  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Fetch.enable', { patterns: ['*cdn.jsdelivr.net/npm/*', '*fonts.googleapis.com/*', '*fonts.gstatic.com/*'].map(urlPattern => ({ urlPattern })) });
  if (phone) await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  else await send('Emulation.setDeviceMetricsOverride', { width: size[0], height: size[1], deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  // 글꼴은 못 받아도 기본 글꼴로 그려지므로 오류로 치지 않는다
  const badErrors = () => errors.filter(e => !/favicon|fonts\.g/.test(e));
  return { send, run, snap, quit, badErrors };
}
