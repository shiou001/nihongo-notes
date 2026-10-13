// curriculum.js — 把 data/curriculum.js 的大綱變成實際的單元清單
//
// 每個單元 = 讀（筆記段落）＋ 練（題目）＋ 達標（80% 的題目最近一次答對）。
// 一級的順序：大綱單元 → Notion 新筆記（大綱還沒寫到的段落）→ 生活主題穿插其中，
// 每個單元後面再接單字課、漢字課（由程式依等級自動切出來）。
// 「已讀」標記存在 Progress.items 裡（id 是 u_<單元 key>），所以會跟著跨裝置同步。
window.Curriculum = (() => {
  const D = () => window.NIHONGO_DATA || {};
  const C = () => window.NIHONGO_CURRICULUM || { levels: {} };
  const LIFE = () => window.NIHONGO_LIFE?.topics || [];
  const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
  const KIND_ICON = { 假名: '🈁', 發音: '🎵', 會話: '💬', 文法: '📝', 單字: '📦', 閱讀: '📚', 漢字: '🀄', 生活: '🗾', 筆記: '🆕' };
  const POOLS = ['vocab', 'grammar', 'phrases', 'drills'];

  const page = title => (D().pages || []).find(p => p.title === title);
  const cleanTitle = s => String(s || '').replace(/^[\s\p{Extended_Pictographic}️‍]+/u, '').trim();
  const hash = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); };

  // 段落：關鍵字留空 → 整頁；否則找標題含關鍵字的段落，連同它底下的子段落
  function sections([title, key = '']) {
    const p = page(title);
    if (!p) return [];
    const wrap = (s, i) => ({ page: p, section: s, index: i });
    if (!key) return p.sections.map(wrap);
    const start = p.sections.findIndex(s => s.heading.includes(key));
    if (start < 0) return [];
    const out = [wrap(p.sections[start], start)];
    const lvl = p.sections[start].level;
    for (let i = start + 1; i < p.sections.length && p.sections[i].level > lvl; i++) out.push(wrap(p.sections[i], i));
    return out;
  }

  // 題目：出處字串是「頁面 › 段落 [› 子段落]」，用頁面前綴 + 關鍵字比對
  function itemsFor(refs) {
    const out = emptyItems();
    for (const [title, key = ''] of refs || []) {
      for (const k of POOLS) {
        for (const x of D()[k] || []) {
          if (x.source?.startsWith(title + ' › ') && (!key || x.source.includes(key)) && !out[k].includes(x)) out[k].push(x);
        }
      }
    }
    return out;
  }

  const chunk = (arr, n) => { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o; };
  const emptyItems = () => ({ vocab: [], grammar: [], phrases: [], drills: [] });
  const itemList = items => POOLS.flatMap(k => items[k] || []);

  function declaredUnits(level) {
    return (C().levels?.[level] || []).map(u => ({
      key: `${level}-${u.id}`, level, id: u.id, kind: u.kind || '單元', icon: KIND_ICON[u.kind] || '📘',
      title: u.title, desc: u.desc || '', read: u.read || [],
      items: itemsFor(u.practice), kana: u.kana ? (D().kana || []).filter(k => u.kana.includes(k.group)) : [],
      kanji: [], readOnly: !u.practice && !u.kana, auto: '',
    }));
  }

  // ── Notion 新筆記：大綱還沒寫到、也不在單字課裡的段落，自動變成單元 ──
  // 這樣你在 Notion 加新段落，隔天同步後就會出現在課程裡，不用先改 data/curriculum.js。
  const PAGE_KIND = { 詞彙整理: '單字', 文法筆記: '文法', 常用會話: '會話', 閱讀練習: '閱讀', 發音與假名: '發音', 五十音圖表: '假名', 敬語表現: '會話' };
  const LEVEL_RE = /\bN([1-5])\b/;
  function notesUnits() {
    const covered = new Set();
    for (const level of LEVELS) for (const u of C().levels?.[level] || []) itemList(itemsFor(u.practice)).forEach(x => covered.add(x.id));
    const out = [];
    for (const p of D().pages || []) {
      if (p.external || p.life) continue;
      const heads = p.sections.filter(s => s.level <= 2 && s.heading);
      for (const s of heads) {
        const prefix = `${p.title} › ${s.heading}`;
        const mine = x => x.source === prefix || x.source?.startsWith(prefix + ' › ');
        const items = emptyItems();
        for (const k of POOLS) items[k] = (D()[k] || []).filter(x => mine(x) && !covered.has(x.id) && !(k === 'vocab' && LEVELS.includes(x.level)));
        const list = itemList(items);
        if (!list.length) continue;
        const m = s.heading.match(LEVEL_RE);
        const level = m ? 'N' + m[1] : C().newNotesLevel || 'N5';
        const kind = PAGE_KIND[p.title] || '筆記';
        out.push({
          key: `${level}-notes-${hash(prefix)}`, level, id: 'notes-' + hash(prefix), kind, icon: KIND_ICON[kind] || KIND_ICON['筆記'],
          title: cleanTitle(s.heading), desc: `你在 Notion「${p.title}」寫的段落，同步後自動排進課程。`, read: [[p.title, s.heading]],
          items, kana: [], kanji: [], readOnly: false, auto: 'notes', fresh: true,
        });
      }
    }
    return out;
  }

  // ── 生活主題（data/life.js）：每個主題一個單元；題目由 js/data-merge.js 整理好放在 t.items ──
  function lifeUnits(level) {
    return LIFE().filter(t => t.level === level).map(t => ({
      key: `${level}-life-${t.id}`, level, id: 'life-' + t.id, kind: '生活', icon: KIND_ICON['生活'], theme: t.theme,
      title: t.title, desc: t.desc || '', read: [], topic: t,
      items: t.items || emptyItems(), kana: [], kanji: [], readOnly: false, auto: 'life',
    }));
  }
  const LIFE_PAGE = '生活日本';

  function build(level) {
    const c = C();
    // 主線：大綱單元 → Notion 新筆記；生活主題每隔 lifeEvery 個單元插一個
    const main = [...declaredUnits(level), ...notesCache().filter(u => u.level === level)];
    const life = lifeUnits(level), every = c.lifeEvery ?? 2;
    const units = [];
    let li = 0;
    main.forEach((u, i) => { units.push(u); if ((i + 1) % every === 0 && li < life.length) units.push(life[li++]); });
    const rest = life.slice(li);   // 大綱單元太少放不下的主題，穿插在後面的單字課之間

    // 單字課：你的筆記優先，再接公開單字（生活主題的單字已在主題單元裡）
    const vocab = (D().vocab || []).filter(v => v.level === level && v.origin !== 'life').sort((a, b) => (a.origin === 'external') - (b.origin === 'external'));
    const vLessons = chunk(vocab, c.vocabPerLesson || 20).map((ws, i) => ({
      key: `${level}-vocab-${i + 1}`, level, id: `vocab-${i + 1}`, kind: '單字', icon: KIND_ICON['單字'],
      title: `${level} 單字 第 ${i + 1} 課`, desc: `${ws[0].word}、${ws[1]?.word || ''}… 共 ${ws.length} 個`, read: [],
      items: { ...emptyItems(), vocab: ws }, kana: [], kanji: [], readOnly: false, auto: 'vocab',
    }));
    const kanji = (D().kanji || []).filter(k => k.level === level);
    const kLessons = chunk(kanji, c.kanjiPerLesson || 12).map((ks, i) => ({
      key: `${level}-kanji-${i + 1}`, level, id: `kanji-${i + 1}`, kind: '漢字', icon: KIND_ICON['漢字'],
      title: `${level} 漢字 第 ${i + 1} 課`, desc: ks.map(k => k.k).join(' '), read: [],
      items: emptyItems(), kana: [], kanji: ks, readOnly: false, auto: 'kanji',
    }));
    // 穿插：每個單元（生活主題除外）後面接幾課單字、幾課漢字，剩下的排在最後
    const out = [];
    let vi = 0, ki = 0;
    const take = () => {
      for (let n = 0; n < (c.vocabBetweenUnits ?? 2) && vi < vLessons.length; n++) out.push(vLessons[vi++]);
      for (let n = 0; n < (c.kanjiBetweenUnits ?? 1) && ki < kLessons.length; n++) out.push(kLessons[ki++]);
    };
    for (const u of units) { out.push(u); if (u.auto !== 'life') take(); }
    while (vi < vLessons.length || ki < kLessons.length) { take(); if (rest.length) out.push(rest.shift()); }
    out.push(...rest);
    out.forEach((u, i) => { u.index = i + 1; u.total = out.length; });
    return out;
  }

  // 資料（Notion 同步）沒變就不用重算
  let cache = {}, cacheKey = '', notes = null;
  const notesCache = () => (notes ||= notesUnits());
  function all(level) {
    const k = `${D().syncedAt}|${(D().vocab || []).length}|${(D().kanji || []).length}|${(D().drills || []).length}|${LIFE().length}`;
    if (k !== cacheKey) { cache = {}; notes = null; cacheKey = k; }
    return cache[level] ||= build(level);
  }
  function get(key) {
    const level = String(key || '').split('-')[0];
    return LEVELS.includes(level) ? all(level).find(u => u.key === key) || null : null;
  }
  // Notion 新筆記單元（所有等級），給今日頁提醒用
  function freshUnits() { LEVELS.forEach(all); return notesCache(); }

  // 漢字課的「詞裡的讀音」題：每個字只取前幾個詞（你的筆記優先），不然「日」一個字就有 28 個詞，一課會太重
  const kanjiWords = u => {
    const set = new Set((u.kanji || []).map(k => k.k));
    if (!set.size) return [];
    const cap = C().wordsPerKanji ?? 1, count = {};
    return (D().kanjiWords || []).filter(w => set.has(w.ch) && (count[w.ch] = (count[w.ch] || 0) + 1) <= cap);
  };
  // 這個單元會出的題目 id（漢字拆成音讀、訓讀兩題）
  function questionIds(u) {
    const ids = [...itemList(u.items), ...u.kana].map(x => x.id);
    for (const k of u.kanji || []) { if (k.on?.length) ids.push(k.id + ':on'); if (k.kun?.length) ids.push(k.id + ':kun'); }
    for (const w of kanjiWords(u)) ids.push(w.id);
    return ids;
  }
  const readMark = u => 'u_' + u.key;

  // 單元狀態：done（達標）／active（碰過）／todo
  function stats(u) {
    const ids = questionIds(u);
    const S = ids.map(id => Progress.stat(id));
    const learned = S.filter(s => s.seen > 0 && s.streak > 0).length;
    const mastered = S.filter(Quiz.isMastered).length;
    const weak = S.filter(Quiz.isWeak).length;
    const seen = S.filter(s => s.seen > 0).length;
    const read = Progress.stat(readMark(u)).seen > 0;
    const total = ids.length;
    const pct = total ? Math.round(learned / total * 100) : (read ? 100 : 0);
    const done = u.readOnly ? read : total > 0 && pct >= 80;
    return { total, learned, mastered, weak, seen, read, pct, done, status: done ? 'done' : (seen || read) ? 'active' : 'todo' };
  }
  function markRead(u) { Progress.record(readMark(u), true); }

  // 目前單元 = 這一級第一個還沒達標的
  function current(level) {
    const list = all(level);
    return list.find(u => !stats(u).done) || list[list.length - 1] || null;
  }
  function levelSummary(level) {
    const list = all(level);
    const done = list.filter(u => stats(u).done).length;
    return { total: list.length, done, pct: list.length ? Math.round(done / list.length * 100) : 0 };
  }

  // 單元練習的出題設定：題型看單元裡有什麼，範圍用 ids 鎖住
  function quizOpts(u, extra = {}) {
    const types = [];
    if (u.items.vocab.length) types.push('vocab_meaning', 'vocab_reading', 'vocab_recall');
    if (u.items.grammar.length) types.push('grammar', 'grammar_cloze');
    if (u.items.phrases.length) types.push('phrase');
    if (u.items.drills.some(d => d.kind === 'meaning')) types.push('drill_meaning');
    if (u.items.drills.some(d => d.kind === 'transform')) types.push('drill_transform');
    if (u.kana.length) types.push('kana');
    if (u.kanji?.length) { types.push('kanji_on', 'kanji_kun'); if (kanjiWords(u).length) types.push('kanji_word'); }
    const ids = new Set([...itemList(u.items), ...u.kana, ...(u.kanji || []), ...kanjiWords(u)].map(x => x.id));
    return { types, ids, count: 10, ...extra };
  }

  // 小遊戲用的「題目 ↔ 答案」配對：單字、會話、對照表、假名、漢字都可以
  function pairs(u) {
    const out = [
      ...u.items.vocab.map(v => ({ id: v.id, jp: v.word, sub: v.reading !== v.word ? v.reading : '', zh: v.meaning, say: v.reading || v.word })),
      ...u.items.phrases.map(p => ({ id: p.id, jp: p.jp, sub: '', zh: p.zh, say: p.jp })),
      ...u.items.drills.filter(d => d.kind === 'meaning').map(d => ({ id: d.id, jp: d.prompt, sub: '', zh: d.answer, say: d.prompt })),
      ...u.items.grammar.map(g => ({ id: g.id, jp: g.pattern, sub: '', zh: g.meaning, say: g.pattern.replace(/[〜～]/g, '') })),
      ...u.kana.map(k => ({ id: k.id, jp: k.hira, sub: k.kata, zh: k.romaji, say: k.hira })),
      ...(u.kanji || []).filter(k => k.on?.length).map(k => ({ id: k.id + ':on', jp: k.k, sub: '', zh: Quiz.onText(k), say: k.k })),
    ];
    // 同一個答案只留一組，免得配對時兩張卡都對
    const seen = new Set();
    return out.filter(p => p.jp && p.zh && !seen.has(p.zh) && seen.add(p.zh));
  }

  return { LEVELS, KIND_ICON, LIFE_PAGE, all, get, stats, current, levelSummary, quizOpts, markRead, questionIds, sections, kanjiWords, pairs, freshUnits };
})();
