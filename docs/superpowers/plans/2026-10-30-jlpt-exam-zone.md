# JLPT Exam Zone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a JLPT zone to nihongo-notes. It covers N5 first and switches levels later. It has three parts:
- 20 practice questions a day, in the real exam's item formats.
- A weekly mini mock exam, with official-style booklet, timing and scoring.
- A graduation rule that moves the learner from N5 to N4.

**Architecture:** Question sources are authored as JSON batches in `jlpt-src/`. `tools/build-jlpt.mjs` validates them, fills generated distractors, keeps only reviewed questions, and emits `data/jlpt.js`. The code is split across four browser files, loaded like the existing ones:
- `js/jlpt-core.js`: pure logic, with no DOM access.
- `js/jlpt-figure.js`: SVG and HTML figures.
- `js/jlpt-player.js`: plays the listening audio in sequence.
- `js/jlpt-view.js`: the screens.

`js/app.js` only adds a route, a nav entry and a card on the Today page. Answers go through the existing `Progress.record` and are synced as before. Mock exam records, reports and settings go into a new synced `jlpt` part of the progress state.

**Tech Stack:** Vanilla JS with no build step, loaded as `window.*` globals. Tests use `node --test` with linkedom and `vm`. Audio comes from the local VOICEVOX engine plus ffmpeg. Images go through ffmpeg (grayscale to webp).

**Spec:** `docs/superpowers/specs/2026-10-30-jlpt-exam-zone-design.md`

## Global Constraints

- Static site, no server. All selection and scoring run in the browser. The bank is a static data file.
- N5 official structure is fixed, from spec §4.1. The full mock uses exactly these numbers:
  - vocab, 20 min: kanji_reading 7, orthography 5, context 6, paraphrase 3.
  - grammar and reading, 40 min: grammar_form 9, sentence_order 4, text_grammar 4, reading_short 2, reading_mid 2, info_search 1.
  - listening, about 30 min: task 7, point 6, utterance 5, response 6.
- Scoring, from spec §4.2:
  - Language knowledge and reading is scored 0–120, with a section minimum of 38.
  - Listening is scored 0–60, with a section minimum of 19.
  - The overall pass mark is 80 for N5 and 90 for N4.
  - Estimated scores must be labelled as estimates: 「這是估計，官方用量尺分數，實際分數可能不同」.
- Booklet rules, from spec §4.3:
  - The vocab section has no furigana, only hiragana with 分かち書き. Only the tested word is in kanji.
  - In the grammar and reading section, every kanji carries furigana.
  - Choices are 1–4. The utterance and response types have 3 choices, and those choices are not printed.
  - The booklet uses black, white and gray only.
- Listening flow, from spec §4.4:
  - task and point: question, then dialogue, then the question again, then answer time.
  - In exam mode there is no pause and no replay.
  - Each 大問 starts with its instructions and the example (れい).
- Voices, by VOICEVOX style id: narrator `N` = 30 (No.7 アナウンス), male `M` = 21 (剣崎雌雄), female `F` = 108 (東北きりたん).
  - Footer credits: `VOICEVOX:No.7`, `VOICEVOX:剣崎雌雄`, `VOICEVOX:東北きりたん`.
- Default settings:
  - current level `N5`, target `N4`, exam date `2027-07-04`.
  - graduation needs `passPct` 0.8 on 2 consecutive counted mocks.
  - daily set is 20 questions: weak types 8, due 6, new 4, listening 2.
- Practice-pool and mock-pool questions are separate. Daily practice never serves `pool: 'mock'`.
- Only questions marked `reviewed: true` ship. The build drops everything else.
- No official exam questions are copied. All items are original or generated from open data:
  - tanos vocabulary (CC BY), `data/external.js`
  - KANJIDIC (CC BY-SA), `data/kanji.js`
- Images live in `img/jlpt/` and are grayscale. いらすとや images are never redistributed, are never hotlinked, and get no download links. Every batch of AI generation needs the user's approval first.
- Existing tests (`npm test`, 79 tests) keep passing. All work is on branch `jlpt-exam-zone` and is previewed locally before merging to `main`.
- Asset version goes to `0.15.0` everywhere `?v=` appears in `index.html`, and in the footer version text.

## Review Focus

1. **Reload or leaving the page in the middle of a mock.**
   - In a reading section, the attempt resumes with the time left by the wall-clock deadline.
   - In listening, it resumes at the start of the current question and the attempt is marked `interrupted`, so it is not counted.
   - Tested in Task 8.
2. **The mock pool runs out for one type.** The mock still assembles using the oldest-seen mock questions. `counted` is false and the home page shows 「模擬考新題用完了」. Tested in Task 9.
3. **Two devices both take mocks, or change settings, before syncing.** Mocks are unioned by `at`, and the latest `settings.updatedAt` wins. Graduation is the same on both devices. Tested in Task 1.
4. **A reported question is later fixed (`rev` bumped).** It comes back into rotation. Until then it never appears in daily practice or mocks. Tested in Task 5.
5. **The phone blocks audio autoplay, so `audio.play()` rejects.** The player stays on a 「點一下開始播放」 button and does not skip the item silently. Tested in Task 12.

---

## Phase 1 — Foundation and daily practice (vocab and grammar items)

### Task 1: Synced JLPT state in Progress

**Files:**
- Modify: `js/progress.js`, which holds state, `merge`, `replace` and the return object.
- Test: `sync/merge-progress.test.mjs`

**Interfaces:**
- Produces: `state.jlpt = { settings, mocks: [], reports: {}, graduated: {} }`.
  - `Progress.jlpt()` returns that object, after a `load()`.
  - `Progress.saveJlpt(fn)` calls `fn(jlpt)` and then `save()`, which triggers sync.
- `settings` = `{ level, target, examDate, passPct, needed, updatedAt }`.
- `mocks[]` = `{ at, level, kind: 'mini'|'full', qids: string[], answers: {qid: number}, result, counted, paused, abandoned, interrupted }`.
- `reports` = `{ [qid]: { at, rev } }`.
- `graduated` = `{ [level]: at }`.
- `merge(a, b)` also returns a merged `jlpt`. `replace(next)` keeps `next.jlpt`.

- [ ] **Step 1: Write the failing tests** in `sync/merge-progress.test.mjs`:

