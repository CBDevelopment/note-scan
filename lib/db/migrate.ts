import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import path from 'path'

async function main() {
  const url = process.env.DATABASE_URL ?? 'file:./notescan.db'
  const client = createClient({ url })
  const db = drizzle(client)

  await migrate(db, {
    migrationsFolder: path.join(process.cwd(), 'lib/db/migrations'),
  })

  console.log('Migrations complete')
  await client.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
