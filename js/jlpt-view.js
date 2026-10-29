// jlpt-view.js — JLPT 考試專區的畫面
// 依賴：window.JLPT（js/jlpt-core.js）、window.Progress
// 路由：#/jlpt 專區首頁、#/jlpt/daily 每日 20 題、#/jlpt/settings 設定
window.JLPTView = (() => {
  const J = () => window.JLPT;
  const esc = s => J().esc(s);
  const icon = n => `<span class="ph-icon" data-icon="${n}" aria-hidden="true"></span>`;
  const DAILY_KEY = 'nihongo.jlpt.daily';
  const SAMPLES = 'https://www.jlpt.jp/samples/sampleindex.html';
  let el = null, view = 'home', bound = false;

  const fmtDate = iso => { const [y, m, d] = String(iso).split('-').map(Number); return `${y}/${m}/${d}`; };
  const byId = level => new Map(J().bank(level).questions.map(q => [q.id, q]));
  const pct = x => `${Math.round(x * 100)}%`;

  // ── 題目（題本風格）──
  // mode：practice 每日練習（作答後立刻看詳解）／exam 考試模式（Task 8）
  function questionHtml(q, { mode = 'practice', number = 1, chosen = null, reveal = false } = {}) {
    const t = J().TYPES[q.type];
    const plain = s => String(s).replace(/\{([^{}|]+)\|[^{}|]+\}/g, '$1');
    const long = q.choices.some(c => [...plain(c)].length > 8);
    const spoken = q.type === 'utterance' || q.type === 'response'; // 選項只用聽的，題本上不印
    const choices = spoken ? '' : `<ol class="choices ${long ? 'grid2' : 'row4'}">${q.choices.map((c, i) => `<li><span class="cn">${i + 1}</span><span lang="ja">${J().renderStem(c)}</span></li>`).join('')}</ol>`;
    const bubs = q.choices.map((c, i) => {
      const v = i + 1, cls = [chosen === v ? 'on' : '', reveal && v === q.answer ? 'ok' : '', reveal && chosen === v && v !== q.answer ? 'ng' : ''].filter(Boolean).join(' ');
      return `<button type="button" class="bub ${cls}" data-v="${v}" aria-label="選 ${v}" ${reveal ? 'disabled' : ''}>${v}</button>`;
    }).join('');
    const reported = J().isReported(q);
    const explain = reveal ? `<div class="explain" role="status"><p><b>${chosen === q.answer ? '○ 答對了' : `× 正確答案是 ${q.answer}`}</b></p><p>${esc(q.explain)}</p>
      <button type="button" class="link-btn" data-jlpt-report ${reported ? 'disabled' : ''}>${reported ? '已回報，這題會先停止出題' : '回報題目有問題'}</button></div>` : '';
    return `<article class="q" data-qid="${esc(q.id)}" data-section="${t.section}" data-type="${q.type}" data-mode="${mode}">
      <div class="qhead"><span class="qno">${number}</span><span class="qtype">${esc(t.label)}</span></div>
      ${q.stem ? `<p class="stem" lang="ja">${J().renderStem(q.stem)}</p>` : ''}
      ${choices}
      <div class="sheet" role="group" aria-label="答案卡"><span class="sheet-label">かいとう</span>${bubs}</div>
      ${explain}</article>`;
  }

  // ── 每日 20 題：當天的題目固定下來，中途離開也能接著做 ──
  function loadDaily() { try { return JSON.parse(localStorage.getItem(DAILY_KEY)) || null; } catch { return null; } }
  function saveDaily(d) { try { localStorage.setItem(DAILY_KEY, JSON.stringify(d)); } catch {} }
  function daily() {
    const day = Progress.dayKey(), level = J().settings().level;
    let d = loadDaily();
    if (!d || d.day !== day || d.level !== level) {
      d = { day, level, ids: J().dailySet({ level }).map(q => q.id), i: 0, results: {}, ended: false };
      saveDaily(d);
    }
    return d;
  }
  const dailyDone = d => Object.keys(d.results).length;

  function dailyBody() {
    const d = daily(), map = byId(d.level), ids = d.ids.filter(id => map.has(id));
    if (!ids.length) return '<p class="meta">題庫準備中，題目審查完成後就會出現在這裡。</p>';
    if (d.i >= ids.length) {
      const score = ids.filter(id => d.results[id] === map.get(id).answer).length;
      if (!d.ended) { Progress.endSession(score, ids.length, 'jlpt-daily'); d.ended = true; saveDaily(d); }
      return `<div class="done"><p class="big">今天的 ${ids.length} 題做完了！</p><p>答對 ${score} 題。答錯的題目會在之後的每日練習再出現。</p><p><a class="btn small" href="#/jlpt">回專區首頁</a></p></div>`;
    }
    const q = map.get(ids[d.i]), chosen = d.results[q.id] ?? null;
    return `<p class="exam-progress">第 ${d.i + 1} / ${ids.length} 題</p>
      ${questionHtml(q, { mode: 'practice', number: d.i + 1, chosen, reveal: chosen !== null })}
      ${chosen !== null ? `<p class="exam-actions"><button type="button" class="btn small primary" data-jlpt-next>${d.i + 1 < ids.length ? '下一題' : '看結果'} ${icon('arrow-right')}</button></p>` : ''}`;
  }
  const viewDaily = () => `<section class="page-head" data-en="JLPT"><h1>每日 20 題</h1><p class="meta"><a href="#/jlpt">← JLPT 專區</a>・作答後立刻顯示詳解</p></section>
    <section class="exam" id="jlpt-daily">${dailyBody()}</section>`;

  // ── 專區首頁 ──
  function viewHome() {
    const s = J().settings(), days = J().daysLeft();
    const count = days >= 0 ? `距離考試還有 ${days} 天（${fmtDate(s.examDate)}・${esc(s.target)}）` : `考試日期（${fmtDate(s.examDate)}）已經過了，請到設定更新下一次的考試日期。`;
    const hasBank = J().bank(s.level).questions.length > 0;
    const d = hasBank ? daily() : null, n = d ? d.ids.length : 0, done = d ? dailyDone(d) : 0;
    const ts = J().typeStats(s.level);
    const weak = Object.entries(ts).filter(([, o]) => o.pct !== null).sort((a, b) => a[1].pct - b[1].pct).slice(0, 5);
    return `<section class="page-head" data-en="JLPT"><h1>JLPT 考試專區</h1><p class="lead jlpt-count">${count}</p></section>
    <div class="jlpt-grid">
      <section class="card"><h2>${icon('calendar-blank')} 每日 20 題</h2>
        ${hasBank ? `<p>今天 ${done} / ${n} 題</p><p><a class="btn primary" href="#/jlpt/daily">${done === 0 ? '開始今天的練習' : done < n ? '繼續今天的練習' : '看今天的結果'}</a></p>` : '<p class="meta">題庫準備中。</p>'}</section>
      <section class="card"><h2>${icon('check-circle')} 畢業進度</h2><p>目前練習：<b>${esc(s.level)}</b>　目標：<b>${esc(s.target)}</b></p>
        <p class="meta">連續 ${s.needed} 份模擬考答對 ${pct(s.passPct)} 以上就畢業。</p><p class="meta">還沒有模擬考紀錄。</p></section>
      <section class="card"><h2>${icon('chart-line')} 需要加強的題型</h2>
        ${weak.length ? `<ol class="weak-list">${weak.map(([t, o]) => `<li><span>${esc(J().TYPES[t].label)}</span><span class="bar" style="--p:${Math.round(o.pct * 100)}"></span><b>${pct(o.pct)}</b></li>`).join('')}</ol>` : '<p class="meta">做幾題之後，這裡會顯示最需要加強的題型。</p>'}</section>
      <section class="card"><h2>${icon('book-open')} 參考</h2>
        <p><a href="${SAMPLES}" target="_blank" rel="noopener">JLPT 官方範例題與練習試題</a></p>
        <p><a href="#/jlpt/settings">${icon('sliders-horizontal')} 考試日期與畢業門檻設定</a></p></section>
    </div>`;
  }

  // ── 設定 ──
  function viewSettings(status = '') {
    const s = J().settings();
    const opt = (v, cur, label = v) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${label}</option>`;
    return `<section class="page-head" data-en="JLPT"><h1>JLPT 設定</h1><p class="meta"><a href="#/jlpt">← JLPT 專區</a></p></section>
    <section class="card"><form id="jlpt-settings" class="jlpt-form">
      <label>目標級數 <select name="target">${['N5', 'N4', 'N3'].map(l => opt(l, s.target)).join('')}</select></label>
      <label>考試日期 <input type="date" name="examDate" value="${esc(s.examDate)}" required></label>
      <label>畢業門檻（正確率） <select name="passPct">${[0.7, 0.75, 0.8, 0.85, 0.9].map(p => opt(p, s.passPct, pct(p))).join('')}</select></label>
      <label>連續幾份模擬考 <select name="needed">${[1, 2, 3].map(n => opt(n, s.needed, `${n} 份`)).join('')}</select></label>
      <p><button class="btn primary" type="submit">儲存</button></p>
      <p class="meta" role="status">${esc(status)}</p>
    </form><p class="meta">台灣的 JLPT 一年兩次（7 月、12 月的第一個星期日），報名日期以語言訓練測驗中心（LTTC）公告為準。</p></section>`;
  }

  function render() {
    if (!el) return;
    el.innerHTML = view === 'daily' ? viewDaily() : view === 'settings' ? viewSettings() : viewHome();
  }
  const rerenderDaily = () => { const box = document.getElementById('jlpt-daily'); if (box) box.innerHTML = dailyBody(); };
  function currentDailyQuestion() { const d = daily(), map = byId(d.level); return [d, map.get(d.ids.filter(id => map.has(id))[d.i])]; }

  function bind() {
    if (bound) return; bound = true;
    document.addEventListener('click', e => {
      if (!e.target.closest('#jlpt-daily')) return;
      const bub = e.target.closest('.bub');
      if (bub && !bub.disabled) {
        const [d, q] = currentDailyQuestion();
        if (!q || d.results[q.id] != null) return;
        const v = +bub.dataset.v;
        Progress.record(J().qid(q), v === q.answer);
        d.results[q.id] = v; saveDaily(d); return rerenderDaily();
      }
      if (e.target.closest('[data-jlpt-next]')) { const d = daily(); d.i++; saveDaily(d); rerenderDaily(); window.scrollTo?.(0, 0); return; }
      if (e.target.closest('[data-jlpt-report]')) { const [, q] = currentDailyQuestion(); if (q) { J().report(q); rerenderDaily(); } }
    });
    document.addEventListener('submit', e => {
      if (e.target.id !== 'jlpt-settings') return;
      e.preventDefault();
      const f = new FormData(e.target);
      J().setSettings({ target: f.get('target'), examDate: f.get('examDate'), passPct: +f.get('passPct'), needed: +f.get('needed') });
      el.innerHTML = viewSettings('已儲存。');
    });
  }

  function mount(target, seg = [], params) {
    el = target; view = seg[0] === 'daily' ? 'daily' : seg[0] === 'settings' ? 'settings' : 'home';
    bind(); render();
  }

  // 「今日」頁的卡片
  function todayCard() {
    const s = J().settings();
    if (!J().bank(s.level).questions.length) return '';
    const d = daily(), days = J().daysLeft();
    return `<a class="play-card jlpt-today" href="#/jlpt/daily"><span class="glyph" aria-hidden="true" lang="ja">試</span><p class="eyebrow">JLPT・${days >= 0 ? `距離考試 ${days} 天` : '設定考試日期'}</p><b>每日 20 題</b><small>今天 ${dailyDone(d)} / ${d.ids.length} 題</small></a>`;
  }

  return { mount, todayCard, questionHtml };
})();
