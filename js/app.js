// app.js — 路由與各視圖
// 主線：今日 → 課程（單元：讀、練、達標）→ 複習；筆記、五十音、漢字、聲音、同步都歸在參考資料。
(() => {
  const $ = s => document.querySelector(s);
  const app = () => $('#app');
  const DATA = () => window.NIHONGO_DATA;
  const PLAN = () => window.NIHONGO_PLAN || [];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // 顯示 Notion 的 **粗體** 與 [連結](url)
  const rich = s => esc(String(s ?? '').replace(/^[\s\p{Extended_Pictographic}\uFE0F\u200D]+/u, '')).replace(/\*\*(.+?)\*\*/g, '<b class="hl">$1</b>').replace(/\[(.+?)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  const titleText = s => String(s || '').replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').trim();
  const icon = n => `<span class="ph-icon" data-icon="${n}" aria-hidden="true"></span>`;
  const kindIcon = kind => icon(({ 假名: 'text-aa', 發音: 'speaker-high', 會話: 'notebook', 文法: 'pencil-simple', 單字: 'book-open', 閱讀: 'book-open', 漢字: 'translate' })[kind] || 'book-open');
  const doodle = n => icon(({ onigiri: 'cards', cloud: 'chart-line', star: 'check-circle', torii: 'calendar-blank' })[n] || 'book-open');
  const fmtDate = iso => { try { return new Date(iso).toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; } };

  // ────────────────────────────── 首頁 ──────────────────────────────
  function greeting() {
    const h = new Date().getHours();
    return h < 11 ? 'おはようございます' : h < 18 ? 'こんにちは' : 'こんばんは';
  }
  function syncHint() {
    if (!window.Sync) return '';
    if (!Sync.enabled()) return '<a href="#/sync"> 跨裝置同步未設定</a>';
    const s = Sync.getStatus();
    return s.state === 'nocode' ? '<a href="#/sync"> 尚未連結同步碼，點此設定</a>'
      : s.state === 'error' ? `<a href="#/sync"> 同步失敗：${esc(s.error)}</a>`
      : `<a href="#/sync"> 同步碼 ${esc(Sync.getCode())}</a>`;
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
  // 全站到期的題目數（不含單元的「已讀」標記）
  function dueCount(now = Date.now()) {
    return Object.entries(Progress.load().items).filter(([id, s]) => !id.startsWith('u_') && s.seen && (!s.due || s.due <= now)).length;
  }
  const STATUS_ICON = { done: icon('check-circle'), active: icon('play'), todo: icon('circle') };
  function unitRow(u, cur) {
    const st = Curriculum.stats(u);
    const meta = u.readOnly ? (st.read ? '已讀' : '純閱讀') : `${st.learned}/${st.total} 已學`;
    return `<li class="${st.status} ${cur && cur.key === u.key ? 'current' : ''}"><a href="#/unit/${esc(u.key)}">
      <span class="u-num">${u.index}</span><span class="u-kind tag">${kindIcon(u.kind)} ${esc(u.kind)}</span>
      <span class="u-title">${esc(u.title)}${u.desc ? `<small>${esc(u.desc)}</small>` : ''}</span>
      <span class="u-meta">${meta}</span><span class="u-status" aria-label="${st.status}">${STATUS_ICON[st.status]}</span></a></li>`;
  }

  // ────────────────────────────── 今日 ──────────────────────────────
  function viewToday() {
    const profile = Study.profile(), unit = Curriculum.current(profile.level);
    const st = unit ? Curriculum.stats(unit) : null;
    const upcoming = unit ? Curriculum.all(profile.level).slice(unit.index, unit.index + 3) : [];
    const due = dueCount(), daily = Quiz.buildQuestions(Study.dailyOptions());
    const count = due || daily.length;
    const samples = unit ? (unit.kana.length ? unit.kana.slice(0, 5).map(k => ({ word: k.hira, reading: k.romaji })) : unit.auto === 'vocab' ? unit.items.vocab.slice(0, 3) : unit.kanji.length ? unit.kanji.slice(0, 5).map(k => ({ word: k.k })) : []) : [];
    return `<section class="today-head"><h1>今日，留一點時間給<span>日文</span>。</h1><p>一點一點累積，日文會成為你生活中的一部分。</p></section>
    <section class="review-banner" aria-labelledby="today-review">
      <div class="review-symbol">${icon('cards-three')}</div>
      <div class="review-copy"><h2 id="today-review">${due ? '今日複習' : '今日練習'}</h2><p class="review-count"><strong>${count}</strong><span>${due ? '題到期' : '題可練習'}${count ? `・${count > 20 ? '本輪 20 題，' : ''}約 ${Math.max(2, Math.ceil(Math.min(count, 20) * .6))} 分鐘` : ''}</span></p><p class="meta">${due ? '複習已學過的內容，加深記憶。' : count ? '目前沒有到期題目，從一點新內容開始。' : '今天的份量完成了，也可以繼續探索課程。'}</p></div>
      <a class="btn primary" href="${count ? due ? '#/quiz?mode=due' : '#/quiz?mode=daily' : '#/course'}">${count ? due ? '開始複習' : '開始練習' : '探索課程'} ${icon('arrow-right')}</a>
    </section>
    ${unit ? `<section class="current-lesson">
      <div class="lesson-preview"><p class="eyebrow">目前學習單元</p>
        ${samples.length ? `<div class="lesson-samples ${unit.kana.length ? 'kana-samples' : ''}">${samples.map(x => `<div><span lang="ja">${esc(x.word)}</span><small>${esc(x.reading || '')}</small></div>`).join('')}</div>` : `<p class="lesson-title-preview" lang="ja">${esc(unit.title)}</p>`}
        <p class="meta preview-caption">ここから。一步一步，打好基礎。</p>
      </div>
      <div class="lesson-info"><h2>${unit.title.startsWith(profile.level) ? '' : profile.level + ' '}${esc(unit.title)}</h2><div class="lesson-progress"><div class="bar" role="progressbar" aria-label="目前單元學習進度" aria-valuenow="${st.pct}" aria-valuemin="0" aria-valuemax="100"><div class="fill" style="width:${st.pct}%"></div></div><span class="meta">${unit.readOnly ? st.read ? '已讀完' : '尚未讀完' : `${st.learned} / ${st.total} 項已學`}</span></div><p class="meta lesson-desc">${esc(unit.desc)}</p><a class="text-link" href="#/unit/${esc(unit.key)}">繼續單元 ${icon('arrow-right')}</a></div>
    </section>` : '<section class="card"><h2>這一級還沒有課程</h2><a href="#/course">探索其他等級</a></section>'}
    <section class="upcoming"><div class="section-heading"><h2>接下來的學習內容</h2><a class="text-link" href="#/course/${profile.level}">查看全部課程 ${icon('arrow-right')}</a></div>
      ${upcoming.length ? `<ol class="next-lessons">${upcoming.map(u => `<li><a href="#/unit/${esc(u.key)}">${icon('book-open')}<span class="next-title">${esc(u.title)}</span><span class="meta next-desc">${esc(u.desc)}</span>${icon('arrow-right')}</a></li>`).join('')}</ol>` : '<p class="meta">這一級已走到最後一個單元。繼續複習，讓學過的內容留下來。</p>'}
    </section>`;
  }
  function viewSettings() {
    return `<section class="page-head"><h1>設定</h1><p class="lead">照自己的步調，安排日文學習。</p></section><section class="card"><h2>學習偏好</h2>${studyForm()}<p id="settings-status" class="meta" role="status"></p></section><div class="ref-grid"><a class="card ref" href="#/voice"><h2>${icon('speaker-high')} 聲音</h2><p>調整日文朗讀的聲音與速度。</p></a><a class="card ref" href="#/sync"><h2>${icon('cloud')} 跨裝置同步</h2><p>把學習進度接到另一台裝置。</p></a></div>`;
  }

  // ────────────────────────────── 課程 ──────────────────────────────
  function viewCourse(level) {
    if (!Curriculum.LEVELS.includes(level)) level = Study.profile().level;
    const p = PLAN().find(x => x.level === level) || {};
    const list = Curriculum.all(level), cur = Curriculum.current(level), sum = Curriculum.levelSummary(level);
    const s = Quiz.levelStats(level), ks = Quiz.kanjiStats(level);
    const tabs = Curriculum.LEVELS.map(l => { const z = Curriculum.levelSummary(l); return `<a class="btn small ${l === level ? 'primary' : ''}" href="#/course/${l}">${l} <small>${z.done}/${z.total}</small></a>`; }).join('');
    return `
    <section class="page-head"><h1> 課程</h1>
      <p class="lead">每一級照順序排成單元：讀筆記、練題目、達標後往下走。單字課和漢字課會穿插在文法、會話之間。N3～N1 為部分筆記，仍在補充。</p>
      <div class="actions">${tabs}</div>
    </section>
    <section class="card map-card">
      <div class="map-head"><div class="map-mascot">${doodle(p.mascot || 'daruma')}</div>
        <div><h2>${level} <small>${esc(p.title || '')}</small></h2><p>${esc(p.goal || '')}</p>${p.partial ? '<span class="tag">部分筆記・持續補充</span>' : ''}</div></div>
      <div class="bar"><div class="fill" style="width:${sum.pct}%;background:${p.color || ''}"></div></div>
      <p class="meta">${sum.done} / ${sum.total} 單元完成・單字跨日熟練 ${s.mastered} / ${s.total}・漢字 ${ks.mastered} / ${ks.total}${cur ? `・目前在第 ${cur.index} 單元` : ''}</p>
      ${cur ? `<div class="actions"><a class="btn small primary" href="#/unit/${esc(cur.key)}">繼續第 ${cur.index} 單元</a>${level !== Study.profile().level ? `<span class="meta">你的學習設定是 ${Study.profile().level}，可在設定調整。</span>` : ''}</div>` : ''}
      ${masteryHelp()}
    </section>
    ${list.length ? `<ol class="units card">${list.map(u => unitRow(u, cur)).join('')}</ol>` : '<div class="card"><p>這一級還沒有課程內容。可以在 Notion 加筆記，或在 <code>data/curriculum.js</code> 加單元。</p></div>'}`;
  }

  // ────────────────────────────── 單元 ──────────────────────────────
  function unitReadHtml(u) {
    if (u.auto === 'vocab') {
      return `<article class="card unit-read"><h2>本課單字 <small>${u.items.vocab.length} 個</small></h2><p class="meta">先讀一遍，點發音按鈕聽發音，再遮住意思回想。</p>
        <div class="tablewrap"><table class="vocab-table"><thead><tr><th>單字</th><th>讀音</th><th>意思</th><th></th></tr></thead><tbody>
        ${u.items.vocab.map(v => `<tr><td lang="ja">${esc(v.word)}</td><td lang="ja">${esc(v.reading)}</td><td>${esc(v.meaning)}${v.ai ? ' <span class="tag">AI 翻譯</span>' : ''}</td><td><button class="btn tiny" data-say="${esc(v.reading || v.word)}"><span class="ph-icon" data-icon="speaker-high" aria-hidden="true"></span></button></td></tr>`).join('')}
        </tbody></table></div></article>`;
    }
    if (u.auto === 'kanji') {
      const A = window.KanjiAlign;
      return `<article class="card unit-read"><h2>本課漢字 <small>${u.kanji.length} 字</small></h2><p class="meta">點字可以看它在你單字裡的用法。紅色小字是繁體寫法。</p>
        <div class="kj-grid">${u.kanji.map(k => `<a class="kj ${Quiz.kanjiStatus(k)}" href="#/kanji/${k.level}/${encodeURIComponent(k.k)}" title="${esc(k.meanings.join(', '))}"><span class="big">${esc(k.k)}</span>${k.trad.length ? `<span class="trad">${esc(k.trad[0])}</span>` : ''}</a>`).join('')}</div>
        <ul class="kd-words">${u.kanji.map(k => `<li><span class="kd-w">${esc(k.k)}</span> <span class="meta">音 ${esc(k.on.map(A.toKata).join('・') || '—')}・訓 ${esc((k.kunTop || k.kun).slice(0, 3).map(([s, o]) => o ? `${s}(${o})` : s).join('・') || '—')}</span> ${esc(k.meanings.slice(0, 2).join(', '))}</li>`).join('')}</ul></article>`;
    }
    const parts = u.read.flatMap(ref => Curriculum.sections(ref));
    if (!parts.length) return '<article class="card unit-read"><p class="meta">這個單元沒有對應的筆記段落。檢查 data/curriculum.js 的 read 設定。</p></article>';
    return parts.map(({ page, section, index }) => `<article class="card unit-read ${section.level === 3 ? 'sub' : ''}">
      ${section.heading ? `<h${section.level === 3 ? 3 : 2}>${rich(titleText(section.heading))}</h${section.level === 3 ? 3 : 2}>` : ''}
      ${section.blocks.map(renderBlock).join('')}
      <p class="meta"><a href="#/notes/${DATA().pages.indexOf(page)}?section=${index}">在筆記裡看這段</a></p></article>`).join('');
  }
  function viewUnit(key) {
    const u = Curriculum.get(key);
    if (!u) return `<div class="card"><h2>找不到這個單元</h2><a class="btn" href="#/course">回課程</a></div>`;
    const st = Curriculum.stats(u), list = Curriculum.all(u.level);
    const prev = list[u.index - 2], next = list[u.index];
    const lv = PLAN().find(x => x.level === u.level) || {};
    return `
    <section class="page-head">
      <p class="meta"><a href="#/course/${u.level}"> ${u.level} 課程</a> › 第 ${u.index} / ${u.total} 單元</p>
      <h1><span class="tag">${kindIcon(u.kind)} ${esc(u.kind)}</span> ${esc(u.title)}</h1>
      ${u.desc ? `<p class="lead">${esc(u.desc)}</p>` : ''}
    </section>
    <section class="card tape">
      <div class="bar"><div class="fill" style="width:${st.pct}%;background:${lv.color || ''}"></div></div>
      <p class="meta">${u.readOnly ? (st.read ? ' 已讀完' : '純閱讀單元，讀完按下面的「我讀完了」') : `${st.learned} / ${st.total} 項已學（最近一次答對）・跨日熟練 ${st.mastered}・弱點 ${st.weak}${st.done ? '・ 已達標' : '・80% 已學即達標'}`}</p>
      <div class="actions">
        ${u.readOnly ? (st.read ? '' : `<button class="btn primary" id="mark-read" data-unit="${esc(u.key)}"> 我讀完了</button>`) : `<a class="btn primary" href="#/quiz?unit=${esc(u.key)}"> 練習這個單元 <small>${st.total} 項</small></a>${st.weak ? `<a class="btn" href="#/quiz?unit=${esc(u.key)}&weak=1">只練弱點 (${st.weak})</a>` : ''}`}
        ${u.kana.length ? '<a class="btn" href="#/kana"> 聽五十音</a>' : ''}
      </div>
    </section>
    <h2 class="unit-h"> 讀</h2>
    ${unitReadHtml(u)}
    <div class="actions unit-nav">
      ${prev ? `<a class="btn small" href="#/unit/${esc(prev.key)}">← 第 ${prev.index} 單元：${esc(prev.title)}</a>` : ''}
      ${next ? `<a class="btn small" href="#/unit/${esc(next.key)}">第 ${next.index} 單元：${esc(next.title)} →</a>` : '<span class="meta">這是最後一個單元 </span>'}
    </div>`;
  }

  // ────────────────────────────── 複習 ──────────────────────────────
  function viewReview() {
    const o = Quiz.overallStats(); const due = dueCount();
    const recent = Progress.load().sessions.slice(-8).reverse();
    const daily = Quiz.buildQuestions(Study.dailyOptions());
    const rows = Curriculum.LEVELS.map(l => { const z = Curriculum.levelSummary(l), s = Quiz.levelStats(l), k = Quiz.kanjiStats(l); return `<tr><td><a href="#/course/${l}">${l}</a></td><td>${z.done} / ${z.total}</td><td>${s.mastered} / ${s.total}</td><td>${k.mastered} / ${k.total}</td></tr>`; }).join('');
    return `
    <section class="page-head"><h1> 複習</h1><p class="lead">到期的題目會在這裡等你。不管在哪個單元學的，到期就一起複習。</p></section>
    <section class="stats">
      <div class="stat card tape"><div class="num">${due}</div><div class="lbl">到期待複習</div>${doodle('onigiri')}</div>
      <div class="stat card tape"><div class="num">${o.weak}</div><div class="lbl">弱點</div>${doodle('cloud')}</div>
      <div class="stat card tape"><div class="num">${o.mastered}</div><div class="lbl">跨日熟練</div>${doodle('star')}</div>
      <div class="stat card tape"><div class="num">${Progress.streakDays()}</div><div class="lbl">連續學習天</div>${doodle('torii')}</div>
    </section>
    <section class="card">
      <div class="actions">
        <a class="btn primary" href="#/quiz?mode=daily"> ${Study.profile().level} 今日複習${daily.length ? ` (${daily.length})` : ''}</a>
        <a class="btn ${due ? '' : 'disabled'}" href="#/quiz?mode=due"> 全部到期 (${due})</a>
        <a class="btn ${o.weak ? '' : 'disabled'}" href="#/quiz?mode=weak"> 只練弱點 (${o.weak})</a>
        <a class="btn" href="#/quiz"> 自選範圍</a>
      </div>
      <p class="meta">今日複習：你設定的等級，先出到期的，再帶一點新單字。全部到期：所有等級、所有題型，只出到期的。</p>
      ${masteryHelp()}
    </section>
    <section class="card"><h2>各級進度</h2><div class="tablewrap" tabindex="0" role="region" aria-label="學習表格，可左右捲動"><table><thead><tr><th>等級</th><th>單元完成</th><th>單字跨日熟練</th><th>漢字跨日熟練</th></tr></thead><tbody>${rows}</tbody></table></div></section>
    <section class="card">
      <h2> 最近練習</h2>
      ${recent.length ? `<ul class="sessions">${recent.map(s => `<li><span>${fmtDate(s.at)}</span><b>${s.score} / ${s.total}</b><span class="tag">${esc(s.mode)}</span></li>`).join('')}</ul>` : '<p class="meta">還沒有紀錄。</p>'}
    </section>`;
  }

  // ────────────────────────────── 參考資料 ──────────────────────────────
  function viewReference() {
    const d = DATA(); const o = Quiz.overallStats();
    return `
    <section class="page-head"><h1> 參考資料</h1><p class="lead">課程用到的原始資料都在這裡，隨時查。想有系統地學，從 <a href="#/course">課程</a> 開始。</p></section>
    <div class="ref-grid">
      <a class="card ref" href="#/notes/0"><h2>${icon('notebook')} 筆記</h2><p>你的 Notion 筆記，${d.pages.length} 頁，可全文搜尋。</p></a>
      <a class="card ref" href="#/kana"><h2>${icon('text-aa')} 五十音</h2><p>平假名、片假名對照表，點一下會唸。</p></a>
      <a class="card ref" href="#/kanji"><h2>${icon('translate')} 漢字</h2><p>JLPT 漢字 ${(d.kanji || []).length} 字，讀音、繁體對照、用到它的單字。</p></a>
      <a class="card ref" href="#/quiz"><h2>${icon('sliders-horizontal')} 自選測驗</h2><p>自己挑題型、等級、來源，共 ${o.vocab} 個單字可練。</p></a>
      <a class="card ref" href="#/voice"><h2><span class="ph-icon" data-icon="speaker-high" aria-hidden="true"></span> 聲音</h2><p>換朗讀的聲音和語氣。</p></a>
      <a class="card ref" href="#/sync"><h2>${icon('cloud')} 跨裝置同步</h2><p>用同步碼把進度接到手機。</p></a>
    </div>
    <section class="card"><h2>筆記分頁</h2><ul class="pagelist">${d.pages.map((p, i) => `<li><a href="#/notes/${i}"><span class="ico">${icon('notebook')}</span>${esc(titleText(p.title))}<span class="cnt">${p.sections.length} 段</span></a></li>`).join('')}</ul></section>`;
  }

  // ────────────────────────────── 筆記 ──────────────────────────────
  function renderBlock(b) {
    if (b.type === 'table') {
      return `<div class="tablewrap" tabindex="0" role="region" aria-label="學習表格，可左右捲動"><table>${b.headers.length ? `<thead><tr>${b.headers.map(h => `<th>${rich(h)}</th>`).join('')}</tr></thead>` : ''}<tbody>${b.rows.map(r => `<tr>${r.map(c => `<td>${rich(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
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
      body = hits.length ? hits.map(({ p, pi, s }) => `<article class="card"><p class="meta"><a href="#/notes/${pi}">${icon('notebook')} ${esc(titleText(p.title))}</a></p><h2>${rich(titleText(s.heading))}</h2>${s.blocks.map(renderBlock).join('')}${sectionPractice(p, s)}</article>`).join('')
        : `<div class="card"><p>找不到「${esc(q)}」。</p></div>`;
    } else {
      body = page.sections.map((s, i) => `<article id="lesson-${i}" class="card ${s.level === 3 ? 'sub' : ''}">${s.heading ? `<h${s.level === 3 ? 3 : 2}>${rich(titleText(s.heading))}</h${s.level === 3 ? 3 : 2}>` : ''}${s.blocks.map(renderBlock).join('')}${s.editorial ? `<p class="meta">校訂：${esc(s.editorial)}</p>` : ''}${sectionPractice(page, s)}</article>`).join('');
    }
    return `
    <section class="page-head"><h1> 筆記</h1>
      <form class="search" onsubmit="event.preventDefault();location.hash='#/notes/${idx}?q='+encodeURIComponent(this.q.value)">
        <input name="q" aria-label="搜尋全部筆記" placeholder="搜尋全部筆記…" value="${esc(q)}"><button class="btn small" aria-label="搜尋筆記">搜尋</button>
      </form>
    </section>
    <div class="notes">
      <label class="mobile-chapters">目前章節<select id="note-chapter">${d.pages.map((p, i) => `<option value="${i}" ${i === idx ? 'selected' : ''}>${esc(titleText(p.title))}</option>`).join('')}</select></label>
      <nav class="card sidebar">
        <ul>${d.pages.map((p, i) => `<li class="${i === idx && !query ? 'active' : ''}"><a href="#/notes/${i}"><span class="ico">${icon('notebook')}</span>${esc(titleText(p.title))}</a></li>`).join('')}</ul>
        <p class="meta"> ${fmtDate(page.edited || d.syncedAt)}</p>
      </nav>
      <div class="notes-body">${query ? '' : `<h2 class="note-title">${icon('notebook')} ${esc(titleText(page.title))}</h2><div class="actions lesson-actions">${lessonActions(page)}</div>`}${body}</div>
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
    <section class="page-head"><h1> 五十音</h1>
      <div class="actions">
        <a class="btn small ${mode === 'hira' ? 'primary' : ''}" href="#/kana/hira">平假名</a>
        <a class="btn small ${mode === 'kata' ? 'primary' : ''}" href="#/kana/kata">片假名</a>
        <a class="btn small" href="#/quiz?types=kana"> 假名測驗</a>
        <span class="meta">點一下假名會唸給你聽 <span class="ph-icon" data-icon="speaker-high" aria-hidden="true"></span> <a href="#/voice">換聲音</a></span>
      </div>
    </section>${html}`;
  }
  // 朗讀交給 js/voice.js，套用聲音頁選擇的聲音和語氣。
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
    <section class="page-head"><h1> 複習測驗</h1><p class="lead">預設依你的 ${Study.profile().level} 程度。先出到期複習，再出新內容；輸入題需自行回想答案。</p><a class="btn small" href="#/quiz?mode=daily">依目前程度開始今日練習</a>${masteryHelp()}</section>
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
      <div class="chips">${chip('origins', 'notion', ` 作者筆記 <small>${o.notionVocab}</small>`, origins.includes('notion'))}${chip('origins', 'external', ` 公開單字 <small>${o.externalVocab}</small>`, origins.includes('external'))}</div>
      <p class="meta">至少選一個來源。公開單字中文多為 AI 翻譯，未全部人工校訂。</p>
      <h3>題數</h3>
      <div class="chips">${[10, 20, 30].map(n => `<label class="chip ${n === 10 ? 'on' : ''}"><input type="radio" name="count" value="${n}" ${n === 10 ? 'checked' : ''}>${n} 題</label>`).join('')}</div>
      <label class="chip ${weak ? 'on' : ''}"><input type="checkbox" name="weak" ${weak ? 'checked' : ''}>只出弱點題（目前 ${o.weak} 個）</label>
      <div class="actions"><button class="btn primary big">開始！いってきます </button></div>
      <p id="setup-error" role="alert"></p>
      <p class="meta"><span class="ph-icon" data-icon="speaker-high" aria-hidden="true"></span> 覺得發音太像機器人？<a href="#/voice">換一個聲音</a></p>
    </form>`;
  }

  function startQuiz(opts, mode) {
    quiz.qs = Quiz.buildQuestions(opts); quiz.i = 0; quiz.score = 0; quiz.answered = false; quiz.mode = mode; quiz.wrong = []; quiz.answers = [];
    if (!quiz.qs.length) { app().innerHTML = `<div class="card"><h2>${opts.daily ? '今日到期複習與新學份量已完成' : '沒有符合的題目'}</h2><p>${opts.daily ? '未到期的題目會保留到下次。你也可以自選練習，但提前重做不增加跨日熟練次數。' : '這個範圍暫無可用題目，請選擇其他題型或單元。'}</p>${quiz.unitKey ? `<a class="btn" href="#/unit/${esc(quiz.unitKey)}">回到單元</a>` : ''}<a class="btn" href="#/quiz">自選練習</a><a class="btn" href="#/">回今日</a></div>`; return; }
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
        ${q.type.startsWith('kanji') || q.input ? '' : `<button class="btn tiny say" data-say="${esc(q.item.reading || q.prompt)}" ${['vocab_word', 'kana'].includes(q.type) ? 'data-reveals="true"' : ''} aria-label="播放日文發音"><span class="ph-icon" data-icon="speaker-high" aria-hidden="true"></span>${['vocab_word', 'kana'].includes(q.type) ? '（提示）' : ''}</button>`}
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
    $('#feedback').innerHTML = `<div class="card ${ok ? 'good' : 'bad'}">${ok ? icon('check-circle') : icon('x')}<b>${ok ? (q.usedHint ? '練習答對，之後再獨立回想' : '獨立答對！') : '再看一次正確答案'}：${esc(q.answer)}</b><div class="extra">${extra}</div>
      <button class="btn primary" id="next">${quiz.i + 1 < quiz.qs.length ? '下一題 →' : '看結果 '}</button></div>`;
    $('#next').focus();
  }

  function nextQuestion() {
    quiz.i++; quiz.answered = false;
    if (quiz.i < quiz.qs.length) renderQuestion(); else renderResult();
  }

  // 結果頁的主要按鈕：單元練習 → 回單元、再練、達標就下一單元；其他 → 再來一次
  function unitResultActions() {
    const u = quiz.unitKey ? Curriculum.get(quiz.unitKey) : null;
    if (!u) return '<a class="btn primary" href="#/quiz">再來一次</a>';
    const st = Curriculum.stats(u), next = Curriculum.all(u.level)[u.index];
    return `<a class="btn primary" href="#/unit/${esc(u.key)}">回到單元（${st.learned}/${st.total} 已學${st.done ? '・ 達標' : ''}）</a>
      <a class="btn" href="#/quiz?unit=${esc(u.key)}">再練一次</a>
      ${st.done && next ? `<a class="btn" href="#/unit/${esc(next.key)}">下一單元 →</a>` : ''}`;
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
          ${unitResultActions()}
          ${quiz.wrong.length ? `<button class="btn" id="retry-wrong">再練錯題與提示題 (${quiz.wrong.length})</button>` : ''}
          <a class="btn" href="#/">回今日</a>
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
        <button class="btn tiny" data-say="${esc(k.k)}"><span class="ph-icon" data-icon="speaker-high" aria-hidden="true"></span></button>
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
    <section class="page-head"><h1> 漢字</h1>
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
          <a class="btn small primary" href="#/quiz?types=kanji_on,kanji_kun&levels=${level}"> 字的讀音</a>
          ${words ? `<a class="btn small" href="#/quiz?types=kanji_word&levels=${level}"> 詞裡的讀音 <small>${words}</small></a>` : '<span class="meta">這一級的字還沒出現在你的單字裡，暫時沒有「詞裡的讀音」題。</span>'}
        </div>
      </div>
      <div class="card kanji-detail">${cur ? kanjiDetailHtml(cur) : '<p class="meta"> 點下面任一個字，看讀音和用到它的單字。</p>'}</div>
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
    const head = '<section class="page-head"><h1><span class="ph-icon" data-icon="speaker-high" aria-hidden="true"></span> 聲音</h1><p class="lead">挑一個你喜歡的聲音和語氣。設定只存在這台裝置，因為每台裝置能用的聲音不一樣。</p></section>';
    if (!V || !V.supported()) return `${head}<div class="card"><p>這個瀏覽器不支援語音朗讀，換 Chrome、Edge 或 Safari 試試看。</p></div>`;
    const list = V.voices(), cur = V.current(), st = V.settings();
    if (!list.length) return `${head}<div class="card"><h2>還沒找到日文聲音</h2><p>聲音清單可能還在載入，等一下會自動出現。如果一直是空的，代表這台裝置沒有日文語音，唸出來會很怪或沒有聲音。</p>${VOICE_HELP}</div>`;
    return `${head}
    <div class="card tape">
      <h2>語氣</h2>
      <div class="chips">${Object.entries(V.PRESETS).map(([k, p]) => `<button type="button" class="chip ${st.preset === k ? 'on' : ''}" data-voice-preset="${k}">${p.label}</button>`).join('')}</div>
      <form id="voice-test" class="search"><input name="text" value="${esc(VOICE_SAMPLE)}" aria-label="試聽句子"><button class="btn small primary">試聽</button></form>
      <p class="meta">目前：${esc(cur?.name || '—')}</p>
    </div>
    <div class="card">
      <h2>聲音 <small>這台裝置有 ${list.length} 個日文聲音</small></h2>
      <ul class="voice-list">${list.map((v, i) => `
        <li class="${cur && v.name === cur.name ? 'on' : ''}">
          <button type="button" class="btn tiny" data-voice-try="${i}" aria-label="試聽 ${esc(v.name)}">${icon('play')}</button>
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
      <section class="page-head"><h1> 跨裝置同步</h1><p class="lead">把測驗進度存到雲端，換手機、換電腦都接得上。</p></section>
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
    <section class="page-head"><h1> 跨裝置同步</h1><p class="lead">一組同步碼 = 一份進度。在每台裝置貼上同一組碼，進度就會合併在一起。</p></section>
    ${msg ? `<div class="card ${msg.startsWith('錯誤：') ? 'bad' : 'good'}"><p>${esc(msg)}</p></div>` : ''}
    ${code ? `
    <div class="card tape">
      <h2>這台裝置的同步碼</h2>
      <div class="synccode"><code id="synccode-text">${esc(code)}</code><button class="btn small" id="copy-code"> 複製</button></div>
      <p class="meta">狀態：${esc(st.state === 'ok' ? '已同步 ' + fmtDate(st.at) : st.state === 'error' ? '同步失敗：' + st.error : st.state === 'syncing' ? '同步中…' : '待同步')} ・ 本機已熟練 ${o.mastered}／弱點 ${o.weak}</p>
      <p>把這組碼抄到另一台裝置的同一個頁面，按「連結」，兩邊的進度就會合併。</p>
      <div class="actions">
        <button class="btn small" id="sync-now"> 立即同步</button>
        <button class="btn small" id="unlink"> 這台裝置斷開</button>
      </div>
    </div>` : `
    <div class="card tape">
      <h2>還沒有同步碼</h2>
      <p>第一台裝置按「產生」，之後其他裝置用「連結」貼同一組碼。</p>
      <div class="actions"><button class="btn primary" id="create-code"> 產生新的同步碼</button></div>
    </div>`}
    <div class="card">
      <h2>${code ? '改連結另一組碼' : '連結既有的同步碼'}</h2>
      <form id="link-form" class="search">
        <input name="code" aria-label="同步碼" placeholder="例如 sakura-ab3d-k9m2-x4bd" autocomplete="off" spellcheck="false">
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
    catch (e) { app().innerHTML = viewSync('錯誤：' + e.message); }
  }

  // ────────────────────────────── 路由 ──────────────────────────────
  function route() {
    if (!DATA()) { app().innerHTML = `<div class="card"><h2>尚未同步 Notion 內容</h2><p>請先執行 <code>node sync/sync-notion.mjs</code>（或 <code>node sync/build-data.mjs</code>）產生 <code>data/content.js</code>。</p></div>`; return; }
    const [pathPart, qs = ''] = location.hash.slice(1).split('?');
    const params = new URLSearchParams(qs);
    const seg = pathPart.split('/').filter(Boolean);
    const view = seg[0] || 'home';
    // 導覽列只有四項，其他頁面歸到對應的那一項
    const navView = { home: 'home', course: 'course', map: 'course', unit: 'course', review: 'review', quiz: 'review', reference: 'reference', notes: 'reference', kana: 'reference', kanji: 'reference', voice: 'settings', sync: 'sync', settings: 'settings' }[view] || 'home';
    document.body.classList.remove('nav-open');
    $('#nav-toggle')?.setAttribute('aria-expanded', 'false');
    quiz.qs = []; quiz.unitKey = '';
    document.querySelectorAll('nav.top a').forEach(a => { const active = a.dataset.view === navView; a.classList.toggle('active', active); if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    window.scrollTo(0, 0);
    switch (view) {
      case 'map': case 'course': app().innerHTML = viewCourse(seg[1] || ''); break;
      case 'unit': app().innerHTML = viewUnit(decodeURIComponent(seg[1] || '')); break;
      case 'review': app().innerHTML = viewReview(); break;
      case 'reference': app().innerHTML = viewReference(); break;
      case 'notes': app().innerHTML = viewNotes(seg[1], params.get('q') || ''); break;
      case 'kana': app().innerHTML = viewKana(seg[1] || 'hira'); break;
      case 'settings': app().innerHTML = viewSettings(); break;
      case 'sync': app().innerHTML = viewSync(); break;
      case 'voice': app().innerHTML = viewVoice(); break;
      // 等級也要解碼：「其他」在網址裡會變成 %E5%85%B6%E4%BB%96
      case 'kanji': app().innerHTML = viewKanji(decodeURIComponent(seg[1] || ''), decodeURIComponent(seg[2] || '')); break;
      case 'quiz': {
        const unitKey = params.get('unit');
        if (unitKey) {
          const u = Curriculum.get(unitKey);
          if (!u) { app().innerHTML = viewUnit(unitKey); break; }
          quiz.unitKey = u.key;
          startQuiz(Curriculum.quizOpts(u, { weakOnly: params.get('weak') === '1', count: +params.get('count') || 10 }), `${u.level} 第 ${u.index} 單元`);
          break;
        }
        const mode = params.get('mode');
        if (mode === 'daily') { startQuiz(Study.dailyOptions(), `${Study.profile().level} 今日複習`); break; }
        if (mode === 'due') { startQuiz({ types: Object.keys(Quiz.TYPES), levels: [...Quiz.LEVELS], daily: true, newLimit: 0, count: 20 }, '全部到期'); break; }
        if (mode === 'weak') { startQuiz({ types: Object.keys(Quiz.TYPES), levels: [...Quiz.LEVELS], weakOnly: true, count: 20 }, '弱點複習'); break; }
        app().innerHTML = viewQuizSetup(params); break;
      }
      default: app().innerHTML = viewToday();
    }
    labelAudio();
    if (view === 'notes' && /^\d+$/.test(params.get('section') || '')) document.getElementById('lesson-' + params.get('section'))?.scrollIntoView();
  }

  document.addEventListener('submit', e => {
    if (e.target.id === 'study-profile') {
      e.preventDefault(); const f = new FormData(e.target);
      Study.set({ level: f.get('level'), goal: f.get('goal'), weekly: f.get('weekly') });
      route(); if ($('#settings-status')) $('#settings-status').textContent = '已儲存學習設定。'; return;
    }
    if (e.target.id === 'recall-answer') { e.preventDefault(); return answer(new FormData(e.target).get('answer')); }
    if (e.target.id === 'voice-test') { e.preventDefault(); return speak(e.target.text.value); }
    if (e.target.id === 'link-form') {
      e.preventDefault();
      const code = e.target.code.value;
      return syncAction(() => Sync.link(code), ' 已連結，進度合併完成。');
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
    const mr = e.target.closest('#mark-read');
    if (mr) { const u = Curriculum.get(mr.dataset.unit); if (u) { Curriculum.markRead(u); app().innerHTML = viewUnit(u.key); } return; }
    if (e.target.closest('#learned-next')) { const q = quiz.qs[quiz.i]; q.previewSeen = true; q.usedHint = true; return renderQuestion(); }
    if (e.target.closest('#show-hint')) { const q = quiz.qs[quiz.i]; if (!q || quiz.answered) return; q.usedHint = true; $('#question-hint').textContent = q.hint + '（本題改計提示練習）'; $('#question-hint').hidden = false; $('#show-hint').setAttribute('aria-expanded', 'true'); return; }
    if (e.target.closest('#dont-know')) return answer('');
    const c = e.target.closest('.choice'); if (c) return answer(+c.dataset.i);
    if (e.target.closest('#next')) return nextQuestion();
    const s = e.target.closest('[data-say]'); if (s) { if (s.dataset.reveals && quiz.qs[quiz.i] && !quiz.answered) { quiz.qs[quiz.i].usedHint = true; s.textContent = '已用語音提示'; } return speak(s.dataset.say); }
    if (e.target.closest('#create-code')) return syncAction(() => Sync.createNew(), c => ` 已產生同步碼 ${c}，把它抄到其他裝置就能接上。`);
    if (e.target.closest('#sync-now')) return syncAction(() => Sync.pull(), ' 同步完成。');
    if (e.target.closest('#unlink')) { if (confirm('這台裝置會停止同步（本機進度保留，雲端資料也還在）。確定？')) { Sync.unlink(); app().innerHTML = viewSync('已斷開。'); } return; }
    if (e.target.closest('#copy-code')) { navigator.clipboard?.writeText($('#synccode-text').textContent).then(() => { $('#copy-code').textContent = ' 已複製'; }); return; }
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

    Sync.init();
    // 聲音清單是非同步載入的：在聲音頁的話，載好後重畫
    window.Voice?.onVoicesChanged(() => { if (location.hash.startsWith('#/voice')) app().innerHTML = viewVoice(); });
    Sync.onStatus(() => { if (location.hash.startsWith('#/sync')) { /* 狀態列已由 pill 更新；頁面等下次操作再重畫 */ } });
    route();
  });
})();
