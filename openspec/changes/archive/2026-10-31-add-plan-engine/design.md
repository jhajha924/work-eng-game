## Context

環境建置已完成（Vite＋React＋TypeScript、Cloudflare Worker＋D1、GitHub Actions 自動部署），但還沒有任何功能程式碼，也沒有測試框架。學習內容目前寫在原計畫的 Python 腳本裡（新手村 8 天、6 關、26 週、每日模板），日期寫死在 2026-11-02 開始。

規劃書第 6 節定下「內容包 × 日期區間」的方向；本設計把它落成可測試的純函式。限制：版本庫公開，原計畫含個人資訊，不能直接放進版本庫。

## Goals / Non-Goals

**Goals:**

- 定義內容包格式與結構檢查，讓之後新增第二內容包時不需要改引擎。
- 計畫引擎以純函式產生排程：同樣輸入永遠得到同樣輸出，方便單元測試。
- 預設設定（2026-11-02 開始、6 個月、含新手村）的排程，週主題與日期和原計畫完全一致。
- 導入 Vitest，並讓 CI 在測試失敗時不部署。

**Non-Goals:**

- 畫面：今日任務頁、打勾、經驗值（下一個提案）。
- 儲存：本機資料庫、D1 同步、計畫設定的保存（之後的提案）。
- 延長計畫與計畫版本（FR-05），另開提案；本提案只保證引擎的分配規則能接上第二內容包。
- 單字、句型、文章、提示詞、評分表、徽章的資料格式與轉換，留給各自的功能提案。
- 第二內容包（B1→B2）的實際內容（第 3 刀）；測試只用一個最小的假內容包驗證銜接。

## Decisions

### D1 內容包不含日期

內容包只描述「第幾關、第幾週練什麼、每天做什麼」，日期全部由計畫設定加上引擎計算。放棄的做法：把日期寫在內容裡（延長就得整份重做）。

### D2 日期用 YYYY-MM-DD 字串並以 UTC 計算

所有日期在介面上都是 `YYYY-MM-DD` 字串；內部轉成 UTC 午夜的毫秒數做加減，避免台灣時區與夏令時間造成的差一天錯誤。放棄的做法：直接用 `Date` 物件傳遞（時區不明確）、引入日期套件（這個範圍用不到）。

### D3 計畫長度換算

月數換週數：6、9、12、18 個月分別對應 26、39、52、78 週（月數 × 13 ÷ 3）。自訂結束日：週數＝（結束日 − 開始日 ＋ 1 天）÷ 7 取整數，不足一週的尾巴不排；實際結束日＝開始日 ＋ 週數 × 7 − 1 天。開始日必須是星期一，因為每日模板以「週的第幾天」對應，原計畫的週也從星期一開始。

### D4 跨內容包的週數分配

依內容包順序分配，剩餘週數記為 R：

1. 若 R ≤ 本包建議週數，或本包是最後一包，或 R − 本包建議週數 < 下一包最少週數 → 本包拿走全部 R（必要時拉長或壓縮），結束。
2. 否則本包拿建議週數，R 扣掉後換下一包。

只有一包時，9 個月會把第一包拉長到 39 週；有第二包時，12 個月是 26＋26。規劃書第 6.3 節「9 個月約 30＋9 週」是估計值，依本規則改為：若剩下的 13 週不夠第二包的最少週數，就全部給第一包。

### D5 關卡週數分配用最大餘數法加權重

- 拉長：多出的週數 E 依各關 `stretchWeight` 按比例分配，先取整數部分，剩下的週數依小數部分由大到小補；小數相同時，權重高的先拿，再相同則關卡順序在前的先拿。
- 壓縮：少掉的週數 D 依各關可壓縮量（建議週數 − 最少週數）按比例扣除，用同樣的最大餘數法；小數相同時，權重低的先扣，再相同則關卡順序在後的先扣。
- D 大於所有關卡可壓縮量的總和 → 錯誤「計畫太短」。

放棄的做法：平均分配（無法讓「技術表達」「寫作與面試」多練）、手動指定每種長度的週數表（每加一種長度就要改內容）。

### D6 週主題對應與頭目戰週

每關最後一週固定是頭目戰週，使用該關的頭目週主題。其餘 N 週對應 T 個一般週主題：第 j 週（從 0 起算）涵蓋主題索引 `floor(j×T÷N)` 到 `max(floor(j×T÷N)+1, floor((j+1)×T÷N))`（不含尾端）。N ≥ T 時某些主題會重複一週（加練）；N < T 時一週會合併多個主題。不會有主題被跳過。

### D7 新手村排在開始日前、星期六結束

新手村的天數由內容包決定，最後一天是開始日前的星期六（開始日前一天的星期日休息），和原計畫 10/24～10/31、11/01 休息、11/02 開始一致。

