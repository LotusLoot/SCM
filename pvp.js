'use strict';
/* =====================================================================
   실시간 1:1 대결 (Firebase Realtime Database)
   방장이 전투를 계산하고 1초에 12번 상황을 보내요. 상대는 그 화면을 좌우로 뒤집어
   보여 주고, 자기 조작(이동·공격·회피·스킬·궁극기·교체)만 방장에게 보내요.
   pvp/{4자리 코드}
     host  {uid, name, team, pw}   방장
     guest {uid, name, team, pw}   들어온 친구
     st    'wait' | 'play' | 'end'
     s     방장이 보내는 전투 상황
     i     친구가 보내는 조작
   ===================================================================== */
const PVP_DAILY = 5;          // 하루 보상 받는 판 수
const PVP_TIME = 100;         // 한 판 시간 (초)
const PVP = { code: null, role: null, ref: null, offs: [], foe: null };
const num = v => typeof v === 'number' && isFinite(v) ? v : 0;
const r1 = v => Math.round(num(v) * 10) / 10, r2 = v => Math.round(num(v) * 100) / 100;

function pvpAvailable() { return !!(ONLINE && NET.uid && window.firebase && firebase.database && window.FIREBASE_CONFIG && FIREBASE_CONFIG.databaseURL); }
function rtdb() { return NET.rt || (NET.rt = firebase.database()); }
const roomRef = c => rtdb().ref('pvp/' + c);
function pvpRec() { const p = S.pvp || (S.pvp = { w: 0, l: 0, d: 0, day: '', n: 0 }); if (p.day !== dayKey()) { p.day = dayKey(); p.n = 0; } return p; }
const pvpTeam = () => defenseTeam().map(m => ({ id: m.id, slot: m.slot, g: m.g, imp: m.imp || null, mlv: m.mlv }));
function pvpOff() { PVP.offs.forEach(f => { try { f(); } catch (e) { } }); PVP.offs = []; }
function pvpOn(ref, cb) { const h = s => cb(s.val()); ref.on('value', h); PVP.offs.push(() => ref.off('value', h)); }
function pvpLeave() { // 대기실에서 나가기
  pvpOff();
  const ref = PVP.ref; if (ref) {
    if (PVP.role === 'host') { ref.onDisconnect().cancel(); ref.remove().catch(() => { }); }
    else { ref.child('guest').onDisconnect().cancel(); ref.child('guest').remove().catch(() => { }); }
  }
  PVP.ref = PVP.code = PVP.role = PVP.foe = null;
}

