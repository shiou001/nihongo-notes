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
  const scripts = ['data/content.js', 'data/external.js', 'js/data-merge.js', 'data/kanji.js', 'js/kanji-align.js', 'data/plan.js', 'data/teaching.js', 'js/doodles.js', 'js/progress.js', 'js/study.js', 'js/quiz.js', 'js/app.js'];
  for (const f of scripts) vm.runInContext(await readFile(new URL(f, root), 'utf8'), ctx, { filename: f });
  events.DOMContentLoaded();
  return { ctx, document,
    route: h => { ctx.location.hash = h; events.hashchange(); },
    click: selector => { const el = document.querySelector(selector); assert.ok(el, selector); el.dispatchEvent(new Event('click', { bubbles: true })); },
    submit: (selector, entries) => { const form = document.querySelector(selector); assert.ok(form, selector); form.testEntries = entries; form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); },
  };
}

test('首頁、地圖、筆記和測驗設定可渲染；沒有失效的計畫欄位', async () => {
  const a = await app();
  assert.match(a.document.querySelector('main').textContent, /到期單字/);
  for (const hash of ['#/map', '#/notes/3', '#/quiz', '#/kana', '#/kanji/N5']) {
    a.route(hash);
    assert.ok(a.document.querySelector('main').textContent.length > 100, hash);
    assert.ok(!a.document.querySelector('main').innerHTML.includes('undefined'), hash);
  }
  a.route('#/map');
  assert.match(a.document.querySelector('main').textContent, /部分筆記/);
  assert.ok(!a.document.querySelector('main').textContent.includes('data/plan.js'));
});

test('儲存程度後首頁與每日練習一致；新內容先學再練', async () => {
  const a = await app();
  a.submit('#study-profile', [['level', 'N4'], ['weekly', '15'], ['goal', '考試複習']]);
  assert.match(a.document.querySelector('.lead').textContent, /N4/);
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
