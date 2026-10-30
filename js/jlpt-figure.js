// jlpt-figure.js — 聽解插圖（題本風格：只有黑、白、灰）
// render(figure) → HTML／SVG 字串。figure.kind：
//   objects  四格物品組合：options = 4 組 [{ img, n }]，圖檔 img/jlpt/objects/<img>.webp，n 個就重複 n 次
//   map      程式畫的地圖：crossings 1–3 個路口；slot '2Ra' ＝ 第 2 個路口、右邊、靠路（a）／外側（b）的位置
//   calendar 兩頁的行事曆：month、firstDow（1 號是星期幾，0=月）、days（≤14）、today、circles { 日: 號碼 }
//   clocks   四個指針時鐘：options = ['7:30', …]
//   scene    情境圖＋箭頭：img/jlpt/scenes/<img>.webp，arrow { x, y（箭頭尖端，0–1），dir：down-left／down-right }
window.JLPTFigure = (() => {
  const KINDS = ['objects', 'map', 'calendar', 'clocks', 'scene'];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const FONT = 'font-family="BIZ UDPGothic, sans-serif"';

  function objects(f) {
    if (!Array.isArray(f.options) || f.options.length !== 4) throw new Error('objects 要有 4 組 options');
    return `<div class="fig-grid">${f.options.map((items, i) => `<div class="cell"><span class="n">${i + 1}</span><span class="things">${items.flatMap(({ img, n = 1 }) => Array.from({ length: n }, () => `<img src="img/jlpt/objects/${esc(img)}.webp" alt="">`)).join('')}</span></div>`).join('')}</div>`;
  }

  // 地圖：直的路從下往上，橫的路是路口；灰色是街區
  function map(f) {
    const n = f.crossings || 2;
    if (n < 1 || n > 3) throw new Error('map 的 crossings 要 1–3');
    const H = 240 + (n - 1) * 120, top = i => H - 170 - (i - 1) * 120; // 第 i 個路口（橫路）的上緣
    const SLOT_X = { Ra: 278, Rb: 352, La: 122, Lb: 48 };
    const pos = slot => {
      const m = /^([1-3])([LR])([ab])$/.exec(slot || '');
      if (!m || +m[1] > n) throw new Error(`map 的 slot 不正確：${slot}`);
      return { x: SLOT_X[m[2] + m[3]], y: top(+m[1]) - 30 };
    };
    let s = `<svg class="fig-map" viewBox="0 0 400 ${H}" ${FONT} role="img" aria-label="ちず"><rect width="400" height="${H}" fill="#ffffff"/>`;
    // 街區：每兩條橫路之間（以及最上、最下）左右各一塊
    const bands = [[0, top(n)]];
    for (let i = n; i >= 1; i--) bands.push([top(i) + 40, i === 1 ? H - 50 : top(i - 1)]);
    for (const [y1, y2] of bands) s += `<g fill="#e6e6e6" stroke="#111111" stroke-width="1.6"><rect x="-2" y="${y1}" width="172" height="${y2 - y1}"/><rect x="230" y="${y1}" width="172" height="${y2 - y1}"/></g>`;
    for (const { slot, text } of f.labels || []) { const p = pos(slot); s += `<g data-slot="${esc(slot)}"><rect x="${p.x - 32}" y="${p.y - 20}" width="64" height="40" fill="#ffffff" stroke="#111111" stroke-width="1.6"/><text x="${p.x}" y="${p.y + 5}" font-size="13" text-anchor="middle">${esc(text)}</text></g>`; }
    for (const { slot, n: no } of f.marks || []) { const p = pos(slot); s += `<g data-slot="${esc(slot)}"><rect x="${p.x - 17}" y="${p.y - 17}" width="34" height="34" fill="#ffffff" stroke="#111111" stroke-width="2.4"/><text x="${p.x}" y="${p.y + 8}" font-size="22" font-weight="700" text-anchor="middle">${esc(no)}</text></g>`; }
    s += `<path d="M200 ${H - 8} L192 ${H - 24} L208 ${H - 24} Z" fill="#111111"/><text x="216" y="${H - 10}" font-size="14">いま　ここ</text></svg>`;
    return s;
  }

  // 行事曆：左頁 1–7 日、右頁 8–14 日；圈起來的日期用引線拉到外側的號碼
  function calendar(f) {
    const days = ['月', '火', '水', '木', '金', '土', '日'], total = Math.min(f.days || 14, 14), circ = f.circles || {};
    let s = `<svg class="fig-cal" viewBox="0 0 400 230" ${FONT} role="img" aria-label="カレンダー"><rect width="400" height="230" fill="#ffffff"/><rect x="40" y="10" width="320" height="210" fill="#ffffff" stroke="#111111" stroke-width="1.6"/><line x1="200" y1="10" x2="200" y2="220" stroke="#111111" stroke-width="1.6"/><text x="52" y="32" font-size="13">${esc(f.month)}月</text>`;
    for (let d = 1; d <= total; d++) {
      const col = d <= 7 ? 0 : 1, row = (d - 1) % 7, x = col ? 290 : 70, y = 54 + row * 24, dow = days[((f.firstDow || 0) + d - 1) % 7];
      s += `<line x1="${col ? 200 : 40}" y1="${y + 8}" x2="${col ? 360 : 200}" y2="${y + 8}" stroke="#999999" stroke-width=".8"/><text x="${x}" y="${y}" font-size="16" text-anchor="end">${d}</text><text x="${x + 6}" y="${y}" font-size="14">${dow}</text>`;
      if (d === f.today) s += `<text x="${x + 30}" y="${y}" font-size="12">← きょう</text>`;
      if (circ[d] != null) {
        const lx = col ? 380 : 20;
        s += `<g data-circle="${d}"><circle cx="${x - 6}" cy="${y - 5}" r="12" fill="none" stroke="#111111" stroke-width="1.4"/><line x1="${col ? x + 24 : x - 18}" y1="${y - 5}" x2="${col ? lx - 8 : lx + 8}" y2="${y - 5}" stroke="#111111" stroke-width="1"/><text x="${lx}" y="${y}" font-size="16" text-anchor="middle">${esc(circ[d])}</text></g>`;
      }
    }
    return s + '</svg>';
  }

  // 時鐘：分針每分 6 度，時針每小時 30 度＋每分 0.5 度
  function clock(t) {
    const [h, m] = String(t).split(':').map(Number), md = m * 6, hd = (h % 12) * 30 + m * 0.5;
    const hand = (deg, len, w, kind) => { const r = (deg - 90) * Math.PI / 180; return `<line data-hand="${kind}" data-deg="${deg}" x1="50" y1="50" x2="${(50 + len * Math.cos(r)).toFixed(1)}" y2="${(50 + len * Math.sin(r)).toFixed(1)}" stroke="#111111" stroke-width="${w}" stroke-linecap="round"/>`; };
    const ticks = Array.from({ length: 12 }, (_, i) => { const r = (i * 30 - 90) * Math.PI / 180; return `<text x="${(50 + 34 * Math.cos(r)).toFixed(1)}" y="${(54 + 34 * Math.sin(r)).toFixed(1)}" font-size="10" text-anchor="middle">${i || 12}</text>`; }).join('');
    return `<svg viewBox="0 0 100 100" ${FONT} role="img" aria-label="とけい"><circle cx="50" cy="50" r="44" fill="#ffffff" stroke="#111111" stroke-width="2"/>${ticks}${hand(hd, 22, 3.5, 'h')}${hand(md, 32, 2, 'm')}<circle cx="50" cy="50" r="2.5" fill="#111111"/></svg>`;
  }
  const clocks = f => `<div class="fig-grid clocks">${(f.options || []).map((t, i) => `<div class="cell"><span class="n">${i + 1}</span>${clock(t)}</div>`).join('')}</div>`;

  // 情境圖：箭頭尖端放在 (x, y)；down-left 從右上往左下指，down-right 從左上往右下指
  const ARROW = '<path d="M6 14 L14 6 L42 34 L50 26 L50 50 L26 50 L34 42 Z" fill="#111111"/>';
  function scene(f) {
    const a = f.arrow || {}, dir = a.dir === 'down-right' ? 'down-right' : 'down-left';
    return `<div class="fig-scene"><img src="img/jlpt/scenes/${esc(f.img)}.webp" alt="">${a.x != null ? `<span class="arrow-pin" style="left:${Math.round(a.x * 1000) / 10}%;top:${Math.round(a.y * 1000) / 10}%"><svg class="arrow ${dir}" viewBox="0 0 56 56" aria-hidden="true">${ARROW}</svg></span>` : ''}</div>`;
  }

  function render(f) {
    if (!f) return '';
    const fn = { objects, map, calendar, clocks, scene }[f.kind];
    if (!fn) throw new Error(`不認識的插圖 kind：${f.kind}`);
    return fn(f);
  }
  // 插圖用到的圖檔（建置時檢查是否存在）
  const files = f => f?.kind === 'objects' ? [...new Set(f.options.flat().map(o => `img/jlpt/objects/${o.img}.webp`))] : f?.kind === 'scene' ? [`img/jlpt/scenes/${f.img}.webp`] : [];
  return { render, files, KINDS };
})();