/* ---------- 대기실 ---------- */
function openPvp() {
  const p = pvpRec();
  if (!pvpAvailable()) {
    openModal({ label: 'LIVE DUEL', title: '실시간 대결', c: 'var(--cyan)', html: `<p class="sub">${ONLINE ? '실시간 대결 서버가 아직 꺼져 있어요. 게임을 만든 사람이 Firebase에서 Realtime Database를 켜고 firebase-config.js에 databaseURL을 넣어야 해요.' : '온라인으로 로그인해야 할 수 있어요.'}</p>` });
    return;
  }
  openModal({
    label: 'LIVE DUEL', title: '실시간 대결', c: 'var(--cyan)',
    html: `<div class="pvp" id="pvp-box">${pvpMenuHtml(p)}</div>`,
    onMount: b => pvpBind(b),
    onClose: () => { if (!B) pvpLeave(); },
  });
}
function pvpMenuHtml(p) {
  return `<p class="sub">친구와 같은 시간에 접속해서 1:1로 싸워요. 둘 다 <b>본부 분대 3명</b>으로 싸우고, 각자 1명을 직접 조종해요. 나머지 2명은 알아서 싸워요.</p>
    <div class="pvrec"><span class="px" style="color:var(--lime)">${p.w}승</span><span class="px" style="color:var(--red)">${p.l}패</span><span class="px" style="color:var(--amber)">${p.d}무</span><span class="sub">오늘 보상 ${Math.max(0, PVP_DAILY - p.n)}/${PVP_DAILY}판</span></div>
    <div class="pvteam">${pvpTeam().map(m => `<img src="${imgSrc(m.id, frameOf(m.g))}" alt="">`).join('')}<span class="px">전투력 ${fmt(squadPower())}</span></div>
    <button class="btn" id="pv-host" style="width:100%">방 만들기</button>
    <div class="pvjoin"><input id="pv-code" inputmode="numeric" maxlength="4" placeholder="방 코드 4자리" autocomplete="off"><button class="btn gray" id="pv-join">입장</button></div>
    <p class="sub" style="font-size:11px">· ${PVP_TIME}초 안에 상대 3명을 모두 쓰러뜨리면 승리, 시간이 끝나면 남은 체력이 많은 쪽이 이겨요.<br>· 싸우는 동안 화면을 끄거나 다른 앱으로 가면 연결이 끊겨 져요.<br>· 보상: 승리 1,500C + 칩 20 · 무승부 800C · 패배 500C (하루 ${PVP_DAILY}판)</p>`;
}
function pvpBind(b) {
  const h = $('#pv-host', b); if (h) h.onclick = () => pvpHost();
  const j = $('#pv-join', b); if (j) j.onclick = () => pvpJoin($('#pv-code', b).value.trim());
  const c = $('#pv-code', b); if (c) c.onkeydown = e => { if (e.key === 'Enter') pvpJoin(c.value.trim()); };
}
const pvpBox = html => { const b = $('#pvp-box'); if (b) b.innerHTML = html; return b; };
const foeCard = f => `<div class="pvfoe"><div class="sub">상대</div><b>${esc(f.name || '용병')}</b><div class="pvteam">${(f.team || []).map(m => `<img src="${imgSrc(m.id, frameOf(m.g))}" alt="">`).join('')}<span class="px">전투력 ${fmt(f.pw || 0)}</span></div></div>`;

async function pvpHost() {
  if (!S.squad.some(Boolean)) { toast('본부에서 용병을 배치하세요', 'bad'); return; }
  pvpBox('<p class="sub">방을 만드는 중…</p>');
  try {
    let code = null;
    for (let i = 0; i < 8 && !code; i++) { const c = String(1000 + Math.floor(Math.random() * 9000)); const v = (await roomRef(c).once('value')).val(); if (!v || Date.now() - num(v.at) > 30 * 60e3) code = c; }
    if (!code) throw new Error('빈 방 코드를 찾지 못했어요');
    const ref = roomRef(code); PVP.ref = ref; PVP.code = code; PVP.role = 'host';
    await ref.set({ host: { uid: NET.uid, name: NET.name || '용병', team: pvpTeam(), pw: squadPower() }, st: 'wait', at: firebase.database.ServerValue.TIMESTAMP });
    ref.onDisconnect().remove();
    const draw = g => {
      PVP.foe = g || null;
      const b = pvpBox(`<div class="pvcode"><small>방 코드</small><b class="px">${code}</b><span class="sub">친구에게 이 숫자를 알려 주세요</span></div>
        ${g ? foeCard(g) + '<button class="btn" id="pv-start" style="width:100%">대결 시작</button>' : '<p class="sub pvwait">친구가 들어오기를 기다리는 중…</p>'}
        <button class="btn gray sm" id="pv-cancel">방 닫기</button>`);
      if (!b) return;
      $('#pv-cancel', b).onclick = () => { pvpLeave(); pvpBox(pvpMenuHtml(pvpRec())); pvpBind($('#pvp-box')); };
      const s = $('#pv-start', b); if (s) s.onclick = async () => { s.disabled = true; await ref.update({ st: 'play', s: null, i: null }); pvpStart(); };
      if (g && !draw.seen) { draw.seen = 1; sfx('reward'); }
      if (!g) draw.seen = 0;
    };
    pvpOn(ref.child('guest'), draw);
  } catch (e) { netErr(e); pvpLeave(); pvpBox(pvpMenuHtml(pvpRec())); pvpBind($('#pvp-box')); }
}
async function pvpJoin(code) {
  if (!/^\d{4}$/.test(code)) { toast('방 코드 4자리를 넣으세요', 'bad'); return; }
  if (!S.squad.some(Boolean)) { toast('본부에서 용병을 배치하세요', 'bad'); return; }
  const ref = roomRef(code);
  try {
    const v = (await ref.once('value')).val();
    if (!v || !v.host) { toast('그런 방이 없어요. 코드를 확인하세요', 'bad'); return; }
    if (v.host.uid === NET.uid) { toast('내가 만든 방이에요', 'bad'); return; }
    if (v.st !== 'wait' || (v.guest && v.guest.uid !== NET.uid)) { toast('이미 대결 중인 방이에요', 'bad'); return; }
    PVP.ref = ref; PVP.code = code; PVP.role = 'guest'; PVP.foe = v.host;
    await ref.child('guest').set({ uid: NET.uid, name: NET.name || '용병', team: pvpTeam(), pw: squadPower() });
    ref.child('guest').onDisconnect().remove();
    const b = pvpBox(`<div class="pvcode"><small>방 코드</small><b class="px">${code}</b></div>${foeCard(v.host)}<p class="sub pvwait">방장이 시작하기를 기다리는 중…</p><button class="btn gray sm" id="pv-cancel">나가기</button>`);
    $('#pv-cancel', b).onclick = () => { pvpLeave(); pvpBox(pvpMenuHtml(pvpRec())); pvpBind($('#pvp-box')); };
    pvpOn(ref.child('st'), st => { if (st === 'play' && !B) pvpStart(); });
    pvpOn(ref.child('host'), h => { if (!h && !B && PVP.role === 'guest') { toast('방장이 방을 닫았어요', 'bad'); pvpLeave(); closeModal(true); } });
  } catch (e) { netErr(e); pvpLeave(); }
}

