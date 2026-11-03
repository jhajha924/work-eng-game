import { describe, expect, it } from 'vitest'
import { minimumLogFor, minimumLogId, taskLogFor, withLog, withoutLog } from './logs'

const now = new Date('2026-11-02T12:00:00Z')
const task = { id: '2026-11-02:new-words', date: '2026-11-02', key: 'new-words' }

describe('紀錄的產生與更新', () => {
  it('任務紀錄與最低限度日紀錄的欄位', () => {
    expect(taskLogFor(task, 10, now)).toEqual({ ...task, xp: 10, isMinimum: false, completedAt: now.toISOString() })
    expect(minimumLogId('2026-11-03')).toBe('2026-11-03:minimum')
    expect(minimumLogFor('2026-11-03', now)).toEqual({
      id: '2026-11-03:minimum', date: '2026-11-03', key: 'minimum', xp: 5, isMinimum: true, completedAt: now.toISOString(),
    })
  })

  it('withLog 覆蓋同 id、withoutLog 移除，且都不改動原陣列', () => {
    const original = [taskLogFor(task, 10, now)]
    const replaced = withLog(original, taskLogFor(task, 10, new Date('2026-11-02T13:00:00Z')))
    expect(replaced).toHaveLength(1)
    expect(replaced[0].completedAt).toBe('2026-11-02T13:00:00.000Z')
    expect(withoutLog(replaced, task.id)).toEqual([])
    expect(original[0].completedAt).toBe(now.toISOString())
  })
})
