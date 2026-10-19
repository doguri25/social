// 교사 API (POST /api/teacher, { action, … }): 비밀번호 로그인(처음 1324), 명단·코드, 학생 기록, 「이후의 이야기」 채점(교사·AI), 설정
'use strict';
const { db, route, httpError, sign, unsign, cookies, setCookie, validPin, makePin, checkPassword, encrypt, newCode, text, int } = require('../server/core');
const { getSettings, publicSettings, getRoster, setRoster, aiGrade, pingAI, PROVIDER_IDS } = require('../server/data');

const COOKIE = 'maum_t';
const HOURS = 8;
// 표 안의 v 는 비밀번호 판: 비밀번호를 바꾸면 다른 기기의 예전 로그인은 풀린다. m 은 되찾기 비밀번호(TEACHER_PASSWORD)로 들어온 표
const token = (v, master) => sign(`t:${Date.now() + HOURS * 3600000}:${v}${master ? ':m' : ''}`);
// 처음 비밀번호(1324)로 들어온 동안에는 비밀번호 바꾸기만 할 수 있다 (공개된 처음 값으로 학급 기록을 열지 못하게)
const FIRST_ONLY = ['overview', 'changePin'];
async function auth(req, action) {
  const pin = await db().get('meta', 'pin');
  const x = unsign(cookies(req)[COOKIE]);
  const [, exp, v, m] = (x || '').split(':');
  if (!x || !x.startsWith('t:') || Number(exp) < Date.now() || Number(v) !== ((pin && pin.v) || 0)) throw httpError(401, '선생님 비밀번호를 입력해 주세요.');
  if (!pin && m !== 'm' && !FIRST_ONLY.includes(action)) throw httpError(403, '처음 비밀번호(1324)를 먼저 바꿔 주세요. 「설정」에서 바꿀 수 있어요.');
  return pin;
}
const scoreSum = g => (g && g.scores ? Object.values(g.scores).reduce((a, b) => a + b, 0) : null);

