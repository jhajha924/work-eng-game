// D3、D4：工作階段與登入失敗紀錄的資料存取；時間（毫秒）一律由參數傳入，方便測試
export const SESSION_DAYS = 30
export const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000
export const LOCK_WINDOW_MS = 15 * 60 * 1000
export const MAX_FAILURES = 5

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** 權杖的 SHA-256 十六進位字串；資料庫只存這個，外洩也拿不到可用的權杖 */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** 建立工作階段，回傳要放進 Cookie 的權杖原文 */
export async function createSession(db: D1Database, now: number): Promise<string> {
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)))
  await db
    .prepare('INSERT INTO sessions (token_hash, created_at, expires_at) VALUES (?, ?, ?)')
    .bind(await hashToken(token), now, now + SESSION_MS)
    .run()
  return token
}

export async function hasValidSession(db: D1Database, token: string, now: number): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 AS ok FROM sessions WHERE token_hash = ? AND expires_at > ?')
    .bind(await hashToken(token), now)
    .first<{ ok: number }>()
  return row !== null
}

export async function deleteSession(db: D1Database, token: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await hashToken(token)).run()
}

export async function deleteExpiredSessions(db: D1Database, now: number): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now).run()
}

export async function recordFailure(db: D1Database, now: number): Promise<void> {
  await db.prepare('INSERT INTO login_failures (at) VALUES (?)').bind(now).run()
}

export async function clearFailures(db: D1Database): Promise<void> {
  await db.prepare('DELETE FROM login_failures').run()
}

export type LockStatus = { locked: false } | { locked: true; retryAfterSeconds: number }

/**
 * 最近 15 分鐘內失敗 5 次以上就鎖定。
 * 鎖定時不再檢查密碼也不再記錄失敗，所以視窗內最多 5 筆，最早那筆過期就解鎖。
 */
export async function lockStatus(db: D1Database, now: number): Promise<LockStatus> {
  const row = await db
    .prepare('SELECT COUNT(*) AS count, MIN(at) AS earliest FROM login_failures WHERE at > ?')
    .bind(now - LOCK_WINDOW_MS)
    .first<{ count: number; earliest: number | null }>()
  if (!row || row.count < MAX_FAILURES || row.earliest === null) return { locked: false }
  return { locked: true, retryAfterSeconds: Math.ceil((row.earliest + LOCK_WINDOW_MS - now) / 1000) }
}

/**
 * 檢查密碼前先占一個嘗試名額：視窗內失敗未滿 5 次才寫入一筆失敗紀錄（同一個 SQL 敘述，不會被同時的請求插隊）。
 * 先「讀次數、驗密碼、再記失敗」的話，同時送出的請求都會讀到未滿 5 次而全部驗證密碼，鎖定就被繞過。
 * 占到名額回 unlocked；密碼正確時由呼叫端清除失敗紀錄（連同這一筆）。
 */
export async function claimAttempt(db: D1Database, now: number): Promise<LockStatus> {
  const result = await db
    .prepare('INSERT INTO login_failures (at) SELECT ? WHERE (SELECT COUNT(*) FROM login_failures WHERE at > ?) < ?')
    .bind(now, now - LOCK_WINDOW_MS, MAX_FAILURES)
    .run()
  if (result.meta.changes > 0) return { locked: false }
  const lock = await lockStatus(db, now)
  // 沒占到名額卻查到未鎖定：中間剛好有人登入成功清掉紀錄，回報 1 秒後再試即可
  return lock.locked ? lock : { locked: true, retryAfterSeconds: 1 }
}
