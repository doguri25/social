// 예시 학생 다섯 명: 선생님 화면을 미리 둘러볼 수 있게, 읽은 정도가 서로 다른 학생과 답·이후의 이야기를 만든다.
// 명단에는 demo: true 로 표시하고, 「예시 학생 지우기」는 이 학생들과 그 기록만 지운다.
'use strict';
const { newCode } = require('./core');

const DAY = 86400000;
const PEOPLE = [
  { alias: '예시-햇살', read: ['book1', 'book2', 'book3', 'book4'], story: 0 },
  { alias: '예시-구름', read: ['book1', 'book2', 'book3', 'book4'], story: 1 },
  { alias: '예시-단풍', read: ['book1', 'book2', 'book3'] },
  { alias: '예시-바람', read: ['book1'], resume: { book: 'book2', scene: 's08', place: '화요일 · 연습 시간' } },
  { alias: '예시-별빛', read: [] },
];
const ENDINGS = { book1: 'palm', book2: 'busy', book3: 'clap', book4: 'board' };
const TITLES = { book1: '손바닥이 모이면', book2: '다시 북적거리는 옆자리', book3: '다시 박수 같은 웃음', book4: '우리 반 작전판' };
// 책마다 쌓이는 답 몇 가지 (실제 이야기의 물음과 같은 글)
const ANSWERS = {
  book1: [
    ['choice', 's02', '서아가 수첩을 펴며 작전을 물어요. 유나는 어떻게 할까요?', '「간단해. 공을 잡으면 무조건 나한테 줘!」'],
    ['choice', 's05', '얼굴이 뜨겁고 주먹에 힘이 들어가요. 유나는 지우에게 어떻게 할까요?', '지우를 가리키며 「너 때문에 졌잖아!」'],
    ['feel', 's05b', '아무 말도 하지 못한 지우는 어떤 마음일까요?', '서운함'],
    ['choice', 's12', "'너희 때문에'라는 말이 목까지 올라왔어요. 유나는 어떻게 할까요?", '수돗가로 가서 숨을 고른다'],
    ['compose', 's15', '지우에게 무슨 말을 할까요? 하고 싶은 말을 모두 골라 보세요.', '지우야. 애들 앞에서 너 때문에 졌다고 해서 미안해. / 내가 못했다는 말을 듣기 싫어서 네 탓을 했어.'],
    ['ending', 's17', '너 때문에', '손바닥이 모이면'],
  ],
  book2: [
    ['signals', 's04', '유나가 가리켰을 때, 지우 몸은 어디에서 신호를 보냈을까요?', '귀, 목, 가슴'],
    ['choice', 's06', '엄마가 「오늘 피구 어땠어?」 하고 물어요. 지우는 뭐라고 할까요?', '「그냥.」'],
    ['feel', 's13', '월요일의 뜨거운 귀와 금요일의 뜨거운 귀는 같은 마음일까요?', '부끄러움'],
    ['ending', 's13c', '두 팔을 벌린 지우는', '다시 북적거리는 옆자리'],
  ],
  book3: [
    ['sort', 's06', '월요일의 민준이 마음(감정)과 민준이가 한 일(행동)을 두 바구니에 나눠 담아 보세요.', '이야기와 같게 넣은 카드 6 / 7'],
    ['feel', 's05', '「너 때문이지!」 밑에 숨은 민준이의 진짜 마음은 무엇일까요?', '부끄러움'],
    ['choice', 's12', '「봐, 혼자 하니까 지지!」가 입까지 올라왔어요. 마음 리모컨의 어떤 단추를 누를까요?', '⏸ 멈춤: 숨을 크게 들이쉰다'],
    ['ending', 's14', '춤을 춘 민준이는', '다시 박수 같은 웃음'],
  ],
  book4: [
    ['choice', 's07', '「나중에.」라는 말을 들었어요. 서아는 어떻게 할까요?', "수첩 맨 뒷장에 '나중에'라고 적는다"],
    ['role', 's15', '우리 반이 작전판을 만든다면, 나는 어떤 역할을 맡고 싶나요?', '이름 크게 부르기'],
    ['ending', 's15', '수첩을 닫은 서아는', '우리 반 작전판'],
  ],
};
const STORIES = [
  '나는 서아 자리로 걸어갔어요. "서아야, 수첩 어디 갔어?" 서아는 고개를 숙인 채 작게 말했어요. "집에 두고 왔어. 이번엔 작전을 못 적을 것 같아." 서아 목소리가 빗방울처럼 작았어요. 예전의 나라면 "괜찮아, 내가 다 정할게!" 하고 말했을 거예요. 그런데 나는 숨을 한 번 고르고 말했어요. "그럼 이번에는 우리가 서아 대신 하나씩 기억하자." 민준이는 이름 부르기를, 지우는 받기 작전을, 나는 패스할 자리를 맡았어요. 다음 날 서아가 수첩을 가져왔을 때, 우리는 기억한 작전을 한 줄씩 불러 주었어요. 서아의 수첩이 다시 작전판이 되었어요. 이번에는 우리 모두의 목소리로요.',
  '지우는 하람이 옆에 쪼그려 앉았어요. "괜찮아? 나도 월요일에 공이 무서웠어." 하람이가 눈을 떴어요. 눈동자가 겁먹은 토끼처럼 흔들렸어요. 나는 뒤를 돌아보았어요. "쟤 때문에"라고 말한 친구가 고개를 숙이고 있었어요. 화가 났지만, 나는 손바닥부터 펴 보았어요. 땀이 조금 났어요. "하람이는 처음이라 그래. 우리도 처음엔 다 그랬잖아." 그날 쉬는 시간, 우리는 하람이에게 공 받는 법을 알려 주었어요. 민준이가 이름을 크게 불러 주고, 유나는 천천히 공을 던져 주었어요. 하람이가 처음으로 공을 받았을 때, 우리 반 모두가 손바닥을 맞부딪쳤어요.',
];

