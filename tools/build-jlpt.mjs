// build-jlpt.mjs — 把 jlpt-src/<級數>/*.json 的題目批次建成 data/jlpt.js
//
// 用法：node tools/build-jlpt.mjs
//   • 檢查每一題（js/jlpt-core.js 的 JLPT.validate），有 gen 的題目自動產生選項與干擾選項
//   • 只輸出「已審查」（reviewed 不是 null）批次的題目；聽解缺錄音、缺插圖的題目不輸出
//   • 已審查的題目有錯 → 印出錯誤並以 1 結束；未審查批次的錯誤只當警告
// 批次格式與流程見 jlpt-src/README.md
import { readFile, readdir, writeFile, access } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const W = {};
new Function('window', readFileSync(path.join(root, 'js/jlpt-core.js'), 'utf8'))(W);
const { JLPT } = W;
export const VOICES = { N: 30, M: 21, F: 108 }; // 旁白 No.7（アナウンス）、男 剣崎雌雄、女 東北きりたん

// 可重現的雜湊（FNV-1a）：同一題每次建置的答案位置、干擾選項都一樣
const hash = s => { let h = 0x811c9dc5; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h; };
const place = (answer, distractors, seed) => {
  const pos = hash(seed) % 4, choices = [...distractors.slice(0, 3)];
  choices.splice(pos, 0, answer);
  return { choices, answer: pos + 1 };
};

// ── 漢字讀音的干擾選項 ──
const SEION = 'かきくけこさしすせそたちつてとはひふへほはひふへほ', DAKU = 'がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ';
const VOWEL = { a: 'あかさたなはまやらわがざだばぱゃ', i: 'いきしちにひみりぎじぢびぴ', u: 'うくすつぬふむゆるぐずづぶぷゅ', e: 'えけせてねへめれげぜでべぺ', o: 'おこそとのほもよろをごぞどぼぽょ' };
const vowelOf = ch => Object.keys(VOWEL).find(v => VOWEL[v].includes(ch));
const SIMILAR = { し: 'ち', ち: 'し', す: 'つ', つ: 'す', じ: 'ぢ', ぬ: 'む', む: 'ぬ', れ: 'ね', ね: 'れ' };
const SMALL = { ゃ: 'や', ゅ: 'ゆ', ょ: 'よ', や: 'ゃ', ゆ: 'ゅ', よ: 'ょ' };
const STOPS = 'かきくけこさしすせそたちつてとぱぴぷぺぽ';
function readingVariants(r) {
  const s = [...r], lists = [[], [], [], [], []];
  const put = (i, arr) => lists[i].push(arr.join(''));
  s.forEach((ch, i) => {
    // 清濁（は行三種都試）
    for (let k = 0; k < SEION.length; k++) {
      if (SEION[k] === ch) { const t = [...s]; t[i] = DAKU[k]; put(0, t); }
      if (DAKU[k] === ch) { const t = [...s]; t[i] = SEION[k]; put(0, t); }
    }
    // 長短音
    const v = vowelOf(ch);
    if ((v === 'o' || v === 'u') && s[i + 1] !== 'う') { const t = [...s]; t.splice(i + 1, 0, 'う'); put(1, t); }
    if (v === 'e' && s[i + 1] !== 'い') { const t = [...s]; t.splice(i + 1, 0, 'い'); put(1, t); }
    if (i > 0 && ((ch === 'う' && ['o', 'u'].includes(vowelOf(s[i - 1]))) || (ch === 'い' && ['e', 'i'].includes(vowelOf(s[i - 1]))))) { const t = [...s]; t.splice(i, 1); put(1, t); }
    // 促音
    if (ch === 'っ') { const t = [...s]; t.splice(i, 1); put(2, t); }
    else if (i > 0 && STOPS.includes(ch) && !'っんー'.includes(s[i - 1])) { const t = [...s]; t.splice(i, 0, 'っ'); put(2, t); }
    // 拗音大小
    if (SMALL[ch] && i > 0) { const t = [...s]; t[i] = SMALL[ch]; put(3, t); }
    if (SIMILAR[ch]) { const t = [...s]; t[i] = SIMILAR[ch]; put(4, t); }
  });
  const out = [];
  for (let i = 0; lists.some(l => i < l.length); i++) for (const l of lists) if (i < l.length) out.push(l[i]);
  return out;
}
// 一個詞所有合法的讀音（單字表的讀音；單一漢字再加上音讀、訓讀）
function realReadings(word, reading, vocab, kanji) {
  const set = new Set([reading, ...vocab.filter(v => v.word === word).map(v => v.reading)]);
  if ([...word].length === 1) {
    const k = kanji.find(x => x.k === word);
    if (k) { k.on.forEach(o => set.add(o)); k.kun.forEach(([stem, okuri = '']) => { set.add(stem); set.add(stem + okuri); }); }
  }
  return set;
}
const kanjiReadings = k => new Set([...k.on, ...k.kun.map(([s]) => s)]);
const BAD_START = /^[っんーゃゅょぁぃぅぇぉ]/;

