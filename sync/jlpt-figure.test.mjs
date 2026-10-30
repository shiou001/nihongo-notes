// 執行：node --test sync/jlpt-figure.test.mjs
// 測 js/jlpt-figure.js：聽解插圖（程式畫的地圖、行事曆、時鐘；物品組合；情境圖箭頭）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';

const ctx = vm.createContext({ console });
ctx.window = ctx;
vm.runInContext(await readFile(new URL('../js/jlpt-figure.js', import.meta.url), 'utf8'), ctx);
const F = ctx.JLPTFigure;
const dom = html => parseHTML(`<div id="r">${html}</div>`).document.getElementById('r');
// 題本只能有黑白灰：所有 #rrggbb 都要 R=G=B
const grayOnly = html => (html.match(/#[0-9a-f]{6}\b/gi) || []).every(c => c.slice(1, 3) === c.slice(3, 5) && c.slice(3, 5) === c.slice(5, 7));

test('objects：四格編號，n 個就重複 n 次', () => {
  const html = F.render({ kind: 'objects', options: [[{ img: 'egg', n: 3 }], [{ img: 'milk' }, { img: 'egg', n: 2 }], [{ img: 'fish' }], [{ img: 'milk' }]] });
  const r = dom(html);
  assert.equal(r.querySelectorAll('.cell').length, 4);
  assert.equal(r.querySelectorAll('.cell')[0].querySelectorAll('img[src="img/jlpt/objects/egg.webp"]').length, 3);
  assert.equal(r.querySelectorAll('.cell')[1].querySelectorAll('img').length, 3);
  assert.equal(r.querySelectorAll('.cell .n')[3].textContent, '4');
  assert.ok(grayOnly(html));
});

test('map：號碼放在指定的位置格、文字標籤、いま ここ', () => {
  const html = F.render({ kind: 'map', crossings: 2, labels: [{ slot: '2Ra', text: 'はなや' }], marks: [{ slot: '2Rb', n: 2 }, { slot: '1La', n: 4 }] });
  const r = dom(html);
  const marks = [...r.querySelectorAll('[data-slot]')].map(g => `${g.getAttribute('data-slot')}:${g.textContent.trim()}`);
  assert.ok(marks.includes('2Rb:2') && marks.includes('1La:4') && marks.includes('2Ra:はなや'));
  assert.match(html, /いま　ここ/);
  assert.ok(grayOnly(html));
  assert.throws(() => F.render({ kind: 'map', crossings: 2, marks: [{ slot: '5Rx', n: 1 }] }), /slot/);
});

test('calendar：只圈指定的日期，號碼在引線旁，今天有標示', () => {
  const html = F.render({ kind: 'calendar', month: 9, firstDow: 0, days: 14, today: 3, circles: { 7: 1, 8: 2, 9: 3, 10: 4 } });
  const r = dom(html);
  assert.equal(r.querySelectorAll('circle').length, 4);
  assert.deepEqual([...r.querySelectorAll('[data-circle]')].map(x => x.getAttribute('data-circle')).sort(), ['10', '7', '8', '9']);
  assert.match(html, /きょう/);
  assert.ok(grayOnly(html));
});

test('clocks：四個時鐘，指針角度對', () => {
  const html = F.render({ kind: 'clocks', options: ['7:30', '8:00', '9:15', '12:45'] });
  const r = dom(html);
  assert.equal(r.querySelectorAll('.cell').length, 4);
  const hands = r.querySelectorAll('.cell')[0].querySelectorAll('[data-hand]');
  assert.equal(hands.length, 2);
  assert.equal(r.querySelectorAll('.cell')[0].querySelector('[data-hand="m"]').getAttribute('data-deg'), '180');
  assert.equal(r.querySelectorAll('.cell')[0].querySelector('[data-hand="h"]').getAttribute('data-deg'), '225');
  assert.ok(grayOnly(html));
});

test('scene：圖片＋箭頭，箭頭尖端在指定的百分比位置', () => {
  const html = F.render({ kind: 'scene', img: 'restaurant-call', arrow: { x: 0.72, y: 0.18, dir: 'down-left' } });
  const r = dom(html);
  assert.ok(r.querySelector('img[src="img/jlpt/scenes/restaurant-call.webp"]'));
  const pin = r.querySelector('.arrow-pin');
  assert.match(pin.getAttribute('style'), /left:\s*72%/); assert.match(pin.getAttribute('style'), /top:\s*18%/);
  assert.ok(pin.querySelector('svg.arrow.down-left'));
  assert.ok(grayOnly(html));
});

test('不認識的插圖種類 → 丟出錯誤（讓建置時就發現）', () => {
  assert.throws(() => F.render({ kind: 'photo' }), /kind/);
  assert.deepEqual([...F.KINDS].sort(), ['calendar', 'clocks', 'map', 'objects', 'scene']);
});