function makeDemo(roster, used = []) {
  const taken = new Set([...roster.map(s => s.no), ...used]), codes = new Set(roster.map(s => s.code));
  const now = Date.now();
  let no = 91;
  return {
    students: PEOPLE.map((p, i) => {
      while (taken.has(no)) no++;
      taken.add(no);
      const code = newCode(codes);
      codes.add(code);
      const books = {}, resume = {}, answers = [];
      p.read.forEach((id, k) => {
        books[id] = { endings: [ENDINGS[id]], feels: {}, acts: {}, role: id === 'book4' ? '이름 크게 부르기' : '' };
        ANSWERS[id].forEach(([kind, scene, q, a], j) => answers.push({ no, book: id, scene, kind, q, a: kind === 'ending' ? TITLES[id] : a, t: now - (4 - k) * DAY + j * 60000 + i * 1000 }));
      });
      if (p.resume) resume[p.resume.book] = { scene: p.resume.scene, place: p.resume.place, flags: {}, trail: [], at: now - DAY };
      const story = p.story == null ? null : {
        no, text: STORIES[p.story], starter: p.story === 0 ? 0 : 1, at: now - 3600000, versions: 1, ai: null,
        teacher: p.story === 0 ? { scores: { link: 3, main: 2, sense: 3, heart: 3 }, comment: "'빗방울처럼 작은 목소리'가 서아 마음을 잘 보여 줘요. 중심 문장을 맨 앞에 한 번 더 또렷하게 써 보면 더 좋겠어요.", at: now - 1800000 } : null,
      };
      const entry = { no, alias: p.alias, code, demo: true };
      no++;
      return { no: entry.no, entry, progress: { no: entry.no, books, resume, at: now - (5 - i) * 3600000 }, answers, story };
    }),
  };
}

module.exports = { makeDemo, STORIES };
