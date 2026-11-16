// D11：同步狀態列與登入表單；只負責顯示，狀態與動作來自 useSync
import { useState, type FormEvent } from 'react'
import { loginErrorText, logoutErrorText, statusText, type SyncStatus } from '../sync/messages'
import type { LoginResult, LogoutResult } from '../sync/syncClient'
import './SyncBar.css'

type Props = {
  status: SyncStatus
  login: (password: string) => Promise<LoginResult>
  logout: () => Promise<LogoutResult>
}

export function SyncBar({ status, login, logout }: Props) {
  const [formOpen, setFormOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [logoutError, setLogoutError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setLoginError(null)
    const message = loginErrorText(await login(password))
    setSubmitting(false)
    if (message) {
      setLoginError(message)
      return
    }
    // 成功：收起表單，不把密碼留在記憶體
    setPassword('')
    setFormOpen(false)
  }

  async function onLogout() {
    setLogoutError(null)
    // 伺服器沒確認登出（例如離線）就維持登入，並說明原因
    setLogoutError(logoutErrorText(await logout()))
  }

  const loggedOut = status === 'logged-out'

  return (
    <section className="sync-bar" aria-label="同步">
      <div className="sync-row">
        <p className={`sync-status sync-${status}`} role="status">
          {statusText(status)}
        </p>
        {loggedOut && !formOpen && (
          <button type="button" className="sync-button" onClick={() => setFormOpen(true)}>
            登入同步
          </button>
        )}
        {!loggedOut && status !== 'checking' && (
          <button type="button" className="sync-button" onClick={() => void onLogout()}>
            登出
          </button>
        )}
      </div>

      {!loggedOut && logoutError && (
        <p className="sync-error" role="alert">
          {logoutError}
        </p>
      )}

      {loggedOut && formOpen && (
        <form className="sync-form" onSubmit={(e) => void onSubmit(e)}>
          <label className="sync-label">
            密碼
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button type="submit" className="sync-button" disabled={submitting || password === ''}>
            {submitting ? '登入中…' : '登入'}
          </button>
          {loginError && (
            <p className="sync-error" role="alert">
              {loginError}
            </p>
          )}
        </form>
      )}
    </section>
  )
}