```js
test('jlpt：模擬考以 at 聯集、不受 sessions 200 筆限制；設定取 updatedAt 新的；回報與畢業聯集', () => {
  const a = { items: {}, days: [], sessions: [], jlpt: { settings: { level: 'N5', examDate: '2027-07-04', updatedAt: 5 }, mocks: [{ at: 1 }, { at: 2 }], reports: { q1: { at: 10, rev: 1 } }, graduated: {} } };
  const b = { items: {}, days: [], sessions: [], jlpt: { settings: { level: 'N4', examDate: '2027-12-05', updatedAt: 9 }, mocks: [{ at: 2 }, { at: 3 }], reports: { q2: { at: 11, rev: 2 } }, graduated: { N5: 7 } } };
  const m = merge(a, b);
  assert.deepEqual(m.jlpt.mocks.map(x => x.at), [1, 2, 3]);
  assert.equal(m.jlpt.settings.level, 'N4');
  assert.deepEqual(Object.keys(m.jlpt.reports).sort(), ['q1', 'q2']);
  assert.equal(m.jlpt.graduated.N5, 7);
  assert.deepEqual(merge(b, a).jlpt, m.jlpt);
});
test('jlpt：舊資料沒有 jlpt 也能合併，得到預設空結構', () => {
  const m = merge({ items: {} }, { items: {} });
  assert.deepEqual(m.jlpt, { settings: null, mocks: [], reports: {}, graduated: {} });
});
```

The rule for `graduated`: when both sides have a level, keep the earlier `at`. For `reports`, keep the later `at` per qid.

- [ ] **Step 2: Run the tests and confirm they fail.**
  `node --test sync/merge-progress.test.mjs`. Expected: FAIL, because `m.jlpt` is undefined.
- [ ] **Step 3: Implement the change in `js/progress.js`.**
  - `load()` defaults `state.jlpt ||= { settings: null, mocks: [], reports: {}, graduated: {} }`, filling each missing key.
  - Add `jlpt()` and `saveJlpt(fn)`. Extend `merge` and `replace`.
  - Mocks are sorted by `at`, with no cap.
- [ ] **Step 4: Run all tests.** `npm test`. Expected: all pass, including the 79 existing tests.
- [ ] **Step 5: Commit.** `git commit -m "feat(jlpt): 進度加入可同步的 jlpt 狀態"`

### Task 2: Core — item types, stem markup, validation

**Files:**
- Create: `js/jlpt-core.js`, which defines `window.JLPT`.
- Test: `sync/jlpt-core.test.mjs`. It loads `js/jlpt-core.js` into a `vm` context, the same way `sync/voice.test.mjs` loads `js/voice.js`.

**Interfaces:**
- Produces `JLPT.TYPES`: `{ [type]: { section, label, choices, full: {N5, N4}, mini, instruction } }`.
  - `instruction` is the booklet's 大問 instruction, in N5 hiragana style. Take the wording from spec §4.3 and §4.4 and the 2018 booklet. For example, kanji_reading is 「＿＿＿の　ことばは　ひらがなで　どう　かきますか。１・２・３・４から　いちばん　いい　ものを　ひとつ　えらんで　ください。」
- A question may carry `example: true`. That marks the 大問's (れい), one per type. Example questions are never scored or selected. They only appear in 大問 headers (Tasks 8 and 12).
  - `section` is `'vocab'|'grammar'|'reading'|'listening'`.
  - `label` is the zh label, for example `'漢字讀音'`.
  - `choices` is 4, or 3 for utterance and response.
  - `full` holds the official counts from Global Constraints. `usage` is N4 only.
  - `mini` holds the spec §7.1 counts:
    - kanji_reading 3, orthography 3, context 3, paraphrase 2
    - grammar_form 4, sentence_order 2, text_grammar 3, reading_short 1, reading_mid 2, info_search 1
    - task 3, point 3, utterance 2, response 3
- Produces `JLPT.SECTIONS`:
  - `vocab` contains the vocab types.
  - `grammarReading` contains the grammar and reading types.
  - `listening` contains the listening types.
- Produces `JLPT.renderStem(stem: string) -> string`, which returns HTML.
- Produces `JLPT.validate(q, ctx) -> string[]`, a list of errors.
  - `ctx = { kanjiLevel: Map<char, 'N5'|'N4'|…>, ids: Set<string> }`.
- Stem markup, which the renderer and validator must agree on:
  - `{漢字|かんじ}` → `<ruby>漢字<rt>かんじ</rt></ruby>`
  - `[[…]]` → `<u>…</u>`, the underlined tested part
  - `{{_}}` → an `.ord-blank` blank, and `{{★}}` → a star blank, both for sentence_order
  - `{{#22}}` → a boxed `.box-no` number inside a passage
  - `（　）` is literal text
  - spaces are U+3000 (分かち書き)

- [ ] **Step 1: Write the failing tests.**

