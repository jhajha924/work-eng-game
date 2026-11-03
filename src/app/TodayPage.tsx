// 今日任務頁：只負責顯示，狀態與動作都來自 useTodayProgress
import { weekdayIndex } from '../plan/dates'
import type { TodayView } from '../progress/today'
import { MINIMUM_XP } from '../progress/xp'
import { useTodayProgress } from './useTodayProgress'
import './TodayPage.css'

const WEEKDAYS = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日']

function formatDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return `${y} 年 ${m} 月 ${d} 日（${WEEKDAYS[weekdayIndex(date)]}）`
}

/** 計畫進度那一行：新手村第幾天，或第幾週與關卡 */
function progressLabel(view: Extract<TodayView, { status: 'active' }>): string {
  if (view.noviceIndex !== null) return `第 ${view.dayNumber} 天｜新手村第 ${view.noviceIndex} 天`
  return `第 ${view.dayNumber} 天｜第 ${view.week?.index} 週・${view.levelName}`
}

export function TodayPage() {
  const { today, loading, busy, error, view, tasks, noviceDescription, stats, minimumOn, toggleTask, toggleMinimum } =
    useTodayProgress()
  // 載入中或寫入中都停用，避免用舊狀態連點
  const disabled = loading || busy

  return (
    <main className="today">
      <header className="today-header">
        <p className="today-app">Work Eng Game</p>
        <h1 className="today-date">{formatDate(today)}</h1>
      </header>

      <section className="today-stats" aria-label="進度">
        <div className="stat">
          <span className="stat-value">{stats.totalXp}</span>
          <span className="stat-label">總經驗值</span>
        </div>
        <div className="stat">
          <span className="stat-value">{stats.streak} 天</span>
          <span className="stat-label">連勝{stats.checkedInToday ? '（今天已打卡）' : ''}</span>
        </div>
      </section>

      {error && (
        <p className="today-error" role="alert">
          {error}
        </p>
      )}

      {view.status === 'before' && <p className="today-message">計畫將於 {formatDate(view.firstDate)} 開始。</p>}
      {view.status === 'rest' && <p className="today-message">今天是休息日，好好休息，明天繼續！</p>}
      {view.status === 'after' && <p className="today-message">計畫已在 {formatDate(view.endDate)} 完成，恭喜！</p>}

      {view.status === 'active' && (
        <>
          <p className="today-progress">{progressLabel(view)}</p>

          {noviceDescription && (
            <section className="today-card">
              <h2>今天的新手村任務</h2>
              <p>{noviceDescription}</p>
            </section>
          )}

          {view.week && (
            <section className="today-card">
              <h2>本週主題{view.week.isBoss ? '（頭目戰週）' : ''}</h2>
              <ul className="themes">
                {view.week.themes.map((theme) => (
                  <li key={theme.title}>
                    <strong>{theme.title}</strong>
                    <span>{theme.focus}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="today-card">
            <h2>今天的任務</h2>
            <ul className="tasks">
              {tasks.map((task) => (
                <li key={task.id}>
                  <label className="task">
                    <input
                      type="checkbox"
                      checked={task.done}
                      disabled={disabled}
                      onChange={() => void toggleTask(task)}
                    />
                    <span className="task-title">{task.title}</span>
                    <span className="task-meta">
                      {task.minutes} 分鐘・{task.xp} 經驗值
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="minimum"
              aria-pressed={minimumOn}
              disabled={disabled}
              onClick={() => void toggleMinimum()}
            >
              {minimumOn ? `✓ 今天已用最低限度打卡（+${MINIMUM_XP} 經驗值），再按一次取消` : '今天只做 5 分鐘單字卡'}
            </button>
          </section>
        </>
      )}
    </main>
  )
}
