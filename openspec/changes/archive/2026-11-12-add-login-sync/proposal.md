## Why

目前打勾紀錄只存在單一瀏覽器的 IndexedDB：手機和電腦各記各的，清除瀏覽器資料就全部遺失。討論 english-quest-app 已決定第 1 刀就做 D1 跨裝置同步、以個人密碼登入（ADR-02）。這是規劃書第 1 刀建議順序的第 5 項；後面的單字卡、徽章都會產生要同步的資料，先把同步的骨架與登入做好，之後只要加資料表。

## What Changes

- Worker 改用 Hono，新增 `/api/auth/login`、`/api/auth/logout`、`/api/auth/session`、`/api/sync` 四支 API。
- 單一使用者密碼登入：密碼以 PBKDF2 雜湊存在 Worker 機密 `APP_PASSWORD_HASH`；登入成功發一個存在 D1 的工作階段，以 HttpOnly Cookie 帶回；連續失敗 5 次鎖 15 分鐘。
- 新增產生密碼雜湊的指令稿，讓使用者自己產生雜湊、存成機密（規劃書第 12 節第 6 步）。
- D1 新增遷移檔：`task_logs`（打勾紀錄）、`sessions`（工作階段）、`login_failures`（登入失敗紀錄）。
- 本機資料庫升級到版本 2：紀錄多 `updatedAt`、`deleted`、`dirty` 欄位，另加 `meta` 資料表存同步游標。**取消打勾改成「標記刪除」**（墓碑），才能把刪除同步到其他裝置；讀取與計算一律排除已刪除的紀錄。
- 同步：前端把未同步的變更批次送到 `/api/sync`，並取回其他裝置的變更；兩邊都用「`updatedAt` 較新者為準」。觸發時機：開啟頁面、打勾後 30 秒、切到背景、恢復連線。
- 今日任務頁加一條同步狀態列：顯示「未登入／同步中／已同步／離線，稍後同步／同步失敗」，未登入時可輸入密碼登入，已登入可登出。不登入也能照常在本機使用。

## Capabilities

### New Capabilities

- `app-auth`: 單一使用者的密碼登入、工作階段與登入失敗鎖定。掃描現有規格（content-pack、plan-scheduling、daily-progress、today-page）都只描述前端本機行為，沒有任何伺服器端驗證的規格。
- `cloud-sync`: 打勾紀錄在本機與 D1 之間的雙向批次同步、衝突規則與觸發時機。daily-progress 的 Purpose 明確把跨裝置同步排除在範圍外，所以要新開一份。

### Modified Capabilities

- `daily-progress`: 「打勾紀錄存在本機」加上同步用欄位；「取消打勾」與「最低限度日」的取消改成標記刪除，讀取時排除。
- `today-page`: 新增同步狀態列與登入／登出的畫面需求。

## Impact

- Affected specs: app-auth（新）、cloud-sync（新）、daily-progress（修改）、today-page（修改）
- Affected code:
  - New: worker/app.ts, worker/env.ts, worker/sync/twoDevices.test.ts, tsconfig.worker-test.json, worker/auth/password.ts, worker/auth/password.test.ts, worker/auth/authRepo.ts, worker/auth/authRepo.test.ts, worker/auth/routes.ts, worker/sync/syncRepo.ts, worker/sync/syncRepo.test.ts, worker/sync/routes.ts, worker/sync/validate.ts, worker/sync/validate.test.ts, worker/app.test.ts, worker/testing/sqliteD1.ts, migrations/0001_auth_and_task_logs.sql, scripts/hash-password.mjs, src/sync/merge.ts, src/sync/merge.test.ts, src/sync/syncClient.ts, src/sync/syncClient.test.ts, src/sync/useSync.ts, src/sync/scheduler.ts, src/sync/scheduler.test.ts, src/sync/messages.ts, src/sync/messages.test.ts, src/app/SyncBar.tsx, src/app/SyncBar.css, docs/learning-notes/03-登入與跨裝置同步.md
  - Modified: worker/index.ts, src/progress/db.ts, src/progress/types.ts, src/progress/logs.ts, src/progress/logs.test.ts, src/progress/progressRepo.ts, src/progress/progressRepo.test.ts, src/app/useTodayProgress.ts, src/app/TodayPage.tsx, vitest.config.ts, tsconfig.json, tsconfig.worker.json, package.json, package-lock.json, docs/專案規範.md
- 依賴：新增 `hono`。
- 外部設定（使用者手動）：產生密碼雜湊並設定 Worker 機密 `APP_PASSWORD_HASH`、本機 `.dev.vars`、對遠端 D1 套用遷移。
