import type { Metadata } from 'next'
import { ToastProvider } from '@/components/ui/Toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'NoteScan',
  description: 'Photograph handwritten notes, get editable text.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-paper">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
