'use strict';
/* ===== 이미지 미리 불러오기 ===== */
const IMGS = {}, IMGS_A = {};
function preloadImages() {
  const ps = [];
  for (const id of MERC_IDS.concat(BOSS_IDS)) {
    IMGS[id] = [];
    for (let f = 0; f < 3; f++) {
      const im = new Image(); im.decoding = 'async'; im.src = imgSrc(id, f); IMGS[id][f] = im;
      ps.push(new Promise(r => { im.onload = r; im.onerror = r; }));
    }
  }
  for (const id in SPR_A) { // 공격 자세 그림
    IMGS_A[id] = [];
    for (let f = 0; f < 3; f++) { if (!SPR_A[id][f]) continue; const im = new Image(); im.decoding = 'async'; im.src = imgSrc(id, 'a' + f); IMGS_A[id][f] = im; }
  }
  return Promise.all(ps);
}
const TINT = {};
function enemyCanvas(id, f, atk) { // 적: 좌우 뒤집고 붉은 테두리 + 살짝 어둡게
  const k = id + f + (atk ? 'a' : ''); if (TINT[k]) return TINT[k];
  const im = atk ? IMGS_A[id][f] : IMGS[id][f], [w, h] = atk ? SPR_A[id][f] : SPR[id][f], P = 6;
  if (!im.complete || !im.naturalWidth) return null;
  const c = document.createElement('canvas'); c.width = w + P * 2; c.height = h + P * 2;
  const x = c.getContext('2d');
  const sil = document.createElement('canvas'); sil.width = w; sil.height = h; const sx2 = sil.getContext('2d');
  sx2.drawImage(im, 0, 0, w, h); sx2.globalCompositeOperation = 'source-in'; sx2.fillStyle = '#ff2d55'; sx2.fillRect(0, 0, w, h);
  x.translate(c.width, 0); x.scale(-1, 1);
  x.save(); x.shadowColor = 'rgba(255,45,85,.9)'; x.shadowBlur = 6;
  for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1.5, -1.5], [1.5, 1.5], [-1.5, 1.5], [1.5, -1.5]]) x.drawImage(sil, P + dx, P + dy);
  x.restore();
  x.drawImage(im, P, P, w, h);
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalCompositeOperation = 'source-atop'; x.fillStyle = BOSSES[id] ? 'rgba(40,0,15,.08)' : 'rgba(60,0,20,.18)'; x.fillRect(0, 0, c.width, c.height);
  c._P = P; TINT[k] = c; return c;
}

/* ===== 전투 ===== */
const APOS = [[39, 58], [41.5, 80], [17, 48], [15, 69], [17, 90]];
const SPEED_KEY = 'scm-battle-prefs';
let B = null;
function battlePrefs() { try { return JSON.parse(localStorage.getItem(SPEED_KEY)) || { auto: false }; } catch (e) { return { auto: false }; } }
function saveBattlePrefs() { try { localStorage.setItem(SPEED_KEY, JSON.stringify({ auto: B.auto })); } catch (e) { } }

function squadAllies(hpMap) {
  const out = [];
  S.squad.forEach((id, slot) => {
    if (!id) return; const f = hpMap ? hpMap[slot] : 1; if (f !== undefined && f <= 0) return;
    const o = S.roster[id]; out.push({ id, slot, g: o.g, imp: o.imp, mlv: o.lv || 1, hp: f === undefined ? 1 : f });
  });
  return out;
}

/* =====================================================================
   액션 전투: 용병 1명 직접 조작 + 동료 4명 자동, 적 경고 범위 회피
   월드 좌표: x 0~1000 (가로), y 0~100 (깊이, 클수록 화면 아래·가까이)
   ===================================================================== */
var BAL = { ehp: 2.6, eatk: 2.2, rhp: 1.8, ratk: 1.6, erate: .85, ahp: 1.5, aatk: 1.5 }; // 3인 분대라 아군 1명이 더 강해요 // 적 보정 (실시간 액션)
const DEPTH = 4;                       // 깊이 1 = 가로 4 (거리 계산)
const MOVE = { guardian: 170, assault: 235, sniper: 175, hacker: 185, medic: 185, engineer: 180 };
const RANGE = { guardian: 95, assault: 95, sniper: 430, hacker: 360, medic: 340, engineer: 380 };
const MELEE = r => r === 'guardian' || r === 'assault';
const START_A = [[340, 50], [230, 22], [230, 80], [150, 36], [150, 70]];

function mkUnit(side, d, buffs) {
  const m = unitDef(d.id);
  const real = side === 'a' || d.real;
  const st = real ? mercStats(d.id, d.g, d.imp, 1, d.mlv || 1) : mercStats(d.id, 1, null, lvMul(d.lv));
  if (side === 'a') { st.hp *= BAL.ahp; st.atk *= BAL.aatk; }
  if (side === 'e') { if (!real) { const L = Math.max(1, d.lv || 1); st.hp *= (.95 + L * .01) * BAL.ehp; st.atk *= (.95 + L * .006) * BAL.eatk; } else { st.hp *= BAL.rhp; st.atk *= BAL.ratk; } }
  if (buffs) { st.hp *= 1 + (buffs.hp || 0); st.atk *= 1 + (buffs.atk || 0); st.def *= 1 + (buffs.def || 0); st.spd *= 1 + (buffs.spd || 0); st.crit += buffs.crit || 0; }
  if (d.boss) { st.hp *= 3.2; st.atk *= .62; st.def *= 1.2; if (m.boss) { st.hp *= 1.05; st.atk *= 2.6; } }
  const p = d.boss ? [760, 55] : START_A[d.slot] || [200, 50];
  const u = {
    side, id: d.id, m, role: m.role, el: m.el, slot: d.slot, boss: !!d.boss,
    x: side === 'a' ? p[0] : (d.boss ? p[0] : 1000 - p[0]), y: p[1], vx: 0, vy: 0, face: side === 'a' ? 1 : -1,
    maxHp: Math.round(st.hp), atk: st.atk, def: st.def, spd: st.spd, crit: st.crit,
    frame: side === 'a' ? frameOf(d.g) : (d.frame || 0),
    energy: side === 'a' ? (buffs && buffs.gauge ? 30 : 0) : rnd(0, 25), atkCd: rnd(.3, 1.2), skillCd: rnd(2, 5), dodgeCd: 0, inv: 0,
    st: { stun: 0, mark: 0, taunt: 0, charm: 0, freeze: 0, weak: 0, slow: 0, wall: 0 }, tauntBy: null, shield: 0, shieldT: 0,
    dead: false, deadT: 0, flash: 0, bob: rnd(0, 6), lean: 0, combo: 0, comboT: 0, wind: null, aimx: 1, aimy: 0,
    dmgDone: 0, dmgTaken: 0, healDone: 0, first: true, mlv: d.mlv || 1, g: d.g || 1, isTarget: !!d.isTarget, tpl: d,
  };
  if (d.hpMul) u.maxHp = Math.round(u.maxHp * d.hpMul);
  u.hp = Math.round(u.maxHp * (d.hp === undefined ? 1 : d.hp));
  u.mv = (u.boss ? 140 : MOVE[u.role] || 180) * Math.min(1.3, Math.sqrt(u.spd / 100));
  u.range = u.boss ? 150 : RANGE[u.role] || 120;
  return u;
}
function addBuffs(a, b) { const o = { ...(a || {}) }; for (const k in b) o[k] = (o[k] || 0) + b[k]; return o; }
function startBattle(cfg) { if (cfg.skipPre) return runBattle(cfg); preBattle(cfg); }

/* ---------- 스킬 설명 (용병 상세 창에서 씀) ---------- */
const KIT = {
  ironwall: { b: '방패 강타', s: { n: '방패 돌진', d: '앞으로 돌진하며 부딪힌 적을 밀쳐 내고 보호막을 얻어요' }, u: { d: '5초 동안 팀 전체 받는 피해 −50%' } },
  pug: { b: '생체 주먹', s: { n: '지면 강타', d: '주변 적에게 피해를 주고 3초 동안 퍼그만 노리게 도발' }, u: { d: '적 전체 도발 + 체력 30% 회복' } },
  blade: { b: '플라즈마 베기', s: { n: '플라즈마 연참', d: '앞쪽 넓은 범위를 크게 베어요' }, u: { d: '화면을 가로지르며 적 전체를 베어요' } },
  reaper: { b: '쌍칼 찌르기', s: { n: '그림자 이동', d: '가까운 적 뒤로 순간이동해 큰 피해' }, u: { d: '체력 낮은 적에게 순간이동 5연타' } },
  hawkeye: { b: '레일 사격', s: { n: '관통 사격', d: '바라보는 방향으로 일직선 관통 사격' }, u: { d: '화면 끝까지 꿰뚫는 초강력 레일건' } },
  specter: { b: '바이오 탄', s: { n: '표식탄', d: '맞은 적이 6초 동안 받는 피해 +30%' }, u: { d: '가장 강한 적에게 큰 피해 + 받는 피해 +60%' } },
  glitch: { b: '해킹 펄스', s: { n: '바이러스 장판', d: '적 위치에 장판: 안의 적은 느려지고 약해져요' }, u: { d: '적 전체 2.5초 기절 (공격 준비도 끊겨요)' } },
  neuro: { b: '뇌파 충격', s: { n: '정신 파동', d: '앞쪽 적을 밀쳐 내고 느리게 만들어요' }, u: { d: '가장 강한 적이 5초 동안 우리 편이 돼요' } },
  nano: { b: '나노 침', s: { n: '나노 안개', d: '4초 동안 내 주변 아군을 계속 회복' }, u: { d: '아군 전체 크게 회복' } },
  halo: { b: '빛 사격', s: { n: '수호 드론', d: '체력 낮은 아군과 나에게 보호막' }, u: { d: '아군 전체에 큰 보호막' } },
  volt: { b: '렌치 타격', s: { n: '포탑 설치', d: '8초 동안 자동으로 쏘는 포탑을 놓아요' }, u: { d: '10초 동안 쏘는 대형 포탑' } },
  swarm: { b: '드론 사격', s: { n: '드론 사출', d: '적을 따라가는 미사일 4발' }, u: { d: '적 전체에 미사일 비' } },
  chrono: { b: '퀀텀 베기', s: { n: '시간 베기', d: '앞으로 베며 맞은 적을 느리게 만들어요' }, u: { d: '3초 동안 적 전체 정지' } },
  eclipse: { b: '공허 탄', s: { n: '흑점 저격', d: '큰 피해 + 주변 적을 끌어당겨요' }, u: { d: '블랙홀로 적을 모아 터뜨려요' } },
  codeh: { b: '건틀렛 내려치기', s: { n: '충전', d: '' }, u: { d: '' } },
};
const kit = u => KIT[u.id] || KIT.blade;

/* ---------- 기본 함수 ---------- */
const alive = s => B.units.filter(u => u.side === s && !u.dead);
const fighters = s => alive(s).filter(u => !u.cargo);
const sideHp = s => B.units.filter(u => u.side === s && !u.cargo).reduce((a, u) => a + Math.max(0, u.hp), 0);
function foesOf(u) { if (u.st.charm > 0) return fighters(u.side).filter(x => x !== u); return alive(u.side === 'a' ? 'e' : 'a'); }
function friendsOf(u) { return fighters(u.side); }
const dist = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) * DEPTH);
const sx = x => x / 1000 * B.W, sy = y => B.H * (.47 + .47 * y / 100);
const depthS = y => .8 + .2 * y / 100;
function upos(u) { return { x: sx(u.x), y: sy(u.y) }; }
const unitH = u => clamp(Math.min(B.H * .3, B.W * .29), 70, 190) * (u.m.sz || 1) * (u.boss ? 1.45 : 1) * depthS(u.y || 50);
function fx(e) { if (B.instant) return; e.t = 0; B.fx.push(e); }
const COARSE = window.matchMedia && matchMedia('(pointer: coarse)').matches;
let _buzzT = 0;
function buzz(ms) { if (!B || B.instant || !COARSE || !navigator.vibrate) return; const n = performance.now(); if (n - _buzzT < 55) return; _buzzT = n; try { navigator.vibrate(ms); } catch (e) { } }
function punch(v) { if (!B.instant && !REDUCED) B.punch = Math.max(B.punch || 0, v); }
function shakeIt(v) { B.shake = Math.max(B.shake, v); }
function later(dt, fn) { B.q.push({ t: B.t + dt, fn }); }
function addEnergy(u, n) { if (u.cargo || u.dead) return; u.energy = Math.min(100, u.energy + n * (u.id === 'chrono' ? 1.3 : 1)); }
const disabled = u => u.st.stun > 0 || u.st.freeze > 0;
function nearest(u, list, max = 1e9) { let b = null, bd = max; for (const t of list) { const d = dist(u, t); if (d < bd) { bd = d; b = t; } } return b; }
function parts(x, y, c, n = 8, sp = 160) { if (B.instant) return; for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), v = rnd(.3, 1) * sp; B.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: rnd(.25, .55), c, s: rnd(2, 4.5) }); } }
function clampPos(u) { u.x = clamp(u.x, 30, 970); u.y = clamp(u.y, 2, 98); }

/* ---------- 피해 · 회복 ---------- */
function hit(src, tg, mult, o = {}) {
  if (!tg || tg.dead) return 0;
  if (tg.inv > 0 && tg.side === 'a') { if (o.area && tg === B.leader && tg.dodging) perfectDodge(); return 0; }
  const A = src.atk * (src.st.weak > 0 ? .8 : 1) * (src.id === 'pug' && src.hp < src.maxHp * .5 ? 1.35 : 1);
  let dmg = A * mult * A / (A + tg.def) * elemMul(src.el, tg.el) * rnd(.92, 1.08);
  const crit = o.crit || (!o.noCrit && Math.random() * 100 < src.crit); if (crit) dmg *= 1.6;
  if (tg.st.mark > 0) dmg *= 1 + (tg.markV || .3);
  if (src.id === 'reaper' && tg.hp < tg.maxHp * .3) dmg *= 1.5;
  if (src === B.leader && src.buff) { if (src.buff.rage > 0) dmg *= 1.5; }
  if (src === B.leader && B.burst > 0) dmg *= 1.35;
  if (src.id === 'specter' && (tg.st.stun > 0 || tg.st.mark > 0 || tg.st.weak > 0 || tg.st.slow > 0)) dmg *= 1.3;
  if (src.id === 'hawkeye' && src.first && !o.extra) { dmg *= 2; src.first = false; }
  if (tg.st.wall > 0) dmg *= .5;
  if (o.ult && (tg.st.stun > 0 || tg.st.freeze > 0)) dmg *= 1.4;
  const byL = src === B.leader && src.side === 'a' && !o.extra && !B.instant;
  const heavy = o.fin || o.skill || o.counter || B.skillCtx === src;
  if (byL) { B.hits = (B.hits || 0) + 1; B.hitT = 2.2; B.hitPop = .14; dmg *= (B.auto ? 1 : 1.5) * (1 + Math.min(.3, B.hits * .01)); if (B.hits >= B.nextBurst && B.burst <= 0) startBurst(); }
  dmg = Math.max(1, Math.round(dmg));
  let left = dmg;
  if (tg.shield > 0) { const ab = Math.min(tg.shield, left); tg.shield -= ab; left -= ab; }
  tg.hp -= left; tg.flash = .12; tg.hurt = .18; tg.hurtDir = Math.sign(tg.x - src.x) || src.face; addEnergy(tg, 3); addEnergy(src, src === B.leader ? 4 : 5);
  src.dmgDone += dmg; tg.dmgTaken += dmg;
  const p = upos(tg);
  if (!B.instant) {
    sfx(heavy && byL ? 'heavy' : crit ? 'crit' : 'hit');
    const hy = p.y - unitH(tg) * .5, sz = byL ? (heavy || crit ? 34 : 26) : (crit || o.big ? 18 : 13);
    if (B.rt - (tg.numT || 0) < .35) tg.numK = ((tg.numK || 0) + 1) % 4; else tg.numK = 0; tg.numT = B.rt;
    fx({ k: 'txt', x: p.x + rnd(-10, 10) + (tg.numK % 2 ? 14 : -14) * (tg.numK ? 1 : 0), y: p.y - unitH(tg) - 6 - tg.numK * 17, s: crit ? dmg + '!' : String(dmg), c: crit ? '#FFB627' : (tg.side === 'a' ? '#FF9AC8' : byL ? '#FFFFFF' : 'rgba(205,200,240,.75)'), sz, pop: byL || crit ? 1 : 0, vx: (tg.hurtDir || 1) * rnd(10, 40), d: .75 });
    const th = unitH(tg), ic = crit ? '#FFB627' : ELEMS[src.el].c;
    if (byL) {
      fx({ k: 'impact', x: p.x - tg.hurtDir * 6, y: hy, c: ic, r: th * (heavy || crit ? .62 : .42), d: .2 });
      fx({ k: 'slashmark', x: p.x, y: hy, r: th * (heavy ? .55 : .38), a: rnd(-.9, -.4) * (tg.hurtDir || 1), c: ic, d: .22 });
      if (heavy || crit) fx({ k: 'nova', x: p.x, y: hy, r: th * .5, c: ic, d: .18 });
      dirParts(p.x, hy, tg.hurtDir, ic, heavy ? 22 : 12);
    } else if (crit || o.big || o.ult) { fx({ k: 'impact', x: p.x - tg.hurtDir * 6, y: hy, c: ic, r: th * .35, d: .16 }); dirParts(p.x, hy, tg.hurtDir, ic, 9); }
    else parts(p.x, hy, ELEMS[src.el].c, 5, 150);
    if (byL) { buzz(heavy || crit ? 22 : 8); punch(heavy ? .045 : crit ? .03 : .012); if (heavy || crit) shakeIt(heavy ? .14 : .08); }
    if (tg === B.leader && src.side !== 'a') { B.hurtFx = .35; shakeIt(.14); buzz(35); sfx('hurt'); if (B.hits) B.hits = Math.floor(B.hits / 2); }
  }
  if (o.kb && !tg.boss) { const d = Math.sign(tg.x - src.x) || src.face; tg.vx += d * o.kb; }
  if (!B.instant && (byL || o.ult)) B.hitstop = Math.min(.16, Math.max(B.hitstop, o.counter ? .15 : heavy ? .09 : o.ult ? .07 : .045) + (crit && byL ? .025 : 0));
  if (byL && heavy && tg.side === 'e' && !tg.boss && tg.wind && !tg.wind.ult) { tg.wind = null; tg.atkCd = Math.max(tg.atkCd, .7); if (B.rt - (tg.stagT || -9) > 1.5) { tg.stagT = B.rt; fx({ k: 'txt', x: p.x, y: p.y - unitH(tg) - 34, s: 'STAGGER', c: '#2DE2E6', sz: 15, pop: 1, d: .7 }); } }
  if (tg.m.enrage && !tg.enraged && tg.hp > 0 && tg.hp < tg.maxHp * .5) { tg.enraged = true; tg.atk *= 1.3; tg.frame = Math.min(2, tg.frame + 1); fx({ k: 'txt', x: p.x, y: p.y - unitH(tg) - 50, s: '분노!', c: '#FF4B5C', big: true, d: 1.2 }); B.shake = .35; }
  if (tg.hp <= 0) kill(src, tg);
  if (crit && src.id === 'blade' && !o.extra && !tg.dead) hit(src, tg, mult * .3, { extra: 1, noCrit: 1 });
  return dmg;
}
function dirParts(x, y, dir, c, n) { if (B.instant) return; for (let i = 0; i < n; i++) { const a = rnd(-.9, .9) + (dir < 0 ? Math.PI : 0), v = rnd(160, 420); B.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 90, life: rnd(.18, .4), c: Math.random() < .3 ? '#FFFFFF' : c, s: rnd(2, 5), streak: 1 }); } }
function kill(src, tg) {
  tg.hp = 0; tg.dead = true; tg.deadT = 0; tg.wind = null;
  if (tg.affix === 'bomb') { B.hazards.push({ x: tg.x, y: tg.y, r: 170, t: .95, max: .95, src: tg }); if (!B.instant) { const q = upos(tg); fx({ k: 'txt', x: q.x, y: q.y - unitH(tg) - 20, s: '자폭!', c: '#FF4B5C', sz: 20, pop: 1, d: .9 }); } }
  if (!tg.boss && !tg.cargo) { const d = Math.sign(tg.x - src.x) || src.face; tg.fly = { vx: d * rnd(360, 520), vy: -rnd(240, 340), rot: d * rnd(4, 7) }; }
  if (!B.instant) {
    const q = upos(tg); fx({ k: 'burst', x: q.x, y: q.y - unitH(tg) * .5, c: tg.side === 'e' ? '#FF4B5C' : '#2DE2E6', r: tg.boss ? 140 : 80, d: .35 }); sfx('kill');
    if (src === B.leader) { B.hitstop = Math.max(B.hitstop, .1); punch(.05); shakeIt(.18); buzz(30); }
  }
  addEnergy(src, 8); if (src.id === 'eclipse') addEnergy(src, 40);
  const p = upos(tg); parts(p.x, p.y - unitH(tg) * .5, tg.side === 'e' ? '#FF4B5C' : '#2DE2E6', 26, 340);
  if (tg.side === 'e' && !tg.cargo) {
    B.kills++; B.orbs.push({ x: tg.x, y: tg.y, life: 8 });
    if (B.mode === 'survive' && tg.tpl) later(2, () => { const nu = mkUnit('e', tg.tpl); nu.x = 1000; B.units.push(nu); });
  }
  if (tg === B.leader) { const n = fighters('a')[0]; if (n) swapTo(n, true); }
}
function heal(src, tg, amt) {
  if (!tg || tg.dead) return; amt = Math.round(amt); const before = tg.hp; tg.hp = Math.min(tg.maxHp, tg.hp + amt); src.healDone += tg.hp - before;
  if (!B.instant) { const p = upos(tg); fx({ k: 'txt', x: p.x, y: p.y - unitH(tg) - 6, s: '+' + amt, c: '#7DFF6A', d: .8 }); }
}
const ringAt = (t, c, r = 70) => { if (B.instant) return; const q = upos(t); fx({ k: 'ring', x: q.x, y: q.y - unitH(t) * .45, c, r, d: .45 }); };
function inArc(src, t, r, ax, ay, cosw) { const dx = t.x - src.x, dy = (t.y - src.y) * DEPTH, d = Math.hypot(dx, dy); if (d > r) return false; if (d < 30) return true; return (dx * ax + dy * ay) / d >= cosw; }
function aimAt(u, t) { if (!t) return; const dx = t.x - u.x, dy = (t.y - u.y) * DEPTH, d = Math.hypot(dx, dy) || 1; u.aimx = dx / d; u.aimy = dy / d; if (Math.abs(dx) > 4) u.face = Math.sign(dx); }

