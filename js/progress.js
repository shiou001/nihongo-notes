// progress.js — 測驗進度（localStorage）
// 結構：{ items: { [id]: { seen, correct, wrong, streak, last } }, days: ['2026-09-11', ...], sessions: [{ at, score, total, mode }],
//         jlpt: { settings, mocks: [...], reports: { [qid]: { at, rev } }, graduated: { [level]: at } } }
window.Progress = (() => {
  const KEY = 'nihongo.progress';
  let state = null;

  function load() {
    if (state) return state;
    try { state = JSON.parse(localStorage.getItem(KEY)) || null; } catch { state = null; }
    if (!state || typeof state !== 'object') state = { items: {}, days: [], sessions: [] };
    state.items ||= {}; state.days ||= []; state.sessions ||= [];
    state.jlpt = jlptDefaults(state.jlpt);
    return state;
  }
  // JLPT 專區的資料（模擬考紀錄、回報、設定、畢業）也放在這裡，跟著跨裝置同步
  function jlptDefaults(j) {
    j = j && typeof j === 'object' ? j : {};
    return { settings: j.settings || null, mocks: j.mocks || [], reports: j.reports || {}, graduated: j.graduated || {} };
  }
  const listeners = new Set();
  function onChange(f) { listeners.add(f); return () => listeners.delete(f); }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(load())); } catch { /* 隱私模式等情況忽略 */ }
    listeners.forEach(f => { try { f(state); } catch {} });
  }
  const dayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const today = () => dayKey();

  // 合併兩份進度（跨裝置同步用）。純函式，不動輸入。
  //   items：同一題以「看過次數多」的為準，一樣多就取「最後作答時間晚」的
  //   days：聯集
  //   sessions：以 at 去重後聯集，保留最近 200 筆
  function merge(a, b) {
    a = a || {}; b = b || {};
    const items = { ...(a.items || {}) };
    for (const [id, bi] of Object.entries(b.items || {})) {
      const ai = items[id];
      if (!ai) { items[id] = bi; continue; }
      const pick = bi.seen > ai.seen || (bi.seen === ai.seen && (bi.last || 0) > (ai.last || 0)) ? bi : ai;
      items[id] = pick;
    }
    const days = [...new Set([...(a.days || []), ...(b.days || [])])].sort();
    const byAt = new Map();
    for (const s of [...(a.sessions || []), ...(b.sessions || [])]) if (s && s.at) byAt.set(s.at, s);
    const sessions = [...byAt.values()].sort((x, y) => x.at - y.at).slice(-200);
    return { items, days, sessions, jlpt: mergeJlpt(a.jlpt, b.jlpt) };
  }
  //   jlpt：模擬考以 at 聯集（不設上限）；設定取 updatedAt 新的；回報取較晚的；同級畢業取較早的
  //   兩邊一樣時以 JSON 字串比較決定，讓 merge(a, b) 和 merge(b, a) 結果相同
  const later = (x, y, key) => (x[key] || 0) !== (y[key] || 0) ? ((x[key] || 0) > (y[key] || 0) ? x : y) : (JSON.stringify(x) >= JSON.stringify(y) ? x : y);
  function mergeJlpt(ja, jb) {
    ja = jlptDefaults(ja); jb = jlptDefaults(jb);
    const settings = ja.settings && jb.settings ? later(ja.settings, jb.settings, 'updatedAt') : ja.settings || jb.settings;
    const byAt = new Map();
    for (const m of [...ja.mocks, ...jb.mocks]) if (m && m.at) byAt.set(m.at, byAt.has(m.at) ? later(byAt.get(m.at), m, 'at') : m);
    const reports = { ...ja.reports };
    for (const [id, r] of Object.entries(jb.reports)) reports[id] = reports[id] ? later(reports[id], r, 'at') : r;
    const graduated = { ...ja.graduated };
    for (const [lv, at] of Object.entries(jb.graduated)) graduated[lv] = graduated[lv] ? Math.min(graduated[lv], at) : at;
    return { settings, mocks: [...byAt.values()].sort((x, y) => x.at - y.at), reports, graduated };
  }
  // 整份替換（同步下載後使用）。不觸發 onChange，避免下載後又立刻上傳。
  function replace(next) {
    state = { items: next.items || {}, days: next.days || [], sessions: next.sessions || [], jlpt: jlptDefaults(next.jlpt) };
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  }

  function stat(id) { return load().items[id] || { seen: 0, correct: 0, wrong: 0, streak: 0, last: null }; }

  function record(id, correct, { assisted = false, now = Date.now() } = {}) {
    const s = load();
    const it = s.items[id] || { seen: 0, correct: 0, wrong: 0, streak: 0, last: null };
    if (!it.seen) it.firstSeen = now;
    it.seen++; it.last = now;
    it.scheduleVersion = 2;
    it.retained ||= 0;
    it.assisted ||= 0;
    if (correct) it.correct++; else it.wrong++;
    if (correct && !assisted) {
      it.streak++;
      // A repeat only qualifies after both the due date and at least 24 hours.
      if ((!it.lastQualified || now - it.lastQualified >= 864e5) && (!it.due || now >= it.due)) {
        it.retained++;
        it.lastQualified = now;
        it.due = now + [1, 3, 7, 14, 30][Math.min(it.retained - 1, 4)] * 864e5;
      }
    } else {
      if (assisted) it.assisted++;
      it.streak = 0; it.retained = 0; it.due = now + 10 * 60e3;
    }
    s.items[id] = it;
    const day = dayKey(new Date(now));
    if (!s.days.includes(day)) s.days.push(day);
    save();
    return it;
  }

  function endSession(score, total, mode, detail = {}) {
    const s = load();
    s.sessions.push({ at: Date.now(), score, total, mode, ...detail });
    if (s.sessions.length > 200) s.sessions.splice(0, s.sessions.length - 200);
    save();
  }

  // 連續學習天數（含今天或昨天）
  function streakDays() {
    const days = new Set(load().days);
    let n = 0; const d = new Date();
    if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
    while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  function reset() { state = { items: {}, days: [], sessions: [], jlpt: jlptDefaults() }; save(); }

  const jlpt = () => load().jlpt;
  function saveJlpt(fn) { fn(jlpt()); save(); }

  return { load, save, stat, record, endSession, streakDays, reset, merge, replace, onChange, dayKey, jlpt, saveJlpt };
})();
