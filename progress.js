'use strict';
/* =====================================================================
   성장 시스템: 용병 레벨, 순찰(방치) 보상, 메인 작전(챕터), 진형 시너지,
   패시브 스킬, 일일 미션, 7일 출석, 픽업 배너·영입 마일리지
   ===================================================================== */

/* ---------- 용병 레벨 ---------- */
const LV_CAP = [0, 20, 30, 40, 50, 60, 70, 80]; // 등급별 최대 레벨
const lvCap = g => LV_CAP[g];
const lvStat = lv => 1 + (Math.max(1, lv) - 1) * .02;
const lvCost = L => ({ exp: Math.round(40 + 6 * Math.pow(L, 1.8)), cr: L * 30 });

/* ---------- 패시브 ---------- */
const PASSIVES = {
  ironwall: ['강철 대열', '아군 근접 용병(가디언·돌격) 방어 +15%'],
  pug: ['광폭화', '체력 50% 이하일 때 공격 +35%'],
  blade: ['잔상', '치명타가 터지면 30% 추가 베기'],
  reaper: ['처형', '체력 30% 이하인 적에게 피해 +50%'],
  hawkeye: ['첫 발', '전투 첫 공격 피해 2배'],
  specter: ['사냥꾼의 눈', '기절·표식·약화·둔화 상태의 적에게 피해 +30%'],
  glitch: ['노이즈', '기본 공격이 12% 확률로 적을 잠깐 기절시켜요'],
  neuro: ['신경 교란', '기본 공격에 맞은 적이 1초 동안 느려져요'],
  nano: ['나노 재생', '5초마다 아군 전체 체력 3% 회복'],
  halo: ['빛의 장막', '전투 시작 때 아군 전체에 체력 10% 보호막'],
  volt: ['전류 튐', '일반 공격이 다른 적 1명에게 35% 튐'],
  swarm: ['자율 드론', '일반 공격 뒤 드론이 25% 추가 사격'],
  chrono: ['가속 회로', '에너지 획득 +30%'],
  eclipse: ['사건의 지평선', '적을 처치하면 에너지 +40'],
};

/* ---------- 진형 시너지 ---------- */
function synergyOf(ids) {
  ids = ids.filter(Boolean);
  const out = [], b = { atk: 0, hp: 0, def: 0, crit: 0, spd: 0 };
  const els = {}; ids.forEach(id => { const e = MERCS[id].el; els[e] = (els[e] || 0) + 1; });
  const top = Object.entries(els).sort((a, c) => c[1] - a[1])[0];
  if (top && top[1] >= 2) {
    const v = [0, 0, 5, 10, 15, 20][top[1]], h = top[1] >= 3 ? v : 0;
    out.push({ n: `속성 공명 · ${ELEMS[top[0]].n} ${top[1]}`, d: `공격 +${v}%${h ? ` · 체력 +${h}%` : ''}`, c: ELEMS[top[0]].c });
    b.atk += v / 100; b.hp += h / 100;
  }
  const roles = ids.map(id => MERCS[id].role), has = r => roles.includes(r), cnt = r => roles.filter(x => x === r).length;
  if (has('guardian') && has('medic')) { out.push({ n: '생존 프로토콜', d: '가디언+메딕 · 방어 +12%', c: '#7DFF6A' }); b.def += .12; }
  if (has('hacker') && has('sniper')) { out.push({ n: '표적 연계', d: '해커+스나이퍼 · 치명 +8%p', c: '#FF3D9A' }); b.crit += 8; }
  if (cnt('assault') >= 2) { out.push({ n: '돌격 진형', d: '어설트 2명 · 속도 +10%', c: '#FFB627' }); b.spd += .1; }
  if (has('engineer') && has('guardian')) { out.push({ n: '전장 공학', d: '엔지니어+가디언 · 공격 +8%', c: '#2DE2E6' }); b.atk += .08; }
  if (ids.some(id => MERCS[id].legend)) { out.push({ n: '전설의 귀환', d: '전설 용병 · 체력 +8%', c: '#FFD54A' }); b.hp += .08; }
  return { list: out, buff: b };
}

