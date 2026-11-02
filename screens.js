'use strict';
const SCREENS = {};
const ACT = {};
const head = (en, ko, sub) => `<div><div class="eyebrow">${en}</div><div class="h1">${ko}</div>${sub ? `<p class="sub">${sub}</p>` : ''}</div>`;
const TIERS = [[1100, 'BRONZE', '#C98B5A'], [1250, 'SILVER', '#C8D0E0'], [1400, 'GOLD', '#FFD54A'], [1600, 'PLATINUM', '#2DE2E6'], [1850, 'DIAMOND', '#5B8BFF'], [1e9, 'NEON', '#FF3D9A']];
const tierOf = sc => TIERS.find(t => sc < t[0]);
const gangPick = () => DISTRICTS[rint(0, Math.min(11, repLv() + 1))].g;
const owns = id => !!S.roster[id];

/* ================= 본부 ================= */
const STAGE_POS = [[56, 72], [68, 97], [16, 56], [27, 77], [38, 98]];
SCREENS.hq = () => {
  const pw = squadPower(), sq = S.squad;
  const els = {}; sq.filter(Boolean).forEach(id => { const e = MERCS[id].el; els[e] = (els[e] || 0) + 1; });
  const roles = sq.filter(Boolean).map(id => MERCS[id].role);
  const warn = []; if (!roles.includes('guardian')) warn.push('가디언 없음'); if (!roles.includes('medic')) warn.push('메딕 없음');
  const order = [2, 3, 4, 0, 1];
  const slots = order.map(i => {
    const [x, y] = STAGE_POS[i], id = sq[i];
    if (!id) return `<div class="slot empty" style="left:${x}%;top:${y}%;z-index:${y}" data-a="pickSlot" data-v="${i}" role="button" tabindex="0" aria-label="빈 자리 ${i + 1}"><div class="holo">+</div><div class="lbl" style="--gc:var(--cyan)">${i < 2 ? '앞줄' : '뒷줄'}</div></div>`;
    const o = S.roster[id], f = frameOf(o.g), [w, h, ax] = SPR[id][f], H = Math.round((innerWidth < 520 ? 118 : 140) * MERCS[id].sz), sw = Math.round(w / 300 * H), sh = Math.round(h / 300 * H);
    return `<div class="slot" style="left:${x}%;top:${y}%;z-index:${y};--gc:${GRADES[o.g].c}" data-a="pickSlot" data-v="${i}" role="button" tabindex="0" aria-label="${MERCS[id].n} 바꾸기">
      <img src="${imgSrc(id, f)}" alt="" style="width:${sw}px;height:${sh}px;transform:translateX(${((.5 - ax) * 100).toFixed(1)}%)" draggable="false"><div class="pad"></div><div class="lbl">${MERCS[id].n}</div></div>`;
  }).join('');
  const L = repLv(), open = S.jobs.filter(j => j.st === 'open').length;
  const q = (k, c, v, d, act, art) => `<button class="box qcard brk" style="--c:${c}" data-a="${act}"><span class="k">${k}</span><span class="v">${v}</span><span class="d">${d}</span><img src="${imgSrc(art, 0)}" alt=""></button>`;
  const quick = [
    q('JOBS', 'var(--pink)', open, '남은 의뢰', 'tab', 'nano').replace('data-a="tab"', 'data-a="tab" data-v="job"'),
    q('TERRITORY', 'var(--cyan)', L >= 3 ? (S.crew ? `${S.tickets}/3` : '—') : 'LV.3', L >= 3 ? (S.crew ? '구역 공격권' : '크루를 만들면 열려요') : '평판 LV.3에 열려요', 'tab', 'glitch').replace('data-a="tab"', 'data-a="tab" data-v="city"'),
    q('ARENA', 'var(--amber)', L >= 2 ? `${S.arena.tries}/5` : 'LV.2', L >= 2 ? '아레나 남은 횟수' : '평판 LV.2에 열려요', 'tab', 'blade').replace('data-a="tab"', 'data-a="tab" data-v="ops"'),
    q('RECRUIT', 'var(--violet)', Math.floor(S.credits / 1000), '일반 영입 가능 횟수', 'tab', 'eclipse').replace('data-a="tab"', 'data-a="tab" data-v="hire"'),
  ].join('');
  const unlockRows = REP_UNLOCK.slice(1).map((t, i) => `<tr class="${i + 1 <= L ? 'got' : 'no'} ${i + 1 === L ? 'cur' : ''}"><td class="px">LV.${i + 1}</td><td>${t}</td></tr>`).join('');
  const tier = tierOf(S.arena.score);
  return `<div class="screen">${head('HEADQUARTERS', '본부', `DAY ${S.day} · 용병 5명이 전투 대형으로 서 있어요. 누르면 바꿀 수 있어요.`)}
    <div class="stage">${slots}<div class="info"><span class="pwl">SQUAD POWER</span><span class="pw">${fmt(pw)}</span>
      <div class="row wrap" style="justify-content:flex-end;gap:4px">${Object.entries(els).map(([e, n]) => `<span class="tag e-${e}">${ELEMS[e].n} ${n}</span>`).join('')}</div>
      ${warn.length ? `<span class="warn">⚠ ${warn.join('·')}</span>` : ''}</div></div>
    <div class="grid2">${quick}</div>
    <div class="box brk" style="--c:var(--amber)"><div class="spread"><div><div class="eyebrow" style="color:var(--amber)">DAY ${S.day}</div><div class="h2">${ONLINE ? '오늘의 작전' : '하루 마치기'}</div>
      <p class="sub">${ONLINE ? '매일 0시(한국 시간)에 의뢰판·공격권·아레나·넷 다이브 보상이 새로 채워져요. 매주 월요일에 지난주 구역 순위 보상.' : '의뢰판·공격권·아레나·넷 다이브 보상이 새로 채워지고, 경쟁 크루가 움직여요. 7일마다 주간 순위 보상.'}</p></div>
      ${ONLINE ? '<span class="px dim" style="font-size:11px">AUTO 00:00</span>' : '<button class="btn amber" data-a="endDay">다음 날로</button>'}</div></div>
    <div class="box"><div class="eyebrow">REPUTATION</div><div class="h2" style="margin-bottom:8px">평판 해금표</div>
      <div style="overflow-x:auto"><table class="tbl"><tbody>${unlockRows}</tbody></table></div></div>
    <div class="box"><div class="eyebrow">RECORDS</div><div class="h2" style="margin-bottom:10px">기록</div>
      <div class="stats">
        <div class="stat"><b>${S.rec.w}승 ${S.rec.l}패</b><span>전적</span></div>
        <div class="stat"><b>${S.building.best}F</b><span>빌딩 습격 최고 층수</span></div>
        <div class="stat"><b>${fmt(S.dive.best)}</b><span>넷 다이브 최고점</span></div>
        <div class="stat"><b style="color:${tier[2]}">${S.arena.score} ${tier[1]}</b><span>아레나 점수</span></div>
        <div class="stat" style="grid-column:1/-1"><b style="font-size:13px">${MATS.alloy} ${S.mats.alloy} · ${MATS.biogel} ${S.mats.biogel} · ${MATS.neural} ${S.mats.neural}</b><span>임플란트 재료</span></div>
        <div class="stat" style="grid-column:1/-1"><b style="font-family:var(--f-title);font-size:14px">${S.titles.length ? S.titles.map(t => `「${t}」`).join(' ') : '아직 없음'}</b><span>칭호</span></div>
      </div>
      <div class="row wrap" style="margin-top:12px"><button class="btn cyan sm" data-a="saveCode">저장 코드 복사·불러오기</button>${ONLINE ? `<span class="sub" style="align-self:center">단장 ${esc(NET.name)} · 클라우드 저장 중</span><button class="btn gray sm" data-a="logout">로그아웃</button>` : ''}</div></div></div>`;
};
ACT.endDay = () => endDay();
ACT.pickSlot = v => {
  const slot = +v, cur = S.squad[slot];
  const ids = MERC_IDS.filter(owns);
  openModal({
    label: 'SQUAD', title: `${slot < 2 ? '앞줄' : '뒷줄'} ${slot < 2 ? slot + 1 : slot - 1}번 자리`, wide: true, c: 'var(--cyan)',
    html: `<p class="sub">앞줄은 가디언·어설트, 뒷줄은 스나이퍼·해커·메딕·엔지니어가 잘 맞아요. 다른 자리에 있는 용병을 고르면 자리를 바꿔요.</p>
      <div class="cards" style="margin-top:10px">${ids.map(id => mercCard(id, { act: 'setSlot', sel: id === cur, flag: S.squad.includes(id) && id !== cur ? '배치 중' : '' })).join('')}</div>
      ${cur ? '<div style="margin-top:12px"><button class="btn gray sm" data-a="setSlot" data-v="">자리 비우기</button></div>' : ''}`,
  });
  ACT._slot = slot;
};
ACT.setSlot = id => {
  const slot = ACT._slot; id = id || null;
  if (!id && S.squad.filter(Boolean).length <= 1) { toast('분대에 용병이 1명은 있어야 해요', 'bad'); return; }
  const other = id ? S.squad.indexOf(id) : -1;
  if (other >= 0 && other !== slot) S.squad[other] = S.squad[slot];
  S.squad[slot] = id;
  closeModal(); refresh();
};
ACT.saveCode = () => {
  openModal({
    label: 'SAVE', title: '저장 코드', c: 'var(--cyan)',
    html: `<p class="sub">게임은 이 브라우저에 자동 저장돼요. 다른 기기로 옮기려면 코드를 복사해 두세요.</p>
      <textarea class="code" id="sc-out" readonly>${toCode()}</textarea>
      <div class="row" style="margin:8px 0 16px"><button class="btn cyan sm" data-a="copyCode">코드 복사</button></div>
      <div class="h2">불러오기</div><textarea class="code" id="sc-in" placeholder="SCM1.로 시작하는 코드를 붙여 넣으세요"></textarea>
      <div class="row wrap" style="margin-top:8px"><button class="btn sm" data-a="loadCode">불러오기</button><button class="btn gray sm" id="sc-reset" data-a="resetGame">처음부터 다시</button></div>`,
  });
};
ACT.copyCode = () => {
  const t = $('#sc-out'); const done = () => toast('저장 코드 복사 완료', 'good');
  try { navigator.clipboard.writeText(t.value).then(done, () => { t.select(); toast('코드를 선택했어요. 길게 눌러 복사하세요'); }); } catch (e) { t.select(); toast('코드를 선택했어요. 길게 눌러 복사하세요'); }
};
ACT.loadCode = () => { try { S = fromCode($('#sc-in').value); closeModal(); refresh(false); toast('저장 코드를 불러왔어요', 'good'); } catch (e) { toast('코드가 올바르지 않아요. SCM1.로 시작하는 전체 코드를 넣어 주세요', 'bad'); } };
ACT.resetGame = (v, el) => { if (!el.dataset.arm) { el.dataset.arm = 1; el.textContent = '정말 지울까요? 한 번 더'; el.classList.replace('gray', 'red'); return; } S = freshState(); closeModal(); TAB = 'hq'; refresh(false); toast('새 용병단을 시작했어요'); };

