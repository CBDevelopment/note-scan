import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  image: text('image'),
  emailVerified: integer('email_verified', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at').default(sql`(unixepoch() * 1000)`),
})

export const accounts = sqliteTable(
  'accounts',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.provider, t.providerAccountId] }),
  })
)

export const sessions = sqliteTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: integer('expires', { mode: 'timestamp' }).notNull(),
})

export const verificationTokens = sqliteTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: integer('expires', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.identifier, t.token] }),
  })
)

export const scans = sqliteTable(
  'scans',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    content: text('content').notNull(),
    pageCount: integer('page_count').notNull(),
    model: text('model').notNull(),
    createdAt: integer('created_at').default(sql`(unixepoch() * 1000)`),
    updatedAt: integer('updated_at').default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    userCreatedIdx: index('scans_user_created_idx').on(t.userId, t.createdAt),
  })
)

export const usage = sqliteTable(
  'usage',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id').references(() => users.id),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    costCents: real('cost_cents'),
    createdAt: integer('created_at').default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    userCreatedIdx: index('usage_user_created_idx').on(t.userId, t.createdAt),
  })
)
