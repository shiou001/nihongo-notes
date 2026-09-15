# にほんごノート — 日文學習專區網站 設計文件（雛形版）

日期：2026-09-11
狀態：雛形（Prototype）— 之後依使用者回饋擴充

## 1. 目標

把使用者在 Notion 的「🇯🇵 日文學習筆記」變成一個可以：

1. 瀏覽筆記內容（照 Notion 原本的分頁與表格）
2. 進行複習測驗（單字、文法句型、會話、五十音）
3. 看到 N5 → N1 的學習規劃與進度
4. 定期從 Notion 同步最新內容（使用者自己維護 Notion，網站只讀）

視覺風格：手繪塗鴉風 + 日本可愛元素（達摩、櫻花、飯糰、鳥居、富士山、招財貓）。

## 2. Notion 來源結構（已確認）

根頁面 `36dd7785-7287-819e-a17a-d9a1045dbdc3`，子頁面 8 個：

| 頁面 | 表格欄位型態 | 網站用途 |
|---|---|---|
| 📝 五十音圖表 | 羅馬拼音 / 平假名 / 片假名 | 五十音表 + 假名測驗 |
| 🔤 發音與假名 | 用途/說明、中文/日文/羅馬拼音 | 筆記瀏覽 |
| 💬 常用會話 | 日語 / 羅馬字 / 中文（或使用場合） | 會話測驗 |
| 📝 文法筆記 | 句型 / 意思 / 例句、原形 / 〜形 / 意思 | 文法測驗 |
| 📦 詞彙整理 | 單字 / 讀音 / 意思 | 單字測驗（等級＝「筆記」） |
| 📚 閱讀練習 | 原文 + 單字表 + 句型表 | 筆記瀏覽 + 單字測驗 |
| 🎯 單字分級 N1~N5 | 單字 / 讀音 / 意思（N2 多重音、例句） | 分級單字測驗、學習地圖 |
| 🎌 敬語表現 | 項目 / 說明 | 筆記瀏覽 + 會話測驗 |

所有頁面都是「## 標題 → 表格」的規律結構，因此可以用「表頭欄位名稱」自動判斷資料型態。

## 3. 架構

```
nihongo-notes/
├── index.html            單頁應用（無建置步驟，直接開啟即可）
├── css/style.css         手繪風樣式
├── js/
│   ├── app.js            路由 + 各視圖（首頁、學習地圖、筆記、測驗、五十音）
│   ├── quiz.js           出題引擎 + 熟練度判定（🖊️ 使用者可調整）
│   ├── progress.js       localStorage 進度儲存
│   └── doodles.js        手繪 SVG 元素（達摩、櫻花…）
├── data/
│   ├── content.js        ← 由同步腳本產生（window.NIHONGO_DATA）
│   └── plan.js           N5→N1 學習規劃（🖊️ 使用者可調整）
├── sync/
│   ├── sync-notion.mjs   Notion API → Markdown 快取 → content.js
│   ├── parse-notion-md.mjs  Markdown → 結構化 JSON（純函式，可離線測試）
│   ├── build-data.mjs    只用快取重建 content.js（離線）
│   └── cache/*.md        每個 Notion 頁面的 Markdown 快取
├── .github/workflows/sync.yml   每天自動同步（GitHub Actions）
└── README.md
```

選擇「純靜態 + 資料檔」而不是後端：
- 可以直接雙擊 `index.html` 使用，也可以丟 GitHub Pages / Netlify。
- 資料以 `content.js`（`window.NIHONGO_DATA = {...}`）注入，避免 `file://` 下 `fetch()` 被擋。
- Notion token 只存在同步端（本機或 GitHub Secrets），不會出現在網頁。

## 4. 資料模型（content.js）

