// D10：前端同步用戶端。fetch、連線狀態、資料庫都由參數注入，方便測試
import { isValidCardState } from '../../worker/cards/validate'
import { isValidSyncRecord } from '../../worker/sync/validate'
import type { CardRepo } from '../cards/cardRepo'
import type { CardState } from '../cards/types'
import type { ProgressRepo } from '../progress/progressRepo'
import type { TaskLog } from '../progress/types'

/** 一次最多送出的紀錄數（和伺服器的上限相同） */
export const BATCH_SIZE = 500
/** 單次 syncOnce 中，每種資料最多發出的請求數 */
export const MAX_REQUESTS = 20

export type SyncResult = 'synced' | 'unauthorized' | 'offline' | 'error'
/** received：這次是否有本機紀錄或卡片狀態被伺服器資料改變（畫面要重新讀取） */
export type SyncOutcome = { result: SyncResult; received: boolean }

export type LoginResult =
  | { result: 'ok' }
  | { result: 'wrong_password' }
  | { result: 'locked'; retryAfterSeconds: number }
  | { result: 'offline' }
  | { result: 'error' }

export type SessionResult = 'logged-in' | 'logged-out' | 'offline' | 'error'
export type LogoutResult = 'ok' | 'offline' | 'error'

export type SyncClientDeps = {
  /** 每次使用時才取得資料庫；資料庫打不開時例外發生在 syncOnce 裡，由呼叫端處理 */
  repo: () => ProgressRepo
  /** 卡片狀態的資料庫（同一個本機資料庫） */
  cards: () => CardRepo
  fetch: typeof fetch
  isOnline: () => boolean
}

type SyncResponse<T> = { cursor: number; changes: T[]; hasMore: boolean }

/** 一種要同步的資料：API 路徑、本機的讀寫、伺服器的單筆規則（打勾紀錄與卡片狀態共用同一套流程） */
type Collection<T> = {
  path: string
  pendingChanges(): Promise<T[]>
  getCursor(): Promise<number>
  applySyncResult(sent: T[], remote: T[], cursor: number): Promise<number>
  isValid(record: T): boolean
}

function isSyncResponse<T>(v: unknown): v is SyncResponse<T> {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Record<string, unknown>
  return Number.isInteger(r.cursor) && Array.isArray(r.changes) && typeof r.hasMore === 'boolean'
}

/** 本機是否有未同步的打勾紀錄或卡片狀態（切到背景時決定要不要立刻同步） */
export async function hasPendingChanges(repo: ProgressRepo, cards: CardRepo): Promise<boolean> {
  const [logs, states] = await Promise.all([repo.pendingChanges(), cards.pendingChanges()])
  return logs.length + states.length > 0
}

export function createSyncClient({ repo: getRepo, cards: getCards, fetch, isOnline }: SyncClientDeps) {
  /** 送出 JSON；網路錯誤（fetch 丟出例外）回傳 null */
  async function request(path: string, init: RequestInit = {}): Promise<Response | null> {
    try {
      // 用型別斷言：worker 測試以 Workers 的型別編譯本檔，那裡的 RequestInit 沒有 credentials
      const options = {
        ...init,
        credentials: 'same-origin',
        headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
      } as RequestInit
      return await fetch(path, options)
    } catch {
      return null
    }
  }

  /** 同步一種資料：分批送出、hasMore 時續傳；失敗的那次請求不改本機 */
  async function syncCollection<T>(c: Collection<T>): Promise<SyncOutcome> {
    // 伺服器只要有一筆不合格就整批拒收；不合格的留在本機（仍是未同步），不送出，以免同步永遠失敗
    let pending = (await c.pendingChanges()).filter((r) => c.isValid(r))
    let cursor = await c.getCursor()
    let received = false

    for (let i = 0; i < MAX_REQUESTS; i++) {
      const batch = pending.slice(0, BATCH_SIZE)
      const res = await request(c.path, { method: 'POST', body: JSON.stringify({ since: cursor, changes: batch }) })
      if (!res) return { result: 'offline', received }
      if (res.status === 401) return { result: 'unauthorized', received }
      if (!res.ok) return { result: 'error', received }
      const body: unknown = await res.json().catch(() => null)
      if (!isSyncResponse<T>(body)) return { result: 'error', received }

      // 成功的請求才寫入本機：清 dirty、合併、存游標
      const changed = await c.applySyncResult(batch, body.changes, body.cursor)
      received ||= changed > 0
      cursor = body.cursor
      pending = pending.slice(BATCH_SIZE)
      if (pending.length === 0 && !body.hasMore) break
    }
    // 超過請求上限時，剩下的留到下一次同步
    return { result: 'synced', received }
  }

  /**
   * 先同步打勾紀錄，成功後再同步卡片狀態；任一階段失敗就以那個結果結束。
   * 卡片階段丟出例外（例如資料庫錯誤）時回報 error，但保留打勾紀錄階段的 received，畫面才會重新讀取。
   */
  async function syncOnce(): Promise<SyncOutcome> {
    if (!isOnline()) return { result: 'offline', received: false }
    const logs = await syncCollection<TaskLog>({ ...getRepo(), path: '/api/sync', isValid: isValidSyncRecord })
    if (logs.result !== 'synced') return logs
    try {
      const states = await syncCollection<CardState>({ ...getCards(), path: '/api/sync/cards', isValid: isValidCardState })
      return { result: states.result, received: logs.received || states.received }
    } catch {
      return { result: 'error', received: logs.received }
    }
  }

  async function login(password: string): Promise<LoginResult> {
    if (!isOnline()) return { result: 'offline' }
    const res = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ password }) })
    if (!res) return { result: 'offline' }
    if (res.ok) return { result: 'ok' }
    if (res.status === 401) return { result: 'wrong_password' }
    if (res.status === 429) {
      const body = (await res.json().catch(() => null)) as { retryAfterSeconds?: unknown } | null
      const seconds = body?.retryAfterSeconds
      return { result: 'locked', retryAfterSeconds: typeof seconds === 'number' ? seconds : 15 * 60 }
    }
    return { result: 'error' }
  }

  /** 伺服器確認登出才算登出；沒連上時 Cookie 和工作階段都還在，下次開頁會自動登入 */
  async function logout(): Promise<LogoutResult> {
    if (!isOnline()) return 'offline'
    const res = await request('/api/auth/logout', { method: 'POST' })
    if (!res) return 'offline'
    return res.ok ? 'ok' : 'error'
  }

  async function checkSession(): Promise<SessionResult> {
    if (!isOnline()) return 'offline'
    const res = await request('/api/auth/session')
    if (!res) return 'offline'
    if (!res.ok) return 'error'
    const body = (await res.json().catch(() => null)) as { loggedIn?: unknown } | null
    if (typeof body?.loggedIn !== 'boolean') return 'error'
    return body.loggedIn ? 'logged-in' : 'logged-out'
  }

  return { syncOnce, login, logout, checkSession }
}

export type SyncClient = ReturnType<typeof createSyncClient>