/* ---------- 전투 시작 ---------- */
function pvpStart() {
  const foe = PVP.foe, ref = PVP.ref, role = PVP.role; if (!foe || !ref) return;
  pvpOff(); closeModal(true);
  const mine = pvpTeam().map(m => ({ ...m, hp: 1 })), theirs = (foe.team || []).map(m => ({ ...m, real: true, pvp: true, frame: frameOf(m.g) }));
  const net = {
    role,
    send: o => ref.child(role === 'host' ? 's' : 'i').set(o).catch(e => console.warn(e)),
    listen: fn => pvpOn(ref.child(role === 'host' ? 'i' : 's'), v => { if (v) fn(v); }),
    close: () => { pvpOff(); if (role === 'host') { ref.update({ st: 'end' }).catch(() => { }); setTimeout(() => { ref.onDisconnect().cancel(); ref.remove().catch(() => { }); }, 4000); } else { ref.child('guest').onDisconnect().cancel(); } PVP.ref = null; },
  };
  sfx('ult');
  runBattle({
    title: `실시간 대결 · ${PVP.code}`, allyName: NET.name || '나', enemyName: foe.name || '상대', allies: mine, enemies: theirs, pvp: net,
    time: PVP_TIME, theme: +PVP.code % 10, noExp: true, noProps: true,
    onEnd: res => {
      const p = pvpRec(), k = res.kind;
      if (k === 'win') p.w++; else if (k === 'draw') p.d++; else p.l++;
      if (p.n < PVP_DAILY) { p.n++; grant(k === 'win' ? { credits: 1500, chips: 20 } : k === 'draw' ? { credits: 800 } : { credits: 500 }); }
      else if (GRANT_LOG) GRANT_LOG.push('오늘 보상은 다 받았어요');
    },
  });
}

