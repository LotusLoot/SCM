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
  ironwall: ['강철 대열', '아군 앞줄 방어 +15%'],
  pug: ['광폭화', '체력 50% 이하일 때 공격 +35%'],
  blade: ['잔상', '치명타가 터지면 30% 추가 베기'],
  reaper: ['처형', '체력 30% 이하인 적에게 피해 +50%'],
  hawkeye: ['첫 발', '전투 첫 공격 피해 2.5배'],
  specter: ['사냥꾼의 눈', '기절·정지·표식 상태의 적에게 피해 +30%'],
  glitch: ['노이즈', '일반 공격 15% 확률로 0.8초 기절'],
  neuro: ['신경 교란', '일반 공격이 적 궁극기 게이지를 8 깎음'],
  nano: ['나노 재생', '아군 전체가 매초 최대 체력 0.6% 회복'],
  halo: ['빛의 장막', '전투 시작 때 아군 전체에 체력 10% 보호막'],
  volt: ['전류 튐', '일반 공격이 다른 적 1명에게 35% 튐'],
  swarm: ['자율 드론', '일반 공격 뒤 드론이 25% 추가 사격'],
  chrono: ['가속 회로', '궁극기 게이지 획득 +30%'],
  eclipse: ['사건의 지평선', '적을 처치하면 궁극기 게이지 +40'],
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
  { n: '녹슨 부두', s: '컨테이너 사이로 밀수 화물이 오간다. 러스트 바이트가 길목을 막았다.' },
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
  if (s === 7 && boss) return [{ id: boss, slot: 0, boss: true, lv: lv - 2, frame: 2 }];
  const t = makeGangTeam(lv); if (s === 7) t.forEach(u => { u.frame = Math.max(u.frame, 1); });
  return t;
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
function migrate(st) {
  for (const id in st.roster) { const o = st.roster[id]; if (!o.lv) o.lv = 1; if (!o.imp) o.imp = { eye: 0, arm: 0, nerve: 0, skin: 0 }; }
  if (st.exp === undefined) st.exp = 1500;
  if (!st.camp) st.camp = { n: 0, stars: {}, chest: {} };
  if (!st.idle) st.idle = { last: Date.now(), fast: 0 };
  if (!st.daily) st.daily = { prog: {}, done: [], chest: [] };
  if (!st.att) st.att = { n: 0, lastDay: null };
  if (st.mileage === undefined) st.mileage = 0;
  if (!st.settings) st.settings = { sfx: true };
  return st;
}
