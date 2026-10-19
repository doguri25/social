// 서버 공용 (버셀 서버리스 함수가 함께 쓴다): 저장소, 서명 쿠키, 교사 비밀번호, 시도 횟수 제한, AI 키 암호화, 요청 처리 틀
// 구조는 마음빛(mam)과 같다. 저장소는 MONGODB_URI 가 있으면 MongoDB, 없으면(이 컴퓨터에서 돌릴 때만) .data/db.json
'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const httpError = (status, message) => Object.assign(new Error(message), { status });
const onVercel = () => !!process.env.VERCEL;
const dataDir = () => path.dirname(process.env.DATA_FILE || path.join(process.cwd(), '.data', 'db.json'));

// 서명·암호화 열쇠: SESSION_SECRET 을 권한다. 없으면 MONGODB_URI 에서 만든다(주소를 바꾸면 로그인과 AI 키를 다시 넣어야 함).
// 이 컴퓨터에서 돌릴 때는 처음 한 번 무작위로 만들어 .data/secret 에 둔다 (공개 저장소에 적힌 값을 쓰지 않게)
let localSecret = null;
function secret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.MONGODB_URI) return crypto.createHash('sha256').update('maum-theater:' + process.env.MONGODB_URI).digest('base64');
  if (onVercel()) throw httpError(503, '서버 설정이 아직 없어요. 버셀 환경 변수에 MONGODB_URI 를 넣어 주세요.');
  if (localSecret) return localSecret;
  const file = path.join(dataDir(), 'secret');
  try { localSecret = fs.readFileSync(file, 'utf8').trim(); } catch { /* 처음 */ }
  if (!localSecret) {
    localSecret = crypto.randomBytes(32).toString('base64url');
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(file, localSecret, { mode: 0o600 });
  }
  return localSecret;
}
const mac = v => crypto.createHmac('sha256', secret()).update(v).digest('base64url');
const sign = v => `${v}.${mac(v)}`;
function unsign(signed) {
  if (!signed) return null;
  const i = signed.lastIndexOf('.');
  if (i < 1) return null;
  const v = signed.slice(0, i), a = Buffer.from(signed.slice(i + 1)), b = Buffer.from(mac(v));
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? v : null;
}