/* ---------- 방장: 상황 보내기 · 조작 받기 ---------- */
const ST_BITS = ['stun', 'freeze', 'mark', 'charm', 'wall', 'taunt', 'slow'];
function pvpBegin() {
  B.startAt = performance.now(); B.sn = 0;
  if (B.remote) { B.cnt = { d: 0, k: 0, u: 0, tap: 0, sw: [0, 0], au: [0, 0], ff: 0 }; B.lastSnap = performance.now(); B.inT = 0; }
  else B.rlast = { d: 0, k: 0, u: 0, tap: 0, sw: 0, au: 0, ff: 0 };
  B.pvp.listen(B.remote ? pvpApply : pvpInput);
}
function pvpSnap(end) {
  const U = B.units, L2 = B.leader2;
  const u = U.map(q => {
    let st = 0; ST_BITS.forEach((k, i) => { if (q.st[k] > 0) st |= 1 << i; });
    return [Math.round(num(q.x)), r1(q.y), Math.round(Math.max(0, num(q.hp))), q.face < 0 ? -1 : 1, r2(q.pose), r2(q.flash), q.dead ? 1 : 0, Math.round(num(q.energy)), Math.round(num(q.shield)),
      q.moving ? 1 : 0, r2(q.inv), r2(q.hurt), q.hurtDir < 0 ? -1 : 1, st, r2(q.lunge), q.dash ? (q.dash.vx < 0 ? -1 : 1) : 0, Math.round(num(q.maxHp)), q.frame || 0];
  });
  const o = { n: ++B.sn, t: r1(B.time), u, L: U.indexOf(B.leader), L2: U.indexOf(L2), c: L2 ? [r1(L2.skillCd), r1(L2.skillMax || 7), r2(L2.dodgeCd)] : 0,
    sh: B.shots.map(s => [s.id, Math.round(s.x), r1(s.y), U.indexOf(s.tg), U.indexOf(s.src), s.c || '#fff', num(s.w) || 3]),
    z: B.zones.map(z => [Math.round(z.x), r1(z.y), Math.round(z.r), z.kind]), tr: B.turrets.map(t => [Math.round(t.x), r1(t.y), t.big ? 1 : 0]),
    f: B.netFx.splice(0, 80), e: end || 0 };
  return o;
}
function pvpHostTick(dt) {
  if (!B || B.remote) return;
  if (B.tap2 > 0) B.tap2 -= dt; B.foeL = B.leader2;
  if (B.ended) return;
  B.snT = (B.snT || 0) - dt;
  if (B.snT <= 0) { B.snT = 1 / 12; B.pvp.send(pvpSnap()); }
  if (performance.now() - (B.rinAt || B.startAt) > 12000) { toast('상대와 연결이 끊겼어요', 'bad'); finish('win'); }
}
function pvpInput(i) {
  if (!B || B.remote || B.ended) return;
  B.rinAt = performance.now();
  B.rin = { x: clamp(num(i.x), -1, 1), y: clamp(num(i.y), -1, 1), atk: !!i.a, mouse: i.m ? { x: num(i.m[0]), y: num(i.m[1]) } : null };
  const c = i.c || {}, o = B.rlast, L2 = B.leader2, live = B.intro <= 0;
  if (num(c.ff) > o.ff) { o.ff = c.ff; toast('상대가 기권했어요', 'gold'); finish('win'); return; }
  if (live && L2) {
    if (num(c.d) > o.d) doDodge(L2);
    if (num(c.k) > o.k) useSkill(L2);
    if (num(c.u) > o.u) useUlt(L2);
    if (num(c.tap) > o.tap) B.tap2 = .3;
  }
  if (live && c.sw && num(c.sw[0]) > o.sw) swap2(c.sw[1]);
  if (live && c.au && num(c.au[0]) > o.au) { const u = B.units.find(x => x.side === 'e' && x.slot === c.au[1] && !x.dead); if (u) useUlt(u); }
  o.d = num(c.d); o.k = num(c.k); o.u = num(c.u); o.tap = num(c.tap); o.sw = c.sw ? num(c.sw[0]) : 0; o.au = c.au ? num(c.au[0]) : 0;
}
function pvpEnded(kind) { // finish()에서 불러요
  if (B.remote) return;
  const d = B.units.map(u => [Math.round(u.dmgDone), Math.round(u.dmgTaken), Math.round(u.healDone)]);
  B.pvp.send(pvpSnap({ k: kind, d }));
}
function pvpForfeit() {
  if (!B || B.ended) return;
  if (B.remote) { B.cnt.ff++; pvpSendInput(true); finish('lose'); }
  else finish('lose');
}