/* ---------- 투사체 ---------- */
function shoot(src, tg, mult, o = {}) { // 우리 편·적 공용 유도탄
  if (!tg) return; const speed = o.speed || 1300;
  B.shots.push({ src, tg, x: src.x + src.face * 20, y: src.y, mult, o, speed, c: o.c || (src.side === 'a' ? (src.role === 'engineer' ? '#FFB627' : '#2DE2E6') : '#FF4B5C'), w: o.w || 3, trail: [] });
}
function enemyBolt(src, tx, ty, mult) { // 피할 수 있는 적 탄환 (조준한 자리로 날아감)
  B.bolts.push({ src, x: src.x, y: src.y, tx, ty, mult, speed: 760, r: 60 });
}

/* ---------- 조작 ---------- */
function perfectDodge() {
  if (B.perfectCd > 0) return; B.perfectCd = 1.2;
  B.slow = .7; B.counter = 1.8; addEnergy(B.leader, 20); B.leader.skillCd = Math.max(0, B.leader.skillCd - 2);
  const p = upos(B.leader); fx({ k: 'txt', x: p.x, y: p.y - unitH(B.leader) - 40, s: 'PERFECT!', c: '#2DE2E6', sz: 28, pop: 1, d: 1 }); fx({ k: 'ring', x: p.x, y: p.y - 30, c: '#2DE2E6', r: 140, d: .5 });
  fx({ k: 'txt', x: p.x, y: p.y - unitH(B.leader) - 12, s: '지금 공격 → 반격!', c: '#FFD54A', sz: 14, d: 1.1 });
  if (!B.instant) { sfx('perfect'); buzz(40); punch(.04); } tip('dodge', '완벽 회피! 공격이 닿기 직전에 피하면 시간이 느려지고 에너지가 차요');
}
function doDodge(u) {
  if (u.dodgeCd > 0 || disabled(u) || u.dead) return;
  let dx = B.inp.x, dy = B.inp.y; if (!dx && !dy) { dx = -u.face; dy = 0; }
  const d = Math.hypot(dx, dy) || 1; u.dash = { vx: dx / d * 1050, vy: dy / d * 260, t: .2 }; u.inv = .32; u.dodging = true; u.dodgeCd = .75;
  if (!B.instant) { sfx('dash'); buzz(10); u.trailT = 0; const p = upos(u); parts(p.x, p.y - 4, 'rgba(200,190,255,.7)', 8, 120); }
}
function counterAttack(u) {
  B.counter = 0; const foes = foesOf(u), t = nearest(u, foes, 520); if (!t) return false;
  const from = upos(u); fx({ k: 'ghost', u, x: from.x, y: from.y, face: u.face, d: .3 });
  if (MELEE(u.role) || u.id === 'codeh') { const side = t.x > u.x ? -1 : 1; u.x = t.x + side * 55; u.y = t.y; clampPos(u); }
  aimAt(u, t); u.atkCd = .45; u.lunge = .14; u.pose = .26;
  const p = upos(u);
  fx({ k: 'txt', x: p.x, y: p.y - unitH(u) - 46, s: 'COUNTER!', c: '#FFD54A', sz: 30, pop: 1, d: 1 });
  sfx('counter'); buzz(45);
  if (MELEE(u.role) || u.id === 'codeh') {
    fx({ k: 'arc', x: p.x, y: p.y - unitH(u) * .5, r: 120, a: Math.atan2(u.aimy * .35, u.aimx), sw: 5.6, c: '#FFD54A', w: 26, d: .26 });
    foes.filter(f => dist(u, f) < 170).forEach(f => hit(u, f, 2.2, { kb: 260, counter: 1, big: 1 }));
  } else { B.skillCtx = u; lineHit(u, 2, '#FFD54A', 10); B.skillCtx = null; }
  B.hitstop = .15; punch(.08); shakeIt(.25);
  return true;
}
function leaderAttack(u) {
  if (u.dead || disabled(u)) return;
  if (u.atkCd > 0) { B.atkBuf = .22; return; }
  B.atkBuf = 0;
  if (B.counter > 0 && counterAttack(u)) return;
  const foes = foesOf(u);
  if (MELEE(u.role) || u.id === 'codeh') {
    u.combo = u.comboT > 0 ? (u.combo + 1) % 3 : 0; u.comboT = .8; u.atkCd = (u.combo === 2 ? .5 : .34) / Math.min(1.3, u.spd / 100) * leadHaste(u);
    let t = nearest(u, foes, 240); const pb = nearest(u, B.props.filter(p => !p.dead), 240); if (pb && (!t || dist(u, pb) < dist(u, t))) t = pb; // 드럼통이 더 가까우면 드럼통부터
    if (t) aimAt(u, t); else { u.aimx = u.face; u.aimy = 0; }
    // 붙어서 때리기: 가까운 적에게 미끄러져 들어가요
    if (t) { const d = dist(u, t), mv = clamp(d - 62, 0, 90); if (mv > 4) { const p0 = upos(u); if (mv > 30) fx({ k: 'ghost', u, x: p0.x, y: p0.y, face: u.face, d: .18 }); u.x += u.aimx * mv; u.y += u.aimy / DEPTH * mv; } }
    else { u.x += u.aimx * 22; u.y += u.aimy / DEPTH * 22; }
    clampPos(u); u.lunge = .14; u.pose = .26;
    const fin = u.combo === 2, r = fin ? 140 : 115;
    const p = upos(u), cy = p.y - unitH(u) * .5, ang = Math.atan2(u.aimy * .35, u.aimx);
    const col = ELEMS[u.el].c, hU = unitH(u), R = hU * (fin ? .6 : .48);
    if (!B.instant) {
      fx({ k: 'arc', x: p.x + u.aimx * hU * .12, y: cy, r: R, a: ang, sw: fin ? 4.2 : 2.6, flip: u.combo === 1, c: col, w: hU * (fin ? .16 : .11), d: fin ? .26 : .18, glow: 1 });
      fx({ k: 'streaks', x: p.x, y: cy, dir: u.aimx >= 0 ? 1 : -1, len: hU * (fin ? 1.3 : .9), c: col, d: .16 });
      if (fin) { fx({ k: 'ring', x: p.x + u.aimx * hU * .5, y: p.y - 4, c: col, r: hU * 1.1, d: .35, flat: 1 }); fx({ k: 'nova', x: p.x + u.aimx * hU * .5, y: cy, r: hU * .6, c: col, d: .2 }); }
      B.kick = { x: u.aimx * (fin ? 9 : 5), t: .09 };
    }
    sfx('swing');
    B.props.forEach(pr => { if (!pr.dead && inArc(u, pr, r + 10, u.aimx, u.aimy, fin ? -.3 : .1)) blowProp(pr); });
    foes.filter(t2 => inArc(u, t2, r, u.aimx, u.aimy, fin ? -.3 : .15)).forEach(t2 => hit(u, t2, (fin ? .95 : .5) * (u.role === 'guardian' ? .85 : 1), { kb: fin ? 230 : 50, fin }));
  } else {
    u.atkCd = .44 / Math.min(1.3, u.spd / 100) * leadHaste(u);
    let t = (B.mouseAtk && B.mouseW && nearest(B.mouseW, foes, 260)) || foes.filter(f => Math.sign(f.x - u.x) === u.face || B.inp.x === 0).sort((a, b) => dist(u, a) - dist(u, b))[0] || nearest(u, foes); // 클릭하면 커서 근처 적을 쏴요
    if (!t) return; aimAt(u, t);
    u.shot = (u.shot || 0) + 1; const fin = u.shot % 4 === 0; // 4발째는 강한 한 발
    shoot(u, t, (u.role === 'medic' ? .45 : u.role === 'sniper' ? .7 : .58) * (fin ? 1.8 : 1), { w: fin ? 7 : u.role === 'sniper' ? 4 : 3, speed: 2000, fin, c: fin ? ELEMS[u.el].c : null });
    u.lunge = .08; u.pose = .22; u.vx -= u.face * (fin ? 160 : 50);
    if (!B.instant) { const p = upos(u), hU = unitH(u), q = upos(t), col = ELEMS[u.el].c, mx = p.x + u.face * hU * .5, my = p.y - hU * .58;
      fx({ k: 'muzzle', x: mx, y: my, c: col, r: hU * (fin ? .4 : .26), d: fin ? .14 : .1 });
      fx({ k: 'tracer', x1: mx, y1: my, x2: q.x, y2: q.y - unitH(t) * .5, c: col, w: fin ? 10 : 5, d: fin ? .2 : .12 });
      B.kick = { x: -u.face * (fin ? 7 : 3), t: .08 };
      sfx(fin ? 'heavyshot' : 'shot'); if (fin) shakeIt(.06); }
  }
}
function swapTo(n, forced) {
  if (!n || n.dead || n.cargo || n === B.leader || (!forced && B.swapCd > 0)) return;
  const old = B.leader; B.leader = n; B.swapCd = 1.2;
  // 교체 공격: 들어오면서 가장 가까운 적을 친다
  const t = nearest(n, foesOf(n));
  if (t && !forced) { aimAt(n, t); if (MELEE(n.role)) { const d = dist(n, t), mv = clamp(d - 60, 0, 260); n.x += n.aimx * mv; n.y += n.aimy / DEPTH * mv; clampPos(n); }
    later(.05, () => { if (!t.dead) { hit(n, t, .9, { kb: 160, big: 1, fin: 1 }); ringAt(t, ELEMS[n.el].c, 60); } });
    if (!B.instant) { const q = upos(n); fx({ k: 'txt', x: q.x, y: q.y - unitH(n) - 30, s: 'SWITCH', c: '#FFD54A', sz: 18, pop: 1, d: .7 }); } }
  if (!B.instant) { const p = upos(n); fx({ k: 'ring', x: p.x, y: p.y - 30, c: '#FFD54A', r: 70, d: .4 }); sfx('click'); }
  if (old && !old.dead) old.atkCd = .5;
  updateDom();
}

/* ---------- 스킬 · 궁극기 ---------- */
function useSkill(u) {
  if (u.skillCd > 0 || disabled(u) || u.dead) return false;
  u.pose = .4;
  const F = foesOf(u), A = friendsOf(u), t = (u === B.leader ? nearest(u, F, 700) : u.target) || nearest(u, F);
  const col = ELEMS[u.el].c, p = upos(u);
  if (!B.instant) fx({ k: 'txt', x: p.x, y: p.y - unitH(u) - 28, s: kit(u).s.n, c: col, d: .9 });
  let cd = 7; if (u === B.leader) { B.skillCtx = u; punch(.035); buzz(15); }
  if (!B.instant) { const hU = unitH(u), L = u === B.leader; fx({ k: 'nova', x: p.x, y: p.y - hU * .5, r: hU * (L ? .8 : .45), c: col, d: .28 }); fx({ k: 'ring', x: p.x, y: p.y - 4, c: col, r: hU * (L ? 1.5 : 1), d: .45, flat: 1 }); if (L) fx({ k: 'streaks', x: p.x, y: p.y - hU * .5, dir: u.face, len: hU * 1.4, c: col, d: .2 }); }
  switch (u.id) {
    case 'ironwall': { if (t) aimAt(u, t); u.dash = { vx: u.aimx * 900, vy: u.aimy / DEPTH * 900, t: .22 }; later(.12, () => F.filter(f => dist(u, f) < 140).forEach(f => hit(u, f, 1.2, { kb: 320 }))); u.shield += Math.round(u.maxHp * .2); u.shieldT = 6; break; }
    case 'pug': F.filter(f => dist(u, f) < 220).forEach(f => { hit(u, f, 1.3, { kb: 140 }); f.st.taunt = 3; f.tauntBy = u; }); ringAt(u, '#7DFF6A', 130); B.shake = .2; break;
    case 'blade': { if (t) aimAt(u, t); if (!B.instant) fx({ k: 'slash', x: p.x + u.aimx * 60, y: p.y - unitH(u) * .5, c: '#FF3D9A', d: .3, r: 80 }); F.filter(f => inArc(u, f, 230, u.aimx, u.aimy, -.1)).forEach(f => hit(u, f, 2.2, { kb: 180, big: 1 })); B.shake = .2; break; }
    case 'reaper': if (t) { u.x = t.x - t.face * -1 * 60 + (t.x > u.x ? 50 : -50); u.y = t.y; clampPos(u); aimAt(u, t); hit(u, t, 2.6, { big: 1 }); if (!B.instant) fx({ k: 'slash', x: upos(t).x, y: upos(t).y - unitH(t) * .5, c: '#FF4B5C', d: .25, r: 40 }); } cd = 6; break;
    case 'hawkeye': { if (t) aimAt(u, t); lineHit(u, 2.4, '#FFB627', 6); cd = 6; break; }
    case 'specter': if (t) { shoot(u, t, 1.6, { c: '#FF3D9A', w: 5, onHit: x => { x.st.mark = 6; x.markV = .3; } }); } break;
    case 'glitch': if (t) { B.zones.push({ x: t.x, y: t.y, r: 170, t: 4.5, kind: 'virus', side: u.side, src: u, tick: 0 }); ringAt(t, '#A874FF', 90); } break;
    case 'neuro': { if (t) aimAt(u, t); F.filter(f => inArc(u, f, 280, u.aimx, u.aimy, .1)).forEach(f => { hit(u, f, 1.1, { kb: 300 }); f.st.slow = 3; }); ringAt(u, '#FF7AB8', 120); break; }
    case 'nano': B.zones.push({ x: u.x, y: u.y, r: 220, t: 4, kind: 'heal', side: u.side, src: u, tick: 0, follow: u }); ringAt(u, '#7DFF6A', 110); cd = 8; break;
    case 'halo': { const w = A.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]; [w, u].forEach(f => { if (f) { f.shield += Math.round(f.maxHp * .3); f.shieldT = 8; ringAt(f, '#FFD54A', 55); } }); cd = 8; break; }
    case 'volt': B.turrets.push({ src: u, x: u.x + u.face * 40, y: u.y, t: 8, cd: 0, big: false }); ringAt(u, '#FFB627', 70); cd = 9; break;
    case 'swarm': for (let i = 0; i < 4; i++) later(i * .08, () => { const fs = foesOf(u); if (fs.length) shoot(u, pick(fs), .8, { c: '#5BC0FF', speed: 900, w: 4 }); }); break;
    case 'chrono': { if (t) aimAt(u, t); u.dash = { vx: u.aimx * 950, vy: u.aimy / DEPTH * 950, t: .2 }; later(.1, () => F.filter(f => dist(u, f) < 150).forEach(f => { hit(u, f, 2, { kb: 120 }); f.st.slow = 3; })); break; }
    case 'eclipse': if (t) { shoot(u, t, 2.6, { c: '#A874FF', w: 6, onHit: x => { F.filter(f => f !== x && dist(f, x) < 260).forEach(f => { f.vx += Math.sign(x.x - f.x) * 260; }); ringAt(x, '#A874FF', 110); } }); } cd = 7; break;
    default: if (t) hit(u, t, 1.5, {});
  }
  B.skillCtx = null;
  u.skillCd = u.skillMax = cd * (u === B.leader ? .8 : 1); addEnergy(u, 10);
  if (!B.instant) sfx('ult');
  return true;
}
function lineHit(u, mult, c, w) {
  const F = foesOf(u), p = upos(u);
  if (!B.instant) fx({ k: 'beam', x1: p.x, y1: p.y - unitH(u) * .6, x2: p.x + u.aimx * B.W * 1.2, y2: p.y - unitH(u) * .6 + u.aimy / DEPTH * B.H * .47 * 1.2 / 100 * 100 * .0 + u.aimy * 0, c, w, d: .35 });
  F.forEach(f => { const dx = f.x - u.x, dy = (f.y - u.y) * DEPTH; const along = dx * u.aimx + dy * u.aimy; const perp = Math.abs(dx * u.aimy - dy * u.aimx); if (along > 0 && perp < 70) hit(u, f, mult, { big: 1, kb: 80 }); });
}
function useUlt(u) {
  if (u && !u.dead && u.energy >= 100) u.pose = .6;
  if (!u || u.dead || u.energy < 100 || disabled(u) || B.ended) return;
  u.energy = 0; const F = foesOf(u), A = friendsOf(u), p = upos(u), t = nearest(u, F);
  banner(u); if (!B.instant) { B.hitstop = .12; if (u.side === 'a') { punch(.07); buzz(50); } }
  if (!B.instant) sfx(['blade', 'hawkeye', 'swarm', 'eclipse', 'glitch', 'codeh'].includes(u.id) ? 'boom' : 'ult');
  if (u.side === 'a') track('ult');
  switch (u.id) {
    case 'ironwall': A.forEach(f => { f.st.wall = 5; ringAt(f, '#5BC0FF', 60); }); break;
    case 'pug': F.forEach(f => { f.st.taunt = 5; f.tauntBy = u; }); heal(u, u, u.maxHp * .3); ringAt(u, '#7DFF6A', 160); break;
    case 'blade': u.x = 820; clampPos(u); F.forEach(f => { if (!B.instant) { const q = upos(f); fx({ k: 'slash', x: q.x, y: q.y - unitH(f) * .5, c: '#FF3D9A', d: .35, r: 50 }); } hit(u, f, 3, { ult: 1, big: 1, kb: 200 }); }); B.shake = .35; break;
    case 'reaper': for (let i = 0; i < 5; i++) later(i * .13, () => { const fs = foesOf(u); if (!fs.length || u.dead) return; const tt = fs.slice().sort((a, b) => a.hp - b.hp)[0]; u.x = tt.x - 50 * (Math.random() < .5 ? 1 : -1); u.y = tt.y; clampPos(u); aimAt(u, tt); if (!B.instant) fx({ k: 'slash', x: upos(tt).x, y: upos(tt).y - unitH(tt) * .5, c: '#FF4B5C', d: .2, r: 32 }); hit(u, tt, 1.3, { ult: 1 }); }); break;
    case 'hawkeye': if (t) aimAt(u, t); lineHit(u, 5, '#FFB627', 12); B.shake = .3; break;
    case 'specter': { const tt = F.slice().sort((a, b) => b.atk - a.atk)[0]; if (tt) { tt.st.mark = 8; tt.markV = .6; hit(u, tt, 2.6, { ult: 1, big: 1 }); ringAt(tt, '#FF3D9A', 70); } break; }
    case 'glitch': F.forEach(f => { f.st.stun = Math.max(f.st.stun, f.boss ? 1.5 : 2.5); f.wind = null; f.st.stunFx = 1; hit(u, f, .5, { ult: 1, noCrit: 1 }); ringAt(f, '#A874FF', 50); }); B.shake = .25; break;
    case 'neuro': { const tt = F.filter(f => !f.boss).sort((a, b) => b.atk - a.atk)[0]; if (tt) { tt.st.charm = 5; tt.wind = null; ringAt(tt, '#FF7AB8', 70); } else if (F[0]) { F[0].st.stun = 1.5; F[0].wind = null; } break; }
    case 'nano': A.forEach(f => { heal(u, f, f.maxHp * .4 + u.atk * 2); ringAt(f, '#7DFF6A', 50); }); break;
    case 'halo': A.forEach(f => { f.shield += Math.round(f.maxHp * .35); f.shieldT = 10; ringAt(f, '#FFD54A', 55); }); break;
    case 'volt': B.turrets.push({ src: u, x: u.x + u.face * 50, y: u.y, t: 10, cd: 0, big: true }); ringAt(u, '#FFB627', 100); break;
    case 'swarm': F.forEach((f, i) => later(i * .06, () => shoot(u, f, 2.2, { c: '#FFB627', speed: 800, w: 5, ult: 1 }))); later(.5, () => { B.shake = .3; }); break;
    case 'chrono': F.forEach(f => { f.st.freeze = 3; f.wind = null; hit(u, f, 1.2, { ult: 1 }); }); if (!B.instant) fx({ k: 'clock', x: B.W / 2, y: B.H * .6, d: 1 }); B.shake = .2; break;
    case 'eclipse': { const cx = t ? t.x : 700, cy = t ? t.y : 50; if (!B.instant) fx({ k: 'hole', x: sx(cx), y: sy(cy), d: 1 }); F.forEach(f => { f.pull = { x: cx, y: cy, t: .7 }; }); later(.7, () => { foesOf(u).forEach(f => hit(u, f, 3, { ult: 1, big: 1 })); B.shake = .45; if (!B.instant) fx({ k: 'ring', x: sx(cx), y: sy(cy), c: '#A874FF', r: 220, d: .5 }); }); break; }
  }
}
function banner(u) {
  if (B.instant || !B.el) return;
  const d = document.createElement('div'); d.className = 'ultband ' + (u.side === 'a' && u.st.charm <= 0 ? 'ally' : 'foe');
  const c = u.side === 'a' ? 'var(--pink)' : 'var(--red)';
  d.innerHTML = `<img class="cutin" src="${imgSrc(u.id, u.frame)}" alt=""><div class="ubt"><small>${u.side === 'a' ? 'ULTIMATE' : 'ENEMY'} · ${esc(u.m.n)}</small><b style="color:${c};text-shadow:0 0 18px ${ELEMS[u.el].c}">${esc(u.m.ult)}</b></div>`;
  $('#b-field', B.el).appendChild(d); setTimeout(() => d.remove(), 1000);
}

