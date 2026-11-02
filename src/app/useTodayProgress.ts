// D8：今日任務頁的狀態都在這裡；畫面元件只負責顯示
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ScheduledTask } from '../plan/types'
import { createDb } from '../progress/db'
import { createProgressRepo, type ProgressRepo } from '../progress/progressRepo'
import { computeStats } from '../progress/stats'
import { findToday, localToday } from '../progress/today'
import type { TaskLog } from '../progress/types'
import { MINIMUM_KEY, taskXp } from '../progress/xp'
import { defaultPack, defaultSchedule } from './defaultPlan'

export const DB_ERROR_MESSAGE = '無法存取本機資料庫，打勾紀錄無法儲存'

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
  const [error, setError] = useState<string | null>(null)

  // 打勾後重新讀取紀錄
  const reload = useCallback(async () => {
    setLogs(await getRepo().listLogs())
    setError(null)
  }, [])

  // 第一次載入：狀態只在非同步結果回來時設定；元件卸載後不再設定
  useEffect(() => {
    let cancelled = false
    getRepo()
      .listLogs()
      .then((loaded) => {
        if (!cancelled) setLogs(loaded)
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
  const minimumOn = doneIds.has(`${today}:${MINIMUM_KEY}`)

  const toggleTask = useCallback(
    async (task: ScheduledTask) => {
      try {
        await getRepo().setTaskDone(
          { id: task.id, date: today, key: task.key },
          taskXp(defaultPack, task.key),
          !doneIds.has(task.id),
          new Date(),
        )
        await reload()
      } catch {
        setError(DB_ERROR_MESSAGE)
      }
    },
    [doneIds, reload, today],
  )

  const toggleMinimum = useCallback(async () => {
    try {
      await getRepo().setMinimumDay(today, !minimumOn, new Date())
      await reload()
    } catch {
      setError(DB_ERROR_MESSAGE)
    }
  }, [minimumOn, reload, today])

  return { today, loading, error, view, stats, doneIds, minimumOn, toggleTask, toggleMinimum }
}
