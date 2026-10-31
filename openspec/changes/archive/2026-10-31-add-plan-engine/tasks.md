## 1. 測試環境與 CI（D9）

- [x] 1.1 導入 Vitest（D9 Vitest 用獨立設定檔）：新增開發套件 vitest、獨立設定檔 vitest.config.ts（Node 環境、只收 src 底下的 *.test.ts、不載入 Cloudflare 外掛）、`npm test` 指令；tsconfig.app.json 明確加上 `strict: true` 與 `resolveJsonModule: true`。驗證：`npm test` 能執行並列出測試檔、`npm run lint` 與 `npm run build` 通過。 <!-- speclink-task:tsk_01M691DE28TW3NVRSDS3KZHQRH -->
- [x] 1.2 CI 加入測試關卡：GitHub Actions「檢查」job 在 lint 之後、build 之前執行 `npm test`，任何測試失敗則「部署」不會執行；docs/專案規範.md 第 5 節同步更新並記一筆變更紀錄。驗證：檢視 .github/workflows/deploy.yml 的步驟順序，推送後 Actions 的「檢查」出現 `npm test` 步驟。 <!-- speclink-task:tsk_01M691DE28YSRH6FYG2MB45DV0 -->

## 2. 內容包格式（D1、D8）

- [x] 2.1 日期工具與型別（D1 內容包不含日期、D2 日期用 YYYY-MM-DD 字串並以 UTC 計算）：src/plan/types.ts 定義設計文件 Implementation Contract 中的全部型別與 `PlanError`；src/plan/dates.ts 提供解析與檢查 YYYY-MM-DD、加減天數、星期幾、日期差、區間包含判斷，全部以 UTC 計算。驗證：src/plan/dates.test.ts 涵蓋閏年 2028-02-29、跨年、非法日期字串（2026-13-01、2026-02-30、空字串），並在 `TZ=America/New_York` 與 `TZ=Asia/Taipei` 下結果相同。 <!-- speclink-task:tsk_01M691DE28XMSTA4XXTA6RSC2N -->
- [x] 2.2 實作「內容包結構」與「結構檢查回報錯誤」：src/plan/validatePack.ts 的 `validatePack` 依規格逐項檢查並一次回報所有錯誤。驗證：src/plan/validatePack.test.ts 涵蓋完整內容包通過、規格 Example 表中 7 種違規各自失敗、兩個錯誤同時出現時 `errors` 長度至少為 2。 <!-- speclink-task:tsk_01M691DE28XHVZ4FP1GEGAXB56 -->
- [x] 2.3 建立「公開範例內容包」（D8 公開範例包與私人包分離）：content/packs/meeting-a2-b1-sample/pack.json，新手村 8 天、6 關週數 4、5、4、4、5、4，最少週數 3、4、3、3、4、3，權重 1、1、1、2、2、1，7 個每日模板、星期五與星期六頭目戰覆寫、輕量日模板，文字為通用工程師情境。驗證：測試確認範例包通過 `validatePack`、天數與週數符合規格、所有文字不含公開的通用禁用字詞，且在 content/packs/private/forbidden-terms.json 存在時也不含其中的個人字詞。 <!-- speclink-task:tsk_01M691DE283FWDHTAR87WMQ4ZS -->
- [x] 2.4 實作「私人內容包不進版本庫」：.gitignore 加入 content/packs/private/；新增 scripts/export_private_pack.py，以參數接收原計畫資料檔路徑，輸出 content/packs/private/meeting-a2-b1/pack.json（含原計畫新手村、6 關、26 週主題、每日模板與頭目戰覆寫）。驗證：在本機執行腳本產生檔案、該檔通過 `validatePack`（由 2.3 同一支測試讀取）、`git check-ignore` 確認被排除。 <!-- speclink-task:tsk_01M691DE28JMB3FRZEFHHMM3V1 -->

## 3. 計畫引擎（D3～D7）

- [x] 3.1 實作「內容包週數分配」（D4 跨內容包的週數分配）與「關卡週數拉長與壓縮」（D5 關卡週數分配用最大餘數法加權重）：src/plan/allocateWeeks.ts 的 `allocateWeeks`。驗證：src/plan/allocateWeeks.test.ts 涵蓋規格中兩張 Example 表的每一列（含 `NO_PACKS`、`INVALID_PACK`、`PLAN_TOO_SHORT`），測試用內容包 B 寫在測試檔內。 <!-- speclink-task:tsk_01M691DE28K080X31D5T10RQ1P -->
- [x] 3.2 實作「計畫長度換算」（D3 計畫長度換算）、「開始日必須是星期一」與「週主題對應與頭目戰週」（D6 週主題對應與頭目戰週）：src/plan/buildSchedule.ts 產生 `weeks`、`startDate`、`endDate`、`totalWeeks`。驗證：src/plan/buildSchedule.test.ts 涵蓋長度換算表每一列、`START_NOT_MONDAY`、`INVALID_DATE`、6 個月頭目戰週為 4、9、13、17、22、26 與第 15 週開始日 2027-02-08、3 個一般主題分到 5 週與 3 週的對應結果。 <!-- speclink-task:tsk_01M691DE283YG4K0AFHQDET3FS -->
- [x] 3.3 實作「每日任務產生」、「新手村前置」（D7 新手村排在開始日前、星期六結束）與「輕量日」：`buildSchedule` 產生 `days`。驗證：buildSchedule.test.ts 涵蓋 2026-11-27 頭目戰覆寫與任務 id、新手村 2026-10-24～10-31 共 8 天且 2026-11-01 不在排程、`includeNovice: false` 時沒有新手村日、輕量區間 2027-02-04～02-10 的平日只有輕量任務而週末不變、同一天任務 id 不重複、6 個月正式期共 182 天。 <!-- speclink-task:tsk_01M691DE28FGYQ4WP667T2HDWG -->
- [x] 3.4 驗證「排程是純函式」：深層凍結內容包與設定後連續呼叫 `buildSchedule` 兩次。驗證：buildSchedule.test.ts 中該測試不丟錯且兩次結果 `toEqual`。 <!-- speclink-task:tsk_01M691DE28AZ2WNYFSC2PCGQ93 -->
- [x] 3.5 私人內容包對照原計畫：src/plan/privatePack.test.ts 在 content/packs/private/meeting-a2-b1/pack.json 存在時，以 2026-11-02、6 個月、含新手村排程，確認 26 週的週主題標題依序與私人包一致、頭目戰週與日期和原計畫相同；檔案不存在時整組測試標示為略過。驗證：本機 `npm test` 顯示此檔通過；CI 上顯示略過且整體通過。 <!-- speclink-task:tsk_01M691DE28ZH228P9X3GB7E7RH -->

## 4. 學習筆記與驗收

- [x] 4.1 撰寫學習筆記 docs/learning-notes/01-計畫引擎.md：依學習筆記格式說明純函式、最大餘數法、UTC 日期計算、Vitest 與測試金字塔、公開與私人內容包的取捨，並列出面試可能被問的問題。驗證：內容審查，五個段落齊全且不含個人資訊。 <!-- speclink-task:tsk_01M691DE2849G558V35ZV5E1M3 -->
- [x] [M] 4.2 使用者驗收：在本機執行 `npm test`、`npm run lint`、`npm run build` 全部通過，讀完學習筆記，依專案規範 commit 並 push，確認 GitHub Actions 的檢查（含 `npm test`）與部署都成功。驗證：Actions 頁面該次執行為綠色。 <!-- speclink-task:tsk_01M691DE28GEM12YQKNAXTENT3 -->
