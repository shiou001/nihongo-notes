// voice.js — 日文語音：自動挑最自然的聲音，也可以自己換聲音和語氣
//
// 瀏覽器朗讀用的聲音來自作業系統或瀏覽器本身，每台裝置都不一樣：
//   Edge          Microsoft Nanami Online (Natural)：最像真人、也最可愛（需要網路）
//   Chrome        Google 日本語（需要網路）
//   iPhone／Mac   Kyoko、O-ren：到系統設定下載「加強版」會自然很多
//   Windows 內建  Haruka、Ayumi、Ichiro（Desktop）：最像機器人
// 設定只存在這台裝置（localStorage），不跨裝置同步，因為每台裝置能用的聲音不一樣。
(() => {
  const W = typeof window !== 'undefined' ? window : globalThis;
  const KEY = 'nihongo.voice';

  const PRESETS = {
    cute:    { label: '🍡 可愛',   rate: 0.95, pitch: 1.25 },
    natural: { label: '🌸 自然',   rate: 1.0,  pitch: 1.0 },
    slow:    { label: '🐢 慢慢說', rate: 0.75, pitch: 1.1 },
  };

  // 分數越高越自然：神經網路語音 > Google／加強版 > 一般 > Windows 舊聲音；女聲略優先（比較符合「可愛」）
  const MALE = /Keita|Daichi|Naoki|Otoya|Ichiro|Hattori/i;
  function score(v) {
    const n = v?.name || '';
    let s = 0;
    if (/Natural|Neural/i.test(n)) s += 60;
    else if (/Online/i.test(n)) s += 40;
    if (/Google/i.test(n)) s += 35;
    if (/Premium|Enhanced|拡張|高品質/i.test(n)) s += 30;
    if (/Nanami/i.test(n)) s += 15;
    if (/Aoi|Mayu|Shiori|Kyoko|O-ren/i.test(n)) s += 8;
    if (/Desktop|Haruka|Ayumi|Sayaka|Ichiro/i.test(n)) s -= 15;
    if (MALE.test(n)) s -= 10;
    return s;
  }
  const isJa = v => /^ja([-_]|$)/i.test(v?.lang || '') || /Japanese|日本語/i.test(v?.name || '');
  const rank = list => (list || []).filter(isJa)
    .map(v => ({ v, s: score(v) }))
    .sort((a, b) => b.s - a.s || String(a.v.name).localeCompare(String(b.v.name)))
    .map(x => x.v);
  const isRecommended = v => score(v) >= 30;

  const supported = () => 'speechSynthesis' in W && typeof W.SpeechSynthesisUtterance === 'function';
  const voices = () => (supported() ? rank(W.speechSynthesis.getVoices()) : []);

  function load() { try { return JSON.parse(W.localStorage.getItem(KEY)) || {}; } catch { return {}; } }
  function settings() {
    const s = load();
    return { name: typeof s.name === 'string' ? s.name : '', preset: PRESETS[s.preset] ? s.preset : 'cute' };
  }
  function set(patch) { try { W.localStorage.setItem(KEY, JSON.stringify({ ...settings(), ...patch })); } catch { /* 無痕模式等情況忽略 */ } }

  // 用你選的聲音；沒選過、或選的聲音這台裝置沒有（例如離線時線上聲音消失），就用最自然的那個
  function current() {
    const vs = voices();
    const { name } = settings();
    return vs.find(v => v.name === name) || vs[0] || null;
  }

  function speak(text, override = {}) {
    if (!supported() || !text) return null;
    const u = new W.SpeechSynthesisUtterance(String(text));
    u.lang = 'ja-JP';
    const v = override.voice || current();
    if (v) u.voice = v;
    const p = PRESETS[override.preset] || PRESETS[settings().preset];
    u.rate = p.rate;
    u.pitch = p.pitch;
    W.speechSynthesis.cancel();
    W.speechSynthesis.speak(u);
    return u;
  }

  // 瀏覽器的聲音清單是非同步載入的，載好後通知畫面重畫
  const listeners = new Set();
  if (supported() && W.speechSynthesis.addEventListener) W.speechSynthesis.addEventListener('voiceschanged', () => listeners.forEach(f => f()));

  W.Voice = { PRESETS, score, rank, isRecommended, supported, voices, settings, set, current, speak, onVoicesChanged: f => listeners.add(f) };
})();
