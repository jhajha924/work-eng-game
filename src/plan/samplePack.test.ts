import { describe, expect, it } from 'vitest'
import samplePack from '../../content/packs/meeting-a2-b1-sample/pack.json'
import type { ContentPack } from './types'
import { validatePack } from './validatePack'

// 私人資料只在本機存在（.gitignore 排除）；CI 上這兩個 glob 都是空的
const privatePacks = import.meta.glob<{ default: unknown }>('../../content/packs/private/*/pack.json', { eager: true })
const privateTerms = import.meta.glob<{ default: string[] }>('../../content/packs/private/forbidden-terms.json', {
  eager: true,
})

/** 公開的通用禁用字詞：轉職與薪資相關用語（個人字詞放在本機私人清單，不寫在這裡） */
const PUBLIC_FORBIDDEN = ['換工作', '期望薪資', '離職', 'salary', 'notice period']

/** 收集內容包裡的所有字串 */
function allStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(allStrings)
  if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(allStrings)
  return []
}

describe('公開範例內容包', () => {
  it('範例包可直接使用：通過檢查，新手村 8 天、6 關、週數 4、5、4、4、5、4', () => {
    expect(validatePack(samplePack)).toEqual({ ok: true })
    expect(samplePack.novice).toHaveLength(8)
    expect(samplePack.levels.map((l) => l.weeks.length)).toEqual([4, 5, 4, 4, 5, 4])
    expect(samplePack.levels.map((l) => l.minWeeks)).toEqual([3, 4, 3, 3, 4, 3])
    expect(samplePack.levels.map((l) => l.stretchWeight)).toEqual([1, 1, 1, 2, 2, 1])
  })

  it('公開範例包附範例單字與句型：9 類各 10 個單字、3 個情境各 4 句', () => {
    const pack = samplePack as ContentPack
    expect(pack.vocab?.map((g) => g.words.length)).toEqual(Array(9).fill(10))
    expect(pack.patterns?.map((g) => g.items.length)).toEqual([4, 4, 4])
    // 範例單字都附例句
    expect(pack.vocab?.every((g) => g.words.every((w) => typeof w.example === 'string' && w.example !== ''))).toBe(true)
    // 每週主題的單字類別（去掉「（進階）」）只要是單字類別名稱，就要找得到
    const categories = new Set(pack.vocab?.map((g) => g.category))
    expect(categories.has('新手村單字')).toBe(true)
    for (const name of ['A 會議流程', 'B 進度與排程', 'C 業務系統與製造', 'D 軟體開發', 'E 形容與語氣', 'F 數字日期', 'G 職涯對話', 'H 動作動詞']) {
      expect(categories.has(name), name).toBe(true)
    }
  })

  it('範例包不含公開的通用禁用字詞', () => {
    const text = allStrings(samplePack).join('\n').toLowerCase()
    for (const term of PUBLIC_FORBIDDEN) expect(text, `不可出現「${term}」`).not.toContain(term.toLowerCase())
  })

  const personalTerms = Object.values(privateTerms).flatMap((m) => m.default)
  it.skipIf(personalTerms.length === 0)('範例包不含本機私人清單的個人字詞', () => {
    const text = allStrings(samplePack).join('\n').toLowerCase()
    for (const term of personalTerms) expect(text, '不可出現私人清單中的字詞').not.toContain(term.toLowerCase())
  })
})

describe('私人內容包不進版本庫', () => {
  const entries = Object.entries(privatePacks)
  it.skipIf(entries.length === 0)('本機的私人內容包都通過結構檢查', () => {
    for (const [path, mod] of entries) expect(validatePack(mod.default), path).toEqual({ ok: true })
  })
})