/* ---------- 메인 작전 (10챕터 × 8스테이지) ---------- */
const CHAPTERS = [
  { n: '네온 거리의 신참', s: '사무실 앞 골목부터 정리하자. 핑크 팩츠가 우리 간판에 낙서를 했다.' },
  { n: '녹슨 부두', s: '컨테이너 사이로 밀수 화물이 오간다. 러스트 바이트가 길목을 막았고, 그 뒤에는 강철 건틀렛의 거인 CODE-H가 버티고 있다.', boss: 'codeh' },
  { n: '독안개 하수도', s: '도시 밑바닥의 밑바닥. 그린 미스트의 독가스를 뚫어야 한다.' },
  { n: '강철 공장', s: '쉬지 않는 공장. 아이언 후크의 갈고리 팔이 노동자를 붙잡고 있다.' },
  { n: '거미줄 암시장', s: '모든 것이 팔리는 골목. 스파이더 넷이 우리 정보를 팔아넘겼다.', boss: 'reaper' },
  { n: '모래 폐허', s: '무너진 옛 도시. 더스트 레이더즈가 보급선을 노린다.' },
  { n: '전기 연구 단지', s: '볼트헤드의 실험체가 탈출했다. 연구소는 아무것도 모른다고 한다.' },
  { n: '질주 고속도로', s: '밤의 고속도로는 나이트 레이서즈의 것. 속도로 이겨야 한다.' },
  { n: '황금 카지노', s: '골드 크라운의 금고에 기업의 비밀 장부가 있다.' },
  { n: '기업 본사', s: '모든 줄은 한 탑으로 이어진다. 도시의 진짜 주인을 만날 시간.', boss: 'eclipse' },
];
const STAGES_PER = 8;
const stageLv = idx => { const c = Math.floor(idx / STAGES_PER), s = idx % STAGES_PER; return Math.round((1 + c * 2.6 + s * .35 + (s === 7 ? 1 : 0)) * 10) / 10; };
const stageName = idx => `${Math.floor(idx / STAGES_PER) + 1}-${idx % STAGES_PER + 1}`;
function stageEnemies(idx) {
  const c = Math.floor(idx / STAGES_PER), s = idx % STAGES_PER, lv = stageLv(idx), boss = CHAPTERS[c].boss;
  if (s === 7 && boss) return [{ id: boss, slot: 0, boss: true, lv: BOSSES[boss] ? lv : lv - 2, frame: BOSSES[boss] ? 0 : 2 }];
  const t = makeGangTeam(lv); if (s === 7) t.forEach(u => { u.frame = Math.max(u.frame, 1); });
  return t;
}
/* 스테이지마다 다른 목표 */
const STAGE_MODES = ['elim', 'waves', 'hunt', 'elim', 'escort', 'waves', 'survive', 'boss'];
const MODE_INFO = {
  elim: { n: '섬멸', c: '#FF3D9A', d: '적을 모두 쓰러뜨려요. 빨간 경고 범위가 차오르면 회피로 빠져나오세요.', s3: '40초 안에' },
  waves: { n: '연속전', c: '#FFB627', d: '적이 3번에 나눠 몰려와요. 체력과 에너지는 다음 무리까지 이어져요.', s3: '75초 안에' },
  hunt: { n: '표적', c: '#FFD54A', d: '표적(노란 체력)이 22초 뒤 오른쪽으로 도망쳐요. 표적만 잡으면 이겨요. 직접 달려가 스킬을 집중하세요.', s3: '12초 안에 처치' },
  escort: { n: '호위', c: '#2DE2E6', d: '왼쪽의 화물 드론을 지켜요. 적 일부가 드론을 노려요. 드론 근처에서 싸우세요.', s3: '드론 체력 60% 이상' },
  survive: { n: '생존', c: '#7DFF6A', d: '45초 동안 버텨요. 쓰러뜨린 적은 잠시 뒤 다시 나와요.', s3: '적 8명 처치' },
  boss: { n: '보스', c: '#FF4B5C', d: '보스의 큰 공격은 빨간 원으로 미리 보여요. 원 밖으로 피하거나, 기절·정지시켜 끊으세요.', s3: '60초 안에' },
};
const stageMode = idx => STAGE_MODES[idx % STAGES_PER];
function stageDef(idx) {
  const mode = stageMode(idx), lv = stageLv(idx), info = MODE_INFO[mode];
  const d = { mode, time: 90 };
  if (mode === 'waves') { d.waves = [makeGangTeam(lv - .3, { count: 2 }), makeGangTeam(lv, { count: 3 }), makeGangTeam(lv + .4, { count: 3 })]; d.time = 150; d.star3 = { label: info.s3, test: B => B.t <= 75 }; }
  else if (mode === 'hunt') { const t = makeGangTeam(lv - .4); t[2].isTarget = true; t[2].hpMul = 1.5; d.enemies = t; d.escape = 22; d.star3 = { label: info.s3, test: B => B.t <= 12 }; }
  else if (mode === 'escort') { d.enemies = makeGangTeam(lv + .2); d.cargo = true; d.star3 = { label: info.s3, test: B => B.cargo && B.cargo.hp / B.cargo.maxHp >= .6 }; }
  else if (mode === 'survive') { d.enemies = makeGangTeam(lv - .2, { count: 3 }); d.time = 45; d.star3 = { label: info.s3, test: B => B.kills >= 8 }; }
  else if (mode === 'boss') { d.enemies = stageEnemies(idx); d.time = 120; d.star3 = { label: info.s3, test: B => B.t <= 60 }; }
  else { d.enemies = makeGangTeam(lv); d.star3 = { label: info.s3, test: B => B.t <= 40 }; }
  return d;
}
function stageReward(idx) {
  const s = idx % STAGES_PER, lv = stageLv(idx);
  return { credits: Math.round((300 + lv * 120) / 10) * 10 * (s === 7 ? 2 : 1), exp: Math.round(150 + lv * 90) * (s === 7 ? 2 : 1), chips: s === 7 ? 40 : s === 3 ? 10 : 0, rep: s === 7 ? 30 : 8 };
}
const campCleared = () => S.camp.n; // 깬 스테이지 수
function chapterStars(c) { let t = 0; for (let s = 0; s < STAGES_PER; s++) t += S.camp.stars[c * STAGES_PER + s] || 0; return t; }
const STAR_CHEST = [[8, { chips: 30 }], [16, { exp: 3000, credits: 3000 }], [24, { chips: 100 }]];

