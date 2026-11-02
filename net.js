'use strict';
/* =====================================================================
   SCM 온라인 모듈 (Firebase Auth + Firestore)
   firebase-config.js 에 설정이 있으면 켜지고, 없으면 오프라인으로 돌아가요.
   ---------------------------------------------------------------------
   users/{uid}      이름, 저장 데이터, 방어 팀, 랭킹용 점수, 소속 크루
   crews/{id}       크루 이름·색·크루장·크루원·가입 신청·경험치
     bounty/{w주}   크루가 함께 깎는 이번 주 현상수배범 체력
   districts/d0~11  구역 주인, 크루별 장악도
   news/{auto}      도시 소식
   meta/week_{n}    지난주 구역 순위 기록 (주간 보상용)
   ===================================================================== */
const NETACT = {}; // 온라인일 때만 ACT에 덮어써요
const NET = { on: false, db: null, auth: null, uid: null, name: '', crewId: null, crew: null, dist: [], unsubs: {}, saveTimer: null };
const FB_VER = '10.12.2';

function fbConfigured() { const c = window.FIREBASE_CONFIG; return !!(c && c.apiKey && c.projectId && !/여기/.test(c.apiKey)); }
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('불러오기 실패: ' + src)); document.head.appendChild(s); }); }
async function netInit() {
  if (!fbConfigured()) return false;
  if (!window.firebase) for (const m of ['app', 'auth', 'firestore']) await loadScript(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-${m}-compat.js`);
  if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
  NET.auth = firebase.auth(); NET.db = firebase.firestore(); NET.on = true; ONLINE = true;
  netInstall();
  return true;
}
const FV = () => firebase.firestore.FieldValue;
const sts = () => firebase.firestore.FieldValue.serverTimestamp();
const userRef = (uid = NET.uid) => NET.db.collection('users').doc(uid);
const crewRef = id => NET.db.collection('crews').doc(id);
const distRef = i => NET.db.collection('districts').doc('d' + i);
function netErr(e) {
  console.error(e);
  const m = String(e && (e.code || e.message) || e);
  toast(m.includes('permission') ? '서버가 거절했어요 (보안 규칙을 확인하세요)' : m.includes('unavailable') ? '서버에 연결할 수 없어요. 인터넷을 확인하세요' : '서버 오류: ' + m.slice(0, 60), 'bad');
}
function userSet(data) { return userRef().set(data, { merge: true }).catch(netErr); }
function softRefresh() {
  if (!S || !$('#view')) return;
  const typing = document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName);
  if (!$('#modal') && !B && !D && !typing) refresh(); else { renderTop(); renderTabs(); }
}

/* ---------- 로그인 ---------- */
function loginMsg(e) {
  const c = e && e.code || '';
  if (c.includes('popup-closed')) return '로그인 창이 닫혔어요. 다시 눌러 주세요.';
  if (c.includes('unauthorized-domain')) return '이 주소가 Firebase에 등록되지 않았어요. Authentication → 설정 → 승인된 도메인에 추가하세요.';
  if (c.includes('operation-not-allowed')) return '이 로그인 방법이 꺼져 있어요. Firebase Authentication에서 사용 설정하세요.';
  return '로그인 실패: ' + (c || e.message);
}
function showLogin() {
  return new Promise(resolve => {
    const el = document.createElement('div'); el.id = 'login';
    el.innerHTML = `<div class="box brk lg" style="--c:var(--pink)"><div class="eyebrow">SF CYBER MERCENARY · 2189</div>
      <div class="lgt">SCM</div><p class="sub">네온 도시의 용병단 단장으로 접속하세요. 크루, 구역 쟁탈전, 아레나, 랭킹은 서버에 저장돼요.</p>
      <button class="btn block" id="lg-google">Google로 로그인</button><button class="btn gray block" id="lg-guest">게스트로 시작</button>
      <p class="sub" style="font-size:12px">게스트는 이 기기에서만 이어서 할 수 있어요. 기기를 바꿀 거면 Google 로그인을 쓰세요.</p><p class="sub" id="lg-msg" style="color:var(--red)"></p></div>`;
    document.body.appendChild(el);
    let done = false;
    const un = NET.auth.onAuthStateChanged(u => { if (u && !done) { done = true; un(); el.remove(); resolve(u); } });
    const msg = t => { $('#lg-msg', el).textContent = t; };
    $('#lg-google', el).onclick = async () => {
      const p = new firebase.auth.GoogleAuthProvider();
      try { await NET.auth.signInWithPopup(p); }
      catch (e) { if (/popup-blocked|operation-not-supported/.test(e.code || '')) { try { await NET.auth.signInWithRedirect(p); } catch (e2) { msg(loginMsg(e2)); } } else msg(loginMsg(e)); }
    };
    $('#lg-guest', el).onclick = async () => { try { await NET.auth.signInAnonymously(); } catch (e) { msg(loginMsg(e)); } };
  });
}
function askName(def) {
  return new Promise(resolve => {
    const el = document.createElement('div'); el.id = 'login';
    el.innerHTML = `<div class="box brk lg" style="--c:var(--cyan)"><div class="eyebrow">CALLSIGN</div><div class="h1">단장 이름</div>
      <p class="sub">랭킹과 크루에 보이는 이름이에요. 2~10자.</p><input class="txt" id="nm-in" maxlength="10" value="${esc((def || '').slice(0, 10))}">
      <button class="btn cyan block" id="nm-ok">이 이름으로 시작</button><p class="sub" id="nm-msg" style="color:var(--red)"></p></div>`;
    document.body.appendChild(el);
    const go = () => { const v = $('#nm-in', el).value.trim(); if (v.length < 2) { $('#nm-msg', el).textContent = '2자 이상 적어 주세요'; return; } el.remove(); resolve(v); };
    $('#nm-ok', el).onclick = go; $('#nm-in', el).addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  });
}
async function netBoot() {
  const u = await showLogin();
  NET.uid = u.uid;
  let d = null;
  try { const snap = await userRef().get(); d = snap.exists ? snap.data() : null; } catch (e) { netErr(e); }
  S = null;
  if (d && d.save) { try { S = JSON.parse(d.save); } catch (e) { S = null; } }
  if (!S) S = load() || freshState(); // 처음 접속하면 이 기기에서 하던 걸 이어서 올려요
  const f = freshState(); for (const k in f) if (S[k] === undefined) S[k] = f[k];
  NET.name = (d && d.name) || await askName(u.displayName || '');
  NET.crewId = (d && d.crewId) || null;
  S.crew = null; S.crewXp = 0;
  netDaily();
  const first = { name: NET.name, crewId: NET.crewId };
  migrate(S);
  if (!d || !d.defense || sq3Notice()) first.defense = defenseTeam();
  await userSet(first);
  cloudSave();
  subDistricts(); subNews(); subCrew();
  addEventListener('visibilitychange', () => { if (document.hidden) cloudSave(); });
}
ACT.logout = async () => { await cloudSave(); Object.values(NET.unsubs).forEach(f => f && f()); await NET.auth.signOut(); try { localStorage.removeItem(SAVE_KEY); } catch (e) { } location.reload(); };

/* ---------- 저장 ---------- */
const _localSave = save;
const netSave = function () { _localSave(); if (!NET.uid) return; clearTimeout(NET.saveTimer); NET.saveTimer = setTimeout(cloudSave, 3000); };
function cloudSave() {
  if (!NET.uid || !S) return Promise.resolve();
  clearTimeout(NET.saveTimer);
  return userRef().set({
    save: JSON.stringify(S), name: NET.name, power: squadPower(), arenaScore: S.arena.score, diveBest: S.dive.best,
    buildingBest: S.building.best, rep: repLv(), title: S.title || '', updatedAt: sts(),
  }, { merge: true }).catch(netErr);
}
function defenseTeam() { return S.squad.slice(0, SQUAD_N).map((id, slot) => id ? { id, slot, g: S.roster[id].g, imp: S.roster[id].imp, mlv: S.roster[id].lv || 1 } : null).filter(Boolean); }
ACT.setDefense = () => { userSet({ defense: defenseTeam(), power: squadPower() }); toast('현재 분대를 방어 팀으로 등록했어요', 'good'); };

/* ---------- 하루 / 주간 (한국 시간) ---------- */
const weekKey = () => Math.floor((Date.now() + KST_OFF - Date.UTC(2026, 0, 5)) / (7 * 864e5)); // 월요일 0시 기준
const BOUNTY_POOL = ['chrono', 'eclipse', 'reaper', 'hawkeye', 'pug', 'glitch', 'specter', 'blade'];
function netDaily() {
  let changed = false;
  const dk = dayKey();
  if (!S.dayKey) S.dayKey = dk;
  else if (S.dayKey !== dk) {
    S.dayKey = dk; S.day++; changed = true; onNewDay();
    S.tickets = 3; S.defenses = 3; S.spClaimed = false; S.arena.tries = 5; S.arena.opps = null; S.dive.left = 3; S.bounty.tracks = 3;
    const keep = S.jobs.filter(j => j.st === 'ship');
    S.jobs = keep.concat(genJobs(S)).slice(0, Math.max(6, keep.length + 4));
    toast('새 날이 밝았어요. 의뢰판과 공격권이 채워졌어요', '');
  }
  const wk = weekKey();
  if (S.weekKey === undefined) S.weekKey = wk;
  else if (S.weekKey !== wk) { const prev = S.weekKey; S.weekKey = wk; changed = true; claimWeekly(prev); }
  if (S.bounty.week !== wk) {
    S.bounty = { week: wk, boss: BOUNTY_POOL[((wk % 8) + 8) % 8], lv: 10 + (((wk % 5) + 5) % 5) * 2, hp: 1, clues: Math.min(S.bounty.clues || 0, 1), tracks: 3, done: false };
    changed = true;
  }
  if (changed) save();
  return changed;
}
const netEndDay = () => toast('온라인에서는 매일 0시(한국 시간)에 자동으로 넘어가요', '');

/* ---------- 구역 (실시간 공유) ---------- */
function blankDistrict(i) { return { owner: 'npc', ownerName: DISTRICTS[i].g, ownerColor: DISTRICTS[i].c, ctrl: { npc: 100 }, names: {} }; }
function subDistricts() {
  NET.unsubs.dist = NET.db.collection('districts').onSnapshot(qs => {
    const arr = Array(12).fill(null);
    qs.forEach(doc => { const i = +doc.id.slice(1); if (i >= 0 && i < 12) arr[i] = doc.data(); });
    arr.forEach((x, i) => { if (!x) seedDistrict(i); });
    NET.dist = arr.map((x, i) => x || blankDistrict(i));
    mirrorDist(); softRefresh();
  }, netErr);
}
function seedDistrict(i) {
  const ref = distRef(i);
  NET.db.runTransaction(async t => { const s = await t.get(ref); if (!s.exists) t.set(ref, { ...blankDistrict(i), at: sts() }); }).catch(() => { });
}
function mirrorDist() { // 기존 화면 코드가 그대로 쓰도록 우리 크루를 'me'로 바꿔 S.dist에 비춰 둬요
  if (!NET.dist.length) return;
  const me = NET.crewId;
  S.dist = NET.dist.map(d => {
    const ctrl = { npc: d.ctrl.npc || 0, me: me ? (d.ctrl[me] || 0) : 0 };
    for (const k in d.ctrl) if (k !== 'npc' && k !== me) ctrl[k] = d.ctrl[k];
    return { owner: me && d.owner === me ? 'me' : d.owner, ctrl };
  });
}
const netOwnerName = (o, i) => { if (o === 'me') return S.crew ? S.crew.name : '우리'; if (o === 'npc') return null; const d = NET.dist.find(x => x.owner === o); return d ? d.ownerName : '다른 크루'; };
const netOwnerColor = (o, i) => { if (o === 'me') return S.crew ? S.crew.color : '#7DFF6A'; if (o === 'npc') return DISTRICTS[i].c; return (NET.dist[i] && NET.dist[i].ownerColor) || '#C8D0E0'; };
function rankingFromDist() {
  const m = {};
  NET.dist.forEach(d => { if (d.owner && d.owner !== 'npc') { m[d.owner] = m[d.owner] || { id: d.owner, n: d.ownerName, c: d.ownerColor, k: 0 }; m[d.owner].k++; } });
  return Object.values(m).sort((a, b) => b.k - a.k);
}
const netWeeklyRanking = () => {
  const r = rankingFromDist().map(x => ({ ...x, id: x.id === NET.crewId ? 'me' : x.id }));
  if (NET.crewId && !r.some(x => x.id === 'me') && S.crew) r.push({ id: 'me', n: S.crew.name, c: S.crew.color, k: 0 });
  if (!r.length) r.push({ id: 'none', n: '아직 구역을 차지한 크루가 없어요', c: '#2B2650', k: 0 });
  return r.slice(0, 8);
};
async function claimWeekly(prev) {
  if (!NET.crewId) return;
  const ref = NET.db.collection('meta').doc('week_' + prev);
  try {
    let rank;
    const snap = await ref.get();
    if (snap.exists) rank = snap.data().rank;
    else { rank = rankingFromDist(); try { await ref.set({ rank, at: sts() }); } catch (e) { rank = (await ref.get()).data().rank; } }
    const idx = rank.findIndex(r => r.id === NET.crewId);
    if (idx < 0 || !rank[idx].k) return;
    grant([{ credits: 6000, chips: 200 }, { credits: 3000, chips: 100 }, { credits: 1500, chips: 50 }][idx] || { credits: 500 });
    toast(`지난주 구역 순위 ${idx + 1}등 보상!`, 'gold');
    if (idx === 0) { if (!S.titles.includes('도시의 지배자')) S.titles.push('도시의 지배자'); S.title = '도시의 지배자'; }
    save();
  } catch (e) { netErr(e); }
}

/* ---------- 도시 소식 ---------- */
function subNews() {
  NET.unsubs.news = NET.db.collection('news').orderBy('at', 'desc').limit(8).onSnapshot(qs => {
    S.news = qs.docs.map(doc => { const x = doc.data(); const dt = x.at && x.at.toDate ? x.at.toDate() : new Date(); return { d: `${dt.getMonth() + 1}.${dt.getDate()}`, t: x.t }; });
    if (!S.news.length) S.news = [{ d: '—', t: '아직 조용한 도시예요.' }];
    softRefresh();
  }, netErr);
}
const netNews = t => { NET.db.collection('news').add({ t: String(t).slice(0, 120), at: sts(), by: NET.uid }).catch(() => { }); };

/* ---------- 크루 ---------- */
function subCrew() {
  if (NET.unsubs.crew) { NET.unsubs.crew(); NET.unsubs.crew = null; }
  const id = NET.crewId || S.pendingCrew;
  if (!id) { NET.crew = null; S.crew = null; mirrorDist(); return; }
  NET.unsubs.crew = crewRef(id).onSnapshot(s => {
    if (!s.exists) { if (NET.crewId) leftCrew('크루가 해체됐어요'); else { S.pendingCrew = null; subCrew(); } return; }
    const c = { id, ...s.data() };
    if (NET.crewId) {
      if (!c.members.includes(NET.uid)) { leftCrew('크루에서 나가게 됐어요'); return; }
    } else if (S.pendingCrew) {
      if (c.members.includes(NET.uid)) { NET.crewId = id; S.pendingCrew = null; userSet({ crewId: id }); toast(`크루 「${c.name}」 가입 승인!`, 'good'); }
      else if (!(c.pending || []).includes(NET.uid)) { S.pendingCrew = null; NET.crew = null; toast('가입 신청이 받아들여지지 않았어요', 'bad'); subCrew(); softRefresh(); return; }
    }
    NET.crew = c;
    if (NET.crewId) { S.crew = { name: c.name, color: c.color }; S.crewXp = c.xp || 0; } else S.crew = null;
    mirrorDist(); softRefresh();
  }, netErr);
}
function leftCrew(msg) { NET.crewId = null; NET.crew = null; S.crew = null; S.crewXp = 0; userSet({ crewId: null }); toast(msg, 'bad'); subCrew(); softRefresh(); }
const netAddCrewXp = n => { if (!NET.crewId || n <= 0) return; crewRef(NET.crewId).update({ xp: FV().increment(Math.min(50, Math.round(n))) }).catch(netErr); };
const isLeader = () => NET.crew && NET.crew.leader === NET.uid;

NETACT.makeCrew = async () => {
  const name = ($('#crew-name').value || '').trim();
  if (name.length < 2) { toast('크루 이름을 2자 이상 적어 주세요', 'bad'); return; }
  if (S.credits < 3000) { toast(`크레딧이 ${fmt(3000 - S.credits)}C 모자라요`, 'bad'); return; }
  const color = ACT._cc || CREW_COLORS[0];
  try {
    const ref = await NET.db.collection('crews').add({ name, color, leader: NET.uid, members: [NET.uid], names: { [NET.uid]: NET.name }, pending: [], pnames: {}, xp: 0, createdAt: sts() });
    S.credits -= 3000; NET.crewId = ref.id; S.pendingCrew = null;
    await userSet({ crewId: ref.id, defense: defenseTeam() });
    news(`새 크루 「${name}」 등장.`); toast(`크루 「${name}」 결성!`, 'good'); subCrew(); save();
  } catch (e) { netErr(e); }
};
ACT.findCrew = async () => {
  openModal({ label: 'CREWS', title: '크루 찾기', c: 'var(--cyan)', html: '<p class="sub">불러오는 중…</p>' });
  try {
    const qs = await NET.db.collection('crews').orderBy('xp', 'desc').limit(30).get();
    const rows = qs.docs.map(d => ({ id: d.id, ...d.data() }));
    setModalBody(rows.length ? `<div style="display:flex;flex-direction:column;gap:8px">${rows.map(c => `<div class="box spread" style="padding:10px">
      <div class="row">${hexEmblem(c.color, c.name[0], 34)}<div><b>${esc(c.name)}</b><div class="px dim" style="font-size:11px">LV.${Math.min(10, 1 + Math.floor((c.xp || 0) / 120))} · ${c.members.length}/10명</div></div></div>
      ${c.members.length >= 10 ? '<span class="px dim">FULL</span>' : `<button class="btn cyan sm" data-a="applyCrew" data-v="${c.id}">가입 신청</button>`}</div>`).join('')}</div>`
      : '<p class="sub">아직 크루가 없어요. 첫 크루를 만들어 보세요.</p>');
  } catch (e) { netErr(e); }
};
ACT.applyCrew = async id => {
  try {
    await crewRef(id).update({ pending: FV().arrayUnion(NET.uid), ['pnames.' + NET.uid]: NET.name });
    S.pendingCrew = id; save(); closeModal(); toast('가입 신청을 보냈어요. 크루장이 승인하면 들어가요', 'good'); subCrew(); refresh();
  } catch (e) { netErr(e); }
};
ACT.cancelApply = async () => {
  const id = S.pendingCrew; if (!id) return;
  try { await crewRef(id).update({ pending: FV().arrayRemove(NET.uid) }); } catch (e) { }
  S.pendingCrew = null; NET.crew = null; save(); subCrew(); refresh();
};
ACT.manageCrew = () => {
  const c = NET.crew; if (!c) return;
  const L = isLeader();
  const mem = c.members.map(uid => `<div class="spread" style="padding:6px 0;border-bottom:1px solid var(--line)"><span>${uid === c.leader ? '★ ' : ''}${esc(c.names[uid] || '단원')}${uid === NET.uid ? ' (나)' : ''}</span>
    ${L && uid !== NET.uid ? `<button class="btn red sm" data-a="kick" data-v="${uid}">추방</button>` : ''}</div>`).join('');
  const pend = (c.pending || []).map(uid => `<div class="spread" style="padding:6px 0;border-bottom:1px solid var(--line)"><span>${esc((c.pnames || {})[uid] || '지원자')}</span>
    ${L ? `<div class="row"><button class="btn lime sm" data-a="approve" data-v="${uid}">승인</button><button class="btn gray sm" data-a="reject" data-v="${uid}">거절</button></div>` : ''}</div>`).join('');
  openModal({
    label: 'CREW', title: c.name, c: c.color,
    html: `<div class="eyebrow">MEMBERS ${c.members.length}/10</div><div>${mem}</div>
      <div class="eyebrow" style="color:var(--amber)">가입 신청 ${(c.pending || []).length}</div><div>${pend || '<p class="sub">없음</p>'}</div>
      <button class="btn gray block" id="leave-btn" data-a="leaveCrew">${L && c.members.length === 1 ? '크루 해체' : '크루 탈퇴'}</button>`,
  });
};
ACT.approve = async uid => {
  const c = NET.crew; if (!isLeader()) return;
  if (c.members.length >= 10) { toast('크루원은 최대 10명이에요', 'bad'); return; }
  try { await crewRef(c.id).update({ members: FV().arrayUnion(uid), pending: FV().arrayRemove(uid), ['names.' + uid]: (c.pnames || {})[uid] || '단원' }); toast('가입을 승인했어요', 'good'); setTimeout(ACT.manageCrew, 300); } catch (e) { netErr(e); }
};
ACT.reject = async uid => { try { await crewRef(NET.crew.id).update({ pending: FV().arrayRemove(uid) }); setTimeout(ACT.manageCrew, 300); } catch (e) { netErr(e); } };
ACT.kick = async uid => { try { await crewRef(NET.crew.id).update({ members: FV().arrayRemove(uid) }); toast('추방했어요'); setTimeout(ACT.manageCrew, 300); } catch (e) { netErr(e); } };
ACT.leaveCrew = async (v, el) => {
  if (!el.dataset.arm) { el.dataset.arm = 1; el.textContent = '정말요? 한 번 더 누르세요'; el.classList.replace('gray', 'red'); return; }
  const c = NET.crew; if (!c) return;
  try {
    if (isLeader() && c.members.length === 1) await crewRef(c.id).delete();
    else if (isLeader()) await crewRef(c.id).update({ members: FV().arrayRemove(NET.uid), leader: c.members.find(u => u !== NET.uid) });
    else await crewRef(c.id).update({ members: FV().arrayRemove(NET.uid) });
    closeModal(); leftCrew('크루에서 나왔어요');
  } catch (e) { netErr(e); }
};

/* ---------- 도시 화면 (온라인) ---------- */
const _citySubRows = cityLower;
const netCity = () => {
  const L = repLv();
  if (L < 3) return `<div class="screen">${head('CITY', '도시', '구역 12곳을 두고 크루끼리 빼앗고 빼앗겨요.')}<div class="box brk" style="--c:var(--violet)"><div class="h2">아직 도시 밑바닥이에요</div><p class="sub">의뢰로 평판을 쌓아 LV.3이 되면 크루를 만들거나 가입하고 구역 쟁탈전에 들어갈 수 있어요.</p><div style="margin-top:10px">${lockLine(3)}</div></div>${_citySubRows()}</div>`;
  let crew;
  if (!NET.crewId && S.pendingCrew) {
    crew = `<div class="box brk" style="--c:var(--amber)"><div class="eyebrow" style="color:var(--amber)">PENDING</div><div class="h2">「${esc(NET.crew ? NET.crew.name : '…')}」 가입 신청 중</div>
      <p class="sub">크루장이 승인하면 바로 들어가요.</p><div style="margin-top:8px"><button class="btn gray sm" data-a="cancelApply">신청 취소</button></div></div>`;
  } else if (!NET.crewId) {
    crew = `<div class="box brk" style="--c:var(--pink)"><div class="eyebrow">CREW</div><div class="h2">크루 만들기 · 가입</div>
      <p class="sub">이름과 네온 색 엠블럼을 정해 새 크루를 만들거나, 다른 크루에 가입 신청을 보내요. 혼자서도 개인 크루로 활동할 수 있어요.</p>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:10px"><input class="txt" id="crew-name" maxlength="12" placeholder="크루 이름 (2~12자)">
      <div class="colors">${CREW_COLORS.map((c, i) => `<button style="background:${c}" data-a="crewColor" data-v="${c}" class="${(ACT._cc || CREW_COLORS[0]) === c ? 'on' : ''}" aria-label="색 ${i + 1}"></button>`).join('')}</div>
      <div class="row wrap"><button class="btn" data-a="makeCrew">크루 만들기 · 3,000C</button><button class="btn cyan" data-a="findCrew">크루 찾기</button></div></div></div>`;
  } else {
    const n = ownedDistricts().length, c = NET.crew || { members: [NET.uid] };
    crew = `<div class="box brk" style="--c:${S.crew ? S.crew.color : 'var(--pink)'}"><div class="crewbox">${hexEmblem(S.crew ? S.crew.color : 'var(--pink)', S.crew ? S.crew.name[0] : '?', 54)}
      <div class="meta"><div class="px" style="font-size:11px;color:${S.crew ? S.crew.color : 'var(--pink)'}">CREW LV.${crewLv()}${isLeader() ? ' · 크루장' : ''}</div><div class="h2">${esc(S.crew ? S.crew.name : '불러오는 중')}</div>
      <div class="sub">크루원 ${c.members.length}/10 · 버프 크레딧 +${crewBuff()}% · 차지 구역 ${n}</div><div class="gauge thin" style="margin-top:6px;max-width:200px"><i style="width:${crewLv() >= 10 ? 100 : (S.crewXp % 120) / 1.2}%;--gc:${S.crew ? S.crew.color : 'var(--pink)'}"></i></div></div>
      <div class="big"><div><b style="color:var(--pink)">${S.tickets}</b><span>공격권</span></div><div><b style="color:var(--cyan)">${S.defenses}</b><span>방어전</span></div></div></div>
      <div class="row wrap" style="margin-top:12px"><button class="btn cyan ${S.spClaimed || !n ? 'off' : ''}" data-a="claimSp" ${S.spClaimed || !n ? 'disabled' : ''} style="flex:1">${S.spClaimed ? '오늘 특산품 받음' : n ? `오늘 특산품 받기 (${n}구역)` : '구역을 차지하면 매일 특산품이 들어와요'}</button>
        <button class="btn gray sm" data-a="setDefense">현재 분대를 방어 팀으로</button><button class="btn gray sm" data-a="manageCrew">크루 관리${isLeader() && (c.pending || []).length ? ` (${c.pending.length})` : ''}</button></div></div>`;
  }
  const tiles = DISTRICTS.map((d, i) => {
    const st = S.dist[i], lock = L < d.rep, own = st.owner, oc = ownerColor(own, i);
    return `<button class="tile ${own === 'me' ? 'ours' : ''} ${lock ? 'locked' : ''}" style="--oc:${oc}" data-a="district" data-v="${i}">${bldSvg(i)}
      ${own === 'me' ? '<span class="ourst">OURS</span>' : ''}<span class="dn">${d.n}</span><span class="ow">${own === 'npc' ? d.g + ' (갱단)' : esc(ownerName(own, i))}</span>
      ${lock ? `<span class="lk">${IC.lock.replace('<svg', '<svg width="12" height="12"')}LV.${d.rep}</span>` : `<div class="gauge thin" style="margin-top:2px"><i style="width:${st.ctrl.me}%;--gc:${S.crew ? S.crew.color : 'var(--lime)'}"></i></div>`}
      <span class="sp">${d.sp}</span></button>`;
  }).join('');
  return `<div class="screen">${head('CITY', '도시', '구역은 서버에 저장돼서 모든 크루가 같은 지도를 봐요. 이기면 우리 장악도가 오르고 주인 장악도는 깎여요. 100에 닿으면 우리 구역.')}
    ${crew}<div class="dmap">${tiles}</div>${_citySubRows()}</div>`;
};
NETACT.district = v => {
  const i = +v, d = DISTRICTS[i], raw = NET.dist[i]; if (!raw) return;
  if (repLv() < d.rep) { toast(`${d.n}은(는) 평판 LV.${d.rep}에 열려요`, 'bad'); return; }
  const names = raw.names || {};
  const keys = Object.keys(raw.ctrl).filter(k => raw.ctrl[k] > 0 || k === raw.owner);
  if (NET.crewId && !keys.includes(NET.crewId)) keys.push(NET.crewId);
  const label = k => k === 'npc' ? [d.g + ' (갱단)', d.c] : k === NET.crewId ? [S.crew ? S.crew.name : '우리', S.crew ? S.crew.color : '#7DFF6A'] : [(names[k] && names[k].n) || (raw.owner === k ? raw.ownerName : '다른 크루'), (names[k] && names[k].c) || '#C8D0E0'];
  const bars = keys.map(k => { const [n, c] = label(k), v2 = raw.ctrl[k] || 0; return `<div class="sbar" style="grid-template-columns:110px 1fr 40px"><span style="color:${c};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(n)}${raw.owner === k ? ' ★' : ''}</span><div class="gauge"><i style="width:${v2}%;--gc:${c}"></i></div><span class="px">${v2}</span></div>`; }).join('');
  const ours = NET.crewId && raw.owner === NET.crewId, mine = NET.crewId ? (raw.ctrl[NET.crewId] || 0) : 0;
  let btn;
  if (!NET.crewId) btn = `<span class="lockline">크루에 들어가야 싸울 수 있어요</span>`;
  else if (ours) btn = mine >= 100 ? `<button class="btn cyan block off" disabled>완전 장악 중</button>` : `<button class="btn cyan block ${S.defenses ? '' : 'off'}" data-a="fightDistrict" data-v="${i}">방어전 · 장악도 +30 (남은 ${S.defenses})</button>`;
  else btn = `<button class="btn block ${S.tickets ? '' : 'off'}" data-a="fightDistrict" data-v="${i}">공격 · 공격권 1장 (남은 ${S.tickets})</button>`;
  openModal({
    label: 'DISTRICT', title: d.n, c: ours ? 'var(--lime)' : (raw.owner === 'npc' ? d.c : raw.ownerColor),
    html: `<div class="row wrap"><span class="tag" style="color:${d.c}">처음 주인 ${d.g}</span><span class="tag" style="color:var(--amber)">특산품 ${d.sp}</span><span class="tag" style="color:var(--dim)">${raw.owner === 'npc' || ours ? `갱단 레벨 ${d.lv}` : '상대: 크루원이 등록한 방어 팀'}</span></div>
      <div style="display:flex;flex-direction:column;gap:8px">${bars}</div>
      <p class="sub">이기면 우리 장악도 +35, 주인 장악도 −35. 100에 닿으면 우리 구역이 되고 크루원 모두 매일 특산품을 받아요. 다른 크루 구역을 치면 그 크루원이 등록한 방어 팀과 싸워요.</p>${btn}`,
  });
};
async function fetchDefense(crewId) {
  const qs = await NET.db.collection('users').where('crewId', '==', crewId).limit(10).get();
  const c = qs.docs.map(x => x.data()).filter(x => x.defense && x.defense.length);
  if (!c.length) return null;
  const p = pick(c);
  return { name: p.name, team: p.defense.slice(0, SQUAD_N).map((m, i) => ({ id: m.id, slot: i, g: m.g, imp: m.imp, mlv: m.mlv || 1, real: true, frame: frameOf(m.g) })) };
}
NETACT.fightDistrict = async v => {
  const i = +v, d = DISTRICTS[i], raw = NET.dist[i], ours = raw.owner === NET.crewId;
  if (!NET.crewId) return;
  if (ours ? S.defenses <= 0 : S.tickets <= 0) { toast(ours ? '오늘 방어전을 다 썼어요' : '오늘 공격권을 다 썼어요. 0시에 3장이 채워져요', 'bad'); return; }
  if (!S.squad.some(Boolean)) { toast('본부에서 용병을 배치하세요', 'bad'); return; }
  closeModal();
  let enemies, ename;
  if (raw.owner === 'npc' || ours) { enemies = makeGangTeam(d.lv); ename = ours ? `${d.g} 잔당` : d.g; }
  else {
    let t = null; try { t = await fetchDefense(raw.owner); } catch (e) { }
    if (t) { enemies = t.team; ename = `${raw.ownerName} · ${t.name}`; } else { enemies = makeGangTeam(d.lv + 2); ename = raw.ownerName; }
  }
  startBattle({
    pay: () => { if (ours) S.defenses--; else S.tickets--; },
    title: `${ours ? '구역 방어' : '구역 공격'} · ${d.n}`, enemyName: ename, allies: squadAllies(), enemies, time: 75,
    onEnd: res => {
      if (!res.win) { if (res.kind !== 'retreat') toast(`${d.n} ${ours ? '방어' : '공격'} 실패. 배치를 바꾸고 다시 도전하세요`, 'bad'); return; }
      addCrewXp(10); grant({ credits: 300 + d.lv * 30, rep: 8 }, true);
      districtWin(i);
    }
  });
};
async function districtWin(i) {
  const ref = distRef(i), me = NET.crewId, d = DISTRICTS[i];
  try {
    const out = await NET.db.runTransaction(async t => {
      const s = await t.get(ref); const x = s.exists ? s.data() : blankDistrict(i);
      const ctrl = { ...x.ctrl }, names = { ...(x.names || {}) };
      names[me] = { n: S.crew.name, c: S.crew.color };
      if (x.owner === me) { ctrl[me] = Math.min(100, (ctrl[me] || 0) + 30); t.set(ref, { ...x, ctrl, names, at: sts() }); return { k: 'def', v: ctrl[me] }; }
      ctrl[me] = Math.min(100, (ctrl[me] || 0) + 35); ctrl[x.owner] = Math.max(0, (ctrl[x.owner] || 0) - 35);
      const upd = { ...x, ctrl, names, at: sts() };
      if (ctrl[me] >= 100) { upd.owner = me; upd.ownerName = S.crew.name; upd.ownerColor = S.crew.color; }
      t.set(ref, upd);
      return { k: upd.owner === me ? 'took' : 'atk', v: ctrl[me], from: x.owner === 'npc' ? d.g : x.ownerName };
    });
    if (out.k === 'def') toast(`${d.n} 장악도 ${out.v}`, 'good');
    else if (out.k === 'took') { toast(`${d.n} 차지!`, 'gold'); news(`${S.crew.name}이(가) ${out.from}에게서 ${d.n}을(를) 빼앗았어요!`); }
    else toast(`${d.n} 장악도 ${out.v}/100`, 'good');
  } catch (e) { netErr(e); }
}

/* ---------- 아레나 (다른 플레이어의 방어 팀과 비동기 대전) ---------- */
const _openArena = openArena;
const netOpenArena = async function () {
  const a = S.arena;
  if (!a.opps || a.oppsDay !== S.day) {
    let real = [];
    try {
      const qs = await NET.db.collection('users').where('arenaScore', '>=', Math.max(0, a.score - 200)).orderBy('arenaScore').limit(25).get();
      real = shuffle(qs.docs.filter(d => d.id !== NET.uid && (d.data().defense || []).length)).slice(0, 3).map(d => {
        const u = d.data(), team = u.defense.slice(0, SQUAD_N).map((m, i) => ({ id: m.id, slot: i, g: m.g, imp: m.imp, mlv: m.mlv || 1, real: true, frame: frameOf(m.g) }));
        const pw = Math.round(team.reduce((s, t) => s + unitPower(mercStats(t.id, t.g, t.imp, 1, t.mlv)), 0));
        return { n: u.name, real: true, pw, lv: Math.max(1, 1 + (pw / teamPowerAt(1) - 1) / .13), team };
      });
    } catch (e) { console.error(e); }
    const base = 1 + Math.max(0, (a.score - 1000) / 40);
    while (real.length < 3) { const lv = Math.max(1, Math.round((base + [-1.5, 0, 2][real.length] + rnd(-.5, .5)) * 10) / 10); real.push({ n: pick(HANDLES), lv, team: makeArenaTeam(lv) }); }
    a.opps = real; a.oppsDay = S.day;
  }
  _openArena();
};

/* ---------- 현상금 사냥 (크루 협동: 크루원이 같은 보스 체력을 함께 깎아요) ---------- */
const _openBounty = openBounty, _bountyFight = ACT.bountyFight;
const bountyRef = () => crewRef(NET.crewId).collection('bounty').doc('w' + S.bounty.week);
const netOpenBounty = async function () {
  if (!NET.crewId) return _openBounty();
  const bt = S.bounty;
  try {
    const s = await bountyRef().get();
    if (!s.exists) await bountyRef().set({ hp: 1, boss: bt.boss, participants: [] });
    const x = s.exists ? s.data() : { hp: 1, participants: [] };
    bt.hp = x.hp; bt.done = x.hp <= 0; bt.crewParts = x.participants || [];
  } catch (e) { netErr(e); }
  _openBounty();
  const box = $('#modal .mbody');
  if (box) {
    const p = document.createElement('p'); p.className = 'sub';
    p.innerHTML = `<b style="color:var(--red)">크루 협동</b> · 보스 체력은 크루 전체가 함께 깎아요. 지금까지 ${(bt.crewParts || []).length}명 참여.`;
    box.insertBefore(p, box.lastElementChild);
    if (bt.done && (bt.crewParts || []).includes(NET.uid) && bt.claimed !== bt.week) {
      const b = document.createElement('button'); b.className = 'btn amber block'; b.textContent = '현상금 보상 받기'; b.dataset.a = 'bountyClaim'; box.appendChild(b);
    }
  }
};
NETACT.bountyFight = () => {
  if (!NET.crewId) return _bountyFight();
  const bt = S.bounty; if (bt.clues < 3 || bt.tracks <= 0 || bt.done) return;
  closeModal();
  const start = bt.hp;
  startBattle({
    pay: () => { bt.tracks--; },
    title: `현상금 사냥 · ${MERCS[bt.boss].n}`, enemyName: `현상수배범 ${MERCS[bt.boss].n}`, allies: squadAllies(),
    enemies: [{ id: bt.boss, slot: 0, boss: true, lv: bt.lv, frame: 2, hp: start, hpMul: 2.5 }], time: 40,
    onEnd: async res => {
      if (res.kind === 'retreat' && res.enemyHp >= start) return;
      const dealt = res.win ? start : Math.max(0, start - res.enemyHp);
      try {
        const hp = await NET.db.runTransaction(async t => {
          const s = await t.get(bountyRef()); const x = s.exists ? s.data() : { hp: 1, participants: [] };
          const nhp = Math.max(0, Math.round((x.hp - dealt) * 1000) / 1000);
          t.set(bountyRef(), { hp: nhp, boss: bt.boss, participants: FV().arrayUnion(NET.uid) }, { merge: true });
          return nhp;
        });
        bt.hp = hp;
        if (hp <= 0) { bt.done = true; toast(`현상수배범 ${MERCS[bt.boss].n} 제압! 작전 탭에서 보상을 받으세요`, 'gold'); news(`${S.crew.name}이(가) 현상수배범 ${MERCS[bt.boss].n}을(를) 잡았어요.`); }
        else toast(`크루 공동 보스 체력 ${Math.round(hp * 100)}% 남음`, '');
        save(); softRefresh();
      } catch (e) { netErr(e); }
    }
  });
};
ACT.bountyClaim = () => {
  const bt = S.bounty; if (bt.claimed === bt.week) return;
  bt.claimed = bt.week; const a = acquire(bt.boss);
  toast(a.kind === 'new' ? `${MERCS[bt.boss].n}이(가) 용병으로 합류했어요!` : `${MERCS[bt.boss].n} ${a.txt}`, 'gold');
  grant({ credits: 6000, chips: 150, rep: 60 }); closeModal(); refresh();
};

/* ---------- 랭킹 ---------- */
ACT.rankings = async () => {
  openModal({ label: 'LEADERBOARD', title: '전체 랭킹', c: 'var(--amber)', wide: true, html: '<p class="sub">불러오는 중…</p>' });
  const col = async (field, label, f) => {
    try {
      const qs = await NET.db.collection('users').orderBy(field, 'desc').limit(10).get();
      const rows = qs.docs.map((d, i) => { const u = d.data(); return `<div><span class="px">${i + 1}</span><i style="background:${d.id === NET.uid ? 'var(--lime)' : 'var(--line)'}"></i><span>${esc(u.name || '?')}</span><span class="px">${f(u[field] || 0)}</span></div>`; }).join('');
      return `<div class="box"><div class="eyebrow" style="color:var(--amber)">${label}</div><div class="rank" style="margin-top:6px">${rows || '<span class="sub">기록 없음</span>'}</div></div>`;
    } catch (e) { return `<div class="box"><div class="eyebrow">${label}</div><p class="sub">불러오지 못했어요</p></div>`; }
  };
  const html = (await Promise.all([col('arenaScore', 'ARENA', v => v), col('diveBest', 'NET DIVE', v => fmt(v)), col('buildingBest', 'BUILDING', v => v + 'F'), col('power', 'SQUAD POWER', v => fmt(v))])).join('');
  setModalBody(`<div class="grid2" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">${html}</div>`);
};

/* ---------- 온라인 모드로 갈아 끼우기 ---------- */
function netInstall() {
  save = netSave; endDay = netEndDay; ownerName = netOwnerName; ownerColor = netOwnerColor;
  weeklyRanking = netWeeklyRanking; news = netNews; addCrewXp = netAddCrewXp;
  openArena = netOpenArena; openBounty = netOpenBounty; SCREENS.city = netCity;
  Object.assign(ACT, NETACT);
}
