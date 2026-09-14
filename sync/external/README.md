# 外部公開資料

這個資料夾放網站用的外部學習資料。和 Notion 筆記分開保存，由 `sync/build-external.mjs` 轉成 `data/external.js`。

## JLPT 單字（`jamsinclair/`）

| 項目 | 內容 |
|---|---|
| 檔案 | `n5.csv`、`n4.csv`，欄位 expression, reading, meaning, tags, guid |
| 取自 | https://github.com/jamsinclair/open-anki-jlpt-decks `src/`，commit `1ad66734417aca9dbcca6b2d5ee440cb13ab3ba0`，2026-09-14 下載 |
| 整理者授權 | MIT |
| 原始出處 | Jonathan Waller 的 JLPT Resources，http://www.tanos.co.uk/jlpt/ |
| 原始授權 | Creative Commons BY：可自由使用，包含商業用途，但要註明出處並附連結 |

網站頁尾和「🌐 JLPT 公開單字」頁都有註明出處，改版時請保留。

JLPT 官方從 2010 年起不再公布單字表，所以任何「N5 單字表」都是整理者依舊制考試與教材推估的，不是官方清單。

## 中文解釋（`zh-tw.*.tsv`）

原始資料只有英文解釋。`zh-tw.n5.tsv`、`zh-tw.n4.tsv` 是 AI 依日文與英文解釋翻成的繁體中文，網站上會標示「AI 翻譯」，並在答題後顯示英文原文對照。

- 格式：`單字<TAB>讀音<TAB>中文`，單字和讀音要和 CSV 一致。
- 發現翻錯：直接改對應那一行，再執行 `npm run build:external`。
- 檢查有沒有漏翻：`node sync/build-external.mjs --check`。部署時的測試也會檢查。

## 加入 N3 到 N1

1. 從上面的 repo 下載 `n3.csv` 放進 `jamsinclair/`。
2. 新增 `zh-tw.n3.tsv`，補上每個字的中文。
3. 執行 `npm run build:external`，再跑 `npm test`。
4. 更新本檔的 commit 與下載日期。
