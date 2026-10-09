// ===== 기본 도구: 저장, 주소, 소리, 읽어 주기, 기다리기 =====
const $ = (s, r = document) => r.querySelector(s);
const h = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
// 받침 있는 이름 뒤에는 '은', 없으면 '는'
const topic = name => { const c = name.charCodeAt(name.length - 1) - 0xac00; return c >= 0 && c < 11172 && c % 28 ? '은' : '는'; };

// ---- 저장: 이 기기에만 남고 어디로도 보내지 않는다 ----
const SAVE_KEY = 'social-v1';
const save = (() => {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && s.v === 1) return s;
  } catch (e) { /* 저장소를 못 쓰는 기기: 새로 시작 */ }
  return { v: 1, books: {}, set: {} };
})();
save.set = Object.assign({ read: false, fs: 1, q: 'auto', sound: true, cls: false }, save.set);
function store() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* 저장 실패해도 놀이는 계속 */ } }
function bookRec(id) { return save.books[id] || (save.books[id] = { endings: [], feels: {} }); }

// ---- 수업 링크: ?book=1&mode=class 또는 #book1.class (아티팩트는 # 만 전달됨) ----
const ARGS = new URLSearchParams(location.search);
(location.hash || '').slice(1).split(/[&.]/).forEach(t => {
  if (t === 'class') ARGS.set('mode', 'class');
  const m = /^book(\d)$/.exec(t);
  if (m) ARGS.set('book', m[1]);
});
if (ARGS.get('mode') === 'class') save.set.cls = true;

// ---- 효과음: 파일 없이 짧게 합성 ----
let actx = null;
const NOTES = {
  tap: [[660, 0, .06]],
  page: [[523, 0, .05], [784, .05, .08]],
  pick: [[659, 0, .1], [988, .08, .16]],
  soft: [[440, 0, .3]],
  end: [[523, 0, .14], [659, .13, .14], [784, .26, .14], [1047, .39, .34]],
};
function sfx(kind) {
  if (!save.set.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const t0 = actx.currentTime + .01;
    (NOTES[kind] || []).forEach(([f, at, d]) => {
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      g.gain.setValueAtTime(.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(.16, t0 + at + .015);
      g.gain.exponentialRampToValueAtTime(.0001, t0 + at + d);
      o.connect(g).connect(actx.destination);
      o.start(t0 + at);
      o.stop(t0 + at + d + .05);
    });
  } catch (e) { /* 소리를 못 내는 기기 */ }
}

// ---- 읽어 주기: 브라우저 음성 합성, 한국어 목소리가 있을 때만 ----
let koVoice = null;
function findVoice() {
  try { koVoice = speechSynthesis.getVoices().find(v => /^ko/i.test(v.lang)) || null; } catch (e) { koVoice = null; }
  const b = $('#btnRead');
  if (b) b.hidden = !koVoice;
}
if ('speechSynthesis' in window) { findVoice(); speechSynthesis.addEventListener('voiceschanged', findVoice); }
function speak(text) {
  if (!save.set.read || !koVoice || !text) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = koVoice;
    u.lang = koVoice.lang;
    u.rate = .95;
    speechSynthesis.speak(u);
  } catch (e) { /* 읽기 실패는 무시 */ }
}
function hush() { try { speechSynthesis.cancel(); } catch (e) { /* 없음 */ } }

let toastT = 0;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.hidden = true; }, 2200);
}

// ---- 기다리기: 아이가 누를 때까지 멈추고, 책장으로 나가면 한꺼번에 취소 ----
const CANCEL = { cancel: true };
let waiters = [];
function waitFor(setup) {
  return new Promise((resolve, reject) => {
    let cleanup = null;
    let done = false;
    const w = { stop() { if (done) return; done = true; if (cleanup) cleanup(); reject(CANCEL); } };
    waiters.push(w);
    cleanup = setup(v => {
      if (done) return;
      done = true;
      waiters = waiters.filter(x => x !== w);
      if (cleanup) cleanup();
      resolve(v);
    });
    if (done && cleanup) cleanup();
  });
}
function cancelFlow() { const ws = waiters; waiters = []; ws.forEach(w => w.stop()); }
