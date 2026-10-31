import { defineConfig } from 'vitest/config'

// 單元測試只跑純函式，不載入 vite.config.ts 裡的 Cloudflare 外掛（D9）
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // 測試用 import.meta.glob 偵測本機私人內容包；檔案快取會記住舊的 glob 結果，
    // 新增或刪除私人檔案後測試仍被略過，所以關閉（純函式測試很快，不需要快取）
    fsModuleCache: false,
  },
})
