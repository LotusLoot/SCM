'use strict';
var ONLINE = false; // firebase-config.js가 채워져 있으면 net.js가 true로 바꿔요
/* ===== 기본 데이터 (기획서 그대로) ===== */
const ROLES = {
  guardian: { n: '가디언', d: '공격을 막는 탱커', row: 'front', hp: 1900, atk: 70, def: 80, spd: 85, crit: 5 },
  assault: { n: '어설트', d: '근접 돌격 딜러', row: 'front', hp: 1250, atk: 125, def: 45, spd: 110, crit: 12 },
  sniper: { n: '스나이퍼', d: '강한 한 방', row: 'back', hp: 1000, atk: 150, def: 30, spd: 80, crit: 20 },
  hacker: { n: '해커', d: '적 약화, 기절', row: 'back', hp: 1050, atk: 95, def: 35, spd: 100, crit: 10 },
  medic: { n: '메딕', d: '회복, 보호막', row: 'back', hp: 1080, atk: 72, def: 40, spd: 95, crit: 8 },
  engineer: { n: '엔지니어', d: '드론·포탑 소환', row: 'back', hp: 1100, atk: 105, def: 40, spd: 95, crit: 10 },
};
const ROLE_ORDER = ['guardian', 'assault', 'sniper', 'hacker', 'medic', 'engineer'];
const ELEMS = {
  plasma: { n: '플라즈마', c: '#FF3D9A' }, mech: { n: '기계', c: '#5BC0FF' }, bio: { n: '바이오', c: '#7DFF6A' },
  quantum: { n: '퀀텀', c: '#FFD54A' }, void: { n: '보이드', c: '#A874FF' },
};
function elemMul(a, d) {
  const beats = { plasma: 'mech', mech: 'bio', bio: 'plasma', quantum: 'void', void: 'quantum' };
  return beats[a] === d ? 1.5 : 1;
}
const MERCS = {
  ironwall: { n: '아이언월', role: 'guardian', el: 'mech', look: '거대한 방패를 든 육중한 사이보그', ult: '철벽', ud: '3초 동안 팀 전체 피해 70% 감소', sz: 1.12 },
  pug: { n: '퍼그', role: 'guardian', el: 'bio', look: '초록 생체 장갑과 거대한 생체 팔을 가진 사람형 돌연변이 거한', ult: '포효', ud: '적 전체를 자기에게 끌어오고 체력 회복', sz: 1.1 },
  blade: { n: '블레이드', role: 'assault', el: 'plasma', look: '빛나는 플라즈마 검의 검객', ult: '일섬', ud: '앞줄 적 전체 베기', sz: 1 },
  reaper: { n: '리퍼', role: 'assault', el: 'mech', look: '쌍칼을 든 안드로이드 닌자', ult: '그림자 연격', ud: '체력 낮은 적에게 순간이동 5연타', sz: 1.06 },
  hawkeye: { n: '호크아이', role: 'sniper', el: 'plasma', look: '긴 레일건을 멘 저격수', ult: '관통탄', ud: '한 줄을 꿰뚫는 초강력 한 방', sz: .9 },
  specter: { n: '스펙터', role: 'sniper', el: 'bio', look: '투명 위장 외계인', ult: '사냥 표식', ud: '적 1명이 받는 피해 2배', sz: 1 },
  glitch: { n: '글리치', role: 'hacker', el: 'mech', look: '홀로그램 해커 소녀', ult: '시스템 다운', ud: '적 전체 2초 기절', sz: .92 },
  neuro: { n: '뉴로', role: 'hacker', el: 'bio', look: '뇌파 해킹 사이보그', ult: '정신 장악', ud: '적 1명이 잠깐 아군 편에서 싸움', sz: 1 },
  nano: { n: '나노', role: 'medic', el: 'bio', look: '치유 나노 안개를 뿌리는 의료 장갑의 의사', ult: '나노 수복', ud: '팀 전체 크게 회복', sz: .96 },
  halo: { n: '헤일로', role: 'medic', el: 'plasma', look: '치유 드론을 거느린 천사형 안드로이드', ult: '수호 드론', ud: '팀 전체에 보호막', sz: .98 },
  volt: { n: '볼트', role: 'engineer', el: 'plasma', look: '렌치를 든 정비공', ult: '포탑 배치', ud: '대형 포탑 소환', sz: 1 },
  swarm: { n: '스웜', role: 'engineer', el: 'mech', look: '드론 군단을 조종하는 파일럿', ult: '드론 폭격', ud: '적 전체에 미사일 비', sz: 1 },
  chrono: { n: '크로노', role: 'assault', el: 'quantum', look: '은발에 금빛 눈을 가진 젊은 남자 검사, 시간을 멈추는 퀀텀 칼날', ult: '시간 정지', ud: '적 전체를 멈추고 아군이 한 턴 더', sz: 1.02, legend: true },
  eclipse: { n: '이클립스', role: 'sniper', el: 'void', look: '검은 단발에 보라 네온 브릿지를 넣은 여자 저격수, 보라 빛 눈과 우아한 롱코트', ult: '일식', ud: '적을 한가운데로 빨아들여 폭발', sz: 1.02, legend: true },
};
const MERC_IDS = Object.keys(MERCS);
const COMMON_IDS = MERC_IDS.filter(id => !MERCS[id].legend);
const LEGEND_IDS = MERC_IDS.filter(id => MERCS[id].legend);
const GRADES = [null,
  { n: '스카우트', en: 'SCOUT', c: '#8A879E', m: 1 },
  { n: '레이더', en: 'RAIDER', c: '#4ADE80', m: 1.2 },
  { n: '솔저', en: 'SOLDIER', c: '#3B82F6', m: 1.42 },
  { n: '커맨도', en: 'COMMANDO', c: '#A855F7', m: 1.68 },
  { n: '엘리트', en: 'ELITE', c: '#FB923C', m: 1.98 },
  { n: '에이스', en: 'ACE', c: '#FF2A4F', m: 2.4 },
  { n: '레전드', en: 'LEGEND', c: '#FF3D9A', m: 3.0 },
];
const frameOf = g => (g >= 7 ? 2 : g === 6 ? 1 : 0);
const imgSrc = (id, f) => `img/${id}_${f}.webp`;

