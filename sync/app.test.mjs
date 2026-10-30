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
  const scripts = ['data/content.js', 'data/external.js', 'data/life.js', 'js/data-merge.js', 'data/kanji.js', 'js/kanji-align.js', 'data/plan.js', 'data/teaching.js', 'js/progress.js', 'js/study.js', 'js/quiz.js', 'data/curriculum.js', 'js/curriculum.js', 'js/art.js', 'data/jlpt.js', 'js/jlpt-core.js', 'js/jlpt-figure.js', 'js/jlpt-player.js', 'js/jlpt-view.js', 'js/app.js'];
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
  assert.ok(a.document.querySelectorAll('.home-hero .hero-cats img.cat').length === 3, '標題卡上的三隻貓');
  assert.match(a.document.querySelector('.hero-card .hero-title').textContent, /にほんご.*ノート/);
  assert.equal(a.document.querySelectorAll('.lesson-progress .paw').length, 10, '貓腳印進度');
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
  assert.equal(main().querySelectorAll('.life-group').length, Object.keys(a.ctx.NIHONGO_LIFE.themes).length, '依主題分組');
  assert.equal(main().querySelectorAll('.life-card .bar').length, 0, '還沒開始的主題不顯示進度條');
  a.route('#/life/' + encodeURIComponent('食物'));
  assert.ok(main().querySelectorAll('.life-card').length >= 2 && [...main().querySelectorAll('.life-card .life-meta')].every(m => m.textContent.startsWith('食物・')));
  assert.equal(main().querySelectorAll('.life-group').length, 1, '篩選後只有一組');

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

test('JLPT 專區：導覽列、首頁倒數、每日 20 題可作答並記錄、回報按鈕、今日卡片', async () => {
  const a = await app('#/jlpt');
  assert.ok(a.document.querySelector('nav.top a[data-view="jlpt"].active'));
  assert.match(a.document.querySelector('main').textContent, /距離考試還有 [0-9]+ 天/);
  assert.ok(a.document.querySelector('a[href="https://www.jlpt.jp/samples/sampleindex.html"]'), '官方範例題連結');
  a.route('#/jlpt/daily');
  const q = a.document.querySelector('.exam .q');
  assert.ok(q && q.querySelectorAll('.bub').length >= 3);
  a.click('.exam .q .bub[data-v="1"]');
  assert.ok(a.document.querySelector('.exam .q .explain'), '練習模式作答後立刻顯示詳解');
  assert.ok(Object.keys(a.ctx.Progress.load().items).some(k => k.startsWith('jlpt:')));
  a.click('.exam [data-jlpt-report]');
  assert.equal(Object.keys(a.ctx.Progress.jlpt().reports).length, 1);
  a.route('#/');
  assert.ok(a.document.querySelector('.play-card.jlpt-today'));
  assert.ok(!a.document.querySelector('main').innerHTML.includes('undefined'));
});

test('JLPT 題本樣式：文字語彙題沒有 ruby；每日練習可以一路做完並記錄一次', async () => {
  const a = await app('#/jlpt/daily');
  for (const el of a.document.querySelectorAll('.exam .q[data-section="vocab"] .stem')) assert.equal(el.querySelector('ruby'), null);
  for (let i = 0; i < 25 && a.document.querySelector('.exam .q .bub:not([disabled])'); i++) {
    a.click('.exam .q .bub[data-v="2"]');
    if (a.document.querySelector('[data-jlpt-next]')) a.click('[data-jlpt-next]');
  }
  assert.match(a.document.querySelector('main').textContent, /今天的 [0-9]+ 題做完了/);
  assert.equal(a.ctx.Progress.load().sessions.filter(s => s.mode === 'jlpt-daily').length, 1);
});

test('JLPT 設定：可改考試日期與畢業門檻', async () => {
  const a = await app('#/jlpt/settings');
  a.submit('#jlpt-settings', [['target', 'N4'], ['examDate', '2027-12-05'], ['passPct', '0.85'], ['needed', '3']]);
  const s = a.ctx.JLPT.settings();
  assert.equal(s.examDate, '2027-12-05'); assert.equal(s.passPct, 0.85); assert.equal(s.needed, 3);
});

