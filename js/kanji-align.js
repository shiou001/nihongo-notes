// kanji-align.js — 把單字的讀音對齊到每個漢字，找出「這個字在這個詞裡怎麼唸」
//
// 例：学生／がくせい → 学=がく、生=せい；一本／いっぽん → 一=いっ、本=ぽん；人々／ひとびと → 人=ひと、々=びと
// 會處理的音變：連濁（た→だ）、半濁音（ほ→ぽ）、促音（いち→いっ）、送假名寫法較短（終る／おわる）
// 對不齊的詞（像 今日／きょう 這種特殊讀法）就不出題，改列在漢字卡片的「特殊讀法」。
//
// 載入順序：data/content.js → data/external.js → js/data-merge.js → data/kanji.js → 本檔
// 本檔會在 NIHONGO_DATA 上加：kanji（漢字表）、kanjiWords（詞裡的讀音題）、kanjiUses、kanjiSpecial
(() => {
  const W = typeof window !== 'undefined' ? window : globalThis;

  const toHira = s => String(s).replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
  const toKata = s => String(s).replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
  const isKanji = c => /[㐀-鿿豈-﫿々]/.test(c);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hash = str => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); };

  const VOICED = { か: 'が', き: 'ぎ', く: 'ぐ', け: 'げ', こ: 'ご', さ: 'ざ', し: 'じ', す: 'ず', せ: 'ぜ', そ: 'ぞ', た: 'だ', ち: 'ぢ', つ: 'づ', て: 'で', と: 'ど', は: 'ば', ひ: 'び', ふ: 'ぶ', へ: 'べ', ほ: 'ぼ' };
  const SEMI = { は: 'ぱ', ひ: 'ぴ', ふ: 'ぷ', へ: 'ぺ', ほ: 'ぽ' };

  // 一個讀音可能出現的樣子
  function variants(r) {
    const out = new Set([r]);
    if (VOICED[r[0]]) out.add(VOICED[r[0]] + r.slice(1));
    if (SEMI[r[0]]) out.add(SEMI[r[0]] + r.slice(1));
    for (const x of [...out]) if (x.length >= 2 && /[つくちき]$/.test(x)) out.add(x.slice(0, -1) + 'っ');
    return [...out];
  }

  // 這個字所有可能的唸法：音讀、訓讀詞幹、詞幹加上送假名的前幾個字
  // （處理 終る／おわる，以及 入口／いりぐち 這種名詞形），長的先試
  function candidates(entry) {
    const base = [...(entry.on || [])];
    for (const [stem, okuri] of entry.kun || []) {
      base.push(stem);
      if (okuri) for (let n = 1; n <= okuri.length; n++) base.push(stem + okuri.slice(0, n));
    }
    return [...new Set(base.map(toHira).flatMap(variants))].sort((a, b) => b.length - a.length);
  }

  // 送假名寫得比字典長（汚ない／きたない）：詞幹的前半段也可能是這個字的唸法。
  // 只在後面緊接假名時才用，避免把複合詞切錯。
  function stemPrefixes(entry) {
    const out = new Set();
    for (const [stem, okuri] of entry.kun || []) if (okuri) for (let n = 1; n < stem.length; n++) out.add(toHira(stem.slice(0, n)));
    return [...out];
  }

  // 清理：有多種寫法（用 ; 或 / 分隔）取第一個，單字和讀音都拿掉括號、～、空白；
  //       讀音比單字多出來的「する」也拿掉
  function clean(word, reading) {
    const first = s => String(s ?? '').split(/\s*[;／/]\s*/)[0];
    const strip = s => s.replace(/\(.*?\)|（.*?）/g, '').replace(/[～〜\s]/g, '');
    const w = strip(first(word));
    let r = strip(toHira(first(reading)));
    if (r.endsWith('する') && !w.endsWith('する')) r = r.slice(0, -2);
    return { w, r };
  }

  // 回傳 [{ ch, reading, kanji }]；對不齊回傳 null
  function align(word, reading, lookup) {
    const { w, r } = clean(word, reading);
    const chars = [...w];
    if (!r || !chars.some(isKanji)) return null;
    const cands = chars.map((c, i) => {
      if (!isKanji(c)) return null;
      const e = lookup(c === '々' ? chars[i - 1] : c);
      if (!e) return null;
      const base = candidates(e);
      const next = chars[i + 1];
      return next && !isKanji(next) ? [...base, ...stemPrefixes(e).filter(x => !base.includes(x))] : base;
    });
    if (chars.some((c, i) => isKanji(c) && !cands[i])) return null;
    const res = [];
    const go = (i, j) => {
      if (i === chars.length) return j === r.length;
      const c = chars[i];
      const opts = isKanji(c) ? cands[i] : [toHira(c)];
      for (const cand of opts) {
        if (!r.startsWith(cand, j)) continue;
        res.push({ ch: c, reading: cand, kanji: isKanji(c) });
        if (go(i + 1, j + cand.length)) return true;
        res.pop();
      }
      return false;
    };
    return go(0, 0) ? res : null;
  }

  const push = (map, key, val) => { if (!map.has(key)) map.set(key, []); map.get(key).push(val); };

  function prepare(D, K) {
    if (!D || !K || !Array.isArray(K.kanji)) return;
    // extra：不在 tanos JLPT 漢字表、但屬於常用漢字的字（例如「分」）。
    //        用來讓讀音對齊得起來；出現在你單字裡的才會顯示在漢字頁的「其他」分頁
    const all = [...K.kanji, ...(K.extra || [])];
    const byChar = new Map(all.map(k => [k.k, k]));
    const lookup = c => byChar.get(c);
    const words = [], uses = new Map(), special = new Map(), seen = new Set();
    for (const v of D.vocab || []) {
      const parts = align(v.word, v.reading, lookup);
      if (!parts) {
        const chars = new Set([...clean(v.word, v.reading).w].filter(c => isKanji(c) && c !== '々' && byChar.has(c)));
        for (const c of chars) push(special, c, v);
        continue;
      }
      parts.forEach((p, idx) => {
        if (!p.kanji || p.ch === '々') return;
        const e = byChar.get(p.ch);
        const key = `${p.ch}|${v.word}|${v.reading}|${idx}`;
        if (seen.has(key)) return;
        seen.add(key);
        const item = {
          id: 'kw_' + hash(key), ch: p.ch, idx, seg: p.reading, parts,
          word: v.word, reading: v.reading, meaning: v.meaning,
          level: e.level, wordLevel: v.level, origin: v.origin || 'notion',
        };
        words.push(item);
        push(uses, p.ch, item);
      });
    }
    // 訓讀排序：你單字裡剛好有這個詞的排最前（入る／はいる → はい(る)），
    //           其次是在詞裡出現過的詞幹，其餘照字典順序
    const vocabKeys = new Set((D.vocab || []).map(v => { const { w, r } = clean(v.word, v.reading); return w + '|' + r; }));
    for (const k of all) {
      const used = new Set((uses.get(k.k) || []).map(u => u.seg));
      const score = ([s, o = '']) => (vocabKeys.has(k.k + o + '|' + toHira(s + o)) ? 2 : used.has(toHira(s)) ? 1 : 0);
      k.kunTop = [...(k.kun || [])].sort((a, b) => score(b) - score(a));
    }
    D.kanji = [...K.kanji, ...(K.extra || []).filter(k => uses.has(k.k) || special.has(k.k))];
    D.kanjiWords = words;
    D.kanjiUses = uses;
    D.kanjiSpecial = special;
  }

  // 顯示用：詞裡目標漢字標紅
  const highlightHtml = w => w.parts.map((p, i) => i === w.idx ? `<b class="kw-target">${esc(p.ch)}</b>` : esc(p.ch)).join('');
  const readingHtml = w => w.parts.map((p, i) => i === w.idx ? `<b class="kw-target">${esc(p.reading)}</b>` : esc(p.reading)).join('');
  const kunHtml = ([stem, okuri]) => esc(stem) + (okuri ? `<span class="okuri">${esc(okuri)}</span>` : '');

  W.KanjiAlign = { toHira, toKata, isKanji, variants, candidates, clean, align, prepare, hash, highlightHtml, readingHtml, kunHtml };
  if (W.NIHONGO_DATA && W.NIHONGO_KANJI) prepare(W.NIHONGO_DATA, W.NIHONGO_KANJI);
})();