/* ---------- 순찰 (방치) 보상 ---------- */
const IDLE_CAP = 12 * 3600e3;
function idleRate() { const n = S.camp.n; return { cr: 5 + n * 1.2, exp: 8 + n * 2.5, chipH: 3 + Math.floor(n / 10), matH: 1 + n / 20 }; }
function idleCalc(ms) {
  const r = idleRate(), m = ms / 60000, h = ms / 3600e3;
  const mats = {}; const mt = Math.floor(r.matH * h);
  for (let i = 0; i < mt; i++) { const k = ['alloy', 'biogel', 'neural'][i % 3]; mats[k] = (mats[k] || 0) + 1; }
  return { credits: Math.floor(r.cr * m), exp: Math.floor(r.exp * m), chips: Math.floor(r.chipH * h), mats };
}
const idleElapsed = () => Math.min(IDLE_CAP, Math.max(0, Date.now() - S.idle.last));

/* ---------- 일일 미션 / 출석 ---------- */
const MISSIONS = [
  { k: 'win', n: '전투에서 3번 이기기', t: 3, p: 20 },
  { k: 'job', n: '의뢰 2개 완료하기', t: 2, p: 20 },
  { k: 'camp', n: '메인 작전 도전하기', t: 1, p: 15 },
  { k: 'ult', n: '궁극기 10번 쓰기', t: 10, p: 15 },
  { k: 'pull', n: '영입 1번 하기', t: 1, p: 10 },
  { k: 'idle', n: '순찰 보상 받기', t: 1, p: 10 },
  { k: 'lvup', n: '용병 레벨 올리기', t: 1, p: 10 },
];
const MISSION_CHEST = [[20, { credits: 1500 }], [40, { exp: 2000 }], [60, { chips: 30 }], [80, { mats: { alloy: 2, biogel: 2, neural: 2 } }], [100, { chips: 60 }]];
const ATTEND = [{ credits: 2000 }, { exp: 2500 }, { chips: 50 }, { mats: { alloy: 3, biogel: 3, neural: 3 } }, { credits: 5000 }, { exp: 6000 }, { chips: 150 }];
function track(k, n = 1) {
  if (!S || !S.daily) return;
  S.daily.prog[k] = (S.daily.prog[k] || 0) + n;
}
function missionPoints() { return MISSIONS.reduce((a, m) => a + ((S.daily.prog[m.k] || 0) >= m.t && S.daily.done.includes(m.k) ? m.p : 0), 0); }
const missionReady = () => MISSIONS.some(m => (S.daily.prog[m.k] || 0) >= m.t && !S.daily.done.includes(m.k)) || MISSION_CHEST.some(([p], i) => missionPoints() >= p && !S.daily.chest.includes(i));
const dayId = () => (typeof ONLINE !== 'undefined' && ONLINE && S.dayKey) ? S.dayKey : 'D' + S.day;
const attendReady = () => S.att.lastDay !== dayId();

