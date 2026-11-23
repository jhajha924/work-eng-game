// D10：把同步控制器接上 React 狀態與瀏覽器事件；狀態與觸發的邏輯都在 syncController.ts
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CardRepo } from '../cards/cardRepo'
import type { ProgressRepo } from '../progress/progressRepo'
import type { SyncStatus } from './messages'
import { createSyncClient, type LoginResult, type LogoutResult } from './syncClient'
import { createSyncController, type SyncController } from './syncController'

/**
 * getRepo、getCardRepo：共用的本機資料庫（資料庫打不開時會丟出例外，同步就顯示失敗）。
 * remoteVersion：同步改變了本機紀錄就加 1，今日任務頁據此重新讀取。
 */
export function useSync(getRepo: () => ProgressRepo, getCardRepo: () => CardRepo) {
  const [status, setStatus] = useState<SyncStatus>('checking')
  const [remoteVersion, setRemoteVersion] = useState(0)

  const controllerRef = useRef<SyncController | null>(null)
  const controller = useCallback(() => {
    controllerRef.current ??= createSyncController({
      client: createSyncClient({
        repo: getRepo,
        cards: getCardRepo,
        fetch: (...args) => fetch(...args),
        isOnline: () => navigator.onLine,
      }),
      hasPending: async () => {
        const [logs, cards] = await Promise.all([getRepo().pendingChanges(), getCardRepo().pendingChanges()])
        return logs.length + cards.length > 0
      },
      onStatus: setStatus,
      onRemoteChange: () => setRemoteVersion((v) => v + 1),
    })
    return controllerRef.current
  }, [getRepo, getCardRepo])

  useEffect(() => {
    void controller().start()
    const onOnline = () => void controller().handleOnline()
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') controller().handleHidden().catch(() => {})
    }
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisibility)
      controllerRef.current?.dispose()
    }
  }, [controller])

  const notifyLocalChange = useCallback(() => controller().notifyLocalChange(), [controller])
  const login = useCallback((password: string): Promise<LoginResult> => controller().login(password), [controller])
  const logout = useCallback((): Promise<LogoutResult> => controller().logout(), [controller])

  return { status, remoteVersion, notifyLocalChange, login, logout }
}

/** 頁面拿到的同步介面（App 層建立一次，今日任務頁與單字卡頁共用） */
export type SyncApi = ReturnType<typeof useSync>
