// doodles.js — 手繪風 SVG 小元素（達摩、櫻花、飯糰、鳥居、富士山、招財貓…）
// 全部用 stroke 手繪線條 + 微微歪斜，配合 CSS filter #wobble 產生「鉛筆線抖動」感。
window.DOODLES = (() => {
  const ink = '#3b3b3b';
  const wrap = (body, vb = '0 0 100 100', cls = '') =>
    `<svg class="doodle ${cls}" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

  const daruma = wrap(`
    <path d="M50 12c-24 0-36 18-36 40s12 38 36 38 36-16 36-38S74 12 50 12z" fill="#e06c6c"/>
    <path d="M50 30c-14 0-22 9-22 22s8 24 22 24 22-11 22-24-8-22-22-22z" fill="#fdf1e2"/>
    <circle cx="41" cy="50" r="5" fill="#fff"/><circle cx="59" cy="50" r="5" fill="#fff"/>
    <circle cx="41" cy="50" r="2.5" fill="${ink}" stroke="none"/><circle cx="59" cy="50" r="2.5" fill="${ink}" stroke="none"/>
    <path d="M36 42q5-4 10-1M54 41q5-3 10 1"/>
    <path d="M42 62q8 6 16 0"/>
    <path d="M45 74q5 3 10 0" stroke="#e8b04c"/>
    <path d="M40 22q10-6 20 0" stroke="#e8b04c"/>
  `);

  const sakura = wrap(`
    <g fill="#f7c6d0">
      <path d="M50 50c-2-12 4-22 8-24 4 6 6 14 1 22z"/>
      <path d="M50 50c10-7 22-6 25-3-3 7-10 12-19 11z"/>
      <path d="M50 50c11 4 17 15 16 19-7 1-15-3-19-11z"/>
      <path d="M50 50c-3 11-12 18-16 18-3-7-1-15 7-20z"/>
      <path d="M50 50c-12 0-21-8-22-12 6-4 15-4 22 3z"/>
    </g>
    <circle cx="50" cy="50" r="3" fill="#e8b04c" stroke="none"/>
  `);

  const onigiri = wrap(`
    <path d="M50 14 L86 78 Q88 86 80 86 L20 86 Q12 86 14 78 Z" fill="#fff"/>
    <path d="M34 86 L34 62 Q50 56 66 62 L66 86 Z" fill="${ink}"/>
    <circle cx="42" cy="48" r="2.5" fill="${ink}" stroke="none"/><circle cx="58" cy="48" r="2.5" fill="${ink}" stroke="none"/>
    <path d="M45 56q5 4 10 0"/>
    <circle cx="36" cy="54" r="3" fill="#f7c6d0" stroke="none"/><circle cx="64" cy="54" r="3" fill="#f7c6d0" stroke="none"/>
  `);

  const torii = wrap(`
    <path d="M12 26 Q50 18 88 26" stroke-width="6" stroke="#e06c6c"/>
    <path d="M18 40 H82" stroke-width="4" stroke="#e06c6c"/>
    <path d="M28 30 V88 M72 30 V88" stroke-width="5" stroke="#e06c6c"/>
    <path d="M22 88 H34 M66 88 H78"/>
    <path d="M50 40 V26"/>
  `);

  const fuji = wrap(`
    <path d="M8 84 L38 30 Q50 20 62 30 L92 84 Z" fill="#a9cbe8"/>
    <path d="M38 30 Q50 20 62 30 L68 42 Q60 38 56 44 Q50 36 44 44 Q38 38 32 42 Z" fill="#fff"/>
    <path d="M12 26 q6-8 14 0 q6-8 12 0" stroke-width="2.5"/>
    <circle cx="80" cy="22" r="7" fill="#e06c6c"/>
  `);

  const maneki = wrap(`
    <path d="M28 40 Q28 20 50 22 Q72 20 72 40 Q76 60 72 74 Q60 88 40 88 Q26 82 28 62 Z" fill="#fff"/>
    <path d="M30 32 L26 14 L40 24 M70 32 L74 14 L60 24" fill="#fff"/>
    <circle cx="41" cy="46" r="2.5" fill="${ink}" stroke="none"/><circle cx="59" cy="46" r="2.5" fill="${ink}" stroke="none"/>
    <path d="M47 52 q3 3 6 0 M44 56 q6 5 12 0"/>
    <path d="M34 64 Q50 60 66 64" stroke="#e06c6c" stroke-width="4"/>
    <circle cx="50" cy="66" r="4" fill="#e8b04c"/>
    <path d="M74 60 Q90 56 84 36 Q80 28 74 34" fill="#fff"/>
    <path d="M40 70 Q50 92 64 76" fill="#fdf1e2"/>
    <text x="50" y="82" font-size="9" text-anchor="middle" fill="#e06c6c" stroke="none" font-family="Zen Kurenaido, sans-serif">福</text>
  `);

  const cloud = wrap(`
    <path d="M22 70 Q10 70 12 58 Q12 46 26 48 Q28 34 44 36 Q54 26 66 38 Q82 34 84 50 Q94 54 90 66 Q88 72 78 72 Z" fill="#fff"/>
  `);

  const star = wrap(`<path d="M50 14 L60 40 L88 42 L66 60 L74 88 L50 72 L26 88 L34 60 L12 42 L40 40 Z" fill="#f9e39a"/>`);

  const checkmark = wrap(`<path d="M20 52 L42 74 L82 28" stroke="#5aa66c" stroke-width="8"/>`);
  const cross = wrap(`<path d="M26 26 L74 74 M74 26 L26 74" stroke="#e06c6c" stroke-width="8"/>`);

  const wobbleFilter = `
    <svg width="0" height="0" style="position:absolute">
      <filter id="wobble"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="2.2"/></filter>
    </svg>`;

  const byName = { daruma, sakura, onigiri, torii, fuji, maneki, cloud, star, checkmark, cross };
  return { ...byName, wobbleFilter, get: n => byName[n] || sakura };
})();
