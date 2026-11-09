// D12：測試用的 D1 替身，以 Node 內建 SQLite 實作程式用到的 D1 介面
// 只用兩邊都支援的 SQLite 語法；部署後再以手動驗收確認真正的 D1
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'

type Value = string | number | boolean | null

/** D1 會把布林轉成 1／0；node:sqlite 不接受布林，所以在這裡轉 */
function toSql(value: Value): SQLInputValue {
  if (typeof value === 'boolean') return value ? 1 : 0
  return value
}

class Statement {
  private readonly db: DatabaseSync
  private readonly sql: string
  private readonly params: SQLInputValue[]

  constructor(db: DatabaseSync, sql: string, params: SQLInputValue[] = []) {
    this.db = db
    this.sql = sql
    this.params = params
  }

  bind(...values: Value[]): Statement {
    return new Statement(this.db, this.sql, values.map(toSql))
  }

  async first<T>(column?: string): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...this.params) as Record<string, unknown> | undefined
    if (!row) return null
    return (column ? row[column] : row) as T
  }

  async all<T>(): Promise<{ results: T[]; success: true; meta: Record<string, unknown> }> {
    return { results: this.allSync() as T[], success: true, meta: {} }
  }

  async run(): Promise<{ success: true; meta: { changes: number; last_row_id: number } }> {
    const result = this.db.prepare(this.sql).run(...this.params)
    return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } }
  }

  /** batch 用：所有語句都以 all 執行（寫入語句回傳空陣列） */
  allSync(): unknown[] {
    return this.db.prepare(this.sql).all(...this.params)
  }
}

export type TestD1 = D1Database & { sqlite: DatabaseSync }

/** 建立記憶體中的資料庫並依序套用 migrations/ 裡的遷移檔 */
export function createTestD1(): TestD1 {
  const sqlite = new DatabaseSync(':memory:')
  const dir = join(import.meta.dirname, '..', '..', 'migrations')
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(join(dir, file), 'utf-8'))
  }

  const d1 = {
    sqlite,
    prepare: (sql: string) => new Statement(sqlite, sql),
    // D1 的 batch 是一個交易：任何一句失敗就全部復原
    async batch(statements: Statement[]) {
      sqlite.exec('BEGIN')
      try {
        const results = statements.map((s) => ({ results: s.allSync(), success: true, meta: {} }))
        sqlite.exec('COMMIT')
        return results
      } catch (error) {
        sqlite.exec('ROLLBACK')
        throw error
      }
    },
    async exec(sql: string) {
      sqlite.exec(sql)
      return { count: 0, duration: 0 }
    },
  }
  return d1 as unknown as TestD1
}