/* ================= 용병 ================= */
SCREENS.merc = () => {
  const n = MERC_IDS.filter(owns).length;
  const sections = ROLE_ORDER.map(r => {
    const ids = MERC_IDS.filter(id => MERCS[id].role === r);
    return `<div class="rolehead">${IC[r]}<b>${ROLES[r].n}</b><span>${ROLES[r].d} · ${ROLES[r].row === 'front' ? '앞줄' : '뒷줄'}</span></div>
      <div class="cards">${ids.map(id => mercCard(id, { act: 'mercDetail' })).join('')}</div>`;
  }).join('');
  return `<div class="screen">${head('ROSTER', `보유 ${n}/14`, '카드를 누르면 상세 정보, 승급, 임플란트를 볼 수 있어요.')}${sections}</div>`;
};
ACT.mercDetail = id => {
  const m = MERCS[id], o = S.roster[id], g = o ? o.g : 1;
  const stg = [['BASIC', 0, 1], ['ACE', 1, 6], ['LEGEND', 2, 7]].map(([l, f, need]) =>
    `<div class="${o && frameOf(g) === f ? 'cur' : ''}"><span>${l}</span><img class="${o && g >= need ? '' : 'lock'}" src="${imgSrc(id, f)}" alt=""></div>`).join('');
  const st = o ? ownStats(id) : mercStats(id, 1);
  const bar = (n, v, max, c) => `<div class="sbar"><span>${n}</span><div class="gauge"><i style="width:${Math.min(100, v / max * 100)}%;--gc:${c}"></i></div><span class="px">${fmt(v)}</span></div>`;
  const pr = canPromote(id);
  let promo = '';
  if (o) {
    const nextG = Math.min(7, g + 1);
    promo = g >= 7 ? `<button class="btn block off" disabled>최고 등급 · 이후 정수는 2,000C로 바뀌어요</button>`
      : pr.ok ? `<button class="btn block" data-a="promote" data-v="${id}">승급: ${GRADES[g].n} → ${GRADES[nextG].n} (정수 1)</button>`
        : pr.lock ? `<span class="lockline">${IC.lock}${pr.why}</span>` : `<button class="btn block off" disabled>승급하려면 정수 1개 필요 (보유 ${o.ess})</button>`;
  }
  const imps = o ? Object.entries(IMPLANTS).map(([k, im]) => {
    const lv = o.imp[k], locked = repLv() < im.rep, cost = 300 * (lv + 1), mc = (lv + 1) * 2;
    return `<div class="imp"><b>${im.n}<small>${im.stat} +${im.per}${im.unit}/LV</small></b>
      <div><div class="gauge thin"><i style="width:${lv * 10}%;--gc:var(--violet)"></i></div><small class="px dim" style="font-size:10px">LV.${lv}/10 · ${im.stat} +${lv * im.per}${im.unit}</small></div>
      ${locked ? `<span class="lockline" style="padding:4px 8px">${IC.lock}LV.${im.rep}</span>` : lv >= 10 ? '<span class="px dim">MAX</span>'
        : `<button class="btn sm amber" data-a="implant" data-v="${id}:${k}">${fmt(cost)}C·${MATS[im.mat]} ${mc}</button>`}</div>`;
  }).join('') : '';
  openModal({
    label: `${ROLES[m.role].n} · ${ELEMS[m.el].n}`, title: m.n, c: GRADES[g].c,
    html: `<div class="detail-art">${stg}</div>
      <p style="margin:0">${esc(m.look)}</p>
      <div class="row wrap"><span class="tag e-${m.el}">${ELEMS[m.el].n}</span><span class="tag" style="color:var(--dim)">${ROLES[m.role].n} · ${ROLES[m.role].d}</span>
        ${o ? `<span class="tag" style="color:${GRADES[g].c}">${GRADES[g].n} ${GRADES[g].en}</span><span class="tag" style="color:var(--amber)">정수 ${o.ess}</span>` : `<span class="tag" style="color:var(--dim)">${m.legend ? 'LEGENDARY · 영입에서 3~6%' : 'NOT HIRED · 영입에서 만날 수 있어요'}</span>`}</div>
      <div class="box brk ultbox"><div class="eyebrow" style="color:var(--pink)">ULTIMATE</div><div class="un">${m.ult}</div><div class="sub">${m.ud}</div></div>
      <div style="display:flex;flex-direction:column;gap:6px">${bar('체력', st.hp, 6000, 'var(--lime)')}${bar('공격', st.atk, 900, 'var(--pink)')}${bar('방어', st.def, 500, 'var(--cyan)')}${bar('속도', st.spd, 220, 'var(--amber)')}${bar('치명', st.crit, 60, 'var(--violet)')}</div>
      ${promo}
      ${o ? `<div><div class="eyebrow" style="color:var(--violet)">IMPLANTS</div><div class="sub">장비 대신 몸에 다는 사이버 부품. 구역 특산품 재료로 강화해요.</div>${imps}</div>` : ''}`,
  });
};
ACT.promote = id => {
  const pr = canPromote(id); if (!pr.ok) { toast(pr.why, 'bad'); return; }
  const o = S.roster[id]; o.ess--; o.g++;
  toast(`승급! ${MERCS[id].n} → ${GRADES[o.g].n}`, 'gold');
  if (o.g >= 6) legendFlash();
  refresh(); ACT.mercDetail(id);
};
ACT.implant = v => {
  const [id, k] = v.split(':'), o = S.roster[id], im = IMPLANTS[k], lv = o.imp[k], cost = 300 * (lv + 1), mc = (lv + 1) * 2;
  if (S.credits < cost) { toast(`크레딧이 ${fmt(cost - S.credits)}C 모자라요. 의뢰로 벌어 오세요`, 'bad'); return; }
  if (S.mats[im.mat] < mc) { toast(`${MATS[im.mat]}이(가) 모자라요. 구역 특산품·의뢰·빌딩 습격에서 얻어요`, 'bad'); return; }
  S.credits -= cost; S.mats[im.mat] -= mc; o.imp[k]++;
  toast(`${MERCS[id].n} ${im.n} 임플란트 LV.${o.imp[k]}`, 'good'); refresh(); ACT.mercDetail(id);
};
function legendFlash() { if (REDUCED) return; const f = document.createElement('div'); f.className = 'flash'; document.body.appendChild(f); setTimeout(() => f.remove(), 1250); }

