'use strict';
/* ===== 넷 다이브: 데이터 미로 실시간 해킹 ===== */
let D = null;
const DIRS = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
function genMaze(cols, rows) {
  const g = Array.from({ length: rows }, () => Array(cols).fill(1));
  const st = [[1, 1]]; g[1][1] = 0;
  while (st.length) {
    const [x, y] = st[st.length - 1];
    const n = shuffle([[2, 0], [-2, 0], [0, 2], [0, -2]]).map(([dx, dy]) => [x + dx, y + dy, dx, dy]).filter(([nx, ny]) => nx > 0 && ny > 0 && nx < cols - 1 && ny < rows - 1 && g[ny][nx] === 1);
    if (!n.length) { st.pop(); continue; }
    const [nx, ny, dx, dy] = n[0]; g[y + dy / 2][x + dx / 2] = 0; g[ny][nx] = 0; st.push([nx, ny]);
  }
  for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++)
    if (g[y][x] === 1 && Math.random() < .14 && ((g[y][x - 1] === 0 && g[y][x + 1] === 0) || (g[y - 1][x] === 0 && g[y + 1][x] === 0))) g[y][x] = 0;
  return g;
}
function bfs(g, sx, sy) {
  const d = g.map(r => r.map(() => -1)); d[sy][sx] = 0; const q = [[sx, sy]];
  while (q.length) { const [x, y] = q.shift(); for (const [dx, dy] of Object.values(DIRS)) { const nx = x + dx, ny = y + dy; if (g[ny] && g[ny][nx] === 0 && d[ny][nx] < 0) { d[ny][nx] = d[y][x] + 1; q.push([nx, ny]); } } }
  return d;
}
function startDive(cfg) {
  const el = document.createElement('div'); el.id = 'dive';
  el.innerHTML = `<div class="wrap"><div class="hud"><span>TIME <b id="d-t" style="color:var(--amber)">0</b></span><span>DATA <b id="d-f" style="color:var(--cyan)">0</b>/5+</span>
    <span>HP <b id="d-h" style="color:var(--red)">◆◆◆</b></span><span style="flex:1">SCORE <b id="d-s">0</b></span><button class="tg px" id="d-x" style="border:1px solid var(--line);padding:4px 8px;color:var(--dim)">EXIT</button></div>
    <div class="field" id="d-field"><canvas id="d-cv"></canvas></div>
    <div class="dpad"><button class="u" data-d="u" aria-label="위">▲</button><button class="l" data-d="l" aria-label="왼쪽">◀</button><button class="d" data-d="d" aria-label="아래">▼</button><button class="r" data-d="r" aria-label="오른쪽">▶</button></div></div>`;
  document.body.appendChild(el);
  const f = $('#d-field', el).getBoundingClientRect();
  const portrait = f.width / f.height < 1;
  let cols = portrait ? 13 : 23, rows = portrait ? Math.max(15, Math.min(21, Math.round(13 * f.height / f.width) | 1)) : 13;
  if (rows % 2 === 0) rows++;
  const g = genMaze(cols, rows);
  const dist = bfs(g, 1, 1);
  const open = []; for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (g[y][x] === 0) open.push([x, y]);
  let vault = open.reduce((a, b) => dist[b[1]][b[0]] > dist[a[1]][a[0]] ? b : a);
  const frags = shuffle(open.filter(([x, y]) => dist[y][x] > 3 && !(x === vault[0] && y === vault[1]))).slice(0, 14).map(([x, y]) => ({ x, y, got: false, ph: Math.random() * 6 }));
  const ice = shuffle(open.filter(([x, y]) => dist[y][x] > 8)).slice(0, portrait ? 4 : 5).map(([x, y]) => ({ x, y, tx: x, ty: y, p: 1, dir: null }));
  D = { cfg, el, g, cols, rows, vault, frags, ice, time: cfg.time || 60, got: 0, hp: 3, inv: 0, score: 0, vaultOpen: false, ended: false,
    pl: { x: 1, y: 1, tx: 1, ty: 1, p: 1, dir: null, want: null }, t: 0, trail: [], msg: 0 };
  D.cv = $('#d-cv', el); D.ctx = D.cv.getContext('2d');
  const setDir = d => { D.pl.want = d; };
  D.key = e => { const m = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', w: 'u', s: 'd', a: 'l', d: 'r', W: 'u', S: 'd', A: 'l', D: 'r' }[e.key]; if (m) { setDir(m); e.preventDefault(); } };
  window.addEventListener('keydown', D.key);
  $$('.dpad button', el).forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); setDir(b.dataset.d); }));
  let sw = null; const cv = D.cv;
  cv.addEventListener('pointerdown', e => { sw = [e.clientX, e.clientY]; });
  cv.addEventListener('pointermove', e => { if (!sw) return; const dx = e.clientX - sw[0], dy = e.clientY - sw[1]; if (Math.hypot(dx, dy) > 24) { setDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'd' : 'u')); sw = [e.clientX, e.clientY]; } });
  cv.addEventListener('pointerup', () => { sw = null; });
  cv.style.touchAction = 'none';
  $('#d-x', el).onclick = () => endDive();
  D.ro = new ResizeObserver(sizeDive); D.ro.observe($('#d-field', el)); sizeDive();
  D.last = performance.now(); D.raf = requestAnimationFrame(diveLoop);
}
function sizeDive() {
  const f = $('#d-field', D.el).getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  D.W = f.width; D.H = f.height; D.dpr = dpr; D.cv.width = f.width * dpr; D.cv.height = f.height * dpr;
  D.cell = Math.min(D.W / D.cols, D.H / D.rows); D.ox = (D.W - D.cell * D.cols) / 2; D.oy = (D.H - D.cell * D.rows) / 2;
}
const free = (x, y) => D.g[y] && D.g[y][x] === 0;
function stepActor(a, speed, dt, choose) {
  a.p += speed * dt;
  while (a.p >= 1) {
    a.x = a.tx; a.y = a.ty; a.p -= 1;
    const nd = choose(a);
    if (nd && free(a.x + DIRS[nd][0], a.y + DIRS[nd][1])) { a.dir = nd; a.tx = a.x + DIRS[nd][0]; a.ty = a.y + DIRS[nd][1]; }
    else { a.p = 1; break; }
  }
}
const apos = a => [a.x + (a.tx - a.x) * Math.min(1, a.p), a.y + (a.ty - a.y) * Math.min(1, a.p)];
function diveLoop(now) {
  if (!D) return;
  const dt = Math.min(.05, (now - D.last) / 1000); D.last = now;
  if (!D.ended) diveUpdate(dt);
  diveRender();
  D.raf = requestAnimationFrame(diveLoop);
}
function diveUpdate(dt) {
  D.t += dt; D.time -= dt; D.inv = Math.max(0, D.inv - dt); D.msg = Math.max(0, D.msg - dt);
  const pl = D.pl;
  // 반대 방향은 즉시 돌기
  if (pl.want && pl.dir && DIRS[pl.want][0] === -DIRS[pl.dir][0] && DIRS[pl.want][1] === -DIRS[pl.dir][1] && pl.p < 1) {
    [pl.x, pl.tx] = [pl.tx, pl.x]; [pl.y, pl.ty] = [pl.ty, pl.y]; pl.p = 1 - pl.p; pl.dir = pl.want;
  }
  stepActor(pl, 6.5, dt, a => (a.want && free(a.x + DIRS[a.want][0], a.y + DIRS[a.want][1])) ? a.want : a.dir);
  const [px, py] = apos(pl);
  D.trail.push([px, py]); if (D.trail.length > 10) D.trail.shift();
  const iceSpeed = 3.4 + D.t * .03;
  for (const ic of D.ice) {
    stepActor(ic, iceSpeed, dt, a => {
      const opts = Object.keys(DIRS).filter(d => free(a.x + DIRS[d][0], a.y + DIRS[d][1]));
      const back = a.dir ? Object.keys(DIRS).find(d => DIRS[d][0] === -DIRS[a.dir][0] && DIRS[d][1] === -DIRS[a.dir][1]) : null;
      const fwd = opts.filter(d => d !== back); const pool = fwd.length ? fwd : opts;
      if (Math.abs(a.x - pl.x) + Math.abs(a.y - pl.y) < 7 && Math.random() < .65)
        return pool.slice().sort((p, q) => (Math.abs(a.x + DIRS[p][0] - pl.x) + Math.abs(a.y + DIRS[p][1] - pl.y)) - (Math.abs(a.x + DIRS[q][0] - pl.x) + Math.abs(a.y + DIRS[q][1] - pl.y)))[0];
      return pick(pool);
    });
    const [ix, iy] = apos(ic);
    if (D.inv <= 0 && Math.hypot(ix - px, iy - py) < .6) { D.hp--; D.inv = 1.5; toast(D.hp > 0 ? `방어 프로그램에 걸렸어요! 무결성 ${D.hp}` : '연결 끊김', 'bad'); if (D.hp <= 0) return endDive(); }
  }
  for (const fr of D.frags) if (!fr.got && Math.hypot(fr.x - px, fr.y - py) < .5) { fr.got = true; D.got++; }
  if (Math.hypot(D.vault[0] - px, D.vault[1] - py) < .5) {
    if (D.got >= 5) { D.vaultOpen = true; toast('금고 해킹 성공!', 'gold'); return endDive(); }
    else if (D.msg <= 0) { toast(`금고를 열려면 데이터 조각 5개가 필요해요 (${D.got}/5)`, ''); D.msg = 2; }
  }
  D.score = D.got * 100 + (D.vaultOpen ? 1000 + Math.round(Math.max(0, D.time) * 20) : 0);
  if (D.time <= 0) endDive();
  $('#d-t').textContent = Math.max(0, Math.ceil(D.time)); $('#d-f').textContent = D.got; $('#d-s').textContent = D.score;
  $('#d-h').textContent = '◆'.repeat(Math.max(0, D.hp)) + '◇'.repeat(3 - Math.max(0, D.hp));
}
function diveRender() {
  const x = D.ctx, c = D.cell; x.setTransform(D.dpr, 0, 0, D.dpr, 0, 0);
  x.fillStyle = '#07060F'; x.fillRect(0, 0, D.W, D.H);
  x.translate(D.ox, D.oy);
  // 바닥 격자
  x.strokeStyle = 'rgba(45,226,230,.06)'; x.lineWidth = 1;
  for (let i = 0; i <= D.cols; i++) { x.beginPath(); x.moveTo(i * c, 0); x.lineTo(i * c, D.rows * c); x.stroke(); }
  for (let i = 0; i <= D.rows; i++) { x.beginPath(); x.moveTo(0, i * c); x.lineTo(D.cols * c, i * c); x.stroke(); }
  // 벽
  x.fillStyle = '#141129'; x.strokeStyle = 'rgba(45,226,230,.55)'; x.lineWidth = 1.5;
  for (let y = 0; y < D.rows; y++) for (let xx = 0; xx < D.cols; xx++) if (D.g[y][xx]) {
    x.fillRect(xx * c, y * c, c, c);
    x.beginPath();
    if (!D.g[y - 1] || !D.g[y - 1][xx]) { if (D.g[y - 1]) { x.moveTo(xx * c, y * c); x.lineTo(xx * c + c, y * c); } }
    if (D.g[y + 1] && !D.g[y + 1][xx]) { x.moveTo(xx * c, y * c + c); x.lineTo(xx * c + c, y * c + c); }
    if (xx > 0 && !D.g[y][xx - 1]) { x.moveTo(xx * c, y * c); x.lineTo(xx * c, y * c + c); }
    if (xx < D.cols - 1 && !D.g[y][xx + 1]) { x.moveTo(xx * c + c, y * c); x.lineTo(xx * c + c, y * c + c); }
    x.stroke();
  }
  // 금고
  const [vx, vy] = D.vault; x.save(); x.shadowColor = '#FFB627'; x.shadowBlur = 16; x.strokeStyle = '#FFB627'; x.lineWidth = 2;
  x.strokeRect(vx * c + c * .18, vy * c + c * .18, c * .64, c * .64); x.fillStyle = D.got >= 5 ? 'rgba(255,182,39,.6)' : 'rgba(255,182,39,.15)'; x.fillRect(vx * c + c * .18, vy * c + c * .18, c * .64, c * .64); x.restore();
  // 조각 (박동)
  for (const fr of D.frags) if (!fr.got) {
    const s = c * (.18 + .07 * (REDUCED ? 0 : Math.sin(D.t * 6 + fr.ph))); const cx = fr.x * c + c / 2, cy = fr.y * c + c / 2;
    x.save(); x.translate(cx, cy); x.rotate(Math.PI / 4); x.shadowColor = '#FF3D9A'; x.shadowBlur = 12; x.fillStyle = '#FF3D9A'; x.fillRect(-s / 2, -s / 2, s, s); x.restore();
  }
  // ICE
  for (const ic of D.ice) {
    const [ix, iy] = apos(ic), cx = ix * c + c / 2, cy = iy * c + c / 2, r = c * .36;
    x.save(); x.translate(cx, cy); x.rotate(D.t * 2); x.shadowColor = '#FF4B5C'; x.shadowBlur = 14; x.strokeStyle = '#FF4B5C'; x.lineWidth = 2; x.fillStyle = 'rgba(255,75,92,.25)';
    x.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); x.fill(); x.stroke(); x.restore();
  }
  // 플레이어
  D.trail.forEach(([tx, ty], i) => { x.fillStyle = `rgba(45,226,230,${i / D.trail.length * .35})`; x.fillRect(tx * c + c * .4, ty * c + c * .4, c * .2, c * .2); });
  const [px, py] = apos(D.pl); const pcx = px * c + c / 2, pcy = py * c + c / 2;
  if (!(D.inv > 0 && Math.floor(D.t * 12) % 2)) {
    x.save(); x.translate(pcx, pcy); x.shadowColor = '#2DE2E6'; x.shadowBlur = 16; x.fillStyle = '#EFFFFF';
    x.beginPath(); x.moveTo(0, -c * .34); x.lineTo(c * .3, 0); x.lineTo(0, c * .34); x.lineTo(-c * .3, 0); x.closePath(); x.fill(); x.restore();
  }
  x.setTransform(1, 0, 0, 1, 0, 0);
}
function endDive() {
  if (!D || D.ended) return; D.ended = true;
  const res = { score: D.score, frags: D.got, vault: D.vaultOpen }, cfg = D.cfg;
  const band = document.createElement('div'); band.className = 'endband';
  band.innerHTML = `<b style="color:${D.vaultOpen ? 'var(--amber)' : 'var(--cyan)'}">${D.vaultOpen ? '금고 털기 성공' : '접속 종료'} · ${fmt(D.score)}</b>`;
  $('#d-field', D.el).appendChild(band);
  setTimeout(() => {
    cancelAnimationFrame(D.raf); window.removeEventListener('keydown', D.key); D.ro.disconnect(); D.el.remove(); D = null;
    cfg.onEnd(res); refresh();
  }, 1200);
}
