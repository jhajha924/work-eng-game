// D2：密碼雜湊（PBKDF2-SHA256），只用 Web Crypto，Worker 與 Node（產生雜湊的指令稿）共用
// 本檔不匯入其他相對路徑檔案，Node 才能直接執行 .ts（scripts/hash-password.mjs）

const SCHEME = 'pbkdf2-sha256'
/** Cloudflare Workers 的 PBKDF2 次數上限 */
const ITERATIONS = 100_000
const SALT_BYTES = 16
const HASH_BYTES = 32
export const MIN_PASSWORD_LENGTH = 8

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error('not base64url')
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as Uint8Array<ArrayBuffer>, iterations },
    key,
    HASH_BYTES * 8,
  )
  return new Uint8Array(bits)
}

/** 固定時間比較：不論哪個位元組不同，花的時間都一樣，避免從回應時間猜出雜湊 */
function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

/** 產生 `pbkdf2-sha256:<次數>:<salt>:<hash>`；每次 salt 都不同 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const hash = await derive(password, salt, ITERATIONS)
  return [SCHEME, ITERATIONS, toBase64Url(salt), toBase64Url(hash)].join(':')
}

/** 格式不正確一律回 false，不丟出錯誤 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [scheme, iterationText, saltText, hashText, ...rest] = stored.split(':')
    const iterations = Number(iterationText)
    if (scheme !== SCHEME || rest.length > 0 || !/^\d+$/.test(iterationText ?? '')) return false
    if (iterations < 1 || iterations > ITERATIONS) return false
    const salt = fromBase64Url(saltText ?? '')
    const expected = fromBase64Url(hashText ?? '')
    if (salt.length !== SALT_BYTES || expected.length !== HASH_BYTES) return false
    return equalBytes(await derive(password, salt, iterations), expected)
  } catch {
    return false
  }
}

/** 產生雜湊前檢查新密碼：回傳錯誤訊息，沒問題回 null（D13） */
export function checkNewPassword(first: string, second: string): string | null {
  if (first !== second) return '兩次輸入的密碼不一致'
  if (first.length < MIN_PASSWORD_LENGTH) return `密碼至少要 ${MIN_PASSWORD_LENGTH} 個字元`
  return null
}
