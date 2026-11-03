## Context

`add-today-tasks` 把打勾紀錄存在瀏覽器的 IndexedDB（Dexie 版本 1，資料表 `taskLogs`，取消打勾就刪掉紀錄）。Worker 目前只是範本：`/api/*` 回傳一段固定 JSON，D1 資料庫 `work-eng-game`（綁定 `DB`）已建立但還是空的，也還沒有 Worker 機密。

討論 english-quest-app 決定：第 1 刀就做 D1 跨裝置同步（ADR-02），以個人密碼登入，離線時先存本機、連線後自動同步（FR-15、NFR-02）。規劃書第 8 節的同步策略：每筆資料有 `updated_at`，前端把變更放進佇列批次送出，衝突時以較新的 `updated_at` 為準。

限制：只有一個使用者、零成本（Worker 每天 10 萬次請求與 D1 免費額度，和其他兩個專案共用）、手機優先。CI 用 Node 24。

## Goals / Non-Goals

**Goals:**

- 手機和電腦登入同一個密碼後，打勾紀錄（包含取消打勾）會互相同步。
- 沒登入或沒網路時，App 和現在一樣可以在本機使用；連線、登入後補同步。
- 密碼不以明碼出現在任何地方；工作階段可以登出；猜密碼會被鎖。
- 同步的骨架（墓碑、修改時間、游標、合併規則）之後可以直接套用到單字卡等新資料。
- 伺服器端的 SQL 與 API 在 CI 上用單元測試驗證。

**Non-Goals:**

- 同步打勾紀錄以外的資料（單字卡、設定、徽章等還不存在，之後的提案各自加資料表）。
- 多使用者、註冊、忘記密碼、修改密碼（換密碼＝重新產生雜湊、重設機密）。
- 錄音檔同步（ADR-08，只存本機）。
- 登出時清除本機資料（單一使用者，登出只是停止同步）。
- PWA 的 Service Worker 與背景同步（第 1 刀順序 10）。
- Playwright 端到端測試（之後另開提案）。
- 自動在 CI 上套用 D1 遷移（目前的 Cloudflare 權杖只有 Workers 權限，遷移由使用者手動執行）。

## Decisions

### D1 Worker 改用 Hono，API 集中在 createApp

`worker/app.ts` 匯出 `createApp()`，回傳一個 Hono 應用程式，掛上 `/api/health`、`/api/auth/*`、`/api/sync`；`worker/index.ts` 只把請求交給它。測試直接呼叫 `app.request(路徑, 選項, env)`，不需要啟動伺服器。放棄的做法：繼續手寫 `if (url.pathname === ...)`（路由多了難讀，也要自己處理 JSON 與 Cookie）。原本的 `/api/` 範例回應移除，改由 `GET /api/health` 回傳 `{ "ok": true }`。

### D2 密碼雜湊用 PBKDF2-SHA256，格式用冒號分隔

雜湊字串格式為 `pbkdf2-sha256:<次數>:<salt>:<hash>`，次數 100000（Cloudflare Workers 的 Web Crypto 上限），salt 16 bytes、hash 32 bytes，都用 base64url 編碼（不含 `$`、`/`、`+`、`=`，貼進 `.dev.vars` 不會被當成變數展開）。驗證時重新計算並用固定時間比較，格式錯誤一律視為驗證失敗。放棄的做法：bcrypt／argon2（Workers 沒有內建，要額外套件與 WebAssembly）、SHA-256 加鹽一次（太快，容易被暴力破解）。

### D3 工作階段存在 D1，用 HttpOnly Cookie 帶

登入成功產生 32 bytes 的隨機權杖，D1 的 `sessions` 只存權杖的 SHA-256（資料庫外洩也拿不到可用的權杖），有效 30 天。Cookie 名稱 `weg_session`，屬性 `HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=2592000`。登出刪除該筆工作階段並送出過期的 Cookie。放棄的做法：JWT（要再多一個簽章機密，而且無法真正登出）、把權杖存在 localStorage（JavaScript 讀得到，被注入腳本就外洩）。

