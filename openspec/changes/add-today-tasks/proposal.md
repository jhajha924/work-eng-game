## Why

計畫引擎已能算出每天的任務，但使用者還看不到、也無法打勾。這個提案做出 App 的第一個畫面「今日任務」：打開就知道今天要練什麼、做完打勾、看到經驗值與連勝天數，並把紀錄存在本機資料庫，重新整理或關掉瀏覽器都不會遺失，讓 App 開始可以取代 PDF 手冊的打勾表。

## What Changes

- 內容包的每日任務模板加上經驗值 `xp`（單字卡 10、跟讀 10、精讀 15、AI 會話 20、錄音 15、頭目戰 100 等），結構檢查同步加入 `xp` 規則；範例包與私人包匯出腳本一起更新。
- 新增進度計算純函式：找出今天的排程、計算每個任務的經驗值、總經驗值、連勝天數、每連續 7 天 +50 的連勝獎勵、最低限度日。
- 導入 IndexedDB（Dexie）：本機資料庫 `work-eng-game`，資料表 `taskLogs` 存打勾與最低限度日紀錄。
- 把範本示範頁換成「今日任務」頁：日期、計畫進度（新手村第幾天或第幾週與關卡）、本週主題、今天的任務清單（打勾）、總經驗值、連勝天數、「今天只做 5 分鐘單字卡」最低限度按鈕；涵蓋計畫未開始、休息日、計畫已結束三種狀態。
- 計畫設定暫時固定為預設值：範例內容包、2026-11-02 開始、6 個月、含新手村。

## Non-Goals (optional)

（見 design.md 的 Goals / Non-Goals）

## Capabilities

### New Capabilities

- `daily-progress`: 打勾紀錄的儲存、任務經驗值、總經驗值、連勝天數與獎勵、最低限度日的規則。既有規格 `content-pack` 只定義內容格式、`plan-scheduling` 只定義排程，都不涵蓋使用者的完成紀錄與計分。
- `today-page`: 今日任務畫面顯示什麼、各種計畫狀態如何呈現、打勾互動與手機寬度。既有規格都沒有任何畫面行為。

### Modified Capabilities

- `content-pack`: 「內容包結構」加入任務模板的 `xp` 欄位；「結構檢查回報錯誤」加入 `xp` 必須是大於等於 0 的整數。

## Impact

- Affected specs: `daily-progress`（新）、`today-page`（新）、`content-pack`（修改）
- Affected code:
  - New: src/progress/xp.ts, src/progress/stats.ts, src/progress/today.ts, src/progress/db.ts, src/progress/progressRepo.ts, src/progress/xp.test.ts, src/progress/stats.test.ts, src/progress/today.test.ts, src/progress/progressRepo.test.ts, src/app/defaultPlan.ts, src/app/useTodayProgress.ts, src/app/TodayPage.tsx, src/app/TodayPage.css, docs/learning-notes/02-今日任務與本機資料庫.md
  - Modified: src/plan/types.ts, src/plan/validatePack.ts, src/plan/validatePack.test.ts, src/plan/testFixtures.ts, content/packs/meeting-a2-b1-sample/pack.json, scripts/export_private_pack.py, src/App.tsx, src/App.css, src/index.css, index.html, package.json, package-lock.json
  - Removed: src/assets/react.svg, src/assets/vite.svg, src/assets/cloudflare.svg, src/assets/hero.png
- 相依套件：新增 dexie；開發用 fake-indexeddb（在 Node 測試環境模擬 IndexedDB）
- 來源：討論 english-quest-app 結論（第 1 刀）、專案規劃書第 4 節 FR-02～FR-04、第 8 節資料模型、第 9 節經驗值規則、第 14 節第 1 刀順序 3～4
