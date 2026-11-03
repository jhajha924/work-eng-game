## Purpose

單一使用者的密碼登入：密碼雜湊的格式與驗證、登入與登出 API、存在 D1 的工作階段、登入失敗鎖定，以及產生密碼雜湊的指令稿；同步資料本身的規則不在本規格範圍。

## ADDED Requirements

### Requirement: 密碼雜湊格式與驗證

密碼雜湊字串 SHALL 為 `pbkdf2-sha256:<次數>:<salt>:<hash>` 格式，次數為 100000，salt 為 16 bytes、hash 為 32 bytes，皆以 base64url 編碼。`verifyPassword(password, stored)` SHALL 以相同的 salt 與次數重新計算，並以固定時間比較；`stored` 格式不正確時 MUST 回傳 false 而不是丟出錯誤。

#### Scenario: 驗證結果

- **WHEN** 以 `hashPassword("correct horse")` 產生的雜湊驗證不同的輸入
- **THEN** 結果如下表

##### Example: 密碼驗證

| 輸入密碼 | 儲存的雜湊 | 結果 |
| --- | --- | --- |
| correct horse | 由 correct horse 產生 | true |
| correct horsE | 由 correct horse 產生 | false |
| （空字串） | 由 correct horse 產生 | false |
| correct horse | `not-a-hash` | false |
| correct horse | `pbkdf2-sha256:abc:x:y` | false |

#### Scenario: 同一個密碼每次雜湊都不同

- **WHEN** 對同一個密碼呼叫兩次 `hashPassword`
- **THEN** 兩個雜湊字串不同（salt 不同），且都能通過 `verifyPassword`

### Requirement: 登入

`POST /api/auth/login` 接收 `{ "password": string }`。密碼正確時 SHALL 建立工作階段並回 200 `{ "ok": true }`，以 `Set-Cookie` 送出名為 `weg_session` 的 Cookie，屬性 MUST 包含 `HttpOnly`、`Secure`、`SameSite=Strict`、`Path=/api`、`Max-Age=2592000`。密碼錯誤 SHALL 回 401 `{ "error": "wrong_password" }` 並記錄一次失敗。請求本文不是 JSON 或沒有字串 `password` 時 SHALL 回 400 `{ "error": "invalid_request" }`。Worker 沒有設定機密 `APP_PASSWORD_HASH` 時 SHALL 回 500 `{ "error": "not_configured" }`。

#### Scenario: 登入成功

- **WHEN** 以正確密碼呼叫登入
- **THEN** 回應 200，`Set-Cookie` 含 `weg_session=` 與上述五個屬性，D1 的 `sessions` 多一筆

#### Scenario: 密碼錯誤

- **WHEN** 以錯誤密碼呼叫登入
- **THEN** 回應 401 `wrong_password`，不送出 Cookie，`login_failures` 多一筆

#### Scenario: 請求格式錯誤

- **WHEN** 請求本文為 `{ "pwd": "x" }`
- **THEN** 回應 400 `invalid_request`，不記錄失敗

#### Scenario: 沒有設定機密

- **WHEN** Worker 環境沒有 `APP_PASSWORD_HASH`，呼叫登入
- **THEN** 回應 500 `not_configured`

### Requirement: 登入失敗鎖定

最近 15 分鐘內累積 5 次以上登入失敗時，登入 SHALL 回 429 `{ "error": "locked", "retryAfterSeconds": N }`，且 MUST NOT 檢查這次的密碼；`N` 為最早一次仍在 15 分鐘內的失敗距離解鎖的秒數（無條件進位）。登入成功 SHALL 清除所有失敗紀錄。

#### Scenario: 第 6 次被鎖

- **WHEN** 10:00 起連續 5 次密碼錯誤，10:05 以正確密碼登入
- **THEN** 回應 429 `locked`，不建立工作階段

#### Scenario: 15 分鐘後解鎖

- **WHEN** 10:00～10:01 連續 5 次密碼錯誤，10:16 以正確密碼登入
- **THEN** 回應 200，失敗紀錄被清空

#### Scenario: 失敗次數未滿

- **WHEN** 連續 4 次密碼錯誤後以正確密碼登入
- **THEN** 回應 200

### Requirement: 工作階段

登入成功 SHALL 產生 32 bytes 的隨機權杖放進 Cookie，D1 的 `sessions` 只存權杖的 SHA-256 十六進位字串與到期時間（建立後 30 天），MUST NOT 儲存權杖原文。`GET /api/auth/session` SHALL 回 200 `{ "loggedIn": true }`（Cookie 對應到未到期的工作階段）或 `{ "loggedIn": false }`（沒有 Cookie、找不到或已到期）。登入時 SHALL 刪除已到期的工作階段。

#### Scenario: 查詢登入狀態

- **WHEN** 分別以登入取得的 Cookie、隨便的 Cookie、不帶 Cookie、以及 31 天前取得的 Cookie 查詢
- **THEN** 只有第一種回 `loggedIn: true`，其餘回 `loggedIn: false`

#### Scenario: 資料庫只存雜湊

- **WHEN** 登入成功後讀取 `sessions` 資料表
- **THEN** `token_hash` 等於 Cookie 權杖的 SHA-256，資料表中找不到權杖原文

### Requirement: 登出

`POST /api/auth/logout` SHALL 刪除 Cookie 對應的工作階段，並送出 `Max-Age=0` 的 `weg_session` Cookie 清除瀏覽器端；沒有登入時也 SHALL 回 200 `{ "ok": true }`。

#### Scenario: 登出後失效

- **WHEN** 登入後登出，再用原本的 Cookie 查詢登入狀態
- **THEN** 回 `loggedIn: false`

### Requirement: 需要登入的 API

`/api/sync` SHALL 只接受帶有有效工作階段的請求；沒有 Cookie、工作階段不存在或已到期時 SHALL 回 401 `{ "error": "unauthorized" }`，且 MUST NOT 讀寫任何同步資料。

#### Scenario: 未登入同步

- **WHEN** 不帶 Cookie 呼叫 `POST /api/sync`
- **THEN** 回應 401 `unauthorized`，`task_logs` 沒有任何變化

### Requirement: 產生密碼雜湊的指令稿

`node scripts/hash-password.mjs` SHALL 要求輸入兩次密碼且輸入內容不顯示在畫面上；兩次不一致或長度少於 8 個字元時 SHALL 顯示錯誤並以非 0 結束碼結束；成功時 SHALL 只在標準輸出印出一行符合本規格格式的雜湊字串。指令稿 MUST 使用和 Worker 相同的雜湊模組。

#### Scenario: 產生的雜湊可以登入

- **WHEN** 以指令稿為密碼 `my-test-pass` 產生雜湊，並設為 `APP_PASSWORD_HASH`
- **THEN** 以 `my-test-pass` 登入回 200

#### Scenario: 兩次輸入不一致

- **WHEN** 第一次輸入 `abcdefgh`、第二次輸入 `abcdefgx`
- **THEN** 顯示「兩次輸入的密碼不一致」，結束碼非 0，沒有輸出雜湊
