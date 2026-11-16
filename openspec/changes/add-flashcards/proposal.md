## Why

計畫每天都有「新字 15 個進單字卡」與「複習單字卡」的任務，但 App 目前沒有單字卡，使用者還得另外開 Anki。依規劃書第 14 節第 1 刀的順序，登入與同步完成後，下一步就是內建間隔重複單字卡（FR-07），讓「中文情境 → 說出英文」的主動回想在 App 內完成，複習進度也能在手機和電腦之間同步。

## What Changes

- 內容包新增選填的 `vocab`（依類別分組的單字：英文、中文、例句）與 `patterns`（依情境分組的句型：英文、中文），`validatePack` 一併檢查。
- 公開範例包加上通用的範例單字與句型；`scripts/export_private_pack.py` 把原計畫的 215 字與 62 句寫進本機私人內容包（不進版本庫）。
- 新增單字卡牌組：由內容包產生卡片，卡片 id 由內容包 id、種類（單字或句型）與英文轉成的代號組成，跨裝置相同。
- 用 `ts-fsrs` 5.4.2 計算每張卡的下次複習時間；評分四種：重來、困難、良好、簡單。
- 每日複習佇列：先到期的複習卡，再補新卡（每天最多 15 張新卡）；新卡優先取本週主題的單字類別。
- 新增單字卡頁（網址 `#/cards`）：正面顯示中文與類別，翻面顯示英文與例句，四個評分按鈕；佇列清空時顯示完成訊息。今日任務頁加上「複習單字卡」入口與今天的張數。
- 本機資料庫升級到版本 3：新增卡片狀態與複習紀錄兩張資料表。
- 卡片狀態跨裝置同步：新增 D1 資料表 `card_states`（遷移檔 0002）與 `POST /api/sync/cards`，沿用打勾紀錄的同步規則（較新者為準、伺服器版本號當游標）；前端每次同步依序同步打勾紀錄與卡片狀態。

## Capabilities

### New Capabilities

- `flashcards`: 單字卡牌組、FSRS 排程、每日複習佇列、單字卡頁與卡片狀態的本機儲存。相關的既有規格 content-pack（只管內容包格式）、daily-progress（只管打勾紀錄）、cloud-sync（只管打勾紀錄的同步）、today-page（只管今日任務頁）都不涵蓋間隔重複的排程與複習流程，所以需要新的能力。

### Modified Capabilities

- `content-pack`: 內容包新增選填的 `vocab` 與 `patterns` 欄位與對應的結構檢查。
- `cloud-sync`: 新增卡片狀態的同步 API、D1 資料表與前端依序同步兩種資料的規則。
- `today-page`: 新增「複習單字卡」入口與今天待複習張數。

## Impact

- Affected specs: flashcards（新）、content-pack、cloud-sync、today-page
- Affected code:
  - New: src/cards/types.ts, src/cards/deck.ts, src/cards/deck.test.ts, src/cards/fsrs.ts, src/cards/fsrs.test.ts, src/cards/queue.ts, src/cards/queue.test.ts, src/cards/cardRepo.ts, src/cards/cardRepo.test.ts, src/cards/useFlashcards.ts, src/cards/CardsPage.tsx, src/cards/CardsPage.css, src/app/useHashRoute.ts, migrations/0002_card_states.sql, worker/cards/validate.ts, worker/cards/validate.test.ts, worker/cards/cardSyncRepo.ts, worker/cards/cardSyncRepo.test.ts, worker/cards/routes.ts, worker/cards/twoDevices.test.ts, docs/learning-notes/04-單字卡與FSRS.md
  - Modified: src/plan/types.ts, src/plan/validatePack.ts, src/plan/validatePack.test.ts, src/plan/samplePack.test.ts, content/packs/meeting-a2-b1-sample/pack.json, scripts/export_private_pack.py, src/progress/db.ts, src/progress/progressRepo.test.ts, src/sync/merge.ts, src/sync/syncClient.ts, src/sync/syncClient.test.ts, src/sync/syncController.ts, src/App.tsx, src/app/TodayPage.tsx, src/app/TodayPage.css, worker/app.ts, worker/app.test.ts, package.json, package-lock.json, docs/專案規範.md
- 依賴：新增 ts-fsrs（固定 5.4.2）。
- 部署：需要先對遠端 D1 套用遷移 0002 再 push。
