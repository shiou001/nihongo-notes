# にほんごノート 🍙

從 Notion「🇯🇵 日文學習筆記」同步內容的手繪風日文複習網站。

- 📖 **筆記**：照 Notion 原本的 8 個分頁與表格呈現，可全文搜尋
- ✏️ **複習測驗**：單字、讀音、句型、會話、五十音與漢字，支援選擇題、假名輸入與句子填空；優先安排到期複習
- 🗺️ **學習地圖**：依選定程度與每週新字目標估算站內進度；N3～N1 明確標示為部分收錄
- 🈁 **五十音**：平假名 / 片假名切換，點一下會唸
- 📡 **Notion 同步**：你只管更新 Notion，腳本定時把內容抓進來

## 網站怎麼走

導覽列有五項：

| 頁面 | 做什麼 |
|---|---|
| 🏠 今日 | 你現在在哪一級的第幾單元、有幾題到期複習。兩個按鈕：繼續單元、今日複習。 |
| 📚 課程 | 每一級的單元清單，照教學順序排。每個單元 = 讀筆記 → 練題目 → 80% 答對就達標。 |
| 和 生活日本 | 拉麵店、便利商店、電車、神社、溫泉、動畫口語、四季活動。每個主題有文化小知識、情境對話、角色扮演和小問答，也穿插在課程裡。 |
| 🔁 複習 | 到期的題目在這裡，不管在哪個單元學的。也可以只練弱點。 |
| 📖 參考資料 | 筆記、五十音、漢字表、自選測驗、聲音、同步。隨時查，但不是主線。 |

單元順序寫在 [data/curriculum.js](data/curriculum.js)，你可以自己改。大綱單元（假名、會話、文法、閱讀）用 `[頁面標題, 段落關鍵字]` 對應到 Notion 段落；單字課和漢字課由程式依等級自動切成小課，穿插在大綱單元之間；生活主題每兩個單元插一個。

**Notion 新段落會自動進課程。** 大綱還沒寫到的段落，只要裡面有能出題的表格，同步後就會變成「Notion 新筆記」單元，排在那一級大綱單元的後面；今日頁也會提醒。標題寫了 `N5`、`N4` 就放那一級，沒寫就放 `newNotesLevel`（預設 N5）。想調整位置，把它寫進 `data/curriculum.js` 就好。

每個能練習的單元都有「換個方式練」：配對遊戲、聽力挑戰、句子重組、角色扮演（依單元內容出現）。配對和句子重組第一次就做對的題目會算進單元進度。

## 設計與動畫（v0.13 貼紙漫畫風）

