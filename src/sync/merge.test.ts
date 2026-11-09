import { describe, expect, it } from 'vitest'
import { mergeRemote, toSyncRecord, type StoredLog, type SyncRecord } from './merge'

const base: SyncRecord = {
  id: '2026-11-02:new-words', date: '2026-11-02', key: 'new-words', xp: 10, isMinimum: false,
  completedAt: '2026-11-02T09:00:00.000Z', updatedAt: '2026-11-02T10:00:00.000Z', deleted: false,
}
const at = (time: string) => `2026-11-02T${time}:00.000Z`
const local = (dirty: 0 | 1, time: string): StoredLog => ({ ...base, updatedAt: at(time), dirty })
const remote = (time: string): SyncRecord => ({ ...base, updatedAt: at(time), deleted: true })

describe('本機合併規則', () => {
  // 規格 Example「本機合併」
  it.each([
    { name: '沒有', l: undefined, r: '10:00', takeRemote: true },
    { name: 'dirty 0', l: local(0, '10:05'), r: '10:00', takeRemote: true },
    { name: 'dirty 1、伺服器較舊', l: local(1, '10:05'), r: '10:00', takeRemote: false },
    { name: 'dirty 1、一樣新', l: local(1, '10:05'), r: '10:05', takeRemote: false },
    { name: 'dirty 1、伺服器較新', l: local(1, '10:05'), r: '10:06', takeRemote: true },
  ])('本機 $name、伺服器 $r', ({ l, r, takeRemote }) => {
    const result = mergeRemote(l, remote(r))
    if (takeRemote) expect(result).toEqual({ ...remote(r), dirty: 0 })
    else expect(result).toBeNull()
  })

  it('toSyncRecord 去掉 dirty', () => {
    expect(toSyncRecord({ ...base, dirty: 1 })).toEqual(base)
  })
})
