import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { ScanFlow } from './ScanFlow'

export default async function ScanPage() {
  const session = await auth()
  if (!session?.user) redirect('/')

  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex items-center justify-between border-b border-rule px-4 py-3 shrink-0">
        <span className="text-sm font-semibold text-ink tracking-tight">NoteScan</span>
        <div className="flex items-center gap-4">
          <a href="/history" className="text-sm text-ink-muted hover:text-ink transition-colors">
            History
          </a>
          <a
            href="/api/auth/signout"
            className="text-sm text-ink-muted hover:text-ink transition-colors"
          >
            Sign out
          </a>
        </div>
      </header>
      <ScanFlow />
    </div>
  )
}