/* ---------- 적 공격 (경고 범위) ---------- */
function enemyStartAttack(u, t) {
  aimAt(u, t);
  if (u.id === 'codeh' && u.energy >= 100) { // 보스: 큰 내려찍기
    u.energy = 0; u.wind = { kind: 'circle', x: u.x, y: u.y, r: 300, t: 1.7, max: 1.7, mult: 2.4, ult: 1 };
    if (!B.instant) { banner(u); toast('CODE-H가 기가 임팩트를 충전해요! 빨간 원 밖으로 피하거나 기절시켜 끊으세요', 'bad'); }
    return;
  }
  if (u.energy >= 100) { // 일반 적 궁극기: 대상 자리 큰 원
    u.energy = 0; u.wind = { kind: 'circle', x: t.x, y: t.y, r: u.boss ? 240 : 170, t: 1.2, max: 1.2, mult: u.boss ? 2.4 : 2, ult: 1 };
    if (!B.instant) { banner(u); }
    return;
  }
  if (MELEE(u.role) || u.boss) u.wind = { kind: 'arc', x: u.x, y: u.y, r: u.boss ? 200 : 130, ax: u.aimx, ay: u.aimy, t: .55, max: .55, mult: u.boss ? 1.3 : 1 };
  else u.wind = { kind: 'bolt', tx: t.x, ty: t.y, t: .55, max: .55, mult: 1 };
}
function enemyResolve(u) {
  u.pose = .28;
  const w = u.wind; u.wind = null; u.atkCd = (1.25 + rnd(0, .5)) * BAL.erate * (u.furyRate || 1) / Math.min(1.4, u.spd / 100);
  const targets = foesOf(u);
  if (w.kind === 'bolt') { enemyBolt(u, w.tx, w.ty, w.mult); return; }
  let hitAny = false;
  for (const t of targets) {
    const inside = w.kind === 'circle' ? Math.hypot(t.x - w.x, (t.y - w.y) * DEPTH) < w.r : inArc({ x: w.x, y: w.y }, t, w.r, w.ax, w.ay, .25);
    if (inside) { hit(u, t, w.mult, { area: 1, ult: w.ult, kb: w.ult ? 220 : 90 }); hitAny = true; }
  }
  if (!B.instant) { const p = { x: sx(w.x), y: sy(w.y) }; if (w.kind === 'circle') { fx({ k: 'ring', x: p.x, y: p.y, c: '#FF4B5C', r: w.r / 1000 * B.W, d: .45 }); B.shake = w.ult ? .45 : .15; parts(p.x, p.y, '#FF4B5C', 18, 320); } else fx({ k: 'slash', x: p.x + w.ax * 50, y: p.y - 40, c: '#FF4B5C', d: .2, r: 40 }); if (w.ult) sfx('boom'); }
}