```js
test('renderStem：振假名、底線、★、方框號碼', () => {
  assert.equal(JLPT.renderStem('{雨|あめ}です'), '<ruby>雨<rt>あめ</rt></ruby>です');
  assert.match(JLPT.renderStem('あしたは　[[雨]]ですか。'), /<u>雨<\/u>/);
  assert.equal((JLPT.renderStem('つぎの　{{_}}　{{★}}　{{_}}　{{_}}　まがって').match(/ord-blank/g) || []).length, 4);
  assert.match(JLPT.renderStem('{{#22}}'), /class="box-no">22</);
  assert.equal(JLPT.renderStem('<b>'), '&lt;b&gt;');
});
test('validate：答案在選項內、選項不重複、選項數符合題型', () => {
  const ok = { id: 'n5-kr-1', level: 'N5', type: 'kanji_reading', section: 'vocab', stem: 'あしたは　[[雨]]ですか。', choices: ['ゆき', 'はれ', 'くもり', 'あめ'], answer: 4, explain: '…', pool: 'practice', rev: 1 };
  assert.deepEqual(JLPT.validate(ok, ctx()), []);
  assert.ok(JLPT.validate({ ...ok, answer: 5 }, ctx()).length);
  assert.ok(JLPT.validate({ ...ok, choices: ['あめ', 'あめ', 'ゆき', 'はれ'] }, ctx()).length);
  assert.ok(JLPT.validate({ ...ok, type: 'response', section: 'listening', script: [['F', 'お{国|くに}は？']] }, ctx()).length, 'response 只能 3 個選項');
});
test('validate：文字語彙不能有振假名；文法讀解每個漢字都要有振假名；沒標振假名的漢字不能超過級數', () => {
  const base = { id: 'x', level: 'N5', choices: ['a', 'b', 'c', 'd'], answer: 1, explain: '…', pool: 'practice', rev: 1 };
  assert.ok(JLPT.validate({ ...base, type: 'context', section: 'vocab', stem: '{雨|あめ}' }, ctx()).some(e => /振假名/.test(e)));
  assert.ok(JLPT.validate({ ...base, type: 'grammar_form', section: 'grammar', stem: '雨です' }, ctx()).some(e => /振假名/.test(e)));
  assert.deepEqual(JLPT.validate({ ...base, type: 'grammar_form', section: 'grammar', stem: '{薬|くすり}を　のみます' }, ctx()), []);
  assert.ok(JLPT.validate({ ...base, type: 'kanji_reading', section: 'vocab', stem: '[[薬]]' }, ctx()).some(e => /級/.test(e)), '薬 是 N4 漢字');
});
test('validate：id 重複、聽解沒有 script', () => {
  const c = ctx(); c.ids.add('dup');
  assert.ok(JLPT.validate({ id: 'dup', level: 'N5', type: 'context', section: 'vocab', stem: 'あ', choices: ['a', 'b', 'c', 'd'], answer: 1, explain: '…', pool: 'practice', rev: 1 }, c).some(e => /重複/.test(e)));
  assert.ok(JLPT.validate({ id: 'l1', level: 'N5', type: 'point', section: 'listening', choices: ['a', 'b', 'c', 'd'], answer: 1, explain: '…', pool: 'practice', rev: 1 }, ctx()).some(e => /script/.test(e)));
});
```

  - `ctx()` builds `{ kanjiLevel: new Map([['雨','N5'],['薬','N4']]), ids: new Set() }`.
  - Validation rules not shown above: `rev` is an integer ≥ 1. `pool` is `practice` or `mock`. `explain` is non-empty. `section` matches `TYPES[type].section`. Passage questions need `passage`.

- [ ] **Step 2: Run the tests.** `node --test sync/jlpt-core.test.mjs`. Expected: FAIL, because `JLPT` is not defined.
- [ ] **Step 3: Implement `js/jlpt-core.js`.**
  - Escape HTML first, then apply the markup. Kanji detection is `/[\u4e00-\u9fff]/`.
  - Kanji inside `{…|…}` are exempt from the "needs furigana" check and from the level check.
  - Level order is `N5 < N4 < N3 < N2 < N1`. A kanji without a level entry counts as above every level.
- [ ] **Step 4: Run the tests and confirm PASS**, then `npm test`.
- [ ] **Step 5: Commit.** `git commit -m "feat(jlpt): 題型表、題目標記與檢查"`

### Task 3: Bank build tool

**Files:**
- Create: `tools/build-jlpt.mjs`
- Create: `jlpt-src/README.md`, covering the batch file format, the markup and the workflow.
- Create: `jlpt-src/n5/` (empty for now).
- Create (output): `data/jlpt.js`
- Test: `sync/jlpt-build.test.mjs`

**Interfaces:**
- Consumes: `JLPT.validate`, `JLPT.TYPES` (Task 2). The tool loads `js/jlpt-core.js` with `new Function('window', src)`, the same way `tools/make-audio.mjs` loads data.
- Batch file format, `jlpt-src/<level>/<name>.json`:
  - `{ batch, level, reviewed: { by, at } | null, passages: { [id]: { stem } }, questions: [...] }`.
  - A question may omit `section`, which is derived from `TYPES[type].section`.
  - A question may give `gen: { word, reading }` instead of `choices`/`answer`, for the kanji_reading and orthography types.
- Produces `data/jlpt.js`: `window.NIHONGO_JLPT = { builtAt, voices: { N: 30, M: 21, F: 108 }, levels: { N5: { questions: [...], passages: {...} } } }`.
  - It contains only questions from batches whose `reviewed` is non-null.
  - Listening questions are dropped if any of their audio files is missing (Task 11 key).
- Exported for tests:
  - `genChoices(word, reading, type, vocab, kanji) -> { choices, answer }`
  - `buildLevel(batches, ctx, { audioExists }) -> { questions, passages, errors }`
- CLI: `node tools/build-jlpt.mjs` writes the file and prints the counts per type and pool. It exits 1 and prints the errors if any reviewed question fails validation.

- [ ] **Step 1: Write the failing tests.**

```js
test('genChoices：漢字讀音的干擾選項是清濁／長短音／促音變化，且不是該字的合法讀音', () => {
  const r = genChoices('下', 'した', 'kanji_reading', vocab, kanji);
  assert.equal(r.choices.length, 4); assert.equal(r.choices[r.answer - 1], 'した');
  assert.equal(new Set(r.choices).size, 4);
  for (const c of r.choices) if (c !== 'した') assert.ok(!['した', 'しも', 'もと', 'さ', 'くだ', 'お'].includes(c));
});
test('genChoices：表記的干擾選項是形近字，且讀音不同於答案', () => {
  const r = genChoices('車', 'くるま', 'orthography', vocab, kanji);
  assert.equal(r.choices[r.answer - 1], '車'); assert.equal(new Set(r.choices).size, 4);
});
test('buildLevel：沒審查的批次不輸出；有錯的題目回報錯誤；聽解缺錄音就不輸出', () => {
  const out = buildLevel([unreviewedBatch, reviewedBatchWithOneBadQuestion, listeningBatch], ctx, { audioExists: () => false });
  assert.ok(out.errors.length >= 1);
  assert.ok(out.questions.every(q => q.section !== 'listening'));
  assert.ok(!out.questions.some(q => q.id.startsWith('unrev')));
});
```

  - The test fixtures are small inline batches and small `vocab`/`kanji` arrays shaped like `data/external.js` and `data/kanji.js`.
  - Distractor rules for kanji_reading:
    - toggle dakuten on any one mora
    - toggle a long vowel (`う`/`い` insertion or removal)
    - toggle `っ`
    - swap `ゃゅょ` with the full-size kana
    - Keep the first three unique candidates that are not real readings of the word, judged by the tanos vocab readings and the KANJIDIC on/kun readings of the word's kanji.
  - Distractor rules for orthography: for each kanji in the word, substitute a kanji from `kanji` of the same level that shares a component-looking stroke count (±1) and has a different reading. If fewer than 3 unique candidates come out, fall back to random same-level kanji.
  - The answer position is decided by a deterministic hash of the question id, so builds are reproducible.
