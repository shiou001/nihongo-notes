// 執行：node --test sync/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePageMarkdown, buildContent, stripInline, tableDrills } from './parse-notion-md.mjs';
import { richText, absoluteHref } from './notion-richtext.mjs';

const cacheDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'cache');
const files = (await readdir(cacheDir)).filter(f => f.endsWith('.md'));
const mds = await Promise.all(files.map(f => readFile(path.join(cacheDir, f), 'utf8')));
const content = buildContent(mds, '2026-01-01T00:00:00Z');

test('解析 8 個頁面並移除導航段落', () => {
  assert.equal(content.pages.length, 8);
  for (const p of content.pages) {
    assert.ok(p.title, 'title');
    assert.ok(!p.sections.some(s => s.heading.includes('快速導航')));
    assert.ok(!p.sections.some(s => s.heading.includes('本頁索引')));
  }
});

test('單字：等級判定與去重', () => {
  const byLevel = Object.groupBy(content.vocab, v => v.level);
  assert.equal(byLevel.N5.length, 45);
  assert.equal(byLevel.N4.length, 10);
  assert.equal(byLevel.N3.length, 10);
  assert.ok(byLevel.N2.length >= 38, 'N2 含 あ行/い行 + 補充表');
  assert.equal(byLevel.N1.length, 10);
  assert.ok(byLevel['筆記'].length >= 30, '詞彙整理 + 閱讀單字');
  const taberu = content.vocab.find(v => v.word === '食べる');
  assert.equal(taberu.pos, '動詞');
  assert.equal(taberu.level, 'N5');
  // 同一字同等級只出現一次（N2 頁面尾端重複表格）
  const akubi = content.vocab.filter(v => v.word === '欠伸' && v.level === 'N2');
  assert.equal(akubi.length, 1);
  assert.equal(akubi[0].pitch, '0');
});

test('文法：句型、疑問詞、助詞、活用表', () => {
  const pats = content.grammar.map(g => g.pattern);
  assert.ok(pats.includes('〜ながら'));
  assert.ok(pats.includes('どこ'));
  assert.ok(pats.includes('は'));
  assert.ok(pats.includes('あったら'));
  assert.ok(pats.includes('教えて'));
});

test('會話：打招呼與敬語', () => {
  const jps = content.phrases.map(p => p.jp);
  assert.ok(jps.includes('こんにちは'));
  assert.ok(jps.includes('いただきます'));
  const kg = content.phrases.find(p => p.jp === 'いただきます');
  assert.equal(kg.category, '敬語');
  assert.equal(kg.zh, '我開動了！');
});

test('五十音：46 清音 + 濁音 + 拗音', () => {
  assert.ok(content.kana.length >= 100);
  const a = content.kana.find(k => k.hira === 'あ');
  assert.equal(a.romaji, 'a');
  assert.equal(a.kata, 'ア');
  assert.equal(a.group, '清音');
});

test('每個 id 唯一', () => {
  const ids = [...content.vocab, ...content.grammar, ...content.phrases, ...content.kana].map(x => x.id);
  assert.equal(new Set(ids).size, ids.length);
});

// ---- Notion rich_text → Markdown ----
const rt = (plain_text, extra = {}) => ({ type: 'text', plain_text, annotations: {}, href: null, ...extra });

test('一般文字連結會保留（以前只保留 mention）', () => {
  assert.equal(richText([rt('看這裡', { href: 'https://example.com/a' })]), '[看這裡](https://example.com/a)');
});

test('Notion 內部相對路徑補成完整網址', () => {
  assert.equal(absoluteHref('/36fd77857287818a97cdc3cd708e37be'), 'https://www.notion.so/36fd77857287818a97cdc3cd708e37be');
  assert.equal(richText([rt('文法筆記', { type: 'mention', href: '/36fd7785' })]), '[文法筆記](https://www.notion.so/36fd7785)');
});

