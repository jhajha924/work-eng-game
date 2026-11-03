## 1. 本機資料庫版本 2（D6、D7）

- [ ] 1.1 實作「修改時間只會往前走」（D7 修改時間只會往前走）：`TaskLog` 型別加上 `updatedAt`、`deleted`；src/progress/logs.ts 新增 `nextUpdatedAt(prev, now)`，`taskLogFor`、`minimumLogFor` 產生 `updatedAt` 為現在、`deleted` 為 false 的紀錄。驗證：src/progress/logs.test.ts 涵蓋規格情境「裝置時鐘倒退」（10:00:00.000Z 的紀錄在 09:00 修改得到 10:00:00.001Z）與時鐘正常時取現在；既有測試全部通過。 <!-- speclink-task:tsk_01M6G3YS36SR3C6CGTZ5BBN12K -->
- [ ] 1.2 實作「本機資料庫升級到版本 2」、「打勾紀錄存在本機」的同步欄位、「取消打勾」的墓碑與「送出後清除未同步標記」（D6 本機資料庫升級到版本 2，取消打勾改成墓碑）：src/progress/db.ts 定義版本 2（`taskLogs: 'id, date, dirty'`、`meta: 'key'`）與升級函式；src/progress/progressRepo.ts 的 `setTaskDone`、`setMinimumDay` 改為寫入 `dirty` 1 的紀錄或標記墓碑，`listLogs` 排除 `deleted`，新增 `pendingChanges()`（`dirty` 為 1 的紀錄，含墓碑）、`getCursor()`、`applySyncResult(sent, remote, cursor)`（在單一交易中清除未變動紀錄的 `dirty`、以 `mergeRemote` 套用伺服器紀錄、儲存游標）。驗證：src/progress/progressRepo.test.ts 在 fake-indexeddb 上涵蓋 daily-progress 規格的打勾、重複打勾、打勾後等待同步、取消後紀錄消失、取消後留下墓碑、取消後再打勾、最低限度日、版本 1 升級保留紀錄等情境，以及 cloud-sync 規格「送出期間又打勾」。 <!-- speclink-task:tsk_01M6G3YS36K9EVM0N7R0RVFHVE -->

## 2. Worker 基礎（D1、D5、D12）

- [ ] 2.1 Worker 改用 Hono（D1 Worker 改用 Hono，API 集中在 createApp）：新增套件 hono；worker/app.ts 匯出 `createApp()` 並提供 `GET /api/health` 回 `{ ok: true }`、未知的 `/api/*` 回 404 `{ error: "not_found" }`；worker/index.ts 改為把請求交給它。伺服器端測試環境（D12 伺服器端測試用 Node 內建的 SQLite 模擬 D1）：worker/testing/sqliteD1.ts 以 `node:sqlite` 實作 `prepare`／`bind`／`first`／`all`／`run`／`batch`，並提供讀取遷移檔建立資料庫的函式；vitest.config.ts 加入 `worker/**/*.test.ts`，型別檢查涵蓋 worker 測試。驗證：worker/app.test.ts 測 `/api/health` 與 404；`npm test`、`npm run lint`、`npm run build` 通過。 <!-- speclink-task:tsk_01M6G3YS362EKW109FF8QKTYXB -->
- [ ] 2.2 實作「D1 打勾紀錄資料表」（D5 D1 資料表與遷移檔）：migrations/0001_auth_and_task_logs.sql 建立 `task_logs`（含 `rev` 索引）、`sessions`、`login_failures`。驗證：worker 測試以 sqliteD1 套用遷移後，查詢 `sqlite_master` 確認三張資料表與 `rev` 索引存在。 <!-- speclink-task:tsk_01M6G3YS36YYMNVRREK9G7FXQQ -->

## 3. 登入（D2、D3、D4、D13）