// ---- 저장소: 모음(meta, progress, answers, stories). 문서 id 는 _id ----
const PREFIX = process.env.DATA_PREFIX || 'maum_';
let store = null;
function mongo(uri) {
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(uri, { maxPoolSize: 5 }); // 서버리스 인스턴스마다 연결을 조금만
  const ready = client.connect();
  ready.catch(() => { store = null; }); // 연결에 실패하면 다음 요청에서 다시 연결
  const c = async col => (await ready).db(process.env.MONGODB_DB || 'maum_theater').collection(PREFIX + col);
  const plain = d => { if (!d) return null; const { _id, ...rest } = d; return { id: _id, ...rest }; };
  return {
    kind: 'mongo',
    get: async (col, id) => plain(await (await c(col)).findOne({ _id: id })),
    set: async (col, id, doc) => void (await (await c(col)).replaceOne({ _id: id }, doc, { upsert: true })),
    insertMany: async (col, docs) => { if (docs.length) await (await c(col)).insertMany(docs.map(d => ({ _id: crypto.randomUUID(), ...d }))); },
    find: async (col, filter = {}) => (await (await c(col)).find(filter).toArray()).map(plain),
    count: async (col, filter = {}) => (await c(col)).countDocuments(filter),
    countBy: async (col, field) => Object.fromEntries((await (await c(col)).aggregate([{ $group: { _id: '$' + field, n: { $sum: 1 } } }]).toArray()).map(r => [r._id, r.n])),
    inc: async (col, id, field) => plain(await (await c(col)).findOneAndUpdate({ _id: id }, { $inc: { [field]: 1 } }, { upsert: true, returnDocument: 'after' })), // 여러 서버가 동시에 세어도 정확히
    del: async (col, id) => void (await (await c(col)).deleteOne({ _id: id })),
    delWhere: async (col, filter) => void (await (await c(col)).deleteMany(filter)),
  };
}
function local() {
  const file = process.env.DATA_FILE || path.join(process.cwd(), '.data', 'db.json');
  const read = () => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; } };
  const write = d => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file + '.tmp', JSON.stringify(d), { mode: 0o600 }); fs.renameSync(file + '.tmp', file); };
  const edit = (col, fn) => { const d = read(); const out = fn((d[col] = d[col] || {})); write(d); return out; };
  const hit = (doc, filter) => Object.entries(filter).every(([k, v]) => doc[k] === v);
  const rows = (col, filter) => Object.entries(read()[col] || {}).filter(([, d]) => hit(d, filter));
  return {
    kind: 'local',
    get: async (col, id) => { const r = (read()[col] || {})[id]; return r ? { id, ...r } : null; },
    set: async (col, id, doc) => edit(col, r => { r[id] = doc; }),
    insertMany: async (col, docs) => edit(col, r => { docs.forEach(d => { r[crypto.randomUUID()] = d; }); }),
    find: async (col, filter = {}) => rows(col, filter).map(([id, d]) => ({ id, ...d })),
    count: async (col, filter = {}) => rows(col, filter).length,
    countBy: async (col, field) => { const out = {}; rows(col, {}).forEach(([, d]) => { out[d[field]] = (out[d[field]] || 0) + 1; }); return out; },
    inc: async (col, id, field) => edit(col, r => { r[id] = { ...(r[id] || {}), [field]: ((r[id] || {})[field] || 0) + 1 }; return { id, ...r[id] }; }),
    del: async (col, id) => edit(col, r => { delete r[id]; }),
    delWhere: async (col, filter) => edit(col, r => { for (const [id, d] of Object.entries(r)) if (hit(d, filter)) delete r[id]; }),
  };
}
function db() {
  if (store) return store;
  if (process.env.MONGODB_URI) return (store = mongo(process.env.MONGODB_URI));
  if (onVercel()) throw httpError(503, '서버 저장소가 아직 없어요. 버셀 환경 변수에 MONGODB_URI 를 넣어 주세요.');
  return (store = local());
}
// 저장소를 쓸 수 있는지 (버셀에 MONGODB_URI 가 아직 없으면 학생 화면은 「로그인 없이 하기」만 보인다)
const storageReady = () => !!process.env.MONGODB_URI || !onVercel();

// ---- 시도 횟수 제한: 정해진 시간 안에 max 번까지. 아이피는 해시로만 저장한다 ----
const ipOf = req => crypto.createHash('sha256').update(String(req.headers['x-real-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0] || (req.socket && req.socket.remoteAddress) || '').trim()).digest('base64url').slice(0, 16);
async function throttle(key, max, windowMs) {
  const id = `try:${key}`;
  let doc = await db().inc('meta', id, 'n');
  if (!doc.start || Date.now() - doc.start > windowMs) { doc = { n: 1, start: Date.now() }; await db().set('meta', id, doc); }
  return doc.n > max ? { wait: Math.ceil((doc.start + windowMs - Date.now()) / 1000) } : {};
}
const forgive = key => db().del('meta', `try:${key}`);

// ---- 교사 비밀번호: 처음은 1324. 바꾸면 scrypt 로 바꿔 저장(숫자 4~12자리, 마음빛과 같게).
// 버셀 환경 변수 TEACHER_PASSWORD 가 있으면 그 값은 늘 들어갈 수 있는 되찾기 비밀번호가 되고, 처음 비밀번호 1324 는 쓰지 않는다 ----
const scrypt = (pin, salt) => crypto.scryptSync(pin, salt, 32).toString('base64url');
const validPin = pin => /^\d{4,12}$/.test(pin);
const makePin = (pin, v) => { const salt = crypto.randomBytes(16).toString('base64url'); return { salt, hash: scrypt(pin, salt), v }; };
const same = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };
async function checkPassword(input, pin, req) {
  const got = String(input || '');
  const master = process.env.TEACHER_PASSWORD;
  if (master && same(master, got)) return { ok: true, master: true };
  const ip = ipOf(req);
  for (const [key, max] of [[`teacher:${ip}`, 5], ['teacher:all', 30]]) { // 한 기기는 1분에 5번, 반 전체는 1분에 30번
    const t = await throttle(key, max, 60000);
    if (t.wait) return { ok: false, wait: t.wait };
  }
  const ok = pin ? same(scrypt(got, pin.salt), pin.hash) : !master && same('1324', got);
  if (ok) await forgive(`teacher:${ip}`);
  return { ok };
}

// ---- AI 키 암호화 (AES-256-GCM). 키는 서버에만 두고 화면에는 가린 모양만 ----
const keyBytes = () => crypto.createHash('sha256').update(secret() + ':api-keys').digest();
function encrypt(plain) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', keyBytes(), iv);
  const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), data].map(b => b.toString('base64url')).join('.');
}
function decrypt(box) {
  try {
    const [iv, tag, data] = String(box).split('.').map(s => Buffer.from(s, 'base64url'));
    const d = crypto.createDecipheriv('aes-256-gcm', keyBytes(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(data), d.final()]).toString('utf8');
  } catch { return null; } // 열쇠가 바뀌면 풀 수 없음 → 다시 입력
}
const mask = key => (key.length <= 8 ? '••••' : `${key.slice(0, 4)}••••${key.slice(-4)}`);

