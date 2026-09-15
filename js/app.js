// app.js — 路由與各視圖（首頁 / 學習地圖 / 筆記 / 測驗 / 五十音）
(() => {
  const $ = s => document.querySelector(s);
  const app = () => $('#app');
  const DATA = () => window.NIHONGO_DATA;
  const PLAN = () => window.NIHONGO_PLAN || [];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // 顯示 Notion 的 **粗體** 與 [連結](url)
  const rich = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b class="hl">$1</b>').replace(/\[(.+?)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  const doodle = n => window.DOODLES.get(n);
  const fmtDate = iso => { try { return new Date(iso).toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; } };

  // ────────────────────────────── 首頁 ──────────────────────────────
  function greeting() {
    const h = new Date().getHours();
    return h < 11 ? 'おはようございます' : h < 18 ? 'こんにちは' : 'こんばんは';
  }
  function syncHint() {
    if (!window.Sync) return '';
    if (!Sync.enabled()) return '<a href="#/sync">☁️ 跨裝置同步未設定</a>';
    const s = Sync.getStatus();
    return s.state === 'nocode' ? '<a href="#/sync">☁️ 尚未連結同步碼，點此設定</a>'
      : s.state === 'error' ? `<a href="#/sync">⚠️ 同步失敗：${esc(s.error)}</a>`
      : `<a href="#/sync">☁️ 同步碼 ${esc(Sync.getCode())}</a>`;
  }
  function currentLevel() {
    for (const p of PLAN()) { const s = Quiz.levelStats(p.level); if (s.total && s.pct < 80) return p; }
    return PLAN()[PLAN().length - 1];
  }
  function viewHome() {
    const d = DATA(); const o = Quiz.overallStats(); const lv = currentLevel();
    const ls = lv ? Quiz.levelStats(lv.level) : null;
    const recent = Progress.load().sessions.slice(-5).reverse();
    return `
    <section class="hero">
      <div class="hero-mascot">${doodle('daruma')}</div>
      <div>
        <p class="kicker">${greeting()}！</p>
        <h1>にほんごノート</h1>
        <p class="lead">從你的 Notion 筆記長出來的日文複習小站。今天也一起加油吧 ✿</p>
        <p class="meta">📡 Notion 最後同步：${fmtDate(d.syncedAt)} ・ ${syncHint()}</p>
        <div class="actions">
          <a class="btn primary" href="#/quiz?mode=daily">✏️ 今日複習 10 題</a>
          <a class="btn" href="#/map">🗺️ 看學習地圖</a>
        </div>
      </div>
    </section>

    <section class="stats">
      <div class="stat card tape"><div class="num">${o.vocab}</div><div class="lbl">單字 <small>筆記 ${o.notionVocab}・公開 ${o.externalVocab}</small></div>${doodle('onigiri')}</div>
      <div class="stat card tape"><div class="num">${o.mastered}</div><div class="lbl">已熟練</div>${doodle('star')}</div>
      <div class="stat card tape"><div class="num">${Progress.streakDays()}</div><div class="lbl">連續學習天</div>${doodle('torii')}</div>
      <div class="stat card tape"><div class="num">${o.weak}</div><div class="lbl">弱點待複習</div>${doodle('cloud')}</div>
    </section>

    <section class="grid2">
      <div class="card">
        <h2>🎯 目前階段：${lv ? esc(lv.level + ' ' + lv.title) : '—'}</h2>
        ${lv ? `<p>${esc(lv.goal)}</p>
        <div class="bar"><div class="fill" style="width:${ls.pct}%;background:${lv.color}"></div></div>
        <p class="meta">${ls.mastered} / ${ls.total} 個單字已熟練（${ls.pct}%）</p>
        <h3>本週建議</h3>
        <ul class="todo">${lv.weekly.map(w => `<li>${esc(w)}</li>`).join('')}</ul>
        <a class="btn small" href="#/quiz?levels=${lv.level}">開始 ${lv.level} 測驗</a>` : ''}
      </div>
      <div class="card">
        <h2>📖 筆記分頁</h2>
        <ul class="pagelist">
          ${d.pages.map((p, i) => `<li><a href="#/notes/${i}"><span class="ico">${esc(p.icon)}</span>${esc(p.title)}<span class="cnt">${p.sections.length} 段</span></a></li>`).join('')}
        </ul>
      </div>
    </section>

    <section class="card">
      <h2>🕰️ 最近測驗</h2>
      ${recent.length ? `<ul class="sessions">${recent.map(s => `<li><span>${fmtDate(s.at)}</span><b>${s.score} / ${s.total}</b><span class="tag">${esc(s.mode)}</span></li>`).join('')}</ul>` : '<p class="meta">還沒有紀錄，來做第一份測驗吧！</p>'}
    </section>`;
  }

  // ────────────────────────────── 學習地圖 ──────────────────────────────
  function viewMap() {
    const cards = PLAN().map((p, i) => {
      const s = Quiz.levelStats(p.level);
      const ks = Quiz.kanjiStats(p.level);
      const done = s.total && s.pct >= 80;
      return `
      <li class="map-node ${i % 2 ? 'right' : 'left'} ${done ? 'done' : ''}">
        <div class="gate" style="--c:${p.color}">${doodle('torii')}<span>${p.level}</span></div>
        <div class="card map-card">
          <div class="map-head">
            <div class="map-mascot">${doodle(p.mascot)}</div>
            <div><h2>${p.level} <small>${esc(p.title)}</small></h2><p class="meta">建議 ${p.weeks} 週 ・ ${s.total} 個單字（筆記 ${s.notion}・公開 ${s.external}）</p></div>
          </div>
          <p>${esc(p.goal)}</p>
          <div class="bar"><div class="fill" style="width:${s.pct}%;background:${p.color}"></div></div>
          <p class="meta">熟練 ${s.mastered}／看過 ${s.seen}／弱點 ${s.weak}${done ? ' ・ 🎉 已達標' : ''}</p>
          ${ks.total ? `<p class="meta">🀄 <a href="#/kanji/${p.level}">漢字 ${ks.total} 字</a>，熟練 ${ks.mastered}</p><div class="bar thin"><div class="fill" style="width:${ks.pct}%;background:${p.color}"></div></div>` : ''}
          <details><summary>每週重點與里程碑</summary>
            <ul class="todo">${p.weekly.map(w => `<li>${esc(w)}</li>`).join('')}</ul>
            <ul class="milestones">${p.milestones.map(m => `<li>🏁 ${esc(m)}</li>`).join('')}</ul>
          </details>
          <div class="actions">
            <a class="btn small primary" href="#/quiz?levels=${p.level}">開始 ${p.level} 測驗</a>
            ${s.weak ? `<a class="btn small" href="#/quiz?levels=${p.level}&weak=1">只練弱點 (${s.weak})</a>` : ''}
          </div>
        </div>
      </li>`;
    }).join('');
    return `
    <section class="page-head"><h1>🗺️ 學習地圖 N5 → N1</h1><p class="lead">沿著小路一座座鳥居走過去。規劃內容在 <code>data/plan.js</code>，可以自己改。</p></section>
    <ol class="map">${cards}</ol>
    <div class="map-end">${doodle('fuji')}<p>ゴール！🎌</p></div>`;
  }

  // ────────────────────────────── 筆記 ──────────────────────────────
  function renderBlock(b) {
    if (b.type === 'table') {
      return `<div class="tablewrap"><table>${b.headers.length ? `<thead><tr>${b.headers.map(h => `<th>${rich(h)}</th>`).join('')}</tr></thead>` : ''}<tbody>${b.rows.map(r => `<tr>${r.map(c => `<td>${rich(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }
    if (b.type === 'quote') return `<blockquote>${rich(b.text)}</blockquote>`;
    if (b.type === 'list') return `<ul>${b.items.map(i => `<li>${rich(i)}</li>`).join('')}</ul>`;
    return `<p>${rich(b.text)}</p>`;
  }
  function viewNotes(idx = 0, q = '') {
    const d = DATA(); idx = Math.min(Math.max(+idx || 0, 0), d.pages.length - 1);
    const page = d.pages[idx];
    const query = q.trim().toLowerCase();
    let body;
    if (query) {
      const hits = [];
      d.pages.forEach((p, pi) => p.sections.forEach(s => {
        const text = (s.heading + ' ' + JSON.stringify(s.blocks)).toLowerCase();
        if (text.includes(query)) hits.push({ p, pi, s });
      }));
      body = hits.length ? hits.map(({ p, pi, s }) => `<article class="card"><p class="meta"><a href="#/notes/${pi}">${esc(p.icon)} ${esc(p.title)}</a></p><h2>${rich(s.heading)}</h2>${s.blocks.map(renderBlock).join('')}</article>`).join('')
        : `<div class="card"><p>找不到「${esc(q)}」。</p></div>`;
    } else {
      body = page.sections.map(s => `<article class="card ${s.level === 3 ? 'sub' : ''}">${s.heading ? `<h${s.level === 3 ? 3 : 2}>${rich(s.heading)}</h${s.level === 3 ? 3 : 2}>` : ''}${s.blocks.map(renderBlock).join('')}</article>`).join('');
    }
    return `
    <section class="page-head"><h1>📖 筆記</h1>
      <form class="search" onsubmit="event.preventDefault();location.hash='#/notes/${idx}?q='+encodeURIComponent(this.q.value)">
        <input name="q" placeholder="搜尋全部筆記…（例如：ちょっと）" value="${esc(q)}"><button class="btn small">🔍</button>
      </form>
    </section>
    <div class="notes">
      <nav class="card sidebar">
        <ul>${d.pages.map((p, i) => `<li class="${i === idx && !query ? 'active' : ''}"><a href="#/notes/${i}"><span class="ico">${esc(p.icon)}</span>${esc(p.title)}</a></li>`).join('')}</ul>
        <p class="meta">📡 ${fmtDate(page.edited || d.syncedAt)}</p>
      </nav>
      <div class="notes-body">${query ? '' : `<h1 class="note-title">${esc(page.icon)} ${esc(page.title)}</h1>`}${body}</div>
    </div>`;
  }

  // ────────────────────────────── 五十音 ──────────────────────────────
  function viewKana(mode = 'hira') {
    const kana = DATA().kana;
    const groups = {};
    for (const k of kana) (groups[k.group] ||= {})[k.row] = [...((groups[k.group] || {})[k.row] || []), k];
    const cell = k => `<button class="kana" data-say="${esc(k.hira)}"><span class="big">${esc(mode === 'hira' ? k.hira : k.kata)}</span><span class="small">${esc(k.romaji)}</span></button>`;
    const html = Object.entries(groups).map(([g, rows]) => `
      <section class="card"><h2>${esc(g)}</h2>
        <div class="kana-grid">${Object.entries(rows).map(([r, ks]) => `<div class="kana-row"><span class="rowname">${esc(r)}</span>${ks.map(cell).join('')}</div>`).join('')}</div>
      </section>`).join('');
    return `
    <section class="page-head"><h1>🈁 五十音</h1>
      <div class="actions">
        <a class="btn small ${mode === 'hira' ? 'primary' : ''}" href="#/kana/hira">平假名</a>
        <a class="btn small ${mode === 'kata' ? 'primary' : ''}" href="#/kana/kata">片假名</a>
        <a class="btn small" href="#/quiz?types=kana">✏️ 假名測驗</a>
        <span class="meta">點一下假名會唸給你聽 🔊</span>
      </div>
    </section>${html}`;
  }
  function speak(text) {
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text); u.lang = 'ja-JP'; u.rate = 0.9;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  }

  // ────────────────────────────── 測驗 ──────────────────────────────
  const quiz = { qs: [], i: 0, score: 0, answered: false, mode: '', wrong: [] };

  function viewQuizSetup(params) {
    const levels = (params.get('levels') || '').split(',').filter(Boolean);
    const types = (params.get('types') || 'vocab_meaning,vocab_reading').split(',').filter(Boolean);
    const weak = params.get('weak') === '1';
    const origins = (params.get('origins') || '').split(',').filter(Boolean);
    const chip = (name, val, label, on) => `<label class="chip ${on ? 'on' : ''}"><input type="checkbox" name="${name}" value="${val}" ${on ? 'checked' : ''}>${label}</label>`;
    const o = Quiz.overallStats();
    return `
    <section class="page-head"><h1>✏️ 複習測驗</h1><p class="lead">選好範圍就開始。題目會優先出沒看過和常錯的。</p></section>
    <form id="quiz-setup" class="card">
      <h3>題型</h3>
      <div class="chips">${Object.entries(Quiz.TYPES).map(([k, t]) => chip('types', k, t.label, types.includes(k))).join('')}</div>
      <h3>等級（單字題看單字等級，漢字題看漢字等級）</h3>
      <div class="chips">${Quiz.LEVELS.map(l => {
        const s = Quiz.levelStats(l);
        // 只有漢字、沒有單字的等級（例如「其他」）改顯示漢字數，免得看起來像 0 題
        const label = s.total ? `${l} <small>${s.mastered}/${s.total}</small>` : `${l} <small>漢字 ${Quiz.kanjiStats(l).total}</small>`;
        return chip('levels', l, label, levels.includes(l));
      }).join('')}</div>
      <p class="meta">不勾等級 = 全部等級</p>
      <h3>單字來源</h3>
      <div class="chips">${chip('origins', 'notion', `📓 我的筆記 <small>${o.notionVocab}</small>`, origins.includes('notion'))}${chip('origins', 'external', `🌐 公開單字 <small>${o.externalVocab}</small>`, origins.includes('external'))}</div>
      <p class="meta">不勾來源 = 兩種都出。公開單字的中文是 AI 翻譯。</p>
      <h3>題數</h3>
      <div class="chips">${[10, 20, 30].map(n => `<label class="chip ${n === 10 ? 'on' : ''}"><input type="radio" name="count" value="${n}" ${n === 10 ? 'checked' : ''}>${n} 題</label>`).join('')}</div>
      <label class="chip ${weak ? 'on' : ''}"><input type="checkbox" name="weak" ${weak ? 'checked' : ''}>只出弱點題（目前 ${o.weak} 個）</label>
      <div class="actions"><button class="btn primary big">開始！いってきます 🏃</button></div>
    </form>`;
  }

  function startQuiz(opts, mode) {
    quiz.qs = Quiz.buildQuestions(opts); quiz.i = 0; quiz.score = 0; quiz.answered = false; quiz.mode = mode; quiz.wrong = [];
    if (!quiz.qs.length) { app().innerHTML = `<div class="card"><h2>沒有符合的題目 🍙</h2><p>試試放寬等級或題型，或先做一般測驗累積弱點。</p><a class="btn" href="#/quiz">回設定</a></div>`; return; }
    renderQuestion();
  }

  function renderQuestion() {
    const q = quiz.qs[quiz.i];
    app().innerHTML = `
    <section class="quiz">
      <div class="quiz-top"><span class="tag">${esc(q.typeLabel)}</span><span class="meta">${quiz.i + 1} / ${quiz.qs.length}</span><span class="score">⭐ ${quiz.score}</span></div>
      <div class="bar"><div class="fill" style="width:${quiz.i / quiz.qs.length * 100}%"></div></div>
      <div class="card question tape">
        <div class="prompt ${[...q.prompt].length === 1 ? 'single' : ''}">${q.promptHtml || esc(q.prompt)}</div>
        ${q.sub ? `<div class="sub">${esc(q.sub)}</div>` : ''}
        ${q.type.startsWith('kanji') ? '' : q.type !== 'kana' &&/[぀-ヿ一-鿿]/.test(q.prompt) ? `<button class="btn tiny say" data-say="${esc(q.item.reading || q.prompt)}">🔊</button>` : `<button class="btn tiny say" data-say="${esc(q.prompt)}">🔊</button>`}
      </div>
      <div class="choices">${q.choices.map((c, i) => `<button class="btn choice" data-i="${i}"><span class="key">${'ABCD'[i]}</span>${esc(c)}</button>`).join('')}</div>
      <div id="feedback" class="feedback"></div>
    </section>`;
  }

  function answer(i) {
    if (quiz.answered) return;
    quiz.answered = true;
    const q = quiz.qs[quiz.i];
    const ok = q.choices[i] === q.answer;
    Progress.record(q.id, ok);
    if (ok) quiz.score++; else quiz.wrong.push(q);
    document.querySelectorAll('.choice').forEach((b, j) => {
      if (q.choices[j] === q.answer) b.classList.add('correct');
      else if (j === i) b.classList.add('wrong');
      b.disabled = true;
    });
    const it = q.item;
    const extra = [it.reading && it.reading !== q.prompt ? `讀音：${esc(it.reading)}` : '',
      it.meaningEn && it.meaningEn !== it.meaning ? `英文：${esc(it.meaningEn)}${it.ai ? ' <span class="tag">AI 翻譯</span>' : ''}` : '',
      it.example ? `例句：${esc(it.example)}` : '', it.usage ? `用法：${esc(it.usage)}` : '', q.detail ? esc(q.detail) + (q.type === 'kanji_word' ? ` <button class="btn tiny" data-say="${esc(it.reading)}">🔊</button>` : '') : '',
      it.source ? `<span class="meta">出處：${esc(it.source)}</span>` : ''].filter(Boolean).join('<br>');
    $('#feedback').innerHTML = `<div class="card ${ok ? 'good' : 'bad'}">${ok ? window.DOODLES.checkmark + '<b>正解！すごい！</b>' : window.DOODLES.cross + `<b>答案是：${esc(q.answer)}</b>`}<div class="extra">${extra}</div>
      <button class="btn primary" id="next">${quiz.i + 1 < quiz.qs.length ? '下一題 →' : '看結果 🎉'}</button></div>`;
    $('#next').focus();
  }

  function nextQuestion() {
    quiz.i++; quiz.answered = false;
    if (quiz.i < quiz.qs.length) renderQuestion(); else renderResult();
  }

  function renderResult() {
    Progress.endSession(quiz.score, quiz.qs.length, quiz.mode);
    const pct = Math.round(quiz.score / quiz.qs.length * 100);
    const msg = pct === 100 ? '満点！すばらしい！🎊' : pct >= 80 ? 'よくできました！🌸' : pct >= 50 ? 'まあまあ、もう一回！🍙' : 'がんばれ！弱點再練一次 💪';
    app().innerHTML = `
    <section class="result">
      <div class="card tape center">
        <div class="result-mascot">${doodle(pct >= 80 ? 'maneki' : 'daruma')}</div>
        <h1>${quiz.score} / ${quiz.qs.length}</h1>
        <p class="lead">${msg}</p>
        <div class="actions">
          <a class="btn primary" href="#/quiz">再來一次</a>
          ${quiz.wrong.length ? `<button class="btn" id="retry-wrong">只練錯的 (${quiz.wrong.length})</button>` : ''}
          <a class="btn" href="#/">回首頁</a>
        </div>
      </div>
      ${quiz.wrong.length ? `<div class="card"><h2>這次答錯的</h2><ul class="wrong-list">${quiz.wrong.map(q => `<li><b>${esc(q.prompt)}</b>${q.sub ? `<span class="meta">${esc(q.sub)}</span>` : ''} → ${esc(q.answer)}</li>`).join('')}</ul></div>` : ''}
    </section>`;
    $('#retry-wrong')?.addEventListener('click', () => {
      const ids = new Set(quiz.wrong.map(q => q.id));
      const qs = quiz.wrong.map(q => ({ ...q, choices: [...q.choices].sort(() => Math.random() - 0.5) }));
      quiz.qs = qs; quiz.i = 0; quiz.score = 0; quiz.answered = false; quiz.wrong = []; quiz.mode = '錯題重練';
      renderQuestion(); void ids;
    });
  }

  // ────────────────────────────── 漢字 ──────────────────────────────
  const KLEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
  function kanjiDetailHtml(k) {
    const A = window.KanjiAlign;
    const uses = DATA().kanjiUses?.get(k.k) || [];
    const special = DATA().kanjiSpecial?.get(k.k) || [];
    const segs = [...new Set(uses.map(u => u.seg))];
    return `
      <div class="kd-head">
        <div class="kd-char">${esc(k.k)}</div>
        <div>
          <p class="meta">${k.level}・${k.strokes ?? '?'} 畫${k.grade && k.grade <= 6 ? `・日本小學 ${k.grade} 年級` : ''}</p>
          ${k.trad.length ? `<p>繁體寫法：<b class="hl">${esc(k.trad.join('／'))}</b></p>` : '<p class="meta">和繁體寫法相同</p>'}
          <p class="meta">${esc(k.meanings.join(', '))}</p>
        </div>
        <button class="btn tiny" data-say="${esc(k.k)}">🔊</button>
      </div>
      <p><span class="tag">音讀</span> ${k.on.length ? esc(k.on.map(A.toKata).join('・')) : '—'}</p>
      <p><span class="tag">訓讀</span> ${(k.kunTop || k.kun).length ? (k.kunTop || k.kun).map(A.kunHtml).join('・') : '—'}</p>
      ${uses.length ? `<h3>在你的單字裡 <small>${uses.length} 個詞</small></h3>
        <p class="meta">這個字出現過的唸法：${esc(segs.join('、'))}</p>
        <ul class="kd-words">${uses.slice(0, 12).map(u => `<li><span class="kd-w">${A.highlightHtml(u)}</span> <span class="meta">${A.readingHtml(u)}</span> ${esc(u.meaning)}</li>`).join('')}</ul>` : '<p class="meta">你目前的單字裡還沒有用到這個字。</p>'}
      ${special.length ? `<h3>特殊讀法 <small>不拆字唸</small></h3>
        <ul class="kd-words">${special.slice(0, 8).map(v => `<li><span class="kd-w">${esc(v.word)}</span> <span class="meta">${esc(v.reading)}</span> ${esc(v.meaning)}</li>`).join('')}</ul>` : ''}`;
  }
  function viewKanji(level, sel) {
    const K = DATA().kanji || [];
    if (!K.length) return `<div class="card"><h2>還沒有漢字資料</h2><p>請先執行 <code>npm run build:kanji</code> 產生 <code>data/kanji.js</code>。</p></div>`;
    const levels = K.some(k => k.level === '其他') ? [...KLEVELS, '其他'] : KLEVELS;
    if (!levels.includes(level)) level = 'N5';
    const list = K.filter(k => k.level === level);
    const st = Quiz.kanjiStats(level);
    const cur = sel ? K.find(k => k.k === sel) : null;
    const words = (DATA().kanjiWords || []).filter(w => w.level === level).length;
    const cell = k => `<a class="kj ${Quiz.kanjiStatus(k)} ${cur === k ? 'on' : ''}" href="#/kanji/${level}/${encodeURIComponent(k.k)}" title="${esc(k.meanings.join(', '))}"><span class="big">${esc(k.k)}</span>${k.trad.length ? `<span class="trad">${esc(k.trad[0])}</span>` : ''}</a>`;
    return `
    <section class="page-head"><h1>🀄 漢字</h1>
      <p class="lead">字義你一看就懂，難的是讀音。這裡練音讀、訓讀，還有同一個字放進不同詞裡怎麼唸。</p>
      <div class="actions">${levels.map(l => `<a class="btn small ${l === level ? 'primary' : ''}" href="#/kanji/${l}">${l} <small>${K.filter(k => k.level === l).length}</small></a>`).join('')}</div>
    </section>
    <div class="grid2">
      <div class="card">
        <h2>${level} 漢字 <small>${list.length} 字</small></h2>
        ${level === '其他' ? '<p class="meta">tanos 的 JLPT 漢字表沒有收錄、但出現在你單字裡的日本常用漢字，例如「分」。不確定屬於哪一級，所以單獨放在這裡。</p>' : ''}
        <div class="bar"><div class="fill" style="width:${st.pct}%"></div></div>
        <p class="meta">熟練 ${st.mastered} / ${st.total}：音讀、訓讀題都連對 3 次才算。字格右下的紅色小字是繁體寫法，只有和日本寫法不同才會出現。</p>
        <div class="actions">
          <a class="btn small primary" href="#/quiz?types=kanji_on,kanji_kun&levels=${level}">✏️ 字的讀音</a>
          ${words ? `<a class="btn small" href="#/quiz?types=kanji_word&levels=${level}">✏️ 詞裡的讀音 <small>${words}</small></a>` : '<span class="meta">這一級的字還沒出現在你的單字裡，暫時沒有「詞裡的讀音」題。</span>'}
        </div>
      </div>
      <div class="card kanji-detail">${cur ? kanjiDetailHtml(cur) : '<p class="meta">👇 點下面任一個字，看讀音和用到它的單字。</p>'}</div>
    </div>
    <section class="card"><div class="kj-grid">${list.map(cell).join('')}</div></section>`;
  }

  // ────────────────────────────── 跨裝置同步 ──────────────────────────────
  function viewSync(msg = '') {
    if (!Sync.enabled()) {
      return `
      <section class="page-head"><h1>☁️ 跨裝置同步</h1><p class="lead">把測驗進度存到雲端，換手機、換電腦都接得上。</p></section>
      <div class="card"><h2>尚未設定</h2>
        <p>需要一個免費的 Supabase 專案。步驟：</p>
        <ol>
          <li>到 <a href="https://supabase.com/dashboard" target="_blank" rel="noopener">supabase.com/dashboard</a> 建立新專案（Region 選 Northeast Asia (Tokyo) 比較近）。</li>
          <li>左側 <b>SQL Editor</b> → New query → 貼上 <code>sync/supabase-schema.sql</code> 全部內容 → Run。</li>
          <li>左側 <b>Project Settings → API</b>：複製 <b>Project URL</b> 與 <b>anon public</b> key，貼進 <code>data/sync-config.js</code>。</li>
          <li>重新整理這一頁。</li>
        </ol>
      </div>`;
    }
    const code = Sync.getCode(); const st = Sync.getStatus();
    const o = Quiz.overallStats();
    return `
    <section class="page-head"><h1>☁️ 跨裝置同步</h1><p class="lead">一組同步碼 = 一份進度。在每台裝置貼上同一組碼，進度就會合併在一起。</p></section>
    ${msg ? `<div class="card ${msg.startsWith('⚠️') ? 'bad' : 'good'}"><p>${esc(msg)}</p></div>` : ''}
    ${code ? `
    <div class="card tape">
      <h2>這台裝置的同步碼</h2>
      <div class="synccode"><code id="synccode-text">${esc(code)}</code><button class="btn small" id="copy-code">📋 複製</button></div>
      <p class="meta">狀態：${esc(st.state === 'ok' ? '已同步 ' + fmtDate(st.at) : st.state === 'error' ? '同步失敗：' + st.error : st.state === 'syncing' ? '同步中…' : '待同步')} ・ 本機已熟練 ${o.mastered}／弱點 ${o.weak}</p>
      <p>把這組碼抄到另一台裝置的同一個頁面，按「連結」，兩邊的進度就會合併。</p>
      <div class="actions">
        <button class="btn small" id="sync-now">🔄 立即同步</button>
        <button class="btn small" id="unlink">🔌 這台裝置斷開</button>
      </div>
    </div>` : `
    <div class="card tape">
      <h2>還沒有同步碼</h2>
      <p>第一台裝置按「產生」，之後其他裝置用「連結」貼同一組碼。</p>
      <div class="actions"><button class="btn primary" id="create-code">✨ 產生新的同步碼</button></div>
    </div>`}
    <div class="card">
      <h2>${code ? '改連結另一組碼' : '連結既有的同步碼'}</h2>
      <form id="link-form" class="search">
        <input name="code" placeholder="例如 sakura-ab3d-k9m2-x4bd" autocomplete="off" spellcheck="false">
        <button class="btn small primary">連結</button>
      </form>
      <p class="meta">連結時會先下載雲端進度，跟這台裝置的合併後再上傳。同一題以看過次數多的為準，不會互相覆蓋掉。</p>
    </div>
    <div class="card">
      <h3>小提醒</h3>
      <ul>
        <li>同步碼就像鑰匙：知道的人可以讀寫這份進度。裡面只有測驗統計，沒有個人資料。</li>
        <li>離線時照常可以測驗，回到線上會自動補上傳。</li>
        <li>想從頭來過：斷開後再產生新的碼。</li>
      </ul>
    </div>`;
  }
  async function syncAction(fn, okMsg) {
    try { const r = await fn(); app().innerHTML = viewSync(typeof okMsg === 'function' ? okMsg(r) : okMsg); }
    catch (e) { app().innerHTML = viewSync('⚠️ ' + e.message); }
  }

  // ────────────────────────────── 路由 ──────────────────────────────
  function route() {
    if (!DATA()) { app().innerHTML = `<div class="card"><h2>尚未同步 Notion 內容</h2><p>請先執行 <code>node sync/sync-notion.mjs</code>（或 <code>node sync/build-data.mjs</code>）產生 <code>data/content.js</code>。</p></div>`; return; }
    const [pathPart, qs = ''] = location.hash.slice(1).split('?');
    const params = new URLSearchParams(qs);
    const seg = pathPart.split('/').filter(Boolean);
    const view = seg[0] || 'home';
    document.querySelectorAll('nav.top a').forEach(a => a.classList.toggle('active', a.dataset.view === view));
    window.scrollTo(0, 0);
    switch (view) {
      case 'map': app().innerHTML = viewMap(); break;
      case 'notes': app().innerHTML = viewNotes(seg[1], params.get('q') || ''); break;
      case 'kana': app().innerHTML = viewKana(seg[1] || 'hira'); break;
      case 'sync': app().innerHTML = viewSync(); break;
      // 等級也要解碼：「其他」在網址裡會變成 %E5%85%B6%E4%BB%96
      case 'kanji': app().innerHTML = viewKanji(decodeURIComponent(seg[1] || ''), decodeURIComponent(seg[2] || '')); break;
      case 'quiz':
        if (params.get('mode') === 'daily') { startQuiz({ types: ['vocab_meaning', 'vocab_reading', 'grammar', 'phrase'], count: 10 }, '今日複習'); break; }
        app().innerHTML = viewQuizSetup(params); break;
      default: app().innerHTML = viewHome();
    }
  }

  document.addEventListener('submit', e => {
    if (e.target.id === 'link-form') {
      e.preventDefault();
      const code = e.target.code.value;
      return syncAction(() => Sync.link(code), '✅ 已連結，進度合併完成。');
    }
    if (e.target.id !== 'quiz-setup') return;
    e.preventDefault();
    const f = new FormData(e.target);
    const opts = { types: f.getAll('types'), levels: f.getAll('levels'), origins: f.getAll('origins'), count: +f.get('count') || 10, weakOnly: f.get('weak') === 'on' };
    const originLabel = opts.origins.length === 1 ? (opts.origins[0] === 'notion' ? '筆記 ' : '公開 ') : '';
    startQuiz(opts, (opts.weakOnly ? '弱點 ' : '') + originLabel + (opts.levels.join('+') || '全部'));
  });
  document.addEventListener('click', e => {
    const c = e.target.closest('.choice'); if (c) return answer(+c.dataset.i);
    if (e.target.closest('#next')) return nextQuestion();
    const s = e.target.closest('[data-say]'); if (s) return speak(s.dataset.say);
    if (e.target.closest('#create-code')) return syncAction(() => Sync.createNew(), c => `✅ 已產生同步碼 ${c}，把它抄到其他裝置就能接上。`);
    if (e.target.closest('#sync-now')) return syncAction(() => Sync.pull(), '✅ 同步完成。');
    if (e.target.closest('#unlink')) { if (confirm('這台裝置會停止同步（本機進度保留，雲端資料也還在）。確定？')) { Sync.unlink(); app().innerHTML = viewSync('已斷開。'); } return; }
    if (e.target.closest('#copy-code')) { navigator.clipboard?.writeText($('#synccode-text').textContent).then(() => { $('#copy-code').textContent = '✅ 已複製'; }); return; }
    const chip = e.target.closest('.chip'); if (chip) setTimeout(() => chip.classList.toggle('on', chip.querySelector('input').checked), 0);
  });
  document.addEventListener('keydown', e => {
    if (!quiz.qs.length || !$('.choice')) return;
    const k = e.key.toUpperCase();
    if ('ABCD'.includes(k) && k) answer('ABCD'.indexOf(k));
    if ((e.key === 'Enter' || e.key === ' ') && quiz.answered && $('#next')) { e.preventDefault(); nextQuestion(); }
  });
  window.addEventListener('hashchange', route);
  window.addEventListener('DOMContentLoaded', () => {
    document.body.insertAdjacentHTML('beforeend', window.DOODLES.wobbleFilter);
    Sync.init();
    Sync.onStatus(() => { if (location.hash.startsWith('#/sync')) { /* 狀態列已由 pill 更新；頁面等下次操作再重畫 */ } });
    // 櫻花花瓣
    const petals = $('#petals');
    for (let i = 0; i < 14; i++) {
      const p = document.createElement('span'); p.className = 'petal';
      p.style.cssText = `left:${Math.random() * 100}%;animation-delay:${-Math.random() * 18}s;animation-duration:${14 + Math.random() * 10}s;transform:scale(${0.5 + Math.random() * 0.7})`;
      p.innerHTML = window.DOODLES.sakura; petals.appendChild(p);
    }
    route();
  });
})();
