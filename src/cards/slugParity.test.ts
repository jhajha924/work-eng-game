// 匯出指令稿（Python）的 card_slug 必須和 App 的 cardSlug 結果相同，私人包的重複字才會被正確略過。
// 找不到 Python（python3 或 python）時略過；GitHub Actions 的 ubuntu 執行環境有 python3
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { cardSlug } from './deck'

const SCRIPT = 'scripts/export_private_pack.py'
const SAMPLES = [
  'meeting', 'follow up', 'Shall we get started?', "Today I'd like to talk about…", 'Q3 KPI',
  '  --Hello__World--  ', 'ERP/MES', 'naïve café', 'NT$43,500', '...',
]

function findPython(): string | null {
  for (const cmd of ['python3', 'python']) {
    try {
      execFileSync(cmd, ['--version'], { stdio: 'ignore' })
      return cmd
    } catch {
      // 試下一個
    }
  }
  return null
}

const python = findPython()

describe.skipIf(!python)('匯出指令稿與 App 的卡片代號規則一致', () => {
  it('同一批英文轉出相同的代號', () => {
    const out = execFileSync(python!, [SCRIPT, '--slugs'], {
      input: JSON.stringify(SAMPLES),
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    })
    expect(JSON.parse(out.toString('utf-8'))).toEqual(SAMPLES.map(cardSlug))
  })
})