- [ ] 3.1 實作「密碼雜湊格式與驗證」（D2 密碼雜湊用 PBKDF2-SHA256，格式用冒號分隔）：worker/auth/password.ts 的 `hashPassword`、`verifyPassword`，只用 Web Crypto（Worker 與 Node 都能執行）。驗證：worker/auth/password.test.ts 涵蓋規格 Example「密碼驗證」5 列與「同一個密碼每次雜湊都不同」。 <!-- speclink-task:tsk_01M6G3YS36TRS7A3Z0VXJD0MM9 -->
- [ ] 3.2 實作「產生密碼雜湊的指令稿」（D13 密碼雜湊產生指令稿）：scripts/hash-password.mjs 以隱藏輸入讀兩次密碼，檢查一致與至少 8 個字元，輸出一行雜湊，雜湊邏輯直接匯入 worker/auth/password.ts。兩次輸入的檢查寫成 worker/auth/password.ts 的 `checkNewPassword(first, second)`（回傳錯誤訊息或 null），指令稿只負責讀輸入與印出。驗證：worker/auth/password.test.ts 涵蓋「兩次輸入的密碼不一致」「密碼至少要 8 個字元」與一致時回傳 null；在本機執行一次指令稿，輸出的雜湊能通過 `verifyPassword`。 <!-- speclink-task:tsk_01M6G3YS36PC802CM3AEWBGEDC -->
- [ ] 3.3 實作「工作階段」與「登入失敗鎖定」的資料存取（D3 工作階段存在 D1，用 HttpOnly Cookie 帶、D4 登入失敗鎖定）：worker/auth/authRepo.ts 提供建立工作階段（存權杖 SHA-256、30 天）、查詢有效工作階段、刪除工作階段、刪除過期工作階段、記錄失敗、計算 15 分鐘內失敗次數與解鎖秒數、清除失敗。時間由參數傳入。驗證：worker/auth/authRepo.test.ts 在 sqliteD1 上涵蓋「資料庫只存雜湊」、到期判斷、鎖定的三個情境（第 6 次被鎖、15 分鐘後解鎖、失敗次數未滿）的資料層判斷。 <!-- speclink-task:tsk_01M6G3YS363W0F1PH3Y75M30QC -->
- [ ] 3.4 實作「登入」「登出」「需要登入的 API」：worker/auth/routes.ts 提供 `POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/auth/session` 與給同步路由用的登入檢查中介層，Cookie 屬性依 D3。驗證：worker/app.test.ts 以 `app.request` 涵蓋 app-auth 規格的登入成功、密碼錯誤、請求格式錯誤、沒有設定機密、鎖定、查詢登入狀態（四種 Cookie）、登出後失效、未登入同步回 401。 <!-- speclink-task:tsk_01M6G3YS366V7GNXGDEX4XZ9YE -->

## 4. 同步 API（D8）

- [ ] 4.1 實作「同步請求格式與檢查」：worker/sync/validate.ts 的 `parseSyncRequest(body)`，回傳解析結果或錯誤。驗證：worker/sync/validate.test.ts 涵蓋規格 Example「請求檢查」全部 8 列（全部或部分不合法時不寫入的部分在 4.2 驗證）。 <!-- speclink-task:tsk_01M6G3YS36RT7X3RK5M0TQD0V3 -->
- [ ] 4.2 實作「伺服器端合併：較新者為準」與「取回變更與游標」（D8 同步協定：一次請求先推後拉）：worker/sync/syncRepo.ts 以單一 `batch` 執行 upsert（只有嚴格較新才更新並給新 `rev`），再取回 `rev > since` 最多 500 筆；worker/sync/routes.ts 提供 `POST /api/sync`。驗證：worker/sync/syncRepo.test.ts 涵蓋 Example「伺服器合併」3 列、「新紀錄」、「分頁取回」（1200 筆分三次）、「游標超過伺服器」；worker/app.test.ts 涵蓋「兩筆合法、一筆不合法」時資料表沒有變化。 <!-- speclink-task:tsk_01M6G3YS36NMTM4Z6S2VZ0YPG2 -->

## 5. 前端同步（D9、D10）

