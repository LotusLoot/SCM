'use strict';
/* ===== 상태 ===== */
const SAVE_KEY = 'scm-save-v1';
let S = null;
function freshState() {
  const st = {
    v: 1, day: 1, credits: 12000, chips: 300, mats: { alloy: 6, biogel: 6, neural: 6 }, repXp: 0,
    roster: {}, squad: ['ironwall', 'blade', 'hawkeye', 'glitch', 'nano'],
    pity: { n: 0, p: 0 }, crew: null,
    dist: DISTRICTS.map(() => ({ owner: 'npc', ctrl: { npc: 100, me: 0, r0: 0, r1: 0, r2: 0 } })),
    tickets: 3, defenses: 3, spClaimed: false,
    jobs: [], arena: { score: 1000, tries: 5, w: 0, l: 0, best: 1000 },
    building: { best: 0, run: null }, dive: { best: 0, left: 3 },
    bounty: { week: 0, boss: 'chrono', hp: 1, clues: 0, tracks: 3, done: false },
    rec: { w: 0, l: 0 }, titles: [], title: '',
    news: [{ d: 1, t: '용병단 사무실 개업. 오늘부터 도시 밑바닥에서 시작해요.' }],
    crewXp: 0, seen: {},
  };
  for (const id of st.squad) st.roster[id] = newMerc();
  st.jobs = genJobs(st);
  migrate(st); st.exp = 1500;
  return st;
}
const newMerc = () => ({ g: 1, lv: 1, ess: 0, imp: { eye: 0, arm: 0, nerve: 0, skin: 0 } });
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* 저장 불가 환경 */ } }
function load() {
  try { const raw = localStorage.getItem(SAVE_KEY); if (raw) { const o = JSON.parse(raw); if (o && o.v === 1) return migrate(o); } } catch (e) { }
  return null;
}
function toCode() { return 'SCM1.' + btoa(unescape(encodeURIComponent(JSON.stringify(S)))); }
function fromCode(c) {
  c = c.trim(); if (!c.startsWith('SCM1.')) throw new Error('bad');
  const o = JSON.parse(decodeURIComponent(escape(atob(c.slice(5))))); if (!o || o.v !== 1) throw new Error('bad'); return migrate(o);
}

/* ===== 평판 / 크루 ===== */
function repLv(xp = S.repXp) { let l = 1; for (let i = 1; i <= 10; i++) if (xp >= REP_XP[i]) l = i; return l; }
function repProgress() { const l = repLv(); if (l >= 10) return 1; return (S.repXp - REP_XP[l]) / (REP_XP[l + 1] - REP_XP[l]); }
const crewLv = () => S.crew ? Math.min(10, 1 + Math.floor(S.crewXp / 120)) : 0;
const crewBuff = () => S.crew ? (crewLv() - 1) * 3 : 0; // 크레딧 +%
function addRep(n) {
  const before = repLv(); S.repXp += n; const after = repLv();
  if (after > before) {
    for (let l = before + 1; l <= after; l++) toast(`평판 LV.${l} 달성! ${REP_UNLOCK[l]} 열림`, 'gold');
    if (after >= 10 && !S.titles.includes('도시의 전설')) { S.titles.push('도시의 전설'); S.title = '도시의 전설'; toast('칭호 「도시의 전설」 획득!', 'gold'); }
  }
}
function addCrewXp(n) { if (!S.crew) return; const b = crewLv(); S.crewXp += n; if (crewLv() > b) toast(`크루 LV.${crewLv()}! 크레딧 보너스 +${crewBuff()}%`, 'good'); }
let GRANT_LOG = null; // 배열이면 전투 결과 화면에 모아 보여 줘요
function grant(r, quiet) {
  const parts = [];
  if (r.exp) { S.exp += r.exp; parts.push(`전투 데이터 +${fmt(r.exp)}`); }
  if (r.credits) { const c = Math.round(r.credits * (1 + crewBuff() / 100)); S.credits += c; parts.push(`+${fmt(c)}C`); }
  if (r.chips) { S.chips += r.chips; parts.push(`데이터칩 +${r.chips}`); }
  if (r.mats) for (const k in r.mats) if (r.mats[k]) { S.mats[k] += r.mats[k]; parts.push(`${MATS[k]} +${r.mats[k]}`); }
  if (r.rep) { parts.push(`평판 +${r.rep}`); }
  if (r.rep) addRep(r.rep);
  if (r.crew) addCrewXp(r.crew);
  if (GRANT_LOG) GRANT_LOG.push(...parts);
  else if (!quiet && parts.length) toast(parts.join(' · '), 'gold');
  return parts.join(' · ');
}