const IMPLANTS = {
  eye: { n: '눈', stat: '치명타', per: 2, unit: '%p', mat: 'neural', rep: 5 },
  arm: { n: '팔', stat: '공격', per: 5, unit: '%', mat: 'alloy', rep: 5 },
  nerve: { n: '신경', stat: '속도', per: 4, unit: '%', mat: 'biogel', rep: 7 },
  skin: { n: '피부', stat: '방어', per: 6, unit: '%', mat: 'alloy', rep: 7 },
};
const MATS = { alloy: '합금', biogel: '바이오젤', neural: '뉴럴칩' };

const REP_XP = [0, 0, 100, 260, 480, 760, 1100, 1500, 1980, 2540, 3200];
const REP_UNLOCK = [null,
  '의뢰, 일반 영입', '아레나', '크루 만들기·가입, 구역 쟁탈전', '빌딩 습격', '고급 영입, 임플란트 눈·팔 칸',
  '넷 다이브', '현상금 사냥, 임플란트 신경·피부 칸', '에이스 승급', '레전드 승급', '기업 본사 타워 도전, 칭호 「도시의 전설」'];

const DISTRICTS = [
  { n: '네온 거리', g: '핑크 팩츠', c: '#FF3D9A', sp: '크레딧', k: 'credit', rep: 3, lv: 3 },
  { n: '컨테이너 부두', g: '러스트 바이트', c: '#E07A2E', sp: '합금 (임플란트 재료)', k: 'alloy', rep: 3, lv: 4 },
  { n: '하수 터널', g: '그린 미스트', c: '#7DFF6A', sp: '바이오젤 (임플란트 재료)', k: 'biogel', rep: 3, lv: 5 },
  { n: '공장 지구', g: '아이언 후크', c: '#9AA3B5', sp: '크레딧 대량', k: 'credit2', rep: 4, lv: 6 },
  { n: '암시장 골목', g: '스파이더 넷', c: '#A874FF', sp: '무작위 일반 용병 정수 (가끔)', k: 'essence', rep: 4, lv: 7 },
  { n: '폐허 구역', g: '더스트 레이더즈', c: '#C9A66B', sp: '무작위 보급 상자', k: 'box', rep: 5, lv: 9 },
  { n: '연구 단지', g: '볼트헤드', c: '#3B8BFF', sp: '뉴럴칩 (임플란트 재료)', k: 'neural', rep: 5, lv: 10 },
  { n: '고속도로 교차로', g: '나이트 레이서즈', c: '#FF8A1F', sp: '의뢰 보상 +20%', k: 'jobbonus', rep: 6, lv: 11 },
  { n: '카지노 스트립', g: '골드 크라운', c: '#FFC83A', sp: '크레딧 (가끔 대박)', k: 'casino', rep: 6, lv: 12 },
  { n: '데이터 센터', g: '고스트 코드', c: '#2DE2E6', sp: '데이터칩', k: 'chips', rep: 7, lv: 14 },
  { n: '스카이라인 고층가', g: '크롬 엘리트', c: '#D9DEE8', sp: '크레딧 + 평판', k: 'credrep', rep: 8, lv: 16 },
  { n: '기업 본사 타워', g: '기업 경비대', c: '#FF2A2A', sp: '전설 용병 정수 (가끔)', k: 'legend', rep: 10, lv: 20 },
];
const RIVALS = [
  { id: 'r0', n: '블랙 서킷', c: '#5B8BFF', p: 1.0 },
  { id: 'r1', n: '레드 오메가', c: '#FF6A3D', p: 1.15 },
  { id: 'r2', n: '실버 팽', c: '#C8D0E0', p: 1.3 },
];
const CREW_COLORS = ['#FF3D9A', '#2DE2E6', '#7DFF6A', '#FFB627', '#A874FF', '#FF4B5C'];

