// curriculum.js — 把 data/curriculum.js 的大綱變成實際的單元清單
//
// 每個單元 = 讀（筆記段落）＋ 練（題目）＋ 達標（80% 的題目最近一次答對）。
// 單字課、漢字課由程式依等級自動切出來，穿插在大綱的單元之間。
// 「已讀」標記存在 Progress.items 裡（id 是 u_<單元 key>），所以會跟著跨裝置同步。
window.Curriculum = (() => {
  const D = () => window.NIHONGO_DATA || {};
  const C = () => window.NIHONGO_CURRICULUM || { levels: {} };
  const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
  const KIND_ICON = { 假名: '🈁', 發音: '🎵', 會話: '💬', 文法: '📝', 單字: '📦', 閱讀: '📚', 漢字: '🀄' };

  const page = title => (D().pages || []).find(p => p.title === title);

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
    const out = { vocab: [], grammar: [], phrases: [] };
    for (const [title, key = ''] of refs || []) {
      for (const k of Object.keys(out)) {
        for (const x of D()[k] || []) {
          if (x.source?.startsWith(title + ' › ') && (!key || x.source.includes(key)) && !out[k].includes(x)) out[k].push(x);
        }
      }
    }
    return out;
  }

  const chunk = (arr, n) => { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o; };
  const emptyItems = () => ({ vocab: [], grammar: [], phrases: [] });

  function build(level) {
    const c = C();
    const declared = (c.levels?.[level] || []).map(u => ({
      key: `${level}-${u.id}`, level, id: u.id, kind: u.kind || '單元', icon: KIND_ICON[u.kind] || '📘',
      title: u.title, desc: u.desc || '', read: u.read || [],
      items: itemsFor(u.practice), kana: u.kana ? (D().kana || []).filter(k => u.kana.includes(k.group)) : [],
      kanji: [], readOnly: !u.practice && !u.kana, auto: '',
    }));
    // 單字課：你的筆記優先，再接公開單字
    const vocab = (D().vocab || []).filter(v => v.level === level).sort((a, b) => (a.origin === 'external') - (b.origin === 'external'));
    const vLessons = chunk(vocab, c.vocabPerLesson || 20).map((ws, i) => ({
      key: `${level}-vocab-${i + 1}`, level, id: `vocab-${i + 1}`, kind: '單字', icon: KIND_ICON['單字'],
      title: `${level} 單字 第 ${i + 1} 課`, desc: `${ws[0].word}、${ws[1]?.word || ''}… 共 ${ws.length} 個`, read: [],
      items: { vocab: ws, grammar: [], phrases: [] }, kana: [], kanji: [], readOnly: false, auto: 'vocab',
    }));
    const kanji = (D().kanji || []).filter(k => k.level === level);
    const kLessons = chunk(kanji, c.kanjiPerLesson || 12).map((ks, i) => ({
      key: `${level}-kanji-${i + 1}`, level, id: `kanji-${i + 1}`, kind: '漢字', icon: KIND_ICON['漢字'],
      title: `${level} 漢字 第 ${i + 1} 課`, desc: ks.map(k => k.k).join(' '), read: [],
      items: emptyItems(), kana: [], kanji: ks, readOnly: false, auto: 'kanji',
    }));
    // 穿插：每個大綱單元後面接幾課單字、幾課漢字，剩下的排在最後
    const out = [];
    let vi = 0, ki = 0;
    const take = () => {
      for (let n = 0; n < (c.vocabBetweenUnits ?? 2) && vi < vLessons.length; n++) out.push(vLessons[vi++]);
      for (let n = 0; n < (c.kanjiBetweenUnits ?? 1) && ki < kLessons.length; n++) out.push(kLessons[ki++]);
    };
    for (const u of declared) { out.push(u); take(); }
    while (vi < vLessons.length || ki < kLessons.length) take();
    out.forEach((u, i) => { u.index = i + 1; u.total = out.length; });
    return out;
  }

  // 資料（Notion 同步）沒變就不用重算
  let cache = {}, cacheKey = '';
  function all(level) {
    const k = `${D().syncedAt}|${(D().vocab || []).length}|${(D().kanji || []).length}`;
    if (k !== cacheKey) { cache = {}; cacheKey = k; }
    return cache[level] ||= build(level);
  }
  function get(key) {
    const level = String(key || '').split('-')[0];
    return LEVELS.includes(level) ? all(level).find(u => u.key === key) || null : null;
  }

  // 漢字課的「詞裡的讀音」題：每個字只取前幾個詞（你的筆記優先），不然「日」一個字就有 28 個詞，一課會太重
  const kanjiWords = u => {
    const set = new Set((u.kanji || []).map(k => k.k));
    if (!set.size) return [];
    const cap = C().wordsPerKanji ?? 1, count = {};
    return (D().kanjiWords || []).filter(w => set.has(w.ch) && (count[w.ch] = (count[w.ch] || 0) + 1) <= cap);
  };
  // 這個單元會出的題目 id（漢字拆成音讀、訓讀兩題）
  function questionIds(u) {
    const ids = [...u.items.vocab, ...u.items.grammar, ...u.items.phrases, ...u.kana].map(x => x.id);
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
    if (u.kana.length) types.push('kana');
    if (u.kanji?.length) { types.push('kanji_on', 'kanji_kun'); if (kanjiWords(u).length) types.push('kanji_word'); }
    const ids = new Set([...u.items.vocab, ...u.items.grammar, ...u.items.phrases, ...u.kana, ...(u.kanji || []), ...kanjiWords(u)].map(x => x.id));
    return { types, ids, count: 10, ...extra };
  }

  return { LEVELS, KIND_ICON, all, get, stats, current, levelSummary, quizOpts, markRead, questionIds, sections, kanjiWords };
})();