```js
{
  syncedAt: "2026-09-11T...",
  pages: [{ id, title, icon, sections: [{ heading, level, blocks: [
      { type: "table", headers: [], rows: [[]] },
      { type: "quote" | "para" | "list", text | items }
  ]}]}],
  vocab:   [{ id, word, reading, meaning, level: "N5".."N1" | "筆記", pos, source, pitch?, example? }],
  grammar: [{ id, pattern, meaning, example, source }],
  phrases: [{ id, jp, romaji, zh, category, source }],
  kana:    [{ id, romaji, hira, kata, group, row }]
}
```

表頭 → 型態的判斷規則（parse-notion-md.mjs）：
- 含「單字」「讀音」「意思」→ vocab；等級取最近的 `##` 標題中的 N1~N5，沒有就是「筆記」
- 含「句型」「意思」，或「原形」+「〜形」→ grammar
- 含「日語」+（「中文」或「使用場合」）→ phrases
- 含「羅馬拼音」「平假名」「片假名」→ kana
- 敬語頁的「項目 / 說明」表 → phrases（category = 敬語）
- 「🧭 快速導航」「📑 本頁索引」段落略過

## 5. 測驗設計

題型（四選一）：
1. 單字 → 意思
2. 讀音 → 單字
3. 意思 → 單字
4. 句型 → 意思
5. 會話（日語 → 中文）
6. 假名 → 羅馬拼音

設定：等級（N5~N1 / 筆記 / 全部）、題型、題數（10 / 20）、「弱點複習」模式。
干擾選項從同型態、同等級優先抽取，避免太容易。

進度（localStorage，key = `nihongo.progress`）：每題目 `{ seen, correct, wrong, streak, last }`。
熟練判定 `isMastered()` 放在 quiz.js 頂部，預設「連對 3 次」，標示為使用者可調整。

## 6. 學習地圖（N5 → N1）

`data/plan.js` 定義每級：目標描述、建議週數、每週建議（單字量、文法重點）、里程碑。
畫面用蜿蜒小路 + 鳥居節點，每級顯示 Notion 內該級單字數、已熟練數、進度條、「開始這級測驗」。

## 7. 同步流程

1. 使用者在 Notion 建立 Internal Integration，把根頁面 Share 給它。
2. `NOTION_TOKEN` + `NOTION_ROOT_PAGE_ID` 設為環境變數。
3. `node sync/sync-notion.mjs`：遞迴讀取 blocks → 轉成 Markdown 快取 → 解析 → 寫 `data/content.js`。
4. 排程：GitHub Actions 每天 03:00（台灣時間）跑一次並 commit；或 Windows 工作排程器跑本機腳本。

## 8. 錯誤處理

- 同步失敗（token 錯、頁面未分享）→ 印出清楚訊息，不覆蓋舊的 content.js。
- 表格欄位不符任何規則 → 仍保留在 `pages`（筆記瀏覽可看到），只是不進測驗。
- 網頁沒有 content.js → 顯示「尚未同步」提示與說明。

## 9. 測試

- `sync/parse-notion-md.test.mjs`：用快取 Markdown 跑解析，斷言各型態數量與幾個關鍵字。
- 瀏覽器手動驗證：五個視圖、測驗流程、進度持久化。

## 10. 跨裝置同步（v0.2，2026-09-12 加入）

決策：Supabase（免費方案）+ 同步碼，不做登入。理由：單人使用、資料只是測驗統計、換裝置只需貼一次碼。

