# にほんごノート 🍙

從 Notion「🇯🇵 日文學習筆記」自動長出來的手繪風日文複習網站（雛形 v0.1）。

- 📖 **筆記**：照 Notion 原本的 8 個分頁與表格呈現，可全文搜尋
- ✏️ **複習測驗**：單字 / 讀音 / 句型 / 會話 / 五十音 四選一，優先出沒看過與常錯的
- 🗺️ **學習地圖**：N5 → N1 每級目標、每週建議、Notion 單字數與熟練進度
- 🈁 **五十音**：平假名 / 片假名切換，點一下會唸
- 📡 **Notion 同步**：你只管更新 Notion，腳本定時把內容抓進來

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

**合併規則**（[js/progress.js](js/progress.js) 的 `merge()`）：同一題以看過次數多的為準，一樣多取最後作答時間晚的；學習日期聯集；測驗紀錄以時間去重。兩台裝置離線各做各的，上線後不會互相蓋掉。

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
- **進度**：音讀、訓讀題都連對 3 次才算熟練，學習地圖每一級也有漢字進度。
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

## 測試解析器

```bash
npm test
```

（包含 Notion 解析器與進度合併規則兩組測試。）

## 你可以自己改的地方 🖊️

| 檔案 | 改什麼 |
|---|---|
| `data/plan.js` | N5 → N1 每級目標、週數、每週建議、里程碑 |
| `js/quiz.js` 最上面的 `isMastered()` | 「什麼時候算背熟」的規則（預設連對 3 次） |
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

其他表格會照原樣出現在「筆記」裡，只是不會出題。

## 專案結構

```
index.html           單頁應用入口
css/style.css        手繪風樣式
js/app.js            路由 + 各視圖
js/quiz.js           出題引擎、熟練度規則
js/progress.js       localStorage 進度 + 合併規則
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
