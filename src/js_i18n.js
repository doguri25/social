// ===== 언어: 첫 화면·설정에서 고른다. 고르면 화면 글자와 이야기 글이 그 언어로 =====
// 화면 글자: data/ui.json(한국어) → UI.ko. 번역은 stories/i18n/<언어>/ui.json → UI[언어] (빠진 열쇠는 한국어)
// 이야기 글: stories/i18n/<언어>/<책>.json 의 { "JSON 경로": "번역" } 을 책을 열 때 덮어쓴다.
//   덮어쓴 자리의 한국어 원문은 '~열쇠' 에 남긴다: 「한국어도 보기」와 선생님 화면 기록(늘 한국어)에 쓴다
// 이후의 이야기 시작: stories/i18n/<언어>/starters.json 의 { "번호.title": "번역", "번호.who": …, "번호.text": … }
//   번역 틀 만들기: python3 tools/i18n.py export vi  (빠진 줄 세기: python3 tools/i18n.py check vi)
const LANGS = [['ko', '한국어', 'ko-KR'], ['vi', 'Tiếng Việt', 'vi-VN'], ['ru', 'Русский', 'ru-RU'], ['zh', '中文', 'zh-CN']];
const UI = { ko: UI_KO };
for (const [c] of LANGS) if (c !== 'ko') UI[c] = (STORY_I18N[c] || {}).ui || {};
// 네 권 가운데 한 권이라도 번역이 있으면 고를 수 있다
const langReady = code => code === 'ko' || ['book1', 'book2', 'book3', 'book4'].some(b => Object.keys((STORY_I18N[code] || {})[b] || {}).length > 0);
let LANG = langReady(save.set.lang) ? save.set.lang : 'ko';
const langName = c => (LANGS.find(l => l[0] === c) || LANGS[0])[1];
// t('feelRight', { name }) : {name} 자리에 값을, 한국어일 때 {name은} {name과} 는 받침에 맞는 조사까지 붙인다
const t = (key, v) => {
  let s = UI[LANG] && typeof UI[LANG][key] === 'string' && UI[LANG][key] ? UI[LANG][key] : UI.ko[key];
  if (typeof s !== 'string') return key;
  if (v) s = s.replace(/\{(\w+)(은|과)?\}/g, (m, k, p) => (v[k] == null ? m : !p || LANG !== 'ko' ? String(v[k]) : p === '은' ? v[k] + topic(v[k]) : withP(v[k])));
  return s;
};
// 「이후의 이야기」 글자 수: server/core.js 의 storyChars 와 같게 (로마자·키릴 문자는 두 자를 한 자로)
const storyChars = s => Math.round([...String(s || '').replace(/\s/g, '')].reduce((n, c) => n + (/[\p{Script=Latin}\p{Script=Cyrillic}]/u.test(c) ? 0.5 : 1), 0));
// 서버가 보낸 한국어 알림을 고른 언어로 (모르는 알림은 그대로)
function srvMsg(m) {
  if (LANG === 'ko' || !m) return m;
  const d = (UI[LANG].srv || {})[m];
  if (d) return d;
  let r;
  if ((r = /^코드를 너무 많이 넣었어요\. (\d+)분 뒤에/.exec(m))) return t('srvTooMany', { n: r[1] });
  if ((r = /^(\d+)자 넘게 써 주세요\.$/.exec(m))) return t('srvMinChars', { n: r[1] });
  if ((r = /^(\d+)자 안으로 줄여 주세요\.$/.exec(m))) return t('srvMaxChars', { n: r[1] });
  return m;
}
// 보라 수첩 그림 속 글씨: 정해진 줄은 ui.json 의 note, 그 밖의 이야기 글(고른 역할 등)은 지금 책 번역에서 찾는다
const noteT = s => (LANG === 'ko' ? s : (UI[LANG].note || {})[s] || (BOOK && BOOK.ko2tr && BOOK.ko2tr[s]) || s);
const canvasFont = () => (LANG === 'vi' || LANG === 'ru' ? 'Nunito, Jua, sans-serif' : LANG === 'zh' ? '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif' : 'Jua, "Apple SD Gothic Neo", sans-serif');
// 책 데이터에 번역 덮어쓰기: 경로는 "scenes.s01.panels.0.cap" 처럼 점으로 잇는다
function applyLang(book) {
  const over = LANG === 'ko' ? null : (STORY_I18N[LANG] || {})[book.id];
  if (!over) return book;
  const copy = JSON.parse(JSON.stringify(book));
  copy.ko2tr = {};
  for (const [p, v] of Object.entries(over)) {
    const keys = p.split('.');
    let o = copy;
    for (let i = 0; i < keys.length - 1 && o; i++) o = o[keys[i]];
    const k = keys[keys.length - 1];
    if (o && typeof o[k] === 'string' && typeof v === 'string' && v) { o['~' + k] = o[k]; copy.ko2tr[o[k]] = v; o[k] = v; }
  }
  return copy;
}
// 한국어 원문 (선생님 화면 기록용). 번역하지 않은 글은 그대로
const ko = (o, k) => (o && o['~' + k] != null ? o['~' + k] : o && o[k]);
// 「한국어도 보기」: 번역 아래에 작게 붙이는 한국어 원문
const showKo = () => LANG !== 'ko' && !!save.set.both;
function koSub(o, k, tag = 'span') {
  const s = showKo() && o && o['~' + k];
  if (!s) return null;
  const e = h(tag, 'ko', s);
  e.lang = 'ko';
  return e;
}
const withKo = (node, o, k) => { const s = koSub(o, k); if (s) node.appendChild(s); return node; };
// 책을 열지 않고 번역된 글 하나 (책장의 제목, 이어 보기 자리 이름)
const trOf = (bookId, path) => (LANG === 'ko' ? null : ((STORY_I18N[LANG] || {})[bookId] || {})[path] || null);
const bookTitle = id => trOf(id, 'title') || STORIES[id].title;
const bookSub = id => trOf(id, 'sub') || STORIES[id].sub;
const placeOf = (id, res) => trOf(id, `scenes.${res.scene}.place`) || res.place;
const starterT = (st, k) => (LANG === 'ko' ? st[k] : ((STORY_I18N[LANG] || {}).starters || {})[`${st.id}.${k}`] || st[k]);
// 처음부터 쪽에 있는 고정 글자 (머리 막대, 멈춤 창, 단추 이름표, 안내)
function applyStatic() {
  const root = document.documentElement;
  root.lang = LANG;
  document.title = t('appTitle');
  const lab = (sel, key) => { const e = $(sel); if (e) e.setAttribute('aria-label', t(key)); };
  lab('#btnHome', 'homeBtn');
  $('#btnHome').title = t('homeBtn');
  lab('#btnPause', 'pauseBtn');
  lab('#btnSet', 'settings');
  lab('.stage', 'stageLabel');
  lab('#cast', 'castLabel');
  lab('#pause .card', 'pauseLabel');
  const [a, b] = t('hint').split('{?}');
  $('#hint').replaceChildren(a, h('b', '', '?'), b || '');
  $('#btnPrev').lastChild.textContent = ' ' + t('prev');
  $('#pause h2').textContent = t('pauseTitle');
  $('#pause p').textContent = t('pauseBody');
  $('#btnResume').textContent = t('resumeBtn') + ' ›';
  if (!$('#loading').hidden && !$('#loading').dataset.err) $('#loading').textContent = t('loading');
  for (const [v, key] of [['--t-real', 'cssReal'], ['--t-mine', 'cssMine'], ['--t-go', 'cssGo']]) root.style.setProperty(v, JSON.stringify(t(key)));
}
applyStatic();