### D4 登入失敗鎖定

每次密碼錯誤在 `login_failures` 記一筆時間。最近 15 分鐘內累積 5 次失敗時，登入一律回 429，即使這次密碼正確也不檢查；登入成功會清掉所有失敗紀錄。因為只有一個使用者，鎖定是全域的。放棄的做法：依 IP 鎖定（單一使用者時沒有好處，還要處理 IP 標頭）。

### D5 D1 資料表與遷移檔

新增遷移檔 `migrations/0001_auth_and_task_logs.sql`（wrangler 預設的遷移資料夾，不需改 `wrangler.jsonc`）：

- `task_logs`：`id` 主鍵、`date`、`key`、`xp`、`is_minimum`（0／1）、`completed_at`、`updated_at`（ISO 字串）、`deleted`（0／1）、`rev`（伺服器給的遞增版本號，加索引）。
- `sessions`：`token_hash` 主鍵、`created_at`、`expires_at`（毫秒）。
- `login_failures`：自動編號主鍵、`at`（毫秒）。

之後改資料表一律新增下一號遷移檔，不修改已套用的檔案。

### D6 本機資料庫升級到版本 2，取消打勾改成墓碑

Dexie 版本 2：`taskLogs: 'id, date, dirty'`，新增 `meta: 'key'`（存同步游標）。每筆紀錄多 `updatedAt`（ISO 字串）、`deleted`（布林）、`dirty`（0／1，IndexedDB 不能用布林建索引）。升級時，舊紀錄補上 `updatedAt = completedAt`、`deleted = false`、`dirty = 1`，第一次同步就會上傳。

取消打勾不再刪除，而是把紀錄標成 `deleted = true`（墓碑），其他裝置才知道要刪；`listLogs` 只回傳沒刪除的紀錄，所以經驗值與連勝的計算不用改。重新打勾就是把同一筆改回 `deleted = false`。放棄的做法：保留真的刪除、另外記「刪除清單」（兩份資料要一起維護）。

### D7 修改時間只會往前走

每次在本機修改一筆紀錄，`updatedAt` 取「現在」與「這筆原本的 `updatedAt` 加 1 毫秒」兩者較晚的那個（`nextUpdatedAt`）。這保證本機的修改一定比它所根據的版本新，即使裝置時鐘慢了，也不會被伺服器當成舊資料丟掉。

### D8 同步協定：一次請求先推後拉

`POST /api/sync`，請求 `{ since, changes }`：`since` 是上次拿到的游標（整數，第一次為 0），`changes` 是本機 `dirty = 1` 的紀錄（最多 500 筆）。伺服器在同一個批次交易裡：

1. 逐筆 upsert：伺服器沒有這筆，或送來的 `updatedAt` **嚴格較新**才寫入，並給它新的 `rev`（目前最大 `rev` 加 1）；一樣新或較舊就保留伺服器版本。
2. 取回 `rev > since` 的紀錄（依 `rev` 排序，最多 500 筆），回應 `{ cursor, changes, hasMore }`。`cursor` 是這次回傳的最後一筆的 `rev`（沒有紀錄就維持 `since`）；還有更多時 `hasMore = true`，前端以新游標再請求一次，最多連續 20 次。
3. `since` 大於伺服器目前最大的 `rev`（例如伺服器資料重建過）時，視為 `since = 0`，整份重新給。

放棄的做法：推和拉分成兩支 API（多一次請求，還要處理中間失敗的狀態）、用時間戳當游標（同一毫秒的兩筆可能漏掉）。

### D9 本機合併規則

收到伺服器回應後，在一個 Dexie 交易內：

