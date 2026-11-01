## 1. 內容包經驗值（D1）

- [ ] 1.1 修改「內容包結構」與「結構檢查回報錯誤」（D1 經驗值寫在內容包的任務模板）：`DayTemplate` 加上 `xp`，`validatePack` 檢查每個任務模板的 `xp` 是大於等於 0 的整數，src/plan/testFixtures.ts 的假內容包補上 `xp`。驗證：src/plan/validatePack.test.ts 新增規格 Example 的三列（`xp` 為 -1、1.5、缺少）各自 ok: false，原有測試全部通過。 <!-- speclink-task:tsk_01M699580HQDYVRCFC53YK9FH1 -->
- [ ] 1.2 範例包與私人包加上經驗值：content/packs/meeting-a2-b1-sample/pack.json 依 D1 數值填入 `xp`（新字 10、跟讀 10、精讀 15、AI 會話 20、錄音 15、複習日 10、AI 角色扮演 20、頭目戰 100、頭目戰補考 15、輕量日 10）；scripts/export_private_pack.py 以相同 key 對應填入 `xp`，並在本機重新匯出私人包。驗證：`npm test` 中 samplePack.test.ts 與 privatePack.test.ts 都通過（私人包通過 `validatePack`）。 <!-- speclink-task:tsk_01M699580HST9BW7BT5XBHXP25 -->

## 2. 進度計算（D2～D5、D7）

- [ ] 2.1 實作「任務經驗值」：src/progress/xp.ts 的 `taskXp` 與常數 `MINIMUM_KEY`、`MINIMUM_XP`。驗證：src/progress/xp.test.ts 以參數化測試涵蓋規格 Example「任務經驗值」全部 8 列。 <!-- speclink-task:tsk_01M699580HT23HRF1MCDWW461X -->
- [ ] 2.2 實作「今天日期依裝置本機時區」（D7 今天的日期依裝置本機時區）與「今天狀態的判斷」：src/progress/today.ts 的 `localToday`、`findToday`。驗證：src/progress/today.test.ts 涵蓋 `localToday` 在 Asia/Taipei 與 America/New_York 下對 2026-10-31T16:30:00Z 的結果，以及規格 Example「今天狀態」全部 7 列。 <!-- speclink-task:tsk_01M699580HFXRVHVZ949WPXV0G -->
- [ ] 2.3 實作「打卡日與連勝天數」（D3 打卡日與連勝規則）、「連勝獎勵」（D4 連勝獎勵）與「總經驗值」（D2 經驗值與連勝由紀錄重新計算，不另外儲存）：src/progress/stats.ts 的 `computeStats`。驗證：src/progress/stats.test.ts 涵蓋規格 Example「連勝天數」6 列、「連勝獎勵」4 列、總經驗值 230 的情境，以及今天之後的紀錄不計入。 <!-- speclink-task:tsk_01M699580HQCEKV00800FW85EN -->

## 3. 本機資料庫（D5、D6）

- [ ] 3.1 導入 Dexie（D6 Dexie 單一資料表 taskLogs）：新增套件 dexie 與開發套件 fake-indexeddb；src/progress/db.ts 定義資料庫 `work-eng-game` 版本 1、資料表 `taskLogs`（主鍵 `id`、索引 `date`）與 `TaskLog` 型別。驗證：`npm run build` 通過，3.2 的測試能在 fake-indexeddb 上開啟資料庫。 <!-- speclink-task:tsk_01M699580HG7QEHSFJ8Q1Q20FV -->
- [ ] 3.2 實作「打勾紀錄存在本機」、「取消打勾」與「最低限度日」（D5 最低限度日）：src/progress/progressRepo.ts 的 `listLogs`、`setTaskDone`、`setMinimumDay`。驗證：src/progress/progressRepo.test.ts 在 fake-indexeddb 上涵蓋規格的四個情境（打勾後重新讀取、重複打勾只有一筆、取消後紀錄消失、標記與取消最低限度日），每個測試使用全新的資料庫。 <!-- speclink-task:tsk_01M699580H5JRHWAFQ7YW4NH9V -->

## 4. 今日任務頁（D8、D9）

- [ ] 4.1 預設計畫與狀態 hook（D8 畫面狀態集中在一個 hook、D9 預設計畫集中在一個模組）：src/app/defaultPlan.ts 匯出範例包與預設設定；src/app/useTodayProgress.ts 讀取紀錄、計算 `view` 與 `stats`、提供 `toggleTask`、`toggleMinimum`，資料庫錯誤時設定 `error` 但仍回傳 `view`。驗證：`npm run lint`（含 react-hooks 規則）與 `npm run build` 通過；4.2 的畫面使用它。 <!-- speclink-task:tsk_01M699580H02ZXZP8P5MJ3J3BK -->
- [ ] 4.2 實作「進行中日子的畫面」、「計畫未開始、休息日與已結束的畫面」、「打勾互動」、「最低限度按鈕」與「本機資料庫無法使用時的提示」：src/app/TodayPage.tsx，並讓 src/App.tsx 改為顯示今日任務頁；刪除範本示範用的圖片與樣式；index.html 的 `lang` 改為 `zh-Hant`。驗證：`npm run build` 通過，開發伺服器上依日期顯示正確狀態（以 4.3 的手動驗收確認）。 <!-- speclink-task:tsk_01M699580H1DWPKXSJK6QBWPJW -->
- [ ] 4.3 實作「手機版面」：src/app/TodayPage.css 與 src/index.css 以手機優先排版，寬度 360px 不出現橫向捲動、打勾框可點區域至少 44×44px，支援系統深色模式。驗證：`npm run build` 通過，瀏覽器開發者工具以 360px 寬度檢視沒有橫向捲軸（4.3 由 Claude 以建置結果確認樣式存在，實際畫面由 5.2 手動驗收）。 <!-- speclink-task:tsk_01M699580H2JYHH8XXN2388N10 -->

## 5. 學習筆記與驗收

- [ ] 5.1 撰寫學習筆記 docs/learning-notes/02-今日任務與本機資料庫.md：依學習筆記格式說明 IndexedDB 與 Dexie、由紀錄重新計算的設計、連勝規則、本機時區、React hook 分工，並列出面試可能被問的問題。驗證：內容審查，五個段落齊全且不含個人資訊。 <!-- speclink-task:tsk_01M699580HEK6BMYMW1YR86X2Y -->
- [ ] [M] 5.2 使用者驗收：本機 `npm test`、`npm run lint`、`npm run build` 通過；`npm run dev` 打開首頁看到今天的任務，打勾後重新整理仍在、經驗值與連勝即時更新、最低限度按鈕可切換；用瀏覽器開發者工具 360px 寬度檢視沒有橫向捲動；commit、push 後正式網站顯示今日任務頁、GitHub Actions 成功。驗證：截圖回報。 <!-- speclink-task:tsk_01M699580HTQAAH85EYBRF7DZQ -->