/* ================= 영입 ================= */
SCREENS.hire = () => {
  const L = repLv();
  const ban = (type) => {
    const p = type === 'p', c = p ? 'var(--cyan)' : 'var(--amber)', left = (p ? 50 : 80) - S.pity[type];
    const cost1 = p ? 100 : 1000, cost10 = p ? 900 : 9000, cur = p ? 'chip' : 'credit';
    const locked = p && L < 5;
    return `<div class="box brk banner" style="--c:${c}">
      <div class="arts"><img src="${imgSrc('chrono', p ? 2 : 0)}" alt=""><img src="${imgSrc('eclipse', p ? 2 : 0)}" alt=""></div>
      <div class="txtw"><div class="eyebrow" style="color:${c}">${p ? 'PREMIUM' : 'STANDARD'} RECRUIT</div>
      <div class="ttl">${p ? '고급 영입' : '일반 영입'}</div>
      <div class="sub">${p ? '데이터칩으로 하는 영입. 데이터칩은 게임 안에서만 모아요.' : '크레딧으로 하는 영입. 일반 용병 12명 중 1명이 나와요.'}</div>
      <div class="row wrap" style="gap:6px"><span class="tag" style="color:${c}">전설 ${p ? 6 : 3}%</span><span class="tag" style="color:${c}">${p ? 50 : 80}회 천장</span></div>
      <div><div class="sub" style="font-size:12px">전설 확정까지 <b class="px" style="color:${c}">${left}</b>회</div><div class="gauge" style="margin-top:4px"><i style="width:${S.pity[type] / (p ? 50 : 80) * 100}%;--gc:${c}"></i></div></div></div>
      <div class="btns">${locked ? lockLine(5) : `
        <button class="btn ${p ? 'cyan' : 'amber'}" data-a="pull" data-v="${type}1">1회 · ${resIcon(cur).replace('<svg', '<svg class="ic"')} ${fmt(cost1)}</button>
        <button class="btn" data-a="pull" data-v="${type}10">10회 · ${resIcon(cur).replace('<svg', '<svg class="ic"')} ${fmt(cost10)}</button>`}</div></div>`;
  };
  return `<div class="screen">${head('RECRUIT', '영입', '같은 용병이 겹치면 정수가 나오고, 정수 1개로 등급이 한 번 올라가요. 레전드 이후 정수는 2,000C로 바뀌어요.')}
    <div class="banners">${ban('n')}${ban('p')}</div>
    <div class="box"><div class="eyebrow">RATES</div><table class="tbl"><thead><tr><th></th><th>일반 영입</th><th>고급 영입</th></tr></thead><tbody>
      <tr><td>비용</td><td>1회 1,000C / 10회 9,000C</td><td>1회 데이터칩 100 / 10회 900</td></tr>
      <tr><td>일반 용병 12명 중 1명</td><td>97%</td><td>94%</td></tr><tr><td>전설 (크로노·이클립스)</td><td>3%</td><td>6%</td></tr>
      <tr><td>천장</td><td>80회 안에 전설 확정</td><td>50회 안에 전설 확정</td></tr></tbody></table></div></div>`;
};
ACT.pull = v => {
  const type = v[0], n = +v.slice(1), p = type === 'p';
  const cost = p ? (n === 10 ? 900 : 100) : (n === 10 ? 9000 : 1000);
  if (p && repLv() < 5) { toast('고급 영입은 평판 LV.5에 열려요', 'bad'); return; }
  if (p ? S.chips < cost : S.credits < cost) { toast(p ? `데이터칩이 ${cost - S.chips}개 모자라요` : `크레딧이 ${fmt(cost - S.credits)}C 모자라요. 의뢰로 벌어 오세요`, 'bad'); return; }
  if (p) S.chips -= cost; else S.credits -= cost;
  const res = []; for (let i = 0; i < n; i++) { const id = rollOne(type); res.push({ id, r: acquire(id) }); }
  save(); renderTop(); renderTabs();
  const html = `<div class="pull-grid">${res.map((x, i) => `<div class="pc" data-i="${i}" data-leg="${MERCS[x.id].legend ? 1 : ''}"><div class="flipper">${mercCard(x.id, { force: 1 })}</div>
    <div class="res-l" style="color:${x.r.kind === 'new' ? 'var(--cyan)' : x.r.kind === 'cr' ? 'var(--amber)' : 'var(--fg)'}">${x.r.txt}</div></div>`).join('')}</div>
    <div class="row wrap" style="justify-content:center;margin-top:6px"><button class="btn ${p ? 'cyan' : 'amber'}" data-a="pull" data-v="${v}">한 번 더</button><button class="btn gray" data-a="closeModal">확인</button></div>`;
  openModal({
    label: 'RESULT', title: `${p ? '고급' : '일반'} 영입 ${n}회`, wide: true, c: p ? 'var(--cyan)' : 'var(--amber)', html,
    onMount: (b) => {
      $$('.pc', b).forEach((pc, i) => setTimeout(() => { pc.classList.add('show'); if (pc.dataset.leg) legendFlash(); }, REDUCED ? 0 : 150 + i * 90 + (pc.dataset.leg ? 200 : 0)));
    }, onClose: () => refresh(),
  });
  if (TAB === 'hire') { const sc = $('#view').scrollTop; $('#view').innerHTML = SCREENS.hire(); $('#view').scrollTop = sc; }
};

