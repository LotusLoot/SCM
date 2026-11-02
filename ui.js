'use strict';
/* =====================================================================
   새 화면: 로비형 본부, 출격(메인 작전 + 특수 작전), 용병(필터·상세 탭),
   영입(픽업·마일리지), 순찰 보상, 일일 미션, 출석, 보상 창
   ===================================================================== */
const STAGE_POS = [[60, 70], [72, 91], [19, 55], [30, 73], [42, 91]];
const BASIC_ATK = { guardian: '가까운 앞줄 적을 방패로 친다', assault: '가까운 적에게 돌진해 벤다', sniper: '체력이 가장 낮은 적을 저격한다', hacker: '적을 공격하고 30% 확률로 약화(공격 −20%)', medic: '체력 70% 아래 아군을 치료한다', engineer: '공구와 드론으로 적을 공격한다' };
const dur = ms => { const m = Math.floor(ms / 60000), h = Math.floor(m / 60); return h ? `${h}시간 ${m % 60}분` : `${m}분`; };

/* ---------- 보상 창 ---------- */
function rewardTiles(r) {
  const t = [];
  if (r.credits) t.push(['credit', fmt(r.credits), '크레딧', 'var(--amber)']);
  if (r.chips) t.push(['chip', fmt(r.chips), '데이터칩', 'var(--cyan)']);
  if (r.exp) t.push(['neural', fmt(r.exp), '전투 데이터', 'var(--violet)']);
  if (r.mats) for (const k in r.mats) if (r.mats[k]) t.push([k, r.mats[k], MATS[k], 'var(--dim)']);
  return `<div class="rtiles">${t.map(([k, v, n, c], i) => `<div class="rtile" style="--c:${c};animation-delay:${i * .07}s">${resIcon(k)}<b class="px">${v}</b><span>${n}</span></div>`).join('')}</div>`;
}
function showRewards(title, r, after) {
  grant(r, true); sfx('reward');
  openModal({ label: 'REWARD', title, c: 'var(--amber)', html: `${rewardTiles(r)}<button class="btn amber block" data-a="closeModal">확인</button>`, onClose: () => { refresh(); if (after) after(); } });
}