- [ ] 5.1 實作「本機合併規則」（D9 本機合併規則）：src/sync/merge.ts 的 `mergeRemote(local, remote)` 與同步紀錄的型別及本機紀錄互轉函式。驗證：src/sync/merge.test.ts 涵蓋規格 Example「本機合併」5 列。 <!-- speclink-task:tsk_01M6G3YS36WPT6KQKAKPNYAXJK -->
- [ ] 5.2 實作「同步用戶端的結果」（D10 前端同步用戶端與觸發時機）：src/sync/syncClient.ts 的 `createSyncClient({ repo, fetch, isOnline })`，提供 `syncOnce()`（分批送出、`hasMore` 續傳最多 20 次、回傳結果與是否取回紀錄）、`login(password)`、`logout()`、`checkSession()`，請求一律帶 `credentials: 'same-origin'`。驗證：src/sync/syncClient.test.ts 以模擬 `fetch` 與 fake-indexeddb 涵蓋「各種結果」「離線時不發請求」、600 筆分兩批送出、`hasMore` 續傳，以及「取消打勾也會同步」（兩個本機資料庫透過一個以 sqliteD1 與 `createApp` 實作的模擬伺服器互相同步）；登入的四種回應（200、401、429、離線）對應到結果代碼。 <!-- speclink-task:tsk_01M6G3YS36BK82VD2CCNEN81DF -->
- [ ] 5.3 實作「同步時機」：src/sync/useSync.ts 管理狀態（checking、logged-out、syncing、synced、offline、error）、開啟頁面、寫入後 30 秒、切到背景、`online` 事件的觸發，同一時間只跑一個同步、執行中被觸發就結束後再跑一次，取回紀錄時把 `remoteVersion` 加 1。觸發排程（30 秒延遲、單一執行、結束後補跑）寫成不依賴 React 的 src/sync/scheduler.ts 的 `createSyncScheduler(run, delayMs)`。驗證：src/sync/scheduler.test.ts 以假計時器涵蓋「連續打勾只同步一次」與「同步期間再觸發」；`npm run lint`（含 react-hooks 規則）通過。 <!-- speclink-task:tsk_01M6G3YS360NJWPFSVDBS7Q85D -->

## 6. 畫面（D11）

- [ ] 6.1 實作「打勾互動」的同步更新：src/app/useTodayProgress.ts 改為接收 `{ now, remoteVersion, onWrite }`，寫入成功後呼叫 `onWrite`，`remoteVersion` 改變時重新讀取紀錄。驗證：`npm run lint`、`npm run build` 通過；手動驗收 7.1 確認「其他裝置的打勾出現在畫面」。 <!-- speclink-task:tsk_01M6G3YS36FRZMRBHT96F57Q6N -->
- [ ] 6.2 實作「同步狀態列」與「登入與登出」（D11 同步狀態列與登入表單）：src/app/SyncBar.tsx、src/app/SyncBar.css 依 D11 表格顯示狀態文字與按鈕、密碼欄與錯誤訊息（鎖定分鐘數無條件進位），按鈕可點區域至少 44×44px，支援深色模式；src/app/TodayPage.tsx 掛上 SyncBar 並串接 `useSync` 與 `useTodayProgress`。狀態文字與登入錯誤文字寫成 src/sync/messages.ts 的純函式。驗證：src/sync/messages.test.ts 涵蓋六種狀態文字、「被鎖定」600 秒→10 分鐘、61 秒→2 分鐘，以及四種登入錯誤文字；`npm run build` 通過。 <!-- speclink-task:tsk_01M6G3YS371174WKDVRGEYW0F7 -->

## 7. 文件與驗收

- [ ] 7.1 撰寫學習筆記 docs/learning-notes/03-登入與跨裝置同步.md（密碼雜湊、Cookie 屬性、工作階段、墓碑、游標、較新者為準、測試替身），並在 docs/專案規範.md 補上：機密只放 Worker 機密與 `.dev.vars`、D1 結構變更只新增遷移檔、部署需要新遷移時先套用遠端遷移再 push。驗證：內容審查，學習筆記五個段落齊全且不含個人資訊。 <!-- speclink-task:tsk_01M6G3YS376R8Y8C9VPP33ASSX -->
- [ ] [M] 7.2 使用者本機驗收：執行 `node scripts/hash-password.mjs` 產生雜湊並寫進 `.dev.vars`；`npx wrangler d1 migrations apply work-eng-game --local`；`npm test`、`npm run lint`、`npm run build` 通過；`npm run dev` 後在 Chrome 登入（錯誤密碼看到「密碼錯誤」）、打勾、看到「已同步」；在 Edge（另一個瀏覽器）登入後看到相同的打勾，取消打勾後回到 Chrome 切換分頁或重新整理看到同步結果；登出後打勾仍在。驗證：截圖回報。 <!-- speclink-task:tsk_01M6G3YS371CJE9WMQW7GXAYRG -->
- [ ] [M] 7.3 使用者部署驗收：`npx wrangler secret put APP_PASSWORD_HASH`、`npx wrangler d1 migrations apply work-eng-game --remote`，再 commit、push；GitHub Actions 成功後，在電腦與手機打開正式網站，登入後互相看到打勾與取消。驗證：截圖回報。 <!-- speclink-task:tsk_01M6G3YS37B842J2B1JFEK2FJX -->
