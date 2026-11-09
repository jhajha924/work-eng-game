import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSyncScheduler, SYNC_DELAY_MS } from './scheduler'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('同步時機', () => {
  it('連續打勾只同步一次：最後一次打勾 30 秒後', async () => {
    const run = vi.fn(async () => {})
    const scheduler = createSyncScheduler(run)
    scheduler.schedule()
    await vi.advanceTimersByTimeAsync(5_000)
    scheduler.schedule()
    await vi.advanceTimersByTimeAsync(5_000)
    scheduler.schedule()
    await vi.advanceTimersByTimeAsync(SYNC_DELAY_MS - 1)
    expect(run).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('同步期間再觸發：結束後再跑一次，不會同時進行', async () => {
    let active = 0
    let maxActive = 0
    let finish: () => void = () => {}
    const run = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          active += 1
          maxActive = Math.max(maxActive, active)
          finish = () => {
            active -= 1
            resolve()
          }
        }),
    )
    const scheduler = createSyncScheduler(run)
    const first = scheduler.runNow()
    void scheduler.runNow() // 例如收到 online 事件
    void scheduler.runNow() // 再觸發一次也只補跑一次
    expect(run).toHaveBeenCalledTimes(1)
    finish()
    await vi.advanceTimersByTimeAsync(0)
    expect(run).toHaveBeenCalledTimes(2)
    finish()
    await first
    expect(run).toHaveBeenCalledTimes(2)
    expect(maxActive).toBe(1)
  })

  it('runNow 取消等待中的延遲同步；run 丟出例外也不會卡住', async () => {
    const run = vi.fn(async () => {
      throw new Error('boom')
    })
    const scheduler = createSyncScheduler(run)
    scheduler.schedule()
    await scheduler.runNow()
    await vi.advanceTimersByTimeAsync(SYNC_DELAY_MS)
    expect(run).toHaveBeenCalledTimes(1)
    await scheduler.runNow()
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('dispose 取消等待中的同步', async () => {
    const run = vi.fn(async () => {})
    const scheduler = createSyncScheduler(run)
    scheduler.schedule()
    scheduler.dispose()
    await vi.advanceTimersByTimeAsync(SYNC_DELAY_MS)
    expect(run).not.toHaveBeenCalled()
  })
})