/* ================= 본부 (로비) ================= */
SCREENS.hq = () => {
  const pw = squadPower(), sq = S.squad, syn = synergyOf(sq);
  const roles = sq.filter(Boolean).map(id => MERCS[id].role);
  const warn = []; if (!roles.includes('guardian')) warn.push('가디언 없음'); if (!roles.includes('medic')) warn.push('메딕 없음');
  const small = innerWidth < 520;
  const slots = [2, 3, 4, 0, 1].map(i => {
    const [x, y] = STAGE_POS[i], id = sq[i];
    if (!id) return `<div class="slot empty" style="left:${x}%;top:${y}%;z-index:${y}" data-a="pickSlot" data-v="${i}" role="button" tabindex="0" aria-label="빈 자리"><div class="holo">+</div><div class="lbl" style="--gc:var(--cyan)">${i < 2 ? '앞줄' : '뒷줄'}</div></div>`;
    const o = S.roster[id], f = frameOf(o.g), [w, h, ax] = SPR[id][f], H = Math.round((small ? 128 : 160) * MERCS[id].sz), sw = Math.round(w / 300 * H), sh = Math.round(h / 300 * H);
    return `<div class="slot" style="left:${x}%;top:${y}%;z-index:${y};--gc:${GRADES[o.g].c}" data-a="pickSlot" data-v="${i}" role="button" tabindex="0" aria-label="${MERCS[id].n} 바꾸기">
      <img class="bob" style="width:${sw}px;height:${sh}px;transform:translateX(${((.5 - ax) * 100).toFixed(1)}%);animation-delay:-${(i * .7).toFixed(1)}s" src="${imgSrc(id, f)}" alt="" draggable="false"><div class="pad"></div></div>
      <div class="slab" style="left:${x}%;top:${y}%;--gc:${GRADES[o.g].c}">${MERCS[id].n} <span>Lv ${o.lv}</span></div>`;
  }).join('');
  const el = idleElapsed(), idleP = el / IDLE_CAP, ic = idleCalc(el);
  const n = S.camp.n, done = n >= CHAPTERS.length * STAGES_PER;
  const L = repLv();
  const mp = missionPoints();
  const q = (k, c, v, d, tab, art) => `<button class="box qcard brk" style="--c:${c}" data-a="tab" data-v="${tab}"><span class="k">${k}</span><span class="v">${v}</span><span class="d">${d}</span><img src="${imgSrc(art, 0)}" alt=""></button>`;
  const unlockRows = REP_UNLOCK.slice(1).map((t, i) => `<tr class="${i + 1 <= L ? 'got' : 'no'} ${i + 1 === L ? 'cur' : ''}"><td class="px">LV.${i + 1}</td><td>${t}</td></tr>`).join('');
  const tier = tierOf(S.arena.score);
  return `<div class="screen">
    <div class="stage tall">${slots}
      <div class="info"><span class="pwl">SQUAD POWER</span><span class="pw">${fmt(pw)}</span>
        <div class="synmini">${syn.list.slice(0, 4).map(x => `<span style="--sc:${x.c}">${x.n}</span>`).join('')}</div>
        ${warn.length ? `<span class="warn">⚠ ${warn.join('·')}</span>` : ''}</div>
      <div class="dock">
        <button class="dk" data-a="missions" aria-label="일일 미션">${IC.job}<span>미션</span>${missionReady() ? '<i class="nd"></i>' : ''}<em class="px">${mp}</em></button>
        <button class="dk" data-a="attend" aria-label="출석">${IC.hire}<span>출석</span>${attendReady() ? '<i class="nd"></i>' : ''}</button>
        <button class="dk" data-a="toggleSfx" aria-label="효과음">${S.settings.sfx ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 010 6M19 6a8 8 0 010 12"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>'}<span>소리</span></button>
      </div>
      <div class="dayline px">DAY ${S.day}</div>
    </div>
    <div class="lobbyrow">
      <button class="idle box brk" style="--c:var(--amber)" data-a="idle">
        <div class="chest ${idleP >= .99 ? 'full' : ''}"><svg viewBox="0 0 48 40"><path d="M4 14h40v22H4z" fill="#3a2a10" stroke="#FFB627" stroke-width="2"/><path d="M4 14l6-10h28l6 10" fill="#5a3f12" stroke="#FFB627" stroke-width="2"/><rect x="20" y="17" width="8" height="9" fill="#FFB627"/></svg></div>
        <div class="idt"><span class="eyebrow" style="color:var(--amber)">PATROL</span><b>순찰 보상</b><span class="px dim">${dur(el)} / 12시간</span>
          <div class="gauge thin"><i style="width:${idleP * 100}%;--gc:var(--amber)"></i></div><span class="sub" style="font-size:11px">${fmt(ic.credits)}C · 데이터 ${fmt(ic.exp)}</span></div>
      </button>
      <button class="cta" data-a="tab" data-v="ops"><span class="px">SORTIE</span><b>출격</b><small>${done ? '메인 작전 완료 · 특수 작전' : `메인 작전 ${stageName(n)} · ${CHAPTERS[Math.floor(n / STAGES_PER)].n}`}</small></button>
    </div>
    <div class="grid2">
      ${q('JOBS', 'var(--pink)', S.jobs.filter(j => j.st === 'open').length, '남은 의뢰', 'job', 'nano')}
      ${q('TERRITORY', 'var(--cyan)', L >= 3 ? (S.crew ? `${S.tickets}/3` : '—') : 'LV.3', L >= 3 ? (S.crew ? '구역 공격권' : '크루를 만들면 열려요') : '평판 LV.3에 열려요', 'city', 'glitch')}
      ${q('ARENA', 'var(--amber)', L >= 2 ? `${S.arena.tries}/5` : 'LV.2', L >= 2 ? '아레나 남은 횟수' : '평판 LV.2에 열려요', 'ops', 'blade')}
      ${q('RECRUIT', 'var(--violet)', Math.floor(S.credits / 1000), `일반 영입 가능 · 픽업 ${MERCS[pickupId()].n}`, 'hire', pickupId())}
    </div>
    ${ONLINE ? '' : `<div class="box brk" style="--c:var(--amber)"><div class="spread"><div><div class="eyebrow" style="color:var(--amber)">DAY ${S.day}</div><div class="h2">하루 마치기</div>
      <p class="sub">의뢰판·공격권·아레나·미션이 새로 채워지고 경쟁 크루가 움직여요.</p></div><button class="btn amber" data-a="endDay">다음 날로</button></div></div>`}
    <details class="box fold"><summary><span class="eyebrow">REPUTATION</span> 평판 해금표 · 지금 LV.${L}</summary><div style="overflow-x:auto;margin-top:8px"><table class="tbl"><tbody>${unlockRows}</tbody></table></div></details>
    <div class="box"><div class="eyebrow">RECORDS</div><div class="h2" style="margin-bottom:10px">기록</div>
      <div class="stats">
        <div class="stat"><b>${S.rec.w}승 ${S.rec.l}패</b><span>전적</span></div>
        <div class="stat"><b>${stageName(Math.max(0, n - 1))}</b><span>메인 작전 (${n}스테이지 클리어)</span></div>
        <div class="stat"><b>${S.building.best}F</b><span>빌딩 습격 최고 층수</span></div>
        <div class="stat"><b>${fmt(S.dive.best)}</b><span>넷 다이브 최고점</span></div>
        <div class="stat"><b style="color:${tier[2]}">${S.arena.score} ${tier[1]}</b><span>아레나 점수</span></div>
        <div class="stat"><b>${fmt(S.exp)}</b><span>전투 데이터 (레벨업 재료)</span></div>
        <div class="stat" style="grid-column:1/-1"><b style="font-size:13px">${MATS.alloy} ${S.mats.alloy} · ${MATS.biogel} ${S.mats.biogel} · ${MATS.neural} ${S.mats.neural}</b><span>임플란트 재료</span></div>
        <div class="stat" style="grid-column:1/-1"><b style="font-family:var(--f-title);font-size:14px">${S.titles.length ? S.titles.map(t => `「${t}」`).join(' ') : '아직 없음'}</b><span>칭호</span></div>
      </div>
      <div class="row wrap" style="margin-top:12px"><button class="btn cyan sm" data-a="saveCode">저장 코드 복사·불러오기</button>${ONLINE ? `<span class="sub" style="align-self:center">단장 ${esc(NET.name)} · 클라우드 저장 중</span><button class="btn gray sm" data-a="logout">로그아웃</button>` : ''}</div></div></div>`;
};
ACT.toggleSfx = () => { S.settings.sfx = !S.settings.sfx; audio(); sfx('click'); refresh(); };