/* ---------- 진행 ---------- */
function runBattle(cfg) {
  if (cfg.pay) { cfg.pay(); cfg.pay = null; save(); }
  const pr = battlePrefs();
  if (cfg.waves) cfg.enemies = cfg.waves[0];
  B = {
    cfg, t: 0, rt: 0, time: cfg.time || 90, speed: 1, auto: cfg.forceAuto ? true : !!pr.auto, ended: false, shake: 0, retreatArm: 0, instant: !!cfg.instant,
    units: [], fx: [], parts: [], shots: [], bolts: [], zones: [], turrets: [], orbs: [], props: [], caps: [], hazards: [], q: [], capT: 9, propT: 0, nextBurst: 25, burst: 0, hitstop: 0, slow: 0, perfectCd: 0, swapCd: 0,
    theme: cfg.theme !== undefined ? cfg.theme : [...(cfg.title || '')].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 10,
    mode: cfg.mode || 'elim', wave: 0, kills: 0, inp: { x: 0, y: 0 }, keys: {}, leader: null,
  };
  B.syn = synergyOf(cfg.allies.map(a => a.id));
  const ebuff = cfg.enemies.some(e => e.real) ? synergyOf(cfg.enemies.map(e => e.id)).buff : null;
  for (const a of cfg.allies) B.units.push(mkUnit('a', a, addBuffs(cfg.buffs, B.syn.buff)));
  for (const e of cfg.enemies) B.units.push(mkUnit('e', e, ebuff));
  B.target = B.units.find(u => u.isTarget) || null;
  B.units.filter(u => u.side === 'e').forEach(giveAffix);
  if (FUN.props && !cfg.noProps) for (let i = 0; i < 2; i++) spawnProp();
  if (cfg.cargo) {
    const ally = B.units.filter(u => u.side === 'a');
    const hp = Math.round(ally.reduce((s, u) => s + u.maxHp, 0) / ally.length * 3.2);
    B.cargo = { side: 'a', id: 'cargo', cargo: true, m: { n: '화물 드론', role: 'cargo', el: 'mech', sz: .62, ult: '' }, role: 'cargo', el: 'mech', slot: 9, x: 70, y: 55, vx: 0, vy: 0, face: 1,
      maxHp: hp, hp, atk: 1, def: ally.reduce((s, u) => s + u.def, 0) / ally.length, spd: 1, crit: 0, frame: 0, energy: 0, inv: 0, st: { stun: 0, mark: 0, taunt: 0, charm: 0, freeze: 0, weak: 0, slow: 0, wall: 0 }, shield: 0, shieldT: 0,
      dead: false, deadT: 0, flash: 0, dmgDone: 0, dmgTaken: 0, healDone: 0 };
    B.units.push(B.cargo);
  }
  for (const u of B.units) {
    if (u.id === 'ironwall') B.units.filter(f => f.side === u.side && MELEE(f.role) && !f.boss && !f.cargo).forEach(f => { f.def *= 1.15; });
    if (u.id === 'halo') B.units.filter(f => f.side === u.side && !f.cargo).forEach(f => { f.shield += Math.round(f.maxHp * .1); f.shieldT = 999; });
  }
  const lead = u => (u.role === 'assault' ? 3 : u.role === 'guardian' ? 1 : 0) * 1e6 + u.atk; // 돌격 > 가디언 > 원거리, 같은 역할이면 공격력 순
  B.leader = fighters('a').sort((a, b) => lead(b) - lead(a))[0];
  B.maxA = B.units.filter(u => u.side === 'a' && !u.cargo).reduce((s, u) => s + u.maxHp, 0);
  B.maxE = B.units.filter(u => u.side === 'e').reduce((s, u) => s + u.maxHp, 0);
  B.done = new Promise(r => { B.resolveDone = r; });
  if (B.instant) { // 시뮬레이션: 한 번에 끝까지
    const bb = B; B.W = 1000; B.H = 500; let n = 0; while (B === bb && !bb.ended && n < 20000) { update(1 / 30); n++; } if (B === bb && !bb.ended) finish('timeout');
    closeBattle(bb); return bb.done;
  }
  B.intro = B.introMax = 1.4;
  for (const u of B.units) if (!u.cargo) { u.tx = u.x; u.x0 = u.side === 'a' ? u.x - 380 : u.x + 380; u.x = u.x0; }
  buildBattleDom();
  return B.done;
}
function update(dt) {
  if (B.intro > 0) { // 등장: 양쪽에서 뛰어 들어와요
    B.intro -= dt; const k = Math.min(1, (1 - Math.max(0, B.intro) / B.introMax) / .6), e = 1 - Math.pow(1 - k, 3);
    for (const u of B.units) if (u.tx !== undefined) { u.x = u.x0 + (u.tx - u.x0) * e; u.moving = k < 1; u.face = u.side === 'a' ? 1 : -1; }
    if (!B.fightSfx && B.intro < B.introMax * .45) { B.fightSfx = 1; sfx('ult'); }
    if (B.intro <= 0) for (const u of B.units) { if (u.tx !== undefined) { u.x = u.tx; u.moving = false; delete u.tx; } }
    for (const pt of B.parts) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += 500 * dt; pt.life -= dt; }
    return;
  }
  if (B.hitstop > 0) { B.hitstop -= dt; return; }
  if (B.finale > 0) { B.finale -= dt; if (B.finale <= 0) { finish(B.finaleKind); return; } }
  B.counter = Math.max(0, (B.counter || 0) - dt); B.hitT = Math.max(0, (B.hitT || 0) - dt); if (B.hitT <= 0) { B.hits = 0; B.nextBurst = 25; }
  B.hurtFx = Math.max(0, (B.hurtFx || 0) - dt); B.atkBuf = Math.max(0, (B.atkBuf || 0) - dt);
  const ts = B.slow > 0 ? .35 : 1; if (B.slow > 0) B.slow -= dt;
  const g = dt * ts;
  B.t += g; B.time -= g;
  B.nanoT = (B.nanoT || 0) + g; if (B.nanoT >= 5) { B.nanoT = 0; for (const n of B.units) if (n.id === 'nano' && !n.dead) fighters(n.side).forEach(f => heal(n, f, f.maxHp * .03)); } B.perfectCd = Math.max(0, B.perfectCd - dt); B.swapCd = Math.max(0, B.swapCd - dt);
  B.q.sort((a, b) => a.t - b.t);
  while (B.q.length && B.q[0].t <= B.t) { const e = B.q.shift(); if (!B.ended) e.fn(); }
  const L = B.leader;
  for (const u of B.units) {
    if (B.ended) return;
    if (u.dead) { u.deadT += u.fly ? dt : g; continue; }
    u.hurt = Math.max(0, (u.hurt || 0) - g);
    for (const k in u.st) if (u.st[k] > 0) u.st[k] = Math.max(0, u.st[k] - g);
    if (u.shieldT > 0) { u.shieldT -= g; if (u.shieldT <= 0) u.shield = 0; }
    u.flash = Math.max(0, u.flash - g); u.inv = Math.max(0, u.inv - g); if (u.inv <= 0) u.dodging = false;
    u.atkCd = Math.max(0, (u.atkCd || 0) - g); u.skillCd = Math.max(0, (u.skillCd || 0) - g); u.dodgeCd = Math.max(0, (u.dodgeCd || 0) - g); u.comboT = Math.max(0, (u.comboT || 0) - g); u.lunge = Math.max(0, (u.lunge || 0) - g); u.pose = Math.max(0, (u.pose || 0) - g);
    if (u.cargo) continue;
    if (u.side === 'a') addEnergy(u, 2 * g);
    // 밀려남·돌진
    if (u.dash) { u.x += u.dash.vx * g; u.y += u.dash.vy * g / DEPTH; u.dash.t -= g; if (u.dash.t <= 0) u.dash = null;
      if (!B.instant && u.side === 'a') { u.trailT = (u.trailT || 0) - g; if (u.trailT <= 0) { u.trailT = .035; const q = upos(u); fx({ k: 'ghost', u, x: q.x, y: q.y, face: u.face, d: .22, tint: 1 }); } } }
    if (u.vx) { u.x += u.vx * g; u.vx *= Math.pow(.02, g); if (Math.abs(u.vx) < 5) u.vx = 0; }
    if (u.pull) { u.x += (u.pull.x - u.x) * Math.min(1, g * 5); u.y += (u.pull.y - u.y) * Math.min(1, g * 5); u.pull.t -= g; if (u.pull.t <= 0) u.pull = null; }
    clampPos(u);
    if (disabled(u)) { if (u.wind && u.side === 'e') { u.wind = null; if (!B.instant) { const p = upos(u); fx({ k: 'txt', x: p.x, y: p.y - unitH(u) - 30, s: 'BREAK!', c: '#2DE2E6', big: true, d: 1 }); } } continue; }
    const spdMul = u.st.slow > 0 ? .5 : 1;
    if (u === L && !B.auto) { controlLeader(u, g, spdMul); continue; }
    if (u.side === 'a' && u.st.charm <= 0) allyAI(u, g, spdMul); else enemyAI(u, g, spdMul);
  }
  separate(g);
  // 투사체
  for (const s of B.shots) {
    if (s.tg.dead) { s.done = true; continue; }
    const dx = s.tg.x - s.x, dy = (s.tg.y - s.y) * DEPTH, d = Math.hypot(dx, dy);
    if (!B.instant) { s.trail.push([s.x, s.y]); if (s.trail.length > (s.src === B.leader ? 8 : 4)) s.trail.shift(); }
    const step = s.speed * g;
    if (d <= step + 20) { s.done = true; hit(s.src, s.tg, s.mult, { ult: s.o.ult, big: s.o.big, fin: s.o.fin, kb: s.o.fin ? 140 : 0 }); if (s.o.onHit) s.o.onHit(s.tg); }
    else { s.x += dx / d * step; s.y += dy / d * step / DEPTH; }
  }
  B.shots = B.shots.filter(s => !s.done);
  for (const b of B.bolts) {
    const dx = b.tx - b.x, dy = (b.ty - b.y) * DEPTH, d = Math.hypot(dx, dy), step = b.speed * g;
    if (d <= step) { b.done = true; foesOf(b.src).forEach(t => { if (Math.hypot(t.x - b.tx, (t.y - b.ty) * DEPTH) < b.r) hit(b.src, t, b.mult, { area: 1 }); }); if (!B.instant) parts(sx(b.tx), sy(b.ty) - 30, '#FF4B5C', 6, 160); }
    else { b.x += dx / d * step; b.y += dy / d * step / DEPTH; }
  }
  B.bolts = B.bolts.filter(b => !b.done);
  // 장판 · 포탑
  for (const z of B.zones) {
    z.t -= g; z.tick -= g; if (z.follow) { z.x = z.follow.x; z.y = z.follow.y; }
    if (z.tick <= 0) {
      z.tick = .5;
      if (z.kind === 'virus') alive(z.side === 'a' ? 'e' : 'a').forEach(f => { if (Math.hypot(f.x - z.x, (f.y - z.y) * DEPTH) < z.r) { f.st.slow = 1; f.st.weak = 1; hit(z.src, f, .25, { noCrit: 1 }); } });
      if (z.kind === 'heal') alive(z.side).forEach(f => { if (Math.hypot(f.x - z.x, (f.y - z.y) * DEPTH) < z.r) heal(z.src, f, f.maxHp * .035 + z.src.atk * .3); });
    }
  }
  B.zones = B.zones.filter(z => z.t > 0);
  for (const tr of B.turrets) {
    tr.t -= g; tr.cd -= g;
    if (tr.cd <= 0) { tr.cd = tr.big ? .35 : .55; const f = nearest(tr, foesOf(tr.src)); if (f) shoot({ ...tr.src, x: tr.x, y: tr.y, face: Math.sign(f.x - tr.x) || 1, side: tr.src.side, atk: tr.src.atk, el: tr.src.el, crit: tr.src.crit, st: tr.src.st, dmgDone: 0, energy: 0 }, f, tr.big ? .8 : .55, { c: '#FFB627', speed: 1400 }); }
  }
  B.turrets = B.turrets.filter(t => t.t > 0);
  updateFun(g, dt);
  // 코어: 조작 용병이 가까이 가면 빨려 와요
  for (const o of B.orbs) {
    o.life -= g; const ld = L && !L.dead ? Math.hypot(L.x - o.x, (L.y - o.y) * DEPTH) : 1e9;
    if (ld < 200 || B.auto) { o.x += (L.x - o.x) * Math.min(1, g * 8); o.y += (L.y - o.y) * Math.min(1, g * 8); }
    if (ld < 40 || (B.auto && o.life < 6)) { o.got = true; fighters('a').forEach(a => addEnergy(a, a === L ? 18 : 8)); if (!B.instant) { const p = upos(L); fx({ k: 'txt', x: p.x, y: p.y - unitH(L) - 20, s: '+⚡', c: '#2DE2E6', d: .7 }); sfx('reward'); } tip('orb', '쓰러진 적이 떨군 코어 근처로 가면 빨려 들어와 에너지가 차요'); }
  }
  B.orbs = B.orbs.filter(o => !o.got && o.life > 0);
  for (const pt of B.parts) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += 500 * dt; pt.life -= dt; }
  B.parts = B.parts.filter(p => p.life > 0);
  checkEnd();
}
/* ---------- 재미 요소: 폭발 드럼통 · 보급 캡슐 · 버스트 모드 · 적 변이 ---------- */
const FUN = { props: false, caps: false }; // 드럼통 · 보급 캡슐 (빼 둠)
const leadHaste = u => (u.buff && u.buff.haste > 0 ? .6 : 1) * (B.burst > 0 ? .72 : 1);
const CAPS = {
  rage: { n: '광폭', d: '8초 동안 공격력 +50%', c: '#FF6B8E', ic: '⚔' },
  haste: { n: '가속', d: '8초 동안 공격·이동 속도 +40%', c: '#4DB4FF', ic: '»' },
  shield: { n: '방어막', d: '체력 35% 보호막', c: '#FFFFFF', ic: '◇' },
  heal: { n: '응급 키트', d: '아군 모두 체력 25% 회복', c: '#5ED37A', ic: '+' },
  ult: { n: '에너지 셀', d: '에너지 +50 (동료 +25)', c: '#9C86FF', ic: '⚡' },
};
function giveAffix(u) {
  if (u.real || u.boss || u.cargo || u.isTarget || B.cfg.noAffix) return;
  const lv = (u.tpl && u.tpl.lv) || 1, ch = Math.min(.35, .1 + lv * .012);
  if (Math.random() > ch) return;
  u.affix = Math.random() < .5 ? 'bomb' : 'fury';
  if (u.affix === 'fury') { u.atk *= 1.2; u.mv *= 1.3; u.furyRate = .75; }
}
function spawnProp() {
  const top = B.props.some(p => p.y < 50); B.props.push({ x: rnd(430, 600), y: top ? rnd(62, 88) : rnd(12, 38), dead: false, born: B.t });
}
function blowProp(pr) {
  if (pr.dead) return; pr.dead = true;
  const src = B.leader && !B.leader.dead ? B.leader : fighters('a')[0]; if (!src) return;
  alive('e').forEach(f => { if (!f.cargo && Math.hypot(f.x - pr.x, (f.y - pr.y) * DEPTH) < 180) hit(src, f, 2.4, { kb: 340, big: 1, area: 1 }); });
  if (!B.instant) {
    const q = { x: sx(pr.x), y: sy(pr.y) - 20 };
    fx({ k: 'burst', x: q.x, y: q.y, c: '#FFB627', r: 150, d: .45 }); fx({ k: 'ring', x: q.x, y: q.y + 16, c: '#FF8A3D', r: 180 / 1000 * B.W, d: .5, flat: 1 });
    fx({ k: 'txt', x: q.x, y: q.y - 40, s: 'BOOM!', c: '#FFB627', sz: 28, pop: 1, d: .9 });
    parts(q.x, q.y, '#FFB627', 30, 380); parts(q.x, q.y, '#FF4B5C', 16, 300); sfx('boom'); shakeIt(.35); punch(.05); buzz(40);
  }
  B.propT = 18;
}
function dropCap() {
  const kinds = Object.keys(CAPS), k = pick(kinds), L = B.leader;
  const x0 = L ? clamp(L.x + rnd(-200, 260), 120, 760) : rnd(250, 650);
  B.caps.push({ k, x: x0, y: rnd(12, 88), t: 11, fall: .7 });
  if (!B.instant) { sfx('reward'); tip('cap', '하늘에서 떨어진 보급 캡슐을 밟으면 강화 효과를 받아요'); }
}
function takeCap(c) {
  c.got = true; const L = B.leader; if (!L) return; const K = CAPS[c.k];
  L.buff = L.buff || {};
  if (c.k === 'rage') L.buff.rage = 8; if (c.k === 'haste') L.buff.haste = 8;
  if (c.k === 'shield') { L.shield += Math.round(L.maxHp * .35); L.shieldT = 10; }
  if (c.k === 'heal') fighters('a').forEach(f => heal(L, f, f.maxHp * .25));
  if (c.k === 'ult') fighters('a').forEach(f => addEnergy(f, f === L ? 50 : 25));
  if (!B.instant) { const q = upos(L); fx({ k: 'txt', x: q.x, y: q.y - unitH(L) - 44, s: K.n + '!', c: K.c, sz: 24, pop: 1, d: 1 }); fx({ k: 'ring', x: q.x, y: q.y - 30, c: K.c, r: 110, d: .5 }); fx({ k: 'txt', x: q.x, y: q.y - unitH(L) - 20, s: K.d, c: '#FFFFFF', sz: 13, d: 1.3 }); sfx('perfect'); buzz(25); }
}
function startBurst() {
  B.burst = 6; B.nextBurst = B.hits + 30;
  if (B.instant) return;
  const L = B.leader, q = upos(L);
  fx({ k: 'txt', x: q.x, y: q.y - unitH(L) - 50, s: 'BURST MODE!', c: '#FFD25C', sz: 30, pop: 1, d: 1.2 }); fx({ k: 'ring', x: q.x, y: q.y - 30, c: '#FFD25C', r: 160, d: .6 });
  sfx('charge2'); punch(.06); shakeIt(.2); buzz(50);
  tip('burst', '25연속 타격을 넘기면 BURST MODE! 6초 동안 더 빠르고 더 세게 때려요');
}
function updateFun(g, dt) {
  // 버스트 · 강화 시간
  if (B.burst > 0) B.burst -= g;
  const L = B.leader;
  if (L && L.buff) for (const k in L.buff) L.buff[k] = Math.max(0, L.buff[k] - g);
  // 드럼통: 날아온 적이 부딪히거나 우리 탄이 맞으면 터져요
  for (const pr of B.props) {
    if (pr.dead) continue;
    for (const e of alive('e')) if (Math.abs(e.vx) > 160 && Math.hypot(e.x - pr.x, (e.y - pr.y) * DEPTH) < 55) { blowProp(pr); break; }
    if (!pr.dead) for (const s of B.shots) if (s.src.side === 'a' && Math.hypot(s.x - pr.x, (s.y - pr.y) * DEPTH) < 34) { s.done = true; blowProp(pr); break; }
  }
  B.props = B.props.filter(p => !p.dead);
  if (FUN.props && !B.cfg.noProps && B.props.length < 1) { B.propT -= g; if (B.propT <= 0) { spawnProp(); B.propT = 18; } }
  // 보급 캡슐
  if (FUN.caps) B.capT -= g; if (B.capT <= 0) { B.capT = rnd(14, 18); if (B.caps.length < 2) dropCap(); }
  for (const c of B.caps) {
    if (c.fall > 0) { c.fall -= g; continue; }
    c.t -= g;
    if (L && !L.dead && (Math.hypot(L.x - c.x, (L.y - c.y) * DEPTH) < 60 || (B.auto && c.t < 9))) takeCap(c);
  }
  B.caps = B.caps.filter(c => !c.got && c.t > 0);
  // 자폭 범위
  for (const h of B.hazards) {
    h.t -= g; if (h.t > 0) continue; h.done = true;
    for (const t of B.units) if (!t.dead && Math.hypot(t.x - h.x, (t.y - h.y) * DEPTH) < h.r) {
      if (t.side === 'a') hit(h.src, t, 1.6, { area: 1, kb: 200, noCrit: 1 }); else if (L) hit(L, t, 1.4, { kb: 200, noCrit: 1 });
    }
    if (!B.instant) { const q = { x: sx(h.x), y: sy(h.y) }; fx({ k: 'burst', x: q.x, y: q.y - 20, c: '#FF4B5C', r: 120, d: .4 }); parts(q.x, q.y - 20, '#FF4B5C', 24, 340); sfx('boom'); shakeIt(.25); }
  }
  B.hazards = B.hazards.filter(h => !h.done);
}
function drawFun(x, kx, ky) {
  // 자폭 경고 원
  for (const h of B.hazards) {
    const k = 1 - Math.max(0, h.t) / h.max; x.save(); x.translate(sx(h.x), sy(h.y)); x.scale(kx, ky);
    x.fillStyle = 'rgba(255,75,92,.14)'; x.beginPath(); x.arc(0, 0, h.r, 0, 7); x.fill();
    x.strokeStyle = `rgba(255,75,92,${.6 + .4 * Math.sin(B.rt * 26)})`; x.lineWidth = 3 / kx; x.stroke();
    x.fillStyle = 'rgba(255,75,92,.4)'; x.beginPath(); x.arc(0, 0, h.r * k, 0, 7); x.fill(); x.restore();
  }
  // 드럼통
  for (const pr of B.props) {
    const px = sx(pr.x), py = sy(pr.y), s = clamp(B.H * .05, 18, 30) * depthS(pr.y), h = s * 1.5, pulse = .5 + .5 * Math.sin(B.rt * 5 + pr.x);
    x.save(); x.fillStyle = 'rgba(0,0,0,.45)'; x.beginPath(); x.ellipse(px, py, s * 1.1, s * .32, 0, 0, 7); x.fill();
    const g = x.createLinearGradient(px - s, 0, px + s, 0); g.addColorStop(0, '#5a3a10'); g.addColorStop(.45, '#d98a1a'); g.addColorStop(1, '#4a2e0c');
    x.fillStyle = g; x.fillRect(px - s, py - h, s * 2, h);
    x.fillStyle = '#1b1208'; for (let i = 0; i < 4; i++) { x.save(); x.beginPath(); x.rect(px - s, py - h * .62, s * 2, h * .22); x.clip(); x.translate(px - s + i * s * .6, py - h * .62); x.rotate(-.6); x.fillRect(0, -4, s * .25, h); x.restore(); }
    x.fillStyle = '#7a5216'; x.beginPath(); x.ellipse(px, py - h, s, s * .3, 0, 0, 7); x.fill();
    x.globalCompositeOperation = 'lighter'; x.fillStyle = `rgba(255,140,40,${.35 + .4 * pulse})`; x.beginPath(); x.arc(px, py - h * .3, s * .35, 0, 7); x.fill();
    x.restore();
    if (B.t - pr.born < 4) { x.save(); x.font = '700 11px "IBM Plex Sans KR", sans-serif'; x.textAlign = 'center'; x.fillStyle = '#FFB627'; x.globalAlpha = .9; x.fillText('때리면 펑!', px, py - h - 10); x.restore(); }
  }
  // 보급 캡슐
  for (const c of B.caps) {
    const K = CAPS[c.k], px = sx(c.x), gy = sy(c.y), fall = Math.max(0, c.fall) / .7, py = gy - fall * B.H * .6, bob = c.fall > 0 ? 0 : Math.sin(B.rt * 4) * 4, r = clamp(B.H * .032, 12, 20);
    x.save();
    if (c.fall <= 0) { const sg = x.createRadialGradient(px, gy, 1, px, gy, r * 2.4); sg.addColorStop(0, K.c + '88'); sg.addColorStop(1, K.c + '00'); x.globalCompositeOperation = 'lighter'; x.fillStyle = sg; x.beginPath(); x.ellipse(px, gy, r * 2.4, r * .8, 0, 0, 7); x.fill(); x.globalCompositeOperation = 'source-over'; }
    if (c.t < 3 && Math.floor(B.rt * 8) % 2) x.globalAlpha = .4;
    x.translate(px, py - r * 1.6 + bob); x.shadowColor = K.c; x.shadowBlur = 16;
    x.fillStyle = '#18213F'; x.strokeStyle = K.c; x.lineWidth = 3; x.beginPath();
    for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i - Math.PI / 2; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); x.fill(); x.stroke();
    x.shadowBlur = 0; x.fillStyle = K.c; x.font = `700 ${Math.round(r * 1.05)}px "IBM Plex Sans KR", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(K.ic, 0, 1);
    if (c.fall <= 0) { x.font = '700 11px "IBM Plex Sans KR", sans-serif'; x.textBaseline = 'alphabetic'; x.fillStyle = '#fff'; x.strokeStyle = 'rgba(7,6,15,.9)'; x.lineWidth = 3; x.strokeText(K.n, 0, -r - 6); x.fillText(K.n, 0, -r - 6); }
    x.restore();
  }
}
function separate(g) { // 서로 겹치지 않게 살짝 밀어내요
  const us = B.units.filter(u => !u.dead && !u.cargo), k = Math.min(1, g * 10);
  for (let i = 0; i < us.length; i++) for (let j = i + 1; j < us.length; j++) {
    const a = us[i], b = us[j], min = (a.boss || b.boss) ? 85 : a.side === b.side ? 52 : 40;
    let dx = b.x - a.x, dy = (b.y - a.y) * DEPTH, d = Math.hypot(dx, dy);
    if (d >= min) continue; if (d < .01) { dx = rnd(-1, 1); dy = rnd(-1, 1); d = Math.hypot(dx, dy); }
    const push = (min - d) / 2 * k, wa = a.boss ? 0 : b.boss ? 2 : 1, wb = b.boss ? 0 : a.boss ? 2 : 1;
    a.x -= dx / d * push * wa; a.y -= dy / d * push * wa / DEPTH; b.x += dx / d * push * wb; b.y += dy / d * push * wb / DEPTH;
    clampPos(a); clampPos(b);
  }
}
function controlLeader(u, g, spdMul) {
  let ix = B.inp.x, iy = B.inp.y; const k = B.keys;
  if (k.left) ix = -1; if (k.right) ix = 1; if (k.up) iy = -1; if (k.down) iy = 1;
  if (k.left || k.right || k.up || k.down) { const d = Math.hypot(ix, iy) || 1; ix /= d; iy /= d; B.inp.x = ix; B.inp.y = iy; }
  else if (!B.stick) { B.inp.x = 0; B.inp.y = 0; }
  const hm = u.buff && u.buff.haste > 0 ? 1.4 : 1;
  if (!u.dash && (ix || iy)) { u.x += ix * u.mv * 1.15 * hm * spdMul * g; u.y += iy * u.mv * 1.15 * hm / DEPTH * spdMul * g; if (Math.abs(ix) > .2) u.face = Math.sign(ix); u.aimx = ix; u.aimy = iy * .5; clampPos(u); u.moving = true; } else u.moving = false;
  if (u.moving && !B.instant) { u.dustT = (u.dustT || 0) - g; if (u.dustT <= 0) { u.dustT = .14; const q = upos(u); B.parts.push({ x: q.x - u.face * 10, y: q.y - 2, vx: -u.face * rnd(20, 60), vy: -rnd(20, 50), life: .3, c: 'rgba(190,180,240,.45)', s: rnd(3, 5) }); } }
  if (B.mouseAtk && B.mouseW && !u.moving && Math.abs(B.mouseW.x - u.x) > 8) u.face = Math.sign(B.mouseW.x - u.x);
  if (k.atk || B.holdAtk || B.mouseAtk || (B.atkBuf > 0 && u.atkCd <= 0)) leaderAttack(u);
}
function allyAI(u, g, spdMul) {
  const F = foesOf(u); if (!F.length) return;
  if (u.side === 'a' && u.st.charm <= 0 && u.energy >= 100 && (B.auto || (u !== B.leader && u.autoUlt))) { useUlt(u); return; }
  if (u.role === 'medic') { const w = friendsOf(u).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]; if (w && w.hp / w.maxHp < .6 && u.atkCd <= 0) { if (dist(u, w) > u.range) moveTo(u, w, g, spdMul); else { heal(u, w, u.atk * 2.2); u.atkCd = 1.5 / Math.min(1.3, u.spd / 100); if (!B.instant) { const a = upos(u), b = upos(w); fx({ k: 'beam', x1: a.x, y1: a.y - unitH(u) * .6, x2: b.x, y2: b.y - unitH(w) * .5, c: '#7DFF6A', w: 2, d: .2 }); } } return; } }
  // 경고 범위 안이면 30% 확률로 비켜서기
  if (!u.dodgeTry) u.dodgeTry = 0; u.dodgeTry -= g;
  if (u.dodgeTry <= 0) { u.dodgeTry = .4; for (const e of alive('e')) if (e.wind && e.wind.kind !== 'bolt' && Math.random() < .15) { const w = e.wind; const inside = w.kind === 'circle' ? Math.hypot(u.x - w.x, (u.y - w.y) * DEPTH) < w.r : inArc({ x: w.x, y: w.y }, u, w.r, w.ax, w.ay, .25); if (inside) { u.dash = { vx: (u.x < w.x ? -1 : 1) * 700, vy: 0, t: .2 }; break; } } }
  let t = u.target && !u.target.dead && F.includes(u.target) ? u.target : null;
  if (!t || Math.random() < .01) { const raid = B.cargo && !B.cargo.dead && Math.random() < .6 ? F.filter(f => f.target === B.cargo).sort((a, b) => dist(a, B.cargo) - dist(b, B.cargo))[0] : null; t = raid || (u.tauntBy && u.st.taunt > 0 ? u.tauntBy : (B.mode === 'hunt' && B.target && !B.target.dead ? B.target : nearest(u, F))); u.target = t; }
  if (!t) return;
  if (u.skillCd <= 0 && dist(u, t) < Math.max(u.range, 260) && !(u.id === 'nano' && friendsOf(u).every(f => f.hp / f.maxHp > .8))) { aimAt(u, t); useSkill(u); return; }
  if (dist(u, t) > u.range * .9) { moveTo(u, t, g, spdMul); return; }
  aimAt(u, t);
  if (u.atkCd <= 0) {
    u.atkCd = 1.45 / Math.min(1.3, u.spd / 100);
    if (MELEE(u.role)) { u.lunge = .14; u.pose = .26; if (!B.instant) { const b = upos(t); fx({ k: 'arc', x: upos(u).x + u.aimx * 10, y: upos(u).y - unitH(u) * .5, r: unitH(u) * .3, a: Math.atan2(u.aimy * .35, u.aimx), sw: 1.8, c: ELEMS[u.el].c, w: unitH(u) * .045, d: .14, dim: 1 }); } hit(u, t, u.role === 'guardian' ? .85 : 1, { kb: 40 }); }
    else { shoot(u, t, { sniper: 1.15, hacker: .9, medic: .6, engineer: 1 }[u.role] || 1); u.pose = .22; }
    if (u.id === 'neuro' && !t.dead) t.st.slow = Math.max(t.st.slow, 1);
    if (u.id === 'glitch' && Math.random() < .12 && !t.boss) { t.st.stun = Math.max(t.st.stun, .8); }
    if (u.id === 'volt') { const o = F.filter(f => f !== t); if (o.length) hit(u, pick(o), .35, { extra: 1 }); }
    if (u.id === 'swarm') later(.15, () => { if (!t.dead) shoot(u, t, .25, { c: '#5BC0FF', extra: 1 }); });
  }
}
function moveTo(u, t, g, spdMul) {
  const dx = t.x - u.x, dy = (t.y - u.y) * DEPTH, d = Math.hypot(dx, dy) || 1;
  u.x += dx / d * u.mv * spdMul * g; u.y += dy / d * u.mv * spdMul * g / DEPTH; if (Math.abs(dx) > 4) u.face = Math.sign(dx); u.moving = true; clampPos(u);
}
function enemyAI(u, g, spdMul) {
  addEnergy(u, (u.m.boss ? 6 : 4) * g);
  if (u.wind) { u.wind.t -= g; if (u.wind.t <= 0) enemyResolve(u); return; }
  if (u.side === 'a') { allyAI(u, g, spdMul); return; } // 장악된 아군
  const F = foesOf(u); if (!F.length) return;
  if (B.mode === 'hunt' && u === B.target && B.t >= (B.cfg.escape || 20)) { u.x += 160 * g; u.face = 1; if (u.x >= 960) { u.dead = true; u.escaped = true; finish('escape'); } return; }
  let t = u.st.taunt > 0 && u.tauntBy && !u.tauntBy.dead ? u.tauntBy : null;
  if (!t) { if (!u.target || u.target.dead || Math.random() < .004) { const r = Math.random(); u.target = B.cargo && !B.cargo.dead && r < .25 ? B.cargo : (u.role === 'assault' || u.role === 'sniper') && r < .7 ? pick(F) : nearest(u, F); } t = u.target; }
  if (!t) return;
  const rng = u.range * (MELEE(u.role) || u.boss ? .85 : .9);
  if (dist(u, t) > rng) { moveTo(u, t, g, spdMul * .9); return; }
  aimAt(u, t);
  if (u.atkCd <= 0) enemyStartAttack(u, t);
}
function checkEnd() {
  if (B.ended) return true;
  const mates = fighters('a');
  if (B.finale > 0) return false;
  const finale = () => { if (B.instant || REDUCED) { finish('win'); return true; } B.finale = .85; B.finaleKind = 'win'; B.slow = .85; punch(.09); fx({ k: 'flash', d: .25 }); return false; };
  if (B.mode === 'hunt' && B.target && B.target.dead && !B.target.escaped) return finale();
  if (!mates.length) { finish('lose'); return true; }
  if (B.cargo && B.cargo.dead) { finish('cargo'); return true; }
  if (B.mode === 'survive') { if (B.time <= 0) { finish('win'); return true; } }
  else if (!fighters('e').length && !B.spawnT) {
    if (B.cfg.waves && B.wave < B.cfg.waves.length - 1) { B.spawnT = 1; later(1, spawnWave); return false; }
    return finale();
  }
  if (B.time <= 0) { finish('timeout'); return true; }
  return false;
}
function spawnWave() {
  B.spawnT = 0; B.wave++; const nu = B.cfg.waves[B.wave].map(e => mkUnit('e', e)); nu.forEach(u => { u.x = 1000 + rnd(0, 80); }); B.units.push(...nu);
  B.maxE = nu.reduce((s, u) => s + u.maxHp, 0);
  if (!B.instant && B.el) { const d = document.createElement('div'); d.className = 'ultband foe'; d.innerHTML = `<div class="ubt"><small>INCOMING</small><b style="color:var(--amber)">WAVE ${B.wave + 1} / ${B.cfg.waves.length}</b></div>`; $('#b-field', B.el).appendChild(d); setTimeout(() => d.remove(), 1000); sfx('ult'); }
}
function tip(k, msg) { if (!B || B.instant || !S.seen.tips || S.seen.tips[k] || B.ended) return; S.seen.tips[k] = 1; toast('TIP · ' + msg, 'gold'); }


/* ---------- 화면 · 조작 ---------- */
function buildBattleDom() {
  const cfg = B.cfg;
  const el = document.createElement('div'); el.id = 'battle'; el.className = 'action';
  const team = Array.from({ length: SQUAD_N }, (_, slot) => slot).map(slot => {
    const u = B.units.find(x => x.side === 'a' && x.slot === slot && !x.cargo);
    if (!u) return `<div class="tm empty"></div>`;
    return `<button class="tm" data-slot="${slot}" aria-label="${esc(u.m.n)}로 교체"><span class="tult" data-ult="${slot}" role="button" aria-label="${esc(u.m.n)} 궁극기">궁</span>
      <div class="tpf"><img src="${imgSrc(u.id, u.frame)}" alt=""><span class="tno px">${slot + 1}</span><span class="tnm">${esc(u.m.n)}</span></div>
      <div class="thp"><i></i></div><div class="ten"><i></i></div></button>`;
  }).join('');
  el.innerHTML = `<div class="wrap">
    <div class="score"><div class="side l"><b>${esc(cfg.allyName || (S.crew ? S.crew.name : 'SCM 용병단'))}</b><div class="gauge"><i id="b-hpa" style="--gc:var(--lime)"></i></div></div>
      <div class="timer"><span id="b-time">${Math.ceil(B.time)}</span></div>
      <div class="side r"><b>${esc(cfg.enemyName)}</b><div class="gauge"><i id="b-hpe" style="--gc:var(--red)"></i></div></div></div>
    <div class="ctl"><div class="bt">${esc(cfg.title)}</div>
      <button class="tg px ${B.auto ? 'on' : ''}" id="b-auto">AUTO ${B.auto ? 'ON' : 'OFF'}</button><button class="tg" id="b-help" aria-label="조작법">?</button><button class="tg" id="b-ret">후퇴</button></div>
    <div class="obj" id="b-obj"></div>
    <div class="field" id="b-field"><canvas id="b-cv"></canvas></div>
    <div class="team" id="b-team">${team}</div>
    <div class="pad" id="b-pad">
      <div class="stickzone" id="b-stick"><div class="sbase"><div class="knob"></div></div><small>이동 · WASD</small></div>
      <div class="abtns">
        <button class="ab ult" id="a-ult" aria-label="궁극기"><i class="fill"></i><b>궁극기</b><small class="kh">I</small></button>
        <button class="ab skill" id="a-skill" aria-label="스킬"><i class="cdv"></i><b id="a-skn">스킬</b><small class="kh">L</small><span class="cdt"></span></button>
        <button class="ab dodge" id="a-dodge" aria-label="회피"><i class="cdv"></i><b>회피</b><small class="kh">K · 우클릭</small></button>
        <button class="ab atk" id="a-atk" aria-label="공격"><b>공격</b><small class="kh">J · 클릭</small></button>
      </div></div></div>`;
  document.body.appendChild(el);
  B.el = el; B.cv = $('#b-cv', el); B.ctx = B.cv.getContext('2d');
  // 컴퓨터: 전장 왼쪽 클릭 = 공격(누르고 있으면 계속, 커서 쪽 적을 노려요), 오른쪽 클릭 = 회피
  const mouseW = ev => { const r = B.cv.getBoundingClientRect(); B.mouseW = { x: clamp((ev.clientX - r.left) / r.width * 1000, 0, 1000), y: clamp(((ev.clientY - r.top) / r.height - .47) / .47 * 100, 0, 100) }; };
  B.cv.addEventListener('pointerdown', ev => {
    if (ev.pointerType !== 'mouse' || !B || B.ended || !B.leader) return; ev.preventDefault(); mouseW(ev);
    if (ev.button === 2) { doDodge(B.leader); return; }
    if (ev.button !== 0) return;
    B.mouseAtk = true; try { B.cv.setPointerCapture(ev.pointerId); } catch (e) { }
    if (B.mouseW.x !== undefined && Math.abs(B.mouseW.x - B.leader.x) > 8) B.leader.face = Math.sign(B.mouseW.x - B.leader.x);
    leaderAttack(B.leader);
  });
  B.cv.addEventListener('pointermove', ev => { if (B && B.mouseAtk) mouseW(ev); });
  const mup = ev => { if (B && ev.pointerType === 'mouse') B.mouseAtk = false; };
  B.cv.addEventListener('pointerup', mup); B.cv.addEventListener('pointercancel', mup);
  B.cv.addEventListener('contextmenu', ev => ev.preventDefault());
  // 팀 교체 · 동료 궁극기
  $$('.tm[data-slot]', el).forEach(b => {
    b.addEventListener('pointerdown', ev => {
      ev.preventDefault();
      const u = B.units.find(x => x.side === 'a' && x.slot === +b.dataset.slot && !x.cargo); if (!u) return;
      if (ev.target.closest('.tult')) { useUlt(u); return; }
      swapTo(u);
    });
  });
  // 조이스틱
  const zone = $('#b-stick', el), base = $('.sbase', zone), knob = $('.knob', zone);
  let sid = null, cx = 0, cy = 0;
  const R = 46;
  zone.addEventListener('pointerdown', ev => {
    ev.preventDefault(); sid = ev.pointerId; zone.setPointerCapture(sid);
    const r = zone.getBoundingClientRect(); cx = ev.clientX; cy = ev.clientY;
    base.style.left = (cx - r.left) + 'px'; base.style.top = (cy - r.top) + 'px'; zone.classList.add('on'); B.stick = true; B.inp.x = 0; B.inp.y = 0; knob.style.transform = '';
  });
  zone.addEventListener('pointermove', ev => {
    if (ev.pointerId !== sid) return;
    let dx = ev.clientX - cx, dy = ev.clientY - cy; const d = Math.hypot(dx, dy);
    if (d > R) { dx = dx / d * R; dy = dy / d * R; }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    const m = Math.min(1, d / R); if (m < .2) { B.inp.x = 0; B.inp.y = 0; } else { const k = 1 / (Math.hypot(dx, dy) || 1); B.inp.x = dx * k; B.inp.y = dy * k; }
  });
  const end = ev => { if (ev.pointerId !== sid) return; sid = null; B.stick = false; B.inp.x = 0; B.inp.y = 0; knob.style.transform = ''; zone.classList.remove('on'); base.style.left = ''; base.style.top = ''; };
  zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
  // 버튼
  const press = (id, fn) => $(id, el).addEventListener('pointerdown', ev => { ev.preventDefault(); if (!B || B.ended) return; fn(); });
  press('#a-atk', () => { B.holdAtk = true; if (B.leader) leaderAttack(B.leader); });
  const rel = () => { if (B) B.holdAtk = false; };
  $('#a-atk', el).addEventListener('pointerup', rel); $('#a-atk', el).addEventListener('pointercancel', rel); $('#a-atk', el).addEventListener('pointerleave', rel);
  press('#a-dodge', () => doDodge(B.leader));
  press('#a-skill', () => { if (B.leader && !useSkill(B.leader) && B.leader.skillCd > 0) sfx('bad'); });
  press('#a-ult', () => { if (B.leader && B.leader.energy < 100) { sfx('bad'); return; } useUlt(B.leader); });
  $('#b-auto', el).onclick = e => { B.auto = !B.auto; e.currentTarget.textContent = 'AUTO ' + (B.auto ? 'ON' : 'OFF'); e.currentTarget.classList.toggle('on', B.auto); saveBattlePrefs(); };
  $('#b-help', el).onclick = () => showHelp();
  $('#b-ret', el).onclick = e => {
    if (B.ended) return;
    if (B.retreatArm > 0) { finish('retreat'); return; }
    B.retreatArm = 2.5; e.currentTarget.textContent = '한 번 더'; e.currentTarget.style.color = 'var(--red)';
  };
  const KEY = { w: 'up', arrowup: 'up', s: 'down', arrowdown: 'down', a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right', j: 'atk' };
  B.onKey = ev => {
    if (!B || B.ended || document.querySelector('#modal')) return;
    const k = ev.key.toLowerCase();
    if (KEY[k]) { B.keys[KEY[k]] = true; ev.preventDefault(); if (k === 'j' && B.leader) leaderAttack(B.leader); return; }
    if (ev.repeat) return;
    if (k === 'k' || k === ' ') { ev.preventDefault(); doDodge(B.leader); }
    else if (k === 'l') useSkill(B.leader);
    else if (k === 'i' || k === 'u') useUlt(B.leader);
    else { const m = /^(Digit|Numpad)([1-5])$/.exec(ev.code); if (m) { const u = B.units.find(x => x.side === 'a' && x.slot === +m[2] - 1 && !x.cargo); if (u) ev.shiftKey ? useUlt(u) : swapTo(u); } }
  };
  B.onKeyUp = ev => { if (!B) return; const k = ev.key.toLowerCase(); if (KEY[k]) B.keys[KEY[k]] = false; };
  B.onBlur = () => { if (B) { B.keys = {}; B.holdAtk = false; B.mouseAtk = false; } };
  window.addEventListener('keydown', B.onKey); window.addEventListener('keyup', B.onKeyUp); window.addEventListener('blur', B.onBlur);
  if (!S.seen.tips) S.seen.tips = {};
  B.ro = new ResizeObserver(resizeField); B.ro.observe($('#b-field', el)); resizeField();
  updateDom();
  if (!S.seen.tips.action) { S.seen.tips.action = 1; save(); setTimeout(showHelp, 250); }
  else setTimeout(() => tip('swap', '아래 초상화를 누르면 조작할 용병이 바뀌고, 들어오면서 한 방 때려요'), 1500);
  B.last = performance.now(); B.raf = requestAnimationFrame(loop);
}
function showHelp() {
  if (!B || B.ended) return; B.paused = true;
  const m = openModal({
    label: 'HOW TO PLAY', title: '조작법', c: 'var(--cyan)',
    html: `<div class="howto">
      <div><b>이동</b><span>왼쪽 아래를 누른 채 끌기 · PC는 WASD / 방향키</span></div>
      <div><b>공격</b><span>누르고 있으면 계속 공격. 근접은 3연타, 원거리는 가까운 적을 자동 조준 (J · 컴퓨터는 전장을 왼쪽 클릭, 원거리는 클릭한 곳 근처 적을 쏴요)</span></div>
      <div><b>회피</b><span>짧게 돌진하며 잠깐 무적. <em>빨간 경고 범위</em>가 터지기 직전에 피하면 PERFECT! 시간이 느려지고 에너지가 차요 (K · 스페이스 · 오른쪽 클릭)</span></div>
      <div><b>스킬</b><span>용병마다 다른 기술, 몇 초마다 다시 써요 (L)</span></div>
      <div><b>궁극기</b><span>에너지가 다 차면 사용. 적을 때리거나 쓰러진 적의 코어를 주우면 차요 (I)</span></div>
      <div><b>교체</b><span>아래 초상화를 누르면 그 용병을 조작해요. 초상화 위 <em>궁</em>을 누르면 동료 궁극기 (1~3 · Shift+1~3)</span></div>
      <div><b>AUTO</b><span>켜면 조작하던 용병도 알아서 싸워요</span></div></div>
      <button class="btn" id="hp-ok" style="width:100%;margin-top:12px">시작</button>`,
    onMount: b => { $('#hp-ok', b).onclick = () => closeModal(); },
    onClose: () => { if (B) { B.paused = false; B.last = performance.now(); } },
  });
  m.style.zIndex = 90; // 전투 화면 위에 띄워요
}
function resizeField() {
  if (!B || !B.el) return; const f = $('#b-field', B.el), r = f.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  B.W = r.width; B.H = r.height; B.cv.width = Math.round(r.width * dpr); B.cv.height = Math.round(r.height * dpr); B.dpr = dpr;
  B.bg = drawFieldBg(r.width, r.height, dpr, B.theme); B.vig = makeVignette(r.width, r.height, dpr); B.rain = null;
}
function loop(now) {
  if (!B || !B.el) return;
  const dt = Math.min(.05, (now - B.last) / 1000); B.last = now; B.rt += dt;
  if (B.retreatArm > 0) { B.retreatArm -= dt; if (B.retreatArm <= 0) { const b = $('#b-ret', B.el); if (b) { b.textContent = '후퇴'; b.style.color = ''; } } }
  if (!B.ended && !B.paused && !document.querySelector('#modal')) update(dt);
  render(dt);
  if (B) B.raf = requestAnimationFrame(loop);
}
function updateDom() {
  if (!B || B.instant || !B.el) return;
  const el = B.el;
  $$('.tm[data-slot]', el).forEach(b => {
    const u = B.units.find(x => x.side === 'a' && x.slot === +b.dataset.slot && !x.cargo); if (!u) return;
    b.classList.toggle('lead', u === B.leader); b.classList.toggle('dead', u.dead);
    b.classList.toggle('ready', u.energy >= 100 && !u.dead && u !== B.leader);
    b.querySelector('.thp i').style.width = (u.hp / u.maxHp * 100) + '%';
    b.querySelector('.ten i').style.width = u.energy + '%';
  });
  const L = B.leader; if (!L) return;
  const sk = $('#a-skn', el); if (sk && sk._id !== L.id) { sk._id = L.id; sk.textContent = kit(L).s.n; }
}
const ROLE_BAR = { a: '#7DFF6A', e: '#FF4B5C' };
function render(rdt) {
  const x = B.ctx, W = B.W, H = B.H; if (!W) return;
  x.setTransform(B.dpr, 0, 0, B.dpr, 0, 0);
  let ox = 0, oy = 0;
  if (B.shake > 0 && !REDUCED) { B.shake -= rdt; const m = Math.min(1, B.shake * 4); ox = rnd(-7, 7) * m; oy = rnd(-5, 5) * m; }
  if (B.kick && B.kick.t > 0 && !REDUCED) { ox += B.kick.x * B.kick.t / .09; B.kick.t -= rdt; }
  x.clearRect(0, 0, W, H);
  B.punch = Math.max(0, (B.punch || 0) - rdt * .35);
  const Lp = B.leader && !B.leader.dead ? upos(B.leader) : { x: W / 2, y: H * .7 }, zf = 1 + (B.punch || 0) + (B.finale > 0 ? .06 : 0);
  if (zf > 1.0005) { x.translate(Lp.x, Lp.y - 40); x.scale(zf, zf); x.translate(-Lp.x, -(Lp.y - 40)); }
  x.drawImage(B.bg, 0, 0, W, H); drawAmbient(x, W, H, rdt, 'back');
  x.translate(ox, oy);
  const kx = W / 1000, ky = H * .47 / 100 / DEPTH; // 바닥 좌표 → 화면
  // 장판
  for (const z of B.zones) {
    x.save(); x.translate(sx(z.x), sy(z.y)); x.scale(kx, ky);
    const c = z.kind === 'heal' ? '125,255,106' : '168,116,255';
    x.fillStyle = `rgba(${c},.14)`; x.strokeStyle = `rgba(${c},${.5 + .3 * Math.sin(B.rt * 6)})`; x.lineWidth = 3 / kx;
    x.beginPath(); x.arc(0, 0, z.r, 0, 7); x.fill(); x.stroke(); x.restore();
  }
  // 적 경고 범위
  for (const u of B.units) {
    if (u.dead || !u.wind || u.wind.kind === 'bolt') continue;
    const w = u.wind, k = 1 - Math.max(0, w.t) / w.max;
    x.save(); x.translate(sx(w.x), sy(w.y)); x.scale(kx, ky);
    const a0 = Math.atan2(w.ay || 0, w.ax || 1), half = Math.acos(.25);
    const shape = r => { x.beginPath(); if (w.kind === 'circle') x.arc(0, 0, r, 0, 7); else { x.moveTo(0, 0); x.arc(0, 0, r, a0 - half, a0 + half); x.closePath(); } };
    x.fillStyle = w.ult ? 'rgba(255,40,70,.16)' : 'rgba(255,75,92,.12)'; shape(w.r); x.fill();
    x.strokeStyle = `rgba(255,75,92,${.6 + .4 * Math.sin(B.rt * 22)})`; x.lineWidth = 3 / kx; shape(w.r); x.stroke();
    x.fillStyle = w.ult ? 'rgba(255,40,70,.42)' : 'rgba(255,75,92,.38)'; shape(w.r * k); x.fill();
    x.restore();
  }
  // 적 탄환 착탄 지점
  for (const b of B.bolts) {
    x.save(); x.translate(sx(b.tx), sy(b.ty)); x.scale(kx, ky); x.strokeStyle = 'rgba(255,75,92,.8)'; x.lineWidth = 2 / kx; x.setLineDash([8 / kx, 6 / kx]);
    x.beginPath(); x.arc(0, 0, b.r, 0, 7); x.stroke(); x.restore();
  }
  for (const u of B.units) if (!u.dead && u.wind && u.wind.kind === 'bolt') {
    const p = upos(u), tx = sx(u.wind.tx), ty = sy(u.wind.ty) - 30; x.save(); x.strokeStyle = 'rgba(255,75,92,.55)'; x.lineWidth = 1.5; x.setLineDash([4, 5]);
    x.beginPath(); x.moveTo(p.x, p.y - unitH(u) * .55); x.lineTo(tx, ty); x.stroke(); x.restore();
  }
  // 포탑
  for (const tr of B.turrets) {
    const tx = sx(tr.x), ty = sy(tr.y), s = tr.big ? 1.4 : 1; x.save(); x.fillStyle = 'rgba(255,182,39,.25)'; x.beginPath(); x.ellipse(tx, ty, 26 * s, 7 * s, 0, 0, 7); x.fill();
    x.fillStyle = '#3a2a10'; x.strokeStyle = '#FFB627'; x.lineWidth = 2; x.beginPath();
    for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i; x.lineTo(tx + Math.cos(a) * 16 * s, ty - 20 * s + Math.sin(a) * 14 * s); } x.closePath(); x.fill(); x.stroke();
    x.fillStyle = '#FFB627'; x.fillRect(tx + 6, ty - 24 * s, 20 * s, 5); x.restore();
  }
  // 코어
  for (const o of B.orbs) {
    const px = sx(o.x), py = sy(o.y) - 22, s = 10 + Math.sin(B.rt * 8) * 2.5;
    x.save(); x.globalAlpha = Math.min(1, o.life / 1.2); x.translate(px, py); x.rotate(Math.PI / 4); x.shadowColor = '#2DE2E6'; x.shadowBlur = 16;
    x.fillStyle = 'rgba(45,226,230,.9)'; x.fillRect(-s / 2, -s / 2, s, s); x.strokeStyle = '#fff'; x.lineWidth = 1.5; x.strokeRect(-s / 2 - 4, -s / 2 - 4, s + 8, s + 8); x.restore();
  }
  // 유닛 (뒤 → 앞)
  const us = B.units.slice().sort((a, b) => a.y - b.y);
  drawFun(x, kx, ky);
  for (const u of us) u.cargo ? drawCargo(x, u) : drawUnit(x, u, rdt);
  // 투사체
  for (const s of B.shots) {
    const Ls = s.src === B.leader, hy = (s.tg && !s.tg.dead ? unitH(s.tg) * .5 : 34), w = Ls ? s.w * 1.8 : s.w, tr = s.trail.length ? s.trail[0] : [s.x, s.y];
    x.save(); x.globalCompositeOperation = 'lighter'; x.lineCap = 'round';
    if (Ls) { x.strokeStyle = s.c; x.globalAlpha = .35; x.lineWidth = w * 3; x.beginPath(); x.moveTo(sx(tr[0]), sy(tr[1]) - hy); x.lineTo(sx(s.x), sy(s.y) - hy); x.stroke(); x.globalAlpha = 1; }
    x.strokeStyle = s.c; x.shadowColor = s.c; x.shadowBlur = Ls ? 18 : 8; x.lineWidth = w; x.beginPath(); x.moveTo(sx(tr[0]), sy(tr[1]) - hy); x.lineTo(sx(s.x), sy(s.y) - hy); x.stroke();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(sx(s.x), sy(s.y) - hy, w * (Ls ? 1 : .8), 0, 7); x.fill(); x.restore();
  }
  for (const b of B.bolts) {
    const px = sx(b.x), py = sy(b.y) - 34, r = 7 + Math.sin(B.rt * 20) * 1.5; x.save(); x.fillStyle = '#FF4B5C'; x.shadowColor = '#FF4B5C'; x.shadowBlur = 16;
    x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(px, py, r * .45, 0, 7); x.fill(); x.restore();
  }
  // 파편
  for (const p of B.parts) {
    x.globalAlpha = Math.min(1, p.life * 3);
    if (p.streak) { x.strokeStyle = p.c; x.lineWidth = p.s * .7; x.lineCap = 'round'; x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(p.x - p.vx * .035, p.y - p.vy * .035); x.stroke(); }
    else { x.fillStyle = p.c; x.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); }
  }
  x.globalAlpha = 1;
  for (const e of B.fx) drawFx(x, e, rdt);
  B.fx = B.fx.filter(e => e.t < e.d + (e.delay || 0));
  x.setTransform(B.dpr, 0, 0, B.dpr, 0, 0);
  drawAmbient(x, W, H, rdt, 'front'); x.drawImage(B.vig, 0, 0, W, H);
  drawBossBar(x, W);
  if (B.intro > 0) drawIntro(x, W, H);
  if (B.slow > 0) { x.save(); x.fillStyle = 'rgba(45,226,230,.08)'; x.fillRect(0, 0, W, H); x.restore(); }
  if (B.hurtFx > 0) { x.save(); const g = x.createRadialGradient(W / 2, H / 2, Math.max(W, H) * .42, W / 2, H / 2, Math.max(W, H) * .78); g.addColorStop(0, 'rgba(255,40,70,0)'); g.addColorStop(1, `rgba(255,40,70,${B.hurtFx * 1.1})`); x.fillStyle = g; x.fillRect(0, 0, W, H); x.restore(); }
  if (B.hits >= 3) { // 연속 타격 수
    B.hitPop = Math.max(0, (B.hitPop || 0) - rdt); const sc = 1 + B.hitPop * 3, al = Math.min(1, B.hitT * 2);
    x.save(); x.globalAlpha = al; x.translate(W - 16, B.units.some(u => u.boss && !u.dead) ? 92 : 54); x.scale(sc, sc); x.textAlign = 'right';
    x.font = '700 38px "Chakra Petch", sans-serif'; x.lineWidth = 5; x.strokeStyle = '#07060F'; x.strokeText(B.hits, -38, 0);
    const hc = B.hits >= 30 ? '#FF3D9A' : B.hits >= 15 ? '#FFB627' : '#2DE2E6'; x.fillStyle = hc; x.shadowColor = hc; x.shadowBlur = 12; x.fillText(B.hits, -38, 0); x.shadowBlur = 0;
    x.font = '700 15px "Chakra Petch", sans-serif'; x.fillStyle = '#fff'; x.strokeText('HIT', 0, -2); x.fillText('HIT', 0, -2);
    x.font = '600 11px "IBM Plex Sans KR", sans-serif'; x.fillStyle = hc; x.fillText(`피해 +${Math.min(30, B.hits)}%`, 0, 16);
    x.fillStyle = 'rgba(255,255,255,.2)'; x.fillRect(-90, 22, 90, 3); x.fillStyle = hc; x.fillRect(-90 * Math.min(1, B.hitT / 2.2), 22, 90 * Math.min(1, B.hitT / 2.2), 3);
    x.restore();
  }
  x.setTransform(1, 0, 0, 1, 0, 0);
  // 화면 위 정보
  const el = B.el, cf = B.cfg, ob = $('#b-obj', el);
  if (ob) {
    let t = '';
    if (B.mode === 'waves') t = `<b>연속전</b> WAVE ${B.wave + 1}/${cf.waves.length} · 적을 모두 쓰러뜨리면 다음 무리가 와요`;
    else if (B.mode === 'hunt') t = `<b>표적</b> ${B.target ? esc(B.target.m.n) : ''} 처치 · ${B.t < (cf.escape || 20) ? `도주까지 <em>${Math.max(0, Math.ceil((cf.escape || 20) - B.t))}초</em>` : '<em style="color:var(--red)">도망치는 중!</em>'}`;
    else if (B.mode === 'escort') t = `<b>호위</b> 화물 드론 <em>${B.cargo ? Math.round(B.cargo.hp / B.cargo.maxHp * 100) : 0}%</em> · 드론이 부서지면 실패`;
    else if (B.mode === 'survive') t = `<b>생존</b> <em>${Math.max(0, Math.ceil(B.time))}초</em> 버티기 · 처치 ${B.kills}`;
    else if (B.mode === 'boss') t = `<b>보스</b> 빨간 원이 차오르면 밖으로 피하세요 · 기절시키면 끊겨요`;
    else t = `<b>섬멸</b> 적을 모두 쓰러뜨리세요`;
    if (ob._t !== t) { ob.innerHTML = t; ob._t = t; }
  }
  const ha = Math.max(0, sideHp('a')) / B.maxA, he = Math.max(0, fighters('e').reduce((s, u) => s + u.hp, 0)) / B.maxE;
  $('#b-hpa', el).style.width = (ha * 100) + '%'; $('#b-hpe', el).style.width = (Math.min(1, he) * 100) + '%';
  const tt = Math.max(0, Math.ceil(B.time)), te = $('#b-time', el); if (te._v !== tt) { te._v = tt; te.textContent = tt; te.parentNode.classList.toggle('low', tt <= 10); }
  updateDom();
  const L = B.leader; if (!L) return;
  const sb = $('#a-skill', el), dd = $('#a-dodge', el), ub = $('#a-ult', el);
  sb.querySelector('.cdv').style.height = (L.skillCd > 0 ? L.skillCd / (L.skillMax || 7) * 100 : 0) + '%'; sb.classList.toggle('cd', L.skillCd > 0);
  const ct = sb.querySelector('.cdt'), cv = L.skillCd > 0 ? Math.ceil(L.skillCd) : ''; if (ct._v !== cv) { ct._v = cv; ct.textContent = cv; }
  dd.querySelector('.cdv').style.height = (L.dodgeCd / .75 * 100) + '%'; dd.classList.toggle('cd', L.dodgeCd > 0);
  ub.querySelector('.fill').style.height = L.energy + '%'; ub.classList.toggle('ready', L.energy >= 100);
  $('#a-atk', el).classList.toggle('ctr', B.counter > 0);
}
function drawCargo(x, u) {
  if (u.dead && u.deadT > .5) return;
  const p = upos(u), s = clamp(Math.min(B.H, B.W) * .09, 34, 64), bob = Math.sin(B.rt * 3) * 4, cx = p.x, cy = p.y - s * 1.2 + bob;
  x.save(); if (u.dead) x.globalAlpha = Math.max(0, 1 - u.deadT / .5);
  const g = x.createRadialGradient(cx, p.y, 2, cx, p.y, s); g.addColorStop(0, 'rgba(255,182,39,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.beginPath(); x.ellipse(cx, p.y, s, 8, 0, 0, 7); x.fill();
  x.fillStyle = u.flash > 0 ? '#fff' : '#2a2140'; x.strokeStyle = '#FFB627'; x.lineWidth = 2; x.shadowColor = '#FFB627'; x.shadowBlur = 10;
  x.fillRect(cx - s / 2, cy - s / 2, s, s * .8); x.strokeRect(cx - s / 2, cy - s / 2, s, s * .8);
  x.shadowBlur = 0; x.fillStyle = '#FFB627'; x.fillRect(cx - s / 2, cy - s * .08, s, 3); x.fillRect(cx - 4, cy - s / 2 - 8, 8, 8);
  x.strokeStyle = '#2DE2E6'; x.beginPath(); x.moveTo(cx - s * .7, cy - s / 2 - 6); x.lineTo(cx + s * .7, cy - s / 2 - 6); x.stroke();
  x.restore(); if (u.dead) return;
  const bw = 58, bx = cx - bw / 2, by = cy - s / 2 - 22;
  x.fillStyle = 'rgba(7,6,15,.8)'; x.fillRect(bx - 1, by - 1, bw + 2, 7); x.fillStyle = '#FFB627'; x.fillRect(bx, by, bw * u.hp / u.maxHp, 5);
  if (u.shield > 0) { x.fillStyle = 'rgba(255,255,255,.85)'; x.fillRect(bx, by, bw * Math.min(1, u.shield / u.maxHp), 2.5); }
  x.font = '700 11px "IBM Plex Sans KR", sans-serif'; x.textAlign = 'center'; x.fillStyle = '#FFB627'; x.fillText('화물 드론', cx, by - 4); x.textAlign = 'start';
}
function drawUnit(x, u, rdt) {
  if (u.dead && u.deadT > (u.fly ? .8 : .6)) return;
  const ai = u.pose > 0 && !u.dead && IMGS_A[u.id] && IMGS_A[u.id][u.frame], useA = !!(ai && ai.complete && ai.naturalWidth); // 공격 자세
  const p = upos(u), hU = unitH(u), [w, h, ax] = useA ? SPR_A[u.id][u.frame] : SPR[u.id][u.frame], s = hU / 300, dw = w * s, dh = h * s;
  let px = p.x, py = p.y;
  if (u.lunge > 0) px += Math.sin(u.lunge / .14 * Math.PI) * 12 * u.face;
  if (u.hurt > 0 && !u.dead) px += Math.sin(u.hurt * 70) * 4 * (u.hurt / .18) + (u.hurtDir || 0) * 5 * (u.hurt / .18);
  const bob = u.moving && !u.dead ? Math.abs(Math.sin(B.rt * 12 + u.bob)) * 4 : 0;
  const L = u === B.leader;
  x.save();
  let rot = 0, sqx = 1, sqy = 1;
  if (u.dead) {
    if (u.fly) { const t = u.deadT; px += u.fly.vx * t * B.W / 1000; py += Math.min(20, (u.fly.vy * t + 450 * t * t) * .6); rot = u.fly.rot * t; x.globalAlpha = Math.max(0, 1 - t / .8); }
    else { x.globalAlpha = Math.max(0, 1 - u.deadT / .6); py += u.deadT * 30; }
  }
  else if (u.inv > 0 && u.side === 'a') x.globalAlpha = .55;
  if (!u.dead) {
    if (u.hurt > 0) { const k = u.hurt / .18; sqx = 1 + .08 * k; sqy = 1 - .07 * k; }
    else if (u.lunge > 0) { const k = Math.sin(u.lunge / .14 * Math.PI); sqx = 1 + .06 * k; sqy = 1 - .04 * k; }
    if (u.moving) rot = u.face * .05; if (u.dash) rot = Math.sign(u.dash.vx || u.face) * .12;
  }
  if (!u.dead) { const br = Math.sin(B.rt * 2.6 + u.bob) * .014; sqy *= 1 + br; sqx *= 1 - br * .5; }
  const ec = u.side === 'a' && u.st.charm <= 0 ? (L ? '45,226,230' : '125,255,106') : '255,60,90';
  if (L && !u.dead && u.pose > 0 && !B.instant) { // 내가 공격하는 순간: 몸 뒤로 속성 색 빛
    const ac = ELEMS[u.el].c, k = Math.min(1, u.pose / .2); x.save(); x.globalCompositeOperation = 'lighter';
    const ag = x.createRadialGradient(px + u.face * dw * .2, py - dh * .5, 4, px + u.face * dw * .2, py - dh * .5, dh * .75); ag.addColorStop(0, ac + '66'); ag.addColorStop(1, ac + '00');
    x.globalAlpha = k; x.fillStyle = ag; x.fillRect(px - dh, py - dh * 1.3, dh * 2, dh * 1.5); x.restore();
  }
  if (L && !u.dead && (B.burst > 0 || (u.buff && (u.buff.rage > 0 || u.buff.haste > 0)))) { // 강화 오라
    const ac = B.burst > 0 ? '255,210,92' : u.buff.rage > 0 ? '255,107,142' : '77,180,255';
    x.save(); x.globalCompositeOperation = 'lighter'; const ag = x.createRadialGradient(px, py - dh * .45, 4, px, py - dh * .45, dh * .7); ag.addColorStop(0, `rgba(${ac},.28)`); ag.addColorStop(1, `rgba(${ac},0)`);
    x.fillStyle = ag; x.fillRect(px - dh, py - dh * 1.2, dh * 2, dh * 1.4); x.restore();
    if (Math.random() < .5 && !B.instant) B.parts.push({ x: px + rnd(-dw * .35, dw * .35), y: py - rnd(0, dh * .8), vx: 0, vy: -rnd(60, 140), life: .5, c: `rgb(${ac})`, s: rnd(2, 3.5) });
  }
  // 바닥 그림자 · 발밑 빛
  if (!u.dead || !u.fly) {
    x.save(); const sg = x.createRadialGradient(px, py, 1, px, py, dw * .5); sg.addColorStop(0, 'rgba(0,0,0,.7)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = sg; x.beginPath(); x.ellipse(px, py, dw * .5, 9 * (u.boss ? 1.6 : 1), 0, 0, 7); x.fill();
    const gg = x.createRadialGradient(px, py, 1, px, py, dw * .48); gg.addColorStop(0, `rgba(${ec},.38)`); gg.addColorStop(1, `rgba(${ec},0)`);
    x.globalCompositeOperation = 'lighter'; x.fillStyle = gg; x.beginPath(); x.ellipse(px, py, dw * .48, 10, 0, 0, 7); x.fill(); x.restore();
  }
  if (L && !u.dead) { x.save(); x.strokeStyle = '#2DE2E6'; x.lineWidth = 2; x.shadowColor = '#2DE2E6'; x.shadowBlur = 10; x.globalAlpha = .8 + .2 * Math.sin(B.rt * 5);
    x.beginPath(); x.ellipse(px, py, dw * .42 + 8, 10, 0, 0, 7); x.stroke();
    x.setLineDash([6, 8]); x.lineDashOffset = -B.rt * 30; x.beginPath(); x.ellipse(px, py, dw * .42 + 15, 14, 0, 0, 7); x.stroke(); x.restore(); }
  if (u.st.freeze > 0) x.filter = 'sepia(1) saturate(2) hue-rotate(5deg) brightness(1.15)';
  else if (u.st.stun > 0) x.filter = 'saturate(.4) brightness(.85)';
  const top = py - dh - bob;
  const img = () => u.side === 'a' ? (useA ? ai : IMGS[u.id][u.frame]) : enemyCanvas(u.id, u.frame, useA);
  const draw = (alpha) => {
    const im = img(); if (!im) return;
    const flip = u.side === 'a' ? u.face < 0 : u.face > 0;
    const P = u.side === 'a' ? 0 : im._P * s, ox = u.side === 'a' ? ax * dw : (1 - ax) * dw + P;
    x.save(); x.translate(px, 0); if (flip) x.scale(-1, 1); if (alpha !== undefined) x.globalAlpha *= alpha;
    x.drawImage(im, -ox, top - P, dw + P * 2, dh + P * 2); x.restore();
  };
  // 젖은 바닥에 비친 모습
  if (!u.dead) {
    const im = img();
    if (im) { const flip = u.side === 'a' ? u.face < 0 : u.face > 0, P = u.side === 'a' ? 0 : im._P * s, ox = u.side === 'a' ? ax * dw : (1 - ax) * dw + P;
      x.save(); x.globalAlpha *= .13; x.translate(px, py + 2); if (flip) x.scale(-1, 1); x.scale(1, -.42); x.drawImage(im, -ox, -dh - P, dw + P * 2, dh + P * 2); x.restore(); }
  }
  if (rot || sqx !== 1 || sqy !== 1) { const cy = u.fly && u.dead ? py - dh / 2 : py; x.translate(px, cy); x.rotate(rot); x.scale(sqx, sqy); x.translate(-px, -cy); }
  draw();
  if (u.flash > 0) { x.globalCompositeOperation = 'lighter'; x.globalAlpha = Math.min(1, u.flash / .12) * .8; draw(); if (u.flash > .07) draw(); }
  x.restore();
  if (u.dead) return;
  // 체력 막대
  const bw = u.boss ? 0 : L ? 62 : 50, bx = px - bw / 2, by = py - hU - 14;
  if (bw) {
    const fr = Math.max(0, u.hp) / u.maxHp; u.chip = u.chip === undefined ? fr : Math.max(fr, u.chip - rdt * .5);
    const col = u.side === 'a' ? (L ? '#2DE2E6' : '#7DFF6A') : (u.isTarget ? '#FFB627' : '#FF4B5C');
    x.save(); x.translate(bx, by);
    x.fillStyle = 'rgba(5,4,12,.85)'; rrect(x, -2, -2, bw + 4, 9, 3); x.fill();
    x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(0, 0, bw * u.chip, 5);
    const hg = x.createLinearGradient(0, 0, 0, 5); hg.addColorStop(0, '#ffffff'); hg.addColorStop(.35, col); hg.addColorStop(1, col); x.fillStyle = hg; x.fillRect(0, 0, bw * fr, 5);
    x.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 1; i < 5; i++) x.fillRect(bw * i / 5, 0, 1, 5);
    if (u.shield > 0) { x.fillStyle = 'rgba(255,255,255,.95)'; x.fillRect(0, -1, bw * Math.min(1, u.shield / u.maxHp), 2); }
    if (u.wind && u.wind.ult) { x.fillStyle = 'rgba(5,4,12,.85)'; x.fillRect(-1, -9, bw + 2, 6); x.fillStyle = Math.floor(B.rt * 10) % 2 ? '#FF4B5C' : '#FFB627'; x.fillRect(0, -8, bw * (1 - u.wind.t / u.wind.max), 4); }
    x.restore();
    if (u.side === 'a') { x.save(); x.fillStyle = 'rgba(5,4,12,.8)'; x.fillRect(bx, by + 6, bw, 2); x.fillStyle = u.energy >= 100 ? '#FF3D9A' : '#A874FF'; x.fillRect(bx, by + 6, bw * u.energy / 100, 2); x.restore(); }
  }
  if (L) { const ay = by - 14 + Math.sin(B.rt * 6) * 3; x.save(); x.fillStyle = '#2DE2E6'; x.shadowColor = '#2DE2E6'; x.shadowBlur = 8; x.beginPath(); x.moveTo(px - 7, ay - 8); x.lineTo(px + 7, ay - 8); x.lineTo(px, ay); x.closePath(); x.fill(); x.restore(); }
  // 상태 태그
  const tags = [];
  if (u.affix === 'bomb') tags.push(['자폭', '#FF4B5C']); if (u.affix === 'fury') tags.push(['광폭', '#FF8A3D']);
  if (u === B.leader && u.buff) { if (u.buff.rage > 0) tags.push(['공격↑', '#FF6B8E']); if (u.buff.haste > 0) tags.push(['가속', '#4DB4FF']); }
  if (u === B.leader && B.burst > 0) tags.push(['BURST', '#FFD25C']);
  if (u.isTarget) tags.push(['표적', '#FFB627']); if (u.wind && u.wind.ult && !u.boss) tags.push(['충전!', '#FF4B5C']);
  if (u.st.stun > 0) tags.push(['기절', '#A874FF']); if (u.st.freeze > 0) tags.push(['정지', '#FFD54A']);
  if (u.st.mark > 0) tags.push(['표식', '#FF3D9A']); if (u.st.charm > 0) tags.push(['장악', '#FF7AB8']);
  if (u.st.wall > 0) tags.push(['철벽', '#5BC0FF']); if (u.st.taunt > 0) tags.push(['도발', '#FFB627']); if (u.st.slow > 0) tags.push(['둔화', '#A39DD0']);
  if (tags.length) {
    x.save(); x.font = '700 10px "IBM Plex Sans KR", sans-serif'; let tx = px - (tags.length * 30) / 2; const ty = (u.boss ? py - hU - 4 : by) - (L ? 30 : 18);
    for (const [t, c] of tags) { x.fillStyle = 'rgba(5,4,12,.85)'; rrect(x, tx, ty, 28, 13, 6); x.fill(); x.strokeStyle = c; x.lineWidth = 1; x.stroke(); x.fillStyle = c; x.textAlign = 'center'; x.fillText(t, tx + 14, ty + 10); tx += 30; }
    x.restore();
  }
}
function rrect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
function drawBossBar(x, W) { // 보스 체력은 화면 위에 크게
  const bo = B.units.find(u => u.boss && u.side === 'e' && !u.dead); if (!bo) return;
  const fr = Math.max(0, bo.hp) / bo.maxHp; bo.chip = bo.chip === undefined ? fr : Math.max(fr, bo.chip - .004);
  const bw = Math.min(W - 40, 520), bx = (W - bw) / 2, by = 30;
  x.save(); x.font = '700 13px "Chakra Petch", "IBM Plex Sans KR", sans-serif'; x.textAlign = 'left'; x.fillStyle = '#FF4B5C'; x.shadowColor = '#FF4B5C'; x.shadowBlur = 8;
  x.fillText(`${bo.m.n}${bo.enraged ? '  · 분노' : ''}`, bx, by - 7); x.shadowBlur = 0;
  x.textAlign = 'right'; x.fillStyle = '#ffffffcc'; x.fillText(`${Math.ceil(fr * 100)}%`, bx + bw, by - 7);
  x.fillStyle = 'rgba(5,4,12,.85)'; rrect(x, bx - 3, by - 3, bw + 6, 16, 4); x.fill(); x.strokeStyle = 'rgba(255,75,92,.6)'; x.lineWidth = 1; x.stroke();
  x.fillStyle = 'rgba(255,255,255,.6)'; x.fillRect(bx, by, bw * bo.chip, 10);
  const g = x.createLinearGradient(0, by, 0, by + 10); g.addColorStop(0, '#ff8a9a'); g.addColorStop(.4, bo.enraged ? '#ff2040' : '#FF4B5C'); g.addColorStop(1, '#a01030'); x.fillStyle = g; x.fillRect(bx, by, bw * fr, 10);
  if (bo.wind && bo.wind.ult) { x.fillStyle = Math.floor(B.rt * 10) % 2 ? '#FFB627' : '#FF4B5C'; x.fillRect(bx, by + 12, bw * (1 - bo.wind.t / bo.wind.max), 3); }
  x.restore();
}
function drawIntro(x, W, H) {
  const t = 1 - B.intro / B.introMax, s = t < .55 ? 'READY' : 'FIGHT!', k = t < .55 ? t / .55 : (t - .55) / .45;
  x.save(); x.textAlign = 'center'; x.font = `800 ${t < .55 ? 34 : 52}px "Chakra Petch", sans-serif`;
  const sc = t < .55 ? 1 : 1.5 - Math.min(1, k * 3) * .5; x.translate(W / 2, H * .42); x.scale(sc, sc);
  x.globalAlpha = t < .55 ? Math.min(1, k * 3) : 1 - Math.max(0, k - .6) / .4;
  x.fillStyle = 'rgba(5,4,12,.6)'; x.fillRect(-W, -34, W * 2, 50);
  x.lineWidth = 6; x.strokeStyle = '#07060F'; x.strokeText(s, 0, 0); x.fillStyle = t < .55 ? '#2DE2E6' : '#FFD54A'; x.shadowColor = x.fillStyle; x.shadowBlur = 18; x.fillText(s, 0, 0);
  x.restore();
}

/* ---------- 전투 배경: 장(챕터)마다 다른 네온 거리 ---------- */
const THEMES = [
  { n: '네온 거리', sky: ['#05040d', '#2a1048'], glow: '#ff3d9a', neon: ['#ff3d9a', '#2de2e6', '#a874ff'], fog: '120,40,150', floor: ['#160f2c', '#06050c'], rain: 1 },
  { n: '녹슨 부두', sky: ['#03080c', '#0f3340'], glow: '#ff8a3d', neon: ['#ff8a3d', '#2de2e6', '#ffd54a'], fog: '30,90,110', floor: ['#0d1a20', '#04080b'], rain: 1 },
  { n: '독안개 하수도', sky: ['#020705', '#0e3020'], glow: '#7dff6a', neon: ['#7dff6a', '#2de2e6', '#c8ff3d'], fog: '50,140,70', floor: ['#0c1a12', '#030805'], rain: 0 },
  { n: '강철 공장', sky: ['#0a0503', '#3a1a08'], glow: '#ffb627', neon: ['#ffb627', '#ff4b5c', '#ffd54a'], fog: '150,80,20', floor: ['#1d130b', '#070403'], rain: 0 },
  { n: '거미줄 암시장', sky: ['#07030c', '#2b0f3f'], glow: '#a874ff', neon: ['#a874ff', '#ff3d9a', '#7dff6a'], fog: '100,40,150', floor: ['#160c22', '#05030a'], rain: 1 },
  { n: '모래 폐허', sky: ['#0b0603', '#4a2610'], glow: '#ffb627', neon: ['#ffb627', '#ff8a3d', '#2de2e6'], fog: '170,100,50', floor: ['#21160d', '#090604'], rain: 0 },
  { n: '전기 연구 단지', sky: ['#020610', '#0c2350'], glow: '#5bc0ff', neon: ['#5bc0ff', '#2de2e6', '#ffffff'], fog: '40,90,170', floor: ['#0b1426', '#03060c'], rain: 1 },
  { n: '질주 고속도로', sky: ['#05030b', '#3a0c34'], glow: '#ff3d9a', neon: ['#ff3d9a', '#ffd54a', '#2de2e6'], fog: '140,30,110', floor: ['#170c1c', '#060308'], rain: 1 },
  { n: '황금 카지노', sky: ['#080502', '#3d2a08'], glow: '#ffd54a', neon: ['#ffd54a', '#ff3d9a', '#ffb627'], fog: '160,120,30', floor: ['#1f170a', '#080603'], rain: 0 },
  { n: '기업 본사', sky: ['#03030a', '#1c1640'], glow: '#c9c3ff', neon: ['#c9c3ff', '#a874ff', '#2de2e6'], fog: '90,80,170', floor: ['#121027', '#04040b'], rain: 1 },
];
const SIGNS = ['BAR', '24H', 'HOTEL', '라멘', '클럽', 'NEO', 'SCM', '電', '龍', 'CYBER', '수리', 'OPEN', '酒', 'DATA'];
function seeded(n) { let a = n * 9301 + 49297; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function drawFieldBg(W, H, dpr, ti = 0) {
  const T = THEMES[ti % THEMES.length], R = seeded(ti + 7), rr = (a, b) => a + R() * (b - a), pk = a => a[Math.floor(R() * a.length)];
  const c = document.createElement('canvas'); c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
  const x = c.getContext('2d'); x.scale(dpr, dpr); c._signs = [];
  const hz = H * .44;
  // 하늘
  let g = x.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, T.sky[0]); g.addColorStop(1, T.sky[1]); x.fillStyle = g; x.fillRect(0, 0, W, hz + 2);
  g = x.createRadialGradient(W * .5, hz, 10, W * .5, hz, W * .7); g.addColorStop(0, T.glow + '55'); g.addColorStop(1, T.glow + '00'); x.fillStyle = g; x.fillRect(0, 0, W, hz);
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(239,236,255,${rr(.08, .4)})`; x.fillRect(rr(0, W), rr(0, hz * .45), 1, 1); }
  // 먼 빌딩 (3겹)
  const layers = [[.95, '#00000055', 0], [.75, '#00000088', 1], [.5, '#000000bb', 2]];
  for (const [hm, col, li] of layers) {
    let px = -20;
    while (px < W + 20) {
      const bw = rr(16, 40) * (1 + li * .35), bh = rr(hz * .18, hz * hm);
      x.fillStyle = T.sky[0]; x.globalAlpha = .55 + li * .2; x.fillRect(px, hz - bh, bw, bh + 2); x.globalAlpha = 1;
      if (R() < .3) { x.fillRect(px + bw * .45, hz - bh - rr(6, 18), 1.5, 18); } // 안테나
      // 창문
      const wc = pk(T.neon);
      for (let wy = hz - bh + 5; wy < hz - 3; wy += 6 + li) for (let wx = px + 3; wx < px + bw - 3; wx += 5 + li)
        if (R() < .16 - li * .03) { x.fillStyle = wc; x.globalAlpha = rr(.25, .7); x.fillRect(wx, wy, 1.6 + li * .4, 2 + li * .5); x.globalAlpha = 1; }
      // 세로 간판
      if (li === 2 && R() < .35 && bh > hz * .25) {
        const sc = pk(T.neon), sw = rr(9, 13), sh = rr(30, 60), sxp = px + rr(0, bw - sw), syp = hz - bh + rr(6, bh * .4);
        x.save(); x.shadowColor = sc; x.shadowBlur = 12; x.strokeStyle = sc; x.lineWidth = 1.5; x.strokeRect(sxp, syp, sw, sh);
        x.fillStyle = sc; x.font = `700 ${sw - 3}px "IBM Plex Sans KR", sans-serif`; x.textAlign = 'center';
        const txt = pk(SIGNS); for (let k = 0; k < Math.min(4, txt.length); k++) x.fillText(txt[k], sxp + sw / 2, syp + 10 + k * (sw + 1));
        x.restore(); c._signs.push({ x: sxp, y: syp, w: sw, h: sh, c: sc, ph: rr(0, 6) });
      }
      px += bw + rr(0, 5);
    }
  }
  // 가로 간판 몇 개
  for (let i = 0; i < 3; i++) {
    const sc = pk(T.neon), txt = pk(SIGNS), sw = 14 + txt.length * 9, sxp = rr(W * .05, W * .9 - sw), syp = rr(hz * .45, hz * .8);
    x.save(); x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(sxp, syp, sw, 16); x.shadowColor = sc; x.shadowBlur = 14; x.strokeStyle = sc; x.lineWidth = 1.5; x.strokeRect(sxp, syp, sw, 16);
    x.fillStyle = sc; x.font = '700 11px "Chakra Petch", "IBM Plex Sans KR", sans-serif'; x.textAlign = 'center'; x.fillText(txt, sxp + sw / 2, syp + 12); x.restore();
    c._signs.push({ x: sxp, y: syp, w: sw, h: 16, c: sc, ph: rr(0, 6) });
  }
  // 지평선 안개
  g = x.createLinearGradient(0, hz - H * .12, 0, hz + H * .06); g.addColorStop(0, `rgba(${T.fog},0)`); g.addColorStop(.7, `rgba(${T.fog},.35)`); g.addColorStop(1, `rgba(${T.fog},0)`);
  x.fillStyle = g; x.fillRect(0, hz - H * .12, W, H * .18);
  // 바닥: 젖은 아스팔트
  g = x.createLinearGradient(0, hz, 0, H); g.addColorStop(0, T.floor[0]); g.addColorStop(1, T.floor[1]); x.fillStyle = g; x.fillRect(0, hz, W, H - hz);
  // 간판이 바닥에 비친 빛
  x.save(); x.globalCompositeOperation = 'lighter';
  for (const s of c._signs) { const gg = x.createLinearGradient(0, hz, 0, hz + (H - hz) * .9); gg.addColorStop(0, s.c + '30'); gg.addColorStop(1, s.c + '00'); x.fillStyle = gg; x.fillRect(s.x - 2, hz, s.w + 4, (H - hz) * .9); }
  x.restore();
  // 보도 경계와 차선
  x.fillStyle = 'rgba(255,255,255,.05)'; x.fillRect(0, hz, W, 3);
  x.strokeStyle = 'rgba(255,255,255,.08)'; x.lineWidth = 1;
  for (let i = 1; i < 9; i++) { const t = i / 9, y = hz + (H - hz) * t * t; x.globalAlpha = .25 + t * .4; x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); }
  x.globalAlpha = 1;
  for (let i = -10; i <= 10; i++) { x.strokeStyle = 'rgba(255,255,255,.035)'; x.beginPath(); x.moveTo(W / 2 + i * W * .03, hz); x.lineTo(W / 2 + i * W * .2, H); x.stroke(); }
  const ly = hz + (H - hz) * .5; x.fillStyle = 'rgba(255,214,90,.22)'; for (let lx = 6; lx < W; lx += 46) x.fillRect(lx, ly, 24, 2);
  // 물웅덩이
  for (let i = 0; i < 5; i++) {
    const cx = rr(0, W), cy = rr(hz + (H - hz) * .2, H * .95), rw = rr(30, 80), rh = rw * .14;
    const gg = x.createRadialGradient(cx, cy, 2, cx, cy, rw); gg.addColorStop(0, pk(T.neon) + '33'); gg.addColorStop(1, '#00000000');
    x.fillStyle = gg; x.beginPath(); x.ellipse(cx, cy, rw, rh, 0, 0, 7); x.fill();
  }
  // 지평선 네온 선
  g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, T.neon[0]); g.addColorStop(.5, T.neon[1]); g.addColorStop(1, T.neon[0]);
  x.save(); x.shadowColor = T.neon[0]; x.shadowBlur = 12; x.globalAlpha = .7; x.fillStyle = g; x.fillRect(0, hz - 1, W, 1.5); x.restore();
  // 양옆 가까운 건물 (화면 틀)
  for (const side of [0, 1]) {
    const bw = W * rr(.05, .09), x0 = side ? W - bw : 0;
    x.fillStyle = '#030208'; x.fillRect(x0, 0, bw, H * .62);
    const sc = pk(T.neon); x.save(); x.shadowColor = sc; x.shadowBlur = 10; x.fillStyle = sc; x.globalAlpha = .8;
    x.fillRect(side ? x0 : x0 + bw - 2, H * rr(.08, .2), 2, H * rr(.15, .3)); x.restore();
    for (let wy = 12; wy < H * .58; wy += 14) if (R() < .4) { x.fillStyle = pk(T.neon) + '66'; x.fillRect(x0 + bw * .3, wy, bw * .4, 3); }
  }
  // 아래쪽 어둡게
  g = x.createLinearGradient(0, H * .82, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.45)'); x.fillStyle = g; x.fillRect(0, H * .82, W, H * .18);
  c._theme = T;
  return c;
}
function makeVignette(W, H, dpr) {
  const c = document.createElement('canvas'); c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
  const x = c.getContext('2d'); x.scale(dpr, dpr);
  const g = x.createRadialGradient(W / 2, H * .55, Math.min(W, H) * .35, W / 2, H * .55, Math.max(W, H) * .78); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)');
  x.fillStyle = g; x.fillRect(0, 0, W, H); return c;
}
function drawAmbient(x, W, H, rdt, layer) { // 깜빡이는 간판(뒤), 비(앞)
  const T = B.bg._theme;
  if (layer === 'back') {
  x.save(); x.globalCompositeOperation = 'lighter';
  for (const s of B.bg._signs) { const f = .5 + .5 * Math.sin(B.rt * 3 + s.ph) * (Math.sin(B.rt * 17 + s.ph * 3) > .93 ? 0 : 1); x.globalAlpha = .1 * f; x.fillStyle = s.c; x.fillRect(s.x - 6, s.y - 6, s.w + 12, s.h + 12); }
  x.restore(); return; }
  if (!T.rain || REDUCED) return;
  if (!B.rain) B.rain = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: rnd(500, 800), l: rnd(8, 16) }));
  x.save(); x.strokeStyle = 'rgba(190,210,255,.22)'; x.lineWidth = 1; x.beginPath();
  for (const d of B.rain) { d.y += d.v * rdt; d.x -= d.v * .15 * rdt; if (d.y > H) { d.y = -10; d.x = Math.random() * W * 1.1; } x.moveTo(d.x, d.y); x.lineTo(d.x + d.l * .15, d.y - d.l); }
  x.stroke(); x.restore();
}



