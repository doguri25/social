// 이야기 데이터 검사: node tests/story.test.js
// stories/*.json 이 data/defs.json 의 목록(무대, 자리, 표정, 자세, 카메라)에 맞는지,
// 모든 갈림길과 말 고르기 조합이 막힘없이 결말에 닿는지, 결말 세 개가 모두 나오는지 확인한다.
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const DEFS = JSON.parse(fs.readFileSync(path.join(root, 'data/defs.json'), 'utf8'));
const files = fs.readdirSync(path.join(root, 'stories')).filter(f => f.endsWith('.json'));

let errors = 0;
let warnings = 0;

for (const file of files) {
  const B = JSON.parse(fs.readFileSync(path.join(root, 'stories', file), 'utf8'));
  const err = (at, msg) => { errors++; console.log(`✗ ${file} ${at}: ${msg}`); };
  const warn = (at, msg) => { warnings++; console.log(`△ ${file} ${at}: ${msg}`); };
  const cast = new Set((B.cast || []).map(c => c.id));
  const has = (list, v) => DEFS[list].includes(v);

  // ---- 무대 상태(set) ----
  function checkSet(set, stage, at) {
    const st = DEFS.stages[stage];
    for (const [id, spec] of Object.entries(set.cast || {})) {
      if (!cast.has(id)) err(at, `등장인물 "${id}"가 cast에 없음`);
      if (spec === 'hide') continue;
      const [spot, pose, face, scale] = String(spec).split(/\s+/);
      if (!st.spots[spot]) err(at, `무대 ${stage}에 자리 "${spot}"가 없음`);
      if (pose && !has('poses', pose)) err(at, `자세 "${pose}"가 목록에 없음`);
      if (face && !has('faces', face)) err(at, `표정 "${face}"가 목록에 없음`);
      if (scale && !(+scale > 0)) err(at, `크기 "${scale}"가 숫자가 아님`);
    }
    if (set.map && !has('mapStates', set.map)) err(at, `지도 상태 "${set.map}"가 목록에 없음`);
    if (set.pencils && !has('pencilStates', set.pencils)) err(at, `색연필 상태 "${set.pencils}"가 목록에 없음`);
    if (set.wall && !has('wallStates', set.wall)) err(at, `벽 지도 상태 "${set.wall}"가 목록에 없음`);
  }

  // ---- 그림 컷 ----
  function checkShot(p, stage, at) {
    if (!has('shots', p.shot)) return err(at, `카메라 "${p.shot}"가 목록에 없음`);
    const on = [].concat(p.on || []);
    if (['close', 'high'].includes(p.shot) && on.length !== 1) err(at, `${p.shot}에는 인물 1명이 필요함`);
    if (['two', 'over'].includes(p.shot) && on.length !== 2) err(at, `${p.shot}에는 인물 2명이 필요함`);
    if (p.shot === 'item') {
      if (!(DEFS.stages[stage].items || {})[on[0]]) err(at, `무대 ${stage}에 물건 "${on[0]}"가 없음`);
    } else on.forEach(id => { if (!cast.has(id)) err(at, `인물 "${id}"가 cast에 없음`); });
    for (const [id, f] of Object.entries(p.faces || {})) {
      if (!cast.has(id)) err(at, `faces의 "${id}"가 cast에 없음`);
      if (!has('faces', f)) err(at, `표정 "${f}"가 목록에 없음`);
    }
    for (const [id, ps] of Object.entries(p.poses || {})) {
      if (!cast.has(id)) err(at, `poses의 "${id}"가 cast에 없음`);
      if (!has('poses', ps)) err(at, `자세 "${ps}"가 목록에 없음`);
    }
  }
  function checkPanel(p, stage, at) {
    const kinds = ['shot', 'text', 'phone'].filter(k => p[k] != null);
    if (kinds.length !== 1) return err(at, `컷 종류(shot/text/phone)가 하나여야 함: ${kinds.join(',') || '없음'}`);
    if (p.shot) checkShot(p, stage, at);
    if (p.phone) {
      const ph = p.phone;
      if (!ph.chat === !ph.profile) err(at, 'phone에는 chat이나 profile 하나만');
      if (ph.profile && ph.profile.photo) checkShot(ph.profile.photo, stage, at + ' 사진');
    }
    if (p.fx && !has('fx', p.fx)) err(at, `효과 "${p.fx}"가 목록에 없음`);
    if (p.tone && !has('tones', p.tone)) err(at, `색조 "${p.tone}"가 목록에 없음`);
    if (p.size && !has('sizes', p.size)) err(at, `크기 "${p.size}"가 목록에 없음`);
    (p.lines || []).forEach((l, i) => {
      const t = ['say', 'think', 'shout', 'whisper'].filter(k => l[k]);
      if (t.length !== 1) err(`${at} 대사${i}`, 'say/think/shout/whisper 가운데 하나만');
      if (l.who && !cast.has(l.who)) err(`${at} 대사${i}`, `말하는 사람 "${l.who}"가 cast에 없음`);
    });
    if (!p.text && !p.cap && !p.pre && !(p.lines || []).length && !p.sfx && !p.fx) warn(at, '글이 하나도 없는 컷');
  }
  function checkFeel(f, at) {
    if (!cast.has(f.who)) err(at, `마음 살피기 인물 "${f.who}"가 cast에 없음`);
    if (!f.q || !f.reveal) err(at, '마음 살피기에 q와 reveal이 필요함');
    if (!(f.is || []).length) err(at, '마음 살피기에 is(그 인물의 감정)가 필요함');
    (f.is || []).forEach(k => { if (!has('emotions', k)) err(at, `감정 "${k}"가 감정 카드 8개에 없음`); });
  }
  // 컷 목록을 차례로 보며 무대가 바뀌는 것을 따라간다. 끝난 뒤의 무대를 돌려준다.
  function checkPanels(list, stage, at) {
    list.forEach((p, i) => {
      const here = `${at}#${i}`;
      if (p.stage) {
        if (!DEFS.stages[p.stage]) return err(here, `무대 "${p.stage}"가 없음`);
        stage = p.stage;
      }
      if (p.stage || p.set) return checkSet(p.set || {}, stage, here);
      if (p.feel) return checkFeel(p.feel, here);
      if (p.activity) { if (!has('activities', p.activity)) err(here, `활동 "${p.activity}"가 목록에 없음`); return; }
      if (p.whatif) {
        const w = p.whatif;
        if ((w.opts || []).length < 2) err(here, '만약에 선택지는 2개 이상');
        if ((w.opts || []).filter(o => o.story).length !== 1) err(here, '만약에 선택지 가운데 원작(story: true)이 꼭 하나');
        if (!w.q || !w.same || !w.back) err(here, '만약에에 q, same, back이 필요함');
        (w.opts || []).forEach((o, k) => { if (!o.story) checkPanels(o.panels || [], stage, `${here} 만약에${k}`); });
        return;
      }
      checkPanel(p, stage, here);
    });
    return stage;
  }

  // ---- 장면 ----
  const ids = Object.keys(B.scenes || {});
  if (!B.scenes[B.start]) err('start', `시작 장면 "${B.start}"가 없음`);
  const stageAtEnd = {};
  for (const id of ids) {
    const sc = B.scenes[id];
    if (!DEFS.stages[sc.stage]) { err(id, `무대 "${sc.stage}"가 없음`); continue; }
    if (!sc.set) err(id, '장면마다 set(무대 상태)이 있어야 함');
    else checkSet(sc.set, sc.stage, id);
    (sc.explore || []).forEach((e, i) => {
      const item = (DEFS.stages[sc.stage].items || {})[e.on];
      if (!item && !cast.has(e.on)) err(`${id} 둘러보기${i}`, `"${e.on}"가 인물도 물건도 아님`);
      if (!item && cast.has(e.on) && !(sc.set && sc.set.cast && sc.set.cast[e.on])) err(`${id} 둘러보기${i}`, `"${e.on}"가 무대에 없음`);
    });
    stageAtEnd[id] = checkPanels(sc.panels || [], sc.stage, id);
    const ends = ['choices', 'compose', 'go', 'end'].filter(k => sc[k] != null);
    if (sc.compose && sc.end) ends.splice(ends.indexOf('end'), 1);
    if (ends.length !== 1) err(id, `장면 끝은 choices/compose/go/end 가운데 하나: ${ends.join(',') || '없음'}`);
    if (sc.go && !B.scenes[sc.go]) err(id, `go "${sc.go}" 장면이 없음`);
    if (sc.choices) {
      if (!sc.choices.q) err(id, '갈림길에 q가 필요함');
      sc.choices.opts.forEach((o, k) => { if (!B.scenes[o.go]) err(`${id} 선택${k}`, `go "${o.go}" 장면이 없음`); });
    }
    if (sc.compose) {
      if (!sc.end) err(id, 'compose 장면은 end: true 로 결말을 고름');
      if (!cast.has(sc.compose.who) || !cast.has(sc.compose.to)) err(id, 'compose의 who/to가 cast에 없음');
      sc.compose.pieces.forEach((pc, k) => { if (pc.face && !has('faces', pc.face)) err(`${id} 말${k}`, `표정 "${pc.face}"가 목록에 없음`); });
    }
    if ((sc.panels || []).length > 12) warn(id, `컷이 ${sc.panels.length}개로 많음`);
  }

  // ---- 결말 ----
  const E = B.endings || [];
  if (E.length < 1) err('endings', '결말이 없음');
  if (E.length && E[E.length - 1].when) err('endings', '마지막 결말은 when 없는 기본 결말이어야 함');
  if (new Set(E.map(e => e.id)).size !== E.length) err('endings', '결말 id가 겹침');
  const composeScene = ids.find(id => B.scenes[id].compose || B.scenes[id].end);
  E.forEach(e => checkPanels(e.panels || [], stageAtEnd[composeScene] || 'classroom', `결말 ${e.id}`));

  // ---- 모든 길 따라가기 ----
  const meets = (cond, f) => Object.entries(cond || {}).every(([k, c]) => {
    const v = f[k] || 0;
    return typeof c === 'number' ? v >= c : !((c.max != null && v > c.max) || (c.min != null && v < c.min));
  });
  const add = (f, a) => { const n = { ...f }; for (const k in a || {}) n[k] = (n[k] || 0) + a[k]; return n; };
  const reached = {};
  const seen = new Set();
  let paths = 0;
  function walk(id, flags, depth, trail) {
    if (depth > 200) return err(trail, '장면이 끝없이 이어짐 (고리)');
    const sc = B.scenes[id];
    if (!sc) return;
    seen.add(id);
    if (sc.choices) return sc.choices.opts.forEach(o => walk(o.go, add(flags, o.add), depth + 1, `${trail}>${o.go}`));
    if (sc.compose) {
      const avail = sc.compose.pieces.filter(pc => meets(pc.when, flags));
      for (let mask = 1; mask < 1 << avail.length; mask++) {
        const picked = avail.filter((_, i) => mask & (1 << i));
        if (picked.length < (sc.compose.min || 1)) continue;
        const f = picked.reduce((acc, pc) => add(acc, pc.add), flags);
        const end = E.find(e => meets(e.when, f)) || E[E.length - 1];
        reached[end.id] = (reached[end.id] || 0) + 1;
        paths++;
      }
      return;
    }
    if (sc.end) { const end = E.find(e => meets(e.when, flags)) || E[E.length - 1]; reached[end.id] = (reached[end.id] || 0) + 1; paths++; return; }
    if (!sc.go) return err(trail, '다음 장면도 결말도 없는 막다른 장면');
    walk(sc.go, flags, depth + 1, `${trail}>${sc.go}`);
  }
  if (B.scenes[B.start]) walk(B.start, {}, 0, B.start);
  ids.filter(id => !seen.has(id)).forEach(id => err(id, '시작에서 갈 수 없는 장면'));
  E.filter(e => !reached[e.id]).forEach(e => err(`결말 ${e.id}`, '어떤 길로도 닿지 않음'));

  const decisions = ids.reduce((n, id) => n + (B.scenes[id].choices || B.scenes[id].compose ? 1 : 0), 0);
  const whatifs = ids.reduce((n, id) => n + (B.scenes[id].panels || []).filter(p => p.whatif).length, 0);
  if (decisions !== 3) warn('분량', `진짜 갈림길이 ${decisions}개 (기준 3개)`);
  console.log(`· ${file}: 장면 ${ids.length}개, 갈림길 ${decisions}개, 만약에 ${whatifs}개, 길 ${paths}가지, 결말 ${E.map(e => `${e.id} ${reached[e.id] || 0}`).join(' / ')}`);
}

console.log(errors ? `실패: 오류 ${errors}개, 경고 ${warnings}개` : `통과 (경고 ${warnings}개)`);
process.exit(errors ? 1 : 0);
