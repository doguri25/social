// ===== 언어: 첫 화면에서 고른다. 지금은 한국어만 채워져 있고, 다른 언어는 글을 넣으면 바로 켜진다 =====
// 화면 글자: UI[언어][열쇠] (없으면 한국어). 이야기 글: stories/i18n/<언어>/<책>.json 의 { "JSON 경로": "번역" } 을 책을 열 때 덮어쓴다
//   번역 틀 만들기: python3 tools/i18n.py export vi   →  stories/i18n/vi/book1.json … (값을 번역으로 바꿔 넣기)
const LANGS = [['ko', '한국어', 'ko-KR'], ['vi', 'Tiếng Việt', 'vi-VN'], ['ru', 'Русский', 'ru-RU'], ['zh', '中文', 'zh-CN']];
const UI = {
  ko: {
    gateTitle: '마음 극장', gateSub: '3D 무대와 웹툰으로 읽는 사회정서 그림책', code: '접속 코드', codeHint: '선생님이 준 여섯 글자 코드를 넣거나, QR 코드를 찍어요.', enter: '들어가기',
    guest: '로그인 없이 하기', guestNote: '진행과 답은 이 기기(브라우저)에만 저장되고 서버로 보내지 않아요.', teacher: '선생님 화면',
    privacy: '학급 접속으로 들어오면 서버에 번호와 가명(선생님이 정함), 읽은 결말과 이어 볼 자리, 고른 답, 「이후의 이야기」 글만 저장해요. 실명·사진·위치·연락처는 저장하지 않아요.',
    noServer: '이 주소에서는 「로그인 없이 하기」만 할 수 있어요. 학급 기록을 남기려면 아래 주소로 들어오세요.', soon: '준비 중', lang: '언어',
  },
  vi: {}, ru: {}, zh: {},
};
// 이 언어로 번역된 이야기나 화면 글자가 하나라도 있으면 고를 수 있다
const langReady = code => code === 'ko' || Object.keys(STORY_I18N[code] || {}).length > 0 || Object.keys(UI[code] || {}).length > 0;
let LANG = langReady(save.set.lang) ? save.set.lang : 'ko';
const t = key => (UI[LANG] && UI[LANG][key]) || UI.ko[key] || key;
// 책 데이터에 번역 덮어쓰기: 경로는 "scenes.s01.panels.0.cap" 처럼 점으로 잇는다
function applyLang(book) {
  const over = (STORY_I18N[LANG] || {})[book.id];
  if (!over) return book;
  const copy = JSON.parse(JSON.stringify(book));
  for (const [p, v] of Object.entries(over)) {
    const keys = p.split('.');
    let o = copy;
    for (let i = 0; i < keys.length - 1 && o; i++) o = o[keys[i]];
    if (o && typeof o[keys[keys.length - 1]] === 'string' && typeof v === 'string' && v) o[keys[keys.length - 1]] = v;
  }
  return copy;
}