/* ================= 의뢰 ================= */
SCREENS.job = () => {
  const brokers = Object.entries(BROKERS).map(([k, b]) => `<div class="box broker" style="padding:10px">${hexEmblem(b.c, b.k, 30)}<div style="min-width:0"><b>${b.n}</b><small>${b.d}</small></div></div>`).join('');
  const bonus = S.dist[7].owner === 'me';
  const jobs = S.jobs.map(j => {
    const b = BROKERS[j.b], t = JOB_T[j.k];
    const rw = [`<span class="res cr">${resIcon('credit')}${fmt(j.r.credits * (bonus ? 1.2 : 1))}</span>`, `<span style="color:var(--amber)">평판 +${j.r.rep}</span>`];
    if (j.r.mats) for (const k in j.r.mats) rw.push(`<span class="dim">${MATS[k]} +${j.r.mats[k]}</span>`);
    if (j.r.chips) rw.push(`<span class="res dc">${resIcon('chip')}${j.r.chips}</span>`);
    if (j.r.clue) rw.push(`<span style="color:var(--red)">현상금 단서 +1</span>`);
    let btn;
    if (j.st === 'done') btn = '<span class="px dim">COMPLETE</span>';
    else if (j.st === 'ship') { const left = j.until - Date.now(); btn = left > 0 ? `<span class="px" style="color:var(--cyan)">${Math.ceil(left / 60000)}분 남음</span>` : `<button class="btn cyan sm" data-a="claimShip" data-v="${j.id}">보상 받기</button>`; }
    else btn = `<button class="btn sm" data-a="startJob" data-v="${j.id}">${t.n} 시작</button>`;
    const art = j.st === 'ship' ? j.merc : ({ escort: 'ironwall', ship: 'halo', hack: 'glitch', sneak: 'specter', raid: 'reaper', clue: 'hawkeye' })[j.k];
    return `<div class="box brk job ${j.st === 'done' ? 'done' : ''}" style="--c:${b.c}"><img class="ghost" src="${imgSrc(art, 0)}" alt="">
      <span class="bk" style="color:${b.c}">${b.n.toUpperCase()} · ${t.n}</span><div class="jt">${esc(j.title)}</div>
      <div class="jd">${t.d}${j.k === 'ship' ? ` ${ROLES[j.need].n}를 보내면 보상 +30%. ${j.mins}분 걸려요.` : ` 적 레벨 ${j.lv}.`}</div>
      <div class="rw">${rw.join('')}</div>
      <div class="foot"><span class="tag diff-${j.d}">${DIFFS[j.d].n}</span>${btn}</div></div>`;
  }).join('');
  return `<div class="screen">${head('◆ JOB BOARD'.replace('◆ ', ''), '의뢰', `브로커 3명이 매일 의뢰 6개를 올려요. 깨면 크레딧과 거리 평판을 받아요.${bonus ? ' 고속도로 교차로 효과로 보상 +20%.' : ''}`)}
    <div class="brokers">${brokers}</div><div class="jobs">${jobs}</div></div>`;
};
function jobReward(j, mul = 1) {
  const r = { ...j.r, credits: Math.round(j.r.credits * mul * (S.dist[7].owner === 'me' ? 1.2 : 1)), crew: 5 };
  if (j.r.clue) { S.bounty.clues = Math.min(3, S.bounty.clues + 1); toast(`현상금 단서 ${S.bounty.clues}/3`, 'gold'); }
  grant(r);
}
ACT.startJob = id => {
  const j = S.jobs.find(x => x.id === id); if (!j || j.st !== 'open') return;
  if (!S.squad.some(Boolean)) { toast('본부에서 용병을 1명 이상 배치하세요', 'bad'); return; }
  if (j.k === 'ship') {
    const ids = MERC_IDS.filter(owns);
    openModal({ label: 'TRANSPORT', title: '운송에 보낼 용병', wide: true, c: 'var(--pink)', html: `<p class="sub">${ROLES[j.need].n}를 보내면 보상이 30% 늘어요. 운송 중에도 전투에는 나갈 수 있어요.</p><div class="cards" style="margin-top:10px">${ids.map(i => mercCard(i, { act: 'sendShip', flag: MERCS[i].role === j.need ? '+30%' : '' })).join('')}</div>` });
    ACT._job = id; return;
  }
  if (j.k === 'hack') {
    startDive({
      title: `해킹 · ${j.title}`, time: 45, onEnd: res => {
        if (res.frags >= 5) { j.st = 'done'; toast('의뢰 완료!', 'good'); jobReward(j, 1 + (res.vault ? .3 : 0)); }
        else toast(`의뢰 실패. 조각 ${res.frags}/5. 방어 프로그램을 피해 조각부터 모으세요`, 'bad');
        refresh();
      }
    });
    return;
  }
  const gang = gangPick();
  startBattle({
    title: `${JOB_T[j.k].n} · ${j.title}`, enemyName: gang, allies: squadAllies(), enemies: makeGangTeam(j.lv), time: j.k === 'sneak' ? 45 : 75,
    onEnd: res => {
      if (res.win) { j.st = 'done'; jobReward(j); addCrewXp(5); }
      else if (res.kind !== 'retreat') toast(res.kind === 'timeout' ? '의뢰 실패. 시간이 모자랐어요. 딜러를 늘리거나 궁극기를 빨리 쓰세요' : '의뢰 실패. 배치를 바꾸고 다시 도전하세요', 'bad');
    }
  });
};
ACT.sendShip = mid => {
  const j = S.jobs.find(x => x.id === ACT._job); if (!j) return;
  j.st = 'ship'; j.merc = mid; j.until = Date.now() + j.mins * 60000; j.bonus = MERCS[mid].role === j.need ? 1.3 : 1;
  closeModal(); toast(`${MERCS[mid].n} 출발. ${j.mins}분 뒤에 보상 받기`, ''); refresh();
};
ACT.claimShip = id => { const j = S.jobs.find(x => x.id === id); if (!j || Date.now() < j.until) return; j.st = 'done'; jobReward(j, j.bonus || 1); refresh(); };

