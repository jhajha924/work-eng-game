// D8：今日任務頁的狀態都在這裡；畫面元件只負責顯示
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ScheduledTask } from '../plan/types'
import { createDb } from '../progress/db'
import { minimumLogFor, minimumLogId, taskLogFor, withLog, withoutLog } from '../progress/logs'
import { createProgressRepo, type ProgressRepo } from '../progress/progressRepo'
import { computeStats } from '../progress/stats'
import { findToday, localToday } from '../progress/today'
import type { TaskLog } from '../progress/types'
import { taskXp } from '../progress/xp'
import { defaultPack, defaultSchedule } from './defaultPlan'

export const DB_ERROR_MESSAGE = '無法存取本機資料庫，打勾紀錄無法儲存'

/** 畫面要顯示的任務：排程任務＋經驗值＋是否已完成 */
export type TodayTask = ScheduledTask & { xp: number; done: boolean }

// 整個 App 共用一個資料庫連線
let repo: ProgressRepo | null = null
function getRepo(): ProgressRepo {
  repo ??= createProgressRepo(createDb())
  return repo
}

export function useTodayProgress(now?: Date) {
  // 今天只在打開頁面時決定一次；跨午夜要重新整理才會換日
  const [today] = useState(() => localToday(now ?? new Date()))
  const [logs, setLogs] = useState<TaskLog[]>([])
  const [loading, setLoading] = useState(true)
  // 寫入中：畫面停用打勾框與按鈕，避免在上一次寫入完成前用舊狀態再點一次
  const [busy, setBusy] = useState(false)
  // 同步鎖：state 要等重繪才更新，ref 立刻生效，連點時第二下一定會被擋下
  const writing = useRef(false)
  // 畫面上的紀錄是否等於資料庫的完整內容（初次載入成功後才是 true）
  const synced = useRef(false)
  const [error, setError] = useState<string | null>(null)

  // 第一次載入：getRepo() 也放進 promise 鏈，建立資料庫時同步出錯也會進 catch；元件卸載後不再設定狀態
  useEffect(() => {
    let cancelled = false
    Promise.resolve()
      .then(() => getRepo().listLogs())
      .then((loaded) => {
        if (cancelled) return
        synced.current = true
        setLogs(loaded)
      })
      .catch(() => {
        if (!cancelled) setError(DB_ERROR_MESSAGE)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const view = useMemo(() => findToday(defaultSchedule, defaultPack, today), [today])
  const stats = useMemo(() => computeStats(defaultSchedule, logs, today), [logs, today])
  const doneIds = useMemo(() => new Set(logs.filter((l) => l.date === today).map((l) => l.id)), [logs, today])
  const minimumOn = doneIds.has(minimumLogId(today))

  const tasks: TodayTask[] = useMemo(
    () =>
      view.status === 'active'
        ? view.day.tasks.map((t) => ({ ...t, xp: taskXp(defaultPack, t.key), done: doneIds.has(t.id) }))
        : [],
    [view, doneIds],
  )
  const noviceDescription =
    view.status === 'active' && view.noviceIndex !== null ? (defaultPack.novice[view.noviceIndex - 1]?.description ?? null) : null

  /**
   * 執行一次寫入。
   * 畫面紀錄已和資料庫同步：成功後直接更新畫面（不靠重新讀取，避免讀取失敗時畫面與資料庫不一致）。
   * 初次載入失敗過（畫面紀錄不完整）：成功後補讀一次完整紀錄，讀到了才清掉錯誤訊息。
   */
  const write = useCallback(
    async (save: () => Promise<void>, update: (prev: TaskLog[]) => TaskLog[]) => {
      if (writing.current) return
      writing.current = true
      setBusy(true)
      try {
        await save()
        if (synced.current) {
          setLogs(update)
        } else {
          setLogs(await getRepo().listLogs())
          synced.current = true
        }
        setError(null)
      } catch {
        setError(DB_ERROR_MESSAGE)
      } finally {
        writing.current = false
        setBusy(false)
      }
    },
    [],
  )

  const toggleTask = useCallback(
    (task: TodayTask) => {
      const at = new Date()
      const ref = { id: task.id, date: today, key: task.key }
      return write(
        () => getRepo().setTaskDone(ref, task.xp, !task.done, at),
        (prev) => (task.done ? withoutLog(prev, task.id) : withLog(prev, taskLogFor(ref, task.xp, at))),
      )
    },
    [today, write],
  )

  const toggleMinimum = useCallback(() => {
    const at = new Date()
    return write(
      () => getRepo().setMinimumDay(today, !minimumOn, at),
      (prev) => (minimumOn ? withoutLog(prev, minimumLogId(today)) : withLog(prev, minimumLogFor(today, at))),
    )
  }, [minimumOn, today, write])

  return { today, loading, busy, error, view, tasks, noviceDescription, stats, minimumOn, toggleTask, toggleMinimum }
}