/* ---------- 픽업 배너 / 마일리지 ---------- */
const weekIdx = () => (typeof ONLINE !== 'undefined' && ONLINE && S.weekKey !== undefined) ? S.weekKey : Math.floor((S.day - 1) / 7);
const pickupId = () => COMMON_IDS[((weekIdx() % 12) + 12) % 12];
const MILEAGE_COMMON = 100, MILEAGE_LEGEND = 300;

/* ---------- 새 날 / 옛 저장 보정 ---------- */
function onNewDay() {
  S.daily = { prog: {}, done: [], chest: [] };
  S.idle.fast = 0;
}
function sq3Notice() { // 5인 → 3인 분대로 바뀐 뒤 한 번만 알려요
  if (!S || !S.seen || S.seen.sq3 !== 1) return false; S.seen.sq3 = 2; save();
  setTimeout(() => toast('이제 출전은 3명이에요. 가장 강한 3명을 남겼어요. 본부에서 자리를 눌러 바꿀 수 있어요', 'gold'), 600); return true;
}
function migrate(st) {
  for (const id in st.roster) { const o = st.roster[id]; if (!o.lv) o.lv = 1; if (!o.imp) o.imp = { eye: 0, arm: 0, nerve: 0, skin: 0 }; }
  if (st.exp === undefined) st.exp = 1500;
  if (!st.camp) st.camp = { n: 0, stars: {}, chest: {} };
  if (!st.idle) st.idle = { last: Date.now(), fast: 0 };
  if (!st.daily) st.daily = { prog: {}, done: [], chest: [] };
  if (!st.att) st.att = { n: 0, lastDay: null };
  if (st.mileage === undefined) st.mileage = 0;
  if (!st.settings) st.settings = { sfx: true };
  if (st.squad && st.squad.length > SQUAD_N) { // 분대 5명 → 3명: 가장 강한 3명을 남겨요
    const pw = id => { const o = st.roster[id]; return o ? unitPower(mercStats(id, o.g, o.imp, 1, o.lv || 1)) : 0; };
    const keep = st.squad.filter(Boolean).sort((a, b) => pw(b) - pw(a)).slice(0, SQUAD_N);
    st.squad = Array.from({ length: SQUAD_N }, (_, i) => keep[i] || null);
    const run = st.building && st.building.run;
    if (run && run.squad && run.squad.length > SQUAD_N) { const hp = {}; const ids = run.squad.filter(Boolean).slice(0, SQUAD_N); ids.forEach((id, i) => { const old = run.squad.indexOf(id); hp[i] = run.hp[old] ?? 1; }); run.squad = ids; run.hp = hp; }
    if (!st.seen) st.seen = {}; st.seen.sq3 = 1;
  }
  return st;
}