/* ===== 능력치 ===== */
function mercStats(id, g, imp, lvMul = 1, mlv = 1) {
  const m = MERCS[id], r = ROLES[m.role], gm = GRADES[g].m * (m.legend ? 1.2 : 1) * lvMul * lvStat(mlv);
  imp = imp || { eye: 0, arm: 0, nerve: 0, skin: 0 };
  return {
    hp: Math.round(r.hp * gm), atk: Math.round(r.atk * gm * (1 + imp.arm * .05)),
    def: Math.round(r.def * gm * (1 + imp.skin * .06)), spd: Math.round(r.spd * Math.min(1.35, Math.sqrt(gm)) * (1 + imp.nerve * .04)),
    crit: Math.min(75, r.crit + imp.eye * 2 + (g - 1)),
  };
}
const ownStats = id => { const o = S.roster[id]; return mercStats(id, o.g, o.imp, 1, o.lv); };
const unitPower = s => s.hp * .1 + s.atk * 1.6 + s.def * 1.2 + s.spd * .6 + s.crit * 4;
const squadPower = (sq = S.squad) => Math.round(sq.filter(Boolean).reduce((a, id) => a + unitPower(ownStats(id)), 0));
const lvMul = lv => Math.pow(1.09, Math.max(1, lv) - 1);
function teamPowerAt(lv) { // 같은 레벨 갱단 5명의 대략 전투력
  return Math.round(['guardian', 'assault', 'sniper', 'hacker', 'medic'].reduce((a, r) => a + unitPower(mercStats(COMMON_IDS.find(i => MERCS[i].role === r), 1, null, lvMul(lv))), 0));
}

/* ===== 적 팀 ===== */
function makeGangTeam(lv, opt = {}) {
  const fronts = COMMON_IDS.filter(i => ROLES[MERCS[i].role].row === 'front');
  const backs = COMMON_IDS.filter(i => ROLES[MERCS[i].role].row === 'back');
  const pool = opt.pool || null;
  const f = shuffle(pool ? pool.filter(i => ROLES[MERCS[i].role].row === 'front') : fronts.slice());
  const b = shuffle(pool ? pool.filter(i => ROLES[MERCS[i].role].row === 'back') : backs.slice());
  const ids = [f[0] || pick(fronts), f[1] || pick(fronts), b[0] || pick(backs), b[1] || pick(backs), b[2] || pick(backs)];
  const fr = lv >= 20 ? 2 : lv >= 11 ? 1 : 0;
  return ids.slice(0, opt.count || 5).map((id, i) => ({ id, slot: i, g: fr === 2 ? 7 : fr === 1 ? 6 : 1, lv, frame: fr }));
}
function makeArenaTeam(lv) {
  const pool = lv > 9 ? MERC_IDS : COMMON_IDS;
  const fronts = shuffle(pool.filter(i => ROLES[MERCS[i].role].row === 'front'));
  const backs = shuffle(pool.filter(i => ROLES[MERCS[i].role].row === 'back'));
  return [fronts[0], fronts[1], backs[0], backs[1], backs[2]].map((id, i) => {
    const fr = lv >= 18 ? (Math.random() < .5 ? 2 : 1) : lv >= 9 ? (Math.random() < .5 ? 1 : 0) : 0;
    return { id, slot: i, g: 1, lv: MERCS[id].legend ? lv - 1.5 : lv, frame: fr };
  });
}

/* ===== 의뢰 생성 ===== */
function jobBaseLv(st) { return 1 + (repLv(st.repXp) - 1) * 1.8; }
function genJobs(st) {
  const out = []; const kinds = { lu: ['escort', 'ship'], dok: ['hack', 'sneak'], hound: ['raid', 'clue'] };
  for (const b of ['lu', 'dok', 'hound']) for (let i = 0; i < 2; i++) {
    const k = kinds[b][i], t = JOB_T[k];
    const d = Math.min(3, Math.max(0, Math.floor(Math.random() * 4.2 - .3)));
    const lv = Math.max(1, jobBaseLv(st) + DIFFS[d].lv);
    const base = 380 + lv * 110;
    const r = { credits: Math.round(base * DIFFS[d].cr / 10) * 10, rep: DIFFS[d].rep };
    if (d >= 2 || Math.random() < .3) r.mats = { [pick(['alloy', 'biogel', 'neural'])]: d + 1 };
    if (d >= 2) r.chips = d === 3 ? 40 : 20;
    if (k === 'clue') r.clue = 1;
    const job = { id: Math.random().toString(36).slice(2, 8), k, b, title: pick(t.titles), d, lv: Math.round(lv * 10) / 10, r, st: 'open' };
    if (k === 'ship') { job.need = pick(ROLE_ORDER); job.mins = d + 1; }
    out.push(job);
  }
  return out;
}

