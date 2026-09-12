// progress.js — 測驗進度（localStorage）
// 結構：{ items: { [id]: { seen, correct, wrong, streak, last } }, days: ['2026-09-11', ...], sessions: [{ at, score, total, mode }] }
window.Progress = (() => {
  const KEY = 'nihongo.progress';
  let state = null;

  function load() {
    if (state) return state;
    try { state = JSON.parse(localStorage.getItem(KEY)) || null; } catch { state = null; }
    if (!state || typeof state !== 'object') state = { items: {}, days: [], sessions: [] };
    state.items ||= {}; state.days ||= []; state.sessions ||= [];
    return state;
  }
  const listeners = new Set();
  function onChange(f) { listeners.add(f); return () => listeners.delete(f); }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(load())); } catch { /* 隱私模式等情況忽略 */ }
    listeners.forEach(f => { try { f(state); } catch {} });
  }
  const today = () => new Date().toISOString().slice(0, 10);

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
    return { items, days, sessions };
  }
  // 整份替換（同步下載後使用）。不觸發 onChange，避免下載後又立刻上傳。
  function replace(next) {
    state = { items: next.items || {}, days: next.days || [], sessions: next.sessions || [] };
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  }

  function stat(id) { return load().items[id] || { seen: 0, correct: 0, wrong: 0, streak: 0, last: null }; }

  function record(id, correct) {
    const s = load();
    const it = s.items[id] || { seen: 0, correct: 0, wrong: 0, streak: 0, last: null };
    it.seen++; it.last = Date.now();
    if (correct) { it.correct++; it.streak++; } else { it.wrong++; it.streak = 0; }
    s.items[id] = it;
    if (!s.days.includes(today())) s.days.push(today());
    save();
    return it;
  }

  function endSession(score, total, mode) {
    const s = load();
    s.sessions.push({ at: Date.now(), score, total, mode });
    if (s.sessions.length > 200) s.sessions.splice(0, s.sessions.length - 200);
    save();
  }

  // 連續學習天數（含今天或昨天）
  function streakDays() {
    const days = new Set(load().days);
    let n = 0; const d = new Date();
    if (!days.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
    while (days.has(d.toISOString().slice(0, 10))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  function reset() { state = { items: {}, days: [], sessions: [] }; save(); }

  return { load, save, stat, record, endSession, streakDays, reset, merge, replace, onChange };
})();