### D8 公開範例包與私人包分離

版本庫只放範例內容包 `meeting-a2-b1-sample`：結構和原計畫相同，文字改成不含真實姓名、公司、數據、轉職相關內容的通用版本。原計畫由本機腳本轉成私人內容包，放在 `.gitignore` 排除的資料夾；之後由 App 的匯入功能載入（另一個提案）。

### D9 Vitest 用獨立設定檔

測試設定放在獨立的 Vitest 設定檔，只跑 Node 環境的純函式測試，不載入 Cloudflare 的 Vite 外掛（外掛會啟動 Worker 執行環境，單元測試用不到也會變慢）。

## Implementation Contract

**介面（src/plan/types.ts）：**

```ts
type DayTemplate = { key: string; title: string; minutes: number };
type WeekTheme = { title: string; focus: string; vocabCategory: string };
type Level = {
  id: string; name: string; icon: string; goal: string;
  minWeeks: number;            // 2 ≤ minWeeks ≤ weeks.length
  stretchWeight: number;       // > 0
  weeks: WeekTheme[];          // 建議週數 = weeks.length；最後一個是頭目戰週
};
type NoviceDay = { title: string; description: string; xp: number; icon: string };
type ContentPack = {
  id: string; name: string; version: number;
  novice: NoviceDay[];                         // 可為空陣列
  levels: Level[];                             // 至少 1 關
  dailyTemplates: DayTemplate[];               // 恰好 7 個，索引 0 = 星期一
  bossDayOverrides: Record<string, DayTemplate>; // 鍵為 "0"～"6"
  lightDayTemplate: DayTemplate;
};
type PlanSettings = {
  startDate: string;                           // YYYY-MM-DD，星期一
  length: { months: 6 | 9 | 12 | 18 } | { endDate: string };
  includeNovice: boolean;
  lightRanges: { start: string; end: string }[]; // 含頭尾
};
```

**函式：**

- `validatePack(pack: unknown): { ok: true } | { ok: false; errors: string[] }`：回傳所有違規，不在第一個錯誤就停。
- `allocateWeeks(packs: ContentPack[], totalWeeks: number): { packId: string; levelId: string; weeks: number }[]`：依 D4、D5 分配。
- `buildSchedule(packs: ContentPack[], settings: PlanSettings): Schedule`，Schedule 為：

```ts
type ScheduledTask = { id: string; key: string; title: string; minutes: number }; // id = `${date}:${key}`
type ScheduledWeek = {
  index: number; startDate: string; packId: string; levelId: string;
  levelWeek: number; themes: WeekTheme[]; isBoss: boolean;
};
type ScheduledDay = {
  date: string; kind: 'novice' | 'main'; weekIndex: number | null;
  tasks: ScheduledTask[]; isLight: boolean;
};
type Schedule = { startDate: string; endDate: string; totalWeeks: number; weeks: ScheduledWeek[]; days: ScheduledDay[] };
```

**每日任務：** 一般日用 `dailyTemplates[offset]`；頭目戰週且 `bossDayOverrides[offset]` 存在時用覆寫；星期一到星期五（offset 0～4）落在任一輕量區間內時，任務只有 `lightDayTemplate`，且 `isLight = true`（輕量優先於頭目戰覆寫）。新手村每天一個任務，`key` 為 `novice-<第幾天>`，分鐘數固定 30。

**錯誤：** 引擎丟出 `PlanError`，帶 `code`：`NO_PACKS`、`INVALID_PACK`、`INVALID_DATE`、`START_NOT_MONDAY`、`END_BEFORE_START`、`PLAN_TOO_SHORT`。

**驗收：**

- `npm test` 全部通過；`npm run lint`、`npm run build` 通過。
- 範例包＋2026-11-02、6 個月、含新手村：26 週、頭目戰週為第 4、9、13、17、22、26 週、結束日 2027-05-02、新手村 2026-10-24～2026-10-31。
- 本機有私人內容包時，同設定下 26 週的週主題標題依序和原計畫相同（CI 上沒有私人包，此測試自動略過）。
- GitHub Actions 的「檢查」包含 `npm test` 步驟。

**範圍：** 只做內容包格式、範例包、私人包匯出腳本、引擎純函式、測試與 CI。不做畫面、儲存、延長計畫。

## Risks / Trade-offs

- [範例包和私人包結構不同步] → 私人包也通過同一個 `validatePack`，並有私人包專屬測試。
- [開始日限定星期一，使用者想從週三開始] → 之後的設定畫面自動對齊到下一個星期一並提示；引擎保持簡單。
- [9 個月的分配和規劃書估計值不同] → 規則寫進規格與測試，規劃書的數字只是估計。
- [輕量日優先於頭目戰日，頭目戰可能落空] → 頭目戰星期六（offset 5）的補考日不受輕量影響，仍可完成。
