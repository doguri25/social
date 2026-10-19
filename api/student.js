// 학생 API (POST /api/student, { action, … })
// 접속 코드(또는 QR 의 ?c=코드)로 들어오면 서명한 쿠키를 준다. 저장하는 것: 번호, 가명(교사가 정함), 읽은 결말·이어 보기 자리, 고른 답, 「이후의 이야기」
'use strict';
const { db, route, httpError, sign, unsign, cookies, setCookie, text, storageReady, ipOf, throttle, forgive } = require('../server/core');
const { getRoster, getSettings, unlocked, BOOKS } = require('../server/data');

const COOKIE = 'maum_s';
const KINDS = ['choice', 'whatif', 'feel', 'compose', 'signals', 'sort', 'role', 'ending'];

async function who(req) {
  const v = unsign(cookies(req)[COOKIE]);
  const m = v && /^s:(\d+):([A-Z0-9]+)$/.exec(v);
  if (!m) throw httpError(401, '접속 코드로 다시 들어와 주세요.');
  const s = (await getRoster()).find(x => x.no === Number(m[1]) && x.code === m[2]); // 선생님이 코드를 새로 만들면 예전 쿠키는 못 쓴다
  if (!s) throw httpError(401, '접속 코드가 바뀌었어요. 선생님께 새 코드를 받아 주세요.');
  return s;
}
// 진행: 책마다 본 결말·감정 카드 답·활동 답·역할, 책마다 이어 보기 자리. 정해진 모양만 골라 담는다(깊이·개수 제한)
const isBook = id => /^book\d{1,2}$/.test(id);
const small = v => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'boolean' ? v : text(v, 80));
const flat = (o, max) => Object.fromEntries(Object.entries(o && typeof o === 'object' && !Array.isArray(o) ? o : {}).slice(0, max).map(([k, v]) => [text(k, 40), Array.isArray(v) ? v.slice(0, 20).map(small) : small(v)]));
const cleanTrail = t => [].concat(t || []).slice(0, 40).filter(x => x && typeof x === 'object').map(x => ({
  type: text(x.type, 10), scene: text(x.scene, 20), at: Number(x.at) || 0, q: text(x.q, 300), opts: [].concat(x.opts || []).slice(0, 12).map(o => text(o, 200)), pick: Number(x.pick) || 0, flags: flat(x.flags, 60),
}));
function cleanProgress(p) {
  const out = { books: {}, resume: {} };
  for (const [id, b] of Object.entries(p.books || {}).slice(0, 12)) {
    if (!isBook(id) || !b || typeof b !== 'object') continue;
    out.books[id] = { endings: [].concat(b.endings || []).map(e => text(e, 40)).slice(0, 20), feels: flat(b.feels, 100), acts: flat(b.acts, 100), role: text(b.role, 40) };
  }
  for (const [id, r] of Object.entries(p.resume || {}).slice(0, 12)) {
    if (isBook(id) && r && typeof r === 'object') out.resume[id] = { scene: text(r.scene, 20), place: text(r.place, 80), flags: flat(r.flags, 60), trail: cleanTrail(r.trail), at: Number(r.at) || Date.now() };
  }
  return out;
}
const MAX_ANSWERS = 3000; // 한 학생의 답은 이만큼까지 (저장소가 넘치지 않게)
const cleanAnswer = (a, no) => ({
  no, book: text(a.book, 12), scene: text(a.scene, 20), kind: KINDS.includes(a.kind) ? a.kind : 'choice',
  q: text(a.q, 300), a: text(Array.isArray(a.a) ? a.a.join(' / ') : a.a, 1000), t: Number.isFinite(a.t) ? a.t : Date.now(),
});

module.exports = route({
  // 서버가 있는지 확인 (GitHub Pages·아티팩트에서는 이 주소가 없어 「로그인 없이 하기」만 보인다)
  ping: async () => ({ ok: true, ready: storageReady() }),
  login: async ({ req, res, body }) => {
    const key = `code:${ipOf(req)}`;
    const t = await throttle(key, 20, 600000); // 한 기기에서 10분에 20번까지 (코드 맞히기를 막는다)
    if (t.wait) throw httpError(429, `코드를 너무 많이 넣었어요. ${Math.ceil(t.wait / 60)}분 뒤에 다시 해 주세요.`);
    const code = text(body.code, 12).trim().toUpperCase();
    const s = (await getRoster()).find(x => x.code === code);
    if (!s) throw httpError(401, '코드를 다시 확인해 주세요.');
    await forgive(key);
    setCookie(res, COOKIE, sign(`s:${s.no}:${s.code}`), 60 * 60 * 24 * 180);
    return { no: s.no, alias: s.alias };
  },
  logout: async ({ res }) => { setCookie(res, COOKIE, '', 0); return { ok: true }; },
  me: async ({ req }) => {
    const s = await who(req);
    const [prog, story, set] = await Promise.all([db().get('progress', `s${s.no}`), db().get('stories', `s${s.no}`), getSettings()]);
    return { no: s.no, alias: s.alias, progress: prog ? { books: prog.books, resume: prog.resume } : { books: {}, resume: {} }, story: story ? { text: story.text, at: story.at } : null, minChars: set.minChars, prompt: set.prompt, books: BOOKS };
  },
  // 진행 저장 + 새로 고른 답 쌓기 (답은 지우지 않고 계속 쌓는다)
  save: async ({ req, body }) => {
    const s = await who(req);
    const p = body.progress;
    if (p && typeof p === 'object' && p.books && typeof p.books === 'object') await db().set('progress', `s${s.no}`, { no: s.no, ...cleanProgress(p), at: Date.now() });
    let answers = [].concat(body.answers || []).slice(0, 60).filter(a => a && typeof a === 'object').map(a => cleanAnswer(a, s.no));
    if (answers.length && (await db().count('answers', { no: s.no })) + answers.length > MAX_ANSWERS) answers = [];
    await db().insertMany('answers', answers);
    return { ok: true, saved: answers.length };
  },
  // 이후의 이야기: 1~4권을 모두 읽은 뒤에만, 정해진 글자 수 이상
  story: async ({ req, body }) => {
    const s = await who(req);
    const [prog, set, old] = await Promise.all([db().get('progress', `s${s.no}`), getSettings(), db().get('stories', `s${s.no}`)]);
    if (!unlocked(prog)) throw httpError(403, '1~4권을 모두 끝까지 읽으면 쓸 수 있어요.');
    const t = text(body.text, 5000).trim();
    if ([...t.replace(/\s/g, '')].length < set.minChars) throw httpError(400, `${set.minChars}자 넘게 써 주세요.`);
    await db().set('stories', `s${s.no}`, { no: s.no, text: t, at: Date.now(), versions: ((old && old.versions) || 0) + 1, teacher: (old && old.teacher) || null, ai: (old && old.ai) || null });
    return { ok: true };
  },
});
