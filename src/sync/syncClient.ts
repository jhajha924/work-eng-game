// D10：前端同步用戶端。fetch、連線狀態、資料庫都由參數注入，方便測試
import type { ProgressRepo } from '../progress/progressRepo'
import { isValidSyncRecord } from '../../worker/sync/validate'
import type { SyncRecord } from './merge'

/** 一次最多送出的紀錄數（和伺服器的上限相同） */
export const BATCH_SIZE = 500
/** 單次 syncOnce 最多發出的請求數 */
export const MAX_REQUESTS = 20

export type SyncResult = 'synced' | 'unauthorized' | 'offline' | 'error'
/** received：這次是否有本機紀錄被伺服器紀錄改變（畫面要重新讀取） */
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
  fetch: typeof fetch
  isOnline: () => boolean
}

type SyncResponse = { cursor: number; changes: SyncRecord[]; hasMore: boolean }

function isSyncResponse(v: unknown): v is SyncResponse {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Record<string, unknown>
  return Number.isInteger(r.cursor) && Array.isArray(r.changes) && typeof r.hasMore === 'boolean'
}

export function createSyncClient({ repo: getRepo, fetch, isOnline }: SyncClientDeps) {
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

  async function syncOnce(): Promise<SyncOutcome> {
    if (!isOnline()) return { result: 'offline', received: false }
    const repo = getRepo()
    // 伺服器只要有一筆不合格就整批拒收；不合格的留在本機（仍是未同步），不送出，以免同步永遠失敗
    let pending = (await repo.pendingChanges()).filter(isValidSyncRecord)
    let cursor = await repo.getCursor()
    let received = false

    for (let i = 0; i < MAX_REQUESTS; i++) {
      const batch = pending.slice(0, BATCH_SIZE)
      const res = await request('/api/sync', { method: 'POST', body: JSON.stringify({ since: cursor, changes: batch }) })
      if (!res) return { result: 'offline', received }
      if (res.status === 401) return { result: 'unauthorized', received }
      if (!res.ok) return { result: 'error', received }
      const body: unknown = await res.json().catch(() => null)
      if (!isSyncResponse(body)) return { result: 'error', received }

      // 成功的請求才寫入本機：清 dirty、合併、存游標
      const changed = await repo.applySyncResult(batch, body.changes, body.cursor)
      received ||= changed > 0
      cursor = body.cursor
      pending = pending.slice(BATCH_SIZE)
      if (pending.length === 0 && !body.hasMore) break
    }
    // 超過請求上限時，剩下的留到下一次同步
    return { result: 'synced', received }
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