角色是「[ぴよたそ](https://hiyokoyarou.com/about/)」的 8 隻貓（[img/cats/](img/cats/)），網站跟著牠們的畫風走：黑色粗框（2.5px，跟貓的線條一樣）＋錯位實心陰影，像一張張貼紙；標題和數字用圓體 Zen Maru Gothic。樣式在 [css/sticker.css](css/sticker.css)，疊在 `natural.css`、`life.css` 上面。

| 配色 | 色碼 | 用在 |
|---|---|---|
| 主色・櫻花牛奶 | `#f6a5b8`（標題卡 `#fac8d3`、淡色 `#ffe3ea`） | 標題卡、主要按鈕、「ノート」貼紙、今日一句 |
| 副色・海鹽灰藍 | `#b6c8de`（淡色 `#eaf0f7`） | 區段編號、跑馬燈、目前單元、答對回饋、繼續單元按鈕 |
| 線條・文字 | `#1f1f1f` | 所有外框、陰影、文字 |

想換顏色，改 `css/sticker.css` 最上面的變數就好（副色的變數名稱沿用 `--butter`）。網站已經沒有綠色。

**貓咪分工**（[js/art.js](js/art.js) 的 `Art.char`）：首頁標題卡上坐著茶虎、黑貓、三花；每頁頁首一隻貓；答對招財貓、答錯淚汪汪的黑貓；今天份量完成是打哈欠的黑貓；開場是走路的黑貓；課程各級各一隻。目前單元的進度是 10 個貓腳印。插圖依ぴよたそ規約使用：網站可用、不需標註，但**不可把圖檔單獨再散布或販售**，頁尾仍註明來源。

**動畫**（[js/motion.js](js/motion.js)）：開場走路的黑貓、標題逐字浮現、捲動淡入、數字跳動、換頁淡入、按鈕按下會陷進去、卡片懸停像被拿起來的貼紙、貓咪輕輕晃動。**設定 → 動畫效果**可選跟隨系統／開啟／關閉；系統開著「減少動態效果」時首頁會提示。

## 直接使用

雙擊 `index.html` 就能用（不需要伺服器）。想用 localhost：

```bash
npm start
```

然後開 http://localhost:8080 。

## 部署到 GitHub Pages（手機、其他電腦都能開）

網址會是 `https://<你的帳號>.github.io/nihongo-notes/`。

1. 到 https://github.com/new 建立 repo：名稱 `nihongo-notes`、**Public**、**不要**勾 Add README / .gitignore / license。
2. 在這個資料夾執行（把 `<你的帳號>` 換掉）：
   ```bash
   git remote add origin https://github.com/<你的帳號>/nihongo-notes.git
   git push -u origin main
   ```
   第一次會跳出瀏覽器要你登入 GitHub，照著按就好。
3. repo 頁面 → **Settings → Pages → Build and deployment → Source** 選 **GitHub Actions**。
4. 到 **Actions** 分頁，點「Sync Notion & Deploy Pages」→ **Run workflow**。跑完（約 1 分鐘）網址就能開了。

之後在電腦上改完程式，`git add -A && git commit -m "..." && git push` 就會自動重新部署。

## 從 Notion 同步

1. 到 https://www.notion.so/developers/tokens → **New token** → 取個名字 → 能力勾 **Notion API** → **Create token**，複製那串 `ntn_` 開頭的權杖。
   這是「個人存取權杖」，直接以你本人的身分讀取，你看得到的頁面它都能讀，**不需要**再把頁面連給 integration。
   也因此權限比較大，權杖只放在 GitHub Secrets 或自己電腦的環境變數，不要貼到任何檔案裡。
2. 放到 GitHub：repo → **Settings → Secrets and variables → Actions → New repository secret**，Name 填 `NOTION_TOKEN`，Secret 貼權杖。之後每天凌晨三點會自動同步。
3. 想在自己電腦手動同步，設定環境變數後執行：

```bash
# PowerShell
$env:NOTION_TOKEN = "ntn_xxxxxxxx"
node sync/sync-notion.mjs
```

腳本會：抓所有子頁面 → 存成 `sync/cache/*.md` → 解析成 `data/content.js`（網站讀這個）。
同步失敗時不會動到既有的 `data/content.js`。

### 定時同步

**方法 A：GitHub Actions（推薦，部署到 Pages 後零維護）**
在 repo `Settings → Secrets and variables → Actions` 新增 `NOTION_TOKEN`。
[.github/workflows/pages.yml](.github/workflows/pages.yml) 每天台灣時間 03:00 自動同步、commit、重新部署。沒設 token 時會略過同步，不會報錯。

**方法 B：Windows 工作排程器（本機）**
1. 建一個 `sync.cmd`：
   ```
   set NOTION_TOKEN=ntn_xxxxxxxx
   cd /d "D:\CLAUDE D\nihongo-notes"
   node sync\sync-notion.mjs
   ```
2. 工作排程器 → 建立基本工作 → 每天 → 動作「啟動程式」選這個 `.cmd`。

## 跨裝置同步進度（Supabase + 同步碼）

不用登入。第一台裝置產生一組同步碼（像 `torii-nzkq-udqt-em26`），其他裝置貼上同一組碼就會把進度合併在一起。

**一次性設定（約 5 分鐘）**

1. 到 https://supabase.com/dashboard → **New project**（Region 選 Northeast Asia (Tokyo)，Database password 隨便設一個記起來）。
2. 專案建好後，左側 **SQL Editor** → **New query** → 把 [sync/supabase-schema.sql](sync/supabase-schema.sql) 整份貼上 → **Run**。應該看到 `Success. No rows returned`。
3. 左側 **Project Settings → API**：複製 **Project URL** 與 **anon public** key，貼進 [data/sync-config.js](data/sync-config.js)。
4. 重新整理網站，右上角會出現「☁️ 未連結」，點進去按「產生新的同步碼」。
5. 其他裝置開同一個網站 → 右上角 ☁️ → 貼上同步碼 → 連結。

**安全性**：資料表開了 Row Level Security 且沒有任何 policy，anon key 只能呼叫 `progress_get` / `progress_put` 兩個函式，而且函式只認同步碼的 SHA-256 雜湊。anon key 放在網頁裡是 Supabase 的正常用法。

**合併規則**（[js/progress.js](js/progress.js) 的 `merge()`）：同一題以看過次數多的紀錄為準，一樣多取最後作答時間晚的；學習日期聯集；測驗紀錄以時間去重。不同裝置對同一題的離線作答次數不會相加。程度、學習目標及每週新字目標儲存在各裝置。

**離線測試**：`node sync/mock-supabase.mjs` 會在 54321 埠起一個假端點，把 sync-config 暫時指過去就能不連 Supabase 測完整流程。

## 外部公開單字（JLPT N5、N4）

除了你的 Notion 筆記，網站還內建一份公開的 JLPT 單字表，N5 約 718 字、N4 約 668 字。

- **來源**：[tanos.co.uk](http://www.tanos.co.uk/jlpt/) 的 JLPT 單字表（CC BY），經 [open-anki-jlpt-decks](https://github.com/jamsinclair/open-anki-jlpt-decks) 整理（MIT）。
- **中文**：原始資料只有英文，中文是 AI 翻譯，網站上會標示，答題後會顯示英文原文。
- **和 Notion 的關係**：同一個字、同讀音、同等級，以你 Notion 的版本為準。外部單字不會寫進 Notion。
- **怎麼用**：測驗設定裡的「單字來源」可以只考筆記、只考公開單字，或兩種都考。筆記頁多了「🌐 JLPT 公開單字」可以瀏覽和搜尋。
- **修正翻譯或加更多等級**：看 [sync/external/README.md](sync/external/README.md)。

## 🀄 漢字專區

給中文使用者的漢字練習：字義和寫法不用教，重點放在讀音。

- **漢字表**：JLPT N5 到 N1 共 2211 字，依等級排列。和繁體寫法不同的字，右下角會標出繁體，例如「気」旁邊標「氣」。
- **漢字卡片**：點一個字，會看到音讀、訓讀、英文字義，以及你單字裡用到這個字的詞。每個詞裡這個字的唸法會標出來。「今日」這種不能拆開唸的特殊讀法會另外列出。
- **字的讀音**：看漢字選音讀或訓讀。干擾選項挑讀音開頭相近、但不會「其實也對」的字。
- **詞裡的讀音**：「学生」的「生」唸什麼？題目從網站所有單字自動產生，干擾選項是同一個字的其他唸法。
- **進度**：音讀、訓讀題使用下方的間隔複習規則，學習地圖每一級也有漢字進度。
- **「其他」分頁**：tanos 的 JLPT 漢字表漏了一些常用字，例如「分」。出現在你單字裡的這類字會放在這個分頁，不標 JLPT 等級，但一樣可以練。

資料來源與更新方式看 [sync/external/README.md](sync/external/README.md)。讀音對齊的規則在 [js/kanji-align.js](js/kanji-align.js)。

## 🔊 聲音

網站用瀏覽器內建的語音朗讀，聲音好不好聽取決於裝置。[js/voice.js](js/voice.js) 會自動挑最自然的日文聲音，頁尾的「🔊 聲音」可以自己換聲音、選語氣，每個聲音都能先試聽。

| 裝置 | 推薦聲音 |
|---|---|
| 電腦用 Edge | Microsoft Nanami Online (Natural)，最像真人、也最可愛，需要網路 |
| 電腦用 Chrome | Google 日本語，需要網路 |
| iPhone | 到系統設定下載 O-ren 或 Kyoko 的「加強版」 |
| Android | Google 語音服務的日文語音 |

名字有 Desktop、Haruka、Ayumi、Ichiro 的是 Windows 內建的舊聲音，最像機器人。語氣有「可愛」「自然」「慢慢說」三種，預設是可愛。設定只存在該裝置，不會跨裝置同步。

## 只用快取重建（不連 Notion）

```bash
npm run build
```

## 每日學習與熟練度

首頁可設定程度、日常會話／考試複習目標及每週 15、30 或 50 個新字。每日單字維持選定程度，先安排到期項目，再加入每日與每週配額內的新字；新字先看學習卡，再練習回想。

作答後會顯示選擇的答案、正解、說明、來源及下次複習時間。新字學習卡、提示與會洩漏答案的語音都算輔助，不計入獨立答對分數。已審訂例句收在 `data/teaching.js`，其他匯入詞條不表示已逐條審訂。

熟練度需要 3 次符合間隔的獨立答對；必須到期且距前次有效作答至少 24 小時，重複當日作答不累積。有效答對後依序隔 1、3、7、14、30 天複習；答錯或使用提示則回到 10 分鐘後複習。既有作答次數保留，舊版連答 3 次的狀態須重新經過間隔確認。站內熟練度與估算週數不代表 JLPT 應試能力。

## 測試

```bash
npm ci
npm test
```

包含解析器、進度合併、間隔排程、每日範圍與新字上限、出題與答案洩漏，以及使用模擬 DOM 的介面流程測試。這些測試不取代真實瀏覽器與手機的視覺驗收。

已知教材修訂放在 `sync/editorial.mjs`，於解析後、出題資料擷取前套用。請修改此檔再執行 `npm run build`，不要手改產生的 `data/content.js`，以免下次 Notion 同步覆蓋修訂。原始快取保留原文。

## 你可以自己改的地方 🖊️

| 檔案 | 改什麼 |
|---|---|
| `data/curriculum.js` | 單元順序、每課字數、生活主題的間隔、Notion 新段落放哪一級 |
| `data/life.js` | 生活日本的主題：文化說明、單字、實用句（字卡）、情境對話、小問答 |
| `data/plan.js` | N5 → N1 每級目標與收錄完整性標記 |
| `js/study.js` | 程度、每週新字目標與進度估算 |
| `js/progress.js`、`js/quiz.js` | 間隔複習與熟練度規則 |
| `data/teaching.js`、`sync/editorial.mjs` | 審訂例句與教材修訂 |
| `css/style.css` 的 `:root` | 配色、字型 |

## Notion 怎麼寫，網站就怎麼認

解析器靠**表格表頭**判斷資料型態，新增內容時照這些欄位名稱寫就會自動進測驗：

| 表頭 | 進入 |
|---|---|
| 單字 / 讀音 / 意思（可加 重音、例句） | 單字測驗；等級看最近的標題有沒有 `N5`~`N1` 或「二級」等，沒有就是「筆記」 |
| 句型 / 意思 / 例句 | 文法測驗 |
| 日語 / 羅馬字 / 中文（或 使用場合） | 會話測驗 |
| 羅馬拼音 / 平假名 / 片假名 | 五十音 |
| 項目 / 說明（敬語頁，一個 `###` 標題一句） | 會話測驗（敬語） |

**其他表格**也會盡量出題（`sync/parse-notion-md.mjs` 的 `tableDrills`）：

| 表格長這樣 | 出什麼題 |
|---|---|
| 有一欄日文、一欄表頭含「意思／中文／翻譯」 | 句子 → 意思。例：例子／意思、例句／意思 |
| 兩欄日文、同一列開頭相同 | 句型變換。例：現在／過去（食べる とき → 食べた とき）、用「が」／用「の」 |

「句尾／例子」這種包含關係（です → 学生です。）、羅馬拼音欄、表頭空白的比較表不會出題，只顯示在筆記裡。

## 專案結構

```
index.html           單頁應用入口
css/style.css        基礎樣式（natural.css 版面、life.css 生活日本與小遊戲、sticker.css 貼紙漫畫風配色）
js/art.js            貓咪角色、頁尾草地、圓形進度
js/motion.js         開場、捲動、懸停、換頁動畫與「動畫效果」設定
img/                 封面圖與貓咪插圖（ぴよたそ）
js/app.js            路由 + 各視圖
js/quiz.js           出題引擎、熟練度規則
js/progress.js       localStorage 進度 + 合併規則
js/study.js          裝置學習設定 + 每日配額
js/sync.js           跨裝置同步（Supabase RPC + 同步碼）
data/sync-config.js  Supabase URL / anon key（可手改）
sync/supabase-schema.sql  Supabase 建表與函式
sync/mock-supabase.mjs    本機假端點，離線測同步
js/doodles.js        手繪 SVG（達摩、櫻花、飯糰、鳥居、富士山、招財貓）
data/content.js      ← 同步腳本產生（勿手改）
data/plan.js         學習規劃（可手改）
sync/                Notion 同步與解析
docs/superpowers/specs/  設計文件
```