/* --- 순찰 --- */
ACT.idle = () => {
  const el = idleElapsed(), r = idleCalc(el), rate = idleRate(), fast = S.idle.fast || 0;
  const fastCost = fast === 0 ? 0 : 50;
  openModal({
    label: 'PATROL', title: '순찰 보상', c: 'var(--amber)',
    html: `<p class="sub">용병단이 자리를 비운 사이에도 도시를 순찰하며 보상을 모아요. 최대 12시간까지 쌓이고, 메인 작전을 깰수록 많아져요.</p>
      <div class="row wrap" style="gap:8px"><span class="tag" style="color:var(--amber)">시간당 ${fmt(rate.cr * 60)}C</span><span class="tag" style="color:var(--violet)">시간당 데이터 ${fmt(rate.exp * 60)}</span><span class="tag" style="color:var(--cyan)">시간당 칩 ${rate.chipH}</span></div>
      <div class="px" style="font-size:12px">쌓인 시간 ${dur(el)} / 12시간</div><div class="gauge"><i style="width:${el / IDLE_CAP * 100}%;--gc:var(--amber)"></i></div>
      ${rewardTiles(r)}
      <div class="row wrap"><button class="btn amber" style="flex:1" data-a="idleClaim" ${el < 60000 ? 'disabled' : ''}>받기</button>
      <button class="btn cyan ${fast >= 3 ? 'off' : ''}" data-a="idleFast" ${fast >= 3 ? 'disabled' : ''}>빠른 순찰 · 2시간 즉시 ${fastCost ? `(칩 ${fastCost})` : '(오늘 무료)'}</button></div>
      <p class="sub" style="font-size:12px">빠른 순찰은 하루 3번 (첫 번째 무료).</p>`,
  });
};
ACT.idleClaim = () => {
  const el = idleElapsed(); if (el < 60000) return;
  const r = idleCalc(el); S.idle.last = Date.now(); track('idle'); closeModal(true);
  showRewards('순찰 보상', r);
};
ACT.idleFast = () => {
  const fast = S.idle.fast || 0; if (fast >= 3) return;
  const cost = fast === 0 ? 0 : 50; if (S.chips < cost) { toast('데이터칩이 모자라요', 'bad'); return; }
  S.chips -= cost; S.idle.fast = fast + 1; track('idle'); closeModal(true);
  showRewards('빠른 순찰', idleCalc(2 * 3600e3));
};

/* --- 일일 미션 --- */
ACT.missions = () => {
  const mp = missionPoints();
  const rows = MISSIONS.map(m => {
    const p = Math.min(m.t, S.daily.prog[m.k] || 0), ok = p >= m.t, got = S.daily.done.includes(m.k);
    return `<div class="mis ${got ? 'got' : ''}"><div><b>${m.n}</b><div class="gauge thin" style="margin-top:4px"><i style="width:${p / m.t * 100}%;--gc:${ok ? 'var(--lime)' : 'var(--cyan)'}"></i></div><span class="px dim" style="font-size:10px">${p}/${m.t} · ${m.p}P</span></div>
      ${got ? '<span class="px dim">DONE</span>' : `<button class="btn sm ${ok ? 'lime' : 'gray off'}" data-a="misClaim" data-v="${m.k}" ${ok ? '' : 'disabled'}>받기</button>`}</div>`;
  }).join('');
  const chest = MISSION_CHEST.map(([p, r], i) => { const ok = mp >= p, got = S.daily.chest.includes(i); return `<button class="mchest ${ok ? 'ok' : ''} ${got ? 'got' : ''}" data-a="misChest" data-v="${i}" ${ok && !got ? '' : 'disabled'}><span class="px">${p}</span>${got ? '✓' : '◆'}</button>`; }).join('');
  openModal({
    label: 'DAILY', title: '일일 미션', c: 'var(--lime)',
    html: `<div class="mtrack"><div class="mchests">${chest}</div><div class="gauge"><i style="width:${mp}%;--gc:var(--lime)"></i></div><div class="px dim" style="font-size:10px;margin-top:4px">${mp}/100P</div></div>
      <p class="sub" style="font-size:12px">미션을 깨고 포인트를 모으면 상자가 열려요. ${ONLINE ? '매일 0시' : '하루를 마치면'} 새로 시작해요.</p>${rows}`,
  });
};
ACT.misClaim = k => { const m = MISSIONS.find(x => x.k === k); if (!m || S.daily.done.includes(k) || (S.daily.prog[k] || 0) < m.t) return; S.daily.done.push(k); sfx('reward'); save(); ACT.missions(); renderTabs(); };
ACT.misChest = v => { const i = +v; if (S.daily.chest.includes(i) || missionPoints() < MISSION_CHEST[i][0]) return; S.daily.chest.push(i); closeModal(true); showRewards(`미션 ${MISSION_CHEST[i][0]}P 상자`, MISSION_CHEST[i][1], ACT.missions); };

/* --- 출석 --- */
ACT.attend = () => {
  const ready = attendReady(), cur = S.att.n % 7;
  const tiles = ATTEND.map((r, i) => {
    const got = i < cur || (!ready && i === (cur + 6) % 7 && S.att.n > 0 && cur === 0), today = ready && i === cur;
    const k = r.chips ? ['chip', r.chips, 'var(--cyan)'] : r.exp ? ['neural', fmt(r.exp), 'var(--violet)'] : r.credits ? ['credit', fmt(r.credits), 'var(--amber)'] : ['alloy', '재료×9', 'var(--dim)'];
    return `<div class="att ${i < cur ? 'got' : ''} ${today ? 'today' : ''} ${i === 6 ? 'big' : ''}" style="--c:${k[2]}"><span class="px">DAY ${i + 1}</span>${resIcon(k[0])}<b class="px">${k[1]}</b>${i < cur ? '<em>✓</em>' : ''}</div>`;
  }).join('');
  openModal({
    label: 'CHECK-IN', title: '7일 출석', c: 'var(--violet)',
    html: `<p class="sub">매일 접속하면 보상을 받아요. 7일째에는 데이터칩 150개.</p><div class="attgrid">${tiles}</div>
      ${ready ? '<button class="btn block" data-a="attClaim">오늘 출석 보상 받기</button>' : '<button class="btn gray block off" disabled>오늘은 받았어요. 내일 또 와요</button>'}`,
  });
};
ACT.attClaim = () => {
  if (!attendReady()) return;
  const r = ATTEND[S.att.n % 7]; S.att.n++; S.att.lastDay = dayId(); closeModal(true);
  showRewards(`출석 ${((S.att.n - 1) % 7) + 1}일째`, r);
};