/* ===== 공용 UI ===== */
function toast(msg, kind = '') {
  const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg;
  const box = $('#toasts'); box.appendChild(t); while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => t.remove(), 2400);
}
function openModal({ label = 'INFO', title = '', html = '', wide = false, c = 'var(--pink)', onMount, onClose }) {
  closeModal(true);
  const m = document.createElement('div'); m.id = 'modal';
  m.innerHTML = `<div class="mbox box brk ${wide ? 'wide' : ''}" style="--c:${c}" role="dialog" aria-modal="true">
    <div class="mh"><div><div class="eyebrow" style="color:${c}">${label}</div><div class="h1">${title}</div></div>
    <button class="x" data-a="closeModal" aria-label="닫기">×</button></div><div class="mbody">${html}</div></div>`;
  m.addEventListener('pointerdown', e => { if (e.target === m) closeModal(); });
  m._onClose = onClose;
  document.body.appendChild(m);
  if (onMount) onMount(m.querySelector('.mbody'));
  return m;
}
function closeModal(silent) { const m = $('#modal'); if (!m) return; const cb = m._onClose; m.remove(); if (cb && !silent) cb(); }
function setModalBody(html) { const b = $('#modal .mbody'); if (b) b.innerHTML = html; }

/* 카드 */
function mercCard(id, o = {}) {
  const m = MERCS[id], own = S.roster[id], g = o.g || (own ? own.g : 1), has = !!own || o.force;
  const cls = has ? 'g' + g : 'none';
  const dias = Array.from({ length: 7 }, (_, i) => `<i class="${i < g && has ? 'on' : ''}"></i>`).join('');
  const gname = has ? GRADES[g].n : (m.legend ? '전설 · 미보유' : '미보유');
  const flag = o.flag ? `<span class="cflag">${o.flag}</span>` : '';
  const lv = own && !o.noLv ? `<span class="clv">Lv ${own.lv || 1}</span>` : '';
  const ess = own && own.ess ? `<span class="cess" title="정수">◆${own.ess}</span>` : '';
  const pow = own && o.pow ? `<div class="cpow"><span>전투력</span><b>${fmt(unitPower(ownStats(id)))}</b></div>` : '';
  return `<div class="mcard ${cls} ${o.sel ? 'sel' : ''}" ${o.act ? `data-a="${o.act}" data-v="${id}"` : ''} tabindex="0" role="button" aria-label="${m.n}">
    <div class="in"><div class="ctop"><span class="tag fill e-${m.el}">${ELEMS[m.el].n}</span><span class="crole" title="${ROLES[m.role].n}">${IC[m.role]}</span></div>
    <div class="art"><img src="${imgSrc(id, has ? frameOf(g) : 0)}" alt="" loading="lazy" draggable="false"></div>
    <div class="bt"><div class="nmrow"><span class="nm">${m.n}</span>${flag}</div>
      <div class="meta">${lv}<span class="gname">${gname}</span>${ess}</div><div class="dias">${dias}</div>${pow}</div></div></div>`;
}
const hexEmblem = (c, t, size = 34) => `<div class="hex" style="--c:${c};width:${size}px;height:${size}px;font-size:${Math.round(size * .44)}px">${esc(t)}</div>`;
const lockLine = lv => `<span class="lockline">${IC.lock}평판 LV.${lv}에 열려요</span>`;
const resChip = (k, v) => `<span class="res ${k === 'credit' ? 'cr' : k === 'chip' ? 'dc' : 'mat'}">${resIcon(k)}${typeof v === 'number' ? fmt(v) : v}</span>`;