- [ ] **Step 2: Run** `node --test sync/jlpt-build.test.mjs`. Expected: FAIL, because the module is not found.
- [ ] **Step 3: Implement `tools/build-jlpt.mjs`.** Guard the CLI with the same `process.argv[1] === fileURLToPath(import.meta.url)` check as `make-audio.mjs`.
- [ ] **Step 4: Run** `npm test`. Expected: all pass. Run `node tools/build-jlpt.mjs`. Expected: it writes `data/jlpt.js` with 0 questions.
- [ ] **Step 5: Commit.** `git commit -m "feat(jlpt): 題庫建置工具"`

### Task 4: Content batch A (vocab and grammar practice items) and independent review

**Files:**
- Create: `jlpt-src/REVIEW.md`, the reviewer prompt and checklist.
- Create: `jlpt-src/n5/a-vocab.json`, `jlpt-src/n5/a-grammar.json`
- Modify (output): `data/jlpt.js`

**Interfaces:**
- Consumes: the batch format (Task 3) and the markup (Task 2).

- [ ] **Step 1: Write `jlpt-src/REVIEW.md`.**
  - It is the prompt for a fresh reviewer who did not write the batch.
  - For each question the reviewer returns `id | OK` or `id | 問題 | 建議修正`.
  - The checklist:
    - The answer is unique; no other choice is defensible.
    - The Japanese is natural.
    - Vocabulary and grammar are within N5 (or N4 for N4 batches).
    - The explanation is correct.
    - The format matches §4.3: 分かち書き, furigana per section, underline placement.
    - The listening script matches the printed choices and the figure.
    - Nothing copies official or commercial questions.
