// quiz.js — 出題引擎
// 資料來源：window.NIHONGO_DATA（由 Notion 同步產生）
// 進度來源：window.Progress（localStorage）
window.Quiz = (() => {
  const D = () => window.NIHONGO_DATA || { vocab: [], grammar: [], phrases: [], kana: [] };

  // Mastery requires independently correct answers on three spaced, due reviews.
  // Legacy streaks are retained as history, never treated as spaced evidence.
  function isMastered(s) {
    return s.scheduleVersion === 2 && s.retained >= 3;
  }

  // 「弱點」：答錯比答對多，或最近一次答錯
  function isWeak(s) {
    return s.seen > 0 && (s.wrong >= s.correct || s.streak === 0);
  }

  const escHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // 例句填空：一題只挖一個空格。
  // 答案在例句裡出現兩次以上的句子不出題：挖一個會把答案留在畫面上，挖兩個又會讓人以為要填兩個。
  const clozeCount = g => (g.example ? g.example.split(g.pattern).length - 1 : 0);
  const clozeParts = g => { const i = g.example.indexOf(g.pattern); return [g.example.slice(0, i), g.example.slice(i + g.pattern.length)]; };
  const clozeText = g => clozeParts(g).join('＿');
  const clozeHtml = g => { const [a, b] = clozeParts(g); return `${escHtml(a)}<span class="cloze-blank" aria-label="一個空格"></span>${escHtml(b)}`; };

  const TYPES = {
    vocab_meaning: { label: '單字 → 意思', pool: 'vocab', prompt: v => v.word, sub: v => v.reading !== v.word ? v.reading : '', answer: v => v.meaning, kind: 'meaning' },
    vocab_reading: { label: '讀音 → 單字', pool: 'vocab', prompt: v => v.reading, sub: () => '', hint: v => v.meaning, answer: v => v.word, kind: 'word', filter: v => v.reading && v.reading !== v.word },
    vocab_recall: { label: '輸入假名讀音', pool: 'vocab', prompt: v => v.word, sub: () => '', hint: v => v.meaning, answer: v => v.reading, kind: 'reading', input: true, filter: v => /^[\u3041-\u3096ー]+$/.test(v.reading) && v.reading !== v.word },
    vocab_word:    { label: '意思 → 單字', pool: 'vocab', prompt: v => v.meaning, sub: () => '', answer: v => v.word, kind: 'word' },
    grammar:       { label: '文法／疑問詞 → 意思', pool: 'grammar', prompt: g => g.pattern, sub: () => '', answer: g => g.meaning, kind: 'meaning' },
    grammar_cloze: { label: '例句填空', pool: 'grammar', input: true,
                     filter: g => g.example && clozeCount(g) === 1 && !/[〜～（(]/.test(g.pattern) && !g.example.startsWith('原形：'),
                     prompt: g => clozeText(g), promptHtml: g => clozeHtml(g), sub: () => '空格只有一個答案',
                     hint: g => g.meaning, answer: g => g.pattern, kind: 'word' },
    phrase:        { label: '會話 → 中文', pool: 'phrases', prompt: p => p.jp, sub: p => p.romaji || '', answer: p => p.zh, kind: 'meaning' },
    kana:          { label: '假名 → 羅馬拼音', pool: 'kana', prompt: k => k.hira, sub: k => k.kata, answer: k => k.romaji, kind: 'romaji' },
    // 漢字：id 加上 :on / :kun，讓同一個字的音讀和訓讀分開記進度
    kanji_on:      { label: '漢字 → 音讀', pool: 'kanji', filter: k => k.on.length > 0, id: k => k.id + ':on',
                     prompt: k => k.k, sub: k => [tradNote(k), '音讀是？'].filter(Boolean).join('　'), answer: k => onText(k), kind: 'reading',
                     distractors: k => similarKanji(k, 'on'), conflict: (a, b) => overlap(a.on, b.on), detail: k => kanjiDetail(k) },
    kanji_kun:     { label: '漢字 → 訓讀', pool: 'kanji', filter: k => k.kun.length > 0, id: k => k.id + ':kun',
                     prompt: k => k.k, sub: k => [tradNote(k), '訓讀是？'].filter(Boolean).join('　'), answer: k => kunText(k), kind: 'reading',
                     distractors: k => similarKanji(k, 'kun'), conflict: (a, b) => overlap(kunStems(a), kunStems(b)), detail: k => kanjiDetail(k) },
    kanji_word:    { label: '詞裡的讀音', pool: 'kanjiWords', prompt: w => w.word, promptHtml: w => KA().highlightHtml(w),
                     sub: w => `「${w.ch}」在這個詞裡怎麼唸？`, answer: w => w.seg, kind: 'reading',
                     distractors: w => otherReadings(w), conflict: (a, b) => a.ch === b.ch, detail: w => `${w.word}＝${w.meaning}` },
  };
  // 筆記＝Notion 裡沒標等級的單字；其他＝不在 JLPT 漢字表、但出現在你單字裡的常用漢字
  const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1', '筆記', '其他'];
  const LEVELED = new Set(['vocab', 'kanji', 'kanjiWords']);

  // ── 漢字題用的小工具（KanjiAlign 由 js/kanji-align.js 提供）──
  const KA = () => window.KanjiAlign;
  const overlap = (a, b) => a.some(x => b.includes(x));
  const kunStems = k => (k.kun || []).map(x => x[0]);
  const kunWord = ([s, o]) => (o ? `${s}(${o})` : s);
  const onText = k => (k.on || []).map(r => KA().toKata(r)).join('・');
  function kunText(k) {
    const seen = new Set(), out = [];
    for (const x of k.kunTop || k.kun || []) { const w = kunWord(x); if (!seen.has(w)) { seen.add(w); out.push(w); } if (out.length === 3) break; }
    return out.join('・');
  }
  const tradNote = k => (k.trad?.length ? `繁體：${k.trad.join('／')}` : '');
  const kanjiDetail = k => [`音讀：${onText(k) || '—'}`, `訓讀：${(k.kunTop || k.kun || []).map(kunWord).join('・') || '—'}`, tradNote(k), k.meanings?.length ? `英：${k.meanings.join(', ')}` : ''].filter(Boolean).join('　');
  // 同級、讀音開頭相近但完全不重疊的字，當干擾選項比較有鑑別度
  function similarKanji(k, kind) {
    const mine = kind === 'on' ? k.on : kunStems(k);
    const firsts = new Set(mine.map(r => r[0]));
    return (D().kanji || [])
      .filter(x => x !== k && x.level === k.level)
      .filter(x => { const theirs = kind === 'on' ? x.on : kunStems(x); return theirs.length && !overlap(mine, theirs) && theirs.some(r => firsts.has(r[0])); })
      .slice(0, 40).map(kind === 'on' ? onText : kunText);
  }
  // 同一個字的其他唸法（包含在別的詞裡出現過的音變），是「詞裡的讀音」最好的干擾選項
  function otherReadings(w) {
    const e = (D().kanji || []).find(x => x.k === w.ch);
    const seen = (D().kanjiUses?.get(w.ch) || []).map(u => u.seg);
    const base = e ? [...e.on, ...kunStems(e)].map(r => KA().toHira(r)) : [];
    return [...new Set([...seen, ...base])].filter(r => r !== w.seg);
  }

  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // origins：['notion'] 只出你的筆記、['external'] 只出公開單字，空的就兩種都出（只影響單字題）
  function poolFor(typeKey, levels, origins) {
    const t = TYPES[typeKey];
    let items = D()[t.pool] || [];
    if (t.filter) items = items.filter(t.filter);
    if (LEVELED.has(t.pool) && levels?.length) items = items.filter(v => levels.includes(v.level));
    if ((t.pool === 'vocab' || t.pool === 'kanjiWords') && origins?.length) items = items.filter(v => origins.includes(v.origin || 'notion'));
    return items;
  }

  // 干擾選項：先用題型指定的（例如同一個字的其他唸法），不夠再從同級、其他級補
  // conflict(a, b) 為真代表 b 的答案對 a 來說其實也算對，不能拿來當干擾
  function pickDistractors(item, all, t, n = 3) {
    const ans = t.answer(item);
    const out = [], seen = new Set([ans]);
    const take = a => { if (a && !seen.has(a)) { seen.add(a); out.push(a); } return out.length >= n; };
    for (const a of shuffle([...(t.distractors?.(item) || [])])) if (take(a)) return out;
    // Exclude alternate spellings/readings or overlapping glosses that can also be right.
    const clean = s => String(s || '').replace(/\*\*/g, '').trim();
    const glosses = x => clean(x.meaning || x.zh).split(/[、，,；;]/).filter(Boolean);
    const ok = x => x !== item && !(t.conflict && t.conflict(item, x)) && !(item.pattern && x.pattern === item.pattern) &&
      !(item.word && (clean(x.word) === clean(item.word) || (item.reading && clean(x.reading) === clean(item.reading)))) &&
      !glosses(item).some(a => glosses(x).includes(a));
    const same = all.filter(x => ok(x) && (!item.level || x.level === item.level));
    const sameSet = new Set(same);
    const other = all.filter(x => ok(x) && !sameSet.has(x));
    const related = shuffle(same).sort((a, b) => {
      const rank = x => (item.pos && x.pos === item.pos ? 4 : 0) + (item.category && x.category === item.category ? 3 : 0) + (item.reading && x.reading?.[0] === item.reading[0] ? 1 : 0);
      return rank(b) - rank(a);
    });
    for (const x of related.concat(shuffle(other))) if (take(t.answer(x))) return out;
    return out;
  }

  // 建立題目
  // opts: { types: ['vocab_meaning', ...], levels: ['N5'], count: 10, weakOnly: false }
  function buildQuestions(opts = {}) {
    const types = (opts.types?.length ? opts.types : ['vocab_meaning']).filter(t => TYPES[t]);
    const count = opts.count || 10;
    const candidates = [];
    for (const tk of types) {
      const t = TYPES[tk];
      const qid = it => (t.id ? t.id(it) : it.id);
      let items = poolFor(tk, opts.levels, opts.origins);
      if (opts.ids) items = items.filter(x => opts.ids.has(x.id));   // 單元練習：只出這個單元的題目
      if (opts.source) items = items.filter(x => x.source === opts.source);
      if (opts.page) items = items.filter(x => x.source?.startsWith(opts.page + ' › '));
      if (opts.weakOnly) items = items.filter(x => isWeak(Progress.stat(qid(x))));
      for (const it of items) candidates.push({ tk, it, qid: qid(it) });
    }
    if (!candidates.length) return [];

    const now = opts.now ?? Date.now();
    // Due reviews (including pre-scheduler records) precede unseen content.
    const bucket = c => { const s = Progress.stat(c.qid); return s.seen && (!s.due || s.due <= now) ? 0 : s.seen === 0 ? 1 : isWeak(s) ? 2 : 3; };
    const grouped = [[], [], [], []];
    for (const c of shuffle(candidates)) grouped[bucket(c)].push(c);
    const chosen = [], used = new Set();
    const introducedToday = (D().vocab || []).filter(v => {
      const s = Progress.stat(v.id); return opts.levels?.includes(v.level) && s.firstSeen && Progress.dayKey(new Date(s.firstSeen)) === Progress.dayKey(new Date(now));
    }).length;
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - (weekStart.getDay() + 6) % 7);
    weekStart.setHours(0, 0, 0, 0);
    const introducedThisWeek = (D().vocab || []).filter(v => opts.levels?.includes(v.level) && Progress.stat(v.id).firstSeen >= +weekStart && Progress.stat(v.id).firstSeen <= now).length;
    let newRemaining = Math.max(0, Math.min((opts.newLimit ?? 5) - introducedToday, (opts.weeklyLimit ?? Infinity) - introducedThisWeek));
    for (const c of grouped.flat()) {
      if (used.has(c.qid)) continue;
      const s = Progress.stat(c.qid);
      if (opts.daily && s.seen && s.due > now) continue;
      if (opts.daily && !s.seen && newRemaining <= 0) continue;
      if (!s.seen) newRemaining--;
      chosen.push(c); used.add(c.qid);
      if (chosen.length >= count) break;
    }

    return chosen.map(({ tk, it, qid }) => {
      const t = TYPES[tk];
      const answer = t.answer(it);
      const choices = t.input ? [] : shuffle([answer, ...pickDistractors(it, poolFor(tk, opts.levels, opts.origins), t)]);
      return { id: qid, type: tk, typeLabel: tk === 'grammar' ? `${it.category || '文法'} → 意思` : t.label, prompt: t.prompt(it), promptHtml: t.promptHtml?.(it), sub: t.sub(it), hint: t.hint?.(it), input: !!t.input || choices.length < 2, answer, choices, item: it, detail: t.detail?.(it), learnFirst: !!opts.daily && !Progress.stat(qid).seen };
    });
  }

  const normalizeAnswer = text => String(text ?? '').normalize('NFKC').replace(/\*\*/g, '').trim().replace(/[\u30a1-\u30f6]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
  const checkAnswer = (q, value) => normalizeAnswer(q.answer) === normalizeAnswer(value);

  // 統計：某等級的熟練狀況
  function levelStats(level) {
    const words = D().vocab.filter(v => v.level === level);
    const mastered = words.filter(v => isMastered(Progress.stat(v.id))).length;
    const seen = words.filter(v => Progress.stat(v.id).seen > 0).length;
    const weak = words.filter(v => isWeak(Progress.stat(v.id))).length;
    const external = words.filter(v => v.origin === 'external').length;
    return { total: words.length, notion: words.length - external, external, mastered, seen, weak, pct: words.length ? Math.round(mastered / words.length * 100) : 0 };
  }

  function overallStats() {
    const all = [...D().vocab, ...D().grammar, ...D().phrases, ...D().kana];
    const mastered = all.filter(x => isMastered(Progress.stat(x.id))).length;
    const weak = all.filter(x => isWeak(Progress.stat(x.id))).length;
    const externalVocab = D().vocab.filter(v => v.origin === 'external').length;
    return { total: all.length, vocab: D().vocab.length, notionVocab: D().vocab.length - externalVocab, externalVocab, mastered, weak };
  }

  // 漢字的狀態：音讀、訓讀題都熟練才算熟練；任一題是弱點就標弱點
  function kanjiStatus(k) {
    const ids = [k.on?.length && k.id + ':on', k.kun?.length && k.id + ':kun'].filter(Boolean);
    const ss = ids.map(id => Progress.stat(id));
    if (!ss.some(s => s.seen)) return '';
    if (ss.some(isWeak)) return 'weak';
    return ss.every(isMastered) ? 'mastered' : 'seen';
  }
  function kanjiStats(level) {
    const ks = (D().kanji || []).filter(k => k.level === level);
    const mastered = ks.filter(k => kanjiStatus(k) === 'mastered').length;
    return { total: ks.length, mastered, pct: ks.length ? Math.round(mastered / ks.length * 100) : 0 };
  }

  return { TYPES, LEVELS, isMastered, isWeak, buildQuestions, levelStats, overallStats, kanjiStatus, kanjiStats, onText, kunText, checkAnswer, normalizeAnswer };
})();
