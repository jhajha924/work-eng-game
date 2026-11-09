// D10：同步的觸發排程（不依賴 React，方便用假計時器測試）
// - schedule()：延遲執行；延遲期間再呼叫就重新計時，多次寫入只同步一次
// - runNow()：立刻執行
// - 同一時間只跑一個；執行中又被觸發，就在這次結束後再跑一次

export const SYNC_DELAY_MS = 30_000

export type SyncScheduler = {
  schedule(): void
  runNow(): Promise<void>
  dispose(): void
}

export function createSyncScheduler(run: () => Promise<void>, delayMs: number = SYNC_DELAY_MS): SyncScheduler {
  let timer: ReturnType<typeof setTimeout> | undefined
  let running: Promise<void> | null = null
  let rerun = false

  function clearTimer() {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }

  async function loop() {
    do {
      rerun = false
      try {
        await run()
      } catch {
        // run 自己負責回報錯誤；這裡只確保排程不會因例外而卡住
      }
    } while (rerun)
    running = null
  }

  function runNow(): Promise<void> {
    clearTimer()
    if (running) {
      rerun = true
      return running
    }
    running = loop()
    return running
  }

  return {
    schedule() {
      clearTimer()
      timer = setTimeout(() => {
        timer = undefined
        void runNow()
      }, delayMs)
    },
    runNow,
    dispose: clearTimer,
  }
}