/* ---------- 친구 쪽: 받은 상황 그리기 · 조작 보내기 ---------- */
function pvpAct(k, v) {
  if (!B || B.ended || B.intro > 0) return;
  if (k === 'sw' || k === 'au') B.cnt[k] = [B.cnt[k][0] + 1, v]; else B.cnt[k]++;
  if (k === 'd' && B.leader && !B.leader.dead && B.leader.dodgeCd <= 0) { sfx('dash'); B.leader.dodgeCd = .75; } // 바로 소리·쿨타임 표시
  pvpSendInput(true);
}
function guestInput() {
  let ix = B.inp.x, iy = B.inp.y; const k = B.keys;
  if (k.left) ix = -1; if (k.right) ix = 1; if (k.up) iy = -1; if (k.down) iy = 1;
  if (k.left || k.right || k.up || k.down) { const d = Math.hypot(ix, iy) || 1; ix /= d; iy /= d; } else if (!B.stick) { ix = 0; iy = 0; }
  return [ix, iy];
}
function pvpSendInput(now) {
  const [ix, iy] = guestInput();
  const o = { x: r2(-ix), y: r2(iy), a: k3() ? 1 : 0, m: B.mouseAtk && B.mouseW ? [Math.round(1000 - B.mouseW.x), r1(B.mouseW.y)] : 0, c: B.cnt };
  const key = JSON.stringify(o);
  if (!now && key === B.inKey && B.inBeat > 0) return;
  if (!now && B.inT > 0) return;
  B.inKey = key; B.inT = 1 / 20; B.inBeat = .4;
  B.pvp.send({ ...o, ts: Date.now() });
}
const k3 = () => B.keys.atk || B.holdAtk || B.mouseAtk;
function pvpGuestStep(dt) {
  if (!B || !B.remote) return;
  B.inT -= dt; B.inBeat -= dt;
  if (B.intro > 0) { update(dt); if (!B) return; pvpSendInput(); return; }
  if (B.ended) { for (const pt of B.parts) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += 500 * dt; pt.life -= dt; } B.parts = B.parts.filter(p => p.life > 0); return; }
  B.time = Math.max(0, B.time - dt);
  const L = B.leader, [ix, iy] = guestInput();
  for (const u of B.units) {
    if (u.dead) { u.deadT += dt; continue; }
    u.pose = Math.max(0, u.pose - dt); u.flash = Math.max(0, u.flash - dt); u.hurt = Math.max(0, (u.hurt || 0) - dt); u.lunge = Math.max(0, (u.lunge || 0) - dt); u.inv = Math.max(0, u.inv - dt);
    if (u.nx === undefined) continue;
    let k = Math.min(1, dt * 12);
    if (u === L && (ix || iy) && !u.dash && !(u.st.stun || u.st.freeze)) { // 내 용병은 먼저 움직여 보여요
      const sp = u.mv * 1.15 * (u.st.slow ? .5 : 1) * dt; u.x += ix * sp; u.y += iy * sp / DEPTH; if (Math.abs(ix) > .2) u.face = Math.sign(ix); u.moving = true; clampPos(u); k = Math.min(1, dt * 4);
    }
    u.x += (u.nx - u.x) * k; u.y += (u.ny - u.y) * k;
  }
  for (const s of B.shots) { s.x += (s.nx - s.x) * Math.min(1, dt * 14); s.y += (s.ny - s.y) * Math.min(1, dt * 14); }
  for (const pt of B.parts) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += 500 * dt; pt.life -= dt; }
  B.parts = B.parts.filter(p => p.life > 0);
  pvpSendInput();
  if (performance.now() - B.lastSnap > 10000) { toast('방장과 연결이 끊겼어요', 'bad'); finish('win'); }
}
const SFX_OF = { arc: 'swing', muzzle: 'shot', impact: 'hit', burst: 'kill' };
function pvpApply(s) {
  if (!B || !B.remote || B.ended || !s || num(s.n) <= (B.sn || 0)) return;
  B.sn = s.n; B.lastSnap = performance.now();
  const U = B.units; let mh = false;
  (s.u || []).forEach((a, i) => {
    const q = U[i]; if (!q || !a) return;
    q.nx = 1000 - a[0]; q.ny = a[1];
    if (q === B.leader && a[2] < q.hp - 1 && B.intro <= 0) { B.hurtFx = .35; shakeIt(.14); buzz(35); }
    q.hp = a[2]; q.face = -a[3]; q.pose = a[4]; q.flash = Math.max(q.flash, a[5]);
    if (a[6] && !q.dead) { q.dead = true; q.deadT = 0; const d = -(a[12] || 1); q.fly = { vx: d * rnd(360, 520), vy: -rnd(240, 340), rot: d * rnd(4, 7) }; }
    q.energy = a[7]; q.shield = a[8]; if (q !== B.leader || !(B.inp.x || B.inp.y || B.keys.left || B.keys.right || B.keys.up || B.keys.down)) q.moving = !!a[9];
    q.inv = a[10]; q.hurt = a[11]; q.hurtDir = -a[12];
    ST_BITS.forEach((k, b) => { q.st[k] = a[13] & (1 << b) ? 1 : 0; });
    q.lunge = a[14]; q.dash = a[15] ? { vx: -a[15] } : null;
    if (a[16] && a[16] !== q.maxHp) { q.maxHp = a[16]; mh = true; } q.frame = a[17] || 0;
  });
  if (mh) { B.maxA = U.filter(u => u.side === 'a').reduce((t, u) => t + u.maxHp, 0); B.maxE = U.filter(u => u.side === 'e').reduce((t, u) => t + u.maxHp, 0); }
  B.time = num(s.t); B.t = (B.cfg.time || PVP_TIME) - B.time;
  const me = U[s.L2]; if (me && me !== B.leader) { B.leader = me; updateDom(); }
  B.foeL = U[s.L] || null;
  if (s.c && B.leader) { B.leader.skillCd = s.c[0]; B.leader.skillMax = s.c[1]; B.leader.dodgeCd = s.c[2]; }
  const old = {}; B.shots.forEach(x => { old[x.id] = x; });
  B.shots = (s.sh || []).map(a => {
    const o = old[a[0]] || { id: a[0], x: 1000 - a[1], y: a[2], trail: [] };
    o.trail.push([o.x, o.y]); if (o.trail.length > 6) o.trail.shift();
    o.nx = 1000 - a[1]; o.ny = a[2]; o.tg = U[a[3]] || null; o.src = U[a[4]] || null; o.c = a[5]; o.w = a[6]; return o;
  }).filter(o => o.tg);
  B.zones = (s.z || []).map(z => ({ x: 1000 - z[0], y: z[1], r: z[2], kind: z[3], t: 1 }));
  B.turrets = (s.tr || []).map(t => ({ x: 1000 - t[0], y: t[1], big: !!t[2], t: 1 }));
  if (B.intro <= 0) { const played = {}; (s.f || []).forEach(e => pvpFx(e, played)); }
  if (s.e) pvpGuestEnd(s.e);
}
function pvpFx(o, played) {
  if (!o || !o.k) return;
  if (o.k === 'ban') { const u = B.units[o.i]; if (u) { banner(u); sfx('ult'); } return; }
  const e = fxUnpack(o);
  if (e.k === '_p') { parts(e.x, e.y, e.c, e.n, e.sp); return; }
  if (e.k === '_d') { dirParts(e.x, e.y, e.dir, e.c, e.n); return; }
  B.fx.push(e);
  const sn = SFX_OF[e.k]; if (sn && !played[sn]) { played[sn] = 1; sfx(sn); }
}
function pvpGuestEnd(e) {
  (e.d || []).forEach((a, i) => { const u = B.units[i]; if (u && a) { u.dmgDone = a[0]; u.dmgTaken = a[1]; u.healDone = a[2]; } });
  for (const u of B.units) if (u.nx !== undefined) { u.x = u.nx; u.y = u.ny; }
  finish({ win: 'lose', lose: 'win' }[e.k] || 'draw');
}
