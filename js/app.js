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
    return PLAN().find(p => p.level === Study.profile().level) || PLAN()[0];
  }
  function studyForm() {
    const p = Study.profile();
    return `<form id="study-profile" class="study-form">
      <label>目前程度<select name="level">${PLAN().map(l => `<option ${l.level === p.level ? 'selected' : ''}>${l.level}</option>`).join('')}</select></label>
      <label>學習目標<select name="goal">${['日常會話', '考試複習'].map(g => `<option ${g === p.goal ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
      <label>每週新單字<select name="weekly">${[15, 30, 50].map(n => `<option value="${n}" ${n === p.weekly ? 'selected' : ''}>${n} 個</option>`).join('')}</select></label>
      <button class="btn small primary">儲存學習設定</button><p class="meta">每週從週一開始計算。設定保存在這台裝置；測驗進度可另外連結跨裝置同步。</p>
    </form>`;
  }
  function masteryHelp() {
    return '<details class="mastery-help"><summary>什麼是跨日熟練？</summary><p>不看提示，在到期後獨立答對 3 次，且每次至少間隔 24 小時。答對後依序安排 1、3、7、14、30 天再複習；答錯或看提示則 10 分鐘後再練。同日提前重做不增加跨日次數。舊紀錄保留，但需重新完成跨日驗證。</p><p>這是本站題目的記憶紀錄，不代表已通過 JLPT，也不等於能在所有情境運用。</p></details>';
  }
  function lessonActions(page) {
    const level = Study.profile().level;
    if (page.title.includes('五十音') || page.title.includes('發音')) return '<a class="btn small" href="#/kana">聽讀五十音</a><a class="btn small" href="#/quiz?types=kana">練習假名</a>';
    const sources = [...DATA().vocab, ...DATA().grammar, ...DATA().phrases].filter(x => x.source?.startsWith(page.title + ' › '));
    return sources.length ? `<a class="btn small" href="#/quiz?page=${encodeURIComponent(page.title)}&levels=all">練習本頁內容</a>` : `<a class="btn small" href="#/quiz?levels=${level}">練習 ${level} 單字</a>`;
  }
  function viewHome() {
    const d = DATA(); const o = Quiz.overallStats(); const lv = currentLevel();
    const ls = lv ? Quiz.levelStats(lv.level) : null;
    const recent = Progress.load().sessions.slice(-5).reverse();
    const profile = Study.profile();
    const daily = Quiz.buildQuestions(Study.dailyOptions());
    const due = DATA().vocab.filter(v => v.level === profile.level && Progress.stat(v.id).seen && (!Progress.stat(v.id).due || Progress.stat(v.id).due <= Date.now())).length;
    const newCount = daily.filter(q => !Progress.stat(q.id).seen).length;
    return `
    <section class="hero">
      <div class="hero-mascot">${doodle('daruma')}</div>
      <div>
        <p class="kicker">${greeting()}！</p>
        <h1>にほんごノート</h1>
        <p class="lead">今天的 ${profile.level} 練習：${due} 個到期單字，最多新學 ${newCount} 個。</p>
        <p>先複習，再學新內容。${daily.length ? `這一輪 ${daily.length} 題，預計約 ${Math.max(2, Math.ceil(daily.length * .6))} 分鐘。` : '目前沒有到期或待新學的題目，可以閱讀筆記或自選練習。'}</p>
        <div class="actions">
          <a class="btn primary" href="#/quiz?mode=daily">✏️ ${daily.length ? `開始今日 ${daily.length} 題` : '查看今日複習'}</a>
          <a class="btn" href="#/map">🗺️ 看學習地圖</a>
        </div>
      </div>
    </section>

    <details class="card profile" ${profile.configured ? '' : 'open'}><summary>${profile.configured ? `學習設定：${profile.level}・${profile.goal}・每週 ${profile.weekly} 個新單字` : '第一次使用：設定你的程度和目標'}</summary>${studyForm()}</details>

    <section class="stats">
      <div class="stat card tape"><div class="num">${due}</div><div class="lbl">${profile.level} 到期單字</div>${doodle('onigiri')}</div>
      <div class="stat card tape"><div class="num">${o.mastered}</div><div class="lbl">跨日熟練項目</div>${doodle('star')}</div>
      <div class="stat card tape"><div class="num">${Progress.streakDays()}</div><div class="lbl">連續學習天</div>${doodle('torii')}</div>
      <div class="stat card tape"><div class="num">${o.weak}</div><div class="lbl">弱點待複習</div>${doodle('cloud')}</div>
    </section>

    <section class="grid2">
      <div class="card">
        <h2>🎯 目前階段：${lv ? esc(lv.level + ' ' + lv.title) : '—'}</h2>
        ${lv ? `<p>${esc(lv.goal)}</p>
        <div class="bar"><div class="fill" style="width:${ls.pct}%;background:${lv.color}"></div></div>
        <p class="meta">本站 ${lv.level} 收錄 ${ls.total} 個單字，跨日熟練 ${ls.mastered} 個（${ls.pct}%）。${lv.partial ? '本級為部分筆記，仍在補充。' : ''}</p>
        ${masteryHelp()}
        <h3>本週建議</h3>
        <ul class="todo"><li>每週新學 ${profile.weekly} 個單字；到期項目另外複習。</li>${weeklyLinks(lv)}</ul>
        <a class="btn small" href="#/quiz?levels=${lv.level}">開始 ${lv.level} 測驗</a>` : ''}
      </div>
      <div class="card">
        <h2>📖 筆記分頁</h2>
        <ul class="pagelist">
          ${d.pages.map((p, i) => `<li><a href="#/notes/${i}"><span class="ico">${esc(p.icon)}</span>${esc(p.title)}<span class="cnt">${p.sections.length} 段</span></a></li>`).join('')}
        </ul>
      </div>
    </section>

    <p class="meta">教材來自作者的 Notion 筆記與公開字表，共 ${o.vocab} 個單字（筆記 ${o.notionVocab}・公開 ${o.externalVocab}）。教材同步：${fmtDate(d.syncedAt)} ・ ${syncHint()}</p>
    <section class="card">
      <h2>🕰️ 最近測驗</h2>
      ${recent.length ? `<ul class="sessions">${recent.map(s => `<li><span>${fmtDate(s.at)}</span><b>${s.score} / ${s.total}</b><span class="tag">${esc(s.mode)}</span></li>`).join('')}</ul>` : '<p class="meta">還沒有紀錄，來做第一份測驗吧！</p>'}
    </section>`;
  }

  // ────────────────────────────── 學習地圖 ──────────────────────────────
  function weeklyLinks(p) {
    const activities = Study.profile().goal === '日常會話' ? [['常用會話', '每日聽讀一組會話，再遮住中文回想'], ['文法筆記', '每週練習一個文法單元']] : [['文法筆記', '每週閱讀文法並完成例句填空'], ['閱讀練習', '每週閱讀短文並用自己的話複述']];
    const links = activities.map(([title, label]) => { const i = DATA().pages.findIndex(x => x.title === title); return i < 0 ? '' : `<li><a href="#/notes/${i}">${label}</a></li>`; }).join('');
    return (p.level === 'N5' ? '<li><a href="#/kana">每天聽讀 10 個假名，再做假名練習</a></li>' : '') + links;
  }
  function viewMap() {
    const cards = PLAN().map((p, i) => {
      const s = Quiz.levelStats(p.level);
      const ks = Quiz.kanjiStats(p.level);
      const done = s.total && s.pct >= 80;
      const estimate = Study.estimate(s.total, s.mastered);
      return `
      <li class="map-node ${i % 2 ? 'right' : 'left'} ${done ? 'done' : ''}">
        <div class="gate" style="--c:${p.color}">${doodle('torii')}<span>${p.level}</span></div>
        <div class="card map-card">
          <div class="map-head">
            <div class="map-mascot">${doodle(p.mascot)}</div>
            <div><h2>${p.level} <small>${esc(p.title)}</small></h2><p class="meta">本站收錄 ${s.total} 個單字（筆記 ${s.notion}・公開 ${s.external}）</p>${p.partial ? '<span class="tag">部分筆記・持續補充</span>' : ''}</div>
          </div>
          <p>${esc(p.goal)}</p>
          <div class="bar"><div class="fill" style="width:${s.pct}%;background:${p.color}"></div></div>
          <p class="meta">跨日熟練 ${s.mastered}／看過 ${s.seen}／弱點 ${s.weak}${done ? ' ・ 本站收錄範圍達標' : ''}</p>
          <p>本站 80% 目標：${estimate.target} 個，尚差 ${estimate.remaining} 個。依每週 ${Study.profile().weekly} 個，需約 ${estimate.weeks} 週接觸剩餘目標，另需跨日複習；這不是通過 ${p.level} 的時間預測。</p>
          ${ks.total ? `<p class="meta">🀄 <a href="#/kanji/${p.level}">漢字 ${ks.total} 字</a>，熟練 ${ks.mastered}</p><div class="bar thin"><div class="fill" style="width:${ks.pct}%;background:${p.color}"></div></div>` : ''}
          <details><summary>每週重點與里程碑</summary>
            <ul class="todo"><li><a href="#/quiz?levels=${p.level}">本週 ${Study.profile().weekly} 個新單字與到期複習</a></li>${weeklyLinks(p)}</ul>
            <ul class="milestones"><li>本站收錄單字跨日熟練 ${estimate.target} 個</li><li>能遮住提示說出讀音與意思，再用短句練習</li></ul>
          </details>
          <div class="actions">
            <a class="btn small primary" href="#/quiz?levels=${p.level}">開始 ${p.level} 測驗</a>
            ${s.weak ? `<a class="btn small" href="#/quiz?levels=${p.level}&weak=1">只練弱點 (${s.weak})</a>` : ''}
          </div>
        </div>
      </li>`;
    }).join('');
    return `
    <section class="page-head"><h1>🗺️ 分級學習地圖</h1><p class="lead">追蹤本站教材的練習進度。N3～N1 為部分筆記；所有級別進度均不代表 JLPT 能力認證。</p><details class="card"><summary>調整學習目標與每週份量</summary>${studyForm()}</details>${masteryHelp()}</section>
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
      body = hits.length ? hits.map(({ p, pi, s }) => `<article class="card"><p class="meta"><a href="#/notes/${pi}">${esc(p.icon)} ${esc(p.title)}</a></p><h2>${rich(s.heading)}</h2>${s.blocks.map(renderBlock).join('')}${sectionPractice(p, s)}</article>`).join('')
        : `<div class="card"><p>找不到「${esc(q)}」。</p></div>`;
    } else {
      body = page.sections.map((s, i) => `<article id="lesson-${i}" class="card ${s.level === 3 ? 'sub' : ''}">${s.heading ? `<h${s.level === 3 ? 3 : 2}>${rich(s.heading)}</h${s.level === 3 ? 3 : 2}>` : ''}${s.blocks.map(renderBlock).join('')}${s.editorial ? `<p class="meta">校訂：${esc(s.editorial)}</p>` : ''}${sectionPractice(page, s)}</article>`).join('');
    }
    return `
    <section class="page-head"><h1>📖 筆記</h1>
      <form class="search" onsubmit="event.preventDefault();location.hash='#/notes/${idx}?q='+encodeURIComponent(this.q.value)">
        <input name="q" aria-label="搜尋全部筆記" placeholder="搜尋全部筆記…" value="${esc(q)}"><button class="btn small" aria-label="搜尋筆記">🔍</button>
      </form>
    </section>
    <div class="notes">
      <label class="mobile-chapters">目前章節<select id="note-chapter">${d.pages.map((p, i) => `<option value="${i}" ${i === idx ? 'selected' : ''}>${esc(p.title)}</option>`).join('')}</select></label>
      <nav class="card sidebar">
        <ul>${d.pages.map((p, i) => `<li class="${i === idx && !query ? 'active' : ''}"><a href="#/notes/${i}"><span class="ico">${esc(p.icon)}</span>${esc(p.title)}</a></li>`).join('')}</ul>
        <p class="meta">📡 ${fmtDate(page.edited || d.syncedAt)}</p>
      </nav>
      <div class="notes-body">${query ? '' : `<h2 class="note-title">${esc(page.icon)} ${esc(page.title)}</h2><div class="actions lesson-actions">${lessonActions(page)}</div>`}${body}</div>
    </div>`;
  }
  function sectionPractice(page, section) {
    const items = [...DATA().vocab, ...DATA().grammar, ...DATA().phrases].filter(x => x.source?.startsWith(page.title + ' › ') && x.source.endsWith(' › ' + section.heading));
    if (!items.length) return '';
    const source = items[0].source;
    return `<div class="actions"><a class="btn small" href="#/quiz?source=${encodeURIComponent(source)}&levels=all">練習這個單元</a></div>`;
  }
  function lessonUrl(it) {
    const pi = DATA().pages.findIndex(p => it.source?.startsWith(p.title + ' › ') || (it.origin === 'external' && p.external));
    if (pi < 0) return '#/notes/0';
    const p = DATA().pages[pi];
    const si = p.sections.findIndex(s => s.heading && it.source?.endsWith(' › ' + s.heading));
    return si >= 0 ? `#/notes/${pi}?section=${si}` : `#/notes/${pi}?q=${encodeURIComponent(it.word || it.pattern || '')}`;
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
        <span class="meta">點一下假名會唸給你聽 🔊 <a href="#/voice">換聲音</a></span>
      </div>
    </section>${html}`;
  }
  // 朗讀交給 js/voice.js：自動挑最自然的聲音，並套用你在「🔊 聲音」頁選的聲音和語氣
  function speak(text) { if (window.Voice) Voice.speak(text); }

  // ────────────────────────────── 測驗 ──────────────────────────────
  const quiz = { qs: [], i: 0, score: 0, answered: false, mode: '', wrong: [], answers: [] };

  function viewQuizSetup(params) {
    const levels = params.get('levels') === 'all' ? [...Quiz.LEVELS] : (params.get('levels') || Study.profile().level).split(',').filter(Boolean);
    const types = (params.get('types') || (params.has('source') || params.has('page') ? 'vocab_meaning,vocab_reading,grammar,grammar_cloze,phrase' : 'vocab_meaning,vocab_reading')).split(',').filter(Boolean);
    const weak = params.get('weak') === '1';
    const origins = (params.get('origins') || 'notion,external').split(',').filter(Boolean);
    const chip = (name, val, label, on) => `<label class="chip ${on ? 'on' : ''}"><input type="checkbox" name="${name}" value="${val}" ${on ? 'checked' : ''}>${label}</label>`;
    const o = Quiz.overallStats();
    return `
    <section class="page-head"><h1>✏️ 複習測驗</h1><p class="lead">預設依你的 ${Study.profile().level} 程度。先出到期複習，再出新內容；輸入題需自行回想答案。</p><a class="btn small" href="#/quiz?mode=daily">依目前程度開始今日練習</a>${masteryHelp()}</section>
    <form id="quiz-setup" class="card">
      ${params.has('source') || params.has('page') ? `<p>限定範圍：${esc(params.get('source') || params.get('page'))}</p><input type="hidden" name="source" value="${esc(params.get('source') || '')}"><input type="hidden" name="page" value="${esc(params.get('page') || '')}">` : ''}
      <h3>題型</h3>
      <div class="chips">${Object.entries(Quiz.TYPES).map(([k, t]) => chip('types', k, t.label, types.includes(k))).join('')}</div>
      <h3>等級（單字題看單字等級，漢字題看漢字等級）</h3>
      <div class="chips">${Quiz.LEVELS.map(l => {
        const s = Quiz.levelStats(l);
        // 只有漢字、沒有單字的等級（例如「其他」）改顯示漢字數，免得看起來像 0 題
        const label = s.total ? `${l} <small>${s.mastered}/${s.total}</small>` : `${l} <small>漢字 ${Quiz.kanjiStats(l).total}</small>`;
        return chip('levels', l, label, levels.includes(l));
      }).join('')}</div>
      <p class="meta">至少選一個等級。N3～N1 為部分筆記。文法、會話與假名按所選單元出題，未做完整 JLPT 分級。</p>
      <h3>單字來源</h3>
      <div class="chips">${chip('origins', 'notion', `📓 作者筆記 <small>${o.notionVocab}</small>`, origins.includes('notion'))}${chip('origins', 'external', `🌐 公開單字 <small>${o.externalVocab}</small>`, origins.includes('external'))}</div>
      <p class="meta">至少選一個來源。公開單字中文多為 AI 翻譯，未全部人工校訂。</p>
      <h3>題數</h3>
      <div class="chips">${[10, 20, 30].map(n => `<label class="chip ${n === 10 ? 'on' : ''}"><input type="radio" name="count" value="${n}" ${n === 10 ? 'checked' : ''}>${n} 題</label>`).join('')}</div>
      <label class="chip ${weak ? 'on' : ''}"><input type="checkbox" name="weak" ${weak ? 'checked' : ''}>只出弱點題（目前 ${o.weak} 個）</label>
      <div class="actions"><button class="btn primary big">開始！いってきます 🏃</button></div>
      <p id="setup-error" role="alert"></p>
      <p class="meta">🔊 覺得發音太像機器人？<a href="#/voice">換一個聲音</a></p>
    </form>`;
  }

  function startQuiz(opts, mode) {
    quiz.qs = Quiz.buildQuestions(opts); quiz.i = 0; quiz.score = 0; quiz.answered = false; quiz.mode = mode; quiz.wrong = []; quiz.answers = [];
    if (!quiz.qs.length) { app().innerHTML = `<div class="card"><h2>${opts.daily ? '今日到期複習與新學份量已完成' : '沒有符合的題目'}</h2><p>${opts.daily ? '未到期的題目會保留到下次。你也可以自選練習，但提前重做不增加跨日熟練次數。' : '這個範圍暫無可用題目，請選擇其他題型或單元。'}</p><a class="btn" href="#/quiz">自選練習</a><a class="btn" href="#/">回首頁</a></div>`; return; }
    renderQuestion();
  }

  function renderQuestion() {
    const q = quiz.qs[quiz.i];
    if (q.learnFirst && !q.previewSeen) {
      app().innerHTML = `<section class="quiz"><p class="tag">先學再練・${esc(q.item.level || '本單元')} 新內容</p><div class="card question"><h1 lang="ja">${esc(q.item.word || q.prompt)}</h1><p lang="ja">${esc(q.item.reading || '')}</p><p>${esc(q.item.meaning || q.answer)}</p>${teachingHtml(q)}<button class="btn" data-say="${esc(q.item.reading || q.prompt)}" aria-label="播放日文發音">聽發音</button><p>讀過後遮住答案再練。這次先計入學習，之後到期再驗證記憶。</p><button id="learned-next" class="btn primary">遮住答案，開始練習</button></div></section>`;
      return;
    }
    app().innerHTML = `
    <section class="quiz">
      <div class="quiz-top"><span class="tag">${esc(q.typeLabel)}</span><span class="meta">${quiz.i + 1} / ${quiz.qs.length}・${esc(q.item.level || '本單元')}</span><span class="score">獨立答對 ${quiz.score}</span></div>
      <div class="bar"><div class="fill" style="width:${quiz.i / quiz.qs.length * 100}%"></div></div>
      <div class="card question tape">
        <div class="prompt ${[...q.prompt].length === 1 ? 'single' : ''}" lang="ja">${q.promptHtml || esc(q.prompt)}</div>
        ${q.sub ? `<div class="sub">${esc(q.sub)}</div>` : ''}
        ${q.type.startsWith('kanji') || q.input ? '' : `<button class="btn tiny say" data-say="${esc(q.item.reading || q.prompt)}" ${['vocab_word', 'kana'].includes(q.type) ? 'data-reveals="true"' : ''} aria-label="播放日文發音">🔊${['vocab_word', 'kana'].includes(q.type) ? '（提示）' : ''}</button>`}
        ${q.hint ? `<div><button class="btn small" id="show-hint" aria-controls="question-hint" aria-expanded="false">需要提示</button><p id="question-hint" hidden></p></div>` : ''}
        ${q.usedHint ? '<p class="meta">這次已看過內容，計入練習，不增加跨日熟練次數。</p>' : ''}
      </div>
      ${q.input ? `<form id="recall-answer" class="recall"><label for="answer-text">${q.type === 'vocab_recall' ? '輸入讀音（平假名／片假名皆可）' : q.type === 'grammar_cloze' ? '輸入空格中缺少的助詞或句型' : '輸入答案'}</label><input id="answer-text" name="answer" autocomplete="off" autocapitalize="off" spellcheck="false" required><button class="btn primary">確認答案</button><button type="button" id="dont-know" class="btn">還想不起來</button></form>` : `<div class="choices">${q.choices.map((c, i) => `<button class="btn choice" data-i="${i}"><span class="key">${'ABCD'[i]}</span>${esc(c)}</button>`).join('')}</div>`}
      <div id="feedback" class="feedback" role="status" aria-live="polite"></div>
    </section>`;
    labelAudio();
    $('#answer-text')?.focus();
  }

  function teachingHtml(q) {
    const it = q.item, supplement = window.NIHONGO_TEACHING?.[it.word];
    const example = it.example || supplement?.[0];
    const advice = supplement?.[2] || it.usage || (q.type === 'vocab_recall' ? '遮住讀音，從字形回想假名；答完後再聽一次，確認長音與促音。' : q.type === 'vocab_reading' ? '先讀出假名，再辨認對應單字。不要只靠中文漢字猜答案。' : q.type.startsWith('grammar') ? '把答案放回例句，確認句子中的意思和接續方式。' : '遮住中文回想意思，再對照讀音。下一次改用輸入或例句練習。');
    return `<div class="teaching"><p>${rich(advice)}</p>${example ? `<p lang="ja">例句／用法：${rich(example)}</p>${!it.example && supplement?.[1] ? `<p>${esc(supplement[1])}</p>` : ''}` : '<p class="meta">此詞尚無已校訂例句。可先查閱原筆記與辭典，避免自行猜測用法。</p>'}</div>`;
  }

  function labelAudio() {
    document.querySelectorAll('[data-say]').forEach(b => { if (!b.hasAttribute('aria-label')) b.setAttribute('aria-label', `播放日文：${b.dataset.say}`); });
  }

  function answer(i) {
    if (quiz.answered) return;
    quiz.answered = true;
    const q = quiz.qs[quiz.i];
    const selected = typeof i === 'string' ? i : q.choices[i];
    const ok = Quiz.checkAnswer(q, selected);
    const stat = Progress.record(q.id, ok, { assisted: !!q.usedHint });
    q.selected = selected || '未作答'; q.ok = ok;
    quiz.answers.push({ id: q.id, type: q.typeLabel, selected: q.selected, answer: q.answer, ok, assisted: !!q.usedHint });
    if (ok && !q.usedHint) quiz.score++;
    if (!ok || q.usedHint) quiz.wrong.push(q);
    document.querySelectorAll('.choice').forEach((b, j) => {
      if (q.choices[j] === q.answer) b.classList.add('correct');
      else if (j === i) b.classList.add('wrong');
      b.disabled = true;
    });
    document.querySelectorAll('#recall-answer input, #recall-answer button, #show-hint').forEach(b => { b.disabled = true; });
    const it = q.item;
    const extra = [it.reading && it.reading !== q.prompt ? `讀音：${esc(it.reading)}` : '',
      it.meaningEn && it.meaningEn !== it.meaning ? `英文：${esc(it.meaningEn)}${it.ai ? ' <span class="tag">AI 翻譯</span>' : ''}` : '',
      `意思：${rich(it.meaning || it.zh || q.answer)}`,
      q.detail ? rich(q.detail) : '',
      `你的答案：${esc(q.selected)}${q.usedHint ? '（已使用提示／先學內容）' : ''}`,
      teachingHtml(q),
      `<a href="${esc(lessonUrl(it))}">查看對應筆記</a>`,
      it.word ? `<a href="https://jisho.org/search/${encodeURIComponent(it.word)}" target="_blank" rel="noopener">查辭典與用例</a>` : '',
      `下次到期：${fmtDate(stat.due)}・跨日獨立答對 ${stat.retained}/3 次`,
      it.source ? `<span class="meta">出處：${esc(it.source)}</span>` : ''].filter(Boolean).join('<br>');
    $('#feedback').innerHTML = `<div class="card ${ok ? 'good' : 'bad'}">${ok ? window.DOODLES.checkmark : window.DOODLES.cross}<b>${ok ? (q.usedHint ? '練習答對，之後再獨立回想' : '獨立答對！') : '再看一次正確答案'}：${esc(q.answer)}</b><div class="extra">${extra}</div>
      <button class="btn primary" id="next">${quiz.i + 1 < quiz.qs.length ? '下一題 →' : '看結果 🎉'}</button></div>`;
    $('#next').focus();
  }

  function nextQuestion() {
    quiz.i++; quiz.answered = false;
    if (quiz.i < quiz.qs.length) renderQuestion(); else renderResult();
  }

  function renderResult() {
    const assisted = quiz.answers.filter(a => a.assisted).length;
    const correct = quiz.answers.filter(a => a.ok).length;
    const groups = {};
    for (const a of quiz.answers) { const g = groups[a.type] ||= { total: 0, independent: 0 }; g.total++; if (a.ok && !a.assisted) g.independent++; }
    Progress.endSession(quiz.score, quiz.qs.length, quiz.mode, { assisted, correct, skills: groups });
    const pct = Math.round(quiz.score / quiz.qs.length * 100);
    app().innerHTML = `
    <section class="result">
      <div class="card tape center">
        <div class="result-mascot">${doodle(pct >= 80 ? 'maneki' : 'daruma')}</div>
        <h1>${quiz.score} / ${quiz.qs.length}</h1>
        <p class="lead">獨立答對 ${quiz.score} 題；含提示／先學後答共 ${correct} 題正確。</p><p>使用提示或剛學過的題目 ${assisted} 題。當次答對與跨日熟練分開計算。</p>
        <div class="actions">
          <a class="btn primary" href="#/quiz">再來一次</a>
          ${quiz.wrong.length ? `<button class="btn" id="retry-wrong">再練錯題與提示題 (${quiz.wrong.length})</button>` : ''}
          <a class="btn" href="#/">回首頁</a>
        </div>
      </div>
      <section class="card"><h2>各項練習表現</h2><ul>${Object.entries(groups).map(([type, g]) => `<li>${esc(type)}：獨立答對 ${g.independent}/${g.total}</li>`).join('')}</ul>${masteryHelp()}</section>
      ${quiz.wrong.length ? `<div class="card"><h2>錯題與提示題</h2><ul class="wrong-list">${quiz.wrong.map(q => `<li><b>${esc(q.prompt)}</b><p>你答：${esc(q.selected)}${q.usedHint ? '（看過提示／先學內容）' : ''} → 正確：${esc(q.answer)}</p><p class="meta">${esc(q.typeLabel)}・下次複習 ${fmtDate(Progress.stat(q.id).due)}</p><a href="${esc(lessonUrl(q.item))}">回到相關筆記</a></li>`).join('')}</ul></div>` : ''}
    </section>`;
    $('#retry-wrong')?.addEventListener('click', () => {
      const qs = quiz.wrong.map(q => ({ ...q, usedHint: false, learnFirst: false, selected: null, choices: [...q.choices].sort(() => Math.random() - 0.5) }));
      quiz.qs = qs; quiz.i = 0; quiz.score = 0; quiz.answered = false; quiz.wrong = []; quiz.answers = []; quiz.mode = '錯題重練';
      renderQuestion();
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
        <p class="meta">跨日熟練 ${st.mastered} / ${st.total}：音讀、訓讀都須在到期後獨立答對 3 次，每次至少間隔 24 小時。字格右下的紅色小字是繁體寫法，只有和日本寫法不同才會出現。</p>
        <div class="actions">
          <a class="btn small primary" href="#/quiz?types=kanji_on,kanji_kun&levels=${level}">✏️ 字的讀音</a>
          ${words ? `<a class="btn small" href="#/quiz?types=kanji_word&levels=${level}">✏️ 詞裡的讀音 <small>${words}</small></a>` : '<span class="meta">這一級的字還沒出現在你的單字裡，暫時沒有「詞裡的讀音」題。</span>'}
        </div>
      </div>
      <div class="card kanji-detail">${cur ? kanjiDetailHtml(cur) : '<p class="meta">👇 點下面任一個字，看讀音和用到它的單字。</p>'}</div>
    </div>
    <section class="card"><div class="kj-grid">${list.map(cell).join('')}</div></section>`;
  }

  // ────────────────────────────── 語音設定 ──────────────────────────────
  const VOICE_SAMPLE = 'こんにちは！きょうも いっしょに がんばろうね。';
  const VOICE_HELP = `
      <h3>想要更自然的聲音？</h3>
      <ul>
        <li><b>電腦用 Edge</b>：會有「Microsoft Nanami Online (Natural)」，最像真人、也最可愛，需要網路。</li>
        <li><b>電腦用 Chrome</b>：選「Google 日本語」，需要網路。</li>
        <li><b>iPhone</b>：設定 → 輔助使用 → 朗讀內容 → 聲音 → 日文，下載「O-ren（加強版）」或「Kyoko（加強版）」。</li>
        <li><b>Android</b>：設定 → 文字轉語音輸出，安裝 Google 語音服務的日文語音。</li>
      </ul>
      <p class="meta">名字裡有 Desktop、Haruka、Ayumi、Ichiro 的是 Windows 內建的舊聲音，最像機器人。</p>`;
  function viewVoice() {
    const V = window.Voice;
    const head = '<section class="page-head"><h1>🔊 聲音</h1><p class="lead">挑一個你喜歡的聲音和語氣。設定只存在這台裝置，因為每台裝置能用的聲音不一樣。</p></section>';
    if (!V || !V.supported()) return `${head}<div class="card"><p>這個瀏覽器不支援語音朗讀，換 Chrome、Edge 或 Safari 試試看。</p></div>`;
    const list = V.voices(), cur = V.current(), st = V.settings();
    if (!list.length) return `${head}<div class="card"><h2>還沒找到日文聲音</h2><p>聲音清單可能還在載入，等一下會自動出現。如果一直是空的，代表這台裝置沒有日文語音，唸出來會很怪或沒有聲音。</p>${VOICE_HELP}</div>`;
    return `${head}
    <div class="card tape">
      <h2>語氣</h2>
      <div class="chips">${Object.entries(V.PRESETS).map(([k, p]) => `<button type="button" class="chip ${st.preset === k ? 'on' : ''}" data-voice-preset="${k}">${p.label}</button>`).join('')}</div>
      <form id="voice-test" class="search"><input name="text" value="${esc(VOICE_SAMPLE)}" aria-label="試聽句子"><button class="btn small primary">▶ 試聽</button></form>
      <p class="meta">目前：${esc(cur?.name || '—')}</p>
    </div>
    <div class="card">
      <h2>聲音 <small>這台裝置有 ${list.length} 個日文聲音</small></h2>
      <ul class="voice-list">${list.map((v, i) => `
        <li class="${cur && v.name === cur.name ? 'on' : ''}">
          <button type="button" class="btn tiny" data-voice-try="${i}" aria-label="試聽 ${esc(v.name)}">▶</button>
          <span class="vname">${esc(v.name)}</span>
          ${V.isRecommended(v) ? '<span class="tag">⭐ 推薦</span>' : ''}${v.localService ? '' : '<span class="tag net">需要網路</span>'}
          ${cur && v.name === cur.name ? '<span class="tag in-use">使用中</span>' : `<button type="button" class="btn tiny" data-voice-use="${i}">用這個</button>`}
        </li>`).join('')}</ul>
    </div>
    <div class="card">${VOICE_HELP}</div>`;
  }
  const voiceText = () => document.querySelector('#voice-test input')?.value || VOICE_SAMPLE;

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
    document.body.classList.remove('nav-open');
    $('#nav-toggle')?.setAttribute('aria-expanded', 'false');
    quiz.qs = [];
    document.querySelectorAll('nav.top a').forEach(a => { const active = a.dataset.view === view; a.classList.toggle('active', active); if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    window.scrollTo(0, 0);
    switch (view) {
      case 'map': app().innerHTML = viewMap(); break;
      case 'notes': app().innerHTML = viewNotes(seg[1], params.get('q') || ''); break;
      case 'kana': app().innerHTML = viewKana(seg[1] || 'hira'); break;
      case 'sync': app().innerHTML = viewSync(); break;
      case 'voice': app().innerHTML = viewVoice(); break;
      // 等級也要解碼：「其他」在網址裡會變成 %E5%85%B6%E4%BB%96
      case 'kanji': app().innerHTML = viewKanji(decodeURIComponent(seg[1] || ''), decodeURIComponent(seg[2] || '')); break;
      case 'quiz':
        if (params.get('mode') === 'daily') { startQuiz(Study.dailyOptions(), `${Study.profile().level} 今日複習`); break; }
        app().innerHTML = viewQuizSetup(params); break;
      default: app().innerHTML = viewHome();
    }
    labelAudio();
    if (view === 'notes' && /^\d+$/.test(params.get('section') || '')) document.getElementById('lesson-' + params.get('section'))?.scrollIntoView();
  }

  document.addEventListener('submit', e => {
    if (e.target.id === 'study-profile') {
      e.preventDefault(); const f = new FormData(e.target);
      Study.set({ level: f.get('level'), goal: f.get('goal'), weekly: f.get('weekly') });
      route(); return;
    }
    if (e.target.id === 'recall-answer') { e.preventDefault(); return answer(new FormData(e.target).get('answer')); }
    if (e.target.id === 'voice-test') { e.preventDefault(); return speak(e.target.text.value); }
    if (e.target.id === 'link-form') {
      e.preventDefault();
      const code = e.target.code.value;
      return syncAction(() => Sync.link(code), '✅ 已連結，進度合併完成。');
    }
    if (e.target.id !== 'quiz-setup') return;
    e.preventDefault();
    const f = new FormData(e.target);
    const opts = { types: f.getAll('types'), levels: f.getAll('levels'), origins: f.getAll('origins'), count: +f.get('count') || 10, weakOnly: f.get('weak') === 'on', source: f.get('source') || '', page: f.get('page') || '' };
    if (!opts.types.length || !opts.levels.length || !opts.origins.length) { $('#setup-error').textContent = '請至少選一個題型、等級與來源。'; return; }
    const originLabel = opts.origins.length === 1 ? (opts.origins[0] === 'notion' ? '筆記 ' : '公開 ') : '';
    startQuiz(opts, (opts.weakOnly ? '弱點 ' : '') + originLabel + (opts.levels.join('+') || '全部'));
  });
  document.addEventListener('click', e => {
    if (e.target.closest('.skip-link')) { e.preventDefault(); app().focus(); app().scrollIntoView(); return; }
    if (e.target.closest('#nav-toggle')) {
      const open = document.body.classList.toggle('nav-open'); $('#nav-toggle').setAttribute('aria-expanded', String(open)); return;
    }
    if (e.target.closest('#learned-next')) { const q = quiz.qs[quiz.i]; q.previewSeen = true; q.usedHint = true; return renderQuestion(); }
    if (e.target.closest('#show-hint')) { const q = quiz.qs[quiz.i]; if (!q || quiz.answered) return; q.usedHint = true; $('#question-hint').textContent = q.hint + '（本題改計提示練習）'; $('#question-hint').hidden = false; $('#show-hint').setAttribute('aria-expanded', 'true'); return; }
    if (e.target.closest('#dont-know')) return answer('');
    const c = e.target.closest('.choice'); if (c) return answer(+c.dataset.i);
    if (e.target.closest('#next')) return nextQuestion();
    const s = e.target.closest('[data-say]'); if (s) { if (s.dataset.reveals && quiz.qs[quiz.i] && !quiz.answered) { quiz.qs[quiz.i].usedHint = true; s.textContent = '已用語音提示'; } return speak(s.dataset.say); }
    if (e.target.closest('#create-code')) return syncAction(() => Sync.createNew(), c => `✅ 已產生同步碼 ${c}，把它抄到其他裝置就能接上。`);
    if (e.target.closest('#sync-now')) return syncAction(() => Sync.pull(), '✅ 同步完成。');
    if (e.target.closest('#unlink')) { if (confirm('這台裝置會停止同步（本機進度保留，雲端資料也還在）。確定？')) { Sync.unlink(); app().innerHTML = viewSync('已斷開。'); } return; }
    if (e.target.closest('#copy-code')) { navigator.clipboard?.writeText($('#synccode-text').textContent).then(() => { $('#copy-code').textContent = '✅ 已複製'; }); return; }
    const vp = e.target.closest('[data-voice-preset]');
    if (vp) { Voice.set({ preset: vp.dataset.voicePreset }); const t = voiceText(); app().innerHTML = viewVoice(); return speak(t); }
    const vt = e.target.closest('[data-voice-try]');
    if (vt) return Voice.speak(voiceText(), { voice: Voice.voices()[+vt.dataset.voiceTry] });
    const vu = e.target.closest('[data-voice-use]');
    if (vu) { Voice.set({ name: Voice.voices()[+vu.dataset.voiceUse]?.name || '' }); const t = voiceText(); app().innerHTML = viewVoice(); return speak(t); }
    const chip = e.target.closest('.chip');
    if (chip) setTimeout(() => { const input = chip.querySelector('input'); if (input) chip.classList.toggle('on', input.checked); }, 0);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { document.body.classList.remove('nav-open'); $('#nav-toggle')?.setAttribute('aria-expanded', 'false'); }
    if (!quiz.qs.length || !$('.choice') || e.target.closest('input,textarea,select') || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toUpperCase();
    if ('ABCD'.includes(k) && k) answer('ABCD'.indexOf(k));
  });
  document.addEventListener('change', e => {
    if (e.target.id === 'note-chapter') location.hash = '#/notes/' + e.target.value;
    if (e.target.closest('.chip')) document.querySelectorAll('.chip input').forEach(input => input.closest('.chip').classList.toggle('on', input.checked));
  });
  window.addEventListener('hashchange', route);
  window.addEventListener('DOMContentLoaded', () => {
    document.body.insertAdjacentHTML('beforeend', window.DOODLES.wobbleFilter);
    Sync.init();
    // 聲音清單是非同步載入的：在聲音頁的話，載好後重畫
    window.Voice?.onVoicesChanged(() => { if (location.hash.startsWith('#/voice')) app().innerHTML = viewVoice(); });
    Sync.onStatus(() => { if (location.hash.startsWith('#/sync')) { /* 狀態列已由 pill 更新；頁面等下次操作再重畫 */ } });
    route();
  });
})();
