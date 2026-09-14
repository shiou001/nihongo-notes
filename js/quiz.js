// quiz.js — 出題引擎
// 資料來源：window.NIHONGO_DATA（由 Notion 同步產生）
// 進度來源：window.Progress（localStorage）
window.Quiz = (() => {
  const D = () => window.NIHONGO_DATA || { vocab: [], grammar: [], phrases: [], kana: [] };

  // ─────────────────────────────────────────────────────────────
  // 🖊️ 熟練度判定 — 這裡決定「一個單字什麼時候算背起來了」。
  //   預設：連續答對 3 次就算熟練；答錯一次 streak 歸零。
  //   你可以改成例如「正確率 ≥ 80% 且看過 ≥ 4 次」：
  //     return s.seen >= 4 && s.correct / s.seen >= 0.8;
  //   或加入時間衰減（超過 14 天沒複習就不算熟練）：
  //     return s.streak >= 3 && Date.now() - s.last < 14 * 864e5;
  // ─────────────────────────────────────────────────────────────
  function isMastered(s) {
    return s.streak >= 3;
  }

  // 「弱點」：答錯比答對多，或最近一次答錯
  function isWeak(s) {
    return s.seen > 0 && (s.wrong >= s.correct || s.streak === 0);
  }

  const TYPES = {
    vocab_meaning: { label: '單字 → 意思', pool: 'vocab', prompt: v => v.word, sub: v => v.reading !== v.word ? v.reading : '', answer: v => v.meaning, kind: 'meaning' },
    vocab_reading: { label: '讀音 → 單字', pool: 'vocab', prompt: v => v.reading, sub: v => v.meaning, answer: v => v.word, kind: 'word', filter: v => v.reading && v.reading !== v.word },
    vocab_word:    { label: '意思 → 單字', pool: 'vocab', prompt: v => v.meaning, sub: () => '', answer: v => v.word, kind: 'word' },
    grammar:       { label: '句型 → 意思', pool: 'grammar', prompt: g => g.pattern, sub: () => '', answer: g => g.meaning, kind: 'meaning' },
    phrase:        { label: '會話 → 中文', pool: 'phrases', prompt: p => p.jp, sub: p => p.romaji || '', answer: p => p.zh, kind: 'meaning' },
    kana:          { label: '假名 → 羅馬拼音', pool: 'kana', prompt: k => k.hira, sub: k => k.kata, answer: k => k.romaji, kind: 'romaji' },
  };
  const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1', '筆記'];

  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // origins：['notion'] 只出你的筆記、['external'] 只出公開單字，空的就兩種都出（只影響單字題）
  function poolFor(typeKey, levels, origins) {
    const t = TYPES[typeKey];
    let items = D()[t.pool] || [];
    if (t.filter) items = items.filter(t.filter);
    if (t.pool === 'vocab' && levels?.length) items = items.filter(v => levels.includes(v.level));
    if (t.pool === 'vocab' && origins?.length) items = items.filter(v => origins.includes(v.origin || 'notion'));
    return items;
  }

  function pickDistractors(item, all, t, n = 3) {
    const ans = t.answer(item);
    const same = all.filter(x => x !== item && t.answer(x) !== ans && (!item.level || x.level === item.level));
    const other = all.filter(x => x !== item && t.answer(x) !== ans && !same.includes(x));
    const out = [];
    const seen = new Set([ans]);
    for (const x of shuffle(same).concat(shuffle(other))) {
      const a = t.answer(x);
      if (seen.has(a)) continue;
      seen.add(a); out.push(a);
      if (out.length === n) break;
    }
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
      let items = poolFor(tk, opts.levels, opts.origins);
      if (opts.weakOnly) items = items.filter(x => isWeak(Progress.stat(x.id)));
      for (const it of items) candidates.push({ tk, it });
    }
    if (!candidates.length) return [];

    // 優先出：沒看過的 → 弱點 → 其他（每組內隨機）
    const bucket = c => { const s = Progress.stat(c.it.id); return s.seen === 0 ? 0 : isWeak(s) ? 1 : isMastered(s) ? 3 : 2; };
    const grouped = [[], [], [], []];
    for (const c of shuffle(candidates)) grouped[bucket(c)].push(c);
    const chosen = grouped.flat().slice(0, count);

    return shuffle(chosen).map(({ tk, it }) => {
      const t = TYPES[tk];
      const answer = t.answer(it);
      const choices = shuffle([answer, ...pickDistractors(it, poolFor(tk, opts.levels, opts.origins), t)]);
      return { id: it.id, type: tk, typeLabel: t.label, prompt: t.prompt(it), sub: t.sub(it), answer, choices, item: it };
    });
  }

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

  return { TYPES, LEVELS, isMastered, isWeak, buildQuestions, levelStats, overallStats };
})();
