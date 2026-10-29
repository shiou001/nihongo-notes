// jlpt-view.js — JLPT 考試專區的畫面
// 依賴：window.JLPT（js/jlpt-core.js）、window.Progress
// 路由：#/jlpt 專區首頁、#/jlpt/daily 每日 20 題、#/jlpt/settings 設定
window.JLPTView = (() => {
  const J = () => window.JLPT;
  const esc = s => J().esc(s);
  const icon = n => `<span class="ph-icon" data-icon="${n}" aria-hidden="true"></span>`;
  const DAILY_KEY = 'nihongo.jlpt.daily';
  const SAMPLES = 'https://www.jlpt.jp/samples/sampleindex.html';
  let el = null, view = 'home', bound = false, resultAt = '';

  const fmtDate = iso => { const [y, m, d] = String(iso).split('-').map(Number); return `${y}/${m}/${d}`; };
  const byId = level => new Map(J().bank(level).questions.map(q => [q.id, q]));
  const pct = x => `${Math.round(x * 100)}%`;

  // ── 題目（題本風格）──
  // mode：practice 每日練習（作答後立刻看詳解）／exam 考試模式（Task 8）
  // mode：example 大題開頭的（れい），答案已塗好、不能按
  function questionHtml(q, { mode = 'practice', number = 1, chosen = null, reveal = false } = {}) {
    const locked = reveal || mode === 'example';
    const t = J().TYPES[q.type];
    const plain = s => String(s).replace(/\{([^{}|]+)\|[^{}|]+\}/g, '$1');
    const long = q.choices.some(c => [...plain(c)].length > 8);
    const spoken = q.type === 'utterance' || q.type === 'response'; // 選項只用聽的，題本上不印
    const choices = spoken ? '' : `<ol class="choices ${long ? 'grid2' : 'row4'}">${q.choices.map((c, i) => `<li><span class="cn">${i + 1}</span><span lang="ja">${J().renderStem(c)}</span></li>`).join('')}</ol>`;
    const bubs = q.choices.map((c, i) => {
      const v = i + 1, cls = [chosen === v ? 'on' : '', reveal && v === q.answer ? 'ok' : '', reveal && chosen === v && v !== q.answer ? 'ng' : ''].filter(Boolean).join(' ');
      return `<button type="button" class="bub ${cls}" data-v="${v}" aria-label="選 ${v}" ${locked ? 'disabled' : ''}>${v}</button>`;
    }).join('');
    const reported = J().isReported(q);
    const explain = reveal ? `<div class="explain" role="status"><p><b>${chosen === q.answer ? '○ 答對了' : `× 正確答案是 ${q.answer}`}</b></p><p>${esc(q.explain)}</p>
      <button type="button" class="link-btn" data-jlpt-report ${reported ? 'disabled' : ''}>${reported ? '已回報，這題會先停止出題' : '回報題目有問題'}</button></div>` : '';
    return `<article class="q${mode === 'example' ? ' example' : ''}" data-qid="${esc(q.id)}" data-section="${t.section}" data-type="${q.type}" data-mode="${mode}">
      <div class="qhead"><span class="qno">${number}</span>${mode === 'practice' ? `<span class="qtype">${esc(t.label)}</span>` : ''}</div>
      ${q.stem ? `<p class="stem" lang="ja">${J().renderStem(q.stem)}</p>` : ''}
      ${choices}
      <div class="sheet" role="group" aria-label="答案卡"><span class="sheet-label">かいとう</span>${bubs}</div>
      ${explain}</article>`;
  }

  // 文章（文章文法、讀解）：方框號碼換成畫面上的題號，目前這一題的方框加粗
  //   numberOf(id) → 那一題在畫面上的題號
  function passageHtml(q, level, numberOf) {
    if (!q.passage) return '';
    const b = J().bank(level), p = b.passages[q.passage];
    if (!p) return '';
    const boxNo = {};
    for (const g of b.questions) if (g.passage === q.passage && g.blank) boxNo[g.blank] = numberOf(g.id);
    return `<div class="passage" lang="ja">${J().renderStem(p.stem, { boxNo, current: q.blank ?? null })}</div>`;
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
      ${passageHtml(q, d.level, id => ids.indexOf(id) + 1)}
      ${questionHtml(q, { mode: 'practice', number: d.i + 1, chosen, reveal: chosen !== null })}
      ${chosen !== null ? `<p class="exam-actions"><button type="button" class="btn small primary" data-jlpt-next>${d.i + 1 < ids.length ? '下一題' : '看結果'} ${icon('arrow-right')}</button></p>` : ''}`;
  }
  const viewDaily = () => `<section class="page-head" data-en="JLPT"><h1>每日 20 題</h1><p class="meta"><a href="#/jlpt">← JLPT 專區</a>・作答後立刻顯示詳解</p></section>
    <section class="exam" id="jlpt-daily">${dailyBody()}</section>`;

  // ── 模擬考（考試模式）──
  const SECTION_NAME = { vocab: 'げんごちしき（もじ・ごい）', grammarReading: 'げんごちしき（ぶんぽう）・どっかい', listening: 'ちょうかい' };
  let timer = null, notice = '';
  const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
  const planMinutes = p => Math.round(p.sections.reduce((s, x) => s + (x.seconds || 15 * 60), 0) / 60);
  const ask = msg => (typeof window.confirm === 'function' ? window.confirm(msg) : true);

  function viewMockIntro() {
    const s = J().settings();
    const mini = J().assembleMock({ kind: 'mini' }), full = J().assembleMock({ kind: 'full' });
    if (!mini.sections.length) return `<section class="page-head" data-en="JLPT"><h1>模擬考</h1></section><section class="card"><p>題庫準備中。</p><p><a href="#/jlpt">← JLPT 專區</a></p></section>`;
    const noListen = !mini.sections.some(x => x.key === 'listening');
    const card = (p, kind, title, desc) => `<section class="card mock-choice"><h2>${title}</h2><p>${desc}</p>
      <p class="meta">${p.sections.map(x => `${SECTION_NAME[x.key]} ${x.qids.length} 題`).join('・')}</p>
      <p>大約 <b>${planMinutes(p)}</b> 分鐘</p>
      ${p.fresh ? '' : '<p class="meta">這次有些題目考過或來自練習題，成績<b>不計入畢業</b>。</p>'}
      <p><button type="button" class="btn ${kind === 'mini' ? 'primary' : ''}" data-jlpt-start data-kind="${kind}">開始${title}</button></p></section>`;
    return `<section class="page-head" data-en="JLPT"><h1>模擬考（${esc(s.level)}）</h1><p class="meta"><a href="#/jlpt">← JLPT 專區</a></p></section>
      ${notice ? `<p class="notice-line" role="status">${esc(notice)}</p>` : ''}
      <section class="card"><h2>考試規則</h2><ul>
        <li>照正式考試的順序：${Object.values(SECTION_NAME).join(' → ')}。</li>
        <li>每一科有時間限制，時間到會自動交出；<b>交出的科目不能回頭修改</b>。</li>
        <li>作答中不會顯示對錯，全部考完才看成績。</li>
        <li>前兩科可以暫停（成績會註明「有暫停」）；聽解不能暫停、不能重播。</li>
        <li>需要開聲音（聽解）。</li>
      </ul>${noListen ? '<p class="meta">聽解題目還在準備中，這次只考前兩科，成績不計入畢業。</p>' : ''}</section>
      <div class="jlpt-grid">${card(mini, 'mini', '小型模擬考', '每種題型 2–3 題，適合週末練習。')}${card(full, 'full', '全真模擬考', '題數、時間都和正式考試一樣。')}</div>`;
  }

  // 一科的題目：依題型分成大題（もんだい１、２…），每個大題開頭有作答說明和例題；題號在這一科裡連續
  function sectionBody(a) {
    const sec = J().currentSection(a), b = J().bank(a.plan.level);
    const map = new Map(b.questions.map(q => [q.id, q]));
    const qs = sec.qids.map(id => map.get(id)).filter(Boolean);
    const numberOf = id => sec.qids.indexOf(id) + 1;
    let html = '', mondai = 0;
    for (const type of J().SECTIONS[sec.key]) {
      const group = qs.filter(q => q.type === type);
      if (!group.length) continue;
      mondai++;
      const ex = b.questions.find(q => q.type === type && q.example);
      html += `<div class="mondai-head"><h2>もんだい${mondai}</h2><p class="instr" lang="ja">${J().renderStem(J().TYPES[type].instruction)}</p>
        ${ex ? `<div class="example"><p class="ex-label">（れい）</p>${questionHtml(ex, { mode: 'example', number: 'れい', chosen: ex.answer })}</div>` : ''}</div>`;
      const shown = new Set();
      for (const q of group) {
        if (q.passage && !shown.has(q.passage)) { shown.add(q.passage); html += passageHtml(q, a.plan.level, numberOf).replace('class="passage"', 'class="passage group"'); }
        html += questionHtml(q, { mode: 'exam', number: numberOf(q.id), chosen: a.answers[q.id] ?? null });
      }
    }
    return html;
  }

  function viewMock() {
    stopTimer();
    let a = J().resumeAttempt();
    if (a && !J().currentSection(a)) { finishMock(); a = null; }
    if (!a) return viewMockIntro();
    notice = '';
    const sec = J().currentSection(a), listening = sec.key === 'listening', left = J().timeLeft();
    const bar = `<div class="exam-bar" role="toolbar" aria-label="考試">
      <b>${SECTION_NAME[sec.key]}</b><span class="meta">第 ${a.sectionIndex + 1} / ${a.plan.sections.length} 科</span>
      ${left == null ? '' : `<span class="timer" aria-label="剩餘時間">${mmss(left)}</span>`}
      ${listening ? '' : a.paused ? '<button type="button" class="btn small primary" data-jlpt-resume>繼續作答</button>' : '<button type="button" class="btn small" data-jlpt-pause>暫停</button>'}
      ${listening ? '' : '<button type="button" class="btn small" data-jlpt-submit-section>交出這一科</button>'}
      <button type="button" class="btn small" data-jlpt-abandon>結束考試</button></div>`;
    const body = a.paused ? '<div class="paused"><p class="big">暫停中</p><p>按「繼續作答」回到考試，時間會從暫停的地方繼續。</p></div>' : sectionBody(a);
    return `<section class="page-head" data-en="JLPT"><h1>模擬考</h1></section>${bar}<section class="exam" id="jlpt-exam">${body}</section>`;
  }
  // 全部科目交完（Task 9 接上計分與成績頁）
  function finishMock() {
    if (typeof J().finishAttempt === 'function') { const m = J().finishAttempt(); if (m) { location.hash = `#/jlpt/result/${m.at}`; return; } }
    J().clearAttempt(); notice = '模擬考結束。';
  }
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
  function startTimer() {
    stopTimer();
    if (typeof setInterval !== 'function' || !document.getElementById('jlpt-exam')) return;
    timer = setInterval(() => {
      const box = document.getElementById('jlpt-exam'), t = document.querySelector('.exam-bar .timer');
      if (!box) return stopTimer();
      const left = J().timeLeft();
      if (t && left != null) t.textContent = mmss(left);
      if (left === 0 && !J().attempt()?.paused) { J().nextSection(); renderMock(); window.scrollTo?.(0, 0); }
    }, 1000);
  }
  function renderMock() { if (el) { el.innerHTML = viewMock(); startTimer(); } }

  // ── 成績頁（規格 §7.5）──
  const ESTIMATE_NOTE = '這是估計，官方用量尺分數，實際分數可能不同';
  const findMock = at => Progress.jlpt().mocks.find(m => String(m.at) === String(at));
  function viewResult(at) {
    const m = findMock(at);
    if (!m || !m.result) return `<section class="page-head" data-en="JLPT"><h1>找不到這次模擬考</h1><p><a href="#/jlpt">← JLPT 專區</a></p></section>`;
    const r = m.result, s = J().settings();
    const passMark = (J().PASS_TOTAL || {})[m.level] || 80;
    const when = new Date(m.at).toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' });
    const sec = Object.entries(r.sections).filter(([, x]) => x.n).map(([k, x]) => `<li>${SECTION_NAME[k]}：${x.correct} / ${x.n}（${pct(x.pct)}）</li>`).join('');
    const est = `<p>言語知識・讀解：約 <b>${r.lk.est}</b> / 120 分（最低 38 分）${r.lk.pass ? '　○ 過最低分' : '　× 沒過最低分'}</p>
      ${r.listen ? `<p>聽解：約 <b>${r.listen.est}</b> / 60 分（最低 19 分）${r.listen.pass ? '　○ 過最低分' : '　× 沒過最低分'}</p>
      <p>總分：約 <b>${r.estTotal}</b> / 180 分（及格 ${passMark} 分）　${r.estPass ? '<b>○ 估計合格</b>' : '<b>× 估計不合格</b>'}</p>` : '<p>聽解還沒開放，這次只算前兩科，不估計總分。</p>'}
      <p class="meta">${ESTIMATE_NOTE}。</p>`;
    const counted = m.counted ? `<p><b>○ 計入畢業</b>（正確率 ${pct(r.total.pct)}，畢業門檻 ${pct(s.passPct)}）</p>` : `<p><b>不計入畢業</b>：${esc((m.reasons || []).join('；'))}</p>`;
    const types = Object.entries(r.byType).sort((a, b) => a[1].correct / a[1].n - b[1].correct / b[1].n)
      .map(([t, o]) => `<li><span>${esc(J().TYPES[t].label)}</span><span class="bar" style="--p:${Math.round(o.correct / o.n * 100)}"></span><b>${o.correct}/${o.n}</b></li>`).join('');
    const b = J().bank(m.level), map = new Map(b.questions.map(q => [q.id, q]));
    const shown = new Set();
    const review = m.qids.map((id, i) => {
      const q = map.get(id);
      if (!q) return '';
      const p = q.passage && !shown.has(q.passage) ? (shown.add(q.passage), passageHtml(q, m.level, x => m.qids.indexOf(x) + 1)) : '';
      return p + questionHtml(q, { mode: 'review', number: i + 1, chosen: m.answers[id] ?? null, reveal: true });
    }).join('');
    return `<section class="page-head" data-en="JLPT"><h1>模擬考成績</h1><p class="meta"><a href="#/jlpt">← JLPT 專區</a>・${esc(when)}・${m.kind === 'full' ? '全真' : '小型'}模擬考${m.paused ? '・有暫停' : ''}</p></section>
      <div class="jlpt-grid">
        <section class="card"><h2>${icon('check-circle')} 正確率 ${pct(r.total.pct)}</h2><p>${r.total.correct} / ${r.total.n} 題</p><ul>${sec}</ul>${counted}</section>
        <section class="card"><h2>${icon('chart-line')} 估計分數</h2>${est}</section>
        <section class="card"><h2>各題型</h2><ol class="weak-list">${types}</ol></section>
      </div>
      <h2 class="review-title">逐題對答案</h2><p class="meta">答錯的題目會進入複習，之後出現在每日練習。</p>
      <section class="exam" id="jlpt-result">${review}</section>`;
  }

  // 首頁：模擬考與畢業
  function mockHomeCard(s) {
    const g = J().graduation(s.level), grad = Progress.jlpt().graduated;
    const mocks = Progress.jlpt().mocks.filter(m => !m.abandoned && m.result);
    const thisWeek = mocks.some(m => J().weekKey(new Date(m.at)) === J().weekKey());
    const left = J().mockPoolLeft(s.level);
    const short = Object.keys(J().TYPES).some(t => J().TYPES[t].mini && (J().TYPES[t].full[s.level] || 0) && left[t] < J().TYPES[t].mini);
    const last = g.last.map(m => `<li><a href="#/jlpt/result/${m.at}">${new Date(m.at).toLocaleDateString('zh-TW')}</a>　${pct(m.result.total.pct)}</li>`).join('');
    const recent = mocks.slice(-5).reverse().map(m => `<li><a href="#/jlpt/result/${m.at}">${new Date(m.at).toLocaleDateString('zh-TW')}・${m.kind === 'full' ? '全真' : '小型'}</a>　${pct(m.result.total.pct)}${m.counted ? '' : '（不計入）'}</li>`).join('');
    return `<section class="card"><h2>${icon('check-circle')} 畢業進度</h2><p>目前練習：<b>${esc(s.level)}</b>　目標：<b>${esc(s.target)}</b></p>
        <p class="meta">連續 ${s.needed} 份計入的模擬考答對 ${pct(s.passPct)} 以上，而且各科都過最低分，就畢業。</p>
        ${grad[s.level] ? `<p><b>${esc(s.level)} 畢業了！</b>${J().bank(J().LEVELS[J().LEVELS.indexOf(s.level) - 1] || '').questions.length ? '' : `${esc(J().LEVELS[J().LEVELS.indexOf(s.level) - 1] || '')} 題庫準備中，先繼續練 ${esc(s.level)}。`}</p>` : ''}
        ${last ? `<p>最近計入的模擬考：</p><ol>${last}</ol>` : '<p class="meta">還沒有計入的模擬考紀錄。</p>'}</section>
      <section class="card"><h2>${icon('notebook')} 模擬考</h2><p>本週模擬考：${thisWeek ? '已完成' : '未完成'}</p>
        ${short ? '<p class="notice-line">模擬考新題用完了：要補新的一批模擬考題，之後的模擬考才會計入畢業。</p>' : ''}
        <p><a class="btn primary" href="#/jlpt/mock">${J().attempt() ? '繼續模擬考' : '開始模擬考'}</a></p>
        ${recent ? `<p class="meta">最近的成績：</p><ol class="mock-list">${recent}</ol>` : ''}</section>`;
  }

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
      ${mockHomeCard(s)}
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
    stopTimer();
    if (view === 'mock') return renderMock();
    el.innerHTML = view === 'daily' ? viewDaily() : view === 'settings' ? viewSettings() : view === 'result' ? viewResult(resultAt) : viewHome();
  }
  function examClick(e) {
    const start = e.target.closest('[data-jlpt-start]');
    if (start) { J().startAttempt(J().assembleMock({ kind: start.dataset.kind })); renderMock(); window.scrollTo?.(0, 0); return true; }
    if (!e.target.closest('.exam-bar, #jlpt-exam')) return false;
    const bub = e.target.closest('#jlpt-exam .q:not(.example) .bub');
    if (bub && !bub.disabled) {
      const box = bub.closest('.q'), v = +bub.dataset.v;
      if (J().setAnswer(box.dataset.qid, v)) box.querySelectorAll('.bub').forEach(x => x.classList.toggle('on', +x.dataset.v === v));
      return true;
    }
    if (e.target.closest('[data-jlpt-pause]')) { J().pauseAttempt(); renderMock(); return true; }
    if (e.target.closest('[data-jlpt-resume]')) { J().resumeTimer(); renderMock(); return true; }
    if (e.target.closest('[data-jlpt-submit-section]')) {
      if (!ask('交出這一科？交出後不能回來修改。')) return true;
      J().nextSection(); renderMock(); window.scrollTo?.(0, 0); return true;
    }
    if (e.target.closest('[data-jlpt-abandon]')) {
      if (!ask('結束這次模擬考？這次的成績不會計入畢業。')) return true;
      J().abandonAttempt(); notice = '已結束這次模擬考（不計入畢業）。'; renderMock(); return true;
    }
    return false;
  }
  const rerenderDaily = () => { const box = document.getElementById('jlpt-daily'); if (box) box.innerHTML = dailyBody(); };
  function currentDailyQuestion() { const d = daily(), map = byId(d.level); return [d, map.get(d.ids.filter(id => map.has(id))[d.i])]; }

  function bind() {
    if (bound) return; bound = true;
    document.addEventListener('click', e => {
      if (view === 'mock' && examClick(e)) return;
      const rr = e.target.closest('#jlpt-result [data-jlpt-report]');
      if (rr) {
        const id = rr.closest('.q')?.dataset.qid, m = findMock(resultAt), q = m && J().bank(m.level).questions.find(x => x.id === id);
        if (q) { J().report(q); render(); }
        return;
      }
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
    el = target; view = ['daily', 'settings', 'mock', 'result'].includes(seg[0]) ? seg[0] : 'home';
    resultAt = seg[1] || '';
    bind(); render();
  }

  // 「今日」頁的卡片
  function todayCard() {
    const s = J().settings();
    if (!J().bank(s.level).questions.length) return '';
    const d = daily(), days = J().daysLeft();
    return `<a class="play-card jlpt-today" href="#/jlpt/daily"><span class="glyph" aria-hidden="true" lang="ja">試</span><p class="eyebrow">JLPT・${days >= 0 ? `距離考試 ${days} 天` : '設定考試日期'}</p><b>每日 20 題</b><small>今天 ${dailyDone(d)} / ${d.ids.length} 題</small></a>`;
  }

  return { mount, todayCard, questionHtml, passageHtml };
})();