test('JLPT 文章題：每日練習裡文章只出現一次，方框號碼等於畫面上的題號', async () => {
  const a = await app('#/jlpt/daily');
  const J = a.ctx.JLPT, bank = J.bank('N5');
  const tg = bank.questions.find(q => q.type === 'text_grammar');
  assert.ok(tg, '題庫裡要有文章文法題');
  // 把文章題排進今天的題目
  const group = bank.questions.filter(q => q.passage === tg.passage).map(q => q.id);
  a.ctx.localStorage.setItem('nihongo.jlpt.daily', JSON.stringify({ day: a.ctx.Progress.dayKey(), level: 'N5', ids: [bank.questions.find(q => q.type === 'context' && !q.example).id, ...group], i: 1, results: {}, ended: false }));
  a.route('#/jlpt/daily');
  assert.equal(a.document.querySelectorAll('.exam .passage').length, 1);
  const no = a.document.querySelector('.exam .q .qno').textContent.trim();
  assert.equal(a.document.querySelector('.exam .passage .box-no.current').textContent.trim(), no);
  assert.ok(a.document.querySelector('.exam .passage table') || !/^\|/m.test(bank.passages[tg.passage].stem), '表格行（| 開頭）才會變成表格');
});

test('JLPT 模擬考：開始、大題標頭與例題、作答不顯示詳解、重新進入恢復、暫停、交出一科後不能回頭', async () => {
  const a = await app('#/jlpt/mock');
  const J = a.ctx.JLPT;
  assert.ok(a.document.querySelector('[data-jlpt-start][data-kind="mini"]'));
  assert.ok(a.document.querySelector('[data-jlpt-start][data-kind="full"]'));
  assert.match(a.document.querySelector('main').textContent, /需要開聲音/);
  a.click('[data-jlpt-start][data-kind="mini"]');
  const at = J.attempt(); assert.ok(at && at.deadline > Date.now());
  assert.match(a.document.querySelector('.exam-bar .timer').textContent.trim(), /^\d{2}:\d{2}$/);
  assert.ok(a.document.querySelectorAll('#jlpt-exam .mondai-head').length >= 3, '每個大題都有標頭');
  assert.ok(a.document.querySelector('#jlpt-exam .mondai-head .example .bub.on'), '例題塗好答案');
  const q1 = a.document.querySelector('#jlpt-exam .q:not(.example)');
  a.click(`#jlpt-exam .q[data-qid="${q1.dataset.qid}"] .bub[data-v="2"]`);
  assert.equal(J.attempt().answers[q1.dataset.qid], 2);
  assert.equal(a.document.querySelector('#jlpt-exam .explain'), null, '考試中不顯示詳解');
  a.route('#/jlpt/mock');
  assert.ok(a.document.querySelector(`#jlpt-exam .q[data-qid="${q1.dataset.qid}"] .bub.on[data-v="2"]`), '重新進入後答案還在');
  a.click('[data-jlpt-pause]');
  assert.equal(J.attempt().paused, true);
  a.click('[data-jlpt-resume]');
  assert.equal(J.attempt().paused, false); assert.equal(J.attempt().everPaused, true);
  a.click('[data-jlpt-submit-section]');
  assert.equal(J.attempt().sectionIndex, 1);
  assert.ok([...a.document.querySelectorAll('#jlpt-exam .q:not(.example)')].every(q => q.dataset.section !== 'vocab'), '進到文法・讀解');
  assert.equal(J.setAnswer(q1.dataset.qid, 3), false, '上一科不能改');
});

test('JLPT 模擬考：結束考試 → 記錄為放棄、不計入，回到開始畫面', async () => {
  const a = await app('#/jlpt/mock');
  a.click('[data-jlpt-start][data-kind="mini"]');
  a.click('[data-jlpt-abandon]');
  const m = a.ctx.Progress.jlpt().mocks;
  assert.equal(m.length, 1); assert.equal(m[0].abandoned, true); assert.equal(m[0].counted, false);
  assert.equal(a.ctx.JLPT.attempt(), null);
  assert.ok(a.document.querySelector('[data-jlpt-start]'));
});

test('JLPT 成績頁：交完三科 → 估計分數與說明、計入畢業、逐題詳解與回報；首頁顯示本週已完成、成績連結；同週第二份不計入', async () => {
  const a = await app('#/jlpt/mock');
  a.click('[data-jlpt-start][data-kind="mini"]');
  const q1 = a.document.querySelector('#jlpt-exam .q:not(.example)');
  a.click(`#jlpt-exam .q[data-qid="${q1.dataset.qid}"] .bub[data-v="1"]`);
  for (let i = 0; i < 3 && a.document.querySelector('[data-jlpt-submit-section]'); i++) a.click('[data-jlpt-submit-section]');
  // 測試環境沒有聲音，聽解播不完：直接交出聽解這一科
  a.ctx.JLPT.nextSection();
  a.route('#/jlpt/mock');
  const m = a.ctx.Progress.jlpt().mocks.at(-1);
  assert.ok(m && !m.abandoned && m.result, '交卷後有紀錄');
  assert.equal(a.ctx.JLPT.attempt(), null);
  assert.equal(m.counted, true, '全新的模擬考題、有聽解、本週第一份 → 計入畢業');
  a.route('#/jlpt/result/' + m.at);
  const text = a.document.querySelector('main').textContent;
  assert.match(text, /這是估計，官方用量尺分數，實際分數可能不同/);
  assert.match(text, /計入畢業/);
  assert.match(text, /聽解：約/);
  assert.equal(a.document.querySelectorAll('#jlpt-result .q .explain').length, m.qids.length, '每題都有詳解');
  assert.ok(a.document.querySelector('#jlpt-result [data-jlpt-listen]'), '成績頁的聽解題可以重聽');
  a.click('#jlpt-result [data-jlpt-report]');
  assert.equal(Object.keys(a.ctx.Progress.jlpt().reports).length, 1);
  a.route('#/jlpt');
  const home = a.document.querySelector('main').textContent;
  assert.match(home, /本週模擬考：已完成/);
  assert.doesNotMatch(home, /模擬考新題用完了/, '模擬考專用題還夠');
  assert.ok(a.document.querySelector(`a[href="#/jlpt/result/${m.at}"]`));
  assert.ok(a.document.querySelector('a[href="#/jlpt/mock"]'));
  assert.ok(!a.document.querySelector('main').innerHTML.includes('undefined'));
});

