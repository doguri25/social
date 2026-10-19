// ===== 옆 칸 아래: 할 일 (둘러보기, 갈림길, 만약에, 마음 살피기, 말 고르기, 숨 고르기, 결말, 내가 고른 길) =====
const askEl = $('#ask');
const EMO = [['joy', '기쁨'], ['sad', '슬픔'], ['angry', '화남'], ['worried', '걱정'], ['surprised', '놀람'], ['shy', '부끄러움'], ['hurt', '서운함'], ['calm', '편안함']];
let askBuild = null, askKind = 'tip', timerT = 0;
function btn(text, cls, onClick) { const b = h('button', cls, text); b.type = 'button'; b.addEventListener('click', onClick); return b; }
const svg = d => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = d; return s; };
const ICON = { // innerHTML 에는 이 고정된 그림만 넣는다
  spark: '<g stroke="#f2a33a" stroke-width="2.6" stroke-linecap="round"><path d="M6 15 3 18"/><path d="M8 9 4 8"/><path d="M12 6 12 2"/></g>',
  heart: '<path fill="#f07c7c" d="M12 21s-7.5-4.6-9.4-9.3C1.2 8.3 3.3 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.7 0 5.8 3.8 4.4 7.2C19.5 16.4 12 21 12 21z"/>',
};
function heading(text, icon) { const t = h('h2', '', text); if (icon) t.appendChild(svg(ICON[icon])); return t; }
// 할 일 칸을 다시 그린다. 지난 컷을 보는 중이면 안내만
function setAsk(kind, build) { askKind = kind; askBuild = build; renderAsk(); }
function renderAsk() {
  const past = hi < hist.length - 1;
  askEl.dataset.kind = past ? 'past' : askKind;
  if (past) askEl.replaceChildren(h('h2', '', '지난 컷을 보고 있어요'), h('p', '', '「다음」을 누르면 지금 컷으로 돌아와요.'));
  else askEl.replaceChildren(...(askBuild ? askBuild() : [h('h2', '', '둘러보기'), h('p', '', '무대를 끌어서 돌려 보고, 노란 ? 나 친구를 눌러 보세요.')]));
  fitSide();
}
function focusFirst(sel) { setTimeout(() => { const b = askEl.querySelector(sel); if (b) b.focus({ preventScroll: true }); }, 60); }
// 할 일이 끝나면 칸을 둘러보기로 되돌린다
const doneAsk = () => { clearInterval(timerT); setAsk('tip', null); setNext(null); };

// 함께 보기(전자칠판)에서만: 선생님 질문과 생각 시간
function teachBox(ask) {
  if (!save.set.cls || !ask) return null;
  const box = h('div', 'teach');
  const out = h('span', 'tleft', '');
  const tm = h('div', 'timer');
  [30, 60, 90].forEach(sec => tm.appendChild(btn(`생각 시간 ${sec}초`, 'chip', () => {
    clearInterval(timerT);
    let left = sec;
    out.textContent = `${left}초`;
    timerT = setInterval(() => {
      left--;
      out.textContent = left > 0 ? `${left}초` : '시간 끝';
      if (left <= 0) { clearInterval(timerT); sfx('soft'); }
    }, 1000);
  })));
  tm.appendChild(out);
  box.append(h('b', '', '선생님 질문'), h('p', '', ask), tm);
  return box;
}
function tally() {
  const t = h('div', 'tally');
  const out = h('output', '', '0');
  let n = 0;
  const step = (txt, d, label) => { const b = btn(txt, 'chip', () => { n = Math.max(0, n + d); out.textContent = n; }); b.setAttribute('aria-label', label); return b; };
  const row = h('div', 'row');
  row.append(step('−', -1, '손든 사람 빼기'), out, step('+', 1, '손든 사람 더하기'));
  t.append(row, h('small', '', '손든 사람'));
  return t;
}