// 학생 접속 코드: 헷갈리는 0·O·1·I·L 을 뺀 여섯 글자
const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
function newCode(taken) {
  for (;;) {
    const code = Array.from(crypto.randomBytes(6), b => CODE_CHARS[b % CODE_CHARS.length]).join('');
    if (!taken.has(code)) return code;
  }
}

// ---- 쿠키 ----
function cookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) { try { out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); } catch { /* 깨진 쿠키는 무시 */ } } });
  return out;
}
function setCookie(res, name, value, maxAge) {
  const secure = onVercel() ? '; Secure' : '';
  const prev = [].concat(res.getHeader('Set-Cookie') || []);
  res.setHeader('Set-Cookie', [...prev, `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`]);
}

// ---- 요청 틀: 같은 사이트에서 온 POST + JSON 만 받고 { action, … } 으로 나눈다. 오류는 { error } ----
async function readBody(req) {
  let body;
  try { body = req.body; } catch { throw httpError(400, 'JSON 이 아니에요.'); } // 버셀은 읽을 때 JSON 을 푼다
  if (body === undefined || typeof body === 'string' || Buffer.isBuffer(body)) {
    let raw = typeof body === 'string' ? body : Buffer.isBuffer(body) ? body.toString('utf8') : '';
    if (body === undefined) for await (const ch of req) { raw += ch; if (raw.length > 300000) throw httpError(413, '보낸 내용이 너무 커요.'); }
    try { body = JSON.parse(raw || '{}'); } catch { throw httpError(400, 'JSON 이 아니에요.'); }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, '보낸 내용이 맞지 않아요.');
  return body;
}
function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(data));
}
function route(actions) {
  return async (req, res) => {
    try {
      if (req.method !== 'POST') throw httpError(405, 'POST 로만 불러 주세요.');
      // 다른 사이트에서 보낸 요청은 받지 않는다 (JSON 머리글 + 브라우저가 붙이는 Sec-Fetch-Site)
      if (!/^application\/json\s*(;|$)/i.test(req.headers['content-type'] || '')) throw httpError(415, 'JSON 으로 보내 주세요.');
      if (req.headers['sec-fetch-site'] === 'cross-site') throw httpError(403, '다른 사이트에서는 부를 수 없어요.');
      const body = await readBody(req);
      const fn = Object.prototype.hasOwnProperty.call(actions, body.action) && actions[body.action];
      if (!fn) throw httpError(400, '모르는 요청이에요.');
      send(res, 200, (await fn({ req, res, body })) || { ok: true });
    } catch (e) {
      if (!e.status) console.error(e);
      send(res, e.status || 500, { error: e.status ? e.message : '서버에 문제가 생겼어요. 잠시 뒤 다시 해 주세요.' });
    }
  };
}

// ---- 값 다듬기 ----
const text = (v, max) => String(v == null ? '' : v).slice(0, max);
const int = (v, lo, hi) => { const n = Math.round(Number(v)); if (!Number.isFinite(n) || n < lo || n > hi) throw httpError(400, '숫자가 맞지 않아요.'); return n; };

module.exports = { storageReady, httpError, sign, unsign, db, ipOf, throttle, forgive, validPin, makePin, checkPassword, encrypt, decrypt, mask, newCode, cookies, setCookie, route, text, int };
