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
  //   | 開頭的行是表格（資訊檢索的告示、價目表）
  //   opts.boxNo：文章裡的方框號碼 → 畫面上的題號；opts.current：目前這一題的方框
  function renderStem(stem, { boxNo = {}, current = null } = {}) {
    const inline = s => esc(s)
      .replace(/\{\{_\}\}/g, '<span class="ord-blank"></span>')
      .replace(/\{\{★\}\}/g, '<span class="ord-blank star">★</span>')
      .replace(/\{\{#(\d+)\}\}/g, (m, n) => `<span class="box-no${+n === current ? ' current' : ''}">${boxNo[n] ?? n}</span>`)
      .replace(/\{([^{}|]+)\|([^{}|]+)\}/g, '<ruby>$1<rt>$2</rt></ruby>')
      .replace(/\[\[(.+?)\]\]/g, '<u>$1</u>');
    // 先把表格裡的 {漢字|よみ} 換掉，避免和表格的 | 混在一起
    const rubies = [];
    const lines = String(stem ?? '').replace(/\{([^{}|]+)\|([^{}|]+)\}/g, m => `\u0000${rubies.push(m) - 1}\u0000`).split('\n');
    const back = s => s.replace(/\u0000(\d+)\u0000/g, (m, i) => rubies[i]);
    let out = '', prev = null, rows = [];
    const flush = () => {
      if (!rows.length) return;
      out += (prev === 'text' ? '<br>' : '') + `<table class="notice">${rows.map((r, i) => `<tr>${r.map(c => i ? `<td>${inline(back(c))}</td>` : `<th>${inline(back(c))}</th>`).join('')}</tr>`).join('')}</table>`;
      rows = []; prev = 'table';
    };
    for (const line of lines) {
      if (/^\s*\|/.test(line)) { rows.push(line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())); continue; }
      flush();
      out += (prev === 'text' ? '<br>' : '') + inline(back(line)); prev = 'text';
    }
    flush();
    return out;
  }

  // ── 聽解錄音（tools/make-jlpt-audio.mjs 產生）──
  // 角色 → VOICEVOX 聲音：N 旁白 No.7（アナウンス）、M 男 剣崎雌雄、F 女 東北きりたん
  const voices = () => window.NIHONGO_JLPT?.voices || { N: 30, M: 21, F: 108 };
  // 跟 js/voice.js、tools/make-audio.mjs 的 audioKey 一樣（FNV-1a）
  const audioKey = t => {
    const s = String(t ?? '').normalize('NFKC').trim();
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(36);
  };
  // 同一句台詞用不同聲音唸是不同的檔，所以檔名包含聲音
  const audioFile = (role, text) => `audio/jlpt/${audioKey(`${voices()[role]}|${text}`)}.mp3`;
  // 唸給 VOICEVOX 的文字：振假名換成讀音；詞語間的空格拿掉（空格會讓語音不自然地停頓）
  const speechText = t => String(t ?? '').replace(/\{([^{}|]+)\|([^{}|]+)\}/g, '$2').replace(/[　 ]+/g, '').trim();
  const NUMS = ['いち、', 'に、', 'さん、', 'よん、']; // 選項號碼（唸成いち、に、さん）
  // 一題聽解的完整播放順序（〔角色, 台詞〕）
  function listeningLines(q) {
    const lines = [...(q.script || [])];
    if (q.type === 'utterance' || q.type === 'response') q.choices.forEach((c, i) => lines.push([q.speaker, NUMS[i] + c]));
    return lines;
  }
  // 大題的作答說明（旁白唸）：題本上的數字和箭頭符號換成唸法
  const SPOKEN_DIGIT = { '１': 'いち', '２': 'に', '３': 'さん', '４': 'よん' };
  const instructionLine = type => ['N', TYPES[type].instruction.replace('➡（やじるし）', 'やじるし').replace(/[１-４]/g, d => SPOKEN_DIGIT[d])];

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
      else {
        const roles = Object.keys(voices());
        if (q.script.some(([r]) => !roles.includes(r))) errs.push(`不認識的角色（可用：${roles.join('、')}）`);
        if ((q.type === 'task' || q.type === 'point') && (q.script[0][0] !== 'N' || q.script.at(-1)[0] !== 'N')) errs.push('課題理解、重點理解的腳本要由旁白（N）提問開始、再由旁白提問結束');
        if ((q.type === 'utterance' || q.type === 'response') && !roles.includes(q.speaker)) errs.push('發話表現、即時應答要有 speaker（唸選項的角色）');
      }
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
    const mockSeen = new Set(P().jlpt().mocks.flatMap(m => m.qids || []));
    const eligible = bank(level).questions.filter(q => (q.pool === 'practice' || mockSeen.has(q.id)) && !q.example && !isReported(q));
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
    const isMock = u => u[0].pool === 'mock';
    const textUnits = units.filter(u => !isListening(u) && !isMock(u));

    const due = units.filter(u => !isListening(u)).filter(u => ustat(u).some(s => s.seen && s.due && s.due <= now))
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
    const listening = units.filter(u => isListening(u) && !isMock(u)).sort((a, b) => seen(a) - seen(b) || lastOf(a) - lastOf(b) || byId(a, b));

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
    for (const list of [fresh, due, weak, units.filter(u => !isMock(u)).sort((a, b) => lastOf(a) - lastOf(b) || byId(a, b))]) take(list, count);
    return out;
  }

  // ── 組卷（規格 §7、§5.4）──
  // 每個題型：先用沒考過的模擬考專用題 → 不夠用最早考過的模擬考題 → 再不夠用練習題；後兩種都讓 fresh=false
  const SECTION_ORDER = ['vocab', 'grammarReading', 'listening'];
  const FULL_SECONDS = { N5: { vocab: 1200, grammarReading: 2400 }, N4: { vocab: 1500, grammarReading: 3300 } };
  const PER_ITEM = { vocab: 1200 / 21, grammarReading: 2400 / 22 }; // N5 每題平均秒數
  function sectionSeconds(key, n, kind, level) {
    if (key === 'listening') return null;
    if (kind === 'full') return (FULL_SECONDS[level] || FULL_SECONDS.N5)[key];
    return Math.ceil(n * PER_ITEM[key] / 60) * 60;
  }
  function groupUnits(qs) {
    const units = [], byPassage = new Map();
    for (const q of qs) {
      if (!q.passage) { units.push([q]); continue; }
      if (!byPassage.has(q.passage)) { byPassage.set(q.passage, []); units.push(byPassage.get(q.passage)); }
      byPassage.get(q.passage).push(q);
    }
    return units;
  }
  function assembleMock({ level = settings().level, kind = 'mini', now = Date.now() } = {}) {
    const usable = bank(level).questions.filter(q => !q.example && !isReported(q));
    const lastSeen = new Map();
    for (const m of P().jlpt().mocks) for (const id of m.qids || []) lastSeen.set(id, Math.max(lastSeen.get(id) || 0, m.at || 0));
    const seenAt = u => Math.max(...u.map(q => lastSeen.get(q.id) || 0));
    let fresh = true;
    const sections = [];
    for (const key of SECTION_ORDER) {
      const qids = [];
      for (const type of SECTIONS[key]) {
        const need = kind === 'full' ? TYPES[type].full[level] || 0 : TYPES[type].mini;
        if (!need) continue;
        const units = groupUnits(usable.filter(q => q.type === type));
        if (!units.length) continue; // 題庫裡還沒有這個題型（例如聽解還沒做）：少一科，不算「不是新題」
        const tiers = [
          units.filter(u => u[0].pool === 'mock' && !seenAt(u)),
          units.filter(u => u[0].pool === 'mock' && seenAt(u)).sort((a, b) => seenAt(a) - seenAt(b)),
          units.filter(u => u[0].pool === 'practice'),
        ];
        let got = 0;
        tiers.forEach((tier, t) => {
          for (const u of tier) {
            if (got >= need) break;
            if (got > 0 && got + u.length > need) continue; // 文章題整組出；已經有題目時不硬塞超過的組
            qids.push(...u.map(q => q.id)); got += u.length;
            if (t > 0) fresh = false;
          }
        });
        if (got < need) fresh = false;
      }
      if (qids.length) sections.push({ key, qids, seconds: sectionSeconds(key, qids.length, kind, level) });
    }
    return { level, kind, fresh, sections };
  }

  // ── 考試進行中的狀態（只存在這台裝置）──
  const ATTEMPT_KEY = 'nihongo.jlpt.attempt';
  function attempt() { try { return JSON.parse(localStorage.getItem(ATTEMPT_KEY)) || null; } catch { return null; } }
  function saveAttempt(a) { try { localStorage.setItem(ATTEMPT_KEY, JSON.stringify(a)); } catch {} return a; }
  function clearAttempt() { try { localStorage.setItem(ATTEMPT_KEY, 'null'); localStorage.removeItem?.(ATTEMPT_KEY); } catch {} }
  const deadlineFor = (sec, now) => (sec && sec.seconds ? now + sec.seconds * 1000 : null);
  const currentSection = a => a && a.plan.sections[a.sectionIndex];
  function startAttempt(plan, now = Date.now()) {
    return saveAttempt({ plan, startedAt: now, sectionIndex: 0, deadline: deadlineFor(plan.sections[0], now), remainingMs: null, paused: false, everPaused: false, answers: {}, listenIndex: 0, interrupted: false });
  }
  function timeLeft(now = Date.now()) {
    const a = attempt();
    if (!a) return 0;
    if (a.paused) return a.remainingMs;
    return a.deadline == null ? null : Math.max(0, a.deadline - now);
  }
  function pauseAttempt(now = Date.now()) {
    const a = attempt(), sec = currentSection(a);
    if (!sec || sec.key === 'listening' || a.paused || a.deadline == null) return false;
    Object.assign(a, { remainingMs: Math.max(0, a.deadline - now), paused: true, everPaused: true });
    saveAttempt(a); return true;
  }
  function resumeTimer(now = Date.now()) {
    const a = attempt();
    if (!a || !a.paused) return a;
    return saveAttempt(Object.assign(a, { deadline: now + a.remainingMs, remainingMs: null, paused: false }));
  }
  // 交出這一科、進入下一科（不能回頭）
  function nextSection(now = Date.now()) {
    const a = attempt();
    if (!a) return null;
    a.sectionIndex++; a.paused = false; a.remainingMs = null; a.listenIndex = 0;
    a.deadline = deadlineFor(currentSection(a), now);
    return saveAttempt(a);
  }
  function setAnswer(qid, v) {
    const a = attempt(), sec = currentSection(a);
    if (!sec || !sec.qids.includes(qid)) return false; // 只能改目前這一科
    a.answers[qid] = v; saveAttempt(a); return true;
  }
  // ── 計分（規格 §4.2、§7.5）：估計分數＝正確率 × 滿分；官方是量尺分數，畫面上要註明是估計 ──
  const PASS_TOTAL = { N5: 80, N4: 90, N3: 95, N2: 90, N1: 100 };
  const tally = (ids, answers, map) => { const correct = ids.filter(id => map.get(id) && answers[id] === map.get(id).answer).length; return { correct, n: ids.length, pct: ids.length ? correct / ids.length : 0 }; };
  function score(plan, answers = {}, b = bank(plan.level)) {
    const map = new Map(b.questions.map(q => [q.id, q]));
    const idsOf = key => plan.sections.find(s => s.key === key)?.qids || [];
    const all = plan.sections.flatMap(s => s.qids);
    const sections = Object.fromEntries(SECTION_ORDER.map(k => [k, tally(idsOf(k), answers, map)]));
    const lkIds = [...idsOf('vocab'), ...idsOf('grammarReading')], lIds = idsOf('listening');
    const t = tally(lkIds, answers, map), lk = { pct: t.pct, est: Math.round(t.pct * 120) };
    lk.pass = lk.est >= 38;
    let listen = null;
    if (lIds.length) { const l = tally(lIds, answers, map); listen = { pct: l.pct, est: Math.round(l.pct * 60) }; listen.pass = listen.est >= 19; }
    const estTotal = lk.est + (listen ? listen.est : 0);
    const byType = {};
    for (const id of all) { const q = map.get(id); if (!q) continue; const o = (byType[q.type] ||= { correct: 0, n: 0 }); o.n++; if (answers[id] === q.answer) o.correct++; }
    return { total: tally(all, answers, map), sections, lk, listen, estTotal, estPass: listen ? estTotal >= (PASS_TOTAL[plan.level] || 80) && lk.pass && listen.pass : null, byType };
  }
  // 那一週的星期一（本地時間）
  function weekKey(date = new Date()) {
    const d = new Date(date); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  // 計入：當時判定計入，而且在合併後的紀錄裡仍是那週第一份、題目沒在更早的模擬考出現過
  function countedMocks(level) {
    const all = [...P().jlpt().mocks].sort((a, b) => a.at - b.at), weeks = new Set(), seen = new Set(), out = [];
    for (const m of all) {
      if (m.level === level && m.counted && !weeks.has(weekKey(new Date(m.at))) && !(m.qids || []).some(id => seen.has(id))) { weeks.add(weekKey(new Date(m.at))); out.push(m); }
      for (const id of m.qids || []) seen.add(id);
    }
    return out;
  }
  const passes = (m, s = settings()) => !!(m.result && m.result.total.pct >= s.passPct && m.result.lk?.pass && m.result.listen?.pass);
  // 畢業：最近 needed 份「計入」的模擬考都過
  function graduation(level = settings().level) {
    const s = settings(), last = countedMocks(level).slice(-s.needed);
    return { done: last.length === s.needed && last.every(m => passes(m, s)), last };
  }
  // 交卷：計分、每題進 SRS、判斷是否計入、檢查畢業
  function finishAttempt(now = Date.now()) {
    const a = attempt();
    if (!a) return null;
    const plan = a.plan, b = bank(plan.level), map = new Map(b.questions.map(q => [q.id, q]));
    const qids = plan.sections.flatMap(s => s.qids), result = score(plan, a.answers, b);
    for (const id of qids) if (map.has(id)) P().record(qid(map.get(id)), a.answers[id] === map.get(id).answer, { now });
    const reasons = [];
    if (!plan.fresh) reasons.push('有些題目考過或來自練習題，不全是沒考過的新題');
    if (!plan.sections.some(s => s.key === 'listening')) reasons.push('沒有考聽解');
    if (a.interrupted) reasons.push('聽解中途中斷');
    if (countedMocks(plan.level).some(m => weekKey(new Date(m.at)) === weekKey(new Date(now)))) reasons.push('這週已經有一份計入的模擬考');
    const mock = { at: now, level: plan.level, kind: plan.kind, qids, answers: a.answers, result, counted: !reasons.length, reasons, paused: !!a.everPaused, abandoned: false, interrupted: !!a.interrupted };
    P().saveJlpt(j => { j.mocks.push(mock); });
    clearAttempt();
    checkGraduation(now);
    return mock;
  }
  // 記下畢業（同步合併後也會補記）；目前程度剛畢業、下一級有題庫 → 換到下一級（每級只自動換一次）
  function checkGraduation(now = Date.now()) {
    const level = settings().level;
    if (graduation(level).done && !P().jlpt().graduated[level]) P().saveJlpt(j => { j.graduated[level] = now; });
    const s = settings(), next = LEVELS[rank(level) + 1];
    if (P().jlpt().graduated[level] && next && !(s.movedOn || []).includes(level) && bank(next).questions.length) setSettings({ level: next, movedOn: [...(s.movedOn || []), level] });
  }
  // 各題型還沒考過的模擬考專用題數
  function mockPoolLeft(level = settings().level) {
    const seen = new Set(P().jlpt().mocks.flatMap(m => m.qids || []));
    const out = {};
    for (const q of bank(level).questions) if (q.pool === 'mock' && !q.example && !isReported(q) && !seen.has(q.id)) out[q.type] = (out[q.type] || 0) + 1;
    for (const t of Object.keys(TYPES)) out[t] ||= 0;
    return out;
  }

  // 中途結束考試：留下紀錄（不計入畢業），清掉進行中的狀態
  function abandonAttempt(now = Date.now()) {
    const a = attempt();
    if (!a) return null;
    const mock = { at: now, level: a.plan.level, kind: a.plan.kind, qids: a.plan.sections.flatMap(s => s.qids), answers: a.answers, abandoned: true, counted: false, paused: !!a.everPaused, interrupted: !!a.interrupted };
    P().saveJlpt(j => { j.mocks.push(mock); });
    clearAttempt();
    return mock;
  }
  // 回到考試頁（重新整理、離開後回來）：時間到的科目自動交出；聽解中途離開就算中斷，不計入畢業
  function resumeAttempt(now = Date.now()) {
    let a = attempt();
    while (a && !a.paused) {
      const sec = currentSection(a);
      if (!sec || sec.key === 'listening' || a.deadline == null || now < a.deadline) break;
      a = nextSection(now);
    }
    const sec = currentSection(a);
    if (a && sec && sec.key === 'listening' && a.listenIndex > 0 && !a.interrupted) a = saveAttempt({ ...a, interrupted: true });
    return a;
  }

  return { LEVELS, TYPES, SECTIONS, PASSAGE_TYPES, renderStem, validate, textErrors, esc,
    DEFAULTS, settings, setSettings, bank, qid, daysLeft, isReported, report, typeStats, dailySet,
    assembleMock, attempt, saveAttempt, clearAttempt, startAttempt, timeLeft, pauseAttempt, resumeTimer, nextSection, setAnswer, resumeAttempt, currentSection, abandonAttempt,
    score, weekKey, finishAttempt, graduation, countedMocks, checkGraduation, mockPoolLeft, PASS_TOTAL,
    voices, audioKey, audioFile, speechText, listeningLines, instructionLine };
})();
