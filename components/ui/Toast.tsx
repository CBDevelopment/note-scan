'use client'
import { createContext, useCallback, useContext, useState } from 'react'

interface ToastMessage {
  id: number
  message: string
  action?: { label: string; href: string }
  type?: 'default' | 'error'
}

interface ToastContextValue {
  toast: (msg: string, opts?: { action?: ToastMessage['action']; type?: ToastMessage['type'] }) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

let nextId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const toast = useCallback((message: string, opts?: { action?: ToastMessage['action']; type?: ToastMessage['type'] }) => {
    const id = ++nextId
    setToasts((prev) => [...prev, { id, message, ...opts }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-50 w-full max-w-sm px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={[
              'flex items-center justify-between gap-4 rounded-lg px-4 py-3 text-sm shadow-lg',
              t.type === 'error'
                ? 'bg-flag text-white'
                : 'bg-ink text-paper',
            ].join(' ')}
          >
            <span>{t.message}</span>
            {t.action && (
              <a
                href={t.action.href}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 font-medium underline underline-offset-2"
              >
                {t.action.label}
              </a>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
