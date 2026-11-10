// 학생 API (POST /api/student, { action, … })
// 접속 코드(또는 QR 의 ?c=코드)로 들어오면 서명한 쿠키를 준다. 저장하는 것: 번호, 가명(교사가 정함), 읽은 결말·이어 보기 자리, 고른 답, 「이후의 이야기」
'use strict';
const { db, route, httpError, sign, unsign, cookies, setCookie, text, storageReady, ipOf, throttle, blocked, storyChars } = require('../server/core');
const { getRoster, getSettings, unlocked, BOOKS, STARTERS } = require('../server/data');

const COOKIE = 'maum_s';
const KINDS = ['choice', 'whatif', 'feel', 'compose', 'signals', 'sort', 'role', 'ending'];

async function who(req, body) {
  const v = unsign(cookies(req)[COOKIE]);
  const m = v && /^s:(\d+):([A-Z0-9]+)$/.exec(v);
  if (!m) throw httpError(401, '접속 코드로 다시 들어와 주세요.');
  const s = (await getRoster()).find(x => x.no === Number(m[1]) && x.code === m[2]); // 선생님이 코드를 새로 만들면 예전 쿠키는 못 쓴다
  if (!s) throw httpError(401, '접속 코드가 바뀌었어요. 선생님께 새 코드를 받아 주세요.');
  // no: 화면이 아는 학생. 같은 브라우저의 다른 탭에서 다른 학생이 들어오면 쿠키가 그 학생 것으로 바뀐다 (앞 학생 화면의 진행·답·글이 새 학생 기록에 섞이지 않게)
  if (body && body.no != null && Number(body.no) !== s.no) throw httpError(409, '이 기기에서 다른 학생이 들어왔어요. 내 접속 코드로 다시 들어와 주세요.');
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
// 다른 기기에 열려 있던 옛 화면이 보낸 진행이 새 기록을 지우지 않게: 본 결말은 합치고, 이어 보기 자리는 더 새 것을 남긴다
// ended: 책마다 결말에 닿아 이어 보기를 지운 때 (화면이 보낸 것과 저장된 것 가운데 더 나중). 이 화면에 없는 이어 보기 자리는 지운 것이 아니라
// 모르는 것(다른 기기가 남김)이라 남기고, 지우는 것은 ended 로만 한다
function mergeProgress(next, cur, endedIn) {
  const legacy = endedIn === undefined; // v0.8.2 이하 화면: ended 없이, 결말에 닿으면 그 자리를 빼고 보낸다 (그때처럼 보내지 않은 자리는 지운다)
  const ended = { ...((cur && cur.ended) || {}) };
  for (const [id, t] of Object.entries(endedIn && typeof endedIn === 'object' && !Array.isArray(endedIn) ? endedIn : {}).slice(0, 12)) if (isBook(id) && Number(t) > (ended[id] || 0)) ended[id] = Number(t);
  next.ended = ended;
  const drop = () => { for (const id of Object.keys(next.resume)) if (ended[id] >= next.resume[id].at) delete next.resume[id]; };
  if (!cur) { drop(); return next; }
  // 합친 뒤에도 한 번에 받는 만큼(책 12권, 답 100개)만 둔다. 저장할 때마다 새 이름을 보내 한 학생 기록을 끝없이 키우지 못하게 (MongoDB 문서는 16MB 까지)
  const last = (o, max) => Object.fromEntries(Object.entries(o).slice(-max));
  for (const [id, o] of Object.entries(cur.books || {})) {
    if (!next.books[id] && Object.keys(next.books).length >= 12) continue;
    const n = next.books[id] || (next.books[id] = { endings: [], feels: {}, acts: {}, role: '' });
    n.endings = [...new Set([...n.endings, ...(o.endings || [])])].slice(0, 20);
    n.feels = last({ ...(o.feels || {}), ...n.feels }, 100);
    n.acts = last({ ...(o.acts || {}), ...n.acts }, 100);
    n.role = n.role || o.role || '';
  }
  for (const [id, r] of Object.entries(cur.resume || {})) if (r && (next.resume[id] ? r.at > next.resume[id].at : !legacy && Object.keys(next.resume).length < 12)) next.resume[id] = r;
  drop();
  return next;
}
// 선생님이 이 학생(또는 반 전체) 기록을 지운 때 (api/teacher.js 의 wipe·clear 가 남긴다)
const wipedAt = async no => Math.max(0, ...(await Promise.all([db().get('meta', `wiped:s${no}`), db().get('meta', 'wiped:all')])).map(w => (w && w.at) || 0));
const MAX_ANSWERS = 3000; // 한 학생의 답은 이만큼까지 (저장소가 넘치지 않게)
const cleanAnswer = (a, no) => ({
  // id: 화면이 답마다 붙인 무작위 글자. 저장은 됐는데 답이 끊겨 화면이 다시 보낸 답을 한 번만 쌓게 문서 id 로 쓴다 (예전 화면은 id 없이)
  ...(typeof a.id === 'string' && /^[0-9a-z]{8,40}$/.test(a.id) ? { _id: `s${no}:${a.id}` } : {}),
  no, book: text(a.book, 12), scene: text(a.scene, 20), kind: KINDS.includes(a.kind) ? a.kind : 'choice',
  q: text(a.q, 300), a: text(Array.isArray(a.a) ? a.a.join(' / ') : a.a, 1000), t: Number.isFinite(a.t) ? a.t : Date.now(),
});

module.exports = route({
  // 서버가 있는지 확인 (GitHub Pages·아티팩트에서는 이 주소가 없어 「로그인 없이 하기」만 보인다)
  ping: async () => ({ ok: true, ready: storageReady() }),
  login: async ({ req, res, body }) => {
    const code = text(body.code, 12).trim().toUpperCase();
    if (!/^[2-9A-HJKMNP-Z]{6}$/.test(code)) throw httpError(401, '코드를 다시 확인해 주세요. 여섯 글자예요.'); // 빈 칸·자릿수가 틀린 것은 세지 않는다
    const key = `code:${ipOf(req)}`;
    // 한 접속 주소에서 10분에 100번까지 틀릴 수 있다 (코드 맞히기를 막는다). 학교는 반 전체가 공인 주소 하나를 함께 쓰므로 넉넉히 두고(코드는 31^6 가지),
    // 틀린 것만 세고 맞혀도 지우지 않는다 (맞힐 때마다 지우면 자기 코드를 가진 학생이 남의 코드를 끝없이 넣어 볼 수 있다)
    const wait = await blocked(key, 100, 600000);
    if (wait) throw httpError(429, `코드를 너무 많이 넣었어요. ${Math.ceil(wait / 60)}분 뒤에 다시 해 주세요.`);
    const s = (await getRoster()).find(x => x.code === code);
    if (!s) { await throttle(key, 100, 600000); throw httpError(401, '코드를 다시 확인해 주세요.'); }
    setCookie(res, COOKIE, sign(`s:${s.no}:${s.code}`), 60 * 60 * 24 * 180);
    return { no: s.no, alias: s.alias };
  },
  logout: async ({ res }) => { setCookie(res, COOKIE, '', 0); return { ok: true }; },
  me: async ({ req }) => {
    const s = await who(req);
    const since = Date.now(); // 읽기 전에 잰다 (읽는 사이 선생님이 지우면 다음 저장이 stale 이 되게)
    const [prog, story, set] = await Promise.all([db().get('progress', `s${s.no}`), db().get('stories', `s${s.no}`), getSettings()]);
    return { since, no: s.no, alias: s.alias, progress: prog ? { books: prog.books, resume: prog.resume } : { books: {}, resume: {} }, story: story ? { text: story.text, at: story.at, starter: story.starter } : null, minChars: set.minChars, maxChars: set.maxChars, prompt: set.prompt, books: BOOKS };
  },
  // 진행 저장 + 새로 고른 답 쌓기 (답은 지우지 않고 계속 쌓는다)
  save: async ({ req, body }) => {
    const s = await who(req, body);
    const p = body.progress;
    let stale = false, wiped = 0, merged = null;
    if (p && typeof p === 'object' && p.books && typeof p.books === 'object') {
      let cur;
      [cur, wiped] = await Promise.all([db().get('progress', `s${s.no}`), wipedAt(s.no)]);
      // 선생님이 기록을 지우기 전에 받아 간 화면(since 를 보내지 않는 예전 화면 포함)이 보낸 진행은 받지 않는다 (지운 기록이 되살아나지 않게). 화면은 진행을 다시 받아 간다
      if (wiped && !(Number(body.since) >= wiped)) stale = true;
      else await db().set('progress', `s${s.no}`, { no: s.no, ...(merged = mergeProgress(cleanProgress(p), cur, body.ended)), at: Date.now() });
    }
    let answers = [].concat(body.answers || []).slice(0, 60).filter(a => a && typeof a === 'object').map(a => cleanAnswer(a, s.no));
    if (stale) answers = answers.filter(a => a.t >= wiped); // 지우기 전에 고른 답도 다시 넣지 않는다
    const have = await Promise.all(answers.map(a => a._id && db().get('answers', a._id)));
    answers = answers.filter((a, i) => !have[i]); // 이미 받은 답 (앞 저장의 답이 화면에 닿지 못해 다시 보낸 것)
    if (answers.length) answers = answers.slice(0, Math.max(0, MAX_ANSWERS - (await db().count('answers', { no: s.no })))); // 상한까지 남은 만큼은 받는다
    await db().insertMany('answers', answers);
    // wiped: 화면이 지운 뒤에 읽은 것을 가려 다시 넣게. ends: 다른 기기에서 본 결말까지 합친 것 (화면이 「이후의 이야기」 열림을 바로 알게)
    return { ok: true, saved: answers.length, stale, wiped: stale ? wiped : undefined, ends: merged ? Object.fromEntries(Object.entries(merged.books).map(([id, b]) => [id, b.endings])) : undefined, ended: merged ? merged.ended : undefined }; // ended: 다른 기기에서 끝낸 책의 옛 이어 보기 자리를 화면도 지우게
  },
  // 이후의 이야기: 1~4권을 모두 읽은 뒤에만, 정해진 글자 수(띄어쓰기 빼고) 안에서. starter: 선생님이 들려준 이야기 시작 번호
  story: async ({ req, body }) => {
    const s = await who(req, body);
    const [prog, set, old] = await Promise.all([db().get('progress', `s${s.no}`), getSettings(), db().get('stories', `s${s.no}`)]);
    if (!unlocked(prog)) throw httpError(403, '1~4권을 모두 끝까지 읽으면 쓸 수 있어요.');
    const t = text(body.text, 24000).trim(); // 최대 5000자 (로마자는 두 배) + 띄어쓰기
    const n = storyChars(t);
    if (n < set.minChars) throw httpError(400, `${set.minChars}자 넘게 써 주세요.`);
    if (n > set.maxChars) throw httpError(400, `${set.maxChars}자 안으로 줄여 주세요.`);
    const starter = STARTERS.some(x => x.id === body.starter) ? body.starter : null;
    await db().set('stories', `s${s.no}`, { no: s.no, text: t, starter, at: Date.now(), versions: ((old && old.versions) || 0) + 1, teacher: (old && old.teacher) || null, ai: (old && old.ai) || null });
    return { ok: true };
  },
});
