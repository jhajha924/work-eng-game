import { describe, expect, it } from 'vitest'
import { routeFromHash } from './useHashRoute'

describe('網址 hash 切換頁面', () => {
  it.each([
    ['#/cards', 'cards'],
    ['', 'today'],
    ['#/', 'today'],
    ['#/cards/x', 'today'],
  ])('%s → %s', (hash, route) => {
    expect(routeFromHash(hash)).toBe(route)
  })
})