// 장면 첫머리: 무대를 둘러보고 「이야기 보기」
function askIntro(sc) {
  return waitFor(done => {
    titleCard(sc);
    setAsk('intro', () => {
      const tip = asList(sc.explore).length ? '노란 ? 를 눌러 무대를 살펴보고, 준비되면 「이야기 보기」를 눌러요.' : '무대를 끌어서 돌려 보고, 준비되면 「이야기 보기」를 눌러요.';
      return [heading('무대를 둘러봐요'), h('p', '', tip)];
    });
    setNext(() => done(), '이야기 보기');
    return doneAsk;
  });
}
// 갈림길과 만약에: 번호를 붙여 반 친구들과 「2번!」처럼 말하기 쉽게
function askChoice(spec, kind) {
  return waitFor(done => {
    setAsk(kind, () => {
      const out = [h('div', 'eyebrow', kind === 'whatif' ? '나라면 어떻게 할까?' : '갈림길'), heading(spec.q, kind === 'whatif' ? 'spark' : null)];
      const tb = teachBox(spec.ask);
      if (tb) out.push(tb);
      const list = h('div', 'opts');
      spec.opts.forEach((o, i) => {
        const row = h('div', 'opt-row');
        const b = btn('', 'opt ' + ['', 'pink', 'sky'][i % 3], () => { sfx('pick'); done(i); });
        b.append(h('span', 'ico', String(i + 1)), h('span', '', o.text));
        row.appendChild(b);
        if (save.set.cls) row.appendChild(tally());
        list.appendChild(row);
      });
      out.push(list);
      return out;
    });
    setNext(null);
    focusFirst('.opt');
    speak(spec.q);
    return doneAsk;
  });
}
// 마음 살피기: 감정 카드 여덟 장 가운데 하나를 고르면 그 인물의 진짜 마음이 열린다
function askFeel(spec) {
  const who = BOOK.castById[spec.who];
  return waitFor(done => {
    let picked = null;
    setAsk('feel', () => {
      const out = [h('div', 'eyebrow', '마음 살피기'), heading(spec.q, 'heart')];
      const tb = teachBox(spec.ask);
      if (tb) out.push(tb);
      const grid = h('div', 'emos');
      EMO.forEach(([k, name]) => {
        const b = btn('', 'emo', () => {
          picked = k;
          sfx('pick');
          setNext(() => done(k), '계속');
          renderAsk();
          speak(lead() + ' ' + spec.reveal);
        });
        b.disabled = !!picked;
        if (picked) { b.classList.toggle('mine', k === picked); b.classList.toggle('real', spec.is.includes(k)); }
        const img = new Image();
        img.src = faceIcon(k);
        img.alt = '';
        b.append(img, h('span', '', name));
        grid.appendChild(b);
      });
      out.push(grid);
      if (picked) {
        const box = h('div', 'reveal');
        box.append(h('p', '', lead()), h('p', 'say', spec.reveal));
        out.push(box);
      }
      return out;
    });
    const lead = () => (spec.is.includes(picked) ? `맞아요, ${who.name}${topic(who.name)} 이런 마음이었대요.` : `그렇게 느낄 수도 있어요. ${who.name}${topic(who.name)} 이런 마음이었대요.`);
    setNext(null);
    focusFirst('.emo');
    speak(spec.q);
    return doneAsk;
  });
}
// 하고 싶은 말 여러 개 고르기. 보여 주는 순서는 섞고, 말하는 순서는 이야기 순서대로
function askCompose(spec, pieces) {
  return waitFor(done => {
    const picked = new Set();
    const order = pieces.slice().sort(() => Math.random() - 0.5);
    const arm = () => setNext(picked.size >= (spec.min || 1) ? () => { sfx('pick'); done(pieces.filter(pc => picked.has(pc))); } : null, spec.write ? '이렇게 적기' : '이렇게 말하기');
    setAsk('compose', () => {
      const out = [h('div', 'eyebrow', spec.write ? '수첩에 적을 줄 고르기' : '하고 싶은 말 고르기'), heading(spec.q)];
      const tb = teachBox(spec.ask);
      if (tb) out.push(tb);
      const list = h('div', 'pieces');
      order.forEach(pc => {
        const b = btn(pc.text, 'piece', () => {
          if (picked.has(pc)) picked.delete(pc); else picked.add(pc);
          b.setAttribute('aria-pressed', picked.has(pc));
          sfx('tap');
          arm();
        });
        b.setAttribute('aria-pressed', picked.has(pc));
        list.appendChild(b);
      });
      out.push(list);
      return out;
    });
    arm();
    focusFirst('.piece');
    speak(spec.q);
    return doneAsk;
  });
}
// 숨 고르기: 동그라미를 누르고 있으면 들이쉬기(커짐), 떼면 내쉬기(작아짐). 세 번
function breathe() {
  const WORDS = ['한 번', '두 번', '세 번'];
  return waitFor(done => {
    const ring = h('div', 'bring'), msg = h('div', 'bmsg'), dotsEl = h('div', 'bdots');
    const dots = [0, 1, 2].map(() => dotsEl.appendChild(h('i', 'bdot')));
    ring.setAttribute('role', 'button');
    ring.tabIndex = 0;
    ring.setAttribute('aria-label', '누르고 있으면 숨 들이쉬기, 떼면 내쉬기');
    const wrap = h('div', 'breathe');
    wrap.append(h('div', 'eyebrow', '숨 고르기'), ring, msg, dotsEl);
    actView = () => storyEl.replaceChildren(wrap);
    actView();
    let n = 0, holding = false, phase = 'idle', t0 = 0, raf = 0, scale = 1;
    const setScale = s => { scale = s; ring.style.transform = `scale(${s})`; };
    const grow = () => { if (!holding) return; setScale(1 + 0.6 * Math.min(1, (performance.now() - t0) / 3000)); raf = requestAnimationFrame(grow); };
    const down = e => {
      if (phase !== 'idle' || n >= 3) return;
      if (e.preventDefault) e.preventDefault();
      holding = true; phase = 'in'; t0 = performance.now();
      msg.textContent = '들이쉬기…';
      grow();
    };
    const up = () => {
      if (!holding) return;
      holding = false;
      cancelAnimationFrame(raf);
      if (performance.now() - t0 < 900) { phase = 'idle'; setScale(1); msg.textContent = '조금 더 길게 눌러 볼까요?'; return; }
      phase = 'out'; t0 = performance.now();
      msg.textContent = '천천히 내쉬기… 후—';
      const s0 = scale;
      const shrink = () => {
        const k = Math.min(1, (performance.now() - t0) / 2600);
        setScale(s0 + (1 - s0) * k);
        if (k < 1) { raf = requestAnimationFrame(shrink); return; }
        dots[n].classList.add('on');
        msg.textContent = WORDS[n];
        n++;
        phase = 'idle';
        sfx('soft');
        if (n >= 3) { msg.textContent = '한 번, 두 번, 세 번. 잘했어요.'; setTimeout(() => done(), 1100); }
      };
      shrink();
    };
    const kd = e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) down(e); };
    const ku = e => { if (e.key === ' ' || e.key === 'Enter') up(); };
    msg.textContent = '동그라미를 꾹 누르고 있으면 숨을 들이쉬어요.';
    setAsk('breathe', () => {
      const row = h('div', 'btnrow');
      row.appendChild(btn('건너뛰기', 'sbtn skip', () => done()));
      return [heading(`${withP(narrator().name)} 함께 숨을 쉬어 봐요`), h('p', '', '얼굴이 뜨겁고 가슴이 쿵쿵할 때 해 보는 숨 고르기예요.'), row];
    });
    setNext(null);
    ring.addEventListener('pointerdown', down);
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
    ring.addEventListener('keydown', kd);
    ring.addEventListener('keyup', ku);
    setTimeout(() => ring.focus({ preventScroll: true }), 60);
    speak(`${withP(narrator().name)} 함께 숨을 쉬어 봐요. 동그라미를 꾹 누르고 있으면 숨을 들이쉬어요.`);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', up);
      actView = null;
      doneAsk();
    };
  });
}

