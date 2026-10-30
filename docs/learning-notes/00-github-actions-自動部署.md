# GitHub Actions 自動部署

## 這段在做什麼（三句話以內）

每次把程式推上 GitHub，GitHub 會租一台 Linux 機器，自動跑「安裝套件 → 程式碼檢查 → 型別檢查與打包」。
三項都通過、而且推的是 `main` 分支，才會再把網站部署到 Cloudflare。
任何一步失敗就停下來，壞掉的程式不會上線。

## 關鍵觀念

| 名詞 | 意思 | 在 `.github/workflows/deploy.yml` 的哪裡 |
|---|---|---|
| 工作流程（workflow） | 一份自動化流程的設定檔，放在 `.github/workflows/` 底下，GitHub 會自動讀取 | 整個檔案 |
| 觸發條件（`on`） | 什麼事件發生時要跑 | `push`、`pull_request`、`workflow_dispatch`（手動） |
| 工作（job） | 一組在同一台機器上依序執行的步驟；不同 job 預設在不同機器上**同時**跑 | `check`、`deploy` |
| `needs` | 讓 job 有先後順序：`deploy` 要等 `check` 成功才開始 | `deploy.needs: check` |
| `if` | 條件成立才跑 | 只有 push 到 `main` 才部署 |
| 步驟（step） | `uses` 是用別人寫好的動作；`run` 是執行一行指令 | `actions/checkout`、`npm ci`… |
| Secrets | 存在 GitHub 版本庫設定裡的機密，log 中會自動遮成 `***`，程式碼裡看不到 | `${{ secrets.CLOUDFLARE_API_TOKEN }}` |
| `npm ci` | 和 `npm install` 不同：**完全照 `package-lock.json` 安裝**，鎖定檔和 `package.json` 不一致就直接失敗，適合自動化 | 兩個 job 都有 |
| `concurrency` | 同一個群組同時只跑一個；連續推兩次時，舊的部署會被取消，避免舊版本蓋掉新版本 | `deploy` |
| `permissions` | 這個流程拿到的 GitHub 權限，預設只給讀取，降低風險 | 檔案上方 |

## 為什麼這樣設計，放棄了什麼

| 決定 | 理由 | 放棄的選項 |
|---|---|---|
| 直接 `npx wrangler deploy` | 和本機部署指令完全一樣，好理解、好除錯 | Cloudflare 官方的 `wrangler-action`：多一層包裝，出錯時比較難看懂 |
| `deploy` 自己重新 `npm run build` | 設定簡單 | 把 `check` 的打包結果傳給 `deploy`（artifact）：省約 30 秒，但設定多一倍 |
| API 權杖只給「部署 Worker＋D1」的權限 | 權杖外洩時傷害最小（最小權限原則） | 用個人全域金鑰：權限太大 |
| 帳號 ID 也放 Secrets | 統一管理；不寫死在 `wrangler.jsonc` | 寫進 `wrangler.jsonc`：帳號 ID 不算機密，但沒必要公開 |
| 先不跑測試 | 目前還沒有測試；第 1 刀寫計畫引擎時加入 `npm test` | — |
| Node 24 | 和本機版本一致，避免「本機可以、CI 失敗」 | Node 22 |

**順手修正：** `npm run lint` 原本會對自動產生的 `worker-configuration.d.ts` 報 2 個警告，所以在 `eslint.config.js` 把它加進忽略清單。自動產生的檔案不該由人修，也就不該被檢查。

## 面試可能被問的問題與回答方向

| 問題 | 回答方向 |
|---|---|
| 你的 CI/CD 流程是什麼？ | push 後 GitHub Actions 跑 lint、型別檢查、建置；只有 main 而且檢查通過才部署到 Cloudflare Workers。測試沒過不能部署 |
| 機密怎麼管理？ | API 權杖存在 GitHub Secrets，只給部署需要的最小權限；應用程式的機密存在 Worker secret；版本庫裡沒有任何機密 |
| `npm ci` 和 `npm install` 差在哪？ | `ci` 嚴格照鎖定檔、會先刪掉 `node_modules`，結果可重現；`install` 可能更新鎖定檔 |
| 連續推兩次會怎樣？ | `concurrency` 會取消還沒完成的舊部署，確保最後上線的是最新版本 |
| 為什麼 CI 用的 Node 版本要固定？ | 和本機一致，避免環境差異造成「我電腦可以跑」的問題 |

## 我自己的補充（你寫）

-
