// DOM integration tests; no network, browser profile or cloud progress involved.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';
const root = new URL('../', import.meta.url);

async function app(hash = '#/') {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const { document, Event, HTMLElement } = parseHTML(html).window;
  HTMLElement.prototype.focus = function () { document.focused = this; };
  HTMLElement.prototype.scrollIntoView = function () { document.scrolled = this; };
  const events = {}, store = new Map();
  class FormData {
    constructor(form) { this.entries = form.testEntries || []; }
    getAll(k) { return this.entries.filter(([key]) => key === k).map(([, value]) => value); }
    get(k) { return this.getAll(k)[0] ?? null; }
  }
  const ctx = vm.createContext({ console, document, URLSearchParams, FormData, Date, setTimeout,
    location: { hash }, navigator: {}, scrollTo() {},
    addEventListener: (key, cb) => { events[key] = cb; },
    localStorage: { getItem: k => store.get(k) || null, setItem: (k, v) => store.set(k, v) },
    Sync: { enabled: () => false, init() {}, onStatus() {} },
    Voice: { onVoicesChanged() {}, speak() {}, voices: () => [], get: () => ({}) },
  });
  ctx.window = ctx;
  const scripts = ['data/content.js', 'data/external.js', 'data/life.js', 'js/data-merge.js', 'data/kanji.js', 'js/kanji-align.js', 'data/plan.js', 'data/teaching.js', 'js/progress.js', 'js/study.js', 'js/quiz.js', 'data/curriculum.js', 'js/curriculum.js', 'js/art.js', 'js/app.js'];
  for (const f of scripts) vm.runInContext(await readFile(new URL(f, root), 'utf8'), ctx, { filename: f });
  events.DOMContentLoaded();
  return { ctx, document,
    route: h => { ctx.location.hash = h; events.hashchange(); },
    click: selector => { const el = document.querySelector(selector); assert.ok(el, selector); el.dispatchEvent(new Event('click', { bubbles: true })); },
    submit: (selector, entries) => { const form = document.querySelector(selector); assert.ok(form, selector); form.testEntries = entries; form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); },
  };
}

test('今日、課程、單元、複習、參考資料、筆記、測驗設定可渲染；沒有失效的計畫欄位', async () => {
  const a = await app();
  assert.match(a.document.querySelector('main').textContent, /今日練習/);
  assert.match(a.document.querySelector('main').textContent, /目前學習單元/);
  // v0.11 首頁：大圖、跑馬燈、四個編號區段、每頁有英文大標題
  assert.ok(a.document.querySelector('.home-hero .hero-title'));
  assert.equal(a.document.querySelectorAll('.home-sec .sec-no').length, 4);
  assert.ok(a.document.querySelector('.marquee[aria-hidden="true"]'));
  assert.ok(a.document.querySelector('.home-hero .hero-cover img[src*="cover-cat"]'), '封面圖');
  assert.equal(a.document.querySelector('.home-hero .hero-greet, .home-hero .hero-lead, canvas'), null, '問候語、標語、櫻花都拿掉了');
  assert.ok(a.document.querySelector('.review-chars img.cat[src*="img/cats/"]'), '貓咪角色');
  assert.match(a.document.querySelector('.hero-badge .ring').getAttribute('aria-label'), /N5 達成率 [0-9]+%/);
  a.route('#/review');
  assert.equal(a.document.querySelector('.page-head .display-en').textContent, 'Review');
  a.route('#/unit/N5-greetings');
  assert.match(a.document.querySelector('.page-head .display-en').textContent, /^Unit [0-9]+$/);
  a.route('#/');
  for (const hash of ['#/map', '#/course/N4', '#/unit/N5-particles', '#/unit/N5-vocab-1', '#/unit/N5-kanji-1', '#/review', '#/reference', '#/notes/3', '#/quiz', '#/kana', '#/kanji/N5']) {
    a.route(hash);
    assert.ok(a.document.querySelector('main').textContent.length > 100, hash);
    assert.ok(!a.document.querySelector('main').innerHTML.includes('undefined'), hash);
  }
  a.route('#/course/N3');
  assert.match(a.document.querySelector('main').textContent, /部分筆記/);
  assert.equal(a.document.querySelector('.page-head .lead'), null, '課程頁不放副標語');
  a.route('#/map');
  assert.ok(!a.document.querySelector('main').textContent.includes('data/plan.js'));
  assert.equal(a.document.querySelector('nav.top a.active').textContent.trim(), '課程');
  assert.ok(a.document.querySelectorAll('.units li').length > 20);
  assert.equal(a.document.querySelector('.units li.current .u-num').textContent, '1');
});