/* ===== 상단 바 / 탭 바 ===== */
function renderTop() {
  const lv = repLv(), p = repProgress(), segs = Array.from({ length: 10 }, (_, i) => `<i class="${i < Math.round(p * 10) || lv >= 10 ? 'on' : ''}"></i>`).join('');
  const crew = S.crew ? hexEmblem(S.crew.color, S.crew.name[0]) : hexEmblem('var(--pink)', 'S');
  $('#topbar').innerHTML = `<div class="tb-crew">${crew}<div class="nm"><b>SCM</b><span>${S.crew ? esc(S.crew.name) : '크루 없음'}</span></div></div>
    <div class="tb-rep"><span class="lv">REP LV.${lv}${S.title ? ' · ' + esc(S.title) : ''}</span><div class="segs">${segs}</div></div>
    <div class="tb-res">${resChip('credit', S.credits)}${resChip('chip', S.chips)}
      <div class="tb-mats">${resChip('alloy', S.mats.alloy)}${resChip('biogel', S.mats.biogel)}${resChip('neural', S.mats.neural)}</div></div>`;
}
const TABS = [['hq', '본부'], ['merc', '용병'], ['ops', '출격'], ['job', '의뢰'], ['city', '도시'], ['hire', '영입']];
let TAB = 'hq';
function tabTodo(t) {
  const lv = repLv();
  if (t === 'hq') return S.squad.some(x => !x) || idleElapsed() >= 3600e3 || missionReady() || attendReady();
  if (t === 'merc') return Object.entries(S.roster).some(([id, o]) => (o.ess > 0 && canPromote(id).ok) || (S.squad.includes(id) && o.lv < lvCap(o.g) && S.exp >= lvCost(o.lv).exp));
  if (t === 'hire') return S.credits >= 1000;
  if (t === 'job') return S.jobs.some(j => j.st === 'open' || (j.st === 'ship' && Date.now() >= j.until));
  if (t === 'city') return lv >= 3 && !!S.crew && (S.tickets > 0 || (!S.spClaimed && ownedDistricts().length > 0));
  if (t === 'ops') return S.camp.n < CHAPTERS.length * STAGES_PER || (lv >= 2 && S.arena.tries > 0);
  return false;
}
function renderTabs() {
  $('#tabbar').innerHTML = TABS.map(([k, n]) => `<button class="${TAB === k ? 'on' : ''}" data-a="tab" data-v="${k}" aria-label="${n}">
    ${IC[k]}<span>${n}</span>${tabTodo(k) ? '<i class="dot"></i>' : ''}</button>`).join('');
}
function refresh(keepScroll = true) {
  const v = $('#view'), sc = v.scrollTop;
  renderTop(); renderTabs();
  v.innerHTML = SCREENS[TAB]();
  if (keepScroll) v.scrollTop = sc; else v.scrollTop = 0;
  save();
}

