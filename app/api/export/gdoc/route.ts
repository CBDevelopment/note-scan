import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { getGoogleClient, GoogleAuthError } from '@/lib/google/client'
import { exportToGoogleDocs } from '@/lib/google/docs'

const schema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().max(200_000),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 422 })
  }

  const { title, content } = parsed.data

  let oauth2: Awaited<ReturnType<typeof getGoogleClient>>
  try {
    oauth2 = await getGoogleClient(session.user.id)
  } catch (err) {
    if (err instanceof GoogleAuthError) {
      if (err.code === 'INVALID_GRANT') {
        return NextResponse.json(
          { error: 'Google session expired — please sign out and sign in again' },
          { status: 403 }
        )
      }
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'Failed to get Google credentials' }, { status: 500 })
  }

  try {
    const { documentId, url } = await exportToGoogleDocs(oauth2, title, content)
    return NextResponse.json({ documentId, url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Export failed'
    // Google API errors often have a code property
    const code = (err as { code?: number }).code
    if (code === 401 || code === 403) {
      return NextResponse.json({ error: 'Google access denied — please reconnect your account' }, { status: 403 })
    }
    console.error('[gdoc export]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