const BROKERS = {
  lu: { n: '마담 루', d: '우아한 사업가', c: '#FF3D9A', k: 'L' },
  dok: { n: '도크', d: '수다스러운 정보상', c: '#2DE2E6', k: 'D' },
  hound: { n: '블러드하운드', d: '무뚝뚝한 현상금 중개인', c: '#FFB627', k: 'B' },
};
const DIFFS = [{ n: '쉬움', lv: -1, rep: 22, cr: 1 }, { n: '보통', lv: .3, rep: 38, cr: 1.4 }, { n: '어려움', lv: 1.6, rep: 58, cr: 2 }, { n: '위험', lv: 3.2, rep: 85, cr: 3 }];
const JOB_T = {
  escort: { b: 'lu', n: '호위', titles: ['VIP 호위: 크롬 리무진', '갤러리 경매장 경비', '기업 이사 퇴근길 호위', '클럽 「바이올렛 룸」 방어'], d: '습격해 오는 갱단을 막아 내세요. 방어전이에요.' },
  ship: { b: 'lu', n: '운송', titles: ['의료 캡슐 운송', '암호화 화물 배달', '희귀 칵테일 원액 운반', '기밀 서류 전달'], d: '용병 1명을 보내요. 시간이 지나면 보상을 받아요.' },
  hack: { b: 'dok', n: '해킹', titles: ['보험사 서버 털기', '광고탑 신호 가로채기', '은행 백업 금고 열기', '경찰 드론 로그 지우기'], d: '넷 다이브로 데이터 조각을 모으세요. 조각 5개 이상이면 성공.' },
  sneak: { b: 'dok', n: '잠입', titles: ['연구소 샘플 빼 오기', '갱단 회계 장부 훔치기', '물류 창고 잠입'], d: '45초 안에 경비를 모두 쓰러뜨려야 해요.' },
  raid: { b: 'hound', n: '습격', titles: ['밀수 창고 습격', '불법 임플란트 공장 급습', '도망친 해결사 제압'], d: '먼저 쳐들어가는 공격전이에요.' },
  clue: { b: 'hound', n: '현상금 단서', titles: ['수배범 연락책 추적', '은신처 정보원 심문', '도주 차량 추적'], d: '이기면 이번 주 현상수배범의 단서를 얻어요.' },
};

/* ===== 유틸 ===== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const rnd = (a, b) => a + Math.random() * (b - a);
const rint = (a, b) => Math.floor(rnd(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = n => Math.round(n).toLocaleString('en-US');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* ===== 아이콘 (SVG) ===== */
const IC = {
  guardian: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/></svg>',
  assault: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20l4-4M6 14l4 4M9 15L20 4v4L11 17"/></svg>',
  sniper: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/></svg>',
  hacker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="14"/><path d="M7 9l3 2-3 2M12 14h5"/></svg>',
  medic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/></svg>',
  engineer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>',
  credit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M15 9.5a3.5 3.5 0 100 5"/></svg>',
  chip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/></svg>',
  alloy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 16l5-8h13l-5 8z"/></svg>',
  biogel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3s6 7 6 11a6 6 0 01-12 0c0-4 6-11 6-11z"/></svg>',
  neural: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="10" cy="18" r="2"/><path d="M8 7l8 1M17 10l-6 6M7 8l2 8"/></svg>',
  hq: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21V9l9-6 9 6v12M9 21v-6h6v6"/></svg>',
  merc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M4 21c1-5 4-7 8-7s7 2 8 7"/></svg>',
  hire: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="3" width="16" height="18"/><path d="M12 8v8M8 12h8"/></svg>',
  job: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="7" width="18" height="13"/><path d="M9 7V4h6v3M3 12h18"/></svg>',
  city: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21V10h5v11M8 21V4h8v17M16 21v-8h5v8M2 21h20"/></svg>',
  ops: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"/></svg>',
};
const resIcon = k => IC[k] || '';