/* ================= 용병 ================= */
const MF = { role: 'all', el: 'all', sort: 'power' };
SCREENS.merc = () => {
  const n = MERC_IDS.filter(owns).length;
  let ids = MERC_IDS.filter(id => (MF.role === 'all' || MERCS[id].role === MF.role) && (MF.el === 'all' || MERCS[id].el === MF.el));
  const score = id => { const o = S.roster[id]; if (!o) return -1; return MF.sort === 'power' ? unitPower(ownStats(id)) : MF.sort === 'grade' ? o.g * 1000 + o.lv : o.lv * 10 + o.g; };
  ids.sort((a, b) => score(b) - score(a));
  const chip = (k, v, label) => `<button class="chip ${MF[k] === v ? 'on' : ''}" data-a="mf" data-v="${k}:${v}">${label}</button>`;
  return `<div class="screen">${head('ROSTER', `보유 ${n}/14`, `전투 데이터 ${fmt(S.exp)} · 카드를 눌러 레벨업·승급·임플란트`)}
    <div class="filters">
      <div class="chips">${chip('role', 'all', '전체')}${ROLE_ORDER.map(r => chip('role', r, ROLES[r].n)).join('')}</div>
      <div class="chips">${chip('el', 'all', '모든 속성')}${Object.keys(ELEMS).map(e => chip('el', e, ELEMS[e].n)).join('')}<span style="flex:1"></span>${chip('sort', 'power', '전투력순')}${chip('sort', 'grade', '등급순')}${chip('sort', 'level', '레벨순')}</div>
    </div>
    <div class="cards">${ids.map(id => mercCard(id, { act: 'mercDetail', pow: 1, flag: S.squad.includes(id) ? '출전' : '' })).join('') || '<p class="sub">조건에 맞는 용병이 없어요.</p>'}</div></div>`;
};
ACT.mf = v => { const [k, x] = v.split(':'); MF[k] = x; refresh(); };

