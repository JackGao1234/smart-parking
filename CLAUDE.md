# CLAUDE.md

台灣停車場即時空位查詢與 Google Maps 一鍵導航，主要在手機（Pixel）上單手使用。

## 程式碼結構（重要）
有兩套前端，改功能時要確認兩邊：
- **線上版**：`docs/index.html`，單一檔案自帶全部邏輯，直接讀 `docs/data/*.json`。GitHub Pages 部署的是 `docs/`。
- **本機開發版**：`src/`（TypeScript + Express API）+ `public/`（前端）。`npm run dev` 啟動。
- `scripts/sync-live-parking.mjs` 由 GitHub Actions 執行，抓即時資料寫進 `docs/data/`。同步結果不進 git（`docs/data/` 在 `.gitignore`），只放進部署產物；例外是手動維護的 `docs/data/custom-parking.json`，它有進 git。
- 排程設定是每 10 分鐘（`*/10 * * * *`），但實際執行間隔更長（常隔數小時）且常失敗，線上資料可能是數小時前的。需要現況時用 `gh run list` 查，不要假設資料是 10 分鐘內的。
- 測試（`tests/`）只涵蓋 `src/`，**不涵蓋線上版 `docs/index.html`**。改線上版時要手動在瀏覽器確認。

## 指令
- `npm test`：Vitest 單元測試 + API 測試，改完程式一定要跑
- `npm run typecheck`：型別檢查
- `npm run dev`：開發伺服器 http://localhost:3000

## 規則
- 推到 main 會直接部署到線上版，改動先開分支，不要直接 commit 到 main。
- 滿位（剩 0 格）的停車場必須鎖住導航（`canNavigate = false`），任何改動都不能破壞這個行為。
- 介面文字用繁體中文。

## 合併前獨立審查
重要的 PR 合併前，必須由**沒參與寫這個 PR 的 Claude** 在另一個 session 審查。寫程式的 session 自己跑 `/code-review`，或用 subagent／fork 審查，都不算。

**哪些算重要**（符合任一項）：
- 動到會部署或影響線上版的檔案：`docs/`（純文字說明除外）、`scripts/`、`.github/workflows/`、依賴套件。
- 動到空位判斷、資料新鮮度、滿位鎖（`canNavigate`），不論在 `src/`、`public/` 或 `docs/`。
- 刪除、略過或放寬既有測試。
- 不確定算不算，就當作重要。只改 README、CLAUDE.md、錯字等不影響行為的 PR 可以不審。

**寫程式的 session**：開好 PR、測試與型別檢查通過後停下來，不要合併。回報裡寫「等待獨立審查」，並附上給使用者的指令：
1. 在 repo 根目錄開新 session：`claude -w review-pr-<編號>`（不要用 `--continue`／`--resume`）
2. 在新 session 輸入：`/code-review high <編號>`

**審查的 session**：
- 先 `gh pr checkout <編號> --detach`，確認讀到的是 PR 最新版，不是過期的本機 main。
- 只挑錯：不改程式、不加 `--fix`、不合併。除了 diff，也要檢查滿位鎖有沒有被破壞、線上版與本機開發版是否都顧到。
- 用 `gh pr comment` 留一則結論，第一行固定為 `獨立審查：通過 @ <完整 commit SHA>` 或 `獨立審查：需修正 @ <完整 commit SHA>`，下面列問題（檔案:行號、會怎麼出錯）。沒有問題也要留。

**合併前**：只有使用者明確要求才合併。先用 `gh pr view <編號> --json headRefOid,comments` 確認最新一則審查結論是 repo 擁有者帳號（`JackGao1234`）留的「通過」，且 SHA 等於目前的 `headRefOid`（公開 repo 任何人都能留言，其他帳號的不算）。沒有結論、需修正、或審查後又有新 commit，都要再開 session 審一次。

## 進度看板
- 看板網址：https://claude.ai/artifact/3sFVRE4pHjQkTzaQRwJZV9 。**以這個網址的內容為準**；原始檔 `.claude/progress.html` 只是本機工作副本，不進 git（這是公開 repo，已列入 `.gitignore`），可能過期或不存在。
- 做完一個有意義的任務後，更新看板再回報：
  1. 一律先用 Artifact 工具 `action: "read"` 讀上面的網址，以讀到的內容為底稿。
  2. 把底稿寫到 `.claude/progress.html` 再修改：頂部狀態列、功能清單、需要注意的事項，並在「更新紀錄」最上面加一行（日期 + 一句話）。
  3. 用 Artifact 工具發佈，帶同一個 `url`，讓網址保持不變。不要開新的看板，也不要 commit 原始檔。
- 解釋概念或設計選項時，優先做成 HTML 頁面（Artifact）給我看。
