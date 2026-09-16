// Narrow, versioned corrections applied after parsing, before extraction.
// Raw Notion caches stay untouched; scheduled sync cannot reintroduce these errors.
const sources = {
  particle: 'https://www.coelang.tufs.ac.jp/mt/ja/gmod/courses/c02/lesson27/step2/explanation/053.html',
  sound: 'https://dictionary.goo.ne.jp/word/%E3%82%92/',
};
function correctText(value) {
  return String(value)
    .replaceAll('主题標記', '主題標記')
    .replace(/學生(?=(?:\*\*)?(?:では|じゃ|です))/g, '学生')
    .replace('只作受詞助詞（公式）', '標記動作對象，也可標記移動的起點或路徑')
    .replace('看到「を」→ 前面一定是受詞，後面一定是動詞。', 'を 常標記動作對象，例如「りんごを食べる」。也能標記路徑「橋を渡る」或起點「家を出る」；不能一律當成受詞，動詞也不必緊接在 を 後面。')
    .replace('清音加上「゛」濁點，變成有聲音。', 'か、さ、た、は行加上「゛」形成濁音；並非所有清音都能加濁點，也不是所有清音都沒有聲帶振動。')
    .replace('子音 + 小寫的ゃ、ゅ、ょ，組合成新的音。', 'き、し、ち、に、ひ、み、り及相應濁音／半濁音假名，加小寫ゃ、ゅ、ょ，合成一拍；例如 きゃ 一拍，きや 兩拍。')
    .replace('「ん」是唯一沒有母音的子音，獲得一拍的時間。', '撥音「ん」本身占一拍，發音會受後面的音影響。練習時保留這一拍，不要額外加上母音。');
}
export function applyEditorial(pages) {
  return pages.map(page => ({ ...page, sections: page.sections.map(section => {
    const next = { ...section, blocks: section.blocks.map(b => {
      if (b.type === 'table') return { ...b, rows: b.rows.map(row => row.map((v, i) => {
        if (section.heading.includes('助詞 を vs お') && row[0] === 'を' && i === 1) return 'o（輸入法打 wo）';
        return correctText(v);
      })) };
      if (b.items) return { ...b, items: b.items.map(correctText) };
      return { ...b, text: correctText(b.text || '') };
    }) };
    if (section.heading.includes('助詞 を vs お')) {
      next.blocks.push({ type: 'para', text: `現代標準語的助詞 を 通常讀 /o/，與 お 同音。wo 可用於鍵盤輸入或區分字形的轉寫，不代表標準發音。參考：[東京外國語大學・格助詞](${sources.particle})、[を 的辭典說明](${sources.sound})。` });
      next.blocks.push({ type: 'table', headers: ['例句', '中文', '用法'], rows: [
        ['りんごを食べます。', '吃蘋果。', '動作對象'],
        ['橋を渡ります。', '過橋。', '移動路徑'],
        ['家を出ます。', '離開家。', '離開起點'],
      ] });
      next.blocks.push({ type: 'quote', text: '常見誤判：不能因為「橋を渡る」有 を，就把 渡る 判為他動詞。先判斷整句表達的是動作對象、路徑還是起點。' });
      next.blocks.push({ type: 'table', headers: ['助詞', '用途', '例句'], rows: [['を', '標記動作對象、移動起點或路徑', '橋を渡ります。']] });
      next.editorial = '2026-09-16：補充 を 的適用範圍、發音與反例。';
    }
    return next;
  }) }));
}