let MD_TAB = 'info';
ACT.mdTab = v => { MD_TAB = v; ACT.mercDetail(ACT._md); };
ACT.mercDetail = id => {
  ACT._md = id;
  const m = MERCS[id], o = S.roster[id], g = o ? o.g : 1;
  const st = o ? ownStats(id) : mercStats(id, 1);
  const stg = [['BASIC', 0, 1], ['ACE', 1, 6], ['LEGEND', 2, 7]].map(([l, f, need]) =>
    `<div class="${o && frameOf(g) === f ? 'cur' : ''}"><span>${l}</span><img class="${o && g >= need ? '' : 'lock'}" src="${imgSrc(id, f)}" alt=""></div>`).join('');
  const bar = (n, v, max, c) => `<div class="sbar"><span>${n}</span><div class="gauge"><i style="width:${Math.min(100, v / max * 100)}%;--gc:${c}"></i></div><span class="px">${fmt(v)}</span></div>`;
  const tabs = o ? `<div class="tabs">${[['info', '정보'], ['grow', '성장'], ['imp', '임플란트']].map(([k, n]) => `<button class="${MD_TAB === k ? 'on' : ''}" data-a="mdTab" data-v="${k}">${n}</button>`).join('')}</div>` : '';
  const tab = o ? MD_TAB : 'info';
  let body = '';
  if (tab === 'info') {
    body = `<p style="margin:0">${esc(m.look)}</p>
      <div class="skills">
        <div class="sk"><span class="sl">기본 공격</span><b>${ROLES[m.role].n} 공격</b><span class="sub">${BASIC_ATK[m.role]}</span></div>
        <div class="sk"><span class="sl" style="color:var(--cyan)">패시브</span><b>${PASSIVES[id][0]}</b><span class="sub">${PASSIVES[id][1]}</span></div>
        <div class="sk ult"><span class="sl" style="color:var(--pink)">궁극기</span><b style="color:var(--pink)">${m.ult}</b><span class="sub">${m.ud}</span></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">${bar('체력', st.hp, 9000, 'var(--lime)')}${bar('공격', st.atk, 1300, 'var(--pink)')}${bar('방어', st.def, 700, 'var(--cyan)')}${bar('속도', st.spd, 220, 'var(--amber)')}${bar('치명', st.crit, 60, 'var(--violet)')}</div>`;
  } else if (tab === 'grow') {
    const cap = lvCap(g), c1 = lvCost(o.lv);
    const pr = canPromote(id), nextG = Math.min(7, g + 1);
    const promo = g >= 7 ? `<button class="btn block off" disabled>최고 등급 · 이후 정수는 2,000C로 바뀌어요</button>`
      : pr.ok ? `<button class="btn block" data-a="promote" data-v="${id}">승급: ${GRADES[g].n} → ${GRADES[nextG].n} (정수 1 · 최대 레벨 ${cap}→${lvCap(nextG)})</button>`
        : pr.lock ? `<span class="lockline">${IC.lock}${pr.why}</span>` : `<button class="btn block off" disabled>승급하려면 정수 1개 필요 (보유 ${o.ess})</button>`;
    body = `<div class="lvbox"><div class="lvbig px">LV ${o.lv}<small>/${cap}</small></div><div style="flex:1"><div class="gauge"><i style="width:${o.lv / cap * 100}%;--gc:var(--violet)"></i></div>
      <div class="sub" style="font-size:12px;margin-top:4px">${o.lv >= cap ? '최대 레벨이에요. 승급하면 더 올릴 수 있어요.' : `다음 레벨: 전투 데이터 ${fmt(c1.exp)} · ${fmt(c1.cr)}C (보유 ${fmt(S.exp)})`}</div></div></div>
      <div class="row wrap">${[1, 5, 99].map(k => `<button class="btn sm ${o.lv >= cap ? 'off' : 'cyan'}" data-a="lvup" data-v="${id}:${k}" ${o.lv >= cap ? 'disabled' : ''}>${k === 99 ? '최대한' : '+' + k} 레벨</button>`).join('')}</div>
      <p class="sub" style="font-size:12px">레벨 1마다 모든 능력치 +2%. 전투 데이터는 메인 작전·순찰·전투 승리로 모여요.</p>
      <div class="eyebrow" style="color:var(--amber)">GRADE · 정수 ${o.ess}</div>${promo}`;
  } else {
    body = `<div class="sub">장비 대신 몸에 다는 사이버 부품. 구역 특산품·빌딩 습격·순찰에서 얻는 재료로 강화해요.</div>` + Object.entries(IMPLANTS).map(([k, im]) => {
      const lv = o.imp[k], locked = repLv() < im.rep, cost = 300 * (lv + 1), mc = (lv + 1) * 2;
      return `<div class="imp"><b>${im.n}<small>${im.stat} +${im.per}${im.unit}/LV</small></b>
        <div><div class="gauge thin"><i style="width:${lv * 10}%;--gc:var(--violet)"></i></div><small class="px dim" style="font-size:10px">LV.${lv}/10 · ${im.stat} +${lv * im.per}${im.unit} · ${MATS[im.mat]} ${S.mats[im.mat]}</small></div>
        ${locked ? `<span class="lockline" style="padding:4px 8px">${IC.lock}LV.${im.rep}</span>` : lv >= 10 ? '<span class="px dim">MAX</span>' : `<button class="btn sm amber" data-a="implant" data-v="${id}:${k}">${fmt(cost)}C·${MATS[im.mat]} ${mc}</button>`}</div>`;
    }).join('');
  }
  openModal({
    label: `${ROLES[m.role].n} · ${ELEMS[m.el].n}`, title: `${m.n}${o ? ` <span class="px" style="font-size:14px;color:var(--violet)">LV${o.lv}</span>` : ''}`, c: GRADES[g].c, wide: true,
    html: `<div class="detail-art">${stg}</div>
      <div class="row wrap"><span class="tag e-${m.el}">${ELEMS[m.el].n}</span><span class="tag" style="color:var(--dim)">${ROLES[m.role].n} · ${ROLES[m.role].d}</span>
        ${o ? `<span class="tag" style="color:${GRADES[g].c}">${GRADES[g].n} ${GRADES[g].en}</span><span class="tag" style="color:var(--amber)">전투력 ${fmt(unitPower(st))}</span>` : `<span class="tag" style="color:var(--dim)">${m.legend ? 'LEGENDARY · 영입에서 3~6%' : 'NOT HIRED · 영입에서 만날 수 있어요'}</span>`}</div>
      ${tabs}${body}`,
  });
};
ACT.lvup = v => {
  const [id, k] = v.split(':'), o = S.roster[id]; let n = 0;
  while (n < +k && o.lv < lvCap(o.g)) { const c = lvCost(o.lv); if (S.exp < c.exp || S.credits < c.cr) break; S.exp -= c.exp; S.credits -= c.cr; o.lv++; n++; }
  if (!n) { const c = lvCost(o.lv); toast(S.exp < c.exp ? `전투 데이터가 ${fmt(c.exp - S.exp)} 모자라요. 순찰 보상과 메인 작전에서 모으세요` : '크레딧이 모자라요', 'bad'); sfx('bad'); return; }
  track('lvup', n); sfx('lvup'); toast(`${MERCS[id].n} LV.${o.lv}!`, 'good');
  save(); renderTop(); renderTabs(); ACT.mercDetail(id);
  if (TAB === 'merc' || TAB === 'hq') { const sc = $('#view').scrollTop; $('#view').innerHTML = SCREENS[TAB](); $('#view').scrollTop = sc; }
};
ACT.promote = id => {
  const pr = canPromote(id); if (!pr.ok) { toast(pr.why, 'bad'); return; }
  const o = S.roster[id]; o.ess--; o.g++;
  toast(`승급! ${MERCS[id].n} → ${GRADES[o.g].n} · 최대 레벨 ${lvCap(o.g)}`, 'gold'); sfx(o.g >= 6 ? 'legend' : 'lvup');
  if (o.g >= 6) legendFlash();
  refresh(); ACT.mercDetail(id);
};
ACT.implant = v => {
  const [id, k] = v.split(':'), o = S.roster[id], im = IMPLANTS[k], lv = o.imp[k], cost = 300 * (lv + 1), mc = (lv + 1) * 2;
  if (S.credits < cost) { toast(`크레딧이 ${fmt(cost - S.credits)}C 모자라요`, 'bad'); return; }
  if (S.mats[im.mat] < mc) { toast(`${MATS[im.mat]}이(가) 모자라요. 구역 특산품·순찰·빌딩 습격에서 얻어요`, 'bad'); return; }
  S.credits -= cost; S.mats[im.mat] -= mc; o.imp[k]++; sfx('lvup');
  toast(`${MERCS[id].n} ${im.n} 임플란트 LV.${o.imp[k]}`, 'good'); refresh(); ACT.mercDetail(id);
};

