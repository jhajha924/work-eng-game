## Context

`add-plan-engine` 已提供 `buildSchedule`（內容包＋計畫設定 → 每天的任務），但網站仍是範本示範頁。規劃書的經驗值規則：單字卡清空 10、跟讀 10、AI 會話 20、錄音自評 15、讀完文章 15、頭目戰 100、連續 7 天 +50；FR-04 要求「只做 5 分鐘單字卡」也算打卡、連勝不中斷。資料模型草案有 `task_logs`（日期、任務代號、完成時間、是否最低限度日、經驗值）。

限制：單一使用者、手機優先、目前沒有登入與同步（之後的提案），資料先只存在這台裝置。

## Goals / Non-Goals

**Goals:**

- 打開網站就看到今天的任務，可以打勾，重新整理後紀錄還在。
- 經驗值、連勝天數、連勝獎勵都由打勾紀錄重新計算，規則可以用單元測試鎖住。
- 導入 IndexedDB 作為本機資料庫，資料表設計能銜接之後的 D1 同步。

**Non-Goals:**

- 建立／修改計畫的設定畫面（FR-01），本提案固定使用預設計畫。
- 跨裝置同步、登入（FR-15），以及同步需要的 `updatedAt`、`deviceId`、軟刪除。
- 單字卡、內容庫、跟讀、錄音等任務本身的功能畫面；本提案只負責「打勾」。
- 動畫（第 1 刀順序 9）、PWA 離線快取與加到主畫面（順序 10）。
- 匯入私人內容包；網站顯示的是公開範例包。
- 輕量週設定畫面（FR-06），預設計畫不含輕量區間。

## Decisions

### D1 經驗值寫在內容包的任務模板

每個任務模板加上 `xp`；新手村沿用既有的每日 `xp`。範例包數值：新字 10、跟讀 10、精讀 15、AI 會話 20、錄音 15、複習日 10、AI 角色扮演 20、頭目戰 100、頭目戰補考 15、輕量日 10。放棄的做法：在程式裡寫死「key → 經驗值」對照表（換內容包就要改程式，違反 D1「內容與規則分離」的精神）。

### D2 經驗值與連勝由紀錄重新計算，不另外儲存

資料庫只存「哪個任務在何時完成」；總經驗值、連勝天數、連勝獎勵每次由紀錄＋排程算出。放棄的做法：另存累計經驗值（取消打勾、補打勾、之後同步合併時容易算錯而且不一致）。

### D3 打卡日與連勝規則

- 打卡日：當天至少完成一個任務，或標記為最低限度日。
- 只看排程裡的日子；不在排程中的日子（例如新手村結束後的星期日休息日）不算中斷也不算天數。
- 連勝天數：今天已打卡 → 算到今天為止的連續打卡天數；今天還沒打卡 → 算到前一個排程日為止（今天還有機會，不先歸零）。

### D4 連勝獎勵

每一段連續打卡中，第 7、14、21……個打卡日各加 50 經驗值；中斷後重新計數。

### D5 最低限度日

「今天只做 5 分鐘單字卡」存成一筆特殊紀錄：`key` 為 `minimum`、`id` 為 `日期:minimum`、5 經驗值。再按一次取消。放棄的做法：另開資料表（多一張表，計算時還要合併）。

### D6 Dexie 單一資料表 taskLogs

資料庫名稱 `work-eng-game`，版本 1，資料表 `taskLogs`，主鍵為任務 `id`，索引 `date`。打勾＝寫入（同一個 id 重複寫入只會覆蓋），取消打勾＝刪除。同步提案會再加 `updatedAt`、`deviceId` 與軟刪除（Dexie 以資料庫版本升級處理）。放棄的做法：直接用原生 IndexedDB API（樣板程式多、容易寫錯）、localStorage（之後還要搬家）。

### D7 今天的日期依裝置本機時區

