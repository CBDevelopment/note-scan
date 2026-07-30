#!/bin/sh
set -e

echo "Running database migrations..."
node -e "
import('@libsql/client').then(({ createClient }) => {
  import('drizzle-orm/libsql').then(({ drizzle }) => {
    import('drizzle-orm/libsql/migrator').then(({ migrate }) => {
      import('path').then(async (path) => {
        const url = process.env.DATABASE_URL || 'file:/data/notescan.db';
        const client = createClient({ url });
        const db = drizzle(client);
        await migrate(db, { migrationsFolder: path.join(process.cwd(), 'lib/db/migrations') });
        console.log('Migrations complete');
        await client.close();
      });
    });
  });
});
" --input-type=module

echo "Starting server..."
exec node server.js