/* ===== 하루 끝 / 경쟁 크루 ===== */
const ownedDistricts = () => S.dist.map((d, i) => i).filter(i => S.dist[i].owner === 'me');
function ownerName(o) { if (o === 'me') return S.crew ? S.crew.name : '우리'; if (o === 'npc') return null; return RIVALS.find(r => r.id === o).n; }
function ownerColor(o, i) { if (o === 'me') return S.crew ? S.crew.color : '#7DFF6A'; if (o === 'npc') return DISTRICTS[i].c; return RIVALS.find(r => r.id === o).c; }
function rivalLv(r) { return 3 + S.day * .55 * r.p; }
function news(t) { S.news.unshift({ d: S.day, t }); S.news = S.news.slice(0, 8); }
function applyCtrl(i, who, amt) {
  const d = S.dist[i], prev = d.owner;
  d.ctrl[who] = Math.min(100, (d.ctrl[who] || 0) + amt);
  if (prev !== who) d.ctrl[prev] = Math.max(0, d.ctrl[prev] - amt);
  if (d.ctrl[who] >= 100 && prev !== who) { d.owner = who; return true; }
  return false;
}
function endDay() {
  // 경쟁 크루 행동
  const myPow = squadPower();
  for (const r of RIVALS) {
    if (S.day < 2) continue;
    const cands = S.dist.map((d, i) => i).filter(i => S.dist[i].owner !== r.id && (i < 11 || S.day > 12));
    const i = pick(cands); if (i === undefined) continue;
    const d = S.dist[i];
    if (d.owner === 'me') {
      const ep = teamPowerAt(rivalLv(r)); const chance = clamp(.5 + (myPow - ep) / (ep * 1.2), .1, .92);
      if (Math.random() < chance) news(`${r.n}의 ${DISTRICTS[i].n} 습격을 우리 방어 팀이 막았어요.`);
      else { const took = applyCtrl(i, r.id, 30); news(took ? `${r.n}이(가) 우리 구역 ${DISTRICTS[i].n}을(를) 빼앗았어요!` : `${r.n}이(가) ${DISTRICTS[i].n} 장악도를 깎았어요 (방어전으로 다시 채우세요).`); }
    } else {
      const took = applyCtrl(i, r.id, 34);
      if (took) news(`${r.n}이(가) ${DISTRICTS[i].n}을(를) 차지했어요.`);
    }
  }
  S.day++; onNewDay();
  S.tickets = 3; S.defenses = 3; S.spClaimed = false; S.arena.tries = 5; S.dive.left = 3; S.bounty.tracks = 3;
  const keep = S.jobs.filter(j => j.st === 'ship');
  S.jobs = keep.concat(genJobs(S)).slice(0, Math.max(6, keep.length + 4));
  if ((S.day - 1) % 7 === 0) weeklyReset();
  toast(`DAY ${S.day} 시작. 의뢰판이 새로 올라왔어요.`, '');
  refresh();
}
function weeklyRanking() {
  const counts = [{ id: 'me', n: S.crew ? S.crew.name : '우리 (크루 없음)', c: S.crew ? S.crew.color : '#7DFF6A' }, ...RIVALS.map(r => ({ id: r.id, n: r.n, c: r.c }))]
    .map(x => ({ ...x, k: S.dist.filter(d => d.owner === x.id).length }));
  return counts.sort((a, b) => b.k - a.k || (a.id === 'me' ? -1 : 1));
}
function weeklyReset() {
  const rank = weeklyRanking(), me = rank.findIndex(x => x.id === 'me');
  if (S.crew) {
    const rw = [{ credits: 6000, chips: 200 }, { credits: 3000, chips: 100 }, { credits: 1500, chips: 50 }, { credits: 500 }][me];
    if (rank[me].k > 0) { grant(rw); if (me === 0) { if (!S.titles.includes('도시의 지배자')) S.titles.push('도시의 지배자'); S.title = '도시의 지배자'; toast('주간 1등! 칭호 「도시의 지배자」', 'gold'); } }
  }
  news(`주간 정산: 1등은 ${rank[0].n} (${rank[0].k}구역).`);
  const pool = ['chrono', 'eclipse', 'reaper', 'hawkeye', 'pug', 'glitch', 'specter', 'blade'];
  const w = Math.floor((S.day - 1) / 7);
  S.bounty = { week: w, boss: pool[w % pool.length], hp: 1, clues: Math.min(S.bounty.clues, 1), tracks: 3, done: false };
  news(`이번 주 현상수배범: ${MERCS[S.bounty.boss].n}.`);
}

/* ===== 영입 ===== */
function canPromote(id) {
  const o = S.roster[id]; if (!o) return { ok: false, why: '보유하지 않음' };
  if (o.g >= 7) return { ok: false, why: '최고 등급' };
  if (o.g === 5 && repLv() < 8) return { ok: false, why: '에이스 승급은 평판 LV.8에 열려요', lock: 8 };
  if (o.g === 6 && repLv() < 9) return { ok: false, why: '레전드 승급은 평판 LV.9에 열려요', lock: 9 };
  if (o.ess < 1) return { ok: false, why: '정수가 필요해요 (같은 용병을 또 뽑으면 나와요)' };
  return { ok: true };
}
function rollOne(type) {
  const P = type === 'p' ? { rate: .06, pity: 50 } : { rate: .03, pity: 80 };
  S.pity[type]++;
  let legend = Math.random() < P.rate || S.pity[type] >= P.pity;
  if (legend) S.pity[type] = 0;
  if (legend) return pick(LEGEND_IDS);
  const pu = pickupId(); return Math.random() < .3 ? pu : pick(COMMON_IDS.filter(i => i !== pu));
}
function acquire(id) {
  const o = S.roster[id];
  if (!o) { S.roster[id] = newMerc(); return { kind: 'new', txt: 'NEW!' }; }
  if (o.g >= 7) { S.credits += 2000; return { kind: 'cr', txt: '+2,000C' }; }
  o.ess++; return { kind: 'ess', txt: '정수 +1' };
}