/* ================= 도시 ================= */
function bldSvg(i) {
  let seed = i * 9301 + 49297; const r = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  let x = 0, s = '';
  while (x < 200) { const w = 10 + r() * 22, h = 18 + r() * 44; s += `<rect x="${x.toFixed(1)}" y="${(62 - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"/>`; if (r() < .3) s += `<rect x="${(x + w / 2 - 1).toFixed(1)}" y="${(62 - h - 8).toFixed(1)}" width="2" height="8"/>`; x += w + r() * 3; }
  return `<svg class="bld" viewBox="0 0 200 62" preserveAspectRatio="none" fill="currentColor">${s}</svg>`;
}
SCREENS.city = () => {
  const L = repLv();
  if (L < 3) return `<div class="screen">${head('CITY', '도시', '구역 12곳을 두고 크루끼리 빼앗고 빼앗겨요.')}<div class="box brk" style="--c:var(--violet)"><div class="h2">아직 도시 밑바닥이에요</div><p class="sub">의뢰로 평판을 쌓아 LV.3이 되면 크루를 만들고 구역 쟁탈전에 들어갈 수 있어요.</p><div style="margin-top:10px">${lockLine(3)}</div></div>${cityLower()}</div>`;
  let crew;
  if (!S.crew) {
    crew = `<div class="box brk" style="--c:var(--pink)"><div class="eyebrow">CREATE CREW</div><div class="h2">크루 만들기</div>
      <p class="sub">이름과 네온 색 엠블럼을 정해요. 혼자서도 개인 크루로 활동할 수 있어요. 비용 3,000C.</p>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:10px"><input class="txt" id="crew-name" maxlength="12" placeholder="크루 이름 (최대 12자)" value="">
      <div class="colors">${CREW_COLORS.map((c, i) => `<button style="background:${c}" data-a="crewColor" data-v="${c}" class="${i === 0 ? 'on' : ''}" aria-label="색 ${i + 1}"></button>`).join('')}</div>
      <button class="btn" data-a="makeCrew">크루 만들기 · 3,000C</button></div></div>`;
  } else {
    const n = ownedDistricts().length;
    crew = `<div class="box brk" style="--c:${S.crew.color}"><div class="crewbox">${hexEmblem(S.crew.color, S.crew.name[0], 54)}
      <div class="meta"><div class="px" style="font-size:11px;color:${S.crew.color}">CREW LV.${crewLv()}</div><div class="h2">${esc(S.crew.name)}</div>
      <div class="sub">크루원 1/10 · 버프 크레딧 +${crewBuff()}% · 차지 구역 ${n}</div><div class="gauge thin" style="margin-top:6px;max-width:200px"><i style="width:${crewLv() >= 10 ? 100 : (S.crewXp % 120) / 1.2}%;--gc:${S.crew.color}"></i></div></div>
      <div class="big"><div><b style="color:var(--pink)">${S.tickets}</b><span>공격권</span></div><div><b style="color:var(--cyan)">${S.defenses}</b><span>방어전</span></div></div></div>
      <div style="margin-top:12px"><button class="btn cyan block ${S.spClaimed || !n ? 'off' : ''}" data-a="claimSp" ${S.spClaimed || !n ? 'disabled' : ''}>${S.spClaimed ? '오늘 특산품 받음' : n ? `오늘 특산품 받기 (${n}구역)` : '구역을 차지하면 매일 특산품이 들어와요'}</button></div></div>`;
  }
  const tiles = DISTRICTS.map((d, i) => {
    const st = S.dist[i], lock = L < d.rep, own = st.owner, oc = ownerColor(own, i);
    return `<button class="tile ${own === 'me' ? 'ours' : ''} ${lock ? 'locked' : ''}" style="--oc:${oc}" data-a="district" data-v="${i}">${bldSvg(i)}
      ${own === 'me' ? '<span class="ourst">OURS</span>' : ''}<span class="dn">${d.n}</span><span class="ow">${own === 'npc' ? d.g + ' (갱단)' : esc(ownerName(own))}</span>
      ${lock ? `<span class="lk">${IC.lock.replace('<svg', '<svg width="12" height="12"')}LV.${d.rep}</span>` : `<div class="gauge thin" style="margin-top:2px"><i style="width:${st.ctrl.me}%;--gc:${S.crew ? S.crew.color : 'var(--lime)'}"></i></div>`}
      <span class="sp">${d.sp}</span></button>`;
  }).join('');
  return `<div class="screen">${head('CITY', '도시', '구역은 처음엔 모두 NPC 갱단 것. 이기면 우리 장악도가 오르고 주인의 장악도는 깎여요. 100에 닿으면 우리 구역.')}
    ${crew}<div class="dmap">${tiles}</div>${cityLower()}</div>`;
};
function cityLower() {
  const rank = weeklyRanking();
  const nextSun = 7 - ((S.day - 1) % 7);
  return `<div class="grid2" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">
    <div class="box"><div class="eyebrow">WEEKLY · ${nextSun}일 남음</div><div class="h2" style="margin-bottom:8px">주간 순위</div>
      <div class="rank">${rank.map((r, i) => `<div><span class="px">${i + 1}</span><i style="background:${r.c}"></i><span>${esc(r.n)}</span><span class="px">${r.k}</span></div>`).join('')}</div>
      <p class="sub" style="margin-top:8px;font-size:12px">1등 크루는 칭호 「도시의 지배자」.</p></div>
    <div class="box"><div class="eyebrow">CITY NEWS</div><div class="h2" style="margin-bottom:8px">도시 소식</div>
      <div class="news">${S.news.map(n => `<div><span class="px">${typeof n.d === 'number' ? 'D' + n.d : n.d}</span><span>${esc(n.t)}</span></div>`).join('')}</div></div></div>`;
}
ACT.crewColor = (c, el) => { $$('.colors button').forEach(b => b.classList.toggle('on', b === el)); ACT._cc = c; };
ACT.makeCrew = () => {
  const name = ($('#crew-name').value || '').trim();
  if (!name) { toast('크루 이름을 적어 주세요', 'bad'); return; }
  if (S.credits < 3000) { toast(`크레딧이 ${fmt(3000 - S.credits)}C 모자라요`, 'bad'); return; }
  S.credits -= 3000; S.crew = { name, color: ACT._cc || CREW_COLORS[0] }; S.crewXp = 0;
  news(`새 크루 「${name}」 등장.`); toast(`크루 「${name}」 결성!`, 'good'); refresh();
};
ACT.claimSp = () => {
  if (S.spClaimed) return; const own = ownedDistricts(); if (!own.length) return;
  const r = { credits: 0, chips: 0, mats: { alloy: 0, biogel: 0, neural: 0 }, rep: 0 }; const extra = [];
  for (const i of own) {
    const d = DISTRICTS[i];
    switch (d.k) {
      case 'credit': r.credits += 600 + d.lv * 60; break;
      case 'credit2': r.credits += 1500 + d.lv * 100; break;
      case 'alloy': r.mats.alloy += 3; break; case 'biogel': r.mats.biogel += 3; break; case 'neural': r.mats.neural += 3; break;
      case 'essence': if (Math.random() < .4) { const id = pick(COMMON_IDS); const a = acquire(id); extra.push(`${MERCS[id].n} ${a.txt}`); } else r.credits += 500; break;
      case 'box': { const b = pick(['c', 'm', 'd']); if (b === 'c') r.credits += 1200; else if (b === 'm') { r.mats.alloy += 2; r.mats.biogel += 2; r.mats.neural += 2; } else r.chips += 25; break; }
      case 'jobbonus': r.credits += 300; break;
      case 'casino': if (Math.random() < .12) { r.credits += 8000; extra.push('카지노 대박!'); } else r.credits += 800; break;
      case 'chips': r.chips += 30; break;
      case 'credrep': r.credits += 1200; r.rep += 15; break;
      case 'legend': if (Math.random() < .15) { const id = pick(LEGEND_IDS); const a = acquire(id); extra.push(`${MERCS[id].n} ${a.txt}`); } else r.credits += 2000; break;
    }
  }
  S.spClaimed = true; grant(r); extra.forEach(t => toast(t, 'gold')); refresh();
};
ACT.district = v => {
  const i = +v, d = DISTRICTS[i], st = S.dist[i];
  if (repLv() < d.rep) { toast(`${d.n}은(는) 평판 LV.${d.rep}에 열려요`, 'bad'); return; }
  const parties = [['npc', d.g + ' (갱단)', d.c], ['me', S.crew ? S.crew.name : '우리', S.crew ? S.crew.color : '#7DFF6A'], ...RIVALS.map(r => [r.id, r.n, r.c])]
    .filter(([k]) => k === 'me' || st.ctrl[k] > 0 || st.owner === k);
  const bars = parties.map(([k, n, c]) => `<div class="sbar" style="grid-template-columns:110px 1fr 40px"><span style="color:${c};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(n)}${st.owner === k ? ' ★' : ''}</span><div class="gauge"><i style="width:${st.ctrl[k]}%;--gc:${c}"></i></div><span class="px">${st.ctrl[k]}</span></div>`).join('');
  const ours = st.owner === 'me', enemyLv = st.owner === 'npc' || st.owner === 'me' ? d.lv : Math.max(d.lv, rivalLv(RIVALS.find(r => r.id === st.owner)));
  let btn;
  if (!S.crew) btn = `<span class="lockline">크루를 먼저 만들어야 해요</span>`;
  else if (ours) btn = st.ctrl.me >= 100 ? `<button class="btn cyan block off" disabled>완전 장악 중</button>` : `<button class="btn cyan block ${S.defenses ? '' : 'off'}" data-a="fightDistrict" data-v="${i}">방어전 · 장악도 +30 (남은 ${S.defenses})</button>`;
  else btn = `<button class="btn block ${S.tickets ? '' : 'off'}" data-a="fightDistrict" data-v="${i}">공격 · 공격권 1장 (남은 ${S.tickets})</button>`;
  openModal({
    label: 'DISTRICT', title: d.n, c: ours ? 'var(--lime)' : d.c,
    html: `<div class="row wrap"><span class="tag" style="color:${d.c}">처음 주인 ${d.g}</span><span class="tag" style="color:var(--amber)">특산품 ${d.sp}</span><span class="tag" style="color:var(--dim)">적 레벨 ${Math.round(enemyLv)}</span></div>
      <div style="display:flex;flex-direction:column;gap:8px">${bars}</div>
      <p class="sub">이기면 우리 장악도 +35, 주인 장악도 −35. 100에 닿으면 우리 구역. 우리 구역은 현재 분대가 방어 팀으로 자동으로 막아요.</p>${btn}`,
  });
};
ACT.fightDistrict = v => {
  const i = +v, d = DISTRICTS[i], st = S.dist[i], ours = st.owner === 'me';
  if (ours ? S.defenses <= 0 : S.tickets <= 0) { toast(ours ? '오늘 방어전을 다 썼어요' : '오늘 공격권을 다 썼어요. 하루를 마치면 3장이 채워져요', 'bad'); return; }
  if (!S.squad.some(Boolean)) { toast('본부에서 용병을 배치하세요', 'bad'); return; }
  closeModal();
  const rival = RIVALS.find(r => r.id === (ours ? pick(RIVALS).id : st.owner));
  const lv = st.owner === 'npc' ? d.lv : Math.max(d.lv, rival ? rivalLv(rival) : d.lv);
  const ename = st.owner === 'npc' ? d.g : (rival ? rival.n : d.g);
  if (ours) S.defenses--; else S.tickets--;
  startBattle({
    title: `${ours ? '구역 방어' : '구역 공격'} · ${d.n}`, enemyName: ename, allies: squadAllies(), enemies: makeGangTeam(lv), time: 75,
    onEnd: res => {
      if (!res.win) { if (res.kind !== 'retreat') toast(`${d.n} ${ours ? '방어' : '공격'} 실패. 배치를 바꾸고 다시 도전하세요`, 'bad'); return; }
      addCrewXp(10); grant({ credits: 300 + d.lv * 30, rep: 8 }, true);
      if (ours) { st.ctrl.me = Math.min(100, st.ctrl.me + 30); toast(`${d.n} 장악도 ${st.ctrl.me}`, 'good'); return; }
      const took = applyCtrl(i, 'me', 35);
      if (took) { toast(`${d.n} 차지!`, 'gold'); news(`${S.crew.name}이(가) ${d.n}을(를) 차지했어요!`); }
      else toast(`${d.n} 장악도 ${st.ctrl.me}/100`, 'good');
    }
  });
};

