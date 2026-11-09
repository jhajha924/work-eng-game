// D13：產生登入密碼的雜湊（APP_PASSWORD_HASH）
// 用法：node scripts/hash-password.mjs
// 提示文字輸出到標準錯誤，標準輸出只有一行雜湊，方便複製
import { createInterface } from 'node:readline'
import { checkNewPassword, hashPassword } from '../worker/auth/password.ts'

/** 非終端機輸入時共用的逐行讀取器 */
let lines

/** 讀一行輸入；在終端機時不顯示輸入內容 */
function readHidden(prompt) {
  process.stderr.write(prompt)
  const stdin = process.stdin
  if (!stdin.isTTY) {
    // 非終端機（例如用管線送入）：逐行讀取
    lines ??= createInterface({ input: stdin })[Symbol.asyncIterator]()
    return lines.next().then((r) => r.value ?? '')
  }
  return new Promise((resolve) => {
    let value = ''
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(false)
          stdin.off('data', onData)
          stdin.pause()
          process.stderr.write('\n')
          resolve(value)
          return
        }
        if (ch === '\u0003') {
          // Ctrl+C
          stdin.setRawMode(false)
          process.stderr.write('\n已取消\n')
          process.exit(130)
        }
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1)
        else value += ch
      }
    }
    stdin.setRawMode(true)
    stdin.setEncoding('utf8')
    stdin.on('data', onData)
    stdin.resume()
  })
}

const first = await readHidden('請輸入密碼（輸入時不會顯示）：')
const second = await readHidden('請再輸入一次：')
const error = checkNewPassword(first, second)
if (error) {
  process.stderr.write(`${error}\n`)
  process.exit(1)
}
process.stdout.write(`${await hashPassword(first)}\n`)
