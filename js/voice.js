// voice.js — 日文語音：自動挑最自然的聲音，也可以自己換聲音和語氣
//
// 瀏覽器朗讀用的聲音來自作業系統或瀏覽器本身，每台裝置都不一樣：
//   Edge          Microsoft Nanami Online (Natural)：最像真人、也最可愛（需要網路）
//   Chrome        Google 日本語（需要網路）
//   iPhone／Mac   Kyoko、O-ren：到系統設定下載「加強版」會自然很多
//   Windows 內建  Haruka、Ayumi、Ichiro（Desktop）：最像機器人
// 設定只存在這台裝置（localStorage），不跨裝置同步，因為每台裝置能用的聲音不一樣。
//
// 錄音：data/audio.js 列出已經用 VOICEVOX（東北きりたん）做好的錄音（tools/make-audio.mjs 產生）。
// 有錄音的文字就播錄音檔，所有裝置聽到的都一樣；沒有錄音（單一漢字、Notion 新加的字）才用裝置朗讀。
(() => {
  const W = typeof window !== 'undefined' ? window : globalThis;
  const KEY = 'nihongo.voice';

  const PRESETS = {
    cute:    { label: '可愛',   rate: 0.95, pitch: 1.25 },
    natural: { label: '自然',   rate: 1.0,  pitch: 1.0 },
    slow:    { label: '慢慢說', rate: 0.75, pitch: 1.1 },
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
    return { name: typeof s.name === 'string' ? s.name : '', preset: PRESETS[s.preset] ? s.preset : 'cute', source: s.source === 'device' ? 'device' : 'recorded' };
  }
  function set(patch) { try { W.localStorage.setItem(KEY, JSON.stringify({ ...settings(), ...patch })); } catch { /* 無痕模式等情況忽略 */ } }

  // 用你選的聲音；沒選過、或選的聲音這台裝置沒有（例如離線時線上聲音消失），就用最自然的那個
  function current() {
    const vs = voices();
    const { name } = settings();
    return vs.find(v => v.name === name) || vs[0] || null;
  }

  // ── 錄音檔 ──
  // 跟 tools/make-audio.mjs 的 audioKey 一樣：同一段文字算出同一個檔名
  const audioKey = t => {
    const s = String(t ?? '').normalize('NFKC').trim();
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(36);
  };
  function library() {
    const A = W.NIHONGO_AUDIO;
    if (!A || !A.keys) return null;
    A._set ||= new Set(A.keys.split(','));
    return A;
  }
  const hasRecording = text => !!library()?._set.has(audioKey(text));
  const useRecordings = () => !!library() && settings().source !== 'device';
  let playing = null;
  function stop() {
    if (playing) { playing.pause(); playing = null; }
    if (supported()) W.speechSynthesis.cancel();
  }
  // 回傳的物件跟 SpeechSynthesisUtterance 一樣可以設 onend，對話「播放整段」靠它一句接一句
  function playRecording(text, p) {
    const A = library(), a = new W.Audio(`${A.dir}${audioKey(text)}.mp3`);
    a.playbackRate = p.rate < 0.9 ? 0.8 : 1;
    a.preservesPitch = true;
    stop();
    playing = a;
    const handle = { recorded: true, text: String(text) };
    Object.defineProperty(handle, 'onend', { set: fn => { a.onended = fn; } });
    Object.defineProperty(handle, 'onerror', { set: fn => { a.onerror = fn; } });
    // 播不出來（例如離線、檔案還沒部署）就改用裝置朗讀
    a.play()?.catch?.(() => { if (playing === a) { playing = null; deviceSpeak(text, p); } });
    return handle;
  }

  function speak(text, override = {}) {
    if (!text) return null;
    const p = PRESETS[override.preset] || PRESETS[settings().preset];
    if (!override.voice && useRecordings() && hasRecording(text) && typeof W.Audio === 'function') return playRecording(text, p);
    return deviceSpeak(text, p, override.voice);
  }
  function deviceSpeak(text, p, voice) {
    if (!supported() || !text) return null;
    if (playing) { playing.pause(); playing = null; }
    const u = new W.SpeechSynthesisUtterance(String(text));
    u.lang = 'ja-JP';
    const v = voice || current();
    if (v) u.voice = v;
    u.rate = p.rate;
    u.pitch = p.pitch;
    W.speechSynthesis.cancel();
    W.speechSynthesis.speak(u);
    return u;
  }

  // 瀏覽器的聲音清單是非同步載入的，載好後通知畫面重畫
  const listeners = new Set();
  if (supported() && W.speechSynthesis.addEventListener) W.speechSynthesis.addEventListener('voiceschanged', () => listeners.forEach(f => f()));

  W.Voice = { PRESETS, score, rank, isRecommended, supported, voices, settings, set, current, speak, stop, audioKey, hasRecording, library, onVoicesChanged: f => listeners.add(f) };
})();
