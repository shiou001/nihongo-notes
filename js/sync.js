// sync.js — 跨裝置進度同步（Supabase RPC + 同步碼）
// 依賴：window.NIHONGO_SYNC（data/sync-config.js）、window.Progress
// 流程：
//   啟動 → 有同步碼就 pull（下載 → 合併 → 存本機 → 若本機有新東西再 push）
//   每次作答 / 結束測驗 → 2 秒後 push（debounce）
//   狀態顯示在 header 的 #sync-pill
window.Sync = (() => {
  const CODE_KEY = 'nihongo.synccode';
  const META_KEY = 'nihongo.syncmeta';
  const cfg = () => window.NIHONGO_SYNC || {};
  const enabled = () => !!(cfg().url && cfg().anonKey);

  // ── 同步碼 ────────────────────────────────────────────
  const WORDS = ['sakura', 'momiji', 'onigiri', 'daruma', 'torii', 'fuji', 'maneki', 'matcha', 'yuki', 'hoshi', 'kitsune', 'tanuki', 'koi', 'ume', 'sora', 'kaze'];
  const ALPHA = 'abcdefghjkmnpqrstuvwxyz23456789'; // 去掉容易混淆的 i l o 0 1
  function generateCode() {
    const rnd = new Uint8Array(12); crypto.getRandomValues(rnd);
    const chunk = i => [...rnd.slice(i, i + 4)].map(b => ALPHA[b % ALPHA.length]).join('');
    return `${WORDS[rnd[0] % WORDS.length]}-${chunk(0)}-${chunk(4)}-${chunk(8)}`;
  }
  const normalizeCode = s => String(s || '').trim().toLowerCase().replace(/\s+/g, '');
  const validCode = s => /^[a-z0-9-]{12,64}$/.test(s);
  function getCode() { try { return localStorage.getItem(CODE_KEY) || ''; } catch { return ''; } }
  function setCode(c) { try { c ? localStorage.setItem(CODE_KEY, c) : localStorage.removeItem(CODE_KEY); } catch {} }

  // ── 狀態 ──────────────────────────────────────────────
  let status = { state: enabled() ? (getCode() ? 'idle' : 'nocode') : 'off', at: null, error: '' };
  const listeners = new Set();
  function setStatus(patch) { status = { ...status, ...patch }; listeners.forEach(f => f(status)); renderPill(); }
  function onStatus(f) { listeners.add(f); return () => listeners.delete(f); }
  function getMeta() { try { return JSON.parse(localStorage.getItem(META_KEY)) || {}; } catch { return {}; } }
  function setMeta(m) { try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch {} }

  // ── Supabase RPC ──────────────────────────────────────
  async function rpc(fn, body) {
    const { url, anonKey } = cfg();
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let msg = `${res.status}`;
      try { const j = await res.json(); msg += ' ' + (j.message || j.hint || JSON.stringify(j)); } catch {}
      throw new Error(msg);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  // ── 上傳 / 下載 ───────────────────────────────────────
  let pushTimer = null, inflight = null;

  async function pull() {
    const code = getCode();
    if (!enabled() || !code) return null;
    setStatus({ state: 'syncing', error: '' });
    try {
      const remote = await rpc('progress_get', { p_code: code });
      const local = Progress.load();
      const merged = Progress.merge(local, remote || { items: {}, days: [], sessions: [] });
      Progress.replace(merged);
      // 本機有遠端沒有的內容 → 推回去
      if (!remote || JSON.stringify(remote) !== JSON.stringify(merged)) await rpc('progress_put', { p_code: code, p_data: merged });
      setMeta({ lastSync: Date.now() });
      setStatus({ state: 'ok', at: Date.now() });
      return merged;
    } catch (e) {
      setStatus({ state: 'error', error: e.message });
      return null;
    }
  }

  async function push() {
    const code = getCode();
    if (!enabled() || !code) return;
    if (inflight) return inflight;
    setStatus({ state: 'syncing', error: '' });
    inflight = (async () => {
      try {
        await rpc('progress_put', { p_code: code, p_data: Progress.load() });
        setMeta({ lastSync: Date.now() });
        setStatus({ state: 'ok', at: Date.now() });
      } catch (e) {
        setStatus({ state: 'error', error: e.message });
      } finally { inflight = null; }
    })();
    return inflight;
  }
  function schedulePush() {
    if (!enabled() || !getCode()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, 2000);
  }

  // ── 連結 / 產生 / 斷開 ────────────────────────────────
  async function link(codeInput) {
    const code = normalizeCode(codeInput);
    if (!validCode(code)) throw new Error('同步碼格式不對，請確認有貼完整（例如 sakura-ab3d-k9m2-x4bd）');
    setCode(code);
    setStatus({ state: 'idle' });
    const r = await pull();
    if (status.state === 'error') { throw new Error(status.error); }
    return r;
  }
  async function createNew() {
    const code = generateCode();
    setCode(code);
    setStatus({ state: 'idle' });
    await push();
    return code;
  }
  function unlink() { setCode(''); setMeta({}); clearTimeout(pushTimer); setStatus({ state: enabled() ? 'nocode' : 'off', at: null, error: '' }); }

  // ── header 小標籤 ─────────────────────────────────────
  function renderPill() {
    const el = document.getElementById('sync-pill');
    if (!el) return;
    if (status.state === 'off') { el.hidden = false; el.innerHTML = '<span class="ph-icon" data-icon="cloud" aria-hidden="true"></span>同步未設定' ; return; }
    el.hidden = false;
    const t = status.at ? new Date(status.at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : '';
    const map = {
      nocode: ['未連結同步', 'nocode'],
      idle: [' 待同步', 'idle'],
      syncing: [' 同步中…', 'syncing'],
      ok: [` 已同步 ${t}`, 'ok'],
      error: [' 同步失敗', 'error'],
    };
    const [label, cls] = map[status.state] || map.idle;
    el.innerHTML = '<span class="ph-icon" data-icon="cloud" aria-hidden="true"></span>' + label; el.className = `sync-pill ${cls}${el.classList.contains('active') ? ' active' : ''}`; el.title = status.error || '點一下管理跨裝置同步';
  }

  function init() {
    renderPill();
    Progress.onChange(schedulePush);
    if (enabled() && getCode()) pull();
    window.addEventListener('online', () => { if (getCode()) push(); });
  }

  return { enabled, getCode, getStatus: () => status, onStatus, pull, push, link, createNew, unlink, init, generateCode, normalizeCode, validCode };
})();
