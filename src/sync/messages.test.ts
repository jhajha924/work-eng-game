import { describe, expect, it } from 'vitest'
import { loginErrorText, statusText, type SyncStatus } from './messages'

describe('同步狀態列文字', () => {
  it.each<[SyncStatus, string]>([
    ['checking', '檢查登入狀態…'],
    ['logged-out', '未登入，紀錄只存在這台裝置'],
    ['syncing', '同步中…'],
    ['synced', '已同步'],
    ['offline', '離線中，連線後自動同步'],
    ['error', '同步失敗，稍後會再試'],
  ])('%s', (status, text) => {
    expect(statusText(status)).toBe(text)
  })
})

describe('登入錯誤文字', () => {
  it('被鎖定：分鐘數無條件進位', () => {
    expect(loginErrorText({ result: 'locked', retryAfterSeconds: 600 })).toBe('嘗試太多次，請 10 分鐘後再試')
    expect(loginErrorText({ result: 'locked', retryAfterSeconds: 61 })).toBe('嘗試太多次，請 2 分鐘後再試')
  })

  it('其他結果', () => {
    expect(loginErrorText({ result: 'ok' })).toBeNull()
    expect(loginErrorText({ result: 'wrong_password' })).toBe('密碼錯誤')
    expect(loginErrorText({ result: 'offline' })).toBe('目前離線，無法登入')
    expect(loginErrorText({ result: 'error' })).toBe('登入失敗，請稍後再試')
  })
})
