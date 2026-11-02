'use strict';
/* ===== 이미지 미리 불러오기 ===== */
const IMGS = {};
function preloadImages() {
  const ps = [];
  for (const id of MERC_IDS) {
    IMGS[id] = [];
    for (let f = 0; f < 3; f++) {
      const im = new Image(); im.decoding = 'async'; im.src = imgSrc(id, f); IMGS[id][f] = im;
      ps.push(new Promise(r => { im.onload = r; im.onerror = r; }));
    }
  }
  return Promise.all(ps);
}
const TINT = {};
function enemyCanvas(id, f) {
  const k = id + f; if (TINT[k]) return TINT[k];
  const im = IMGS[id][f], [w, h] = SPR[id][f], P = 14;
  if (!im.complete || !im.naturalWidth) return null;
  const c = document.createElement('canvas'); c.width = w + P * 2; c.height = h + P * 2;
  const x = c.getContext('2d');
  x.translate(c.width, 0); x.scale(-1, 1);
  x.shadowColor = 'rgba(255,40,70,.95)'; x.shadowBlur = 10;
  x.drawImage(im, P, P, w, h); x.drawImage(im, P, P, w, h);
  x.setTransform(1, 0, 0, 1, 0, 0); x.shadowBlur = 0;
  x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(255,40,70,.26)'; x.fillRect(0, 0, c.width, c.height);
  c._P = P; TINT[k] = c; return c;
}

/* ===== 전투 ===== */
const APOS = [[39, 58], [41.5, 80], [17, 48], [15, 69], [17, 90]];
const SPEED_KEY = 'scm-battle-prefs';
let B = null;
function battlePrefs() { try { return JSON.parse(localStorage.getItem(SPEED_KEY)) || { sp: 1, auto: false }; } catch (e) { return { sp: 1, auto: false }; } }
function saveBattlePrefs() { try { localStorage.setItem(SPEED_KEY, JSON.stringify({ sp: B.speed, auto: B.auto })); } catch (e) { } }

function squadAllies(hpMap) {
  const out = [];
  S.squad.forEach((id, slot) => {
    if (!id) return; const f = hpMap ? hpMap[slot] : 1; if (f !== undefined && f <= 0) return;
    const o = S.roster[id]; out.push({ id, slot, g: o.g, imp: o.imp, mlv: o.lv || 1, hp: f === undefined ? 1 : f });
  });
  return out;
}
function mkUnit(side, d, buffs) {
  const m = MERCS[d.id];
  const real = side === 'a' || d.real; // d.real: 다른 플레이어의 실제 용병 (아레나·구역 방어 팀)
  const st = real ? mercStats(d.id, d.g, d.imp, 1, d.mlv || 1) : mercStats(d.id, 1, null, lvMul(d.lv));
  if (!real) { st.hp *= .88; st.atk *= .9; }
  if (buffs) { st.hp *= 1 + (buffs.hp || 0); st.atk *= 1 + (buffs.atk || 0); st.def *= 1 + (buffs.def || 0); st.spd *= 1 + (buffs.spd || 0); st.crit += buffs.crit || 0; }
  if (d.boss) { st.hp *= 9; st.atk *= 1.7; st.def *= 1.3; }
  const pos = d.boss ? [73, 78] : APOS[d.slot];
  const u = {
    side, id: d.id, m, role: m.role, el: m.el, slot: d.slot, boss: !!d.boss,
    bx: side === 'a' ? pos[0] : (d.boss ? pos[0] : 100 - pos[0]), by: pos[1],
    maxHp: Math.round(st.hp), atk: st.atk, def: st.def, spd: st.spd, crit: st.crit,
    frame: side === 'a' ? frameOf(d.g) : (d.frame || 0),
    timer: rnd(.2, 1.2), gauge: side === 'a' ? (buffs && buffs.gauge ? 30 : 0) : rnd(0, 20), aiDelay: rnd(.3, 1.6),
    st: { stun: 0, mark: 0, taunt: 0, charm: 0, freeze: 0, weak: 0 }, tauntBy: null, shield: 0, shieldT: 0,
    dead: false, deadT: 0, lunge: 0, lungeDir: 1, flash: 0, ox: 0, oy: 0,
    dmgDone: 0, dmgTaken: 0, healDone: 0, first: true, mlv: d.mlv || 1, g: d.g || 1,
  };
  u.hp = Math.round(u.maxHp * (d.hp === undefined ? 1 : d.hp));
  return u;
}

