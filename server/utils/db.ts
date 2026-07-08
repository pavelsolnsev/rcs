import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from '../db/schema'

let _db: MySql2Database<typeof schema> | null = null
let _pool: mysql.Pool | null = null

/**
 * Ленивое подключение к MySQL (пул соединений).
 * Используется во всех серверных обработчиках через useDb().
 */
export function useDb() {
  if (_db) return _db

  _pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
    enableKeepAlive: true,
  })

  _db = drizzle(_pool, { schema, mode: 'default' })
  return _db
}

export { schema }
