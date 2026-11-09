// D10：同步的狀態與觸發時機（開啟頁面、寫入後 30 秒、切到背景、恢復連線）
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ProgressRepo } from '../progress/progressRepo'
import type { SyncStatus } from './messages'
import { createSyncScheduler } from './scheduler'
import { createSyncClient, type LoginResult, type SyncClient } from './syncClient'

/**
 * getRepo：共用的本機資料庫（資料庫打不開時會丟出例外，同步就顯示失敗）。
 * remoteVersion：同步改變了本機紀錄就加 1，今日任務頁據此重新讀取。
 */
export function useSync(getRepo: () => ProgressRepo) {
  const [status, setStatus] = useState<SyncStatus>('checking')
  const [remoteVersion, setRemoteVersion] = useState(0)
  // 登入狀態要在事件處理與排程裡立即讀到，所以用 ref；畫面看的是 status
  const loggedIn = useRef(false)

  const clientRef = useRef<SyncClient | null>(null)
  const client = useCallback(() => {
    clientRef.current ??= createSyncClient({
      repo: getRepo,
      fetch: (...args) => fetch(...args),
      isOnline: () => navigator.onLine,
    })
    return clientRef.current
  }, [getRepo])

  const schedulerRef = useRef<ReturnType<typeof createSyncScheduler> | null>(null)
  const scheduler = useCallback(() => {
    schedulerRef.current ??= createSyncScheduler(async () => {
      if (!loggedIn.current) return
      setStatus('syncing')
      try {
        const outcome = await client().syncOnce()
        if (outcome.received) setRemoteVersion((v) => v + 1)
        if (outcome.result === 'unauthorized') loggedIn.current = false
        // 同步途中登出，或工作階段過期：顯示未登入
        setStatus(!loggedIn.current || outcome.result === 'unauthorized' ? 'logged-out' : outcome.result)
      } catch {
        setStatus('error')
      }
    })
    return schedulerRef.current
  }, [client])

  /** 查詢登入狀態；已登入就同步。離線或失敗時顯示對應狀態，恢復連線時再查一次 */
  const checkAndSync = useCallback(async () => {
    const session = await client().checkSession()
    if (session === 'logged-in') {
      loggedIn.current = true
      await scheduler().runNow()
      return
    }
    loggedIn.current = false
    setStatus(session === 'logged-out' ? 'logged-out' : session)
  }, [client, scheduler])

  useEffect(() => {
    void checkAndSync()

    const onOnline = () => {
      if (loggedIn.current) void scheduler().runNow()
      else void checkAndSync()
    }
    const onVisibility = () => {
      if (document.visibilityState !== 'hidden' || !loggedIn.current) return
      // 有未同步的紀錄才在切到背景時立刻送出
      getRepo()
        .pendingChanges()
        .then((pending) => {
          if (pending.length > 0) void scheduler().runNow()
        })
        .catch(() => {})
    }
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisibility)
      schedulerRef.current?.dispose()
    }
  }, [checkAndSync, getRepo, scheduler])

  /** 本機寫入成功後呼叫：已登入就排在 30 秒後同步 */
  const notifyLocalChange = useCallback(() => {
    if (loggedIn.current) scheduler().schedule()
  }, [scheduler])

  const login = useCallback(
    async (password: string): Promise<LoginResult> => {
      const result = await client().login(password)
      if (result.result === 'ok') {
        loggedIn.current = true
        await scheduler().runNow()
      }
      return result
    },
    [client, scheduler],
  )

  /** 登出只停止同步，本機紀錄保留 */
  const logout = useCallback(async () => {
    loggedIn.current = false
    schedulerRef.current?.dispose()
    await client().logout()
    setStatus('logged-out')
  }, [client])

  return { status, remoteVersion, notifyLocalChange, login, logout }
}