test('粗體、粗體連結、看不懂的連結', () => {
  assert.equal(richText([rt('私'), rt('は', { annotations: { bold: true } })]), '私**は**');
  assert.equal(richText([rt('重點', { annotations: { bold: true }, href: 'https://x.io' })]), '[**重點**](https://x.io)');
  assert.equal(richText([rt('怪', { href: 'javascript:alert(1)' })]), '怪');
  assert.equal(richText([rt(''), { plain_text: undefined }]), '');
});

test('出題欄位會拿掉連結和粗體標記，只留文字', () => {
  assert.equal(stripInline('[**綺麗**](https://www.notion.so/abc)（な）'), '綺麗（な）');
  assert.equal(stripInline('私**は**学生'), '私は学生');
});

test('表格裡帶連結的單字，進測驗時是乾淨的文字', () => {
  const md = ['---', 'id: t', 'title: 測試', '---', '## 🌟 N5', '<table header-row="true">',
    '<tr><td>單字</td><td>讀音</td><td>意思</td></tr>',
    '<tr><td>[水](https://www.notion.so/x)</td><td>みず</td><td>**水**</td></tr>', '</table>'].join('\n');
  const c = buildContent([md]);
  assert.equal(c.vocab[0].word, '水');
  assert.equal(c.vocab[0].meaning, '水');
  assert.equal(c.vocab[0].level, 'N5');
});

test('通用對照表：意思題與變換題（連體修飾），句型配例句不當變換題', () => {
  const T = (headers, rows) => ({ type: 'table', headers, rows });
  const past = tableDrills(T(['現在', '過去', '意思（過去）'], [['食べる とき', '食べた とき', '吃的時候'], ['寒い 一日', '寒かった 一日', '寒冷的一天']]));
  assert.deepEqual(past.filter(d => d.kind === 'transform').map(d => [d.prompt, d.answer, d.ask]), [['食べる とき', '食べた とき', '過去'], ['寒い 一日', '寒かった 一日', '過去']]);
  assert.deepEqual(past.filter(d => d.kind === 'meaning').map(d => [d.prompt, d.answer]), [['食べた とき', '吃的時候'], ['寒かった 一日', '寒冷的一天']]);
  // 「い形容詞」只有一個假名，算中文說明；只有一欄日文就沒有變換題
  const kinds = tableDrills(T(['詞類', '例子', '意思'], [['い形容詞', '寒い 一日', '寒冷的一天'], ['な形容詞', '好きな 人', '喜歡的人']]));
  assert.deepEqual(kinds.map(d => d.kind), ['meaning', 'meaning']);
  // 句尾配例句是包含關係，不是變換
  assert.equal(tableDrills(T(['語氣', '句尾', '例子'], [['肯定', 'です', '学生です。'], ['疑問', 'ですか', '学生ですか。']])).length, 0);
  // 羅馬拼音欄不算日文；表頭空白（比較表）不出題
  assert.equal(tableDrills(T(['例字', '讀音', '意思'], [['がっこう', 'gakkou', '學校'], ['ざっし', 'zasshi', '雜誌']])).filter(d => d.from === '讀音').length, 0);
  assert.equal(tableDrills(T(['', 'いただきます', 'ごちそうさまでした'], [['時機', '飯前', '飯後'], ['意思', '開動', '吃飽']])).length, 0);
});

test('真實筆記：連體修飾段落的五張表都會出題，專用規則認得的表不重複出', () => {
  const rentai = content.drills.filter(d => d.source.includes('連體修飾'));
  assert.ok(rentai.filter(d => d.kind === 'transform').length >= 6, '變換題 ' + rentai.length);
  assert.ok(rentai.some(d => d.prompt === '母が買った果物を食べました。' && d.answer === '母の買った果物を食べました。'));
  assert.ok(content.drills.every(d => d.id.startsWith('d_') && d.prompt && d.answer && d.group));
  assert.ok(!content.drills.some(d => d.source.includes('單字分級')), '單字表交給單字規則');
});
