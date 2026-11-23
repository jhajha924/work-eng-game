// 整個 App 共用一個本機資料庫連線（打勾紀錄、單字卡、同步都用同一個）
import { createCardRepo, type CardRepo } from '../cards/cardRepo'
import { createDb, type ProgressDb } from '../progress/db'
import { createProgressRepo, type ProgressRepo } from '../progress/progressRepo'

let db: ProgressDb | null = null
let repo: ProgressRepo | null = null
let cardRepo: CardRepo | null = null

/** 第一次使用時才建立；資料庫打不開時例外由呼叫端處理 */
function getDb(): ProgressDb {
  db ??= createDb()
  return db
}

export function getRepo(): ProgressRepo {
  repo ??= createProgressRepo(getDb())
  return repo
}

export function getCardRepo(): CardRepo {
  cardRepo ??= createCardRepo(getDb())
  return cardRepo
}
