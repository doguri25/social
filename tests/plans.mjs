// 브라우저 시험에서 결말마다 고르는 방법: 장면별 갈림길 번호(없으면 0), 말 조각 고르기, 「내가 고른 길」 정류장 최소 수
const B1 = { s02: 1, s05: 1, s08: 1 }; // 1권 원작 길: 「나한테 줘」, 「너 때문에」, 「나중에」
export const PLANS = {
  book1: {
    palm: { choice: { ...B1, s12: 0, s16: 0 }, pieces: t => !/근데|됐지/.test(t), stops: 6 },
    pass: { choice: { ...B1, s12: 1, s16: 1 }, pieces: t => /애들 앞에서/.test(t), stops: 6 },
    finger: { choice: { ...B1, s12: 2, s16: 2 }, pieces: t => /됐지|근데/.test(t), stops: 6 },
    start: { choice: { s02: 0, s05: 0, s06e: 1 }, pieces: () => true, stops: 4 },
    thu: { choice: { s02: 1, s05: 1, s08: 0 }, pieces: () => true, stops: 4 },
  },
  book2: {
    name: { choice: { s06: 0 }, pieces: () => true, stops: 4 },
    seoa: { choice: { s06: 1, s08r: 0 }, pieces: () => true, stops: 6 },
    busy: { choice: { s06: 1, s08: 0, s08r: 1, s09: 1, s11: 2 }, pieces: t => !/그냥|몰라|때문이야/.test(t), stops: 8 },
    half: { choice: { s06: 2, s08: 1, s08r: 1, s09: 2, s11: 1 }, pieces: t => /목에|그냥/.test(t), stops: 8 },
    tangle: { choice: { s06: 1, s08r: 1 }, pieces: t => /그냥|몰라/.test(t), stops: 8 },
  },
  book3: {
    three: { choice: { s02: 0, a08: 0 }, pieces: () => true, stops: 3 },
    walk: { choice: { s02: 1, s09: 0, b09h: 0 }, pieces: () => true, stops: 6 },
    clap: { choice: { s02: 1, s04: 0, s08: 0, s09: 1, s12: 0 }, pieces: t => !/지지|엉덩이춤|시키는 대로|먼저 미안하다고/.test(t), stops: 8 },
    fast: { choice: { s02: 1, s04: 1, s08: 1, s09: 2, s12: 1 }, pieces: t => /이름을 크게|지지/.test(t), stops: 8 },
    drawer: { choice: { s02: 2, s04: 2, s08: 2, s09: 1, s12: 2 }, pieces: t => /지지|엉덩이춤/.test(t), stops: 8 },
  },
  book4: {
    first3: { choice: { s02: 0, r1d: 0, s08: 0, s11: 0 }, pieces: t => /끝까지 말하기/.test(t), stops: 6 },
    notalone: { choice: { s02: 1, s04: 0, s07: 0, r2a: 0, s08: 0, s11: 0 }, pieces: t => /끝까지 말하기/.test(t), stops: 9 },
    board: { choice: { s02: 1, s04: 0, s07: 1, s08: 0, s11: 0 }, pieces: t => /끝까지 말하기/.test(t), stops: 8 },
    late: { choice: { s02: 1, s04: 0, s07: 1, s08: 0, s11: 1 }, pieces: t => /끝까지 말하기/.test(t), stops: 8 },
    later: { choice: { s02: 1, s04: 0, s07: 1, s08: 0, s11: 0 }, pieces: t => /아예 안 보여/.test(t), stops: 8 },
  },
};
