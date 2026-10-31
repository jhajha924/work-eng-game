# Work Eng Game

遊戲化英文學習 PWA：照學習計畫每天告訴使用者該練什麼，整合單字卡（FSRS）、跟讀、錄音、AI 會話與進度追蹤。

- 線上網址：https://work-eng-game.jhajhar924.workers.dev
- 技術：Vite＋React＋TypeScript（前端）、Hono＋Cloudflare Worker＋D1（後端）、GitHub Actions（CI/CD）

## 必讀規範

**所有程式碼、commit 與審查都以 [docs/專案規範.md](docs/專案規範.md) 為準**（語言、Git 身分與 commit 格式、Cloudflare 規則、品質關卡）。審查 Pull Request 時請逐項對照。

## 開發方式

- 帳號、git、部署操作由專案擁有者親自執行；AI 只說明要執行的指令與原因，不代為 commit 或 push。
- AI 撰寫程式碼與測試；每個任務在 `docs/learning-notes/` 附一份學習筆記（做什麼、關鍵觀念、設計取捨、面試問題）。
- 寫進版本庫的內容（含 `openspec/` 的提案與規格）都會公開，不可包含真實 email、工作帳號或公司名稱。

## Speclink

本專案用 Speclink 做規格驅動開發（SDD）：規格在 `openspec/specs/`，變更提案在 `openspec/changes/`，討論紀錄在 `openspec/discussions/`。

| 情境 | 指令 |
|---|---|
| 需求還模糊，要先討論 | `/speclink-discuss` |
| 規劃、提案、設計一個變更 | `/speclink-propose`（可用 `--from-discussion <名稱>` 從討論產生） |
| 任務可以開始實作，或接續做到一半的變更 | `/speclink-apply` |
| 實作中需求改變 | `/speclink-ingest` |
| 實作完成 | `/speclink-archive`（之前可選擇跑 `/speclink-review`、`/speclink-verify`） |
| 只 commit 某個變更的檔案 | `/speclink-commit` |

流程：discuss（選用）→ propose → apply ⇄ ingest → archive