// 聽解題要等 Task 14 才有真的題目：測試時先放幾題假的進題庫
function addListening(ctx) {
  const qs = ctx.NIHONGO_JLPT.levels.N5.questions;
  const mk = (type, i, pool) => ({ id: `t-${type}-${pool}-${i}`, level: 'N5', type, section: 'listening', pool, rev: 1,
    script: type === 'response' ? [['F', 'お{国|くに}は　どちらですか。']] : type === 'utterance' ? [['N', 'みせの　ひとを　よびます。なんと　いいますか。']] : [['N', 'しつもん'], ['M', 'はなし'], ['N', 'しつもん']],
    speaker: type === 'utterance' || type === 'response' ? 'M' : undefined,
    choices: type === 'utterance' || type === 'response' ? ['あちらです。', 'アメリカです。', 'へやです。'] : ['えき', 'がっこう', 'こうえん', 'びょういん'], answer: 2, explain: '…' });
  for (const type of ['task', 'point', 'utterance', 'response']) { for (let i = 1; i <= 4; i++) qs.push(mk(type, i, 'mock')); for (let i = 1; i <= 2; i++) qs.push(mk(type, i, 'practice')); }
}

test('JLPT 聽解（考試模式）：開始鈕、不能暫停也不能提早交卷、即時應答只有メモ和 3 個圓圈、發話表現不印選項', async () => {
  const a = await app('#/jlpt/mock');
  addListening(a.ctx);
  a.route('#/jlpt/mock');
  a.click('[data-jlpt-start][data-kind="mini"]');
  a.click('[data-jlpt-submit-section]'); a.click('[data-jlpt-submit-section]');
  assert.equal(a.ctx.JLPT.currentSection(a.ctx.JLPT.attempt()).key, 'listening');
  assert.ok(a.document.querySelector('[data-jlpt-listen-start]'));
  assert.equal(a.document.querySelector('[data-jlpt-pause]'), null);
  assert.equal(a.document.querySelector('[data-jlpt-submit-section]'), null);
  assert.equal(a.document.querySelector('#jlpt-exam [data-jlpt-listen]'), null, '考試中沒有重播鈕');
  const res = a.document.querySelector('#jlpt-exam .q[data-type="response"]:not(.example)');
  assert.match(res.textContent, /メモ/); assert.equal(res.querySelectorAll('.bub').length, 3);
  assert.equal(a.document.querySelector('#jlpt-exam .q[data-type="utterance"] .choices'), null);
  assert.ok([...a.document.querySelectorAll('#jlpt-exam .q:not(.example) .bub')].every(b => b.disabled), '還沒開始播放前不能作答');
});

test('JLPT 聽解（練習模式）：有播放鈕；作答後顯示腳本，可以再聽一次', async () => {
  const a = await app('#/jlpt/daily');
  addListening(a.ctx);
  const q = a.ctx.JLPT.bank('N5').questions.find(x => x.id === 't-task-practice-1');
  a.ctx.localStorage.setItem('nihongo.jlpt.daily', JSON.stringify({ day: a.ctx.Progress.dayKey(), level: 'N5', ids: [q.id], i: 0, results: {}, ended: false }));
  a.route('#/jlpt/daily');
  assert.ok(a.document.querySelector('#jlpt-daily [data-jlpt-listen]'));
  a.click('#jlpt-daily .q .bub[data-v="2"]');
  assert.ok(a.document.querySelector('#jlpt-daily .explain .script'));
  assert.match(a.document.querySelector('#jlpt-daily [data-jlpt-listen]').textContent, /再聽一次/);
});