/* ================= 영입 ================= */
SCREENS.hire = () => {
  const L = repLv(), pu = pickupId();
  const ban = (type) => {
    const p = type === 'p', c = p ? 'var(--cyan)' : 'var(--amber)', left = (p ? 50 : 80) - S.pity[type];
    const cost1 = p ? 100 : 1000, cost10 = p ? 900 : 9000, cur = p ? 'chip' : 'credit', locked = p && L < 5;
    const arts = p ? `<img src="${imgSrc('chrono', 2)}" alt=""><img src="${imgSrc('eclipse', 2)}" alt="">` : `<img src="${imgSrc('eclipse', 0)}" alt="" style="opacity:.35"><img src="${imgSrc(pu, 1)}" alt="">`;
    return `<div class="box brk banner" style="--c:${c}"><div class="arts">${arts}</div>
      <div class="txtw"><div class="eyebrow" style="color:${c}">${p ? 'PREMIUM' : 'PICK UP'} RECRUIT</div>
      <div class="ttl">${p ? '고급 영입' : '일반 영입'}</div>
      <div class="sub">${p ? '데이터칩으로 하는 영입. 전설 확률 2배.' : `이번 주 픽업 <b style="color:var(--fg)">${MERCS[pu].n}</b> · 일반 용병이 나올 때 30%가 픽업이에요.`}</div>
      <div class="row wrap" style="gap:6px"><span class="tag" style="color:${c}">전설 ${p ? 6 : 3}%</span><span class="tag" style="color:${c}">${p ? 50 : 80}회 천장</span></div>
      <div><div class="sub" style="font-size:12px">전설 확정까지 <b class="px" style="color:${c}">${left}</b>회</div><div class="gauge" style="margin-top:4px"><i style="width:${S.pity[type] / (p ? 50 : 80) * 100}%;--gc:${c}"></i></div></div></div>
      <div class="btns">${locked ? lockLine(5) : `
        <button class="btn ${p ? 'cyan' : 'amber'}" data-a="pull" data-v="${type}1">1회 · ${resIcon(cur).replace('<svg', '<svg class="ic"')} ${fmt(cost1)}</button>
        <button class="btn" data-a="pull" data-v="${type}10">10회 · ${resIcon(cur).replace('<svg', '<svg class="ic"')} ${fmt(cost10)}</button>`}</div></div>`;
  };
  return `<div class="screen">${head('RECRUIT', '영입', '같은 용병이 겹치면 정수가 나오고, 정수 1개로 등급이 한 번 올라가요. 레전드 이후 정수는 2,000C로 바뀌어요.')}
    <div class="banners">${ban('n')}${ban('p')}</div>
    <div class="box brk" style="--c:var(--violet)"><div class="spread"><div><div class="eyebrow" style="color:var(--violet)">MILEAGE</div><div class="h2">영입 마일리지 <span class="px" style="color:var(--violet)">${S.mileage}</span></div>
      <p class="sub">영입 1번마다 1점. 일반 용병 정수는 ${MILEAGE_COMMON}점, 전설 용병은 ${MILEAGE_LEGEND}점으로 원하는 용병을 골라 받아요.</p></div>
      <button class="btn sm ${S.mileage >= MILEAGE_COMMON ? '' : 'gray'}" data-a="mileage">교환하기</button></div>
      <div class="gauge thin" style="margin-top:8px"><i style="width:${Math.min(100, S.mileage / MILEAGE_LEGEND * 100)}%;--gc:var(--violet)"></i></div></div>
    <div class="box"><div class="eyebrow">RATES</div><table class="tbl"><thead><tr><th></th><th>일반 영입</th><th>고급 영입</th></tr></thead><tbody>
      <tr><td>비용</td><td>1회 1,000C / 10회 9,000C</td><td>1회 데이터칩 100 / 10회 900</td></tr>
      <tr><td>일반 용병 12명 중 1명</td><td>97% (그중 30% 픽업)</td><td>94% (그중 30% 픽업)</td></tr><tr><td>전설 (크로노·이클립스)</td><td>3%</td><td>6%</td></tr>
      <tr><td>천장</td><td>80회 안에 전설 확정</td><td>50회 안에 전설 확정</td></tr></tbody></table></div></div>`;
};
ACT.pull = v => {
  const type = v[0], n = +v.slice(1), p = type === 'p';
  const cost = p ? (n === 10 ? 900 : 100) : (n === 10 ? 9000 : 1000);
  if (p && repLv() < 5) { toast('고급 영입은 평판 LV.5에 열려요', 'bad'); return; }
  if (p ? S.chips < cost : S.credits < cost) { toast(p ? `데이터칩이 ${cost - S.chips}개 모자라요` : `크레딧이 ${fmt(cost - S.credits)}C 모자라요. 의뢰·메인 작전으로 벌어 오세요`, 'bad'); sfx('bad'); return; }
  if (p) S.chips -= cost; else S.credits -= cost;
  const res = []; for (let i = 0; i < n; i++) { const id = rollOne(type); res.push({ id, r: acquire(id) }); }
  S.mileage += n; track('pull', n);
  save(); renderTop(); renderTabs();
  const best = res.some(x => MERCS[x.id].legend);
  const html = `<div class="pull-grid">${res.map((x, i) => `<div class="pc ${MERCS[x.id].legend ? 'leg' : ''}" data-i="${i}" data-leg="${MERCS[x.id].legend ? 1 : ''}"><div class="flipper">${mercCard(x.id, { force: 1, noLv: 1 })}</div>
    <div class="res-l" style="color:${x.r.kind === 'new' ? 'var(--cyan)' : x.r.kind === 'cr' ? 'var(--amber)' : 'var(--fg)'}">${x.r.txt}</div></div>`).join('')}</div>
    <div class="row wrap" style="justify-content:center;margin-top:6px"><button class="btn ${p ? 'cyan' : 'amber'}" data-a="pull" data-v="${v}">한 번 더</button><button class="btn gray" data-a="closeModal">확인</button></div>`;
  openModal({
    label: best ? 'LEGENDARY!' : 'RESULT', title: `${p ? '고급' : '일반'} 영입 ${n}회`, wide: true, c: best ? 'var(--gold)' : p ? 'var(--cyan)' : 'var(--amber)', html,
    onMount: b => { $$('.pc', b).forEach((pc, i) => setTimeout(() => { pc.classList.add('show'); sfx(pc.dataset.leg ? 'legend' : 'flip'); if (pc.dataset.leg) legendFlash(); }, REDUCED ? 0 : 150 + i * 90 + (pc.dataset.leg ? 200 : 0))); },
    onClose: () => refresh(),
  });
  if (TAB === 'hire') { const sc = $('#view').scrollTop; $('#view').innerHTML = SCREENS.hire(); $('#view').scrollTop = sc; }
};
ACT.mileage = () => {
  openModal({
    label: 'MILEAGE', title: `마일리지 교환 · ${S.mileage}점`, c: 'var(--violet)', wide: true,
    html: `<p class="sub">고른 용병이 없으면 합류하고, 있으면 정수 1개를 받아요. 일반 ${MILEAGE_COMMON}점 · 전설 ${MILEAGE_LEGEND}점.</p>
      <div class="cards">${MERC_IDS.map(id => { const c = MERCS[id].legend ? MILEAGE_LEGEND : MILEAGE_COMMON; return `<div>${mercCard(id, { act: S.mileage >= c ? 'mileSwap' : '', noLv: 1 })}<div class="px" style="text-align:center;font-size:11px;margin-top:4px;color:${S.mileage >= c ? 'var(--violet)' : 'var(--dim)'}">${c}점</div></div>`; }).join('')}</div>`,
  });
};
ACT.mileSwap = id => {
  const c = MERCS[id].legend ? MILEAGE_LEGEND : MILEAGE_COMMON; if (S.mileage < c) return;
  S.mileage -= c; const a = acquire(id); closeModal(true); sfx(MERCS[id].legend ? 'legend' : 'reward');
  toast(`${MERCS[id].n} ${a.kind === 'new' ? '합류!' : a.txt}`, 'gold'); refresh();
};