const open = {
  login: async ({ req, res, body }) => {
    const pin = await db().get('meta', 'pin');
    const r = await checkPassword(body.password, pin, req);
    if (r.wait) throw httpError(429, `${r.wait}초 뒤에 다시 해 주세요.`);
    if (!r.ok) throw httpError(401, '비밀번호가 맞지 않아요.');
    setCookie(res, COOKIE, token((pin && pin.v) || 0, r.master), HOURS * 3600);
    return { ok: true, pinSet: !!pin };
  },
  logout: async ({ res }) => { setCookie(res, COOKIE, '', 0); return { ok: true }; },
};
const guarded = {
  changePin: async ({ req, res, pin, body }) => {
    const next = text(body.next, 20);
    if (!validPin(next)) throw httpError(400, '새 비밀번호는 숫자 4~12자리로 해 주세요.');
    if (next === '1324') throw httpError(400, '처음 비밀번호와 다른 번호로 해 주세요.');
    const r = await checkPassword(body.current, pin, req);
    if (!r.ok) throw httpError(401, r.wait ? `${r.wait}초 뒤에 다시 해 주세요.` : '지금 비밀번호가 맞지 않아요.');
    const np = makePin(next, ((pin && pin.v) || 0) + 1);
    await db().set('meta', 'pin', np);
    setCookie(res, COOKIE, token(np.v), HOURS * 3600);
    return { ok: true };
  },
  // 한눈에: 명단과 학생마다 읽은 결말 수, 답 수, 이후의 이야기 상태
  overview: async ({ pin }) => {
    const [students, progress, stories, count, s] = await Promise.all([getRoster(), db().find('progress'), db().find('stories'), db().countBy('answers', 'no'), getSettings()]);
    return {
      pinSet: !!pin,
      settings: publicSettings(s),
      students: students.map(st => {
        const p = progress.find(x => x.no === st.no), y = stories.find(x => x.no === st.no);
        return {
          no: st.no, alias: st.alias, code: st.code, at: p ? p.at : null, answers: count[st.no] || 0,
          books: Object.fromEntries(Object.entries((p && p.books) || {}).map(([id, b]) => [id, b.endings.length])),
          story: y ? { chars: [...y.text.replace(/\s/g, '')].length, at: y.at, teacher: scoreSum(y.teacher), ai: scoreSum(y.ai) } : null,
        };
      }),
    };
  },
  // 명단: 한 줄에 「번호 가명」. 같은 번호는 원래 코드를 그대로 쓴다. dropRemoved: 명단에서 빠진 번호의 기록도 지운다
  roster: async ({ body }) => {
    const old = await getRoster();
    const taken = new Set(old.map(s => s.code));
    const seen = new Set();
    const students = [];
    for (const line of text(body.text, 6000).split('\n')) {
      const m = /^\s*(\d{1,3})[\s.,)]+(.+?)\s*$/.exec(line);
      if (!m) continue;
      const no = Number(m[1]);
      if (seen.has(no)) continue;
      seen.add(no);
      const prev = old.find(s => s.no === no);
      const code = prev ? prev.code : newCode(taken);
      taken.add(code);
      students.push({ no, alias: m[2].slice(0, 20), code });
    }
    if (students.length > 60) throw httpError(400, '한 반은 60명까지예요.');
    students.sort((a, b) => a.no - b.no);
    const removed = old.filter(s => !seen.has(s.no)).map(s => s.no);
    if (body.dropRemoved) for (const no of removed) await Promise.all([db().del('progress', `s${no}`), db().delWhere('answers', { no }), db().del('stories', `s${no}`)]);
    await setRoster(students);
    return { students, removed };
  },
  newCode: async ({ body }) => {
    const no = int(body.no, 0, 999);
    const students = await getRoster();
    const s = students.find(x => x.no === no);
    if (!s) throw httpError(404, '그 번호가 명단에 없어요.');
    s.code = newCode(new Set(students.map(x => x.code)));
    await setRoster(students);
    return { code: s.code };
  },
  // 학생 한 명: 진행, 쌓인 답(시간순), 이후의 이야기
  student: async ({ body }) => {
    const no = int(body.no, 0, 999);
    const [p, answers, story] = await Promise.all([db().get('progress', `s${no}`), db().find('answers', { no }), db().get('stories', `s${no}`)]);
    answers.sort((a, b) => a.t - b.t);
    return { progress: p, answers: answers.map(({ id, ...a }) => a), story };
  },
  stories: async () => ({ stories: (await db().find('stories')).sort((a, b) => a.no - b.no) }),
  // 교사 채점: 기준마다 1~3, 한마디
  grade: async ({ body }) => {
    const no = int(body.no, 0, 999);
    const [y, s] = await Promise.all([db().get('stories', `s${no}`), getSettings()]);
    if (!y) throw httpError(404, '아직 쓴 글이 없어요.');
    const scores = {};
    s.rubric.forEach(r => { if (body.scores && body.scores[r.id] != null) scores[r.id] = int(body.scores[r.id], 1, 3); });
    const { id, ...doc } = y;
    await db().set('stories', `s${no}`, { ...doc, teacher: { scores, comment: text(body.comment, 600), at: Date.now() } });
    return { ok: true };
  },
  // AI 채점: 한 명(no) 또는 아직 AI 채점이 없는 글 모두(all). 학생 글만 AI 로 간다
  aiGrade: async ({ body }) => {
    const s = await getSettings();
    const list = body.all ? (await db().find('stories')).filter(y => !y.ai || y.ai.at < y.at) : [await db().get('stories', `s${int(body.no, 0, 999)}`)];
    let done = 0;
    const t0 = Date.now();
    for (const y of list.slice(0, 3)) { // 함수 한 번에 세 편까지, 35초를 넘기면 멈춘다 (버셀 시간 제한 60초)
      if (!y) throw httpError(404, '아직 쓴 글이 없어요.');
      if (done && Date.now() - t0 > 35000) break;
      const ai = await aiGrade(s, y.text);
      const { id, ...doc } = y;
      await db().set('stories', `s${y.no}`, { ...doc, ai });
      done++;
    }
    return { done, left: Math.max(0, list.length - done) };
  },
  settings: async ({ body }) => {
    const s = await getSettings();
    const next = { ...s, keys: { ...s.keys }, models: { ...s.models } };
    if (PROVIDER_IDS.includes(body.provider)) next.provider = body.provider;
    for (const p of PROVIDER_IDS) {
      const m = body.models && body.models[p];
      if (typeof m === 'string' && /^[\w.:/-]{1,80}$/.test(m.trim())) next.models[p] = m.trim();
      const k = body.keys && body.keys[p];
      if (k === '') delete next.keys[p]; // 빈 글자 = 지우기, 안 보내면 그대로
      else if (typeof k === 'string' && k.trim()) next.keys[p] = encrypt(k.trim().slice(0, 300));
    }
    if (Array.isArray(body.rubric) && body.rubric.length) {
      next.rubric = body.rubric.slice(0, 6).map((r, i) => ({ id: text(r.id || `c${i}`, 20).replace(/[^\w]/g, '') || `c${i}`, name: text(r.name, 30), levels: [0, 1, 2].map(k => text(r.levels && r.levels[k], 200)) }));
    }
    if (body.minChars != null) next.minChars = int(body.minChars, 50, 2000);
    if (typeof body.prompt === 'string' && body.prompt.trim()) next.prompt = text(body.prompt.trim(), 500);
    const { id, ...doc } = next;
    await db().set('meta', 'settings', doc);
    return { settings: publicSettings(next) };
  },
  testAI: async ({ body }) => pingAI(await getSettings(), body.provider),
  // 기록 지우기: 한 명(no) 또는 반 전체(all). 명단과 설정은 남는다
  clear: async ({ body }) => {
    if (body.all) { for (const col of ['progress', 'answers', 'stories']) await db().delWhere(col, {}); return { ok: true }; }
    const no = int(body.no, 0, 999);
    await Promise.all([db().del('progress', `s${no}`), db().delWhere('answers', { no }), db().del('stories', `s${no}`)]);
    return { ok: true };
  },
};

module.exports = route({
  ...open,
  ...Object.fromEntries(Object.entries(guarded).map(([k, fn]) => [k, async ctx => fn({ ...ctx, pin: await auth(ctx.req, k) })])),
});
