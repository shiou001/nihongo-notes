// motion.js — 動畫與微互動（全部可關：系統設定「減少動態效果」時只保留最基本的淡入）
//   開場：第一次打開（每個分頁一次）畫一個圓、字一個個浮上來，然後像布幕往上收
//   換頁：支援 View Transitions 的瀏覽器用交叉淡入，其他瀏覽器用 CSS 淡入
//   捲動：區塊進入畫面時淡入上浮（依序錯開）、數字從 0 數上來、圓形進度畫出來、插畫視差
//   滑鼠：主要按鈕有磁吸感、卡片會跟著滑鼠微微傾斜
window.Motion = (() => {
  const W = window, D = document;
  // 動畫設定：auto＝跟隨系統（Windows「動畫效果」、macOS「減少動態效果」），on＝一律開啟，off＝一律關閉
  const KEY = 'nihongo.motion';
  const pref = () => { try { const v = localStorage.getItem(KEY); return ['on', 'off'].includes(v) ? v : 'auto'; } catch { return 'auto'; } };
  const systemReduce = () => !!W.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const reduce = () => pref() === 'off' || (pref() === 'auto' && systemReduce());
  function apply() { const r = reduce(); D.documentElement.classList.toggle('has-motion', !r); D.documentElement.classList.toggle('reduce-motion', r); }
  function setPref(v) { try { localStorage.setItem(KEY, v); } catch {} apply(); }
  const finePointer = () => !!W.matchMedia?.('(pointer: fine)').matches;
  const on = () => D.documentElement.classList.contains('has-motion');

  // ── 開場動畫 ──
  function intro() {
    let seen = false;
    try { seen = sessionStorage.getItem('nihongo.intro') === '1'; sessionStorage.setItem('nihongo.intro', '1'); } catch {}
    if (seen || reduce()) return;
    const el = D.createElement('div');
    el.className = 'intro';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<div class="intro-inner">
        <img class="intro-cat" src="img/cats/walk.webp?v=1" alt="">
        <p class="intro-word" lang="ja">${[...'にほんご'].map((c, i) => `<span style="--i:${i}">${c}</span>`).join('')}</p>
        <p class="intro-en">Nihongo Note</p>
      </div>`;
    D.body.appendChild(el);
    const done = () => { if (el.classList.contains('out')) return; el.classList.add('out'); setTimeout(() => el.remove(), 1000); };
    el.addEventListener('click', done);
    setTimeout(done, 2100);
  }

  // ── 換頁 ──
  function swap(render) {
    const main = D.querySelector('main');
    if (on() && D.startViewTransition && !reduce() && !D.hidden) {
      // 保險：轉場要等下一幀才開始；畫面停住（視窗縮小）時 0.4 秒後直接換頁
      let done = false;
      const run = () => { if (!done) { done = true; render(); } };
      const t = D.startViewTransition(run);
      // 連續快速換頁時，上一個轉場會被跳過（AbortError），不用報錯
      for (const p of [t.ready, t.finished, t.updateCallbackDone]) p?.catch?.(() => {});
      setTimeout(run, 400);
      return;
    }
    render();
    if (main && on()) { main.classList.remove('enter'); void main.offsetWidth; main.classList.add('enter'); }
  }

  // ── 逐字浮現：只拆文字節點，圖示、標籤原樣保留 ──
  function splitChars(el) {
    if (!el || el.dataset.split) return;
    el.dataset.split = '1';
    let i = 0;
    const walk = node => {
      for (const n of [...node.childNodes]) {
        if (n.nodeType === 3 && n.textContent.trim()) {
          const frag = D.createDocumentFragment();
          for (const ch of n.textContent) {
            const s = D.createElement('span');
            s.className = 'ch'; s.style.setProperty('--i', Math.min(i++, 40)); s.textContent = ch;
            frag.appendChild(s);
          }
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && !n.matches('.tag, svg, .ph-icon, .glyph')) walk(n);
      }
    };
    walk(el);
  }

  // ── 捲動淡入、數字、進度圈 ──
  const REVEAL = '.page-head > *, .sec-head, .card, .life-card, .play-card, .units li, .next-lessons li, .activity, .stat, .current-lesson, .review-sec, .fresh-note, .ref-grid > *, .life-grid > *, .marquee, .unit-nav';
  let io = null;
  function countUp(el) {
    const end = +el.dataset.count, dur = 900, t0 = performance.now();
    if (!isFinite(end) || end <= 0) return;
    const tick = t => { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = Math.round(end * e); if (p < 1) requestAnimationFrame(tick); };
    el.textContent = '0'; requestAnimationFrame(tick);
  }
  function reveal(root) {
    if (!W.IntersectionObserver) return;
    io ||= new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('in');
        e.target.querySelectorAll?.('[data-count]').forEach(countUp);
        io.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    const els = [...root.querySelectorAll(REVEAL)].filter(el => !el.closest('.quiz, .game, .feedback') && !el.dataset.reveal);
    const sib = new Map();
    for (const el of els) {
      const n = sib.get(el.parentNode) || 0; sib.set(el.parentNode, n + 1);
      el.dataset.reveal = '1'; el.style.setProperty('--ri', Math.min(n, 8));
      io.observe(el);
    }
  }

  // ── 視差：data-parallax="速度" ──
  let px = [];
  function parallax(root) {
    px = [...root.querySelectorAll('[data-parallax]')];
    onScroll();
  }
  function onScroll() {
    const y = W.scrollY || 0;
    for (const el of px) el.style.transform = `translate3d(0, ${(y * +el.dataset.parallax).toFixed(1)}px, 0)`;
    const bar = D.querySelector('.scroll-progress');
    if (bar) { const h = D.documentElement.scrollHeight - innerHeight; bar.style.transform = `scaleX(${h > 0 ? Math.min(1, y / h) : 0})`; }
    D.body.classList.toggle('scrolled', y > 24);
  }

  // ── 滑鼠：磁吸按鈕、傾斜卡片 ──
  function pointer(root) {
    if (!finePointer() || reduce()) return;
    root.querySelectorAll('.btn.primary, .btn.magnetic').forEach(b => {
      if (b.dataset.mag) return; b.dataset.mag = '1';
      b.addEventListener('pointermove', e => { const r = b.getBoundingClientRect(); b.style.transform = `translate(${((e.clientX - r.left) / r.width - .5) * 8}px, ${((e.clientY - r.top) / r.height - .5) * 8}px)`; });
      b.addEventListener('pointerleave', () => { b.style.transform = ''; });
    });
    root.querySelectorAll('.life-card, .play-card, a.card.ref, .tilt').forEach(c => {
      if (c.dataset.tilt) return; c.dataset.tilt = '1';
      c.addEventListener('pointermove', e => { const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; c.style.setProperty('--rx', `${(-y * 5).toFixed(2)}deg`); c.style.setProperty('--ry', `${(x * 6).toFixed(2)}deg`); c.style.setProperty('--mx', `${((x + .5) * 100).toFixed(0)}%`); c.style.setProperty('--my', `${((y + .5) * 100).toFixed(0)}%`); c.classList.add('tilting'); });
      c.addEventListener('pointerleave', () => { c.style.removeProperty('--rx'); c.style.removeProperty('--ry'); c.classList.remove('tilting'); });
    });
  }

  // 每次換頁後呼叫
  function enhance(root = D.querySelector('main')) {
    if (!root) return;
    root.querySelectorAll('.page-head h1, .hero-title').forEach(splitChars);
    if (on()) { reveal(root); parallax(root); pointer(root); }
  }

  function init() {
    apply();
    intro();
    W.addEventListener('scroll', () => requestAnimationFrame(onScroll), { passive: true });
    W.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change', apply);
  }

  return { init, enhance, swap, splitChars, reduce, pref, setPref, systemReduce };
})();
