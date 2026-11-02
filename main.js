'use strict';
const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

function drawBgCity() {
  const c = $('#bgfx canvas'); if (!c) return;
  const W = c.clientWidth || innerWidth, H = c.clientHeight || 200, dpr = Math.min(2, devicePixelRatio || 1);
  c.width = W * dpr; c.height = H * dpr; const x = c.getContext('2d'); x.scale(dpr, dpr);
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(7,6,15,0)'); g.addColorStop(1, 'rgba(42,19,80,.55)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  let px = 0;
  while (px < W) {
    const bw = rnd(20, 60), bh = rnd(H * .2, H * .95);
    x.fillStyle = '#0c0920'; x.fillRect(px, H - bh, bw, bh);
    for (let wy = H - bh + 8; wy < H - 4; wy += 9) for (let wx = px + 5; wx < px + bw - 5; wx += 8)
      if (Math.random() < .12) { x.fillStyle = pick(['rgba(255,61,154,.5)', 'rgba(45,226,230,.45)', 'rgba(255,182,39,.35)']); x.fillRect(wx, wy, 2, 3); }
    px += bw + rnd(1, 8);
  }
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  if (el.disabled) return;
  const fn = ACT[el.dataset.a]; if (fn) fn(el.dataset.v, el, e);
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[role="button"][data-a]')) { e.preventDefault(); e.target.click(); }
  if (e.key === 'Escape' && $('#modal')) closeModal();
});

function intro() {
  openModal({
    label: 'WELCOME · 2189', title: 'SCM 용병단 개업', c: 'var(--cyan)',
    html: `<p style="margin:0">거대 기업이 지배하는 네온 도시. 당신은 작은 용병단의 단장이에요. 용병을 모아 조합과 배치로 싸우고, 도시 밑바닥에서 최강 용병단으로 올라가요.</p>
      <div class="box" style="display:flex;flex-direction:column;gap:6px;font-size:13px">
        <div><b style="color:var(--pink)">전투</b> 자동으로 진행돼요. 궁극기만 직접 타이밍을 골라 눌러요 (PC는 숫자키 1~5).</div>
        <div><b style="color:var(--cyan)">조합</b> 해커가 적을 기절시킨 순간 스나이퍼 궁극기를 쓰면 큰 데미지.</div>
        <div><b style="color:var(--amber)">성장</b> 메인 작전과 의뢰로 보상을 벌고, 용병 레벨을 올리고, 영입으로 모아 승급해요. 자리를 비워도 순찰 보상이 쌓여요.</div>
        <div><b style="color:var(--lime)">속성</b> 플라즈마 → 기계 → 바이오 → 플라즈마 (유리하면 1.5배).</div></div>
      <button class="btn block" data-a="closeModal">메인 작전 시작하기</button>`,
    onClose: () => { S.seen.intro = 1; TAB = 'ops'; refresh(false); if (attendReady()) setTimeout(() => ACT.attend(), 300); },
  });
}

async function boot() {
  let online = false;
  try { online = await netInit(); } catch (e) { console.error(e); toast('서버 연결에 실패해서 오프라인으로 시작해요', 'bad'); }
  if (online) await netBoot(); else S = load() || freshState();
  // 오래된 저장에 빠진 값 보정
  const f = freshState();
  for (const k in f) if (S[k] === undefined) S[k] = f[k];
  drawBgCity(); addEventListener('resize', () => { clearTimeout(boot._t); boot._t = setTimeout(drawBgCity, 200); });
  refresh(false);
  migrate(S);
  if (!S.seen.intro) intro(); else if (attendReady()) setTimeout(() => ACT.attend(), 400);
  setInterval(() => { if (ONLINE && netDaily()) { softRefresh(); return; } if ((TAB === 'job' || TAB === 'hq') && !$('#modal') && !B && !D) refresh(); else { renderTabs(); } }, 20000);
  preloadImages();
}
const start = () => boot();
window.claude?.hot?.snapshot?.(() => ({}));
start();
