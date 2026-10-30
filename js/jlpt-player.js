// jlpt-player.js — 聽解錄音依序播放
// play(files, opts) 一句一句播，句間停 gapMs，最後留 tailMs 作答時間後呼叫 onEnd
//   onIndex(i)：開始播第 i 句　onBlocked(i)：瀏覽器擋自動播放（手機常見），等使用者點一下再 resume()
//   檔案讀不到就跳過那一句，不讓考試卡住
window.JLPTPlayer = (() => {
  function play(files, { gapMs = 700, tailMs = 0, onIndex, onEnd, onBlocked, Audio = window.Audio, setTimeout = window.setTimeout } = {}) {
    let i = 0, audio = null, stopped = false, blockedAt = null;
    const next = () => {
      if (stopped) return;
      if (i + 1 < files.length) { i++; setTimeout(start, gapMs); }
      else setTimeout(() => { if (!stopped) onEnd?.(); }, tailMs);
    };
    function start() {
      if (stopped) return;
      blockedAt = null;
      onIndex?.(i);
      audio = new Audio(files[i]);
      audio.onended = next;
      audio.onerror = next;
      const p = audio.play();
      // 只有「瀏覽器不允許自動播放」算被擋；檔案錯誤交給 onerror 跳過
      const at = i;
      if (p && typeof p.catch === 'function') p.catch(e => { if (!stopped && e?.name === 'NotAllowedError') { blockedAt = at; onBlocked?.(at); } });
    }
    if (!files.length) setTimeout(() => onEnd?.(), tailMs); else start();
    return {
      stop() { stopped = true; audio?.pause(); },
      resume() { if (blockedAt !== null && !stopped) start(); },
      get index() { return i; },
    };
  }
  return { play };
})();
