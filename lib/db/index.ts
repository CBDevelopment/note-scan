import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'

const url = process.env.DATABASE_URL ?? 'file:./notescan.db'

const client = createClient({ url })

export const db = drizzle(client, { schema })
export type DB = typeof db
