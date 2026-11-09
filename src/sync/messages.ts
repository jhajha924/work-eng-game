// D11：同步狀態列與登入錯誤的顯示文字（純函式）
import type { LoginResult } from './syncClient'

export type SyncStatus = 'checking' | 'logged-out' | 'syncing' | 'synced' | 'offline' | 'error'

const STATUS_TEXT: Record<SyncStatus, string> = {
  checking: '檢查登入狀態…',
  'logged-out': '未登入，紀錄只存在這台裝置',
  syncing: '同步中…',
  synced: '已同步',
  offline: '離線中，連線後自動同步',
  error: '同步失敗，稍後會再試',
}

export function statusText(status: SyncStatus): string {
  return STATUS_TEXT[status]
}

/** 登入失敗的訊息；登入成功回 null */
export function loginErrorText(result: LoginResult): string | null {
  switch (result.result) {
    case 'ok':
      return null
    case 'wrong_password':
      return '密碼錯誤'
    case 'locked':
      return `嘗試太多次，請 ${Math.ceil(result.retryAfterSeconds / 60)} 分鐘後再試`
    case 'offline':
      return '目前離線，無法登入'
    case 'error':
      return '登入失敗，請稍後再試'
  }
}