/* ================= 작전 ================= */
SCREENS.ops = () => {
  const L = repLv(), B2 = S.building, run = B2.run, bt = S.bounty, tier = tierOf(S.arena.score);
  const floors = (() => { const n = Math.max(B2.best, run ? run.floor : 0, 1); const arr = []; for (let f = 1; f <= Math.min(n, 30); f++) arr.push(`<i class="${run && f === run.floor ? 'now' : ''}" style="height:${30 + f / Math.max(n, 1) * 70}%"></i>`); return arr.join(''); })();
  const card = (key, c, art, f, title, lock, body) => `<div class="box brk op ${L < lock ? 'locked' : ''}" style="--c:${c}" data-a="op" data-v="${key}" role="button" tabindex="0">
    <div class="opart"><img src="${imgSrc(art, f)}" alt=""></div><div class="eyebrow" style="color:${c}">${key.toUpperCase()}</div><div class="ot">${title}</div>${L < lock ? lockLine(lock) : body}</div>`;
  const clues = [0, 1, 2].map(i => `<i style="width:16px;height:16px;transform:rotate(45deg);display:inline-block;border:1px solid var(--red);${i < bt.clues ? 'background:var(--red)' : ''}"></i>`).join(' ');
  return `<div class="screen">${head('OPERATIONS', '작전', '빌딩 습격·현상금 사냥·넷 다이브·아레나. 혼자서도 실력으로 랭킹을 올려요.')}${ONLINE ? '<div><button class="btn amber sm" data-a="rankings">◆ 전체 랭킹 보기</button></div>' : ''}<div class="ops">
    ${card('building', 'var(--pink)', 'reaper', 1, '빌딩 습격', 4, `<div class="floors">${floors}</div><div class="px" style="font-size:12px">BEST ${B2.best}F${run ? ` · <span style="color:var(--pink)">NOW ${run.floor}F</span>` : ''}</div><p class="sub">층마다 갈림길을 골라 올라가요. 지면 처음부터.</p>`)}
    ${card('bounty', 'var(--red)', bt.boss, 2, '현상금 사냥', 7, `<div class="sub">이번 주: <b style="color:var(--fg)">${MERCS[bt.boss].n}</b>${bt.done ? ' · 제압 완료' : ''}</div><div class="row">${clues}<span class="px" style="font-size:11px">단서 ${bt.clues}/3</span></div>
      <div class="gauge" style="max-width:60%"><i style="width:${bt.hp * 100}%;--gc:var(--red)"></i></div><div class="px" style="font-size:11px">오늘 추격 ${bt.tracks}/3</div>`)}
    ${card('netdive', 'var(--cyan)', 'glitch', 1, '넷 다이브', 6, `<div class="px" style="font-size:22px;color:var(--cyan)">${fmt(S.dive.best)}</div><div class="sub">최고 점수 · 오늘 보상 ${S.dive.left}/3회</div><p class="sub">데이터 미로를 달리며 방어 프로그램을 피하고 금고를 털어요.</p>`)}
    ${card('arena', 'var(--amber)', 'blade', 1, '아레나', 2, `<div class="row"><span class="px" style="font-size:24px;color:var(--amber)">${S.arena.score}</span><span class="tag" style="color:${tier[2]}">${tier[1]}</span></div><div class="sub">오늘 도전 ${S.arena.tries}/5 · ${S.arena.w}승 ${S.arena.l}패</div>`)}
  </div></div>`;
};
ACT.op = k => {
  const need = { building: 4, bounty: 7, netdive: 6, arena: 2 }[k];
  if (repLv() < need) { toast(`평판 LV.${need}에 열려요. 의뢰로 평판을 쌓으세요`, 'bad'); return; }
  if (!S.squad.some(Boolean) && k !== 'netdive') { toast('본부에서 용병을 배치하세요', 'bad'); return; }
  ({ building: openBuilding, bounty: openBounty, netdive: openNetDive, arena: openArena })[k]();
};

/* --- 아레나 --- */
const HANDLES = ['NEON_WOLF', '카타나걸', '0xDEAD', '크롬심장', 'GLITCHKID', '야간택시', 'RAIN.EXE', '블루스크린', 'VOLTAGE', '고양이해커', 'MIDNIGHT', '서울2189'];
function openArena() {
  const a = S.arena, base = 1 + Math.max(0, (a.score - 1000) / 40);
  if (!a.opps || a.oppsDay !== S.day) { a.opps = [-1.5, 0, 2].map(dl => { const lv = Math.max(1, Math.round((base + dl + rnd(-.5, .5)) * 10) / 10); return { n: pick(HANDLES), lv, team: makeArenaTeam(lv) }; }); a.oppsDay = S.day; }
  const tier = tierOf(a.score);
  openModal({
    label: 'ARENA', title: '아레나', c: 'var(--amber)', wide: true,
    html: `<div class="row wrap"><span class="px" style="font-size:28px;color:var(--amber)">${a.score}</span><span class="tag" style="color:${tier[2]}">${tier[1]}</span><span class="sub">오늘 남은 도전 ${a.tries}/5 · 최고 ${a.best}</span></div>
      <p class="sub">다른 플레이어 팀과 비동기 대전. 이기면 점수와 크레딧·데이터칩, 지면 점수가 조금 깎여요.</p>
      <div style="display:flex;flex-direction:column;gap:8px">${a.opps.map((o, i) => {
        const pw = o.pw || Math.round(o.team.reduce((s, t) => s + unitPower(mercStats(t.id, 1, null, lvMul(t.lv))), 0));
        return `<div class="box" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:150px"><b>${esc(o.n)}</b>${o.real ? ' <span class="tag" style="color:var(--cyan)">PLAYER</span>' : ' <span class="tag" style="color:var(--dim)">AI</span>'}<div class="px dim" style="font-size:11px">POWER ${fmt(pw)} · 내 분대 ${fmt(squadPower())}</div>
          <div class="row" style="gap:2px;margin-top:4px">${o.team.map(t => `<div class="face" style="width:34px;height:34px"><img src="${imgSrc(t.id, t.frame)}" alt=""></div>`).join('')}</div></div>
          <button class="btn amber sm ${a.tries ? '' : 'off'}" data-a="arenaFight" data-v="${i}">도전</button></div>`;
      }).join('')}</div>`,
  });
}
ACT.arenaFight = v => {
  const a = S.arena; if (a.tries <= 0) { toast('오늘 도전을 다 썼어요. 하루를 마치면 채워져요', 'bad'); return; }
  const o = a.opps[+v]; closeModal(); a.tries--;
  startBattle({
    title: `아레나 · ${o.n}`, enemyName: o.n, allies: squadAllies(), enemies: o.team, time: 75,
    onEnd: res => {
      const myLv = 1 + Math.max(0, (a.score - 1000) / 40);
      if (res.win) { const d = clamp(Math.round(22 + (o.lv - myLv) * 5), 10, 42); a.score += d; a.w++; a.best = Math.max(a.best, a.score); toast(`아레나 승리 +${d}점`, 'good'); grant({ credits: 500 + o.lv * 60, chips: 10, rep: 6, crew: 8 }); }
      else if (res.kind !== 'retreat') { a.score = Math.max(800, a.score - 15); a.l++; toast('아레나 패배 −15점. 상대 속성을 보고 배치를 바꿔 보세요', 'bad'); }
      a.opps = null;
    }
  });
};