test('單元頁：讀筆記段落、練習只出單元題、達標後結果頁給下一單元', async () => {
  const a = await app('#/unit/N5-greetings');
  const main = () => a.document.querySelector('main');
  assert.match(main().textContent, /打招呼/);
  assert.ok(main().querySelectorAll('.unit-read table').length >= 3, '三個會話段落的表格');
  assert.ok(main().querySelector('a[href="#/quiz?unit=N5-greetings"]'));
  a.route('#/quiz?unit=N5-greetings');
  assert.match(a.document.querySelector('.quiz-top').textContent, /會話 → 中文/);
  const ids = new Set(a.ctx.Curriculum.questionIds(a.ctx.Curriculum.get('N5-greetings')));
  for (let i = 0; i < 12 && !a.document.querySelector('.result'); i++) {
    a.click('.choice');
    a.click('#next');
  }
  assert.ok(a.document.querySelector('.result'), '應該到結果頁');
  assert.ok(a.document.querySelector('a[href="#/unit/N5-greetings"]'), '結果頁有回到單元');
  assert.ok(Object.keys(a.ctx.Progress.load().items).every(id => ids.has(id)), '只記錄單元內的題目');

  a.route('#/unit/N5-kana-rules');
  assert.ok(a.document.querySelector('#mark-read'));
  a.click('#mark-read');
  assert.match(main().textContent, /已讀完/);
  assert.equal(a.document.querySelector('#mark-read'), null);
});

test('儲存程度後首頁與每日練習一致；新內容先學再練', async () => {
  const a = await app('#/settings');
  a.submit('#study-profile', [['level', 'N4'], ['weekly', '15'], ['goal', '考試複習']]);
  assert.match(a.document.querySelector('#settings-status').textContent, /已儲存/);
  a.route('#/');
  assert.match(a.document.querySelector('.lesson-info').textContent, /N4/);
  a.route('#/quiz?mode=daily');
  assert.match(a.document.querySelector('main').textContent, /N4 新內容/);
  a.click('#learned-next');
  assert.match(a.document.querySelector('.quiz-top').textContent, /N4/);
  assert.ok(a.document.querySelector('.choice, #recall-answer'));
});

test('讀音提示在點擊前不洩漏，點擊後標記且作答不計獨立分數', async () => {
  const a = await app('#/quiz?types=vocab_reading&levels=N5');
  a.submit('#quiz-setup', [['types', 'vocab_reading'], ['levels', 'N5'], ['origins', 'notion'], ['count', '1']]);
  const hint = a.document.querySelector('#question-hint');
  assert.equal(hint.textContent, '');
  assert.equal(hint.hidden, true);
  a.click('#show-hint');
  assert.equal(hint.hidden, false);
  a.click('.choice');
  assert.match(a.document.querySelector('#feedback').textContent, /你的答案/);
  assert.match(a.document.querySelector('#feedback').textContent, /下次到期/);
  assert.equal(Object.values(a.ctx.Progress.load().items)[0].assisted, 1);
  a.click('#next');
  assert.match(a.document.querySelector('main').textContent, /獨立答對 0 題/);
  assert.match(a.document.querySelector('main').textContent, /各項練習表現/);
  a.click('#retry-wrong');
  assert.ok(a.document.querySelector('.choice'));
});

