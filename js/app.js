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
  const kindIcon = kind => kind === '生活' ? glyph('和', 'tiny') : icon(({ 假名: 'text-aa', 發音: 'speaker-high', 會話: 'notebook', 文法: 'pencil-simple', 單字: 'book-open', 閱讀: 'book-open', 漢字: 'translate', 筆記: 'notebook' })[kind] || 'book-open');
  // 生活日本的主題字（食、動、旅、季）：用漢字當圖示，順便認字
  const LIFE = () => window.NIHONGO_LIFE || { themes: {}, topics: [] };
  const THEME_CLASS = { 食物: 'food', 動畫: 'anime', 旅遊: 'travel', 季節: 'season' };
  const glyph = (ch, cls = '') => `<span class="glyph ${cls}" aria-hidden="true" lang="ja">${esc(ch)}</span>`;
  const themeGlyph = (theme, cls = '') => glyph(LIFE().themes[theme]?.glyph || '和', `${THEME_CLASS[theme] || ''} ${cls}`);
  // 小角色（js/art.js）；沒載入時退回圖示
  const CHAR_OF = { onigiri: 'kuro', daruma: 'chatora', maneki: 'maneki', torii: 'walk', fuji: 'mike', cloud: 'uruuru', star: 'maneki' };
  const doodle = n => window.Art ? Art.char(CHAR_OF[n] || 'kuro') : icon(({ onigiri: 'cards', cloud: 'chart-line', star: 'check-circle', torii: 'calendar-blank' })[n] || 'book-open');
  // 首頁的編號區段標題：(01) 大大的英文 ＋ 中文
  const secHead = (no, en, zh, id = '', link = '') => `<header class="sec-head"><p class="sec-no">${no}</p><h2${id ? ` id="${id}"` : ''}><span class="sec-en" aria-hidden="true">${en}</span><span class="sec-zh">${zh}</span></h2>${link}</header>`;
  const MARQUEE = [['にほんご', 'Nihongo'], ['ことば', 'Kotoba'], ['ひらがな', 'Hiragana'], ['かんじ', 'Kanji'], ['かいわ', 'Kaiwa'], ['たべもの', 'Tabemono'], ['たび', 'Tabi'], ['きせつ', 'Kisetsu']];
  const marquee = () => { const row = MARQUEE.map(([ja, en]) => `<span lang="ja">${ja}</span><em>${en}</em><i></i>`).join(''); return `<div class="marquee" aria-hidden="true"><div class="marquee-track">${row}${row}</div></div>`; };
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
    const sources = [...DATA().vocab, ...DATA().grammar, ...DATA().phrases, ...(DATA().drills || [])].filter(x => x.source?.startsWith(page.title + ' › '));
    return sources.length ? `<a class="btn small" href="#/quiz?page=${encodeURIComponent(page.title)}&levels=all">練習本頁內容</a>` : `<a class="btn small" href="#/quiz?levels=${level}">練習 ${level} 單字</a>`;
  }
  // 全站到期的題目數（不含單元的「已讀」標記）
  function dueCount(now = Date.now()) {
    const d = DATA();
    const active = new Set([...d.vocab, ...d.grammar, ...d.phrases, ...d.kana, ...(d.drills || []), ...(d.kanjiWords || [])].map(x => x.id));
    for (const k of d.kanji || []) {
      if (k.on?.length) active.add(k.id + ':on');
      if (k.kun?.length) active.add(k.id + ':kun');
    }
    return Object.entries(Progress.load().items).filter(([id, s]) => active.has(id) && s.seen && (!s.due || s.due <= now)).length;
  }
  const STATUS_ICON = { done: icon('check-circle'), active: icon('play'), todo: icon('circle') };
  function unitRow(u, cur) {
    const st = Curriculum.stats(u);
    const meta = u.readOnly ? (st.read ? '已讀' : '純閱讀') : `${st.learned}/${st.total} 已學`;
    return `<li class="${st.status} ${cur && cur.key === u.key ? 'current' : ''}"><a href="#/unit/${esc(u.key)}">
      <span class="u-num">${u.index}</span><span class="u-kind tag ${u.auto === 'life' ? 'life ' + (THEME_CLASS[u.theme] || '') : ''}">${u.auto === 'life' ? themeGlyph(u.theme, 'tiny') : kindIcon(u.kind)} ${esc(u.auto === 'life' ? u.theme : u.kind)}</span>
      <span class="u-title">${esc(u.title)}${u.fresh ? ' <span class="tag fresh">Notion 新筆記</span>' : ''}${u.desc ? `<small>${esc(u.desc)}</small>` : ''}</span>
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
    const sum = Curriculum.levelSummary(profile.level), A = window.Art, now = new Date();
    const date = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}　${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][now.getDay()]}.`;
    const reviewHref = count ? due ? '#/quiz?mode=due' : '#/quiz?mode=daily' : '#/course';
    return `
    <section class="home-hero" aria-label="今日">
      ${A ? `<div class="hero-cats" aria-hidden="true">${A.char('chatora')}${A.char('kuro')}${A.char('mike')}</div>` : ''}
      <div class="hero-card">
        <p class="hero-date">${date}</p>
        <h1 class="hero-title">にほんご<span class="note-word">ノート</span></h1>
        ${unit ? `<p class="hero-level">${profile.level}　第 ${unit.index} / ${unit.total} 單元</p>` : ''}
        <div class="hero-cta"><a class="btn primary" href="${unit ? '#/unit/' + esc(unit.key) : '#/course'}">繼續單元 ${icon('arrow-right')}</a><a class="btn" href="${reviewHref}">${due ? '今日複習' : '今日練習'}</a></div>
        ${A ? `<a class="hero-badge" href="#/course/${profile.level}">${A.ring(sum.pct, `${profile.level} 達成率`, `${sum.done} / ${sum.total} 單元`)}</a>` : ''}
      </div>
    </section>
    ${window.Motion && Motion.pref() === 'auto' && Motion.systemReduce() ? '<p class="motion-note">你的系統開啟了「減少動態效果」，所以網站先停用動畫。<a href="#/settings">到設定開啟動畫</a></p>' : ''}
    ${marquee()}
    <section class="home-sec" aria-labelledby="today-review">
      ${secHead('01', 'Review', due ? '今日複習' : '今日練習', 'today-review')}
      <div class="review-sec">
        <div class="review-copy"><p class="stat-label">${due ? '到期的題目' : '可以練習的題目'}</p><p class="big-stat"><b data-count="${count}">${count}</b><small>題</small></p></div>
        <div class="review-side">
          <p class="meta">${count ? `${count > 20 ? '本輪 20 題，' : ''}約 ${Math.max(2, Math.ceil(Math.min(count, 20) * .6))} 分鐘` : '今天的份量完成了'}</p>
          <a class="btn primary" href="${reviewHref}">${count ? due ? '開始複習' : '開始練習' : '探索課程'} ${icon('arrow-right')}</a>
          ${A ? `<div class="review-chars">${count ? A.char('kuro') + A.char('mike') + A.char('shiro') : A.char('akubi')}</div>` : ''}
        </div>
      </div>
    </section>
    ${unit ? `<section class="home-sec">${secHead('02', 'Lesson', '目前學習單元')}<div class="current-lesson">
      <div class="lesson-preview"><p class="eyebrow">Unit ${unit.index} / ${unit.total}</p>
        ${samples.length ? `<div class="lesson-samples ${unit.kana.length ? 'kana-samples' : ''}">${samples.map(x => `<div><span lang="ja">${esc(x.word)}</span><small>${esc(x.reading || '')}</small></div>`).join('')}</div>` : `<p class="lesson-title-preview" lang="ja">${esc(unit.title)}</p>`}
      </div>
      <div class="lesson-info"><h2>${unit.title.startsWith(profile.level) ? '' : profile.level + ' '}${esc(unit.title)}</h2><div class="lesson-progress"><div class="paws" role="progressbar" aria-label="目前單元學習進度" aria-valuenow="${st.pct}" aria-valuemin="0" aria-valuemax="100">${Array.from({ length: 10 }, (_, i) => `<i class="paw ${i < Math.round(st.pct / 10) ? 'on' : ''}" style="--i:${i}"></i>`).join('')}</div><span class="meta">${unit.readOnly ? st.read ? '已讀完' : '尚未讀完' : `${st.learned} / ${st.total} 項已學`}</span></div><p class="meta lesson-desc">${esc(unit.desc)}</p><a class="text-link" href="#/unit/${esc(unit.key)}">繼續單元 ${icon('arrow-right')}</a></div>
    </div></section>` : '<section class="card"><h2>這一級還沒有課程</h2><a href="#/course">探索其他等級</a></section>'}
    <section class="home-sec">${secHead('03', 'Play', '輕鬆一下')}${todayExtras(profile.level, unit)}</section>
    <section class="home-sec upcoming">${secHead('04', 'Next', '接下來的學習內容', '', `<a class="text-link" href="#/course/${profile.level}">查看全部課程 ${icon('arrow-right')}</a>`)}
      ${upcoming.length ? `<ol class="next-lessons">${upcoming.map(u => `<li><a href="#/unit/${esc(u.key)}">${icon('book-open')}<span class="next-title">${esc(u.title)}</span><span class="meta next-desc">${esc(u.desc)}</span>${icon('arrow-right')}</a></li>`).join('')}</ol>` : '<p class="meta">這一級已走到最後一個單元。繼續複習，讓學過的內容留下來。</p>'}
    </section>`;
  }
  function motionSettings() {
    const M = window.Motion;
    if (!M) return '';
    const cur = M.pref(), opts = [['auto', '跟隨系統'], ['on', '開啟'], ['off', '關閉']];
    return `<section class="card"><h2>動畫效果</h2>
      <p class="meta">開場動畫、捲動淡入、換頁轉場、貓咪晃動。${M.systemReduce() ? '你的系統目前設定為「減少動態效果」，選「跟隨系統」時網站不會播放動畫。' : '你的系統允許動畫。'}</p>
      <div class="chips" role="radiogroup" aria-label="動畫效果">${opts.map(([v, label]) => `<button type="button" class="chip ${cur === v ? 'on' : ''}" role="radio" aria-checked="${cur === v}" data-motion="${v}">${label}</button>`).join('')}</div>
    </section>`;
  }
  function viewSettings() {
    return `<section class="page-head"><h1>設定</h1></section><section class="card"><h2>學習偏好</h2>${studyForm()}<p id="settings-status" class="meta" role="status"></p></section>${motionSettings()}<div class="ref-grid"><a class="card ref" href="#/voice"><h2>${icon('speaker-high')} 聲音</h2><p>調整日文朗讀的聲音與速度。</p></a><a class="card ref" href="#/sync"><h2>${icon('cloud')} 跨裝置同步</h2><p>把學習進度接到另一台裝置。</p></a></div>`;
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
    if (u.auto === 'life') return lifeReadHtml(u);
    if (u.auto === 'vocab') {
      return `<article class="card unit-read"><h2>本課單字 <small>${u.items.vocab.length} 個</small></h2><p class="meta">先讀一遍，點發音按鈕聽發音，再遮住意思回想。</p>${vocabTable(u.items.vocab)}</article>`;
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
    <section class="page-head" data-en="Unit ${u.index}">
      <p class="meta"><a href="#/course/${u.level}"> ${u.level} 課程</a> › 第 ${u.index} / ${u.total} 單元</p>
      <h1><span class="tag">${u.auto === 'life' ? `${themeGlyph(u.theme, 'tiny')} 生活日本・${esc(u.theme)}` : `${kindIcon(u.kind)} ${esc(u.kind)}`}</span>${u.fresh ? ' <span class="tag fresh">Notion 新筆記</span>' : ''} ${esc(u.title)}</h1>
      ${u.desc ? `<p class="lead">${esc(u.desc)}</p>` : ''}
    </section>
    <section class="card tape">
      <div class="bar"><div class="fill" style="width:${st.pct}%;background:${lv.color || ''}"></div></div>
      <p class="meta">${u.readOnly ? (st.read ? ' 已讀完' : '純閱讀單元，讀完按下面的「我讀完了」') : `${st.learned} / ${st.total} 項已學（最近一次答對）・跨日熟練 ${st.mastered}・弱點 ${st.weak}${st.done ? '・ 已達標' : '・80% 已學即達標'}`}</p>
      <div class="actions">
        ${u.readOnly ? (st.read ? '' : `<button class="btn primary" id="mark-read" data-unit="${esc(u.key)}"> 我讀完了</button>`) : `<a class="btn primary" href="#/quiz?unit=${esc(u.key)}"> 練習這個單元 <small>${st.total} 項</small></a>${st.weak ? `<a class="btn" href="#/quiz?unit=${esc(u.key)}&weak=1">只練弱點 (${st.weak})</a>` : ''}`}
        ${u.kana.length ? '<a class="btn" href="#/kana"> 聽五十音</a>' : ''}
      </div>
      ${activityRow(u)}
    </section>
    <h2 class="unit-h"> 讀</h2>
    ${unitReadHtml(u)}
    <div class="actions unit-nav">
      ${prev ? `<a class="btn small" href="#/unit/${esc(prev.key)}">← 第 ${prev.index} 單元：${esc(prev.title)}</a>` : ''}
      ${next ? `<a class="btn small" href="#/unit/${esc(next.key)}">第 ${next.index} 單元：${esc(next.title)} →</a>` : '<span class="meta">這是最後一個單元 </span>'}
    </div>`;
  }

  // ────────────────────────────── 換個方式練：活動列 ──────────────────────────────
  const buildItems = u => u.items.phrases.filter(p => p.parts?.length >= 2);
  function activities(u) {
    if (u.readOnly) return [];
    const key = encodeURIComponent(u.key), out = [];
    if (Curriculum.pairs(u).length >= 4) out.push({ href: `#/play/match?unit=${key}`, icon: 'cards-three', title: '配對遊戲', desc: '把日文和意思連起來，挑戰最快紀錄' });
    if (u.items.vocab.filter(v => v.reading && v.reading !== v.word).length >= 4) out.push({ href: `#/quiz?unit=${key}&types=listen`, icon: 'speaker-high', title: '聽力挑戰', desc: '只聽發音，選出是哪個字' });
    if (buildItems(u).length) out.push({ href: `#/play/build?unit=${key}`, icon: 'pencil-simple', title: '句子重組', desc: '把字卡排成正確的句子' });
    if (u.topic?.dialogue) out.push({ href: `#/play/role?unit=${key}`, icon: 'notebook', title: '角色扮演', desc: `你演「${u.topic.dialogue.roles.B}」，選出該說的話` });
    return out;
  }
  function activityRow(u) {
    const a = activities(u);
    return a.length ? `<div class="activity-row"><p class="meta">換個方式練</p><div class="activity-grid">${a.map(x => `<a class="activity" href="${x.href}">${icon(x.icon)}<span><b>${esc(x.title)}</b><small>${esc(x.desc)}</small></span></a>`).join('')}</div></div>` : '';
  }

  // ────────────────────────────── 生活日本 ──────────────────────────────
  const vocabTable = vs => `<div class="tablewrap" tabindex="0" role="region" aria-label="單字表，可左右捲動"><table class="vocab-table"><thead><tr><th>單字</th><th>讀音</th><th>意思</th><th></th></tr></thead><tbody>
    ${vs.map(v => `<tr><td lang="ja">${esc(v.word)}</td><td lang="ja">${esc(v.reading)}</td><td>${esc(v.meaning)}${v.ai ? ' <span class="tag">AI 翻譯</span>' : ''}</td><td><button class="btn tiny" data-say="${esc(v.reading || v.word)}">${icon('speaker-high')}</button></td></tr>`).join('')}
    </tbody></table></div>`;
  function dialogueHtml(t) {
    const d = t.dialogue;
    return `<article class="card dialogue" data-topic="${esc(t.id)}">
      <div class="section-heading"><h2>情境對話 <small>${esc(d.scene)}</small></h2>
        <div class="actions"><button class="btn small" data-play-dialogue="${esc(t.id)}">${icon('play')} 播放整段</button><button class="btn small" data-toggle-zh aria-pressed="false">顯示中文</button></div></div>
      <ol class="bubbles">${d.lines.map(([who, jp, zh], i) => `<li class="bubble ${who === 'B' ? 'me' : ''}" data-line="${i}"><span class="who">${esc(d.roles[who] || who)}</span><button class="say-line" data-say="${esc(jp)}" data-voice-role="${who}"><span lang="ja">${esc(jp)}</span></button><span class="zh" hidden>${esc(zh)}</span></li>`).join('')}</ol>
      <p class="meta">點任何一句可以單獨聽。熟了之後，用上面的「角色扮演」自己演一次。</p>
    </article>`;
  }
  function triviaHtml(t) {
    return `<article class="card trivia"><h2>文化小問答</h2><p class="meta">看看你對日本生活了解多少。這裡不算進複習排程，答錯也沒關係。</p>
      ${t.quiz.map((q, qi) => `<div class="trivia-q" data-trivia="${esc(t.id)}:${qi}"><p><b>${qi + 1}.</b> ${esc(q.q)}</p><div class="trivia-choices">${q.choices.map((c, ci) => `<button class="btn small" data-trivia-choice="${ci}">${esc(c)}</button>`).join('')}</div><p class="trivia-explain" role="status" hidden></p></div>`).join('')}
    </article>`;
  }
  function lifeReadHtml(u) {
    const t = u.topic, th = LIFE().themes[t.theme] || {};
    return `
    <article class="card life-intro ${THEME_CLASS[t.theme] || ''}">
      <div class="life-head">${themeGlyph(t.theme, 'big')}<div><p class="eyebrow">${esc(th.label || t.theme)}・${esc(th.note || '')}</p><h2>${esc(t.title)}</h2></div></div>
      ${(t.intro || []).map(p => `<p>${esc(p)}</p>`).join('')}
      ${t.tips?.length ? `<h3>小知識</h3><ul class="tips">${t.tips.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    </article>
    ${t.dialogue ? dialogueHtml(t) : ''}
    <article class="card unit-read"><h2>這個主題的單字 <small>${u.items.vocab.length} 個</small></h2>${vocabTable(u.items.vocab)}</article>
    ${u.items.phrases.length ? `<article class="card unit-read"><h2>實用句</h2><ul class="phrase-list">${u.items.phrases.map(p => `<li><button class="btn tiny" data-say="${esc(p.jp)}">${icon('speaker-high')}</button><span lang="ja">${esc(p.jp)}</span><span class="meta">${esc(p.zh)}</span></li>`).join('')}</ul></article>` : ''}
    ${t.quiz?.length ? triviaHtml(t) : ''}`;
  }
  function viewLife(theme = '') {
    const L = LIFE(), themes = Object.keys(L.themes || {});
    if (!themes.includes(theme)) theme = '';
    const topics = L.topics.filter(t => !theme || t.theme === theme);
    const card = t => {
      const u = Curriculum.get(`${t.level}-life-${t.id}`), st = u ? Curriculum.stats(u) : null;
      // 一張卡片只留一個框：主題和單元位置寫成一行小字；開始學了才出現細進度條
      const started = st && (st.seen > 0 || st.read);
      const progress = started
        ? `<span class="bar thin"><span class="fill" style="width:${st.pct}%"></span></span><span class="meta">${st.done ? '已達標' : `${st.learned} / ${st.total} 已學`}</span>`
        : st ? `<span class="meta">${st.total} 項・還沒開始</span>` : '';
      return `<a class="life-card ${THEME_CLASS[t.theme] || ''}" href="#/unit/${esc(u?.key || '')}">
        <span class="life-card-top">${themeGlyph(t.theme, 'big')}<span class="life-meta">${esc(t.theme)}・${esc(t.level)}${u ? ` 第 ${u.index} 單元` : ''}</span></span>
        <b>${esc(t.title)}</b><small>${esc(t.desc)}</small>${progress}</a>`;
    };
    // 全部主題時依主題分組，同一種顏色放在一起
    const groups = theme ? [[theme, topics]] : themes.map(th => [th, topics.filter(t => t.theme === th)]).filter(([, ts]) => ts.length);
    const grid = groups.map(([th, ts]) => `<section class="life-group">
      <h2 class="life-group-head">${themeGlyph(th, 'tiny')} ${esc(th)} <small>${ts.length} 個主題</small></h2>
      <div class="life-grid">${ts.map(card).join('')}</div>
    </section>`).join('');
    return `
    <section class="page-head"><h1>${glyph('和', 'title')} 生活日本</h1>
      <div class="actions">${['', ...themes].map(th => `<a class="btn small ${th === theme ? 'primary' : ''}" href="#/life${th ? '/' + encodeURIComponent(th) : ''}">${th ? themeGlyph(th, 'tiny') + ' ' + esc(th) : '全部主題'}</a>`).join('')}</div>
    </section>
    ${grid}
    <section class="card"><h2>想加自己的主題？</h2>
      <p>最簡單的方式是寫在 Notion：在「詞彙整理」新增一段，例如「## 動畫《○○》學到的單字」，放一張「單字／讀音／意思」表格；句子用「日語／中文」表格。隔天同步後，它會自動變成課程裡的「Notion 新筆記」單元。</p>
      <p class="meta">想要有對話、小問答的完整主題，可以在 <code>data/life.js</code> 照現有格式新增。</p>
    </section>`;
  }

  // ────────────────────────────── 小遊戲：配對、句子重組、角色扮演 ──────────────────────────────
  const game = { kind: '' };
  const shuffleArr = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const GAME_KEY = 'nihongo.games';
  const bestTimes = () => { try { return JSON.parse(localStorage.getItem(GAME_KEY)) || {}; } catch { return {}; } };
  // 回傳 { best, prev }：prev 是這次之前的最快紀錄（沒有就是 undefined）
  function saveBest(key, ms) {
    const b = bestTimes(), prev = b[key];
    if (!prev || ms < prev) { b[key] = ms; try { localStorage.setItem(GAME_KEY, JSON.stringify(b)); } catch {} }
    return { best: Math.min(ms, prev || Infinity), prev };
  }
  const gameTop = (ic, label, right) => `<div class="quiz-top"><span class="tag">${icon(ic)} ${label}</span><span class="meta">${esc(game.u.title)}</span><span class="score">${right}</span></div>`;
  const gameEnd = kind => `<div class="actions"><button class="btn primary" data-replay="${kind}">再玩一次</button><a class="btn" href="#/unit/${esc(game.u.key)}">回到單元</a>${game.u.readOnly ? '' : `<a class="btn" href="#/quiz?unit=${esc(game.u.key)}">練習這個單元</a>`}</div>`;

  // 配對：左邊日文、右邊意思。第一次就配對成功的算一次答對（最後一組靠刪去法，不算）
  function startMatch(u) {
    const all = shuffleArr(Curriculum.pairs(u)).sort((a, b) => (Progress.stat(a.id).streak > 0) - (Progress.stat(b.id).streak > 0));
    const pairs = all.slice(0, 6);
    Object.assign(game, { kind: 'match', u, pairs, left: shuffleArr(pairs), right: shuffleArr(pairs), sel: null, done: new Set(), missed: new Set(), mistakes: 0, firstTry: 0, start: Date.now() });
    renderMatch();
  }
  function renderMatch(msg = '') {
    const g = game;
    app().innerHTML = `<section class="game">
      ${gameTop('cards-three', '配對遊戲', `${g.done.size} / ${g.pairs.length}・失誤 ${g.mistakes}`)}
      <p class="meta">先點左邊的日文（會唸給你聽），再點右邊對應的意思。第一次就配對成功的，會算進單元進度。</p>
      <div class="match-board">
        <div class="match-col">${g.left.map(p => `<button class="mcard ${g.done.has(p.id) ? 'done' : ''} ${g.sel === p.id ? 'sel' : ''}" data-match="L" data-id="${esc(p.id)}" ${g.done.has(p.id) ? 'disabled' : ''} aria-pressed="${g.sel === p.id}"><span lang="ja">${esc(p.jp)}</span>${p.sub ? `<small lang="ja">${esc(p.sub)}</small>` : ''}</button>`).join('')}</div>
        <div class="match-col">${g.right.map(p => `<button class="mcard ${g.done.has(p.id) ? 'done' : ''}" data-match="R" data-id="${esc(p.id)}" ${g.done.has(p.id) ? 'disabled' : ''}>${esc(p.zh)}</button>`).join('')}</div>
      </div>
      <p id="feedback" class="meta" role="status" aria-live="polite">${esc(msg)}</p>
    </section>`;
  }
  function matchClick(side, id) {
    const g = game;
    if (side === 'L') { g.sel = id; speak(g.pairs.find(p => p.id === id)?.say); return renderMatch(); }
    if (!g.sel) return renderMatch('先點左邊的日文。');
    if (id !== g.sel) {
      g.mistakes++; g.missed.add(g.sel);
      renderMatch('再想想看。');
      [...document.querySelectorAll('[data-match="R"]')].find(b => b.dataset.id === id)?.classList.add('shake');
      return;
    }
    g.done.add(id); g.sel = null;
    const last = g.done.size === g.pairs.length;
    if (!g.missed.has(id)) { g.firstTry++; if (!last) Progress.record(id, true); }
    if (!last) return renderMatch('配對成功！');
    const ms = Date.now() - g.start, rec = saveBest('match:' + g.u.key, ms);
    Progress.endSession(g.firstTry, g.pairs.length, '配對遊戲');
    app().innerHTML = `<section class="game result"><div class="card center">
      <div class="result-mascot">${icon('cards-three')}</div><h1>${(ms / 1000).toFixed(1)} 秒</h1>
      <p class="lead">${g.pairs.length} 組全部配對完成，失誤 ${g.mistakes} 次。</p>
      <p>${!rec.prev ? '這是你的第一筆紀錄。' : ms < rec.prev ? '刷新最快紀錄！' : `最快紀錄 ${(rec.best / 1000).toFixed(1)} 秒`}</p>
      ${gameEnd('match')}</div></section>`;
  }

  // 句子重組：把字卡排成整句。聽整句算提示
  function startBuild(u) {
    Object.assign(game, { kind: 'build', u, items: shuffleArr(buildItems(u)).slice(0, 5), i: 0, firstTry: 0 });
    setupBuild();
  }
  function setupBuild() {
    const it = game.items[game.i];
    let pool = it.parts.map(t => ({ t }));
    for (let n = 0; n < 6 && pool.map(p => p.t).join('') === it.jp; n++) pool = shuffleArr(pool);
    Object.assign(game, { pool, picked: [], tried: false, usedHint: false, solved: false });
    renderBuild();
  }
  function renderBuild(msg = '', ok = null) {
    const g = game, it = g.items[g.i];
    app().innerHTML = `<section class="game">
      ${gameTop('pencil-simple', '句子重組', `一次答對 ${g.firstTry}`)}
      <div class="bar"><div class="fill" style="width:${g.i / g.items.length * 100}%"></div></div>
      <div class="card question">
        <p class="sub">把字卡排成這句話（${g.i + 1} / ${g.items.length}）</p><p class="build-zh">${esc(it.zh)}</p>
        <div class="build-line ${g.solved ? 'solved' : ''}" aria-label="你排的句子">${g.picked.length ? g.picked.map((p, n) => `<button class="tile on" data-build-remove="${n}" lang="ja" ${g.solved ? 'disabled' : ''}>${esc(p.t)}</button>`).join('') : '<span class="meta">點下面的字卡，照順序放上來</span>'}</div>
        <div class="build-pool">${g.pool.map((p, n) => `<button class="tile" data-build-pick="${n}" lang="ja">${esc(p.t)}</button>`).join('')}</div>
      </div>
      <div class="actions">${g.solved ? `<button class="btn primary" id="build-next">${g.i + 1 < g.items.length ? '下一句 →' : '看結果'}</button>` : `<button class="btn primary" id="build-check" ${g.pool.length ? 'disabled' : ''}>確認</button><button class="btn" id="build-reset">全部放回</button>`}
        <button class="btn" data-say="${esc(it.jp)}">${icon('speaker-high')} 聽整句${g.solved ? '' : '（提示）'}</button></div>
      <div id="feedback" class="feedback" role="status" aria-live="polite">${msg ? `<div class="card ${ok ? 'good' : 'bad'}">${ok ? icon('check-circle') : icon('x')}<b>${esc(msg)}</b></div>` : ''}</div>
    </section>`;
  }
  function checkBuild() {
    const g = game, it = g.items[g.i];
    if (g.picked.map(p => p.t).join('') === it.jp) {
      g.solved = true;
      if (!g.tried) { Progress.record(it.id, true, { assisted: g.usedHint }); if (!g.usedHint) g.firstTry++; }
      speak(it.jp);
      return renderBuild(`對了！${it.jp}`, true);
    }
    if (!g.tried) { g.tried = true; Progress.record(it.id, false); }
    renderBuild('順序不太對。點上面的字卡可以放回去，再試一次。', false);
  }
  function finishBuild() {
    const g = game;
    Progress.endSession(g.firstTry, g.items.length, '句子重組');
    app().innerHTML = `<section class="game result"><div class="card center"><div class="result-mascot">${icon('pencil-simple')}</div>
      <h1>${g.firstTry} / ${g.items.length}</h1><p class="lead">一次就排對 ${g.firstTry} 句。</p><p>句子重組練的是語順：日文的動詞在最後，助詞跟在名詞後面。</p>${gameEnd('build')}</div></section>`;
  }

  // 角色扮演：你演 B。輪到你時從三句裡選出該說的話；對方的台詞會唸出來
  // list: [[句子, 角色], ...]；onLine(i) 在開始唸第 i 句時呼叫（-1 表示唸完）
  function speakQueue(list, onLine = () => {}) {
    if (!window.Voice?.supported?.()) return;
    let i = 0;
    const next = () => {
      if (i >= list.length) return onLine(-1);
      onLine(i);
      const [text, role] = list[i++]; const u = speak(text, role);
      if (u) { u.onend = next; u.onerror = () => onLine(-1); }
    };
    next();
  }
  function startRole(u) {
    Object.assign(game, { kind: 'role', u, d: u.topic.dialogue, i: 0, mistakes: 0, shown: [], options: null, logged: false });
    advanceRole([]);
  }
  function roleOptions() {
    const g = game, right = g.d.lines[g.i][1];
    const mine = g.d.lines.filter(l => l[0] === 'B').map(l => l[1]);
    const others = LIFE().topics.filter(t => t.id !== g.u.topic.id && t.dialogue).flatMap(t => t.dialogue.lines.filter(l => l[0] === 'B').map(l => l[1]));
    const wrong = shuffleArr([...new Set([...mine, ...others])].filter(x => x !== right)).slice(0, 2);
    return shuffleArr([right, ...wrong]);
  }
  function advanceRole(queue) {
    const g = game;
    while (g.i < g.d.lines.length && g.d.lines[g.i][0] !== 'B') { g.shown.push(g.i); queue.push([g.d.lines[g.i][1], 'A']); g.i++; }
    g.options = g.i < g.d.lines.length ? roleOptions() : null;
    renderRole();
    speakQueue(queue);
  }
  function renderRole(msg = '') {
    const g = game, d = g.d, total = d.lines.filter(l => l[0] === 'B').length;
    const bubbles = g.shown.map(i => { const [who, jp, zh] = d.lines[i]; return `<li class="bubble ${who === 'B' ? 'me' : ''}"><span class="who">${esc(d.roles[who])}</span><button class="say-line" data-say="${esc(jp)}" data-voice-role="${who}"><span lang="ja">${esc(jp)}</span></button>${g.options ? '' : `<span class="zh">${esc(zh)}</span>`}</li>`; }).join('');
    app().innerHTML = `<section class="game">
      ${gameTop('notebook', '角色扮演', `失誤 ${g.mistakes}`)}
      <p class="meta">場景：${esc(d.scene)}。你是「${esc(d.roles.B)}」，對方是「${esc(d.roles.A)}」。</p>
      <div class="card dialogue"><ol class="bubbles">${bubbles}</ol>
      ${g.options ? `<p class="sub">輪到你說：</p><div class="choices">${g.options.map((o, n) => `<button class="btn role-choice" data-role-choice="${n}"><span lang="ja">${esc(o)}</span></button>`).join('')}</div>` : `<div class="center role-done"><h2>對話完成！</h2><p>${total} 句台詞，失誤 ${g.mistakes} 次。現在每句都附上中文，可以再對照一次。</p></div>`}
      </div>
      <p id="feedback" class="meta" role="status" aria-live="polite">${esc(msg)}</p>
      ${g.options ? '' : gameEnd('role')}
    </section>`;
    if (!g.options && !g.logged) { g.logged = true; Progress.endSession(Math.max(0, total - g.mistakes), total, '角色扮演'); }
  }
  function roleChoose(n, btn) {
    const g = game, right = g.d.lines[g.i][1];
    if (g.options[n] !== right) { g.mistakes++; btn.classList.add('wrong'); btn.disabled = true; $('#feedback').textContent = '這句不太對，想想對方剛剛說了什麼。'; return; }
    g.shown.push(g.i); g.i++;
    advanceRole([[right, 'B']]);
  }

  // ────────────────────────────── 今日：輕鬆一下 ──────────────────────────────
  function phraseOfDay(now = new Date()) {
    const pool = LIFE().topics.flatMap(t => [...(t.dialogue?.lines || []).map(([, jp, zh]) => ({ jp, zh, from: `生活日本・${t.title}` })), ...(t.phrases || []).map(p => ({ jp: p.parts.join(''), zh: p.zh, from: `生活日本・${t.title}` }))]);
    if (!pool.length) return null;
    const day = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 864e5);
    return pool[(day * 7) % pool.length];
  }
  function todayExtras(level, unit) {
    const list = Curriculum.all(level);
    const lifeUnits = list.filter(u => u.auto === 'life');
    const nextLife = lifeUnits.find(u => !Curriculum.stats(u).done) || lifeUnits[0];
    const playUnit = [unit, ...list].find(u => u && !u.readOnly && Curriculum.pairs(u).length >= 4);
    const fresh = Curriculum.freshUnits().filter(u => Curriculum.stats(u).status === 'todo');
    const p = phraseOfDay();
    return `${fresh.length ? `<section class="fresh-note">${icon('notebook')}<p>Notion 有新筆記，已排進課程：${fresh.map(u => `<a href="#/unit/${esc(u.key)}">${esc(u.title)}（${u.level} 第 ${u.index} 單元）</a>`).join('、')}</p></section>` : ''}
    <div class="today-play">
      ${p ? `<article class="play-card phrase-day"><p class="eyebrow">今日一句</p><p class="pd-jp" lang="ja">${esc(p.jp)}</p><details><summary>看中文</summary><p>${esc(p.zh)}</p><p class="meta">${esc(p.from)}</p></details><button class="btn small" data-say="${esc(p.jp)}">${icon('speaker-high')} 聽</button></article>` : ''}
      ${nextLife ? `<a class="play-card life-next ${THEME_CLASS[nextLife.theme] || ''}" href="#/unit/${esc(nextLife.key)}">${themeGlyph(nextLife.theme, 'big')}<p class="eyebrow">生活日本・${esc(nextLife.theme)}</p><b>${esc(nextLife.title)}</b><small>${esc(nextLife.desc)}</small></a>` : ''}
      ${playUnit ? `<a class="play-card game-next" href="#/play/match?unit=${encodeURIComponent(playUnit.key)}">${icon('cards-three')}<p class="eyebrow">一分鐘小遊戲</p><b>配對：${esc(playUnit.title)}</b><small>把日文和意思連起來，挑戰最快紀錄。</small></a>` : ''}
    </div>`;
  }

  // ────────────────────────────── 複習 ──────────────────────────────
  function viewReview() {
    const o = Quiz.overallStats(); const due = dueCount();
    const recent = Progress.load().sessions.slice(-8).reverse();
    const daily = Quiz.buildQuestions(Study.dailyOptions());
    const rows = Curriculum.LEVELS.map(l => { const z = Curriculum.levelSummary(l), s = Quiz.levelStats(l), k = Quiz.kanjiStats(l); return `<tr><td><a href="#/course/${l}">${l}</a></td><td>${z.done} / ${z.total}</td><td>${s.mastered} / ${s.total}</td><td>${k.mastered} / ${k.total}</td></tr>`; }).join('');
    return `
    <section class="page-head"><h1> 複習</h1></section>
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
    <section class="page-head"><h1> 參考資料</h1></section>
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
    const items = [...DATA().vocab, ...DATA().grammar, ...DATA().phrases, ...(DATA().drills || [])].filter(x => x.source?.startsWith(page.title + ' › ') && x.source.endsWith(' › ' + section.heading));
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
  function speak(text, role) { if (window.Voice && text) return Voice.speak(text, role === 'A' ? { preset: 'natural' } : {}); return null; }

  // ────────────────────────────── 測驗 ──────────────────────────────
  const quiz = { qs: [], i: 0, score: 0, answered: false, mode: '', wrong: [], answers: [] };

  function viewQuizSetup(params) {
    const levels = params.get('levels') === 'all' ? [...Quiz.LEVELS] : (params.get('levels') || Study.profile().level).split(',').filter(Boolean);
    const types = (params.get('types') || (params.has('source') || params.has('page') ? 'vocab_meaning,vocab_reading,grammar,grammar_cloze,phrase,drill_meaning,drill_transform' : 'vocab_meaning,vocab_reading')).split(',').filter(Boolean);
    const weak = params.get('weak') === '1';
    const origins = (params.get('origins') || 'notion,external,life').split(',').filter(Boolean);
    const chip = (name, val, label, on) => `<label class="chip ${on ? 'on' : ''}"><input type="checkbox" name="${name}" value="${val}" ${on ? 'checked' : ''}>${label}</label>`;
    const o = Quiz.overallStats();
    return `
    <section class="page-head"><h1> 複習測驗</h1><a class="btn small" href="#/quiz?mode=daily">依目前程度開始今日練習</a>${masteryHelp()}</section>
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
      <div class="chips">${chip('origins', 'notion', ` 作者筆記 <small>${o.notionVocab}</small>`, origins.includes('notion'))}${chip('origins', 'external', ` 公開單字 <small>${o.externalVocab}</small>`, origins.includes('external'))}${chip('origins', 'life', ` 生活日本 <small>${DATA().vocab.filter(v => v.origin === 'life').length}</small>`, origins.includes('life'))}</div>
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
        ${q.listen ? `<button class="listen-btn" data-say="${esc(q.listen)}" aria-label="播放題目發音">${icon('speaker-high')}<span>${esc(q.prompt)}</span></button>` : `<div class="prompt ${[...q.prompt].length === 1 ? 'single' : ''}" lang="ja">${q.promptHtml || esc(q.prompt)}</div>`}
        ${q.sub ? `<div class="sub">${esc(q.sub)}</div>` : ''}
        ${q.type.startsWith('kanji') || q.input || q.listen ? '' : `<button class="btn tiny say" data-say="${esc(q.item.reading || q.prompt)}" ${['vocab_word', 'kana'].includes(q.type) ? 'data-reveals="true"' : ''} aria-label="播放日文發音"><span class="ph-icon" data-icon="speaker-high" aria-hidden="true"></span>${['vocab_word', 'kana'].includes(q.type) ? '（提示）' : ''}</button>`}
        ${q.hint ? `<div><button class="btn small" id="show-hint" aria-controls="question-hint" aria-expanded="false">需要提示</button><p id="question-hint" hidden></p></div>` : ''}
        ${q.usedHint ? '<p class="meta">這次已看過內容，計入練習，不增加跨日熟練次數。</p>' : ''}
      </div>
      ${q.input ? `<form id="recall-answer" class="recall"><label for="answer-text">${q.type === 'vocab_recall' ? '輸入讀音（平假名／片假名皆可）' : q.type === 'grammar_cloze' ? '輸入空格中缺少的助詞或句型' : '輸入答案'}</label><input id="answer-text" name="answer" autocomplete="off" autocapitalize="off" spellcheck="false" required><button class="btn primary">確認答案</button><button type="button" id="dont-know" class="btn">還想不起來</button></form>` : `<div class="choices">${q.choices.map((c, i) => `<button class="btn choice" data-i="${i}"><span class="key">${'ABCD'[i]}</span>${esc(c)}</button>`).join('')}</div>`}
      <div id="feedback" class="feedback" role="status" aria-live="polite"></div>
    </section>`;
    labelAudio();
    $('#answer-text')?.focus();
    if (q.listen) speak(q.listen);
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
    $('#feedback').innerHTML = `<div class="card ${ok ? 'good' : 'bad'}">${window.Art ? Art.char(ok ? 'maneki' : 'uruuru', 'fb-cat') : ok ? icon('check-circle') : icon('x')}<b>${ok ? (q.usedHint ? '練習答對，之後再獨立回想' : '獨立答對！') : '再看一次正確答案'}：${esc(q.answer)}</b><div class="extra">${extra}</div>
      <button class="btn primary" id="next">${quiz.i + 1 < quiz.qs.length ? '下一題 →' : '看結果 '}</button></div>`;
    $('#next').focus();
  }

  function nextQuestion() {
    quiz.i++; quiz.answered = false;
    if (quiz.i < quiz.qs.length) renderQuestion(); else renderResult();
    // 回饋卡片很長時會捲到頁面下方，換題後回到頂端
    window.scrollTo(0, 0);
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
        <div class="result-mascot">${doodle(pct >= 80 ? 'maneki' : 'shiro')}</div>
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
    const head = '<section class="page-head"><h1><span class="ph-icon" data-icon="speaker-high" aria-hidden="true"></span> 聲音</h1></section>' + voiceSourceCard();
    if (!V || !V.supported()) return `${head}<div class="card"><p>這個瀏覽器不支援語音朗讀，換 Chrome、Edge 或 Safari 試試看。</p></div>`;
    const list = V.voices(), cur = V.current(), st = V.settings();
    if (!list.length) return `${head}<div class="card"><h2>還沒找到日文聲音</h2><p>聲音清單可能還在載入，等一下會自動出現。如果一直是空的，代表這台裝置沒有日文語音，唸出來會很怪或沒有聲音。</p>${VOICE_HELP}</div>`;
    return `${head}
    <div class="card tape">
      <h2>語氣</h2>
      <div class="chips">${Object.entries(V.PRESETS).map(([k, p]) => `<button type="button" class="chip ${st.preset === k ? 'on' : ''}" data-voice-preset="${k}">${p.label}</button>`).join('')}</div>
      <form id="voice-test" class="search"><input name="text" value="${esc(VOICE_SAMPLE)}" aria-label="試聽句子"><button class="btn small primary">試聽</button></form>
      <p class="meta">${V.library?.() && V.settings().source !== 'device' ? '有錄音的字唸東北きりたん；沒有錄音的字用：' : '目前：'}${esc(cur?.name || '—')}</p>
    </div>
    <div class="card">
      <h2>裝置朗讀的聲音 <small>這台裝置有 ${list.length} 個日文聲音，只用在沒有錄音的字</small></h2>
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
  // 聲音來源：VOICEVOX 東北きりたん的錄音（所有裝置一樣）或這台裝置的朗讀
  function voiceSourceCard() {
    const V = window.Voice, A = V?.library?.();
    if (!A) return '';
    const cur = V.settings().source, n = A.keys.split(',').length;
    const opts = [['recorded', `錄音：${A.voice}`], ['device', '這台裝置的朗讀']];
    return `<div class="card voice-source"><h2>聲音來源</h2>
      <div class="chips" role="radiogroup" aria-label="聲音來源">${opts.map(([v, label]) => `<button type="button" class="chip ${cur === v ? 'on' : ''}" role="radio" aria-checked="${cur === v}" data-voice-source="${v}">${esc(label)}</button>`).join('')}</div>
      <p class="meta">${esc(A.voice)}的錄音有 ${n} 段，手機和電腦聽到的都一樣。單一漢字、還沒錄音的新單字會用這台裝置的朗讀。下面的「語氣」選「慢慢說」也會讓錄音放慢。</p>
      <div class="actions"><button type="button" class="btn small primary" data-say="ありがとうございます">${icon('speaker-high')} 試聽${esc(A.voice)}</button><a class="text-link" href="https://voicevox.hiroshiba.jp/product/tohoku_kiritan/" target="_blank" rel="noopener">${esc(A.credit)}</a></div>
    </div>`;
  }

  // ────────────────────────────── 跨裝置同步 ──────────────────────────────
  function viewSync(msg = '') {
    if (!Sync.enabled()) {
      return `
      <section class="page-head"><h1> 跨裝置同步</h1></section>
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
    <section class="page-head"><h1> 跨裝置同步</h1></section>
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
    const navView = { home: 'home', course: 'course', map: 'course', unit: 'course', play: 'course', life: 'life', review: 'review', quiz: 'review', reference: 'reference', notes: 'reference', kana: 'reference', kanji: 'reference', voice: 'settings', sync: 'sync', settings: 'settings' }[view] || 'home';
    document.body.classList.remove('nav-open');
    $('#nav-toggle')?.setAttribute('aria-expanded', 'false');
    quiz.qs = []; quiz.unitKey = ''; game.kind = '';
    document.querySelectorAll('nav.top a').forEach(a => { const active = a.dataset.view === navView; a.classList.toggle('active', active); if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    window.scrollTo(0, 0);
    switch (view) {
      case 'map': case 'course': app().innerHTML = viewCourse(seg[1] || ''); break;
      case 'unit': app().innerHTML = viewUnit(decodeURIComponent(seg[1] || '')); break;
      case 'review': app().innerHTML = viewReview(); break;
      case 'life': app().innerHTML = viewLife(decodeURIComponent(seg[1] || '')); break;
      case 'play': {
        const u = Curriculum.get(params.get('unit') || '');
        if (!u) { app().innerHTML = viewUnit(params.get('unit') || ''); break; }
        if (seg[1] === 'match' && Curriculum.pairs(u).length >= 2) startMatch(u);
        else if (seg[1] === 'build' && buildItems(u).length) startBuild(u);
        else if (seg[1] === 'role' && u.topic?.dialogue) startRole(u);
        else app().innerHTML = viewUnit(u.key);
        break;
      }
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
          const types = params.get('types') ? { types: params.get('types').split(',') } : {};
          startQuiz(Curriculum.quizOpts(u, { weakOnly: params.get('weak') === '1', count: +params.get('count') || 10, ...types }), `${u.level} 第 ${u.index} 單元${types.types?.includes('listen') ? '・聽力' : ''}`);
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
    decorateHead(view);
    window.Motion?.enhance(app());
    if (view === 'notes' && /^\d+$/.test(params.get('section') || '')) document.getElementById('lesson-' + params.get('section'))?.scrollIntoView();
  }
  // 每頁的大標題：窄體襯線的英文（裝飾用，螢幕閱讀器略過）
  const HEAD_EN = { course: 'Course', map: 'Course', life: 'Life in Japan', review: 'Review', reference: 'Library', notes: 'Notes', kana: 'Kana', kanji: 'Kanji', quiz: 'Practice', settings: 'Settings', sync: 'Sync', voice: 'Voice', unit: 'Unit' };
  function decorateHead(view) {
    const head = app().querySelector('.page-head');
    if (!head || head.querySelector('.display-en')) return;
    const en = head.dataset.en || HEAD_EN[view];
    if (en) head.insertAdjacentHTML('afterbegin', `<p class="display-en" aria-hidden="true">${esc(en)}</p>`);
    const cat = HEAD_CAT[view];
    if (cat && window.Art) head.insertAdjacentHTML('afterbegin', `<span class="head-cat">${Art.char(cat)}</span>`);
  }
  const HEAD_CAT = { course: 'shiro', map: 'shiro', unit: 'walk', life: 'chatora', review: 'mike', reference: 'shiro', notes: 'shiro', kana: 'kuro', kanji: 'mike', quiz: 'maneki', settings: 'akubi', sync: 'walk', voice: 'chatora' };

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
    const mo = e.target.closest('[data-motion]');
    if (mo && window.Motion) { Motion.setPref(mo.dataset.motion); app().innerHTML = viewSettings(); decorateHead('settings'); Motion.enhance(app()); return; }
    const mr = e.target.closest('#mark-read');
    if (mr) { const u = Curriculum.get(mr.dataset.unit); if (u) { Curriculum.markRead(u); app().innerHTML = viewUnit(u.key); } return; }
    if (e.target.closest('#learned-next')) { const q = quiz.qs[quiz.i]; q.previewSeen = true; q.usedHint = true; return renderQuestion(); }
    if (e.target.closest('#show-hint')) { const q = quiz.qs[quiz.i]; if (!q || quiz.answered) return; q.usedHint = true; $('#question-hint').textContent = q.hint + '（本題改計提示練習）'; $('#question-hint').hidden = false; $('#show-hint').setAttribute('aria-expanded', 'true'); return; }
    if (e.target.closest('#dont-know')) return answer('');
    const c = e.target.closest('.choice'); if (c) return answer(+c.dataset.i);
    if (e.target.closest('#next')) return nextQuestion();
    const mc = e.target.closest('[data-match]'); if (mc && game.kind === 'match') return matchClick(mc.dataset.match, mc.dataset.id);
    const bp = e.target.closest('[data-build-pick]'); if (bp && game.kind === 'build') { game.picked.push(...game.pool.splice(+bp.dataset.buildPick, 1)); return renderBuild(); }
    const br = e.target.closest('[data-build-remove]'); if (br && game.kind === 'build') { game.pool.push(...game.picked.splice(+br.dataset.buildRemove, 1)); return renderBuild(); }
    if (e.target.closest('#build-reset')) { game.pool.push(...game.picked); game.picked = []; return renderBuild(); }
    if (e.target.closest('#build-check')) return checkBuild();
    if (e.target.closest('#build-next')) { game.i++; return game.i < game.items.length ? setupBuild() : finishBuild(); }
    const rc = e.target.closest('[data-role-choice]'); if (rc && game.kind === 'role') return roleChoose(+rc.dataset.roleChoice, rc);
    const rp = e.target.closest('[data-replay]'); if (rp && game.u) return ({ match: startMatch, build: startBuild, role: startRole })[rp.dataset.replay]?.(game.u);
    const tz = e.target.closest('[data-toggle-zh]');
    if (tz) { const on = tz.getAttribute('aria-pressed') !== 'true'; tz.setAttribute('aria-pressed', String(on)); tz.textContent = on ? '隱藏中文' : '顯示中文'; tz.closest('.dialogue').querySelectorAll('.zh').forEach(z => { z.hidden = !on; }); return; }
    const pd = e.target.closest('[data-play-dialogue]');
    if (pd) {
      const t = LIFE().topics.find(x => x.id === pd.dataset.playDialogue), box = pd.closest('.dialogue');
      if (t) speakQueue(t.dialogue.lines.map(([who, jp]) => [jp, who]), i => box.querySelectorAll('.bubble').forEach((b, j) => b.classList.toggle('playing', j === i)));
      return;
    }
    const tc = e.target.closest('[data-trivia-choice]');
    if (tc) {
      const box = tc.closest('[data-trivia]'), [tid, qi] = box.dataset.trivia.split(':'), q = LIFE().topics.find(x => x.id === tid)?.quiz?.[+qi];
      if (!q) return;
      const ok = +tc.dataset.triviaChoice === q.answer;
      box.querySelectorAll('[data-trivia-choice]').forEach(b => { b.disabled = true; if (+b.dataset.triviaChoice === q.answer) b.classList.add('correct'); else if (b === tc) b.classList.add('wrong'); });
      const ex = box.querySelector('.trivia-explain'); ex.hidden = false; ex.textContent = (ok ? '答對了！' : `正確答案是「${q.choices[q.answer]}」。`) + q.explain;
      return;
    }
    const s = e.target.closest('[data-say]'); if (s) { if (s.dataset.reveals && quiz.qs[quiz.i] && !quiz.answered) { quiz.qs[quiz.i].usedHint = true; s.textContent = '已用語音提示'; } if (game.kind === 'build' && !game.solved && s.closest('.game')) game.usedHint = true; return speak(s.dataset.say, s.dataset.voiceRole); }
    if (e.target.closest('#create-code')) return syncAction(() => Sync.createNew(), c => ` 已產生同步碼 ${c}，把它抄到其他裝置就能接上。`);
    if (e.target.closest('#sync-now')) return syncAction(() => Sync.pull(), ' 同步完成。');
    if (e.target.closest('#unlink')) { if (confirm('這台裝置會停止同步（本機進度保留，雲端資料也還在）。確定？')) { Sync.unlink(); app().innerHTML = viewSync('已斷開。'); } return; }
    if (e.target.closest('#copy-code')) { navigator.clipboard?.writeText($('#synccode-text').textContent).then(() => { $('#copy-code').textContent = ' 已複製'; }); return; }
    const vs = e.target.closest('[data-voice-source]');
    if (vs && window.Voice) { Voice.set({ source: vs.dataset.voiceSource }); app().innerHTML = viewVoice(); decorateHead('voice'); return speak('ありがとうございます'); }
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
  window.addEventListener('hashchange', () => (window.Motion ? Motion.swap(route) : route()));
  window.addEventListener('DOMContentLoaded', () => {
    window.Motion?.init();
    // 頁尾的草地和角色
    const foot = document.querySelector('footer .foot-art');
    if (foot && window.Art) foot.innerHTML = Art.hill() + `<div class="foot-chars">${Art.char('shiro')}${Art.char('kuro')}${Art.char('chatora')}</div>`;

    Sync.init();
    // 聲音清單是非同步載入的：在聲音頁的話，載好後重畫
    window.Voice?.onVoicesChanged(() => { if (location.hash.startsWith('#/voice')) app().innerHTML = viewVoice(); });
    Sync.onStatus(() => { if (location.hash.startsWith('#/sync')) { /* 狀態列已由 pill 更新；頁面等下次操作再重畫 */ } });
    route();
  });
})();