export function genChoices(word, reading, type, vocab, kanji, seed = word) {
  const distractors = [];
  const add = c => { if (c && !distractors.includes(c)) distractors.push(c); };
  if (type === 'kanji_reading') {
    const real = realReadings(word, reading, vocab, kanji);
    for (const c of readingVariants(reading)) if (!real.has(c) && !BAD_START.test(c) && distractors.length < 3) add(c);
    // 變化不夠時，用其他單字的讀音補（同長度優先，再放寬到 ±1 拍）
    const len = [...reading].length, gap = v => Math.abs([...v.reading].length - len);
    const others = vocab.filter(v => v.reading && /^[ぁ-ゖー]+$/.test(v.reading) && !real.has(v.reading) && gap(v) <= 1)
      .sort((a, b) => gap(a) - gap(b) || hash(seed + a.reading) - hash(seed + b.reading));
    for (const v of others) if (distractors.length < 3) add(v.reading);
    return place(reading, distractors, seed);
  }
  if (type === 'orthography') {
    const chars = [...word], byK = new Map(kanji.map(k => [k.k, k]));
    const words = new Set(vocab.map(v => v.word));
    const pool = kanji.filter(k => k.level === 'N5' || k.level === 'N4');
    const cands = chars.map(ch => {
      const k = byK.get(ch); if (!k) return [];
      const mine = kanjiReadings(k);
      return pool.filter(o => o.k !== ch && Math.abs(o.strokes - k.strokes) <= 1 && ![...kanjiReadings(o)].some(r => mine.has(r)))
        .sort((a, b) => Math.abs(a.strokes - k.strokes) - Math.abs(b.strokes - k.strokes) || hash(seed + a.k) - hash(seed + b.k)).map(o => o.k);
    });
    const sub = subs => chars.map((c, i) => subs[i] ?? c).join('');
    const tryAdd = w => { if (w !== word && !words.has(w) && distractors.length < 3) add(w); };
    const pos = cands.map((l, i) => l.length ? i : -1).filter(i => i >= 0);
    for (let r = 0; distractors.length < 3 && pos.some(p => r < cands[p].length); r++) {
      for (const p of pos) if (r < cands[p].length) tryAdd(sub({ [p]: cands[p][r] }));
      if (pos.length >= 2 && r < Math.min(...pos.map(p => cands[p].length))) tryAdd(sub(Object.fromEntries(pos.map(p => [p, cands[p][r]]))));
    }
    // 不夠時：同級隨機漢字
    const rest = pool.filter(o => !chars.includes(o.k)).sort((a, b) => hash(seed + a.k) - hash(seed + b.k));
    for (const o of rest) { if (distractors.length >= 3 || !pos.length) break; tryAdd(sub({ [pos[0]]: o.k })); }
    return place(word, distractors, seed);
  }
  throw new Error(`gen 只支援 kanji_reading、orthography：${type}`);
}