/* --- 현상금 사냥 --- */
function openBounty() {
  const bt = S.bounty, m = MERCS[bt.boss], lv = bt.lv || 8 + bt.week * 3;
  const can = bt.clues >= 3 && bt.tracks > 0 && !bt.done;
  openModal({
    label: 'BOUNTY', title: `현상수배범 · ${m.n}`, c: 'var(--red)',
    html: `<div style="display:flex;gap:12px;align-items:flex-end"><img src="${imgSrc(bt.boss, 2)}" alt="" style="height:170px;transform:scaleX(-1);filter:drop-shadow(0 0 10px rgba(255,75,92,.7)) sepia(.3) hue-rotate(-20deg)">
      <div style="flex:1;display:flex;flex-direction:column;gap:6px"><span class="tag" style="color:var(--red);align-self:flex-start">레벨 ${lv} · ${ELEMS[m.el].n}</span>
      <div class="sub">궁극기 「${m.ult}」 — ${m.ud}</div>
      <div class="px" style="font-size:11px">보스 남은 체력 ${Math.round(bt.hp * 100)}%</div><div class="gauge"><i style="width:${bt.hp * 100}%;--gc:var(--red)"></i></div>
      <div class="px" style="font-size:11px">단서 ${bt.clues}/3 · 오늘 추격 ${bt.tracks}/3</div></div></div>
      <p class="sub">블러드하운드의 「현상금 단서」 의뢰로 단서 3개를 모으면 숨은 곳을 찾아요. 보스 체력은 다음 추격까지 그대로 남아요. 잡으면 용병으로 합류하기도 해요.</p>
      ${bt.done ? '<button class="btn block off" disabled>이번 주 제압 완료 · 다음 주를 기다리세요</button>' : `<button class="btn red block ${can ? '' : 'off'}" data-a="bountyFight">${bt.clues < 3 ? '단서가 모자라요' : bt.tracks ? '추격 시작' : '오늘 추격을 다 썼어요'}</button>`}`,
  });
}
ACT.bountyFight = () => {
  const bt = S.bounty; if (bt.clues < 3 || bt.tracks <= 0 || bt.done) return;
  closeModal(); bt.tracks--;
  const lv = bt.lv || 8 + bt.week * 3;
  startBattle({
    title: `현상금 사냥 · ${MERCS[bt.boss].n}`, enemyName: `현상수배범 ${MERCS[bt.boss].n}`, allies: squadAllies(),
    enemies: [{ id: bt.boss, slot: 0, boss: true, lv, frame: 2, hp: bt.hp }], time: 75,
    onEnd: res => {
      bt.hp = res.win ? 0 : Math.max(.01, res.enemyHp);
      if (res.win) {
        bt.done = true; const a = acquire(bt.boss);
        toast(`현상수배범 ${MERCS[bt.boss].n} 제압! ${a.kind === 'new' ? '용병으로 합류했어요' : a.txt}`, 'gold');
        grant({ credits: 5000 + Math.min(bt.week, 5) * 1000, chips: 150, rep: 60, crew: 20 }); news(`현상수배범 ${MERCS[bt.boss].n}이(가) 잡혔어요.`);
      } else if (res.kind !== 'retreat') toast(`보스 체력 ${Math.round(bt.hp * 100)}% 남음. 내일 다시 추격하세요`, '');
    }
  });
};

/* --- 넷 다이브 (작전) --- */
function openNetDive() {
  startDive({
    title: '넷 다이브', time: 60, onEnd: res => {
      S.dive.best = Math.max(S.dive.best, res.score);
      if (S.dive.left > 0 && res.score > 0) { S.dive.left--; grant({ credits: res.score, chips: Math.floor(res.score / 40), rep: 5 }); }
      else if (res.score > 0) toast(`점수 ${fmt(res.score)}. 오늘 보상은 다 받았어요`, '');
    }
  });
}

