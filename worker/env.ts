// Worker 的環境型別：wrangler 產生的 Env（D1 綁定）＋機密
// APP_PASSWORD_HASH 是機密，沒設定時為 undefined（登入回 not_configured）
export type AppBindings = Env & { APP_PASSWORD_HASH?: string }

export type AppEnv = { Bindings: AppBindings }