// ── 建置一個級數 ──
const PASSAGE_SECTION = { text_grammar: 'grammar', reading_short: 'reading', reading_mid: 'reading', info_search: 'reading' };
export function buildLevel(batches, ctx, { audioExists = () => false, imageExists = () => true } = {}) {
  const errors = [], warnings = [], questions = [], passages = {}, checkedPassages = new Set();
  for (const b of batches) for (const [pid, p] of Object.entries(b.passages || {})) {
    if (passages[pid]) (b.reviewed ? errors : warnings).push(`${b.batch}/passage ${pid}: 文章 id 重複`);
    passages[pid] = { ...p, id: pid, level: b.level };
  }
  for (const b of batches) {
    const report = b.reviewed ? errors : warnings;
    for (const raw of b.questions || []) {
      const q = { ...raw, level: raw.level || b.level, rev: raw.rev ?? 1 };
      const t = JLPT.TYPES[q.type];
      if (t) q.section ??= t.section;
      if (q.example && !q.pool) q.pool = 'practice';
      const errs = [];
      if (raw.gen) {
        if (!['kanji_reading', 'orthography'].includes(q.type)) errs.push('gen 只能用在漢字讀音、表記');
        else Object.assign(q, genChoices(raw.gen.word, raw.gen.reading, q.type, ctx.vocab, ctx.kanji, q.id));
        delete q.gen;
      }
      errs.push(...JLPT.validate(q, ctx));
      if (q.id) ctx.ids.add(q.id);
      if (q.passage) {
        const p = passages[q.passage];
        if (!p) errs.push(`引用不存在的文章 ${q.passage}`);
        else if (!checkedPassages.has(q.passage)) {
          checkedPassages.add(q.passage);
          for (const e of JLPT.textErrors(p.stem, PASSAGE_SECTION[q.type] || 'reading', q.level, ctx)) report.push(`${b.batch}/passage ${q.passage}: ${e}`);
        }
      }
      if (q.figure && !imageExists(q)) errs.push('插圖檔不存在');
      if (errs.length) { report.push(...errs.map(e => `${b.batch}/${q.id}: ${e}`)); continue; }
      if (!b.reviewed) continue;
      if (q.section === 'listening' && !audioExists(q)) continue;
      questions.push({ ...q, batch: b.batch });
    }
  }
  const used = new Set(questions.map(q => q.passage).filter(Boolean));
  return { questions, passages: Object.fromEntries(Object.entries(passages).filter(([id]) => used.has(id))), errors, warnings };
}

// ── CLI ──
const exists = f => access(f).then(() => true, () => false);
async function loadData() {
  const w = {};
  for (const f of ['data/external.js', 'data/kanji.js', 'data/content.js']) new Function('window', await readFile(path.join(root, f), 'utf8'))(w);
  const kanji = [...w.NIHONGO_KANJI.kanji];
  const vocab = [...w.NIHONGO_EXTERNAL.vocab, ...w.NIHONGO_DATA.vocab];
  return { vocab, kanji, kanjiLevel: new Map(kanji.map(k => [k.k, k.level])), ids: new Set() };
}
async function main() {
  const ctx = await loadData(), levels = {};
  let blocking = 0;
  const srcRoot = path.join(root, 'jlpt-src');
  for (const level of JLPT.LEVELS) {
    const dir = path.join(srcRoot, level.toLowerCase());
    if (!(await exists(dir))) continue;
    const files = (await readdir(dir)).filter(f => f.endsWith('.json')).sort();
    const batches = [];
    for (const f of files) batches.push({ batch: f.replace(/\.json$/, ''), ...JSON.parse(await readFile(path.join(dir, f), 'utf8')) });
    // 錄音、插圖檢查在 tools/make-jlpt-audio.mjs、tools/jlpt-img.mjs 完成後接上（見實作計畫 Task 11、13）
    const out = buildLevel(batches, ctx, {});
    for (const w of out.warnings) console.warn('警告（未審查）', w);
    for (const e of out.errors) console.error('錯誤', e);
    blocking += out.errors.length;
    levels[level] = { questions: out.questions, passages: out.passages };
    const count = {};
    for (const q of out.questions) { const k = `${q.example ? 'example' : q.pool}/${q.type}`; count[k] = (count[k] || 0) + 1; }
    console.log(`${level}：${out.questions.length} 題（${files.length} 個批次）`, count);
  }
  const js = `// 由 tools/build-jlpt.mjs 產生，請勿手動編輯。題目來源：jlpt-src/\nwindow.NIHONGO_JLPT = ${JSON.stringify({ builtAt: new Date().toISOString(), voices: VOICES, levels })};\n`;
  await writeFile(path.join(root, 'data', 'jlpt.js'), js, 'utf8');
  if (blocking) { console.error(`有 ${blocking} 個錯誤（已審查的題目），請修正後重新建置`); process.exit(1); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e); process.exit(1); });