- [ ] **Step 2: Author the batches, all `pool: 'practice'`.**
  - `a-vocab.json`: kanji_reading 10 and orthography 10, both with `gen` and short authored stems; context 10; paraphrase 8.
  - `a-grammar.json`: grammar_form 15 and sentence_order 8.
  - Prefer words in `data/content.js` vocab (the user's notes) and fill from tanos N5. Fill `refs` where a note item exists.
  - Add one `example: true` item per type. Batches B and D do the same for their types.
- [ ] **Step 3: Run** `node tools/build-jlpt.mjs`. Expected: no errors. Batches are unreviewed, so the output is 0.
- [ ] **Step 4: Independent review.**
  - Dispatch a fresh general-purpose subagent with `jlpt-src/REVIEW.md` and both batch files.
  - Fix every reported issue and bump `rev` on each changed question.
  - Re-dispatch until the result is all OK.
  - Set `reviewed: { by: 'independent-agent', at: '<date>' }`.
- [ ] **Step 5: Rebuild and test.** Run `node tools/build-jlpt.mjs`. Expected: 61 practice questions. Then run `npm test`.
- [ ] **Step 6: Commit.** `git commit -m "content(jlpt): N5 第一批文字語彙與文法練習題（已審查）"`

### Task 5: Settings, daily selection, reports

**Files:**
- Modify: `js/jlpt-core.js`
- Test: `sync/jlpt-core.test.mjs`

**Interfaces:**
- Consumes: `Progress.jlpt()`, `Progress.saveJlpt()` and `Progress.stat(id)` (Task 1). Data comes from `window.NIHONGO_JLPT` (Task 3).
- Produces:
  - `JLPT.DEFAULTS = { level: 'N5', target: 'N4', examDate: '2027-07-04', passPct: 0.8, needed: 2 }`
  - `JLPT.settings() -> settings`, which merges the defaults with `Progress.jlpt().settings`.
  - `JLPT.setSettings(patch)`, which stamps `updatedAt: Date.now()`.
  - `JLPT.bank(level) -> { questions, passages }`, which is empty when the level is missing.
  - `JLPT.qid(q) -> 'jlpt:' + q.id`, the Progress item id.
  - `JLPT.isReported(q) -> boolean`, true when the report's `rev` ≥ `q.rev`.
  - `JLPT.report(q)`
  - `JLPT.typeStats(level) -> { [type]: { seen, correct, pct } }`, over practice and mock questions answered through `Progress.stat`.
  - `JLPT.dailySet({ level, now, count = 20, mix = { weak: 8, due: 6, fresh: 4, listening: 2 } }) -> question[]`
  - `JLPT.daysLeft(now) -> number`, the days until `settings().examDate`.

- [ ] **Step 1: Write the failing tests.** They use a stub `Progress`, with an in-memory `stat` map and a `jlpt` object, and a stub `NIHONGO_JLPT` holding 40 practice and 10 mock questions across types.

```js
test('dailySet：20 題、不含模擬考專用題、不含被回報的題；弱點題型優先', () => {
  // grammar_form 答錯很多 → 弱點
  const set = JLPT.dailySet({ level: 'N5', now: NOW });
  assert.equal(set.length, 20);
  assert.ok(set.every(q => q.pool === 'practice'));
  assert.ok(!set.some(q => q.id === reportedId));
  assert.ok(set.filter(q => q.type === 'grammar_form').length >= 4);
});
test('dailySet：到期的錯題會出；聽解題不足時由其他類別補滿', () => {
  assert.ok(JLPT.dailySet({ level: 'N5', now: NOW }).some(q => q.id === dueWrongId));
  assert.equal(JLPT.dailySet({ level: 'N5', now: NOW }).filter(q => q.section === 'listening').length, 0); // bank 沒有聽解
});
test('回報後不出；題目修正（rev 增加）後恢復出題', () => {
  const q = bankQ('n5-cx-3'); JLPT.report(q);
  assert.ok(JLPT.isReported(q));
  assert.ok(!JLPT.isReported({ ...q, rev: q.rev + 1 }));
});
test('設定：預設值；修改會寫入 updatedAt；倒數天數', () => {
  assert.equal(JLPT.settings().examDate, '2027-07-04');
  JLPT.setSettings({ passPct: 0.85 });
  assert.equal(JLPT.settings().passPct, 0.85); assert.ok(stubJlpt.settings.updatedAt > 0);
  assert.equal(JLPT.daysLeft(new Date('2027-07-01T09:00')), 3);
});
```

  - How `dailySet` picks questions:
    - **due**: `stat.seen && stat.due <= now`, most overdue first.
    - **weak**: questions from the lowest-`pct` types that have `seen ≥ 1`. Unseen questions come first, then the oldest `last`.
    - **fresh**: unseen questions, those with `refs` first, then by type round-robin.
    - **listening**: any eligible listening question.
    - When a bucket is short, fill in the order fresh, due, weak.
    - The same question never appears twice. Questions sharing a passage come together, as a whole group.
- [ ] **Step 2: Run the tests.** Expected: FAIL.
- [ ] **Step 3: Implement the functions.**
- [ ] **Step 4: Run the tests and confirm PASS**, then `npm test`.
- [ ] **Step 5: Commit.** `git commit -m "feat(jlpt): 設定、每日 20 題、回報題目"`

### Task 6: Zone home, daily practice screen, nav, Today card, booklet style

**Files:**
- Create: `js/jlpt-view.js`, which defines `window.JLPTView`.
- Create: `css/jlpt.css`
- Modify: `index.html`
  - Add a nav link between 生活日本 and 複習: `<a href="#/jlpt" data-view="jlpt" data-en="JLPT">JLPT</a>`.
  - Add `BIZ+UDPGothic:wght@400;700` to the Google Fonts URL.
  - Add `css/jlpt.css` after `sticker.css`.
  - Add the scripts `data/jlpt.js`, `js/jlpt-core.js`, `js/jlpt-figure.js` (Task 13 creates it; add the tag now with an empty stub file), `js/jlpt-player.js` (same) and `js/jlpt-view.js`, all before `js/app.js`.
- Modify: `js/app.js`
  - Add `jlpt: 'jlpt'` to `navView` in `route()`.
  - Add `case 'jlpt': JLPTView.mount(app(), seg.slice(1), params); break;`.
  - Add `HEAD_CAT.jlpt = 'maneki'`.
  - Have `todayExtras` prepend `JLPTView.todayCard()`.
- Modify: `sync/app.test.mjs`, adding the new scripts to the `scripts` list after `js/art.js`.
- Test: `sync/app.test.mjs`

**Interfaces:**
- Consumes: everything in Task 5, plus `JLPT.renderStem` (Task 2).
- Produces:
  - `JLPTView.mount(el, seg: string[], params: URLSearchParams)`, which renders the zone and attaches delegated listeners once.
  - `JLPTView.todayCard() -> string`
  - Routes:
    - `#/jlpt`: home
    - `#/jlpt/daily`: practice
    - `#/jlpt/settings`: target, exam date, `passPct`, `needed`
  - The question renderer `JLPTView.questionHtml(q, { mode: 'practice'|'exam', number }) -> string` is reused by Tasks 8, 12 and 13.

- [ ] **Step 1: Write the failing tests** in `sync/app.test.mjs`. In the test, the bank is the real built `data/jlpt.js`.

```js
test('JLPT 專區：導覽列、首頁倒數、每日 20 題可作答並記錄、回報按鈕、今日卡片', async () => {
  const a = await app('#/jlpt');
  assert.ok(a.document.querySelector('nav.top a[data-view="jlpt"].active'));
  assert.match(a.document.querySelector('main').textContent, /距離考試還有 [0-9]+ 天/);
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
});
test('JLPT 題本樣式：文字語彙題沒有 ruby；文法題有 ruby', async () => {
  const a = await app('#/jlpt/daily');
  for (const el of a.document.querySelectorAll('.exam .q[data-section="vocab"] .stem')) assert.equal(el.querySelector('ruby'), null);
});
```

  - Home content:
    - 「距離考試還有 N 天（2027/7/4・N4）」
    - current level and graduation progress: the last 2 counted mocks; until Task 9 exists it shows 「還沒有模擬考紀錄」
    - weak-type list from `typeStats`
    - a daily button showing how many of the 20 are done today
    - a link to the official samples: `https://www.jlpt.jp/samples/sampleindex.html`
  - Practice screen:
    - one question at a time, in booklet styling (`.exam`)
    - answer bubbles under the question
    - on answer: `Progress.record(JLPT.qid(q), correct)`, then reveal `.explain` and a 「回報題目有問題」 button `[data-jlpt-report]`
    - at the end: score and `Progress.endSession(score, 20, 'jlpt-daily')`
  - `css/jlpt.css` (scoped `.exam`):
    - white page, `#111` text, grays only
    - font `"BIZ UDPGothic"`
    - boxed question numbers
    - 2×2 or 1×4 choice layout by text length (over 8 characters → 2×2)
    - at 375px width: no horizontal scroll, and bubbles at least 40px
- [ ] **Step 2: Run** `npm test`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the view, the CSS and the wiring.
- [ ] **Step 4: Run** `npm test` and confirm PASS.
- [ ] **Step 5: Preview.** Run `preview_start` with `{name: "nihongo-notes"}` and open `#/jlpt` and `#/jlpt/daily` at desktop and mobile width. Check that there are no console errors.
- [ ] **Step 6: Commit and show the user.** `git commit -m "feat(jlpt): 專區首頁、每日 20 題、題本樣式"`. Wait for the user's OK before Phase 2.

---

## Phase 2 — Reading and mock exams

### Task 7: Passages and reading items, content batch B (practice)

**Files:**
- Modify: `js/jlpt-view.js`, so a passage renders once, above its group of questions.
- Modify: `css/jlpt.css`
- Create: `jlpt-src/n5/b-reading.json`
- Test: `sync/app.test.mjs`

**Interfaces:**
- Passage stems use the same markup.
  - `info_search` passages may contain a simple table, written as lines of `|`-separated cells. `JLPT.renderStem` renders a line starting with `|` as table rows.
  - Add a test case for this to `sync/jlpt-core.test.mjs`: `assert.match(JLPT.renderStem('|じかん|ばしょ|\n|9じ|１かい|'), /<table[\s\S]*<td>9じ<\/td>/)`.

- [ ] **Step 1: Write the failing tests.**
  - The core table test above.
  - An app test: a daily set containing a text_grammar question shows exactly one `.passage` for the group, and `{{#n}}` boxes match the question numbers.
- [ ] **Step 2: Run** and confirm FAIL. **Step 3: Implement.** **Step 4: Run** and confirm PASS.
- [ ] **Step 5: Author `b-reading.json`.**
  - Practice items: text_grammar 2 passages × 4, reading_short 4, reading_mid 2 passages × 2, info_search 2.
  - Do the independent review as in Task 4 Step 4, then rebuild.
- [ ] **Step 6: Commit.** `git commit -m "feat(jlpt): 讀解題與文章；第二批練習題（已審查）"`

### Task 8: Mock assembly and exam mode (non-listening sections)

**Files:**
- Modify: `js/jlpt-core.js`, for assembly and attempt state.
- Modify: `js/jlpt-view.js`, adding the `#/jlpt/mock` intro, exam and finish screens.
- Test: `sync/jlpt-core.test.mjs`, `sync/app.test.mjs`

**Interfaces:**
- Produces `JLPT.assembleMock({ level, kind: 'mini'|'full', now }) -> plan`.
  - `plan = { level, kind, fresh: boolean, sections: [{ key: 'vocab'|'grammarReading'|'listening', qids, seconds }] }`.
  - `seconds` for a mini mock is `ceil(n × perItem / 60) × 60`:
    - vocab: perItem = 20×60/21
    - grammarReading: perItem = 40×60/22
    - listening: `null`, because the audio drives it
  - For a full mock the times are 1200, 2400 and `null`.
  - Questions are taken first from **unseen** `pool: 'mock'` questions, where "seen" means the id is in any `Progress.jlpt().mocks[].qids`.
  - If a type is short, fill from the oldest-seen mock questions, then from practice questions. Either fallback sets `fresh = false`.
  - Passage groups are kept whole.
- Produces `JLPT.attempt()`, `JLPT.saveAttempt(a)` and `JLPT.clearAttempt()`.
  - The attempt is stored in localStorage `nihongo.jlpt.attempt` and is device-local.
  - `attempt = { plan, startedAt, sectionIndex, deadline, remainingMs, paused: boolean, everPaused, answers: {qid: n}, listenIndex, interrupted }`.
- Exam rules:
  - The sections run in order. The deadline is wall-clock. When time is up, the section is submitted automatically.
  - Previous sections are locked.
  - Pause is allowed only outside listening. It stores `remainingMs` and sets `everPaused`.
  - 「結束考試」 abandons the attempt: it is recorded with `abandoned: true`, `counted: false`.

- [ ] **Step 1: Write the failing tests.**

```js
test('assembleMock mini：題型題數符合 §7.1、優先沒考過的模擬考題、文章題整組', () => {
  const p = JLPT.assembleMock({ level: 'N5', kind: 'mini', now: NOW });
  assert.deepEqual(p.sections.map(s => s.key), ['vocab', 'grammarReading', 'listening']);
  assert.equal(p.sections[0].seconds, 660); assert.equal(p.sections[1].seconds, 1440);
  assert.ok(p.fresh);
});
test('assembleMock：某題型模擬考新題不夠 → 用舊題補、fresh=false', () => { /* stub 只有 1 題 mock 的 paraphrase */ });
test('考試狀態：重新整理後以截止時間恢復剩餘時間；聽解中重新整理 → interrupted', async () => {
  const a = await app('#/jlpt/mock'); a.click('[data-jlpt-start]');
  const at = a.ctx.JLPT.attempt(); assert.ok(at.deadline > Date.now());
  a.route('#/jlpt/mock'); // 模擬重新進入
  assert.ok(a.document.querySelector('.exam .timer'));
  a.ctx.JLPT.saveAttempt({ ...a.ctx.JLPT.attempt(), sectionIndex: 2, listenIndex: 3 });
  a.route('#/jlpt/mock');
  assert.equal(a.ctx.JLPT.attempt().interrupted, true);
});
test('考試模式：作答中不顯示詳解；不能回上一科；暫停會記錄', async () => { /* … */ });
```

  - The `.timer` text is `mm:ss`, computed from `deadline - now`.
  - The intro screen shows the expected total minutes (sum of the section seconds plus about 15 min for listening) and 「需要開聲音」.
  - It offers two choices: 小型模擬考 (`mini`, default) and 全真模擬考 (`full`, 67 questions, official times).
  - In exam mode, questions are grouped by 大問. Each group starts with a header: もんだいN, `TYPES[type].instruction`, and the type's example question with its correct bubble filled, in the 2018 booklet layout. Numbering runs continuously within a section.
  - Add an app test: the vocab section of an exam shows a `.mondai-head` per type present, each containing `.example .bub.on`.
- [ ] **Step 2: Run** and confirm FAIL. **Step 3: Implement.** **Step 4: Run** `npm test` and confirm PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(jlpt): 組卷與考試模式（計時、鎖上一科、暫停、中斷）"`

### Task 9: Scoring, result page, graduation, weekly counting

**Files:**
- Modify: `js/jlpt-core.js`, `js/jlpt-view.js`
- Test: `sync/jlpt-core.test.mjs`, `sync/app.test.mjs`

**Interfaces:**
- Produces `JLPT.score(plan, answers, bank) -> result`.
  - `result = { total: {correct, n, pct}, sections: {vocab, grammarReading, listening}, lk: {pct, est, pass}, listen: {pct, est, pass}, estTotal, estPass, byType: {[type]: {correct, n}} }`.
  - `lk` = vocab + grammarReading, with `est = round(pct × 120)` and `pass = est ≥ 38`.
  - `listen` uses `est = round(pct × 60)` and `pass = est ≥ 19`.
  - `estPass = estTotal ≥ {N5: 80, N4: 90}[level] && lk.pass && listen.pass`.
  - When a plan has no listening questions (Phase 2 before Phase 3), `listen` is `null`, `estPass` is `null`, and the page says 「聽解還沒開放，這次只算前兩科」.
- Produces `JLPT.finishAttempt(now) -> mock`.
  - It records into `Progress.jlpt().mocks` through `saveJlpt`.
  - It calls `Progress.record(JLPT.qid(q), correct)` for every question, so wrong answers enter SRS.
  - It clears the attempt and returns the mock.
- Produces `JLPT.weekKey(date) -> 'YYYY-MM-DD'`, the local Monday.
- `counted` is true when all of these hold: `plan.fresh`, `!abandoned`, `!interrupted`, listening is included, and no other counted mock exists with the same `weekKey`.
- Produces `JLPT.graduation(level) -> { done: boolean, last: mock[] }`.
  - It looks at the last `settings.needed` counted mocks of `level`. Each must have `total.pct ≥ passPct`, `lk.pass` and `listen.pass`.
  - When `done`, record `graduated[level] = now` once.
  - Then, if `JLPT.bank(nextLevel).questions.length > 0`, set `settings.level` to the next level. Otherwise keep the level and show 「N5 畢業！N4 題庫準備中」.
- Produces `JLPT.mockPoolLeft(level) -> { [type]: number }`, the number of unseen mock questions per type.
- Result page `#/jlpt/result/<at>`:
  - accuracy, total and per section
  - estimated scores with the exact disclaimer from Global Constraints
  - section pass/fail
  - 「有暫停」 when `mock.paused`, and 「不計入畢業」 with the reason (not fresh, 2nd mock this week, interrupted, listening not included)
  - weak-type bars
  - per-question review with explanations and the report button
- Home additions: graduation progress, 「本週模擬考：已完成／未完成」, and the warning 「模擬考新題用完了」 when any type in `mockPoolLeft` is below its `mini` count.

- [ ] **Step 1: Write the failing tests.** Cover:
  - score maths: 30/35 overall; lk pct 0.75 → est 90; listening 0.3 → est 18 → `pass` false → `estPass` false even though estTotal is 108 ≥ 80
  - the second mock in the same week is not counted
  - a non-fresh mock is not counted
  - graduation needs two consecutive counted mocks ≥ 0.8; a failed one in between resets the streak
  - graduation with an empty N4 bank keeps the level at N5 and sets `graduated.N5`
  - `mockPoolLeft` triggers the home warning
- [ ] **Step 2: Run** and confirm FAIL. **Step 3: Implement.** **Step 4: Run** `npm test` and confirm PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(jlpt): 計分、成績頁、畢業判定、每週計入規則"`

### Task 10: Content batch C (mock-only vocab, grammar and reading)

**Files:**
- Create: `jlpt-src/n5/c-mock-text.json`

- [ ] **Step 1: Author mock-only questions** (`pool: 'mock'`) for 4 mini mocks: 4 × (11 vocab + 13 grammar/reading) = 96 questions, following the §7.1 per-type counts.
- [ ] **Step 2: Independent review** as in Task 4 Step 4, then rebuild. The `mockPoolLeft` minimum per type is at least 4 × `mini`.
- [ ] **Step 3: Preview** a full mini mock in the browser: intro → two timed sections → result. Show the user.
- [ ] **Step 4: Commit.** `git commit -m "content(jlpt): 模擬考專用題（文字語彙、文法、讀解，已審查）"`

---

## Phase 3 — Listening

### Task 11: Listening audio tool

**Files:**
- Create: `tools/make-jlpt-audio.mjs`
- Modify: `js/jlpt-core.js`
- Test: `sync/jlpt-core.test.mjs`

**Interfaces:**
- Produces `JLPT.audioFile(role, text) -> 'audio/jlpt/' + audioKey(voiceId + '|' + text) + '.mp3'`.
  - `voiceId = NIHONGO_JLPT.voices[role]`.
  - `audioKey` is the same FNV-1a function as `js/voice.js` and `tools/make-audio.mjs`. Import it from `tools/make-audio.mjs` in the tool; copy it into core, as `voice.js` does.
- Produces `JLPT.INSTRUCTIONS[type]`: the narrator text of each listening 大問's instructions. Write it in the official style. For example, for task: 「もんだい１では、はじめに　しつもんを　きいて　ください。それから　はなしを　きいて、もんだいようしの　１から４の　なかから、いちばん　いい　ものを　ひとつ　えらんで　ください。」
- Produces `JLPT.listeningLines(q) -> [role, text][]`, the full playback order.
  - task and point: `script` already contains narrator question, dialogue and narrator question again. The validator requires the first and last line to be `N`.
  - utterance: the narrator situation, then the 3 choices, prefixed `一、` `二、` `三、` and spoken by the item's speaker role.
  - response: the prompt line, then the 3 responses.
- CLI: `node tools/make-jlpt-audio.mjs` collects every line from all `jlpt-src` batches plus `INSTRUCTIONS`. It synthesizes only files that are missing. Engine settings are `speedScale 0.95`, `prePhonemeLength 0.05`, `postPhonemeLength 0.15`, then MP3 mono 24 kHz 48 kbps. It prints the counts.

- [ ] **Step 1: Write the failing tests.**
  - `audioFile('F', 'はい。')` equals `'audio/jlpt/' + Voice-compatible key + '.mp3'`. Assert it against a known key computed with the copied function.
  - `listeningLines` puts the narrator first and last for task.
  - A task item whose script does not start and end with `N` fails validation.
- [ ] **Step 2: Run** and confirm FAIL. **Step 3: Implement.** **Step 4: Run** and confirm PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(jlpt): 聽解錄音工具（No.7／剣崎雌雄／きりたん）"`

### Task 12: Listening player and listening screens

**Files:**
- Create: `js/jlpt-player.js`, which defines `window.JLPTPlayer`.
- Modify: `js/jlpt-view.js`, `css/jlpt.css`
- Test: `sync/jlpt-player.test.mjs` (with a fake `Audio` class), `sync/app.test.mjs`

**Interfaces:**
- Produces `JLPTPlayer.play(files: string[], { gapMs = 700, tailMs, onIndex(i), onEnd(), onBlocked() }) -> { stop() }`.
  - Answer time `tailMs` is 8000 for task and point, and 5000 for utterance and response.
  - `onBlocked` fires when `audio.play()` rejects. The view then shows 「點一下開始播放」, and tapping it calls `play` again from the same index.
- Exam mode: the listening section auto-runs.
  - For each 大問: instructions, then the example, then each question's lines and tail. Then it moves to the next question without stopping.
  - There is no pause or replay control.
  - The listening example audio is `listeningLines(example)`, played after the instructions. Its answer is shown filled, and there is no tail.
  - The answer bubbles stay clickable until the next question starts.
  - The listening section ends when the last tail ends.
- Practice mode: there is a play button, and after answering a 「再聽一次」 button.
- utterance and response show no printed choices. response shows only 「－ メモ －」.

- [ ] **Step 1: Write the failing tests.**

```js
test('player：依序播放、句間停頓、結尾作答時間後 onEnd', async () => { /* fake Audio：play() resolve，手動觸發 onended；用假的 setTimeout 時鐘 */ });
test('player：play() 被拒（手機自動播放限制）→ onBlocked，不跳過', async () => { /* fake Audio：play() reject */ });
```

  - App test: in an exam with listening, the listening screen has no `[data-jlpt-pause]` and no replay control, and a response item renders `メモ` with 3 bubbles.
- [ ] **Step 2: Run** and confirm FAIL. **Step 3: Implement.** **Step 4: Run** `npm test` and confirm PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(jlpt): 聽解播放器與聽解畫面"`

### Task 13: Figures (map, calendar, clocks, objects, scenes) and the image tool

**Files:**
- Create or replace the stub: `js/jlpt-figure.js`, which defines `window.JLPTFigure`.
- Create: `tools/jlpt-img.mjs`
- Create: `img/jlpt/objects/`, `img/jlpt/scenes/`
- Test: `sync/jlpt-figure.test.mjs`

**Interfaces:**
- Produces `JLPTFigure.render(fig) -> string`, an HTML/SVG string drawn in black, white and gray only. The `fig` kinds:
  - `{ kind: 'objects', options: [[{ img, n = 1 }, …] × 4] }`: a 2×2 grid of numbered boxes, each showing `img/jlpt/objects/<img>.webp` repeated `n` times.
  - `{ kind: 'map', crossings: 1–3, labels: [{ slot, text }], marks: [{ slot, n }] }`:
    - `slot` is `'<crossing><L|R><a|b>'`, for example `'2Ra'`, the near block right of the 2nd crossing.
    - The layout matches the approved sample: a vertical road, horizontal cross streets, gray blocks, white label boxes, bold numbered boxes, and the 「いま　ここ」 marker at the bottom.
  - `{ kind: 'calendar', month, firstDow: 0–6, days, today, circles: { [day]: n } }`: a two-page week calendar with the numbers on leader lines, as in the sample.
  - `{ kind: 'clocks', options: ['7:30', …] }`: four analog clocks.
  - `{ kind: 'scene', img, arrow: { x, y, dir: 'down-left'|'down-right' } }`:
    - `img/jlpt/scenes/<img>.webp` with an overlaid SVG arrow.
    - The arrow tip sits at fractional coordinates `x`, `y` of the image.
- `tools/jlpt-img.mjs <input> <name> --kind objects|scenes` runs ffmpeg with `format=gray,eq=contrast=1.25:brightness=0.03`.
  - It scales objects to height 240 and scenes to width 900.
  - It writes webp at quality 80 to `img/jlpt/<kind>/<name>.webp`.
- The validator (Task 2) checks that `figure.kind` is known. The build (Task 3) checks that referenced image files exist; when an image is missing the question is dropped, the same as missing audio.

- [ ] **Step 1: Write the failing tests.**
  - `objects` renders 4 `.cell` boxes. `n: 3` repeats the `<img>` 3 times.
  - `map` puts mark `n` text inside the slot box.
  - `calendar` circles exactly the given days.
  - `scene` positions the arrow with `left`/`top` percentages.
  - No output contains a non-gray color. The test greps for `#[0-9a-f]{6}` and checks R = G = B.
- [ ] **Step 2: Run** and confirm FAIL. **Step 3: Implement.** **Step 4: Run** and confirm PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(jlpt): 聽解插圖（程式畫地圖／行事曆／時鐘、物品組合、情境圖箭頭）"`

### Task 14: Listening content batch D, audio and images

**Files:**
- Create: `jlpt-src/n5/d-listening.json`, with practice and mock items.
- Create: `img/jlpt/objects/*.webp`, `img/jlpt/scenes/*.webp`
- Create: `audio/jlpt/*.mp3`
- Create: `jlpt-src/images.md`, a list of each image's source (いらすとや page URL or AI tool and prompt) and date.

- [ ] **Step 1: Author the listening items.**
  - Practice: task 6, point 6, utterance 4, response 6.
  - Mock-only, for 4 mini mocks: task 12, point 12, utterance 8, response 12.
  - Prefer text choices and code-drawn figures (map, calendar, clocks). Keep `objects` and `scene` items to what the images in Step 3 can cover.
- [ ] **Step 2: Independent review** as in Task 4 Step 4. The checklist must include "script matches the figure and the choices".
- [ ] **Step 3: Images.**
  - Scenes: look on いらすとや first, and record each page URL in `images.md`.
  - Objects, and scenes いらすとや lacks: ask the user before each AI batch, showing the list and the expected credits. The Higgsfield free plan allows `z_image` only, at about 0.15 credits per image.
  - Generate one object per image. Reject any image with text-like marks, or mask them.
  - Run everything through `tools/jlpt-img.mjs`. Show the user the processed set.
- [ ] **Step 4: Audio.** Start the VOICEVOX engine, run `node tools/make-jlpt-audio.mjs`, then run `node tools/build-jlpt.mjs`. Expected: no listening question is dropped for missing audio or images.
- [ ] **Step 5: Run** `npm test`. Preview a full mini mock including listening, then the result page and graduation progress. Show the user.
- [ ] **Step 6: Commit.** `git commit -m "content(jlpt): 聽解題、錄音、插圖（已審查）"`

---

## Phase 4 — Wrap-up

### Task 15: Credits, version, docs, release

**Files:**
- Modify: `index.html`
  - The footer gets `VOICEVOX:No.7`, `VOICEVOX:剣崎雌雄`, 「插圖：いらすとや・AI 生成」, and the existing credits.
  - Change `?v=0.14.1` to `0.15.0` everywhere, and the footer `v0.15.0`.
- Modify: `README.md`, adding a JLPT section: the batch workflow, `build-jlpt`, `make-jlpt-audio`, `jlpt-img`, and the review step.
- Modify: `docs/superpowers/specs/2026-09-11-nihongo-notes-design.md`, adding section 「20. JLPT 考試專區（v0.15）」 that links the new spec.
- Modify: `.github/workflows/pages.yml`, only if `audio/jlpt` or `img/jlpt` would not be copied. They will be, because of `cp -R … img audio`, so this is just a check.
- Modify: `D:\CLAUDE D\.claude\launch.json`, removing the `voice-audition` entry.

- [ ] **Step 1: Run** `npm test`. Expected: everything passes.
- [ ] **Step 2: Final preview** at desktop and 375px. Check:
  - `#/`, `#/jlpt`, `#/jlpt/daily`, `#/jlpt/mock` (full mini run) and the result page
  - existing pages `#/course`, `#/review` and `#/life`
  - no console errors
- [ ] **Step 3: Commit.** `git commit -m "chore(jlpt): 出處、版本 0.15.0、文件"`
- [ ] **Step 4: User approval.** Then fetch and fast-forward `main`, merge `jlpt-exam-zone`, and push with `GCM_INTERACTIVE=never GIT_TERMINAL_PROMPT=0 timeout 90 git push origin main`. Verify the deployed site.

---

## After this plan (ongoing, not tasks here)

The bank grows toward 600–800 N5 questions, about 60% practice and 40% mock. It is added in further batches using Task 4's author → independent review → build loop, Task 14's audio and image steps, and user approval for every AI image batch. N4 content waits for the user's decision (spec §8).