1. 對這次送出的每一筆：本機的 `updatedAt` 仍等於送出時的值，就把 `dirty` 設為 0；送出後又被改過的保持 `dirty = 1`，下次再送。
2. 對伺服器回傳的每一筆（純函式 `mergeRemote(local, remote)` 決定）：本機沒有這筆 → 寫入；本機 `dirty = 0` → 用伺服器版本；本機 `dirty = 1` → 只有伺服器的 `updatedAt` 嚴格較新才用伺服器版本，否則保留本機版本。寫入的伺服器版本 `dirty = 0`。
3. 儲存新游標。

### D10 前端同步用戶端與觸發時機

`src/sync/syncClient.ts` 提供 `syncOnce()`、`login(password)`、`logout()`、`checkSession()`，以參數注入 `fetch` 與資料庫，方便測試。`syncOnce()` 的結果只有四種：`synced`、`unauthorized`（401，要重新登入）、`offline`（`navigator.onLine` 為 false 或 `fetch` 本身丟出錯誤）、`error`（其他 HTTP 錯誤或回應格式不對）。

`src/sync/useSync.ts` 負責觸發：開啟頁面時先查登入狀態，已登入就同步；本機打勾後 30 秒同步一次（30 秒內多次打勾只算一次）；頁面切到背景（`visibilitychange` 變成 hidden）且有未同步的變更時立刻同步；`online` 事件時同步。同一時間只跑一個同步，跑的期間又有觸發就在結束後再跑一次。同步取回了別台裝置的變更時，`remoteVersion` 加 1，今日任務頁據此重新讀取紀錄。

### D11 同步狀態列與登入表單

今日任務頁頂端加 `SyncBar`：

| 狀態 | 顯示文字 | 動作 |
|---|---|---|
| checking | 檢查登入狀態… | 無 |
| logged-out | 未登入，紀錄只存在這台裝置 | 「登入同步」按鈕，展開密碼欄與「登入」按鈕 |
| syncing | 同步中… | 「登出」 |
| synced | 已同步 | 「登出」 |
| offline | 離線中，連線後自動同步 | 「登出」 |
| error | 同步失敗，稍後會再試 | 「登出」 |

登入錯誤訊息：401 →「密碼錯誤」；429 →「嘗試太多次，請 N 分鐘後再試」（N 由 `retryAfterSeconds` 無條件進位成分鐘）；離線 →「目前離線，無法登入」；其他 →「登入失敗，請稍後再試」。

### D12 伺服器端測試用 Node 內建的 SQLite 模擬 D1

`worker/testing/sqliteD1.ts` 用 Node 24 內建的 `node:sqlite` 實作測試會用到的 D1 介面（`prepare`、`bind`、`first`、`all`、`run`、`batch`），測試時先執行遷移檔建立資料表。這樣 SQL 和 API 都能在 CI 上用 Vitest 跑，不需要 Cloudflare 帳號。放棄的做法：`@cloudflare/vitest-pool-workers`（和目前的 Vitest 5 版本相容性未確認，設定也較重；之後若要測 Workers 專屬行為再評估）。

### D13 密碼雜湊產生指令稿

`scripts/hash-password.mjs`：用 `node scripts/hash-password.mjs` 執行，要求輸入兩次密碼（輸入時不顯示），兩次不一致或長度少於 8 個字元就結束並顯示錯誤，成功時只輸出一行雜湊字串。產生方式與 D2 完全相同（共用同一個雜湊模組）。

## Implementation Contract

**行為：**

- 未登入：今日任務頁照常使用，同步狀態列顯示「未登入，紀錄只存在這台裝置」。
- 登入後：本機所有紀錄（含升級前就存在的）上傳；別台裝置的紀錄下載並顯示；之後打勾 30 秒內、切到背景、恢復連線時都會同步。
- 在 A 裝置取消打勾，B 裝置同步後該任務也變成未勾選。

**API（JSON，錯誤回應一律 `{ "error": "<代碼>" }`）：**