function drawFx(x, e, rdt) {
  e.t += rdt * B.speed; const t0 = e.t - (e.delay || 0); if (t0 < 0) return; const k = Math.min(1, t0 / e.d);
  x.save();
  switch (e.k) {
    case 'beam': x.globalAlpha = 1 - k; x.strokeStyle = e.c; x.lineWidth = e.w; x.shadowColor = e.c; x.shadowBlur = 10; x.beginPath(); x.moveTo(e.x1, e.y1); x.lineTo(e.x2, e.y2); x.stroke(); break;
    case 'slash': x.globalAlpha = 1 - k; x.strokeStyle = e.c; x.lineWidth = 3; x.shadowColor = e.c; x.shadowBlur = 12; x.beginPath(); x.arc(e.x, e.y, e.r, -2.2 + k, -.4 + k); x.stroke(); break;
    case 'ring': { x.globalAlpha = (1 - k) * .9; x.strokeStyle = e.c; x.lineWidth = 3 + (1 - k) * 3; x.shadowColor = e.c; x.shadowBlur = 14; const rr = e.r * (.3 + k * .7); x.beginPath(); if (e.flat) x.ellipse(e.x, e.y, rr, rr * .3, 0, 0, 7); else x.arc(e.x, e.y, rr, 0, 7); x.stroke(); break; }
    case 'txt': { x.globalAlpha = k > .65 ? (1 - k) / .35 : 1; const sz = e.sz || (e.big ? 21 : 15), sc = e.pop && t0 < .1 ? 1.8 - t0 / .1 * .8 : 1, ty = e.y - (e.pop ? 26 * Math.sqrt(k) : 38 * k), tx = e.x + (e.vx || 0) * k;
      x.translate(tx, ty); x.scale(sc, sc); x.font = `700 ${sz}px "Chakra Petch", "IBM Plex Sans KR", sans-serif`; x.textAlign = 'center'; x.lineJoin = 'round'; x.lineWidth = Math.max(3, sz * .2); x.strokeStyle = '#07060F';
      x.strokeText(e.s, 0, 0); x.fillStyle = e.c; x.fillText(e.s, 0, 0); break; }
    case 'arc': { // 베기 궤적
      const head = Math.min(1, t0 / (e.d * .45)), fade = (t0 < e.d * .45 ? 1 : 1 - (t0 - e.d * .45) / (e.d * .55)) * (e.dim ? .45 : 1), dir = e.flip ? -1 : 1;
      const a0 = e.a - dir * e.sw / 2, N = 14; x.translate(e.x, e.y); x.scale(1, .72); x.lineCap = 'round'; x.shadowColor = e.c; x.shadowBlur = e.dim ? 8 : 16;
      if (e.glow) { // 넓게 번지는 빛 (내 공격만)
        x.save(); x.globalCompositeOperation = 'lighter'; const h0 = a0 + dir * e.sw * Math.max(0, head - .7), h1 = a0 + dir * e.sw * head;
        x.globalAlpha = fade * .18; x.strokeStyle = e.c; x.lineWidth = e.w * 2.4; x.beginPath(); x.arc(0, 0, e.r * .9, Math.min(h0, h1), Math.max(h0, h1)); x.stroke();
        x.globalAlpha = fade * .32; x.lineWidth = e.w * 1.3; x.beginPath(); x.arc(0, 0, e.r, Math.min(h0, h1), Math.max(h0, h1)); x.stroke(); x.restore();
      }
      const tail = Math.max(0, head - .8);
      for (let i = 1; i <= N; i++) { const f0 = tail + (head - tail) * (i - 1) / N, f1 = tail + (head - tail) * i / N, q = i / N;
        const s0 = a0 + dir * e.sw * f0, s1 = a0 + dir * e.sw * f1; x.globalAlpha = fade * Math.min(1, q * 1.5); x.strokeStyle = e.c; x.lineWidth = Math.max(1, e.w * q);
        x.beginPath(); x.arc(0, 0, e.r, Math.min(s0, s1), Math.max(s0, s1)); x.stroke(); }
      x.shadowBlur = 0; x.globalAlpha = fade; x.strokeStyle = '#FFFFFF'; x.lineWidth = Math.max(2, e.w * .22);
      const h0 = a0 + dir * e.sw * Math.max(0, head - .35), h1 = a0 + dir * e.sw * head; x.beginPath(); x.arc(0, 0, e.r, Math.min(h0, h1), Math.max(h0, h1)); x.stroke(); break; }
    case 'tracer': { x.globalCompositeOperation = 'lighter'; x.lineCap = 'round'; const f = 1 - k;
      x.globalAlpha = f * .45; x.strokeStyle = e.c; x.lineWidth = e.w * 3 * f + 1; x.beginPath(); x.moveTo(e.x1, e.y1); x.lineTo(e.x2, e.y2); x.stroke();
      x.globalAlpha = f; x.shadowColor = e.c; x.shadowBlur = 14; x.lineWidth = e.w * f + 1; x.beginPath(); x.moveTo(e.x1, e.y1); x.lineTo(e.x2, e.y2); x.stroke();
      x.strokeStyle = '#fff'; x.lineWidth = Math.max(1, e.w * .35 * f); x.beginPath(); x.moveTo(e.x1, e.y1); x.lineTo(e.x2, e.y2); x.stroke(); break; }
    case 'slashmark': { x.translate(e.x, e.y); x.rotate(e.a); x.globalCompositeOperation = 'lighter'; x.lineCap = 'round'; const g = Math.min(1, t0 / (e.d * .35)), f = 1 - Math.max(0, (t0 - e.d * .35) / (e.d * .65));
      x.globalAlpha = f; x.shadowColor = e.c; x.shadowBlur = 16; x.strokeStyle = e.c; x.lineWidth = e.r * .22 * f + 2; x.beginPath(); x.moveTo(-e.r * g, 0); x.lineTo(e.r * g, 0); x.stroke();
      x.strokeStyle = '#fff'; x.lineWidth = e.r * .07 * f + 1; x.beginPath(); x.moveTo(-e.r * g, 0); x.lineTo(e.r * g, 0); x.stroke(); break; }
    case 'nova': { x.globalCompositeOperation = 'lighter'; const R = e.r * (.25 + k * .9), g = x.createRadialGradient(e.x, e.y, 0, e.x, e.y, R);
      g.addColorStop(0, 'rgba(255,255,255,' + (.8 * (1 - k)) + ')'); g.addColorStop(.35, e.c); g.addColorStop(1, 'rgba(0,0,0,0)'); x.globalAlpha = (1 - k) * .55; x.fillStyle = g; x.beginPath(); x.arc(e.x, e.y, R, 0, 7); x.fill(); break; }
    case 'streaks': { x.globalCompositeOperation = 'lighter'; x.strokeStyle = e.c; x.lineCap = 'round'; if (!e.ls) e.ls = Array.from({ length: 6 }, () => [rnd(-.5, .5), rnd(.4, 1), rnd(0, .3)]);
      for (const [oy, l, o] of e.ls) { const kk = Math.min(1, k + o), x0 = e.x - e.dir * e.len * .2 + e.dir * e.len * kk * .6, y0 = e.y + oy * e.len * .35;
        x.globalAlpha = (1 - kk) * .8; x.lineWidth = 3; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x0 + e.dir * e.len * l * .5, y0); x.stroke(); } break; }
    case 'impact': { if (e.rot === undefined) e.rot = rnd(0, 1); x.globalAlpha = 1 - k; x.translate(e.x, e.y); x.rotate(e.rot); x.strokeStyle = e.c; x.shadowColor = e.c; x.shadowBlur = 12; x.lineCap = 'round';
      const R = e.r * (.45 + k * .75); x.lineWidth = 4 * (1 - k) + 1;
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, l = i % 2 ? .55 : 1; x.beginPath(); x.moveTo(Math.cos(a) * R * .35, Math.sin(a) * R * .35); x.lineTo(Math.cos(a) * R * l, Math.sin(a) * R * l); x.stroke(); }
      x.fillStyle = '#FFFFFF'; x.beginPath(); x.arc(0, 0, e.r * .38 * (1 - k), 0, 7); x.fill(); break; }
    case 'burst': { x.translate(e.x, e.y); x.shadowColor = e.c; x.shadowBlur = 18;
      if (k < .35) { x.globalAlpha = 1 - k / .35; x.fillStyle = '#FFFFFF'; x.beginPath(); x.arc(0, 0, e.r * .55, 0, 7); x.fill(); }
      x.globalAlpha = 1 - k; x.strokeStyle = e.c; x.lineWidth = 5 * (1 - k) + 1; x.beginPath(); x.arc(0, 0, e.r * (.3 + k), 0, 7); x.stroke();
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + .2, r0 = e.r * (.4 + k * .8), r1 = r0 + e.r * .45 * (1 - k); x.beginPath(); x.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); x.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); x.stroke(); }
      break; }
    case 'muzzle': { x.globalAlpha = 1 - k; x.translate(e.x, e.y); x.fillStyle = '#FFFFFF'; x.shadowColor = e.c; x.shadowBlur = 18; const R = e.r * (1 - k * .4);
      x.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, l = i % 2 ? R * .35 : R; x.lineTo(Math.cos(a) * l, Math.sin(a) * l * .7); } x.closePath(); x.fill();
      x.fillStyle = e.c; x.globalAlpha = (1 - k) * .6; x.beginPath(); x.arc(0, 0, R * .9, 0, 7); x.fill(); break; }
    case 'flash': x.globalAlpha = .55 * (1 - k); x.fillStyle = '#FFFFFF'; x.fillRect(-B.W, -B.H, B.W * 3, B.H * 3); break;
    case 'missile': { const mx = e.x1 + (e.x2 - e.x1) * k, my = e.y1 + (e.y2 - e.y1) * k - Math.sin(k * Math.PI) * 60;
      x.fillStyle = e.c; x.shadowColor = e.c; x.shadowBlur = 10; x.fillRect(mx - 3, my - 3, 6, 6); if (k >= 1) { x.beginPath(); x.arc(e.x2, e.y2, 22, 0, 7); x.globalAlpha = .6; x.fill(); } break; }
    case 'ghost': { const u = e.u, s = unitH(u) / 300, [w, h, ax] = SPR[u.id][u.frame]; if (u.side !== 'a') break;
      x.globalAlpha = (e.tint ? .45 : .6) * (1 - k); if (e.tint) x.globalCompositeOperation = 'lighter';
      const f = e.face === undefined ? 1 : e.face; x.translate(e.x, 0); x.scale(f < 0 ? -1 : 1, 1); x.drawImage(IMGS[u.id][u.frame], -ax * w * s, e.y - h * s, w * s, h * s); break; }
    case 'clock': x.globalAlpha = (1 - k) * .8; x.strokeStyle = '#FFD54A'; x.lineWidth = 3; x.shadowColor = '#FFD54A'; x.shadowBlur = 20; const R = Math.min(B.W, B.H) * .32;
      x.beginPath(); x.arc(e.x, e.y, R, 0, 7); x.stroke(); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; x.beginPath(); x.moveTo(e.x + Math.cos(a) * R * .85, e.y + Math.sin(a) * R * .85); x.lineTo(e.x + Math.cos(a) * R, e.y + Math.sin(a) * R); x.stroke(); }
      x.beginPath(); x.moveTo(e.x, e.y); x.lineTo(e.x + Math.cos(k * 2 - 1.57) * R * .7, e.y + Math.sin(k * 2 - 1.57) * R * .7); x.stroke(); break;
    case 'hole': x.globalAlpha = k < .8 ? 1 : (1 - k) / .2; const r = 10 + Math.sin(Math.min(1, k * 1.4) * Math.PI / 2) * 46;
      x.fillStyle = '#000'; x.shadowColor = '#A874FF'; x.shadowBlur = 30; x.beginPath(); x.arc(e.x, e.y, r, 0, 7); x.fill(); x.strokeStyle = '#C9A8FF'; x.lineWidth = 3; x.stroke(); break;
  }
  x.restore();
}




