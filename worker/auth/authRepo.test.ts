import { beforeEach, describe, expect, it } from 'vitest'
import { createTestD1, type TestD1 } from '../testing/sqliteD1'
import {
  clearFailures, createSession, deleteExpiredSessions, deleteSession, hashToken, hasValidSession,
  lockStatus, recordFailure, SESSION_MS,
} from './authRepo'

const at = (time: string) => Date.parse(`2026-11-03T${time}:00Z`)
let db: TestD1

beforeEach(() => {
  db = createTestD1()
})

describe('工作階段', () => {
  it('資料庫只存雜湊', async () => {
    const token = await createSession(db, at('10:00'))
    const rows = db.sqlite.prepare('SELECT * FROM sessions').all() as { token_hash: string; expires_at: number }[]
    expect(rows).toHaveLength(1)
    expect(rows[0].token_hash).toBe(await hashToken(token))
    expect(JSON.stringify(rows)).not.toContain(token)
    expect(rows[0].expires_at).toBe(at('10:00') + SESSION_MS)
  })

  it('到期判斷、登出、清除過期', async () => {
    const token = await createSession(db, at('10:00'))
    expect(await hasValidSession(db, token, at('10:01'))).toBe(true)
    expect(await hasValidSession(db, 'random', at('10:01'))).toBe(false)
    expect(await hasValidSession(db, token, at('10:00') + SESSION_MS)).toBe(false)

    await deleteExpiredSessions(db, at('10:00') + SESSION_MS)
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM sessions').get()).toEqual({ n: 0 })

    const other = await createSession(db, at('11:00'))
    await deleteSession(db, other)
    expect(await hasValidSession(db, other, at('11:01'))).toBe(false)
  })
})

describe('登入失敗鎖定', () => {
  async function failFiveTimes(times: string[]) {
    for (const time of times) await recordFailure(db, at(time))
  }

  it('第 6 次被鎖：10:00 起 5 次失敗，10:05 仍鎖定，還要等 10 分鐘', async () => {
    await failFiveTimes(['10:00', '10:00', '10:00', '10:00', '10:00'])
    expect(await lockStatus(db, at('10:05'))).toEqual({ locked: true, retryAfterSeconds: 600 })
  })

  it('15 分鐘後解鎖', async () => {
    await failFiveTimes(['10:00', '10:00', '10:01', '10:01', '10:01'])
    expect(await lockStatus(db, at('10:16'))).toEqual({ locked: false })
  })

  it('失敗次數未滿', async () => {
    await failFiveTimes(['10:00', '10:00', '10:00', '10:00'])
    expect(await lockStatus(db, at('10:01'))).toEqual({ locked: false })
  })

  it('解鎖秒數無條件進位', async () => {
    await failFiveTimes(['10:00', '10:00', '10:00', '10:00', '10:00'])
    expect(await lockStatus(db, at('10:00') + 1)).toEqual({ locked: true, retryAfterSeconds: 900 })
  })

  it('清除失敗紀錄', async () => {
    await failFiveTimes(['10:00', '10:00', '10:00', '10:00', '10:00'])
    await clearFailures(db)
    expect(await lockStatus(db, at('10:01'))).toEqual({ locked: false })
  })
})