- **後端**：一張 `progress(code_hash, data jsonb, updated_at)` 表，RLS 開啟且無 policy；anon 只能呼叫 `progress_get(p_code)` / `progress_put(p_code, p_data)` 兩個 `security definer` 函式，函式內用 SHA-256 雜湊同步碼。腳本在 `sync/supabase-schema.sql`。
- **同步碼**：`<單字>-<4>-<4>-<4>`，31 字元字母表（去掉 i l o 0 1），約 60 bits 隨機。存 localStorage `nihongo.synccode`。
- **前端** `js/sync.js`：直接用 `fetch` 打 REST RPC，不載 SDK。啟動時 pull（下載 → `Progress.merge` → `Progress.replace` → 若有差異再 push）；`Progress.onChange` 觸發 2 秒 debounce push；`online` 事件補上傳。header 右上 `#sync-pill` 顯示狀態。
- **合併規則**（`Progress.merge`，純函式，有測試）：同 id 取 `seen` 大者，相同取 `last` 晚者；`days` 聯集；`sessions` 以 `at` 去重取最近 200。
- **設定頁** `#/sync`：未設定 config 時顯示建置步驟；有 config 時提供產生／連結／立即同步／斷開／複製。
- **設定檔** `data/sync-config.js`：`url` 與 `anonKey` 留空即停用同步。
- **離線測試** `sync/mock-supabase.mjs`：模擬兩個 RPC 端點，已用它驗證產生 → 上傳 → 第二裝置合併 → 錯誤格式提示。

已知限制：兩台裝置「同時」上傳會 last-write-wins（但各自下一次 pull 會再合併回來）；同步碼外洩等於進度外洩，重新產生新碼即可。

## 11. 外部公開單字（v0.3，2026-09-14）

- JLPT N5、N4 單字 1386 個，來自 tanos.co.uk（CC BY）經 jamsinclair/open-anki-jlpt-decks 整理。
- 中文解釋由 AI 翻成繁體中文，存在 `sync/external/zh-tw.*.tsv`，網站標示「AI 翻譯」並顯示英文原文。
- `sync/build-external.mjs` 產生 `data/external.js`；`js/data-merge.js` 在瀏覽器合併，同字同讀音同級以 Notion 為準。
- 測驗新增「單字來源」篩選。

## 12. 漢字專區（v0.4，2026-09-15）

決策：使用者是中文母語者，不做字義教學和寫字練習，只練讀音。使用者選了「字的讀音」和「詞裡的讀音」兩種模式，範圍 N5–N1 全部。

- **資料**：KANJIDIC（CC BY-SA 4.0）經 kanji-data 整理，排除 WaniKani 欄位 → `sync/external/kanjidic/jlpt-kanji.json`。OpenCC `JPShinjitaiCharacters.txt`（Apache-2.0）提供日本字形對繁體的對照。`sync/build-kanji.mjs` 產生 `data/kanji.js`。
- **表外常用字**：tanos 的 JLPT 漢字表漏了「分」這類常用字，導致「自分、半分、分かる」對不齊。解法是另外保留 KANJIDIC grade 1–8 的常用漢字 172 個，存成 `extra`、等級標為「其他」，只用來對齊，不捏造 JLPT 等級。有出現在單字裡的才顯示在漢字頁「其他」分頁，目前 18 個。對齊率由 93% 提升到 96%，詞裡的讀音題 1659 題。
- **讀音對齊** `js/kanji-align.js`：回溯搜尋，把詞的讀音切給每個漢字。候選讀音是音讀、訓讀詞幹、詞幹加部分送假名，再加連濁、半濁音、促音變化，「々」沿用上一個字。對不齊的詞列為特殊讀法，不出題。在瀏覽器執行，Notion 每天同步後會自動跟上。
- **題型**：`kanji_on`、`kanji_kun`（id 加 `:on`、`:kun` 分開記進度）、`kanji_word`（詞裡的讀音）。題型可指定 `distractors`、`conflict`、`id`、`promptHtml`、`detail`。`conflict` 用來排除「其實也對」的干擾選項。
- **畫面**：`#/kanji/<等級>/<字>`，字格顏色代表熟練狀態；學習地圖每級加漢字進度；頁尾註明 KANJIDIC 與 OpenCC。

## 13. 之後可擴充

- 日本字形辨識題（氣→気）、同形異義詞（手紙＝信）、聲旁規律（青→晴清精請都唸 せい）。
- N3–N1 單字、Tatoeba 例句、間隔重複（SRS）排程。