function addBuffs(a, b) { const o = { ...(a || {}) }; for (const k in b) o[k] = (o[k] || 0) + b[k]; return o; }
function startBattle(cfg) { if (cfg.skipPre) return runBattle(cfg); preBattle(cfg); }
function runBattle(cfg) {
  if (cfg.pay) { cfg.pay(); cfg.pay = null; save(); }
  const pr = battlePrefs();
  B = {
    cfg, t: 0, time: cfg.time || 75, speed: pr.sp || 1, auto: !!pr.auto, ended: false, shake: 0, retreatArm: 0,
    units: [], fx: [], turrets: [], q: [], wall: { a: 0, e: 0 },
  };
  B.syn = synergyOf(cfg.allies.map(a => a.id));
  const ebuff = cfg.enemies.some(e => e.real) ? synergyOf(cfg.enemies.map(e => e.id)).buff : null;
  for (const a of cfg.allies) B.units.push(mkUnit('a', a, addBuffs(cfg.buffs, B.syn.buff)));
  for (const e of cfg.enemies) B.units.push(mkUnit('e', e, ebuff));
  for (const u of B.units) { // 전투 시작 패시브
    if (u.id === 'ironwall') B.units.filter(f => f.side === u.side && f.slot < 2 && !f.boss).forEach(f => { f.def *= 1.15; });
    if (u.id === 'halo') B.units.filter(f => f.side === u.side).forEach(f => { f.shield += Math.round(f.maxHp * .1); f.shieldT = 999; });
  }
  B.startA = sideHp('a'); B.startE = sideHp('e');
  B.maxA = B.units.filter(u => u.side === 'a').reduce((s, u) => s + u.maxHp, 0);
  B.maxE = B.units.filter(u => u.side === 'e').reduce((s, u) => s + u.maxHp, 0);
  const el = document.createElement('div'); el.id = 'battle';
  const ultBtns = [0, 1, 2, 3, 4].map(slot => {
    const u = B.units.find(x => x.side === 'a' && x.slot === slot);
    if (!u) return `<div class="ub dead"><div class="pf"></div><div class="gauge"><i style="width:0"></i></div><div class="un">—</div></div>`;
    return `<button class="ub" data-slot="${slot}" aria-label="${u.m.n} 궁극기 ${u.m.ult}"><div class="pf"><span class="no">${slot + 1}</span><img src="${imgSrc(u.id, u.frame)}" alt=""></div>
      <div class="gauge"><i style="width:0"></i></div><div class="un">${u.m.ult}</div></button>`;
  }).join('');
  el.innerHTML = `<div class="wrap">
    <div class="score"><div class="side l"><b>${esc(cfg.allyName || (S.crew ? S.crew.name : 'SCM 용병단'))}</b><div class="gauge"><i id="b-hpa" style="--gc:var(--lime)"></i></div></div>
      <div class="timer"><span id="b-time">${Math.ceil(B.time)}</span></div>
      <div class="side r"><b>${esc(cfg.enemyName)}</b><div class="gauge"><i id="b-hpe" style="--gc:var(--red)"></i></div></div></div>
    <div class="ctl"><div class="bt">${esc(cfg.title)}</div><button class="tg on px" id="b-sp">x${B.speed}</button>
      <button class="tg px ${B.auto ? 'on' : ''}" id="b-auto">AUTO ${B.auto ? 'ON' : 'OFF'}</button><button class="tg" id="b-ret">후퇴</button></div>
    <div class="field" id="b-field"><canvas id="b-cv"></canvas></div>
    <div class="ults" id="b-ults">${ultBtns}</div></div>`;
  document.body.appendChild(el);
  B.el = el; B.cv = $('#b-cv', el); B.ctx = B.cv.getContext('2d');
  B.ubtn = {}; $$('.ub[data-slot]', el).forEach(b => { B.ubtn[b.dataset.slot] = b; b.addEventListener('click', () => { const u = B.units.find(x => x.side === 'a' && x.slot === +b.dataset.slot); if (u) tryUlt(u, true); }); });
  $('#b-sp', el).onclick = () => { B.speed = B.speed % 3 + 1; $('#b-sp', el).textContent = 'x' + B.speed; saveBattlePrefs(); };
  $('#b-auto', el).onclick = e => { B.auto = !B.auto; e.currentTarget.textContent = 'AUTO ' + (B.auto ? 'ON' : 'OFF'); e.currentTarget.classList.toggle('on', B.auto); saveBattlePrefs(); };
  $('#b-ret', el).onclick = e => {
    if (B.ended) return;
    if (B.retreatArm > 0) { finish('retreat'); return; }
    B.retreatArm = 2.5; e.currentTarget.textContent = '한 번 더'; e.currentTarget.style.color = 'var(--red)';
  };
  B.onKey = ev => { if (/^[1-5]$/.test(ev.key)) { const u = B.units.find(x => x.side === 'a' && x.slot === +ev.key - 1); if (u) tryUlt(u, true); } };
  window.addEventListener('keydown', B.onKey);
  B.ro = new ResizeObserver(resizeField); B.ro.observe($('#b-field', el)); resizeField();
  B.last = performance.now(); B.raf = requestAnimationFrame(loop);
}
function resizeField() {
  if (!B) return; const f = $('#b-field', B.el), r = f.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  B.W = r.width; B.H = r.height; B.cv.width = Math.round(r.width * dpr); B.cv.height = Math.round(r.height * dpr); B.dpr = dpr;
  B.bg = drawFieldBg(r.width, r.height, dpr);
}
function drawFieldBg(W, H, dpr) {
  const c = document.createElement('canvas'); c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
  const x = c.getContext('2d'); x.scale(dpr, dpr);
  const hz = H * .4;
  let g = x.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, '#07060F'); g.addColorStop(1, '#2a1350'); x.fillStyle = g; x.fillRect(0, 0, W, hz);
  for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(239,236,255,${rnd(.1, .5)})`; x.fillRect(rnd(0, W), rnd(0, hz * .7), 1, 1); }
  // 도시 실루엣 (두 겹)
  for (const [layer, col, hmax] of [[0, '#1a1236', .75], [1, '#0e0a22', .5]]) {
    let px = -10;
    while (px < W + 10) {
      const bw = rnd(18, 46), bh = rnd(hz * .15, hz * hmax);
      x.fillStyle = col; x.fillRect(px, hz - bh, bw, bh);
      if (layer === 1) for (let wy = hz - bh + 6; wy < hz - 4; wy += 7) for (let wx = px + 4; wx < px + bw - 4; wx += 6)
        if (Math.random() < .22) { x.fillStyle = pick(['rgba(255,61,154,.55)', 'rgba(45,226,230,.55)', 'rgba(255,182,39,.45)']); x.fillRect(wx, wy, 2, 3); }
      if (layer === 0 && Math.random() < .25) { x.fillStyle = pick(['#FF3D9A', '#2DE2E6', '#A874FF']); x.globalAlpha = .5; x.fillRect(px + bw * .2, hz - bh + 8, bw * .6, 3); x.globalAlpha = 1; }
      px += bw + rnd(0, 6);
    }
  }
  g = x.createLinearGradient(0, hz, 0, H); g.addColorStop(0, '#180f33'); g.addColorStop(1, '#07060F'); x.fillStyle = g; x.fillRect(0, hz, W, H - hz);
  // 원근 격자
  x.lineWidth = 1;
  for (let i = 1; i < 16; i++) { const t = i / 16, y = hz + (H - hz) * t * t; x.strokeStyle = `rgba(255,61,154,${.08 + t * .25})`; x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); }
  for (let i = -14; i <= 14; i++) { x.strokeStyle = 'rgba(45,226,230,.16)'; x.beginPath(); x.moveTo(W / 2 + i * W * .02, hz); x.lineTo(W / 2 + i * W * .16, H); x.stroke(); }
  g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#FF3D9A'); g.addColorStop(1, '#2DE2E6');
  x.shadowColor = '#FF3D9A'; x.shadowBlur = 14; x.fillStyle = g; x.fillRect(0, hz - 1, W, 2); x.shadowBlur = 0;
  return c;
}

/* --- 진행 --- */
const alive = s => B.units.filter(u => u.side === s && !u.dead);
const sideHp = s => B.units.filter(u => u.side === s).reduce((a, u) => a + Math.max(0, u.hp), 0);
function foesOf(u) { if (u.st.charm > 0) return alive(u.side).filter(x => x !== u); return alive(u.side === 'a' ? 'e' : 'a'); }
function friendsOf(u) { return alive(u.side); }
function later(dt, fn) { B.q.push({ t: B.t + dt, fn }); }
function upos(u) {
  const H = B.H, W = B.W;
  return { x: u.bx / 100 * W + u.ox, y: u.by / 100 * H + u.oy };
}
const unitH = u => clamp(Math.min(B.H * .26, B.W * .26), 70, 180) * u.m.sz * (u.boss ? 1.55 : 1);
function pickTarget(u) {
  const foes = foesOf(u); if (!foes.length) return null;
  if (u.st.taunt > 0 && u.tauntBy && !u.tauntBy.dead && foes.includes(u.tauntBy)) return u.tauntBy;
  const front = foes.filter(f => f.slot < 2 || f.boss);
  if (u.role === 'guardian' || u.role === 'assault') { const pool = front.length ? front : foes; return pool.slice().sort((a, b) => Math.abs(a.by - u.by) - Math.abs(b.by - u.by))[0]; }
  if (u.role === 'sniper') return foes.slice().sort((a, b) => a.hp - b.hp)[0];
  return Math.random() < .6 && front.length ? pick(front) : pick(foes);
}
function loop(now) {
  if (!B) return;
  const dt = Math.min(.05, (now - B.last) / 1000); B.last = now;
  if (!B.ended) update(dt * B.speed, dt);
  render(dt);
  B.raf = requestAnimationFrame(loop);
}
function update(gdt, rdt) {
  B.t += gdt; B.time -= gdt;
  if (B.retreatArm > 0) { B.retreatArm -= rdt; if (B.retreatArm <= 0) { const r = $('#b-ret', B.el); r.textContent = '후퇴'; r.style.color = ''; } }
  for (const s of ['a', 'e']) B.wall[s] = Math.max(0, B.wall[s] - gdt);
  B.q.sort((a, b) => a.t - b.t);
  while (B.q.length && B.q[0].t <= B.t) { const e = B.q.shift(); if (!B.ended) e.fn(); }
  for (const u of B.units) {
    if (u.dead) { u.deadT += gdt; continue; }
    for (const k in u.st) if (u.st[k] > 0) u.st[k] = Math.max(0, u.st[k] - gdt);
    if (u.shieldT > 0) { u.shieldT -= gdt; if (u.shieldT <= 0) u.shield = 0; }
    u.lunge = Math.max(0, u.lunge - gdt); u.flash = Math.max(0, u.flash - gdt);
    const disabled = u.st.stun > 0 || u.st.freeze > 0;
    if (!disabled) addGauge(u, 4 * gdt);
    if (u.id === 'nano') friendsOf(u).forEach(f => { if (f.hp < f.maxHp) { const h = f.maxHp * .006 * gdt; f.hp = Math.min(f.maxHp, f.hp + h); u.healDone += h; } });
    if (disabled) continue;
    u.timer -= gdt * u.spd / 100;
    if (u.timer <= 0) { act(u); u.timer = 1.7; }
    if (u.gauge >= 100) {
      if (u.side === 'e' || u.st.charm > 0) { u.aiDelay -= gdt; if (u.aiDelay <= 0) { tryUlt(u); u.aiDelay = rnd(.4, 1.8); } }
      else if (B.auto) { u.aiDelay -= gdt; if (u.aiDelay <= 0) { tryUlt(u); u.aiDelay = rnd(.2, .9); } }
    }
  }
  for (const tr of B.turrets) {
    tr.t -= gdt; tr.cd -= gdt;
    if (tr.cd <= 0 && tr.t > 0) {
      tr.cd = .45; const foes = alive(tr.src.side === 'a' ? 'e' : 'a'); if (foes.length) {
        const tg = pick(foes), p = upos(tg);
        fx({ k: 'beam', x1: tr.x / 100 * B.W, y1: tr.y / 100 * B.H - 26, x2: p.x, y2: p.y - unitH(tg) * .5, c: '#FFB627', w: 2, d: .14 });
        hit(tr.src, tg, .7, {});
      }
    }
  }
  B.turrets = B.turrets.filter(t => t.t > 0);
  if (!alive('e').length) finish('win'); else if (!alive('a').length) finish('lose'); else if (B.time <= 0) finish('timeout');
}

/* --- 행동 --- */
function act(u) {
  if (u.role === 'medic') {
    const fr = friendsOf(u).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (fr && fr.hp / fr.maxHp < .7 && u.st.charm <= 0) {
      heal(u, fr, u.atk * 2.4); const a = upos(u), b = upos(fr);
      fx({ k: 'beam', x1: a.x, y1: a.y - unitH(u) * .6, x2: b.x, y2: b.y - unitH(fr) * .5, c: '#7DFF6A', w: 2, d: .2 });
      addGauge(u, 8); return;
    }
  }
  const tg = pickTarget(u); if (!tg) return;
  const melee = u.role === 'guardian' || u.role === 'assault';
  const a = upos(u), b = upos(tg);
  if (melee) { u.lunge = .2; u.lungeDir = b.x > a.x ? 1 : -1; fx({ k: 'slash', x: b.x, y: b.y - unitH(tg) * .5, c: u.side === 'a' ? '#2DE2E6' : '#FF4B5C', d: .18, r: 18 }); }
  else fx({ k: 'beam', x1: a.x + (b.x > a.x ? 16 : -16), y1: a.y - unitH(u) * .62, x2: b.x, y2: b.y - unitH(tg) * .5, c: u.role === 'engineer' ? '#FFB627' : (u.side === 'a' ? '#2DE2E6' : '#FF4B5C'), w: u.role === 'sniper' ? 3 : 2, d: .2 });
  const mult = { guardian: .9, assault: 1, sniper: 1.15, hacker: .9, medic: .6, engineer: 1 }[u.role];
  hit(u, tg, mult * (u.id === 'hawkeye' && u.first ? 2.5 : 1), {}); u.first = false;
  if (u.role === 'hacker' && Math.random() < .3) tg.st.weak = 3;
  if (u.id === 'glitch' && Math.random() < .15 && !tg.boss) tg.st.stun = Math.max(tg.st.stun, .8);
  if (u.id === 'neuro') tg.gauge = Math.max(0, tg.gauge - 8);
  if (u.id === 'volt') { const o = foesOf(u).filter(f => f !== tg); if (o.length) { const t2 = pick(o), c = upos(t2); fx({ k: 'beam', x1: b.x, y1: b.y - unitH(tg) * .5, x2: c.x, y2: c.y - unitH(t2) * .5, c: '#FFD54A', w: 2, d: .18 }); hit(u, t2, .35, { extra: 1 }); } }
  if (u.id === 'swarm') later(.15, () => { if (!tg.dead && !u.dead) { const c = upos(tg); fx({ k: 'missile', x1: a.x, y1: a.y - unitH(u), x2: c.x, y2: c.y - unitH(tg) * .5, c: '#5BC0FF', d: .2 }); hit(u, tg, .25, { extra: 1 }); } });
  addGauge(u, 8);
}
function addGauge(u, n) { u.gauge = Math.min(100, u.gauge + n * (u.id === 'chrono' ? 1.3 : 1)); }
function hit(src, tg, mult, o) {
  if (tg.dead) return 0;
  const A = src.atk * (src.st.weak > 0 ? .8 : 1) * (src.id === 'pug' && src.hp < src.maxHp * .5 ? 1.35 : 1);
  let dmg = A * mult * A / (A + tg.def) * elemMul(src.el, tg.el) * rnd(.92, 1.08);
  const crit = !o.noCrit && Math.random() * 100 < src.crit; if (crit) dmg *= 1.6;
  if (tg.st.mark > 0) dmg *= 2;
  if (src.id === 'reaper' && tg.hp < tg.maxHp * .3) dmg *= 1.5;
  if (src.id === 'specter' && (tg.st.stun > 0 || tg.st.freeze > 0 || tg.st.mark > 0)) dmg *= 1.3;
  let combo = false;
  if (o.ult && (tg.st.stun > 0 || tg.st.freeze > 0)) { dmg *= src.role === 'sniper' ? 2 : 1.5; combo = true; }
  if (B.wall[tg.side] > 0) dmg *= .3;
  dmg = Math.max(1, Math.round(dmg));
  let left = dmg;
  if (tg.shield > 0) { const ab = Math.min(tg.shield, left); tg.shield -= ab; left -= ab; }
  tg.hp -= left; tg.flash = .1; addGauge(tg, 4);
  src.dmgDone += dmg; tg.dmgTaken += dmg;
  if (B.cv) sfx(crit ? 'crit' : 'hit');
  const p = upos(tg);
  fx({ k: 'txt', x: p.x + rnd(-12, 12), y: p.y - unitH(tg) - 6, s: crit ? String(dmg) + '!' : String(dmg), c: crit ? '#FFB627' : (tg.side === 'a' ? '#FF9AC8' : '#FFFFFF'), big: crit || o.ult, d: .9 });
  if (combo) fx({ k: 'txt', x: p.x, y: p.y - unitH(tg) - 30, s: 'COMBO', c: '#FF3D9A', big: true, d: .9 });
  if (tg.hp <= 0) { tg.hp = 0; tg.dead = true; tg.deadT = 0; if (src.id === 'eclipse') addGauge(src, 40); }
  if (crit && src.id === 'blade' && !o.extra && !tg.dead) hit(src, tg, mult * .3, { extra: 1, noCrit: 1 });
  return dmg;
}
function heal(src, tg, amt) {
  if (tg.dead) return; amt = Math.round(amt); const before = tg.hp; tg.hp = Math.min(tg.maxHp, tg.hp + amt); src.healDone += tg.hp - before;
  const p = upos(tg); fx({ k: 'txt', x: p.x, y: p.y - unitH(tg) - 6, s: '+' + amt, c: '#7DFF6A', d: .9 });
}
function fx(e) { e.t = 0; B.fx.push(e); }

/* --- 궁극기 --- */
function tryUlt(u, manual) {
  if (B.ended || u.dead || u.gauge < 100) return;
  if (u.st.stun > 0 || u.st.freeze > 0) { if (manual) toast('기절 중이라 궁극기를 쓸 수 없어요', 'bad'); return; }
  u.gauge = 0;
  const foes = foesOf(u), fr = friendsOf(u), p = upos(u), col = ELEMS[u.el].c;
  banner(u); if (B.cv) sfx(['blade', 'hawkeye', 'swarm', 'eclipse', 'glitch'].includes(u.id) ? 'boom' : 'ult');
  if (u.side === 'a' && u.st.charm <= 0) track('ult');
  const ring = (t, c = col, r = 90) => { const q = upos(t); fx({ k: 'ring', x: q.x, y: q.y - unitH(t) * .45, c, r, d: .5 }); };
  switch (u.id) {
    case 'ironwall': B.wall[u.side] = 3; fr.forEach(f => ring(f, '#5BC0FF', 60)); break;
    case 'pug': foes.forEach(f => { f.st.taunt = 4; f.tauntBy = u; }); heal(u, u, u.maxHp * .3); ring(u, '#7DFF6A', 140); break;
    case 'blade': { const fr2 = foes.filter(f => f.slot < 2 || f.boss); (fr2.length ? fr2 : foes).forEach(f => { const q = upos(f); fx({ k: 'slash', x: q.x, y: q.y - unitH(f) * .5, c: '#FF3D9A', d: .35, r: 46 }); hit(u, f, 3, { ult: 1 }); }); B.shake = .3; break; }
    case 'reaper': for (let i = 0; i < 5; i++) later(i * .14, () => { const fs = foesOf(u); if (!fs.length || u.dead) return; const t = fs.sort((a, b) => a.hp - b.hp)[0]; const q = upos(t); fx({ k: 'slash', x: q.x, y: q.y - unitH(t) * .5, c: '#FF4B5C', d: .2, r: 30 }); fx({ k: 'ghost', u, x: q.x + (u.side === 'a' ? -40 : 40), y: q.y, d: .14 }); hit(u, t, 1.2, { ult: 1 }); }); break;
    case 'hawkeye': { if (!foes.length) break; const t = foes.slice().sort((a, b) => b.hp - a.hp)[0]; const q = upos(t), row = t.slot < 2 || t.boss ? 'f' : 'b';
      fx({ k: 'beam', x1: p.x, y1: p.y - unitH(u) * .62, x2: u.side === 'a' ? B.W : 0, y2: q.y - unitH(t) * .5, c: '#FFB627', w: 9, d: .45 });
      hit(u, t, 5, { ult: 1 }); foes.filter(f => f !== t && (f.slot < 2 ? 'f' : 'b') === row).forEach(f => hit(u, f, 1.6, { ult: 1 })); B.shake = .25; break; }
    case 'specter': { if (!foes.length) break; const t = foes.slice().sort((a, b) => b.atk - a.atk)[0]; t.st.mark = 6; ring(t, '#FF3D9A', 50); hit(u, t, 1.5, { ult: 1 }); break; }
    case 'glitch': foes.forEach(f => { f.st.stun = Math.max(f.st.stun, 2); ring(f, '#A874FF', 40); hit(u, f, .4, { ult: 1, noCrit: 1 }); }); B.shake = .2; break;
    case 'neuro': { if (!foes.length) break; const t = foes.slice().sort((a, b) => b.atk - a.atk)[0]; t.st.charm = 4; ring(t, '#FF7AB8', 60); break; }
    case 'nano': fr.forEach(f => { heal(u, f, f.maxHp * .35 + u.atk * 1.5); ring(f, '#7DFF6A', 50); }); break;
    case 'halo': fr.forEach(f => { f.shield = Math.round(f.maxHp * .28); f.shieldT = 10; ring(f, '#FFD54A', 50); }); break;
    case 'volt': B.turrets.push({ src: u, x: u.side === 'a' ? 28 : 72, y: 74, t: 8, cd: 0 }); ring(u, '#FFB627', 80); break;
    case 'swarm': foes.forEach((f, i) => { const q = upos(f); fx({ k: 'missile', x1: p.x, y1: p.y - unitH(u), x2: q.x, y2: q.y - unitH(f) * .5, c: '#FFB627', d: .45, delay: i * .06 }); later(.45 + i * .06, () => hit(u, f, 1.6, { ult: 1 })); }); later(.5, () => { B.shake = .3; }); break;
    case 'chrono': foes.forEach(f => { f.st.freeze = 3; ring(f, '#FFD54A', 46); }); fr.forEach(f => { if (f !== u) { f.timer = 0; f.gauge = Math.min(100, f.gauge + 20); } }); fx({ k: 'clock', x: B.W / 2, y: B.H * .55, d: 1 }); B.shake = .2; break;
    case 'eclipse': {
      const cx = u.side === 'a' ? 72 : 28;
      fx({ k: 'hole', x: cx / 100 * B.W, y: B.H * .7, d: 1 });
      foes.forEach(f => { f.pull = { tx: (cx - f.bx) / 100 * B.W * .45, ty: (70 - f.by) / 100 * B.H * .45 }; });
      later(.7, () => { foesOf(u).forEach(f => hit(u, f, 2.4, { ult: 1 })); B.shake = .4; fx({ k: 'ring', x: cx / 100 * B.W, y: B.H * .7, c: '#A874FF', r: 200, d: .5 }); });
      later(1.1, () => B.units.forEach(f => { f.pull = null; }));
      break;
    }
  }
}
function banner(u) {
  const d = document.createElement('div'); d.className = 'ultband ' + (u.side === 'a' && u.st.charm <= 0 ? 'ally' : 'foe');
  const c = u.side === 'a' && u.st.charm <= 0 ? 'var(--pink)' : 'var(--red)';
  d.innerHTML = `<img class="cutin" src="${imgSrc(u.id, u.frame)}" alt=""><div class="ubt"><small>${u.side === 'a' ? 'ULTIMATE' : 'ENEMY ULTIMATE'} · ${esc(u.m.n)}</small><b style="color:${c};text-shadow:0 0 18px ${ELEMS[u.el].c}">${esc(u.m.ult)}</b></div>`;
  $('#b-field', B.el).appendChild(d); setTimeout(() => d.remove(), 1000);
}

/* --- 그리기 --- */
function render(rdt) {
  const x = B.ctx, W = B.W, H = B.H; if (!W) return;
  x.setTransform(B.dpr, 0, 0, B.dpr, 0, 0);
  let sx = 0, sy = 0;
  if (B.shake > 0 && !REDUCED) { B.shake -= rdt; sx = rnd(-6, 6); sy = rnd(-4, 4); }
  x.clearRect(0, 0, W, H);
  x.drawImage(B.bg, 0, 0, W, H);
  x.translate(sx, sy);
  // 포탑
  for (const tr of B.turrets) {
    const tx = tr.x / 100 * W, ty = tr.y / 100 * H; x.save(); x.fillStyle = 'rgba(255,182,39,.25)'; x.beginPath(); x.ellipse(tx, ty, 26, 7, 0, 0, 7); x.fill();
    x.fillStyle = '#3a2a10'; x.strokeStyle = '#FFB627'; x.lineWidth = 2; x.beginPath();
    for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i; x.lineTo(tx + Math.cos(a) * 16, ty - 20 + Math.sin(a) * 14); } x.closePath(); x.fill(); x.stroke();
    x.fillStyle = '#FFB627'; x.fillRect(tx + (tr.src.side === 'a' ? 8 : -30), ty - 24, 22, 5); x.fillRect(tx - 3, ty - 8, 6, 8); x.restore();
  }
  // 유닛 (위 → 아래)
  const us = B.units.slice().sort((a, b) => a.by - b.by);
  for (const u of us) drawUnit(x, u, rdt);
  // 효과
  for (const e of B.fx) drawFx(x, e, rdt);
  B.fx = B.fx.filter(e => e.t < e.d + (e.delay || 0));
  x.setTransform(1, 0, 0, 1, 0, 0);
  // DOM 갱신
  const ha = Math.max(0, sideHp('a')) / B.maxA, he = Math.max(0, sideHp('e')) / B.maxE;
  $('#b-hpa').style.width = (ha * 100) + '%'; $('#b-hpe').style.width = (he * 100) + '%';
  $('#b-time').textContent = Math.max(0, Math.ceil(B.time));
  for (const s in B.ubtn) {
    const b = B.ubtn[s], u = B.units.find(q => q.side === 'a' && q.slot === +s); if (!u) continue;
    b.querySelector('.gauge > i').style.width = u.gauge + '%';
    const ready = u.gauge >= 100 && !u.dead, stun = u.st.stun > 0 || u.st.freeze > 0;
    b.classList.toggle('ready', ready && !stun); b.classList.toggle('stun', stun && !u.dead); b.classList.toggle('dead', u.dead);
  }
}
function drawUnit(x, u, rdt) {
  if (u.dead && u.deadT > .5) return;
  // 끌려가기
  if (u.pull) { u.ox += (u.pull.tx - u.ox) * Math.min(1, rdt * 6); u.oy += (u.pull.ty - u.oy) * Math.min(1, rdt * 6); }
  else { u.ox *= .85; u.oy *= .85; }
  const p = upos(u), hU = unitH(u), [w, h, ax] = SPR[u.id][u.frame], s = hU / 300, dw = w * s, dh = h * s;
  let px = p.x, py = p.y;
  if (u.lunge > 0) px += Math.sin((1 - u.lunge / .2) * Math.PI) * 22 * u.lungeDir;
  x.save();
  if (u.dead) { x.globalAlpha = Math.max(0, 1 - u.deadT / .5); py += u.deadT * 40; }
  // 발밑 빛 웅덩이
  const g = x.createRadialGradient(px, py, 2, px, py, dw * .45);
  g.addColorStop(0, u.side === 'a' ? 'rgba(45,226,230,.55)' : 'rgba(255,75,92,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.beginPath(); x.ellipse(px, py, dw * .45, 9 * (u.boss ? 1.6 : 1), 0, 0, 7); x.fill();
  if (u.st.freeze > 0) x.filter = 'sepia(1) saturate(2) hue-rotate(5deg) brightness(1.15)';
  const draw = () => {
    if (u.side === 'a') x.drawImage(IMGS[u.id][u.frame], px - ax * dw, py - dh, dw, dh);
    else { const c = enemyCanvas(u.id, u.frame); if (!c) return; const P = c._P * s; x.drawImage(c, px - (1 - ax) * dw - P, py - dh - P, dw + P * 2, dh + P * 2); }
  };
  draw();
  if (u.flash > 0) { x.globalCompositeOperation = 'lighter'; x.globalAlpha = .6; draw(); }
  x.restore();
  if (u.dead) return;
  // 체력 막대
  const bw = u.boss ? 120 : 58, bx = px - bw / 2, by = py - hU - 14;
  x.save(); x.translate(bx, by); x.transform(1, 0, -.35, 1, 0, 0);
  x.fillStyle = 'rgba(7,6,15,.8)'; x.fillRect(-1, -1, bw + 2, 7);
  x.fillStyle = u.side === 'a' ? '#7DFF6A' : '#FF4B5C'; x.fillRect(0, 0, bw * u.hp / u.maxHp, 5);
  if (u.shield > 0) { x.fillStyle = 'rgba(255,255,255,.85)'; x.fillRect(0, 0, bw * Math.min(1, u.shield / u.maxHp), 2.5); }
  x.restore();
  // 상태 태그
  const tags = [];
  if (u.st.stun > 0) tags.push(['기절', '#A874FF']); if (u.st.freeze > 0) tags.push(['정지', '#FFD54A']);
  if (u.st.mark > 0) tags.push(['표식', '#FF3D9A']); if (u.st.charm > 0) tags.push(['장악', '#FF7AB8']);
  if (B.wall[u.side] > 0) tags.push(['철벽', '#5BC0FF']); if (u.st.taunt > 0) tags.push(['도발', '#FFB627']); if (u.st.weak > 0) tags.push(['약화', '#A39DD0']);
  x.font = '700 11px "IBM Plex Sans KR", sans-serif'; let tx = px - (tags.length * 30) / 2;
  for (const [t, c] of tags) { x.fillStyle = c; x.fillRect(tx, by - 15, 28, 13); x.fillStyle = '#07060F'; x.fillText(t, tx + 3, by - 5); tx += 30; }
}
function drawFx(x, e, rdt) {
  e.t += rdt * B.speed; const t0 = e.t - (e.delay || 0); if (t0 < 0) return; const k = Math.min(1, t0 / e.d);
  x.save();
  switch (e.k) {
    case 'beam': x.globalAlpha = 1 - k; x.strokeStyle = e.c; x.lineWidth = e.w; x.shadowColor = e.c; x.shadowBlur = 10; x.beginPath(); x.moveTo(e.x1, e.y1); x.lineTo(e.x2, e.y2); x.stroke(); break;
    case 'slash': x.globalAlpha = 1 - k; x.strokeStyle = e.c; x.lineWidth = 3; x.shadowColor = e.c; x.shadowBlur = 12; x.beginPath(); x.arc(e.x, e.y, e.r, -2.2 + k, -.4 + k); x.stroke(); break;
    case 'ring': x.globalAlpha = (1 - k) * .9; x.strokeStyle = e.c; x.lineWidth = 3; x.shadowColor = e.c; x.shadowBlur = 14; x.beginPath(); x.arc(e.x, e.y, e.r * (.3 + k * .7), 0, 7); x.stroke(); break;
    case 'txt': x.globalAlpha = k > .7 ? (1 - k) / .3 : 1; x.font = `700 ${e.big ? 21 : 15}px "Chakra Petch", "IBM Plex Sans KR", sans-serif`; x.textAlign = 'center'; x.lineWidth = 3; x.strokeStyle = '#07060F';
      x.strokeText(e.s, e.x, e.y - 38 * k); x.fillStyle = e.c; x.fillText(e.s, e.x, e.y - 38 * k); break;
    case 'missile': { const mx = e.x1 + (e.x2 - e.x1) * k, my = e.y1 + (e.y2 - e.y1) * k - Math.sin(k * Math.PI) * 60;
      x.fillStyle = e.c; x.shadowColor = e.c; x.shadowBlur = 10; x.fillRect(mx - 3, my - 3, 6, 6); if (k >= 1) { x.beginPath(); x.arc(e.x2, e.y2, 22, 0, 7); x.globalAlpha = .6; x.fill(); } break; }
    case 'ghost': { x.globalAlpha = .7 * (1 - k); const u = e.u, s = unitH(u) / 300, [w, h, ax] = SPR[u.id][u.frame];
      if (u.side === 'a') x.drawImage(IMGS[u.id][u.frame], e.x - ax * w * s, e.y - h * s, w * s, h * s); break; }
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
  if (B.ended) return; B.ended = true;
  const map = { win: ['승리', 'var(--lime)'], lose: ['패배', 'var(--red)'], timeout: ['시간 초과', 'var(--amber)'], retreat: ['후퇴', 'var(--dim)'] };
  const d = document.createElement('div'); d.className = 'endband'; d.innerHTML = `<b style="color:${map[kind][1]}">${map[kind][0]}</b>`;
  $('#b-field', B.el).appendChild(d);
  const res = { win: kind === 'win', kind, allyHp: {}, enemyHp: 0, time: B.t };
  B.units.filter(u => u.side === 'a').forEach(u => { res.allyHp[u.slot] = u.dead ? 0 : u.hp / u.maxHp; });
  res.enemyHp = sideHp('e') / B.maxE;
  res.stars = res.win ? 1 + (B.units.every(u => u.side !== 'a' || !u.dead) ? 1 : 0) + (B.t <= 45 ? 1 : 0) : 0;
  const cfg = B.cfg, bb = B;
  if (kind === 'retreat') { setTimeout(() => { closeBattle(bb); cfg.onEnd(res); refresh(); }, 350); return; }
  sfx(res.win ? 'win' : 'lose');
  setTimeout(() => {
    if (res.win) { S.rec.w++; track('win'); } else S.rec.l++;
    GRANT_LOG = [];
    try {
      if (res.win && !cfg.noExp) { const lv = cfg.enemies.reduce((a, e) => a + (e.lv || 6), 0) / cfg.enemies.length; grant({ exp: Math.round(60 + lv * 30) }); }
      cfg.onEnd(res);
    } catch (e) { console.error(e); }
    const logs = GRANT_LOG; GRANT_LOG = null;
    save(); showResult(bb, res, logs, map[kind]);
  }, 900);
}
function closeBattle(bb) { cancelAnimationFrame(bb.raf); window.removeEventListener('keydown', bb.onKey); bb.ro.disconnect(); bb.el.remove(); if (B === bb) B = null; }
function showResult(bb, res, logs, head) {
  const allies = bb.units.filter(u => u.side === 'a').sort((a, b) => a.slot - b.slot);
  const mx = Math.max(1, ...allies.map(u => Math.max(u.dmgDone, u.dmgTaken, u.healDone)));
  const mvp = allies.slice().sort((a, b) => (b.dmgDone + b.healDone * 1.2 + b.dmgTaken * .4) - (a.dmgDone + a.healDone * 1.2 + a.dmgTaken * .4))[0];
  const cfg = bb.cfg;
  const stars = cfg.stars ? `<div class="stars">${[0, 1, 2].map(i => `<i class="${i < res.stars ? 'on' : ''}" style="animation-delay:${.2 + i * .25}s"></i>`).join('')}</div>
    <div class="starhint"><span class="${res.win ? 'ok' : ''}">승리</span><span class="${allies.every(u => !u.dead) && res.win ? 'ok' : ''}">아무도 쓰러지지 않기</span><span class="${res.win && res.time <= 45 ? 'ok' : ''}">45초 안에</span></div>` : '';
  const rows = allies.map(u => `<div class="mrow ${u === mvp ? 'mvp' : ''}"><div class="face"><img src="${imgSrc(u.id, u.frame)}" alt=""></div>
    <div class="mbars"><div class="mn"><b>${esc(u.m.n)}</b>${u === mvp ? '<span class="tag fill" style="background:var(--amber)">MVP</span>' : ''}${u.dead ? '<span class="dim" style="font-size:11px">쓰러짐</span>' : ''}</div>
    <div class="mb"><i style="width:${u.dmgDone / mx * 100}%;background:var(--pink)"></i><span class="px">${fmt(u.dmgDone)}</span></div>
    <div class="mb"><i style="width:${u.dmgTaken / mx * 100}%;background:var(--cyan)"></i><span class="px">${fmt(u.dmgTaken)}</span></div>
    ${u.healDone > 0 ? `<div class="mb"><i style="width:${u.healDone / mx * 100}%;background:var(--lime)"></i><span class="px">${fmt(u.healDone)}</span></div>` : ''}</div></div>`).join('');
  const tip = res.win ? '' : `<p class="sub" style="color:var(--amber)">${res.kind === 'timeout' ? '시간이 모자랐어요. 딜러를 늘리거나 궁극기를 빨리 쓰세요.' : '용병 레벨을 올리거나, 적 속성에 강한 용병으로 배치를 바꿔 보세요.'}</p>`;
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
  const mkPow = (side, d, b) => { const u = mkUnit(side, d, b); return unitPower({ hp: u.maxHp, atk: u.atk, def: u.def, spd: u.spd, crit: u.crit }); };
  const syn = synergyOf(cfg.allies.map(a => a.id));
  const ally = Math.round(cfg.allies.reduce((s, a) => s + mkPow('a', a, addBuffs(cfg.buffs, syn.buff)), 0));
  const foe = Math.round(cfg.enemies.reduce((s, e) => s + mkPow('e', e, null), 0));
  const r = ally / Math.max(1, foe);
  const verdict = r >= 1.15 ? ['유리', 'var(--lime)'] : r >= .9 ? ['비슷', 'var(--amber)'] : r >= .7 ? ['어려움', 'var(--red)'] : ['위험', 'var(--red)'];
  const els = {}; cfg.enemies.forEach(e => { const x = MERCS[e.id].el; els[x] = (els[x] || 0) + 1; });
  const beats = { plasma: 'mech', mech: 'bio', bio: 'plasma', quantum: 'void', void: 'quantum' };
  const counter = Object.keys(els).map(x => Object.keys(beats).find(k => beats[k] === x)).filter(Boolean);
  const advice = Object.keys(els).map(x => `${ELEMS[x].n} ${els[x]}`).join(' · ');
  const tip = counter.length ? `적 속성: ${advice}. ${[...new Set(counter)].map(k => ELEMS[k].n).join('·')} 속성 용병이 유리해요.` : '';
  const face = (d, side) => `<div class="pf ${side}"><img src="${imgSrc(d.id, side === 'a' ? frameOf(d.g) : (d.frame || 0))}" alt=""><span class="tag fill e-${MERCS[d.id].el}">${ELEMS[MERCS[d.id].el].n}</span>${side === 'a' ? `<span class="lvb px">${d.mlv || 1}</span>` : ''}</div>`;
  openModal({
    label: 'BRIEFING', title: cfg.title, c: 'var(--cyan)', wide: true,
    html: `<div class="vs"><div><div class="eyebrow" style="color:var(--lime)">OUR SQUAD</div><div class="pfrow">${cfg.allies.map(a => face(a, 'a')).join('')}</div><div class="px pw" style="color:var(--lime)">${fmt(ally)}</div></div>
      <div class="vsmid"><span class="px">VS</span><b style="color:${verdict[1]}">${verdict[0]}</b></div>
      <div><div class="eyebrow" style="color:var(--red)">${esc(cfg.enemyName)}</div><div class="pfrow">${cfg.enemies.map(e => face(e, 'e')).join('')}</div><div class="px pw" style="color:var(--red)">${fmt(foe)}</div></div></div>
      ${syn.list.length ? `<div class="synrow">${syn.list.map(x => `<span class="syn" style="--sc:${x.c}"><b>${x.n}</b>${x.d}</span>`).join('')}</div>` : '<p class="sub">진형 시너지 없음. 같은 속성 2명, 가디언+메딕 같은 조합으로 보너스를 받아요.</p>'}
      ${tip ? `<p class="sub">${tip}</p>` : ''}${cfg.note ? `<p class="sub" style="color:var(--amber)">${cfg.note}</p>` : ''}
      <div class="row wrap"><button class="btn" id="pb-go" style="flex:1">출격</button><button class="btn gray" id="pb-edit">편성 바꾸기</button></div>`,
    onMount: b => {
      $('#pb-go', b).onclick = () => { closeModal(true); runBattle(cfg); };
      $('#pb-edit', b).onclick = () => { closeModal(true); TAB = 'hq'; refresh(false); toast('본부에서 용병을 눌러 자리를 바꿀 수 있어요'); };
    },
  });
}