`localToday(now)` 用裝置本機時區的年月日組成 YYYY-MM-DD。使用者在台灣晚上 11 點打勾，算的是台灣的今天。放棄的做法：用 UTC 日期（台灣早上 8 點前會算成前一天）。

### D8 畫面狀態集中在一個 hook

`useTodayProgress` 負責讀資料庫、算今天的檢視與統計、提供打勾函式；`TodayPage` 只負責顯示。純計算全部放在 `src/progress/` 的純函式裡測試。

### D9 預設計畫集中在一個模組

`src/app/defaultPlan.ts` 匯出範例內容包與預設設定（2026-11-02、6 個月、含新手村、無輕量區間）。之後的設定畫面只要換掉這個來源。

## Implementation Contract

**內容包（修改）：** `DayTemplate = { key: string; title: string; minutes: number; xp: number }`，`xp` 為大於等於 0 的整數。

**進度型別與函式（src/progress/）：**

```ts
type TaskLog = { id: string; date: string; key: string; xp: number; isMinimum: boolean; completedAt: string } // completedAt 為 ISO 時間字串
const MINIMUM_KEY = 'minimum'; const MINIMUM_XP = 5

taskXp(pack: ContentPack, key: string): number
// 新手村 key「novice-N」→ pack.novice[N-1].xp；其他 key → dailyTemplates／bossDayOverrides／lightDayTemplate 中同 key 的 xp；minimum → 5；找不到 → 0

localToday(now: Date): string

type TodayView =
  | { status: 'before'; firstDate: string }
  | { status: 'after'; endDate: string }
  | { status: 'rest' }
  | { status: 'active'; day: ScheduledDay; dayNumber: number; week: ScheduledWeek | null; levelName: string | null; noviceIndex: number | null }
findToday(schedule: Schedule, pack: ContentPack, today: string): TodayView
// dayNumber：今天是排程中的第幾天（從 1 起算，新手村第一天為 1）

computeStats(schedule: Schedule, logs: TaskLog[], today: string): { totalXp: number; streak: number; checkedInToday: boolean }
```

**資料庫（src/progress/progressRepo.ts）：**

```ts
listLogs(): Promise<TaskLog[]>
setTaskDone(task: { id: string; date: string; key: string }, xp: number, done: boolean, now: Date): Promise<void>
setMinimumDay(date: string, on: boolean, now: Date): Promise<void>
```

**畫面：** `useTodayProgress(now?: Date)` 回傳 `{ loading, error, view, stats, doneIds, toggleTask, toggleMinimum }`。`TodayPage` 依 `view.status` 顯示四種狀態；資料庫開啟或讀寫失敗時顯示錯誤訊息「無法存取本機資料庫，打勾紀錄無法儲存」，不顯示空白頁。

**驗收：**

- `npm test` 通過，涵蓋 `taskXp`、`localToday`、`findToday`、`computeStats` 的規格範例，以及 `progressRepo` 在 fake-indexeddb 上的寫入、覆蓋、刪除、最低限度日。
- `npm run lint`、`npm run build` 通過。
- 手動：開發伺服器與正式網站上，打勾後重新整理仍在、經驗值與連勝即時更新、最低限度按鈕可切換、手機寬度 360px 沒有橫向捲動。

**範圍：** 只做經驗值欄位、進度計算、本機資料庫、今日任務頁。不做設定畫面、同步、任務內容功能、動畫、PWA。

## Risks / Trade-offs

- [瀏覽器清除網站資料或無痕模式 → 紀錄遺失] → 之後的 D1 同步提案解決；本提案在資料庫無法使用時明確顯示錯誤。
- [網站目前顯示公開範例包，不是使用者的私人內容] → 匯入私人包是之後的提案；範例包的結構和任務與私人包相同，打勾與經驗值行為一致。
- [取消打勾直接刪除，之後同步無法知道「刪過」] → 同步提案以資料庫版本升級改成軟刪除。
- [跨午夜時畫面不會自動換日] → 重新整理或重新打開才換日；之後的提醒通知提案再處理。