/* --- 끝 --- */
function finish(kind) {
  if (!B || B.ended) return; B.ended = true;
  const map = { win: ['승리', 'var(--lime)'], lose: ['패배', 'var(--red)'], timeout: ['시간 초과', 'var(--amber)'], retreat: ['후퇴', 'var(--dim)'], escape: ['표적 도주', 'var(--amber)'], cargo: ['호위 실패', 'var(--red)'] };
  const res = { win: kind === 'win', kind, allyHp: {}, enemyHp: 0, time: B.t };
  B.units.filter(u => u.side === 'a' && !u.cargo).forEach(u => { res.allyHp[u.slot] = u.dead ? 0 : u.hp / u.maxHp; });
  res.enemyHp = Math.max(0, fighters('e').reduce((s, u) => s + u.hp, 0)) / B.maxE;
  res.noDeath = B.units.every(u => u.side !== 'a' || u.cargo || !u.dead);
  res.star3 = B.cfg.star3 ? !!B.cfg.star3.test(B) : B.t <= 45;
  res.stars = res.win ? 1 + (res.noDeath ? 1 : 0) + (res.star3 ? 1 : 0) : 0;
  const cfg = B.cfg, bb = B;
  if (B.instant) { bb.result = res; bb.resolveDone(res); return; }
  B.keys = {}; B.holdAtk = false;
  const d = document.createElement('div'); d.className = 'endband'; d.innerHTML = `<b style="color:${map[kind][1]}">${map[kind][0]}</b>`;
  $('#b-field', B.el).appendChild(d);
  if (kind === 'retreat') { setTimeout(() => { closeBattle(bb); cfg.onEnd(res); refresh(); bb.resolveDone(res); }, 350); return; }
  sfx(res.win ? 'win' : 'lose');
  setTimeout(() => {
    if (res.win) { S.rec.w++; track('win'); } else S.rec.l++;
    GRANT_LOG = [];
    try {
      if (res.win && !cfg.noExp) { const lv = cfg.enemies.reduce((a, e) => a + (e.lv || 6), 0) / cfg.enemies.length; grant({ exp: Math.round(60 + lv * 30) }); }
      cfg.onEnd(res);
    } catch (e) { console.error(e); }
    const logs = GRANT_LOG; GRANT_LOG = null;
    save(); showResult(bb, res, logs, map[kind]); bb.resolveDone(res);
  }, 1000);
}
function closeBattle(bb) {
  cancelAnimationFrame(bb.raf); window.removeEventListener('keydown', bb.onKey); window.removeEventListener('keyup', bb.onKeyUp); window.removeEventListener('blur', bb.onBlur);
  if (bb.ro) bb.ro.disconnect(); if (bb.el) bb.el.remove(); bb.ended = true; if (B === bb) B = null;
}

