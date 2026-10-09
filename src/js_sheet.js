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
function askIntro(sc, part) {
  return waitFor(done => {
    titleCard(sc, part);
    if (part) partBanner(part);
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
    const arm = () => setNext(picked.size >= (spec.min || 1) ? () => { sfx('pick'); done(pieces.filter(pc => picked.has(pc))); } : null, '이렇게 말하기');
    setAsk('compose', () => {
      const out = [h('div', 'eyebrow', '하고 싶은 말 고르기'), heading(spec.q)];
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
    storyEl.replaceChildren(wrap);
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
      return [heading('유나와 함께 숨을 쉬어 봐요'), h('p', '', '얼굴이 뜨겁고 가슴이 쿵쿵할 때 해 보는 숨 고르기예요.'), row];
    });
    setNext(null);
    ring.addEventListener('pointerdown', down);
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
    ring.addEventListener('keydown', kd);
    ring.addEventListener('keyup', ku);
    setTimeout(() => ring.focus({ preventScroll: true }), 60);
    speak('유나와 함께 숨을 쉬어 봐요. 동그라미를 꾹 누르고 있으면 숨을 들이쉬어요.');
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', up);
      doneAsk();
    };
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
    card.append(h('div', 'eyebrow', KIND[end.kind]), h('h3', '', end.title), h('p', 'countline', `본 결말 ${rec.endings.length} / ${BOOK.endings.length}`), slots);
    storyEl.replaceChildren(card);
    rise();
    setAsk('ending', () => {
      const row = h('div', 'btnrow');
      row.append(
        btn('내가 고른 길 보기', 'sbtn primary', () => { sfx('tap'); done('review'); }),
        btn(end.kind === 'good' ? '다른 말도 해 보기' : '그 장면으로 돌아가기', 'sbtn', () => { sfx('tap'); done('retry'); }),
        btn('처음부터', 'sbtn', () => { sfx('tap'); done('restart'); }),
        btn('책장으로', 'sbtn', () => { sfx('tap'); done('shelf'); }),
      );
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
      const kind = t.type === 'whatif' ? '만약에' : t.type === 'compose' ? '하고 싶은 말' : '갈림길';
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
