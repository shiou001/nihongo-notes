// jlpt-core.js — JLPT 考試專區的純邏輯（不碰畫面）
// 題庫：window.NIHONGO_JLPT（tools/build-jlpt.mjs 從 jlpt-src/ 產生）
// 進度：window.Progress（作答走 Progress.record；模擬考紀錄、回報、設定在 Progress.jlpt()）
// 規格：docs/superpowers/specs/2026-10-30-jlpt-exam-zone-design.md
window.JLPT = (() => {
  const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
  const rank = l => { const i = LEVELS.indexOf(l); return i < 0 ? -1 : i; }; // N5=0 最簡單

  // 題本的作答說明（N5 寫法：平假名、詞語之間空一格）。文法・讀解科的漢字用 {漢字|よみ} 標振假名
  const ASK = '１・２・３・４から　いちばん　いい　ものを　ひとつ　えらんで　ください。';
  const ASK_G = '１・２・３・４から　いちばん　いい　ものを　{一|ひと}つ　えらんで　ください。';
  // full：官方題數（2020 年 12 月起）；mini：週末小型模擬考題數（規格 §7.1）
  const TYPES = {
    kanji_reading:  { section: 'vocab', label: '漢字讀音', choices: 4, full: { N5: 7, N4: 7 }, mini: 3, instruction: `＿＿＿の　ことばは　ひらがなで　どう　かきますか。${ASK}` },
    orthography:    { section: 'vocab', label: '表記', choices: 4, full: { N5: 5, N4: 5 }, mini: 3, instruction: `＿＿＿の　ことばは　どう　かきますか。${ASK}` },
    context:        { section: 'vocab', label: '文脈規定', choices: 4, full: { N5: 6, N4: 8 }, mini: 3, instruction: `（　　）に　なにが　はいりますか。${ASK}` },
    paraphrase:     { section: 'vocab', label: '換句話說', choices: 4, full: { N5: 3, N4: 4 }, mini: 2, instruction: `＿＿＿の　ぶんと　だいたい　おなじ　いみの　ぶんが　あります。${ASK}` },
    usage:          { section: 'vocab', label: '用法', choices: 4, full: { N5: 0, N4: 4 }, mini: 0, instruction: `つぎの　ことばの　つかいかたで　いちばん　いい　ものを　１・２・３・４から　ひとつ　えらんで　ください。` },
    grammar_form:   { section: 'grammar', label: '文法形式', choices: 4, full: { N5: 9, N4: 13 }, mini: 4, instruction: `（　　）に　{何|なに}を　{入|い}れますか。${ASK_G}` },
    sentence_order: { section: 'grammar', label: '句子重組', choices: 4, full: { N5: 4, N4: 4 }, mini: 2, instruction: `＿★＿に　{入|はい}る　ものは　どれですか。${ASK_G}` },
    text_grammar:   { section: 'grammar', label: '文章文法', choices: 4, full: { N5: 4, N4: 4 }, mini: 3, instruction: `ぶんしょうの　□に　{何|なに}を　{入|い}れますか。ぶんしょうの　いみを　かんがえて、${ASK_G}` },
    reading_short:  { section: 'reading', label: '短篇閱讀', choices: 4, full: { N5: 2, N4: 3 }, mini: 1, instruction: `つぎの　ぶんしょうを　{読|よ}んで、しつもんに　こたえて　ください。こたえは、${ASK_G}` },
    reading_mid:    { section: 'reading', label: '中篇閱讀', choices: 4, full: { N5: 2, N4: 3 }, mini: 2, instruction: `つぎの　ぶんしょうを　{読|よ}んで、しつもんに　こたえて　ください。こたえは、${ASK_G}` },
    info_search:    { section: 'reading', label: '資訊檢索', choices: 4, full: { N5: 1, N4: 2 }, mini: 1, instruction: `つぎの　おしらせを　{見|み}て、しつもんに　こたえて　ください。こたえは、${ASK_G}` },
    task:           { section: 'listening', label: '課題理解', choices: 4, full: { N5: 7, N4: 8 }, mini: 3, instruction: 'もんだい１では、はじめに　しつもんを　きいて　ください。それから　はなしを　きいて、もんだいようしの　１から４の　なかから、いちばん　いい　ものを　ひとつ　えらんで　ください。' },
    point:          { section: 'listening', label: '重點理解', choices: 4, full: { N5: 6, N4: 7 }, mini: 3, instruction: 'もんだい２では、はじめに　しつもんを　きいて　ください。それから　はなしを　きいて、もんだいようしの　１から４の　なかから、いちばん　いい　ものを　ひとつ　えらんで　ください。' },
    utterance:      { section: 'listening', label: '發話表現', choices: 3, full: { N5: 5, N4: 5 }, mini: 2, instruction: 'もんだい３では、えを　みながら　しつもんを　きいて　ください。➡（やじるし）の　ひとは　なんと　いいますか。１から３の　なかから、いちばん　いい　ものを　ひとつ　えらんで　ください。' },
    response:       { section: 'listening', label: '即時應答', choices: 3, full: { N5: 6, N4: 8 }, mini: 3, instruction: 'もんだい４は、えなどが　ありません。ぶんを　きいて、１から３の　なかから、いちばん　いい　ものを　ひとつ　えらんで　ください。' },
  };
  const typesOf = (...sections) => Object.keys(TYPES).filter(t => sections.includes(TYPES[t].section));
  // 計分與考試順序的三科：文法和讀解合成一科
  const SECTIONS = { vocab: typesOf('vocab'), grammarReading: typesOf('grammar', 'reading'), listening: typesOf('listening') };
  const PASSAGE_TYPES = ['text_grammar', 'reading_short', 'reading_mid', 'info_search'];

  // ── 題目標記 ──
  //   {漢字|かんじ} 振假名　[[…]] 底線　{{_}} 排序空格　{{★}} ★空格　{{#22}} 方框號碼　空格用全形空白（分かち書き）
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function renderStem(stem) {
    return esc(stem)
      .replace(/\{\{_\}\}/g, '<span class="ord-blank"></span>')
      .replace(/\{\{★\}\}/g, '<span class="ord-blank star">★</span>')
      .replace(/\{\{#(\d+)\}\}/g, '<span class="box-no">$1</span>')
      .replace(/\{([^{}|]+)\|([^{}|]+)\}/g, '<ruby>$1<rt>$2</rt></ruby>')
      .replace(/\[\[(.+?)\]\]/g, '<u>$1</u>')
      .replace(/\n/g, '<br>');
  }

  // ── 題目檢查 ──
  const KANJI = /[一-鿿々]/g;
  const RUBY = /\{([^{}|]+)\|([^{}|]+)\}/g;
  // 一段文字的振假名與漢字級數問題（section：vocab 不能有振假名；grammar／reading 每個漢字都要有）
  function textErrors(text, section, level, ctx) {
    const errs = [], s = String(text ?? '');
    const bare = s.replace(RUBY, '');
    if (section === 'vocab' && RUBY.test(s)) errs.push('文字・語彙科不能有振假名');
    RUBY.lastIndex = 0;
    const kanji = bare.match(KANJI) || [];
    if ((section === 'grammar' || section === 'reading') && kanji.length) errs.push(`漢字沒有振假名：${[...new Set(kanji)].join('')}`);
    for (const k of new Set(kanji)) {
      const r = rank(ctx.kanjiLevel.get(k));
      if (k !== '々' && (r < 0 || r > rank(level))) errs.push(`漢字「${k}」超出 ${level} 級`);
    }
    return errs;
  }
  function validate(q, ctx) {
    const errs = [], t = TYPES[q.type];
    if (!q.id) errs.push('沒有 id'); else if (ctx.ids.has(q.id)) errs.push(`id 重複：${q.id}`);
    if (!t) return [...errs, `不認識的題型：${q.type}`];
    if (!LEVELS.includes(q.level)) errs.push(`不認識的級數：${q.level}`);
    if (q.section !== t.section) errs.push(`section 應該是 ${t.section}`);
    if (!Number.isInteger(q.rev) || q.rev < 1) errs.push('rev 要是 1 以上的整數');
    if (!['practice', 'mock'].includes(q.pool)) errs.push('pool 要是 practice 或 mock');
    if (!q.explain || !String(q.explain).trim()) errs.push('沒有詳解');
    const ch = q.choices;
    if (!Array.isArray(ch) || ch.length !== t.choices) errs.push(`選項要 ${t.choices} 個`);
    else {
      if (new Set(ch).size !== ch.length) errs.push('選項重複');
      if (ch.some(c => !String(c ?? '').trim())) errs.push('有空白選項');
      if (!Number.isInteger(q.answer) || q.answer < 1 || q.answer > ch.length) errs.push('答案不在選項範圍內');
    }
    if (PASSAGE_TYPES.includes(q.type) && !q.passage) errs.push('文章題要有 passage');
    if (t.section === 'listening') {
      if (!Array.isArray(q.script) || !q.script.length || q.script.some(l => !Array.isArray(l) || l.length < 2)) errs.push('聽解題要有 script（〔角色, 台詞〕）');
    } else {
      if (!PASSAGE_TYPES.includes(q.type) && !String(q.stem ?? '').trim()) errs.push('沒有題目');
      errs.push(...textErrors(q.stem, t.section, q.level, ctx));
      if (t.section !== 'vocab' && Array.isArray(ch)) for (const c of ch) errs.push(...textErrors(c, t.section, q.level, ctx));
    }
    return [...new Set(errs)];
  }

  // ── 設定與題庫 ──
  const P = () => window.Progress;
  const DEFAULTS = { level: 'N5', target: 'N4', examDate: '2027-07-04', passPct: 0.8, needed: 2 };
  const settings = () => ({ ...DEFAULTS, ...(P().jlpt().settings || {}) });
  function setSettings(patch) {
    const prev = settings();
    P().saveJlpt(j => { j.settings = { ...prev, ...patch, updatedAt: Math.max(Date.now(), (prev.updatedAt || 0) + 1) }; });
  }
  const EMPTY = { questions: [], passages: {} };
  const bank = level => window.NIHONGO_JLPT?.levels?.[level] || EMPTY;
  const qid = q => 'jlpt:' + q.id;
  const stat = q => P().stat(qid(q));
  // 剩幾天（以日期計算，不看時刻）
  function daysLeft(now = new Date()) {
    const [y, m, d] = settings().examDate.split('-').map(Number);
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    return Math.round((new Date(y, m - 1, d) - today) / 864e5);
  }

  // ── 回報題目有問題：題目修正後 rev 加 1 就恢復出題 ──
  const isReported = q => { const r = P().jlpt().reports[q.id]; return !!r && r.rev >= q.rev; };
  const report = q => P().saveJlpt(j => { j.reports[q.id] = { at: Date.now(), rev: q.rev }; });

  // 各題型的作答統計（例題不算）
  function typeStats(level) {
    const out = {};
    for (const q of bank(level).questions) {
      if (q.example) continue;
      const s = stat(q), o = (out[q.type] ||= { seen: 0, correct: 0, wrong: 0, pct: null });
      o.seen += s.seen; o.correct += s.correct; o.wrong += s.wrong;
    }
    for (const o of Object.values(out)) o.pct = o.correct + o.wrong ? o.correct / (o.correct + o.wrong) : null;
    return out;
  }

  // ── 每日 20 題：弱點題型、到期錯題、新題、聽解（規格 §6）。同一篇文章的題目整組出 ──
  function dailySet({ level = settings().level, now = Date.now(), count = 20, mix = { weak: 8, due: 6, fresh: 4, listening: 2 } } = {}) {
    const eligible = bank(level).questions.filter(q => q.pool === 'practice' && !q.example && !isReported(q));
    const units = [], byPassage = new Map();
    for (const q of eligible) {
      if (!q.passage) { units.push([q]); continue; }
      if (!byPassage.has(q.passage)) { byPassage.set(q.passage, []); units.push(byPassage.get(q.passage)); }
      byPassage.get(q.passage).push(q);
    }
    const ustat = u => u.map(stat);
    const seen = u => ustat(u).some(s => s.seen);
    const lastOf = u => Math.max(0, ...ustat(u).map(s => s.last || 0));
    const isListening = u => u[0].section === 'listening';
    const byId = (a, b) => (a[0].id < b[0].id ? -1 : 1);
    const textUnits = units.filter(u => !isListening(u));

    const due = textUnits.filter(u => ustat(u).some(s => s.seen && s.due && s.due <= now))
      .sort((a, b) => Math.min(...ustat(a).map(s => s.due || Infinity)) - Math.min(...ustat(b).map(s => s.due || Infinity)) || byId(a, b));
    const ts = typeStats(level);
    const weakTypes = Object.keys(ts).filter(t => ts[t].pct !== null && TYPES[t].section !== 'listening').sort((a, b) => ts[a].pct - ts[b].pct || a.localeCompare(b));
    const weak = weakTypes.flatMap(t => textUnits.filter(u => u[0].type === t).sort((a, b) => seen(a) - seen(b) || lastOf(a) - lastOf(b) || byId(a, b)));
    // 新題：筆記裡學過的（refs）優先，再依題型輪流
    const freshSorted = textUnits.filter(u => !seen(u)).sort((a, b) => (b[0].refs ? 1 : 0) - (a[0].refs ? 1 : 0) || byId(a, b));
    const perType = new Map();
    for (const u of freshSorted) { if (!perType.has(u[0].type)) perType.set(u[0].type, []); perType.get(u[0].type).push(u); }
    const fresh = [];
    for (let i = 0; [...perType.values()].some(l => i < l.length); i++) for (const l of perType.values()) if (i < l.length) fresh.push(l[i]);
    const listening = units.filter(isListening).sort((a, b) => seen(a) - seen(b) || lastOf(a) - lastOf(b) || byId(a, b));

    const picked = new Set(), out = [];
    const take = (list, n) => {
      let added = 0;
      for (const u of list) {
        if (added >= n || out.length >= count) break;
        if (picked.has(u) || out.length + u.length > count) continue;
        picked.add(u); out.push(...u); added += u.length;
      }
    };
    take(due, mix.due); take(weak, mix.weak); take(fresh, mix.fresh); take(listening, mix.listening);
    // 不夠時依序用 新題、到期、弱點 補，最後用最久沒做的題目補滿
    for (const list of [fresh, due, weak, [...units].sort((a, b) => lastOf(a) - lastOf(b) || byId(a, b))]) take(list, count);
    return out;
  }

  return { LEVELS, TYPES, SECTIONS, PASSAGE_TYPES, renderStem, validate, textErrors, esc,
    DEFAULTS, settings, setSettings, bank, qid, daysLeft, isReported, report, typeStats, dailySet };
})();