// ---- 권마다 하나씩 더한 활동: 몸 신호 찾기(signals), 마음·행동 바구니(sort), 작전판 역할 고르기(role) ----
// 몸 그림: 고른 부분마다 data-part. innerHTML 에는 이 고정된 그림만 넣는다
const BODY = { ears: '귀', face: '얼굴', lips: '입술', throat: '목', heart: '가슴', belly: '배 속', shoulder: '어깨', palms: '손바닥', fingers: '손끝', legs: '다리', feet: '발' };
const BODY_SVG = `<g class="figure" fill="#ffe2cc" stroke="#3b302b" stroke-width="2.5">
<path d="M70 140 Q100 128 130 140 L136 205 Q100 214 64 205 Z" fill="#c7b2e6"/>
<path d="M70 146 Q52 170 50 204" fill="none" stroke-width="12" stroke="#c7b2e6"/><path d="M130 146 Q148 170 150 204" fill="none" stroke-width="12" stroke="#c7b2e6"/>
<circle cx="100" cy="72" r="56"/><path d="M45 74 Q40 14 100 15 Q160 14 155 74 Q150 46 128 40 Q100 52 66 42 Q50 50 45 74Z" fill="#4a3326"/></g>
<g data-part="ears"><circle cx="43" cy="78" r="11"/><circle cx="157" cy="78" r="11"/></g>
<g data-part="face"><circle cx="72" cy="88" r="10"/><circle cx="128" cy="88" r="10"/></g>
<g data-part="lips"><ellipse cx="100" cy="104" rx="12" ry="6"/></g>
<g data-part="throat"><rect x="89" y="126" width="22" height="12" rx="4"/></g>
<g data-part="shoulder"><circle cx="70" cy="144" r="9"/><circle cx="130" cy="144" r="9"/></g>
<g data-part="heart"><path d="M112 160 c-6-8-18-4-14 6 l14 12 l14-12 c4-10-8-14-14-6z"/></g>
<g data-part="belly"><ellipse cx="100" cy="190" rx="18" ry="9"/></g>
<g data-part="palms"><circle cx="50" cy="210" r="10"/><circle cx="150" cy="210" r="10"/></g>
<g data-part="fingers"><circle cx="46" cy="226" r="6"/><circle cx="154" cy="226" r="6"/></g>
<g data-part="legs"><rect x="80" y="210" width="15" height="36" rx="6"/><rect x="105" y="210" width="15" height="36" rx="6"/></g>
<g data-part="feet"><ellipse cx="86" cy="252" rx="11" ry="6"/><ellipse cx="114" cy="252" rx="11" ry="6"/></g>`;
// spec: { who, q, parts: 이야기 속 신호가 난 곳, reveal, ask }. 그림이나 낱말 단추로 고르고 「다 찾았어요」를 누르면 이야기 속 신호를 보여 준다
function askSignals(spec) {
  const who = BOOK.castById[spec.who];
  return waitFor(done => {
    const picked = new Set();
    let shown = false;
    const fig = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    fig.setAttribute('viewBox', '0 0 200 262');
    fig.setAttribute('class', 'body');
    fig.setAttribute('role', 'img');
    fig.setAttribute('aria-label', `${who.name} 몸 그림`);
    fig.innerHTML = BODY_SVG;
    const wrap = h('div', 'bodywrap');
    wrap.append(h('div', 'eyebrow', `${who.name} 몸이 보낸 신호`), fig);
    actView = () => storyEl.replaceChildren(wrap); // 「이전」으로 컷을 보고 돌아와도 몸 그림이 다시 나오게
    actView();
    rise();
    const update = () => {
      fig.querySelectorAll('[data-part]').forEach(g => {
        g.classList.toggle('on', picked.has(g.dataset.part));
        g.classList.toggle('real', shown && spec.parts.includes(g.dataset.part));
      });
      renderAsk();
      if (shown) setNext(() => done([...picked]), '계속');
      else setNext(picked.size ? () => { shown = true; sfx('pick'); update(); speak(spec.reveal); } : null, '다 찾았어요');
    };
    const toggle = k => {
      if (shown) return;
      const at = [...askEl.querySelectorAll('.bodychip')].indexOf(document.activeElement); // 다시 그려도 누르던 단추에 머물게
      if (picked.has(k)) picked.delete(k); else picked.add(k);
      sfx('tap');
      update();
      if (at >= 0) askEl.querySelectorAll('.bodychip')[at].focus({ preventScroll: true });
    };
    fig.querySelectorAll('[data-part]').forEach(g => g.addEventListener('click', () => toggle(g.dataset.part)));
    setAsk('signals', () => {
      const out = [h('div', 'eyebrow', '몸 신호 찾기'), heading(spec.q, 'heart')];
      const tb = teachBox(spec.ask);
      if (tb) out.push(tb);
      const chips = h('div', 'bodychips');
      Object.entries(BODY).forEach(([k, name]) => {
        const b = btn(name, 'bodychip', () => toggle(k));
        b.setAttribute('aria-pressed', picked.has(k));
        if (shown) { b.disabled = true; b.classList.toggle('real', spec.parts.includes(k)); }
        chips.appendChild(b);
      });
      out.push(chips);
      if (shown) {
        const box = h('div', 'reveal');
        box.append(h('p', '', `${who.name} 몸은 이렇게 신호를 보냈대요: ${spec.parts.map(k => BODY[k]).join(', ')}.`), h('p', 'say', spec.reveal));
        out.push(box);
      }
      return out;
    });
    update();
    focusFirst('.bodychip');
    speak(spec.q);
    return () => { actView = null; doneAsk(); };
  });
}
// spec: { q, items: [{ text, is: 'feel' | 'act' }], reveal, ask }. 한 장씩 바구니에 넣고, 다 넣으면 이야기 속 바구니로 다시 보여 준다
const BASKET = { feel: '마음 (감정)', act: '한 일 (행동)' };
const basketName = k => BASKET[k].replace(/ \(.*\)$/, '');
function askSort(spec) {
  return waitFor(done => {
    const put = [];
    const draw = () => {
      const wrap = h('div', 'baskets');
      ['feel', 'act'].forEach(k => {
        const col = h('div', 'basket ' + k);
        col.appendChild(h('b', '', BASKET[k]));
        const done2 = put.length === spec.items.length;
        put.forEach((p, i) => {
          const it = spec.items[i];
          if ((done2 ? it.is : p) !== k) return;
          const card = h('div', 'scard' + (done2 && p !== it.is ? ' moved' : ''), it.text);
          if (done2 && p !== it.is) card.appendChild(h('small', '', `처음엔 ${basketName(p)}에 넣었어요`));
          col.appendChild(card);
        });
        wrap.appendChild(col);
      });
      storyEl.replaceChildren(h('div', 'eyebrow', '마음과 행동 나누기'), wrap);
    };
    actView = draw;
    draw();
    rise();
    setAsk('sort', () => {
      const out = [h('div', 'eyebrow', '두 바구니에 나눠 담기'), heading(spec.q)];
      const tb = teachBox(spec.ask);
      if (tb) out.push(tb);
      if (put.length < spec.items.length) {
        out.push(h('p', 'scur', `「${spec.items[put.length].text}」`));
        const row = h('div', 'btnrow');
        ['feel', 'act'].forEach(k => row.appendChild(btn(BASKET[k], 'sbtn sortbtn', () => { put.push(k); sfx('tap'); draw(); renderAsk(); if (put.length === spec.items.length) { setNext(() => done(put.slice()), '계속'); speak(spec.reveal); } else focusFirst('.sortbtn'); })));
        out.push(row, h('p', '', `${put.length + 1} / ${spec.items.length}`));
      } else {
        const box = h('div', 'reveal');
        box.append(h('p', '', '이야기 속 바구니로 다시 담아 보았어요.'), h('p', 'say', spec.reveal));
        out.push(box);
      }
      return out;
    });
    setNext(null);
    focusFirst('.sortbtn');
    speak(spec.q);
    return () => { actView = null; doneAsk(); };
  });
}
// spec: { q, roles: [[id, 하는 일, 잘하는 것]], reveal, ask }. 고른 역할은 기록에 남고 수첩 그림(planme)에 들어간다
function askRole(spec) {
  return waitFor(done => {
    let pick = null;
    setAsk('role', () => {
      const out = [h('div', 'eyebrow', '작전판에 내 이름 넣기'), heading(spec.q)];
      const tb = teachBox(spec.ask);
      if (tb) out.push(tb);
      const list = h('div', 'opts');
      spec.roles.forEach(([id, text, good], i) => {
        const b = btn('', 'opt rolebtn ' + ['', 'pink', 'sky'][i % 3], () => {
          pick = id;
          bookRec(BOOK.id).role = text;
          store();
          sfx('pick');
          renderAsk();
          setNext(() => done(id), '계속');
          speak(spec.reveal);
        });
        b.append(h('span', 'ico', String(i + 1)), h('span', '', `${text} · ${good}`));
        b.disabled = !!pick && pick !== id;
        list.appendChild(b);
      });
      out.push(list);
      if (pick) { const box = h('div', 'reveal'); box.append(h('p', '', `작전판에 「나 · ${spec.roles.find(r => r[0] === pick)[1]}」가 들어갔어요.`), h('p', 'say', spec.reveal)); out.push(box); }
      return out;
    });
    setNext(null);
    focusFirst('.rolebtn');
    speak(spec.q);
    return doneAsk;
  });
}
const ACTS = { signals: askSignals, sort: askSort, role: askRole };
// ---- 생각 나누기: 결말 뒤에 이 책의 학습지 물음 ----
function talkCard() {
  return waitFor(done => {
    const card = h('div', 'endcard');
    const ol = h('ol', 'talk');
    BOOK.talk.forEach(q => ol.appendChild(h('li', '', q)));
    card.append(h('div', 'eyebrow', '생각 나누기'), h('h3', '', BOOK.title), ol);
    storyEl.replaceChildren(card);
    rise();
    setAsk('talk', () => {
      const row = h('div', 'btnrow');
      row.append(btn('결말로 돌아가기', 'sbtn primary', () => done()));
      return [heading('생각 나누기', 'spark'), h('p', '', '짝이나 모둠과 함께 이야기해 보세요. 정답은 없어요.'), row];
    });
    setNext(() => done(), '결말로');
    speak(BOOK.talk[0]);
    return doneAsk;
  });
}

