// D10、D11：同步的狀態與觸發時機（開啟頁面、寫入後 30 秒、切到背景、恢復連線、登入、登出）。
// 不依賴 React：狀態變化透過 onStatus 回報，方便在 Node 上測試；useSync 只負責接上 React 與瀏覽器事件
import type { SyncStatus } from './messages'
import { createSyncScheduler, SYNC_DELAY_MS } from './scheduler'
import type { LoginResult, LogoutResult, SyncClient } from './syncClient'

export type SyncControllerDeps = {
  client: Pick<SyncClient, 'syncOnce' | 'login' | 'logout' | 'checkSession'>
  /** 本機是否有未同步的紀錄（切到背景時才決定要不要立刻同步） */
  hasPending: () => Promise<boolean>
  onStatus: (status: SyncStatus) => void
  /** 同步改變了本機紀錄（取回其他裝置的變更），畫面要重新讀取 */
  onRemoteChange: () => void
  delayMs?: number
}

export function createSyncController({ client, hasPending, onStatus, onRemoteChange, delayMs = SYNC_DELAY_MS }: SyncControllerDeps) {
  let loggedIn = false

  const scheduler = createSyncScheduler(async () => {
    if (!loggedIn) return
    onStatus('syncing')
    try {
      const outcome = await client.syncOnce()
      if (outcome.received) onRemoteChange()
      if (outcome.result === 'unauthorized') loggedIn = false
      // 同步途中登出，或工作階段過期：顯示未登入
      onStatus(!loggedIn || outcome.result === 'unauthorized' ? 'logged-out' : outcome.result)
    } catch {
      onStatus('error')
    }
  }, delayMs)

  /** 查詢登入狀態；已登入就同步。離線或失敗時顯示對應狀態，恢復連線時再查一次 */
  async function start(): Promise<void> {
    const session = await client.checkSession()
    if (session === 'logged-in') {
      loggedIn = true
      await scheduler.runNow()
      return
    }
    loggedIn = false
    onStatus(session)
  }

  return {
    start,

    /** 恢復連線：已登入就同步，否則重新查詢登入狀態 */
    handleOnline(): Promise<void> {
      return loggedIn ? scheduler.runNow() : start()
    },

    /** 頁面切到背景：有未同步的紀錄才立刻送出 */
    async handleHidden(): Promise<void> {
      if (!loggedIn) return
      if (await hasPending()) await scheduler.runNow()
    },

    /** 本機寫入成功後呼叫：已登入就排在 30 秒後同步 */
    notifyLocalChange(): void {
      if (loggedIn) scheduler.schedule()
    },

    async login(password: string): Promise<LoginResult> {
      const result = await client.login(password)
      if (result.result === 'ok') {
        loggedIn = true
        await scheduler.runNow()
      }
      return result
    },

    /** 伺服器確認登出才停止同步並顯示未登入；本機紀錄一律保留 */
    async logout(): Promise<LogoutResult> {
      const result = await client.logout()
      if (result !== 'ok') return result
      loggedIn = false
      scheduler.dispose()
      onStatus('logged-out')
      return result
    },

    dispose(): void {
      scheduler.dispose()
    },
  }
}

export type SyncController = ReturnType<typeof createSyncController>
