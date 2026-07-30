import { and, eq } from 'drizzle-orm'
import { google } from 'googleapis'
import { db } from '@/lib/db'
import { accounts } from '@/lib/db/schema'

export class GoogleAuthError extends Error {
  constructor(
    message: string,
    public code: 'NO_ACCOUNT' | 'INVALID_GRANT' | 'REFRESH_FAILED'
  ) {
    super(message)
    this.name = 'GoogleAuthError'
  }
}

export async function getGoogleClient(userId: string) {
  const account = await db.query.accounts.findFirst({
    where: and(eq(accounts.userId, userId), eq(accounts.provider, 'google')),
  })

  if (!account) {
    throw new GoogleAuthError('No Google account linked', 'NO_ACCOUNT')
  }

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )

  // expires_at is unix seconds from Google; check with 60s buffer
  const expiresAtMs = account.expires_at ? account.expires_at * 1000 : 0
  const needsRefresh = Date.now() > expiresAtMs - 60_000

  if (needsRefresh && account.refresh_token) {
    oauth2.setCredentials({ refresh_token: account.refresh_token })

    try {
      const { credentials } = await oauth2.refreshAccessToken()

      await db
        .update(accounts)
        .set({
          access_token: credentials.access_token ?? account.access_token,
          expires_at: credentials.expiry_date
            ? Math.floor(credentials.expiry_date / 1000)
            : account.expires_at,
        })
        .where(
          and(eq(accounts.userId, userId), eq(accounts.provider, 'google'))
        )

      oauth2.setCredentials(credentials)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('invalid_grant')) {
        // Token revoked — clear account so the user gets a fresh consent prompt
        await db
          .delete(accounts)
          .where(
            and(eq(accounts.userId, userId), eq(accounts.provider, 'google'))
          )
        throw new GoogleAuthError(
          'Google authorization expired — please sign in again',
          'INVALID_GRANT'
        )
      }
      throw new GoogleAuthError(
        'Failed to refresh Google token',
        'REFRESH_FAILED'
      )
    }
  } else {
    oauth2.setCredentials({
      access_token: account.access_token,
      refresh_token: account.refresh_token,
    })
  }

  return oauth2
}