| 方法與路徑 | 成功 | 失敗 |
|---|---|---|
| `GET /api/health` | 200 `{ ok: true }` | — |
| `POST /api/auth/login`，`{ password }` | 200 `{ ok: true }`＋Set-Cookie | 400 `invalid_request`；401 `wrong_password`；429 `locked`（另含 `retryAfterSeconds`）；500 `not_configured`（沒有設定機密） |
| `POST /api/auth/logout` | 200 `{ ok: true }`，清除 Cookie（沒登入也回 200） | — |
| `GET /api/auth/session` | 200 `{ loggedIn: true/false }` | — |
| `POST /api/sync`，`{ since, changes }` | 200 `{ cursor, changes, hasMore }` | 401 `unauthorized`；400 `invalid_request` |

**同步紀錄格式（請求與回應相同）：** `{ id, date, key, xp, isMinimum, completedAt, updatedAt, deleted }`。檢查規則：`id` 符合 `YYYY-MM-DD:key` 且日期部分等於 `date`、`key` 由小寫英數與 `-` 組成、`xp` 為 0～1000 的整數、`isMinimum` 與 `deleted` 為布林、`completedAt` 與 `updatedAt` 為可解析的 ISO 時間字串；`since` 為 0 以上的整數；`changes` 為陣列且最多 500 筆。任何一項不符合就整個請求回 400，不寫入任何資料。

**本機資料型別：** `TaskLog` 增加 `updatedAt: string`、`deleted: boolean`；資料庫內的紀錄另有 `dirty: 0 | 1`。

**驗收：**

- `npm test`：密碼雜湊、登入與鎖定、工作階段、同步的檢查與合併、伺服器 upsert 與游標、本機資料庫升級與墓碑、本機合併、同步用戶端的四種結果都有單元測試並通過。
- `npm run lint`、`npm run build` 通過。
- 手動驗收：本機兩個瀏覽器、正式網站上手機與電腦交叉打勾與取消，結果一致（見 tasks 的手動任務）。

**範圍：** 只同步 `taskLogs`；不做註冊、改密碼、多使用者、背景同步、端到端測試、CI 自動遷移。

## Risks / Trade-offs

- [裝置時鐘差很多時，「較新者為準」可能選錯] → D7 讓本機修改一定比它所根據的版本新；單一使用者同時在兩台裝置改同一筆的機率很低。
- [全域鎖定可能被別人故意打錯密碼而鎖住自己] → 只鎖 15 分鐘；網址沒有公開宣傳。
- [墓碑永遠留著，資料會慢慢變多] → 一年最多幾千筆，D1 容量遠遠足夠；之後需要時再加清理規則。
- [忘記套用遠端遷移或設定機密就部署] → 同步會回錯誤，畫面顯示「同步失敗」，本機使用不受影響；手動任務明確要求先遷移、設機密，再 push。
- [`node:sqlite` 和真正的 D1 有差異] → 只使用兩者都支援的 SQLite 語法（upsert、子查詢）；部署後手動驗收再確認一次。
- [Cookie 設了 Secure，本機 http 開發會不會帶不上] → 瀏覽器把 `localhost` 視為安全環境，會送出 Secure Cookie；手動驗收第一步就在本機確認。

## Migration Plan

1. 使用者執行 `node scripts/hash-password.mjs` 產生雜湊，寫進本機 `.dev.vars`，並用 wrangler 設定遠端機密 `APP_PASSWORD_HASH`。
2. 本機與遠端各套用一次遷移：`npx wrangler d1 migrations apply work-eng-game --local`、`--remote`。
3. push 到 main，Actions 部署。
4. 使用者打開網站時，Dexie 自動從版本 1 升級到版本 2，舊紀錄保留並標成待上傳。

回復：Dexie 無法降版，所以前端回復就是再部署一次修正版；D1 新增的資料表留著不影響舊版程式。

## Open Questions

（無）