test('輸入題完整作答、結算和錯題診斷；不用選擇題捷徑', async () => {
  const a = await app('#/quiz?types=vocab_recall');
  a.submit('#quiz-setup', [['types', 'vocab_recall'], ['levels', 'N5'], ['origins', 'notion'], ['count', '1']]);
  assert.ok(a.document.querySelector('#recall-answer'));
  assert.equal(a.document.querySelector('.question [data-say]'), null);
  a.submit('#recall-answer', [['answer', 'まちがい']]);
  assert.match(a.document.querySelector('#feedback').textContent, /まちがい/);
  a.click('#next');
  assert.match(a.document.querySelector('.wrong-list').textContent, /你答：まちがい/);
});

test('未選題型／等級／來源時顯示錯誤，不悄悄改成全部', async () => {
  const a = await app('#/quiz');
  a.submit('#quiz-setup', [['types', 'vocab_reading']]);
  assert.match(a.document.querySelector('#setup-error').textContent, /至少選/);
  assert.ok(a.document.querySelector('#quiz-setup'));
});

test('文法例句格式乾淨，單元連結和手機章節選單存在', async () => {
  const a = await app('#/notes/3');
  assert.ok(a.document.querySelector('#note-chapter'));
  assert.match(a.document.querySelector('.notes-body').textContent, /移動.*路徑/);
  assert.ok(a.document.querySelector('a[href*="source="]'));
  assert.ok(a.document.querySelector('a[href*="page="]'));
  a.route('#/notes/3?section=0');
  assert.equal(a.document.scrolled.id, 'lesson-0');
  a.route('#/quiz?types=grammar');
  a.submit('#quiz-setup', [['types', 'grammar'], ['levels', 'N5'], ['origins', 'notion'], ['count', '1']]);
  a.click('.choice');
  assert.ok(!a.document.querySelector('#feedback').textContent.includes('**'));
});

test('選單可切換且可及性屬性一致，原生選取控制項仍保留', async () => {
  const a = await app('#/quiz');
  a.click('#nav-toggle');
  assert.equal(a.document.querySelector('#nav-toggle').getAttribute('aria-expanded'), 'true');
  a.click('#nav-toggle');
  assert.equal(a.document.querySelector('#nav-toggle').getAttribute('aria-expanded'), 'false');
  assert.ok(a.document.querySelectorAll('input[type=checkbox]').length >= 10);
  const css = await readFile(new URL('css/style.css', root), 'utf8');
  assert.ok(!/\.chip input\s*\{[^}]*display:\s*none/.test(css));
});

test('生活日本：總覽、主題單元的對話、文化小問答、今日頁的輕鬆一下', async () => {
  const a = await app('#/');
  const main = () => a.document.querySelector('main');
  assert.ok(main().querySelectorAll('.today-play .play-card').length >= 3, '今日一句、生活主題、小遊戲');
  assert.match(main().querySelector('.fresh-note').textContent, /言葉/, 'Notion 新筆記提醒');

  a.route('#/life');
  assert.equal(a.document.querySelector('nav.top a.active').textContent.trim(), '生活日本');
  assert.equal(main().querySelectorAll('.life-card').length, a.ctx.NIHONGO_LIFE.topics.length);
  a.route('#/life/' + encodeURIComponent('食物'));
  assert.ok(main().querySelectorAll('.life-card').length >= 2 && [...main().querySelectorAll('.life-card .tag')].some(t => t.textContent === '食物'));

  a.route('#/unit/N5-life-ramen');
  assert.ok(!main().innerHTML.includes('undefined'));
  assert.equal(main().querySelectorAll('.dialogue .bubble').length, 6);
  assert.ok(main().querySelectorAll('.dialogue .zh[hidden]').length === 6);
  a.click('[data-toggle-zh]');
  assert.equal(main().querySelectorAll('.dialogue .zh[hidden]').length, 0);
  assert.ok(main().querySelector('a[href="#/play/role?unit=N5-life-ramen"]'));
  assert.ok(main().querySelector('a[href="#/play/build?unit=N5-life-ramen"]'));
  a.click('[data-trivia="ramen:0"] [data-trivia-choice="1"]');
  assert.match(a.document.querySelector('[data-trivia="ramen:0"] .trivia-explain').textContent, /答對了/);
  assert.deepEqual(Object.keys(a.ctx.Progress.load().items), [], '文化小問答不進複習排程');
});

