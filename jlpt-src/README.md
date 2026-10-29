# jlpt-src — JLPT 考試專區的題目原稿

這裡是題目的原稿（不會部署）。`node tools/build-jlpt.mjs` 會檢查、建置成 `data/jlpt.js`。

## 流程（每一批）

1. 在 `jlpt-src/<級數>/` 新增一個批次檔，例如 `n5/a-vocab.json`，`reviewed` 先填 `null`。
2. `node tools/build-jlpt.mjs`：修到沒有錯誤（未審查批次的錯誤會以「警告」顯示）。
3. **獨立審查**：交給沒參與出題的審查者，用 `jlpt-src/REVIEW.md` 逐題檢查；修正後被改過的題目 `rev` 加 1，再審到全部 OK。
4. 把 `reviewed` 改成 `{ "by": "independent-agent", "at": "YYYY-MM-DD" }`，重新建置。只有已審查的批次會進網站。
5. 聽解題：再跑 `node tools/make-jlpt-audio.mjs` 產生錄音（缺錄音的聽解題不會輸出）。

## 批次格式

```json
{
  "reviewed": null,
  "passages": { "p-n5-b-01": { "stem": "…" } },
  "questions": [
    { "id": "n5-kr-0001", "type": "kanji_reading", "pool": "practice",
      "stem": "あしたは　[[雨]]ですか。", "gen": { "word": "雨", "reading": "あめ" },
      "explain": "「雨」讀作「あめ」。", "refs": { "vocab": ["雨"] } }
  ]
}
```

- `id`：固定不變（進度靠它）；`type`：見 `js/jlpt-core.js` 的 `JLPT.TYPES`。
- `pool`：`practice`（每日練習）或 `mock`（模擬考專用，每日練習不會出）。
- `example: true`：該題型的（れい），只出現在大題開頭，不計分。
- `rev`：預設 1；題目修正後加 1（被回報的題目會因此恢復出題）。
- `gen`：漢字讀音、表記可以不寫 `choices`／`answer`，由程式產生干擾選項（清濁、長短音、促音、形近字）。
- 聽解題：`script` 是 `[角色, 台詞]` 的陣列，角色 `N` 旁白（No.7）、`M` 男（剣崎雌雄）、`F` 女（東北きりたん）；`figure` 是插圖描述。

## 題目標記

| 寫法 | 意思 |
|---|---|
| `{漢字|かんじ}` | 振假名（文法・讀解科每個漢字都要；文字・語彙科不能有） |
| `[[…]]` | 底線（被考的部分） |
| `{{_}}`、`{{★}}` | 排序題的空格、★ 空格 |
| `{{#22}}` | 文章裡的方框號碼 |
| 全形空白 | 詞語之間的空格（分かち書き） |

## 不能做的事

- 不收錄、不改寫官方考古題或市售題本的題目。
- 題目沒有經過獨立審查，不能把 `reviewed` 填上。
