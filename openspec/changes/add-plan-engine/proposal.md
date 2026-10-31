## Why

App 的核心是「每天告訴使用者該練什麼」，而這取決於計畫引擎：把不含日期的學習內容（內容包）排進使用者設定的日期區間。第 1 刀其他功能（今日任務頁、打勾與經驗值、同步）都建立在排程結果上，所以先做引擎，並用單元測試確保預設 6 個月的排程和原本的半年計畫文件完全一致。

## What Changes

- 定義內容包格式（TypeScript 型別＋結構檢查）：新手村天數、關卡（建議週數、最少週數、拉長權重）、週主題、每日任務模板、頭目戰日覆寫、輕量日模板。
- 新增計畫引擎純函式：輸入內容包清單與計畫設定（開始日、長度或結束日、是否加新手村、輕量日期區間），輸出每週與每天的排程。
- 新增公開的範例內容包：結構與原計畫相同（新手村 8 天、6 關、26 週），文字改成不含個人資訊的通用版本。
- 新增本機匯出腳本：把原計畫的 Python 資料轉成私人內容包 JSON；私人內容包放在不進版本庫的資料夾。
- 導入 Vitest 單元測試，`npm test` 加進 GitHub Actions 的檢查流程，測試沒過不能部署。

## Non-Goals (optional)

（見 design.md 的 Goals / Non-Goals）

## Capabilities

### New Capabilities

- `content-pack`: 內容包的資料格式與結構檢查規則。目前沒有任何既有規格（`speclink list --specs` 為空），內容格式是全新的契約。
- `plan-scheduling`: 由內容包與計畫設定產生每週、每天排程的規則（長度換算、關卡週數分配、頭目戰週、新手村、輕量日、跨內容包銜接）。目前沒有任何既有規格涵蓋排程行為。

### Modified Capabilities

(none)

## Impact

- Affected specs: `content-pack`（新）、`plan-scheduling`（新）
- Affected code:
  - New: src/plan/types.ts, src/plan/dates.ts, src/plan/validatePack.ts, src/plan/allocateWeeks.ts, src/plan/buildSchedule.ts, src/plan/validatePack.test.ts, src/plan/allocateWeeks.test.ts, src/plan/buildSchedule.test.ts, src/plan/privatePack.test.ts, content/packs/meeting-a2-b1-sample/pack.json, scripts/export_private_pack.py, vitest.config.ts, docs/learning-notes/01-計畫引擎.md
  - Modified: package.json, package-lock.json, tsconfig.app.json, .gitignore, .github/workflows/deploy.yml, docs/專案規範.md
- 相依套件：新增開發用套件 vitest
- 來源：討論 english-quest-app 的結論（第 1 刀）與專案規劃書第 6 節「計畫引擎設計」