function showResult(bb, res, logs, head) {
  const allies = bb.units.filter(u => u.side === 'a' && !u.cargo).sort((a, b) => a.slot - b.slot);
  const mx = Math.max(1, ...allies.map(u => Math.max(u.dmgDone, u.dmgTaken, u.healDone)));
  const mvp = allies.slice().sort((a, b) => (b.dmgDone + b.healDone * 1.2 + b.dmgTaken * .4) - (a.dmgDone + a.healDone * 1.2 + a.dmgTaken * .4))[0];
  const cfg = bb.cfg;
  const stars = cfg.stars ? `<div class="stars">${[0, 1, 2].map(i => `<i class="${i < res.stars ? 'on' : ''}" style="animation-delay:${.2 + i * .25}s"></i>`).join('')}</div>
    <div class="starhint"><span class="${res.win ? 'ok' : ''}">승리</span><span class="${res.noDeath && res.win ? 'ok' : ''}">아무도 쓰러지지 않기</span><span class="${res.win && res.star3 ? 'ok' : ''}">${cfg.star3 ? cfg.star3.label : '45초 안에'}</span></div>` : '';
  const rows = allies.map(u => `<div class="mrow ${u === mvp ? 'mvp' : ''}"><div class="face"><img src="${imgSrc(u.id, u.frame)}" alt=""></div>
    <div class="mbars"><div class="mn"><b>${esc(u.m.n)}</b>${u === mvp ? '<span class="tag fill" style="background:var(--amber)">MVP</span>' : ''}${u.dead ? '<span class="dim" style="font-size:11px">쓰러짐</span>' : ''}</div>
    <div class="mb"><i style="width:${u.dmgDone / mx * 100}%;background:var(--pink)"></i><span class="px">${fmt(u.dmgDone)}</span></div>
    <div class="mb"><i style="width:${u.dmgTaken / mx * 100}%;background:var(--cyan)"></i><span class="px">${fmt(u.dmgTaken)}</span></div>
    ${u.healDone > 0 ? `<div class="mb"><i style="width:${u.healDone / mx * 100}%;background:var(--lime)"></i><span class="px">${fmt(u.healDone)}</span></div>` : ''}</div></div>`).join('');
  const tip = res.win ? '' : `<p class="sub" style="color:var(--amber)">${res.kind === 'timeout' ? '시간이 모자랐어요. 스킬과 궁극기를 아끼지 말고, 동료 궁극기(초상화 위 궁)도 함께 쓰세요.' : res.kind === 'escape' ? '표적이 도망쳤어요. 표적에게 바로 달려가 스킬을 집중하세요.' : res.kind === 'cargo' ? '드론이 부서졌어요. 드론 근처에서 싸우고, 드론을 노리는 적부터 처리하세요.' : '빨간 경고 범위를 회피로 피하고, 용병 레벨을 올리거나 적 약점 속성 용병으로 바꿔 보세요.'}</p>`;
  const el = document.createElement('div'); el.className = 'result';
  el.innerHTML = `<div class="rbox box brk" style="--c:${head[1]}"><div class="rhead" style="color:${head[1]}">${head[0]}</div>${stars}
    ${mvp ? `<div class="mvpcard"><img src="${imgSrc(mvp.id, mvp.frame)}" alt=""><div><div class="eyebrow" style="color:var(--amber)">MVP</div><div class="h2">${esc(mvp.m.n)}</div><div class="sub">피해 ${fmt(mvp.dmgDone)}${mvp.healDone ? ` · 회복 ${fmt(mvp.healDone)}` : ''}</div></div></div>` : ''}
    <div class="legend"><span><i style="background:var(--pink)"></i>준 피해</span><span><i style="background:var(--cyan)"></i>받은 피해</span><span><i style="background:var(--lime)"></i>회복</span><span class="px dim">${Math.round(res.time)}초</span></div>
    <div class="meter">${rows}</div>${tip}
    ${logs.length ? `<div class="rewards">${logs.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
    <div class="row rbtns" style="justify-content:center;flex-wrap:wrap">${cfg.retry ? '<button class="btn gray" id="r-retry">다시 도전</button>' : ''}${cfg.next && res.win ? '<button class="btn" id="r-next">다음 스테이지</button>' : ''}<button class="btn ${cfg.next && res.win ? 'gray' : ''}" id="r-ok">확인</button></div></div>`;
  bb.el.appendChild(el);
  const done = then => { closeBattle(bb); refresh(); if (cfg.after) cfg.after(res); if (then) then(); };
  $('#r-ok', el).onclick = () => done();
  if (cfg.retry) $('#r-retry', el).onclick = () => done(cfg.retry);
  if (cfg.next && res.win) $('#r-next', el).onclick = () => done(cfg.next);
}


/* --- 전투 전 정보 --- */
function preBattle(cfg) {
  const mkPow = (side, d, b) => { // 전투 보정(BAL)은 빼고 순수 능력치로 비교해요
    const keep = { ...BAL }; Object.assign(BAL, { ehp: 1, eatk: 1, rhp: 1, ratk: 1, ahp: 1, aatk: 1 });
    try { const u = mkUnit(side, d, b); return unitPower({ hp: u.maxHp, atk: u.atk, def: u.def, spd: u.spd, crit: u.crit }); } finally { Object.assign(BAL, keep); } };
  const syn = synergyOf(cfg.allies.map(a => a.id));
  const ally = Math.round(cfg.allies.reduce((s, a) => s + mkPow('a', a, addBuffs(cfg.buffs, syn.buff)), 0));
  const EN = cfg.waves ? [].concat(...cfg.waves) : cfg.enemies;
  const foe = Math.round(EN.reduce((s, e) => s + mkPow('e', e, null), 0) * (cfg.waves ? .55 : cfg.mode === 'survive' ? 1.5 : 1));
  const r = ally / Math.max(1, foe);
  const verdict = r >= 1.15 ? ['유리', 'var(--lime)'] : r >= .9 ? ['비슷', 'var(--amber)'] : r >= .7 ? ['어려움', 'var(--red)'] : ['위험', 'var(--red)'];
  const els = {}; EN.forEach(e => { const x = unitDef(e.id).el; els[x] = (els[x] || 0) + 1; });
  const beats = { plasma: 'mech', mech: 'bio', bio: 'plasma', quantum: 'void', void: 'quantum' };
  const counter = Object.keys(els).map(x => Object.keys(beats).find(k => beats[k] === x)).filter(Boolean);
  const advice = Object.keys(els).map(x => `${ELEMS[x].n} ${els[x]}`).join(' · ');
  const tip = counter.length ? `적 속성: ${advice}. ${[...new Set(counter)].map(k => ELEMS[k].n).join('·')} 속성 용병이 유리해요.` : '';
  const face = (d, side) => `<div class="pf ${side}"><img src="${imgSrc(d.id, side === 'a' ? frameOf(d.g) : (d.frame || 0))}" alt=""><span class="tag fill e-${unitDef(d.id).el}">${ELEMS[unitDef(d.id).el].n}</span>${side === 'a' ? `<span class="lvb px">${d.mlv || 1}</span>` : ''}</div>`;
  openModal({
    label: 'BRIEFING', title: cfg.title, c: 'var(--cyan)', wide: true,
    html: `<div class="vs"><div><div class="eyebrow" style="color:var(--lime)">OUR SQUAD</div><div class="pfrow">${cfg.allies.map(a => face(a, 'a')).join('')}</div><div class="px pw" style="color:var(--lime)">${fmt(ally)}</div></div>
      <div class="vsmid"><span class="px">VS</span><b style="color:${verdict[1]}">${verdict[0]}</b></div>
      <div><div class="eyebrow" style="color:var(--red)">${esc(cfg.enemyName)}</div><div class="pfrow">${(cfg.waves ? cfg.waves[cfg.waves.length - 1] : cfg.enemies).map(e => face(e, 'e')).join('')}</div><div class="px pw" style="color:var(--red)">${fmt(foe)}</div></div></div>
      ${cfg.objective ? `<div class="objbox" style="--c:${cfg.objective.c}"><b>목표 · ${cfg.objective.n}</b><span>${cfg.objective.d}</span></div>` : ''}
      ${syn.list.length ? `<div class="synrow">${syn.list.map(x => `<span class="syn" style="--sc:${x.c}"><b>${x.n}</b>${x.d}</span>`).join('')}</div>` : '<p class="sub">진형 시너지 없음. 같은 속성 2명, 가디언+메딕 같은 조합으로 보너스를 받아요.</p>'}
      ${tip ? `<p class="sub">${tip}</p>` : ''}${cfg.note ? `<p class="sub" style="color:var(--amber)">${cfg.note}</p>` : ''}
      <div class="row wrap"><button class="btn" id="pb-go" style="flex:1">출격</button><button class="btn gray" id="pb-edit">편성 바꾸기</button></div>`,
    onMount: b => {
      $('#pb-go', b).onclick = () => { closeModal(true); runBattle(cfg); };
      $('#pb-edit', b).onclick = () => { closeModal(true); TAB = 'hq'; refresh(false); toast('본부에서 용병을 눌러 자리를 바꿀 수 있어요'); };
    },
  });
}
