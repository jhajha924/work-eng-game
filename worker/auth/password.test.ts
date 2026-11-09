import { beforeAll, describe, expect, it } from 'vitest'
import { checkNewPassword, hashPassword, verifyPassword } from './password'

describe('密碼雜湊格式與驗證', () => {
  let stored = ''
  beforeAll(async () => {
    stored = await hashPassword('correct horse')
  })

  it('格式為 pbkdf2-sha256:100000:<salt>:<hash>', () => {
    expect(stored).toMatch(/^pbkdf2-sha256:100000:[A-Za-z0-9_-]{22}:[A-Za-z0-9_-]{43}$/)
  })

  // 規格 Example「密碼驗證」
  it.each([
    { input: 'correct horse', hash: 'generated', expected: true },
    { input: 'correct horsE', hash: 'generated', expected: false },
    { input: '', hash: 'generated', expected: false },
    { input: 'correct horse', hash: 'not-a-hash', expected: false },
    { input: 'correct horse', hash: 'pbkdf2-sha256:abc:x:y', expected: false },
  ])('輸入 "$input"、雜湊 $hash → $expected', async ({ input, hash, expected }) => {
    expect(await verifyPassword(input, hash === 'generated' ? stored : hash)).toBe(expected)
  })

  it('同一個密碼每次雜湊都不同', async () => {
    const again = await hashPassword('correct horse')
    expect(again).not.toBe(stored)
    expect(await verifyPassword('correct horse', again)).toBe(true)
  })
})

describe('產生雜湊前檢查新密碼', () => {
  it.each([
    { first: 'abcdefgh', second: 'abcdefgx', expected: '兩次輸入的密碼不一致' },
    { first: 'abcdefg', second: 'abcdefg', expected: '密碼至少要 8 個字元' },
    { first: 'abcdefgh', second: 'abcdefgh', expected: null },
  ])('$first／$second', ({ first, second, expected }) => {
    expect(checkNewPassword(first, second)).toBe(expected)
  })
})
