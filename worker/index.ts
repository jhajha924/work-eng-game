// Worker 進入點：/api/* 交給 Hono（wrangler.jsonc 的 run_worker_first），其他路徑由靜態資源處理
import { createApp } from './app'

const app = createApp()

export default {
  fetch: (request, env, ctx) => app.fetch(request, env, ctx),
} satisfies ExportedHandler<Env>