/* --- 빌딩 습격 --- */
const TEMP_IMPS = [
  { k: 'atk', n: '과충전 팔', d: '공격 +20%', v: .2 }, { k: 'spd', n: '반사 신경 가속기', d: '속도 +18%', v: .18 },
  { k: 'def', n: '탄소 피부막', d: '방어 +25%', v: .25 }, { k: 'crit', n: '표적 렌즈', d: '치명타 +12%p', v: 12 },
  { k: 'regen', n: '나노 혈액', d: '층마다 체력 12% 회복', v: .12 }, { k: 'gauge', n: '아드레날린 칩', d: '전투 시작 궁극기 게이지 30', v: 1 },
];
const PATHS = {
  battle: { n: '전투', c: 'var(--pink)', d: '갱단 조직원과 싸워요' }, elite: { n: '정예', c: 'var(--red)', d: '강한 적. 이기면 임시 임플란트' },
  hack: { n: '해킹', c: 'var(--cyan)', d: '보안을 뚫으면 전리품 (실패하면 피해)' }, shop: { n: '암시장', c: 'var(--amber)', d: '전리품 크레딧으로 임플란트 구매' },
  event: { n: '이벤트', c: 'var(--violet)', d: '무슨 일이 생길지 몰라요' }, rest: { n: '휴식', c: 'var(--lime)', d: '팀 체력 40% 회복, 쓰러진 용병 부활' },
  boss: { n: '보스층', c: 'var(--red)', d: '층 경비 대장. 이기면 큰 전리품' },
};
function genPaths(floor) {
  if (floor % 5 === 0) return ['boss'];
  const w = [['battle', 34], ['elite', 14], ['hack', 14], ['shop', 12], ['event', 14], ['rest', 12]];
  const out = []; while (out.length < 3) { let r = Math.random() * 100, k = 'battle'; for (const [kk, ww] of w) { if ((r -= ww) < 0) { k = kk; break; } } if (!out.includes(k) || out.length === 2) out.push(k); }
  return out;
}
function openBuilding() {
  const run = S.building.run;
  if (!run) {
    openModal({
      label: 'BUILDING RAID', title: '빌딩 습격', c: 'var(--pink)', wide: true,
      html: `<p class="sub">기업 빌딩을 층마다 갈림길(전투·해킹·암시장·이벤트·휴식)을 골라 올라가요. 그 판에서만 쓰는 임시 임플란트를 주워요. 체력은 층을 넘어가도 이어져요. 지면 처음부터지만 전리품 절반은 챙겨요. 언제든 철수하면 전부 챙겨요.</p>
        <div class="team5">${S.squad.map(id => id ? `<div class="face"><img src="${imgSrc(id, frameOf(S.roster[id].g))}" alt=""></div>` : '<div class="face"></div>').join('')}</div>
        <div class="px dim" style="font-size:11px">현재 분대로 출발 · 최고 기록 ${S.building.best}F</div>
        <button class="btn block" data-a="raidStart">습격 시작</button>`,
    });
    return;
  }
  const L = run.loot;
  const team = run.squad.map((id, s) => {
    if (!id) return '<div><div class="face"></div></div>';
    const hp = run.hp[s] ?? 0;
    return `<div><div class="face ${hp <= 0 ? 'dead' : ''}"><img src="${imgSrc(id, frameOf(S.roster[id].g))}" alt=""></div><div class="gauge thin" style="margin-top:3px"><i style="width:${hp * 100}%;--gc:var(--lime)"></i></div></div>`;
  }).join('');
  const paths = run.paths.map((k, i) => `<button class="path" style="--c:${PATHS[k].c}" data-a="raidPath" data-v="${i}"><b>${PATHS[k].n}</b><small>${PATHS[k].d}</small></button>`).join('');
  openModal({
    label: 'BUILDING RAID', title: '빌딩 습격', c: 'var(--pink)', wide: true,
    html: `<div class="spread"><div class="px" style="font-size:44px;color:var(--pink);line-height:1">${run.floor}F</div><div class="px dim" style="font-size:11px;text-align:right">BEST ${S.building.best}F</div></div>
      <div class="team5">${team}</div>
      <div class="box" style="padding:10px"><div class="eyebrow" style="color:var(--violet)">TEMP IMPLANTS · LOOT</div>
        <div class="row wrap" style="gap:6px;margin:6px 0">${run.imps.length ? run.imps.map(n => `<span class="tag" style="color:var(--violet)">${n}</span>`).join('') : '<span class="sub">아직 없음</span>'}</div>
        <div class="row wrap" style="gap:10px">${resChip('credit', L.credits)}${resChip('chip', L.chips)}<span class="res mat">${MATS.alloy} ${L.alloy}</span><span class="res mat">${MATS.biogel} ${L.biogel}</span><span class="res mat">${MATS.neural} ${L.neural}</span></div></div>
      <div class="paths" style="grid-template-columns:repeat(${run.paths.length},minmax(0,1fr))">${paths}</div>
      <div class="news">${run.log.slice(0, 3).map(t => `<div><span class="px">›</span><span>${esc(t)}</span></div>`).join('')}</div>
      <button class="btn gray block" data-a="raidLeave">철수하고 전리품 챙기기</button>`,
  });
}
ACT.raidStart = () => {
  const sq = S.squad.slice(); const hp = {}; sq.forEach((id, s) => { if (id) hp[s] = 1; });
  S.building.run = { floor: 1, squad: sq, hp, buffs: { atk: 0, def: 0, spd: 0, crit: 0, gauge: 0, regen: 0 }, imps: [], loot: { credits: 0, chips: 0, alloy: 0, biogel: 0, neural: 0 }, log: ['빌딩 1층 로비에 진입했어요.'], paths: genPaths(1) };
  save(); openBuilding();
};
function raidAllies(run) { return run.squad.map((id, slot) => id && (run.hp[slot] ?? 0) > 0 ? { id, slot, g: S.roster[id].g, imp: S.roster[id].imp, hp: run.hp[slot] } : null).filter(Boolean); }
function raidNext(run, msg) {
  run.log.unshift(msg); run.floor++; S.building.best = Math.max(S.building.best, run.floor - 1);
  if (run.buffs.regen) for (const s in run.hp) if (run.hp[s] > 0) run.hp[s] = Math.min(1, run.hp[s] + run.buffs.regen);
  run.paths = genPaths(run.floor); save();
}
function addImp(run, t) { t = t || pick(TEMP_IMPS); run.buffs[t.k] += t.v; run.imps.push(t.n); return t; }
function raidEnd(kept, why) {
  const run = S.building.run; if (!run) return;
  const L = run.loot, k = kept;
  grant({ credits: Math.round(L.credits * k), chips: Math.round(L.chips * k), mats: { alloy: Math.round(L.alloy * k), biogel: Math.round(L.biogel * k), neural: Math.round(L.neural * k) }, rep: Math.round(run.floor * 4 * k), crew: run.floor });
  toast(why, kept < 1 ? 'bad' : 'good');
  S.building.run = null; save();
}
ACT.raidLeave = () => { const f = S.building.run.floor; closeModal(); raidEnd(1, `${f}F에서 철수. 전리품을 모두 챙겼어요`); refresh(); };
ACT.raidPath = v => {
  const run = S.building.run, k = run.paths[+v], f = run.floor;
  const lv = 1 + f * .75;
  if (k === 'battle' || k === 'elite' || k === 'boss') {
    closeModal();
    const elv = k === 'battle' ? lv : k === 'elite' ? lv + 2.5 : lv + 4;
    startBattle({
      title: `빌딩 습격 ${f}F · ${PATHS[k].n}`, enemyName: k === 'boss' ? '기업 경비대장' : pick(['기업 경비대', '청소 부대', '보안 안드로이드']), allies: raidAllies(run), enemies: makeGangTeam(elv), buffs: run.buffs, time: 75,
      onEnd: res => {
        Object.assign(run.hp, res.allyHp);
        if (res.kind === 'retreat') { raidEnd(1, `${f}F에서 철수. 전리품을 모두 챙겼어요`); return; }
        if (!res.win) { raidEnd(.5, `${f}F에서 쓰러졌어요. 전리품 절반을 챙겼어요`); return; }
        const L = run.loot; L.credits += Math.round(150 + f * 90 * (k === 'battle' ? 1 : k === 'elite' ? 1.6 : 2.5));
        if (Math.random() < .5 || k !== 'battle') L[pick(['alloy', 'biogel', 'neural'])] += k === 'boss' ? 4 : 1;
        let msg = `${f}F ${PATHS[k].n} 승리.`;
        if (k === 'elite') { const t = addImp(run); msg += ` 임시 임플란트 「${t.n}」 획득.`; }
        if (k === 'boss') { L.chips += 20 + f; const t = addImp(run); msg += ` 데이터칩과 「${t.n}」 획득.`; }
        raidNext(run, msg); setTimeout(openBuilding, 50);
      }
    });
    return;
  }
  if (k === 'hack') {
    if (Math.random() < .7) { run.loot.credits += 200 + f * 60; run.loot.chips += 5; raidNext(run, `${f}F 보안 해제 성공. 크레딧과 데이터칩을 빼냈어요.`); }
    else { for (const s in run.hp) if (run.hp[s] > 0) run.hp[s] = Math.max(.05, run.hp[s] - .15); raidNext(run, `${f}F 해킹 실패! 방어 프로그램 반격으로 팀 체력 −15%.`); }
    openBuilding(); return;
  }
  if (k === 'rest') { for (const s in run.hp) run.hp[s] = run.hp[s] > 0 ? Math.min(1, run.hp[s] + .4) : .25; raidNext(run, `${f}F 비상계단에서 휴식. 체력을 회복했어요.`); openBuilding(); return; }
  if (k === 'shop') {
    const offers = shuffle(TEMP_IMPS.slice()).slice(0, 3).map(t => ({ ...t, price: 250 + f * 40 }));
    ACT._offers = offers;
    openModal({
      label: 'BLACK MARKET', title: `${f}F 암시장`, c: 'var(--amber)',
      html: `<p class="sub">전리품 크레딧 ${fmt(run.loot.credits)}C로 이번 판에서만 쓰는 임플란트를 사요.</p>
        <div style="display:flex;flex-direction:column;gap:8px">${offers.map((o, i) => `<div class="box spread" style="padding:10px"><div><b>${o.n}</b><div class="sub">${o.d}</div></div><button class="btn amber sm ${run.loot.credits >= o.price ? '' : 'off'}" data-a="raidBuy" data-v="${i}">${fmt(o.price)}C</button></div>`).join('')}</div>
        <button class="btn gray block" data-a="raidSkip">그냥 지나가기</button>`,
    });
    return;
  }
  if (k === 'event') {
    const evs = [
      { t: '부상당한 정보원이 쓰러져 있어요.', a: ['치료해 준다 (체력 −10%, 데이터칩 +15)', 'ev_heal'], b: ['지갑만 챙긴다 (+400C)', 'ev_rob'] },
      { t: '잠긴 무기 상자를 발견했어요.', a: ['억지로 연다 (50%: 임플란트 / 50%: 체력 −20%)', 'ev_box'], b: ['그냥 둔다', 'ev_none'] },
      { t: '수상한 자판기가 「행운의 칩」을 팔아요.', a: ['300C를 넣는다 (40%: +1,200C)', 'ev_vend'], b: ['지나간다', 'ev_none'] },
      { t: '엘리베이터 해킹으로 층을 건너뛸 수 있어요.', a: ['한 층 더 올라간다 (보상 없이 +1F)', 'ev_skip'], b: ['계단으로 간다', 'ev_none'] },
    ];
    const e = pick(evs);
    openModal({ label: 'EVENT', title: `${f}F 이벤트`, c: 'var(--violet)', html: `<p style="margin:0">${e.t}</p><button class="btn block" data-a="raidEv" data-v="${e.a[1]}">${e.a[0]}</button><button class="btn gray block" data-a="raidEv" data-v="${e.b[1]}">${e.b[0]}</button>` });
  }
};
ACT.raidBuy = v => { const run = S.building.run, o = ACT._offers[+v]; if (run.loot.credits < o.price) { toast('전리품 크레딧이 모자라요', 'bad'); return; } run.loot.credits -= o.price; addImp(run, o); raidNext(run, `${run.floor}F 암시장에서 「${o.n}」 구입.`); openBuilding(); };
ACT.raidSkip = () => { const run = S.building.run; raidNext(run, `${run.floor}F 암시장을 지나쳤어요.`); openBuilding(); };
ACT.raidEv = v => {
  const run = S.building.run, f = run.floor, L = run.loot; let msg;
  const dmg = p => { for (const s in run.hp) if (run.hp[s] > 0) run.hp[s] = Math.max(.05, run.hp[s] - p); };
  switch (v) {
    case 'ev_heal': dmg(.1); L.chips += 15; msg = '정보원을 치료했어요. 고맙다며 데이터칩을 줬어요.'; break;
    case 'ev_rob': L.credits += 400; msg = '지갑에서 400C를 챙겼어요.'; break;
    case 'ev_box': if (Math.random() < .5) { const t = addImp(run); msg = `상자 안에 「${t.n}」!`; } else { dmg(.2); msg = '상자가 폭발했어요. 팀 체력 −20%.'; } break;
    case 'ev_vend': if (L.credits < 300) { msg = '크레딧이 모자라 그냥 지나갔어요.'; break; } L.credits -= 300; if (Math.random() < .4) { L.credits += 1200; msg = '행운의 칩 당첨! +1,200C'; } else msg = '꽝. 300C를 잃었어요.'; break;
    case 'ev_skip': run.floor++; msg = '엘리베이터로 한 층을 건너뛰었어요.'; break;
    default: msg = '조용히 지나갔어요.';
  }
  raidNext(run, `${f}F ${msg}`); openBuilding();
};

/* ================= 공용 동작 ================= */
ACT.tab = v => { TAB = v; refresh(false); };
ACT.closeModal = () => closeModal();
