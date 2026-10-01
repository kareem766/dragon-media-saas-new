import React, { createContext, useContext, useState, useCallback } from 'react'

interface ToastContextValue { showToast: (msg: string) => void }
const ToastContext = createContext<ToastContextValue>({ showToast: () => {} })

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div role="status" aria-live="polite" className="fixed top-6 left-1/2 z-[100] w-[min(92vw,520px)] -translate-x-1/2 rounded-xl bg-ink-950 px-5 py-3 text-center text-sm text-sand-50 shadow-lg">
          {toast}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
