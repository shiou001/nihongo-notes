// art.js — 插圖：貓咪角色、頁尾草地、圓形進度
// 貓咪插圖來自「ぴよたそ」https://hiyokoyarou.com/（可免費用於網站；著作權屬原作者，請勿單獨再散布）
// 用法：Art.char('kuro') 一隻貓、Art.hill() 頁尾草地、Art.ring(pct, label, sub) 圓形進度
window.Art = (() => {
  // 檔案在 img/cats/，已裁掉留白並縮成 320px
  const CATS = {
    kuro: '黑貓', shiro: '白貓', chatora: '茶虎貓', mike: '三花貓',
    walk: '走路的黑貓', akubi: '打哈欠的黑貓', uruuru: '淚汪汪的黑貓', maneki: '招財貓',
  };
  // 舊的角色名稱（v0.11 的飯糰、達摩…）對應到貓
  const ALIAS = { onigiri: 'kuro', flower: 'chatora', daruma: 'mike', bird: 'shiro', neko: 'walk' };
  const char = (name, cls = '') => {
    const n = CATS[name] ? name : ALIAS[name] || 'kuro';
    return `<img class="char cat ${cls}" src="img/cats/${n}.webp?v=1" alt="" aria-hidden="true" loading="lazy" decoding="async" data-cat="${n}">`;
  };

  // 紙張顆粒：把雜訊限制在圖形範圍內，疊在平塗色塊上
  let uid = 0;
  const grainFilter = id => `<filter id="${id}" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" result="n"/>
      <feColorMatrix in="n" values="0 0 0 0 0.08  0 0 0 0 0.12  0 0 0 0 0.08  0 0 0 0.55 0" result="d"/>
      <feComposite in="d" in2="SourceAlpha" operator="in"/>
    </filter>`;

  // 頁尾的小草地
  function hill() {
    const g = 'g' + (++uid);
    return `<svg class="hill-art" viewBox="0 0 1440 220" preserveAspectRatio="none" aria-hidden="true"><defs>${grainFilter(g)}</defs>
      <path d="M0 90 Q360 20 720 60 Q1080 100 1440 40 L1440 220 L0 220Z" fill="#33684e"/>
      <path d="M0 90 Q360 20 720 60 Q1080 100 1440 40 L1440 220 L0 220Z" fill="#33684e" filter="url(#${g})" opacity=".5"/></svg>`;
  }

  // 圓形進度（像徽章）：pct 0–100
  function ring(pct, label, sub = '') {
    const r = 46, c = +(2 * Math.PI * r).toFixed(1), off = +(c * (1 - Math.max(0, Math.min(100, pct)) / 100)).toFixed(1);
    return `<div class="ring" role="img" aria-label="${label} ${pct}%">
      <svg viewBox="0 0 110 110" aria-hidden="true"><circle cx="55" cy="55" r="${r}" class="ring-track"/><circle cx="55" cy="55" r="${r}" class="ring-fill" style="--c:${c};--off:${off}" stroke-dasharray="${c}" stroke-dashoffset="${c}"/></svg>
      <span class="ring-label">${label}</span><span class="ring-num"><b data-count="${pct}">${pct}</b><small>%</small></span>${sub ? `<span class="ring-sub">${sub}</span>` : ''}
    </div>`;
  }

  return { char, hill, ring, CATS: Object.keys(CATS) };
})();
