// art.js — 自然系插畫：大樹、草地、雲、會走路的小角色（全部是原創 SVG，平塗色塊＋紙張顆粒）
// 用法：Art.hero() 首頁大圖、Art.hill() 頁尾草地、Art.char('onigiri') 單一角色、Art.ring(pct) 圓形進度
window.Art = (() => {
  const C = { green: '#3c7354', greenDeep: '#2c5a41', line: 'rgba(20,45,32,.28)', sage: '#c9dcc3', sage2: '#b3cfae', trunk: '#5a3b2e', cream: '#fffefa', yellow: '#f2c230', sakura: '#f3c3c7', ink: '#3f2b2e' };
  let uid = 0;

  // 紙張顆粒：把雜訊限制在圖形範圍內，疊在平塗色塊上
  const grainFilter = id => `<filter id="${id}" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" result="n"/>
      <feColorMatrix in="n" values="0 0 0 0 0.08  0 0 0 0 0.12  0 0 0 0 0.08  0 0 0 0.55 0" result="d"/>
      <feComposite in="d" in2="SourceAlpha" operator="in"/>
    </filter>`;

  // 樹冠上的流線紋理：一條條微微起伏的線
  function canopyLines(w, top, bottom, step = 15) {
    let out = '';
    for (let y = top, i = 0; y < bottom; y += step, i++) {
      const a = 18 + (i % 5) * 4, p = i * 0.7;
      let d = `M -40 ${y}`;
      for (let x = 0; x <= w + 80; x += 160) d += ` Q ${x + 40} ${(y + Math.sin(p + x / 300) * a).toFixed(1)} ${x + 80} ${(y + Math.cos(p + x / 260) * a * 0.6).toFixed(1)}`;
      out += `<path d="${d}"/>`;
    }
    return out;
  }

  // ── 小角色（都畫在 0 0 60 70 的格子裡，腳踩在 y=70）──
  const face = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><circle cx="-5" cy="0" r="1.6" fill="${C.ink}"/><circle cx="5" cy="0" r="1.6" fill="${C.ink}"/><path d="M-2.5 4 q2.5 2 5 0" stroke="${C.ink}" stroke-width="1.3" fill="none" stroke-linecap="round"/><circle cx="-8.5" cy="3" r="2" fill="#f3a6a6" opacity=".7"/><circle cx="8.5" cy="3" r="2" fill="#f3a6a6" opacity=".7"/></g>`;
  const legs = `<g class="legs" stroke="${C.ink}" stroke-width="2.2" stroke-linecap="round"><path class="leg-l" d="M24 58 L22 69"/><path class="leg-r" d="M36 58 L38 69"/></g>`;
  const CHARS = {
    onigiri: `${legs}<path d="M30 10 Q34 10 50 44 Q56 58 44 59 L16 59 Q4 58 10 44 Q26 10 30 10Z" fill="#fff"/><path d="M20 59 L20 46 Q30 42 40 46 L40 59Z" fill="#2f3b33"/>${face(30, 34)}`,
    flower: `${legs}<g fill="${C.yellow}"><circle cx="30" cy="14" r="9"/><circle cx="44" cy="25" r="9"/><circle cx="39" cy="42" r="9"/><circle cx="21" cy="42" r="9"/><circle cx="16" cy="25" r="9"/></g><circle cx="30" cy="31" r="13" fill="#fff6d6"/>${face(30, 31, .9)}`,
    daruma: `${legs}<path d="M30 8 Q50 8 51 34 Q52 59 30 59 Q8 59 9 34 Q10 8 30 8Z" fill="#c9504a"/><ellipse cx="30" cy="30" rx="13" ry="12" fill="#fff6ee"/>${face(30, 30, .9)}<path d="M22 48 q8 5 16 0" stroke="${C.yellow}" stroke-width="2" fill="none"/>`,
    bird: `<path d="M8 40 Q14 22 34 24 Q46 25 50 18 Q52 30 44 38 Q36 50 18 48 Q10 47 8 40Z" fill="#fff"/><path d="M50 18 L58 17 L51 22Z" fill="${C.yellow}"/><circle cx="44" cy="25" r="1.6" fill="${C.ink}"/><path class="wing" d="M22 34 Q30 26 38 34 Q30 40 22 34Z" fill="#e9efe6"/><g stroke="${C.ink}" stroke-width="1.6"><path d="M26 48 L25 56"/><path d="M32 48 L33 56"/></g>`,
    neko: `${legs}<path d="M14 20 L16 6 L24 14 Q30 12 36 14 L44 6 L46 20 Q52 32 48 46 Q44 59 30 59 Q16 59 12 46 Q8 32 14 20Z" fill="#f4e7d4"/><path d="M14 22 Q20 20 22 26" stroke="#d9b98f" stroke-width="3" fill="none"/>${face(30, 32, .9)}<path d="M48 48 Q58 44 56 34" stroke="#f4e7d4" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  };
  const char = (name, cls = '') => `<svg class="char ${cls}" viewBox="0 0 60 72" aria-hidden="true">${CHARS[name] || CHARS.onigiri}</svg>`;
  // 外層定位（SVG 屬性），中層左右散步、內層上下彈跳（CSS 動畫），三層分開才不會互相覆蓋 transform
  const walker = (name, x, y, s, d) => `<g transform="translate(${x} ${y}) scale(${s})"><g class="walker" style="--d:${d}s"><g class="walker-body">${CHARS[name]}</g></g></g>`;

  const cloud = (x, y, s, o = .8) => `<path transform="translate(${x} ${y}) scale(${s})" d="M10 40 Q0 40 2 30 Q4 20 18 22 Q22 8 40 12 Q52 2 66 14 Q84 10 86 26 Q98 28 96 38 Q94 44 84 44 Z" fill="#fff" opacity="${o}"/>`;

  // 首頁大圖：天空、雲、大樹、草地、角色。文字放在 HTML 疊上去（可選取、可朗讀）
  function hero() {
    const g = 'g' + (++uid), clip = 'c' + uid;
    const canopy = 'M -60 500 C -40 260 120 60 420 30 C 600 12 840 10 1040 30 C 1330 60 1480 260 1500 500 C 1300 585 1060 605 720 605 C 380 605 140 585 -60 500 Z';
    return `<svg class="hero-art" viewBox="0 0 1440 760" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>${grainFilter(g)}<clipPath id="${clip}"><path d="${canopy}"/></clipPath></defs>
      <g class="sky-clouds" data-parallax="0.18">${cloud(60, 120, 1.6, .65)}${cloud(1180, 90, 1.3, .55)}${cloud(980, 420, 1.1, .5)}</g>
      <path class="trunk" d="M700 590 Q704 640 690 700 L752 700 Q736 642 742 590 Q760 630 800 640 Q752 620 744 590Z" fill="${C.trunk}"/>
      <g class="canopy" data-parallax="0.06">
        <path d="${canopy}" fill="${C.green}"/>
        <g clip-path="url(#${clip})" stroke="${C.line}" stroke-width="1.5" fill="none">${canopyLines(1440, 40, 610)}</g>
        <path d="${canopy}" fill="${C.green}" filter="url(#${g})" opacity=".55"/>
      </g>
      <path class="hill hill-back" d="M-40 690 Q360 610 760 650 Q1120 690 1480 640 L1480 780 L-40 780Z" fill="${C.sage2}"/>
      <path class="hill" d="M-40 712 Q420 650 820 690 Q1160 720 1480 680 L1480 780 L-40 780Z" fill="${C.sage}"/>
      <path d="M-40 712 Q420 650 820 690 Q1160 720 1480 680 L1480 780 L-40 780Z" fill="${C.sage}" filter="url(#${g})" opacity=".35"/>
      <g class="walkers">
        ${walker('flower', 170, 636, 1.05, 0)}${walker('onigiri', 300, 652, .95, .4)}${walker('bird', 520, 640, .8, .9)}
        ${walker('daruma', 930, 668, .9, .2)}${walker('neko', 1110, 660, .95, .7)}${walker('flower', 1270, 646, .8, 1.1)}
      </g>
    </svg>`;
  }

  // 頁尾、空白頁用的小草地
  function hill() {
    const g = 'g' + (++uid);
    return `<svg class="hill-art" viewBox="0 0 1440 220" preserveAspectRatio="none" aria-hidden="true"><defs>${grainFilter(g)}</defs>
      <path d="M0 90 Q360 20 720 60 Q1080 100 1440 40 L1440 220 L0 220Z" fill="${C.green}"/>
      <path d="M0 90 Q360 20 720 60 Q1080 100 1440 40 L1440 220 L0 220Z" fill="${C.green}" filter="url(#${g})" opacity=".5"/></svg>`;
  }

  // 圓形進度（像徽章）：pct 0–100
  function ring(pct, label, sub = '') {
    const r = 46, c = +(2 * Math.PI * r).toFixed(1), off = +(c * (1 - Math.max(0, Math.min(100, pct)) / 100)).toFixed(1);
    return `<div class="ring" role="img" aria-label="${label} ${pct}%">
      <svg viewBox="0 0 110 110" aria-hidden="true"><circle cx="55" cy="55" r="${r}" class="ring-track"/><circle cx="55" cy="55" r="${r}" class="ring-fill" style="--c:${c};--off:${off}" stroke-dasharray="${c}" stroke-dashoffset="${c}"/></svg>
      <span class="ring-label">${label}</span><span class="ring-num"><b data-count="${pct}">${pct}</b><small>%</small></span>${sub ? `<span class="ring-sub">${sub}</span>` : ''}
    </div>`;
  }

  // 沒有 WebGL 時的櫻花瓣（CSS 動畫）
  const petals = (n = 14) => `<div class="css-petals" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<i style="--x:${(i * 73) % 100}%;--d:${(i * 1.7) % 9}s;--t:${9 + (i % 5) * 2}s;--s:${.6 + (i % 4) * .18}"></i>`).join('')}</div>`;

  return { hero, hill, char, ring, petals, cloud, CHARS: Object.keys(CHARS) };
})();
