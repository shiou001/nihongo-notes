// data-merge.js — 把外部公開單字（data/external.js）併進 Notion 資料（data/content.js）
// 規則：同一個字、同讀音、同等級，以你 Notion 的版本為準；其他外部單字加進來，
//      並多一個「🌐 JLPT 公開單字」筆記頁，可以瀏覽和搜尋。
(() => {
  const D = window.NIHONGO_DATA, X = window.NIHONGO_EXTERNAL;
  if (!D) return;
  for (const v of D.vocab) v.origin ||= 'notion';
  if (!X || !Array.isArray(X.vocab) || !X.vocab.length) return;

  const key = v => `${v.word}\t${v.reading}\t${v.level}`;
  const have = new Set(D.vocab.map(key));
  const added = X.vocab.filter(v => !have.has(key(v)));
  D.vocab.push(...added);

  const levels = [...new Set(added.map(v => v.level))];
  D.pages.push({
    id: 'external-vocab', title: 'JLPT 公開單字', icon: '🌐', edited: X.builtAt, external: true,
    sections: [
      { heading: '關於這份資料', level: 2, blocks: [
        { type: 'para', text: '單字、讀音與英文解釋來自 [tanos.co.uk](http://www.tanos.co.uk/jlpt/) 的 JLPT 單字表（CC BY），經 [open-anki-jlpt-decks](https://github.com/jamsinclair/open-anki-jlpt-decks) 整理。' },
        { type: 'quote', text: '中文解釋是 AI 翻譯的，可能有不精確的地方。測驗答完會同時顯示英文原文，可以對照。' },
      ] },
      ...levels.map(l => ({ heading: `🌟 ${l}`, level: 2, blocks: [
        { type: 'table', headers: ['單字', '讀音', '意思', '英文'],
          rows: added.filter(v => v.level === l).map(v => [v.word, v.reading, v.meaning, v.meaningEn || '']) },
      ] })),
    ],
  });
})();