test('小遊戲：配對、句子重組、角色扮演都能玩到結束，只記錄單元內的題目', async () => {
  const a = await app('#/play/match?unit=N5-life-konbini');
  const C = a.ctx.Curriculum, u = C.get('N5-life-konbini'), ids = new Set(C.questionIds(u));
  const zhOf = new Map(C.pairs(u).map(p => [p.id, p.zh]));
  for (let n = 0; n < 6; n++) {
    const left = a.document.querySelector('[data-match="L"]:not([disabled])');
    const id = left.dataset.id;
    left.dispatchEvent(new a.ctx.document.defaultView.Event('click', { bubbles: true }));
    const right = [...a.document.querySelectorAll('[data-match="R"]')].find(b => b.dataset.id === id);
    assert.equal(right.textContent, zhOf.get(id));
    right.dispatchEvent(new a.ctx.document.defaultView.Event('click', { bubbles: true }));
  }
  assert.match(a.document.querySelector('.game.result').textContent, /秒/);
  assert.equal(Object.keys(a.ctx.Progress.load().items).length, 5, '最後一組靠刪去法，不算');

  a.route('#/play/build?unit=N5-life-konbini');
  const phrases = new Map(u.items.phrases.map(p => [p.zh, p.parts]));
  for (let n = 0; n < 5 && !a.document.querySelector('.game.result'); n++) {
    const parts = phrases.get(a.document.querySelector('.build-zh').textContent);
    for (const t of parts) {
      const tile = [...a.document.querySelectorAll('[data-build-pick]')].find(b => b.textContent === t);
      tile.dispatchEvent(new a.ctx.document.defaultView.Event('click', { bubbles: true }));
    }
    a.click('#build-check');
    assert.match(a.document.querySelector('#feedback').textContent, /對了/);
    a.click('#build-next');
  }
  assert.match(a.document.querySelector('.game.result').textContent, /4 \/ 4/);

  a.route('#/play/role?unit=N5-life-train');
  const lines = a.ctx.NIHONGO_LIFE.topics.find(t => t.id === 'train').dialogue.lines.filter(l => l[0] === 'B').map(l => l[1]);
  for (const line of lines) {
    const btn = [...a.document.querySelectorAll('.role-choice')].find(b => b.textContent === line);
    assert.ok(btn, line);
    btn.dispatchEvent(new a.ctx.document.defaultView.Event('click', { bubbles: true }));
  }
  assert.match(a.document.querySelector('main').textContent, /對話完成/);
  assert.ok(Object.keys(a.ctx.Progress.load().items).filter(id => !id.startsWith('u_')).every(id => ids.has(id)));
});

test('補上的缺口：連體修飾單元有變換題；聽力題只放聲音', async () => {
  const a = await app('#/unit/N5-rentai');
  assert.match(a.document.querySelector('main').textContent, /三種詞的連體形/);
  a.route('#/quiz?unit=N5-rentai&types=drill_transform');
  assert.match(a.document.querySelector('.quiz-top').textContent, /句型變換/);
  assert.match(a.document.querySelector('.question .sub').textContent, /改成/);
  assert.ok(a.document.querySelectorAll('.choice').length >= 3);
  a.route('#/quiz?unit=N5-life-train&types=listen');
  assert.ok(a.document.querySelector('.listen-btn[data-say]'));
  assert.equal(a.document.querySelector('.question .prompt'), null, '聽力題不顯示文字題目');
  assert.ok(a.document.querySelectorAll('.choice').length >= 3);
});

test('已從題庫移除的舊題紀錄不會增加到期數', async () => {
  const a = await app('#/review');
  a.ctx.Progress.record('kw_removed_ambiguous_single_kanji', false, { now: Date.now() - 20 * 60 * 1000 });
  a.route('#/review');
  assert.equal(a.document.querySelector('.stats .stat .num').textContent, '0');
});
