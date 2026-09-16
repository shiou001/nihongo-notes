// Device-local study preferences; cloud progress retains its existing schema.
window.Study = (() => {
  const KEY = 'nihongo.study';
  const levels = ['N5', 'N4', 'N3', 'N2', 'N1'];
  function profile() {
    let p; try { p = JSON.parse(localStorage.getItem(KEY)); } catch {}
    return { level: levels.includes(p?.level) ? p.level : 'N5', goal: ['日常會話', '考試複習'].includes(p?.goal) ? p.goal : '日常會話', weekly: [15, 30, 50].includes(p?.weekly) ? p.weekly : 30, configured: !!p?.configured };
  }
  function set(p) {
    const next = { level: levels.includes(p.level) ? p.level : 'N5', goal: ['日常會話', '考試複習'].includes(p.goal) ? p.goal : '日常會話', weekly: [15, 30, 50].includes(+p.weekly) ? +p.weekly : 30, configured: true };
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
    return next;
  }
  function estimate(total, mastered, weekly = profile().weekly) {
    const target = Math.ceil(total * .8), remaining = Math.max(0, target - mastered);
    return { target, remaining, weeks: Math.ceil(remaining / weekly) };
  }
  function dailyOptions(now = Date.now()) {
    const p = profile();
    return { types: ['vocab_meaning', 'vocab_reading', 'vocab_recall'], levels: [p.level], count: 10, daily: true, newLimit: Math.ceil(p.weekly / 7), weeklyLimit: p.weekly, now };
  }
  return { profile, set, estimate, dailyOptions };
})();