// ---- 결말 카드: 옆 칸 위에 결말, 아래에 다음에 할 일 ----
const KIND = { good: '마음이 이어진 결말', okay: '보통 결말', sorry: '아쉬운 결말' };
function endingCard(end) {
  return waitFor(done => {
    resetHist();
    const rec = bookRec(BOOK.id);
    const card = h('div', 'endcard');
    const slots = h('div', 'slots');
    BOOK.endings.forEach(e => {
      const got = rec.endings.includes(e.id);
      const s = h('div', 'slot' + (got ? ' got' : '') + (e.id === end.id ? ' now' : ''));
      s.append(h('i', 'road ' + e.kind), h('span', '', got ? `${e.title} · ${KIND[e.kind]}` : '아직 못 본 결말'));
      slots.appendChild(s);
    });
    card.append(h('div', 'eyebrow', KIND[end.kind]), h('h3', '', end.title), h('p', 'countline', `본 결말 ${seenEnds(rec, BOOK)} / ${BOOK.endings.length}`), slots);
    storyEl.replaceChildren(card);
    rise();
    setAsk('ending', () => {
      const row = h('div', 'btnrow');
      row.append(
        btn('내가 고른 길 보기', 'sbtn primary', () => { sfx('tap'); done('review'); }),
        btn(trail.length && trail[trail.length - 1].type === 'compose' ? (BOOK.scenes[trail[trail.length - 1].scene].compose.write ? '다른 줄도 적어 보기' : '다른 말도 해 보기') : '마지막 갈림길로 돌아가기', 'sbtn', () => { sfx('tap'); done('retry'); }),
        btn('처음부터', 'sbtn', () => { sfx('tap'); done('restart'); }),
        btn('책장으로', 'sbtn', () => { sfx('tap'); done('shelf'); }),
      );
      if (BOOK.talk) row.prepend(btn('생각 나누기', 'sbtn primary', () => { sfx('tap'); done('talk'); }));
      if (BOOK.id === 'book4' && unlockedAfter()) row.prepend(btn('이후의 이야기 쓰기', 'sbtn primary', () => { sfx('pick'); done('after'); })); // 3차시: 곁이야기 3 다음에 바로 이어 쓰기
      return [heading('이야기를 다 읽었어요', 'heart'), h('p', '', '내가 고른 길을 돌아보거나, 다른 말을 골라 다른 결말을 만나 보세요.'), row];
    });
    setNext(() => done('review'), '내가 고른 길');
    focusFirst('.sbtn');
    return doneAsk;
  });
}
// ---- 내가 고른 길: 지나온 갈림길. 흐린 길을 누르면 그 장면에서 다르게 골라 본다 ----
function reviewCard() {
  return waitFor(done => {
    const path = h('div', 'path');
    trail.forEach((t, i) => {
      const sc = BOOK.scenes[t.scene];
      const stop = h('div', 'stop');
      const kind = t.type === 'whatif' ? '만약에' : t.type === 'compose' ? (sc.compose.write ? '수첩에 적은 줄' : '하고 싶은 말') : '갈림길';
      stop.append(h('div', 'kind', `${sc.place} · ${kind}`), h('p', 'sq', t.q));
      if (t.type === 'compose') {
        t.opts.forEach(o => stop.appendChild(h('div', 'alt mine', o)));
        stop.appendChild(btn('다른 말 골라 보기', 'sbtn', () => done({ i })));
      } else {
        t.opts.forEach((o, k) => stop.appendChild(k === t.pick ? h('div', 'alt mine', o) : btn(o, 'alt', () => done({ i, k }))));
      }
      path.appendChild(stop);
    });
    if (lastEnd) { const e = h('div', 'stop end'); e.append(h('div', 'kind', KIND[lastEnd.kind]), h('p', 'sq', lastEnd.title)); path.appendChild(e); }
    const card = h('div', 'endcard');
    card.append(h('div', 'eyebrow', BOOK.title), h('h3', '', '내가 고른 길'), path);
    storyEl.replaceChildren(card);
    rise();
    setAsk('review', () => {
      const row = h('div', 'btnrow');
      row.append(btn('결말로 돌아가기', 'sbtn primary', () => done('back')), btn('처음부터', 'sbtn', () => done('restart')), btn('책장으로', 'sbtn', () => done('shelf')));
      return [heading('내가 고른 길'), h('p', '', '흐린 길을 누르면 그 장면에서 다르게 골라 볼 수 있어요.'), row];
    });
    setNext(() => done('back'), '결말로');
    return doneAsk;
  });
}
// 감정 카드 그림: 살구색 동그라미 위에 같은 얼굴
const icons = {};
function faceIcon(kind) {
  if (icons[kind]) return icons[kind];
  const f = document.createElement('canvas');
  f.width = f.height = FACE_W;
  drawFace(f.getContext('2d'), kind);
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = SKIN;
  g.beginPath(); g.arc(48, 50, 42, 0, 7); g.fill();
  g.lineWidth = 3; g.strokeStyle = INK_C; g.stroke();
  g.drawImage(f, 24, 40, 208, 208, 6, 3, 84, 84);
  return (icons[kind] = c.toDataURL());
}
