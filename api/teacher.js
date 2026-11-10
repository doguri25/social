// 교사 API (POST /api/teacher, { action, … }): 비밀번호 로그인(처음 1324), 명단·코드, 학생 기록, 「이후의 이야기」 채점(교사·AI), 설정
'use strict';
const { db, route, httpError, sign, unsign, cookies, setCookie, validPin, makePin, checkPassword, encrypt, newCode, text, int, storyChars } = require('../server/core');
const { getSettings, publicSettings, getRoster, setRoster, aiGrade, pingAI, PROVIDER_IDS } = require('../server/data');
const { makeDemo } = require('../server/demo');

const COOKIE = 'maum_t';
const HOURS = 8;
// 표 안의 v 는 비밀번호 판: 비밀번호를 바꾸면 다른 기기의 예전 로그인은 풀린다. m 은 되찾기 비밀번호(TEACHER_PASSWORD)로 들어온 표
const token = (v, master) => sign(`t:${Date.now() + HOURS * 3600000}:${v}${master ? ':m' : ''}`);
// 처음 비밀번호(1324)로도 모든 화면이 열린다(시연판). 실제 수업 기록을 모을 때는 「설정」에서 바꾼다
async function auth(req) {
  const pin = await db().get('meta', 'pin');
  const x = unsign(cookies(req)[COOKIE]);
  const [, exp, v] = (x || '').split(':');
  if (!x || !x.startsWith('t:') || Number(exp) < Date.now() || Number(v) !== ((pin && pin.v) || 0)) throw httpError(401, '선생님 비밀번호를 입력해 주세요.');
  return pin;
}
// 한 학생의 진행·답·글을 지운다 (명단은 그대로). 지운 때를 남겨, 그 전에 열린 학생 화면이 옛 진행을 다시 올리지 못하게 한다 (api/student.js save)
const wipe = no => Promise.all([db().del('progress', `s${no}`), db().delWhere('answers', { no }), db().del('stories', `s${no}`), db().set('meta', `wiped:s${no}`, { at: Date.now() })]);
// 명단 한 줄: 「번호 가명」. 「1. 햇살」「1) 햇살」「1번 햇살」「1햇살」「１ 햇살」도 받는다 (teacher.html 도 같은 규칙)
// 「3학년 2반 명단」「10월 5일」「1모둠 …」처럼 숫자에 바로 붙은 머리 줄은 학생으로 보지 않는다 (「5 조 민수」처럼 띄어 쓴 성은 받는다)
const ROSTER_LINE = /^\s*(\d{1,3})(?!\d)(?!(?:학년|반|모둠|월|일|교시|차시|층|조)(?:\s|$|[0-9]))(?:번(?=[\s.,):-]|$))?[\s.,):-]*(\S.*?)\s*$/;
const halfDigits = line => line.replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xfee0));
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
    if (!r.ok) throw httpError(r.wait ? 429 : 400, r.wait ? `${r.wait}초 뒤에 다시 해 주세요.` : '지금 비밀번호가 맞지 않아요.'); // 401 이면 화면이 로그인으로 돌아가 버린다
    const np = makePin(next, ((pin && pin.v) || 0) + 1);
    await db().set('meta', 'pin', np);
    setCookie(res, COOKIE, token(np.v), HOURS * 3600);
    return { ok: true };
  },
  // 한눈에: 명단과 학생마다 읽은 결말 수, 답 수, 이후의 이야기 상태
  overview: async ({ pin }) => {
    const [students, progress, stories, count, s] = await Promise.all([getRoster(), db().find('progress'), db().find('stories'), db().countBy('answers', 'no'), getSettings()]);
    const onRoster = new Set(students.map(st => st.no));
    return {
      pinSet: !!pin,
      // 명단에서 뺐지만 기록을 남겨 둔 번호 (그 번호에 새 학생을 넣을 때 선생님께 묻는다)
      orphans: [...new Set([...progress.map(x => x.no), ...stories.map(x => x.no), ...Object.keys(count).map(Number)])].filter(no => !onRoster.has(no)).sort((a, b) => a - b),
      settings: publicSettings(s),
      students: students.map(st => {
        const p = progress.find(x => x.no === st.no), y = stories.find(x => x.no === st.no);
        return {
          no: st.no, alias: st.alias, code: st.code, demo: !!st.demo, at: p ? p.at : null, answers: count[st.no] || 0,
          books: Object.fromEntries(Object.entries((p && p.books) || {}).map(([id, b]) => [id, b.endings.length])),
          story: y ? { chars: storyChars(y.text), at: y.at, starter: y.starter, teacher: scoreSum(y.teacher), ai: scoreSum(y.ai) } : null,
        };
      }),
    };
  },
  // 명단: 한 줄에 「번호 가명」. 같은 번호는 원래 코드를 그대로 쓴다. dropRemoved: 명단에서 빠진 번호의 기록도 지운다
  // wipeNew: 새로 넣는 번호 가운데, 예전 학생 기록이 남아 있어 지우고 시작할 번호 (새 학생이 남의 기록을 물려받지 않게)
  roster: async ({ body }) => {
    const old = await getRoster();
    // 예시 학생은 명단 글에 나오지 않고 그대로 남는다. 같은 번호를 적으면 실제 학생이 그 자리를 쓰고 예시 기록은 지운다
    const demo = old.filter(s => s.demo);
    const taken = new Set(old.map(s => s.code));
    const seen = new Set();
    const students = [], skipped = [];
    for (const line of text(body.text, 6000).split('\n')) {
      const m = ROSTER_LINE.exec(halfDigits(line));
      if (!m) { if (line.trim()) skipped.push(line.trim().slice(0, 30)); continue; }
      const no = Number(m[1]);
      if (seen.has(no)) { skipped.push(line.trim().slice(0, 30)); continue; }
      seen.add(no);
      const prev = old.find(s => s.no === no && !s.demo);
      const code = prev ? prev.code : newCode(taken);
      taken.add(code);
      students.push({ no, alias: m[2].slice(0, 20), code });
    }
    if (students.length > 60) throw httpError(400, '한 반은 60명까지예요.');
    for (const d of demo) if (seen.has(d.no)) await wipe(d.no); else students.push(d);
    students.sort((a, b) => a.no - b.no);
    const removed = old.filter(s => !s.demo && !seen.has(s.no)).map(s => s.no);
    if (body.dropRemoved) for (const no of removed) await wipe(no);
    const fresh = new Set([].concat(body.wipeNew || []).map(Number));
    for (const st of students) if (!st.demo && fresh.has(st.no) && !old.some(o => o.no === st.no)) await wipe(st.no); // 지금 명단에 있던 학생 기록은 건드리지 않는다
    await setRoster(students);
    return { students, removed, skipped: skipped.slice(0, 10) };
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
    const at = Date.now();
    await db().set('stories', `s${no}`, { ...doc, teacher: { scores, comment: text(body.comment, 600), at } });
    return { ok: true, at };
  },
  // AI 채점: 한 명(no) 또는 아직 AI 채점이 없는 글 모두(all). 학생 글만 AI 로 간다
  aiGrade: async ({ body }) => {
    const s = await getSettings();
    // 모두 채점에서는 예시 학생 글을 빼서 선생님 키를 쓰지 않는다
    const demo = body.all ? new Set((await getRoster()).filter(x => x.demo).map(x => x.no)) : null;
    const skip = new Set([].concat(body.skip || []).map(Number)); // 이번 「모두 채점」에서 이미 못 한 글은 다시 보내지 않는다
    const list = body.all ? (await db().find('stories')).filter(y => !demo.has(y.no) && !skip.has(y.no) && (!y.ai || y.ai.at < y.at)) : [await db().get('stories', `s${int(body.no, 0, 999)}`)];
    let done = 0;
    const failed = [];
    const t0 = Date.now();
    for (const y of list.slice(0, 3)) { // 함수 한 번에 세 편까지. AI 를 기다리는 시간까지 합해 55초 안에 끝낸다 (버셀 시간 제한 60초)
      if (!y) throw httpError(404, '아직 쓴 글이 없어요.');
      const left = 55000 - (Date.now() - t0);
      if ((done || failed.length) && left < 20000) break;
      let ai;
      try { ai = await aiGrade(s, y.text, y.starter, Math.min(45000, left)); } catch (e) {
        if (!body.all || !e.perStory) throw e; // 키 없음·하루 횟수·연결 실패는 모든 글에 같으니 멈춘다
        failed.push({ no: y.no, error: e.message });
        continue;
      }
      // AI 를 기다리는 동안 학생이 글을 고쳐 냈을 수 있다: 새 글을 덮어쓰지 않고, 옛 글의 점수로 남겨 「다시 채점」 대상이 되게 한다
      const cur = await db().get('stories', `s${y.no}`);
      if (!cur) continue;
      const { id, ...doc } = cur;
      await db().set('stories', `s${y.no}`, { ...doc, ai: cur.text === y.text ? ai : { ...ai, at: Math.min(ai.at, cur.at - 1) } });
      done++;
    }
    return { done, failed, left: Math.max(0, list.length - done - failed.length) };
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
    const rubric = Array.isArray(body.rubric) ? body.rubric.filter(r => r && typeof r === 'object') : [];
    if (rubric.length) {
      next.rubric = rubric.slice(0, 6).map((r, i) => ({ id: text(r.id || `c${i}`, 20).replace(/[^\w]/g, '') || `c${i}`, name: text(r.name, 30), levels: [0, 1, 2].map(k => text(r.levels && r.levels[k], 200)) }));
    }
    if (body.minChars != null) next.minChars = int(body.minChars, 50, 2000);
    if (body.maxChars != null) next.maxChars = int(body.maxChars, next.minChars, 5000);
    if (typeof body.prompt === 'string' && body.prompt.trim()) next.prompt = text(body.prompt.trim(), 500);
    const { id, ...doc } = next;
    await db().set('meta', 'settings', doc);
    return { settings: publicSettings(next) };
  },
  testAI: async ({ body }) => pingAI(await getSettings(), body.provider),
  // 예시 학생: 명단에 「예시-」 학생 다섯 명과 읽은 기록·답·이후의 이야기를 넣는다(다시 누르면 새로 만든다). 지우면 예시 학생과 그 기록만 지운다
  seedDemo: async () => {
    const [all, progress, stories, count] = await Promise.all([getRoster(), db().find('progress'), db().find('stories'), db().countBy('answers', 'no')]);
    const old = all.filter(s => !s.demo), was = new Set(all.filter(s => s.demo).map(s => s.no));
    for (const no of was) await wipe(no);
    // 명단에서 빠졌지만 기록을 남겨 둔 번호에도 예시 학생을 넣지 않는다
    const used = [...progress.map(x => x.no), ...stories.map(x => x.no), ...Object.keys(count).map(Number)].filter(no => !was.has(no));
    const demo = makeDemo(old, used);
    for (const d of demo.students) await Promise.all([db().set('progress', `s${d.no}`, d.progress), db().delWhere('answers', { no: d.no }), d.story ? db().set('stories', `s${d.no}`, d.story) : db().del('stories', `s${d.no}`)]);
    for (const d of demo.students) await db().insertMany('answers', d.answers);
    await setRoster([...old, ...demo.students.map(d => d.entry)].sort((a, b) => a.no - b.no));
    return { added: demo.students.length };
  },
  clearDemo: async () => {
    const all = await getRoster();
    const demo = all.filter(s => s.demo);
    for (const s of demo) await wipe(s.no);
    await setRoster(all.filter(s => !s.demo));
    return { removed: demo.length };
  },
  // 기록 지우기: 한 명(no) 또는 반 전체(all). 명단과 설정은 남는다
  clear: async ({ body }) => {
    if (body.all) { for (const col of ['progress', 'answers', 'stories']) await db().delWhere(col, {}); await db().set('meta', 'wiped:all', { at: Date.now() }); return { ok: true }; }
    await wipe(int(body.no, 0, 999));
    return { ok: true };
  },
};

module.exports = route({
  ...open,
  ...Object.fromEntries(Object.entries(guarded).map(([k, fn]) => [k, async ctx => fn({ ...ctx, pin: await auth(ctx.req) })])),
});
