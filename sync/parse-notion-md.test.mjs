// 執行：node --test sync/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePageMarkdown, buildContent } from './parse-notion-md.mjs';

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