/* ================= 출격 (메인 작전 + 특수 작전) ================= */
let CV = null; // 보고 있는 챕터
SCREENS.ops = () => {
  const total = CHAPTERS.length * STAGES_PER, n = S.camp.n;
  if (CV === null) CV = Math.min(CHAPTERS.length - 1, Math.floor(n / STAGES_PER));
  const ch = CHAPTERS[CV], d = DISTRICTS[Math.min(11, CV + (CV >= 9 ? 2 : 0))], stars = chapterStars(CV);
  const nodes = Array.from({ length: STAGES_PER }, (_, s) => {
    const idx = CV * STAGES_PER + s, st = S.camp.stars[idx] || 0, state = idx < n ? 'clr' : idx === n ? 'cur' : 'lock';
    return `<button class="node ${state} ${s === 7 ? 'boss' : ''}" data-a="campFight" data-v="${idx}" ${state === 'lock' ? 'disabled' : ''}>
      <span class="px nn">${stageName(idx)}</span>${s === 7 ? '<span class="bt">BOSS</span>' : ''}<span class="ns">${[0, 1, 2].map(i => `<i class="${i < st ? 'on' : ''}"></i>`).join('')}</span><span class="px nl">LV${Math.round(stageLv(idx))}</span></button>`;
  }).join('');
  const chests = STAR_CHEST.map(([need, r], i) => { const got = (S.camp.chest[CV] || []).includes(i), ok = stars >= need; return `<button class="schest ${ok ? 'ok' : ''} ${got ? 'got' : ''}" data-a="starChest" data-v="${CV}:${i}" ${ok && !got ? '' : 'disabled'}><span class="px">★${need}</span></button>`; }).join('');
  const L = repLv(), B2 = S.building, run = B2.run, bt = S.bounty, tier = tierOf(S.arena.score);
  const floors = (() => { const m = Math.max(B2.best, run ? run.floor : 0, 1); const arr = []; for (let f = 1; f <= Math.min(m, 30); f++) arr.push(`<i class="${run && f === run.floor ? 'now' : ''}" style="height:${30 + f / Math.max(m, 1) * 70}%"></i>`); return arr.join(''); })();
  const card = (key, c, art, f, title, lock, body) => `<div class="box brk op ${L < lock ? 'locked' : ''}" style="--c:${c}" data-a="op" data-v="${key}" role="button" tabindex="0">
    <div class="opart"><img src="${imgSrc(art, f)}" alt=""></div><div class="eyebrow" style="color:${c}">${key.toUpperCase()}</div><div class="ot">${title}</div>${L < lock ? lockLine(lock) : body}</div>`;
  const clues = [0, 1, 2].map(i => `<i style="width:14px;height:14px;transform:rotate(45deg);display:inline-block;border:1px solid var(--red);${i < bt.clues ? 'background:var(--red)' : ''}"></i>`).join(' ');
  return `<div class="screen">${head('SORTIE', '출격', `메인 작전 ${Math.min(n, total)}/${total} · 깰수록 순찰 보상이 늘어요.`)}
    <div class="box brk campaign" style="--c:${d.c}">
      <div class="chhead"><button class="arrow" data-a="cv" data-v="-1" ${CV <= 0 ? 'disabled' : ''} aria-label="이전 챕터">‹</button>
        <div style="flex:1;min-width:0"><div class="eyebrow" style="color:${d.c}">CHAPTER ${CV + 1} · ${d.n}</div><div class="h1">${ch.n}</div><p class="sub story">${ch.s}</p></div>
        <button class="arrow" data-a="cv" data-v="1" ${CV >= CHAPTERS.length - 1 || CV >= Math.floor(n / STAGES_PER) ? 'disabled' : ''} aria-label="다음 챕터">›</button></div>
      <div class="nodes">${nodes}</div>
      <div class="spread"><div class="row"><span class="px" style="color:var(--gold)">★ ${stars}/24</span><div class="schests">${chests}</div></div>
        ${n < total ? `<button class="btn" data-a="campFight" data-v="${n}">${stageName(n)} 도전</button>` : '<span class="px" style="color:var(--lime)">ALL CLEAR</span>'}</div>
    </div>
    <div class="spread"><div class="eyebrow">SPECIAL OPS · 특수 작전</div>${ONLINE ? '<button class="btn amber sm" data-a="rankings">전체 랭킹</button>' : ''}</div>
    <div class="ops">
    ${card('arena', 'var(--amber)', 'blade', 1, '아레나', 2, `<div class="row"><span class="px" style="font-size:24px;color:var(--amber)">${S.arena.score}</span><span class="tag" style="color:${tier[2]}">${tier[1]}</span></div><div class="sub">오늘 도전 ${S.arena.tries}/5 · ${S.arena.w}승 ${S.arena.l}패</div>`)}
    ${card('building', 'var(--pink)', 'reaper', 1, '빌딩 습격', 4, `<div class="floors">${floors}</div><div class="px" style="font-size:12px">BEST ${B2.best}F${run ? ` · <span style="color:var(--pink)">NOW ${run.floor}F</span>` : ''}</div><p class="sub">층마다 갈림길을 골라 올라가요.</p>`)}
    ${card('netdive', 'var(--cyan)', 'glitch', 1, '넷 다이브', 6, `<div class="px" style="font-size:22px;color:var(--cyan)">${fmt(S.dive.best)}</div><div class="sub">최고 점수 · 오늘 보상 ${S.dive.left}/3회</div>`)}
    ${card('bounty', 'var(--red)', bt.boss, 2, '현상금 사냥', 7, `<div class="sub">이번 주: <b style="color:var(--fg)">${MERCS[bt.boss].n}</b>${bt.done ? ' · 제압 완료' : ''}</div><div class="row">${clues}<span class="px" style="font-size:11px">단서 ${bt.clues}/3</span></div>
      <div class="gauge" style="max-width:60%"><i style="width:${bt.hp * 100}%;--gc:var(--red)"></i></div>`)}
  </div></div>`;
};
ACT.cv = v => { CV = clamp(CV + +v, 0, CHAPTERS.length - 1); refresh(); };
ACT.starChest = v => {
  const [c, i] = v.split(':').map(Number); const need = STAR_CHEST[i][0];
  S.camp.chest[c] = S.camp.chest[c] || []; if (S.camp.chest[c].includes(i) || chapterStars(c) < need) return;
  S.camp.chest[c].push(i); showRewards(`챕터 ${c + 1} 별 ${need}개 상자`, STAR_CHEST[i][1]);
};
ACT.campFight = v => {
  const idx = +v; if (idx > S.camp.n || idx >= CHAPTERS.length * STAGES_PER) return;
  if (!S.squad.some(Boolean)) { toast('본부에서 용병을 배치하세요', 'bad'); return; }
  const c = Math.floor(idx / STAGES_PER), s = idx % STAGES_PER, first = idx === S.camp.n, rw = stageReward(idx);
  const ename = s === 7 && CHAPTERS[c].boss ? `${MERCS[CHAPTERS[c].boss].n} (보스)` : DISTRICTS[Math.min(11, c + (c >= 9 ? 2 : 0))].g;
  startBattle({
    title: `메인 작전 ${stageName(idx)}${s === 7 ? ' · BOSS' : ''} · ${CHAPTERS[c].n}`,
    note: first ? `첫 클리어 보상 ${fmt(rw.credits)}C · 전투 데이터 ${fmt(rw.exp)}${rw.chips ? ` · 데이터칩 ${rw.chips}` : ''} · ★3 조건: 승리, 아무도 쓰러지지 않기, 45초 안에` : `다시 깨면 작은 보상 · ★3 조건: 승리, 아무도 쓰러지지 않기, 45초 안에`,
    enemyName: ename, allies: squadAllies(), enemies: stageEnemies(idx), time: 75, stars: true, noExp: first,
    retry: () => ACT.campFight(idx),
    next: idx + 1 < CHAPTERS.length * STAGES_PER ? () => ACT.campFight(idx + 1) : null,
    onEnd: res => {
      track('camp');
      if (!res.win) return;
      S.camp.stars[idx] = Math.max(S.camp.stars[idx] || 0, res.stars);
      if (first) {
        S.camp.n = idx + 1; grant(rw);
        if (s === 7) { news(`용병단이 ${CHAPTERS[c].n} 챕터를 돌파했어요.`); toast(`챕터 ${c + 1} 클리어! 순찰 보상이 늘었어요`, 'gold'); CV = Math.min(CHAPTERS.length - 1, c + 1); }
      } else grant({ exp: Math.round(rw.exp * .25), credits: Math.round(rw.credits * .15) });
    },
  });
};
