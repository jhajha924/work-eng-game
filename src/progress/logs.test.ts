import { describe, expect, it } from 'vitest'
import { minimumLogFor, minimumLogId, nextUpdatedAt, taskLogFor, withLog, withoutLog } from './logs'

const now = new Date('2026-11-02T12:00:00Z')
const task = { id: '2026-11-02:new-words', date: '2026-11-02', key: 'new-words' }

describe('紀錄的產生與更新', () => {
  it('任務紀錄與最低限度日紀錄的欄位', () => {
    const stamp = now.toISOString()
    expect(taskLogFor(task, 10, now)).toEqual({
      ...task, xp: 10, isMinimum: false, completedAt: stamp, updatedAt: stamp, deleted: false,
    })
    expect(minimumLogId('2026-11-03')).toBe('2026-11-03:minimum')
    expect(minimumLogFor('2026-11-03', now)).toEqual({
      id: '2026-11-03:minimum', date: '2026-11-03', key: 'minimum', xp: 5, isMinimum: true,
      completedAt: stamp, updatedAt: stamp, deleted: false,
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

describe('修改時間只會往前走', () => {
  it('裝置時鐘倒退：取原本的修改時間加 1 毫秒', () => {
    expect(nextUpdatedAt('2026-11-03T10:00:00.000Z', new Date('2026-11-03T09:00:00.000Z'))).toBe('2026-11-03T10:00:00.001Z')
  })

  it('時鐘正常：取現在；沒有原本的修改時間也取現在', () => {
    const later = new Date('2026-11-03T10:05:00.000Z')
    expect(nextUpdatedAt('2026-11-03T10:00:00.000Z', later)).toBe(later.toISOString())
    expect(nextUpdatedAt(undefined, later)).toBe(later.toISOString())
  })

  it('再打勾時傳入原本的修改時間', () => {
    const log = taskLogFor(task, 10, new Date('2026-11-03T09:00:00.000Z'), '2026-11-03T10:00:00.000Z')
    expect(log.updatedAt).toBe('2026-11-03T10:00:00.001Z')
    expect(log.completedAt).toBe('2026-11-03T09:00:00.000Z')
  })
})
