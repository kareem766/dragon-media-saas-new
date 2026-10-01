import React, { createContext, useContext, useState, useCallback } from 'react'

interface ToastContextValue { showToast: (msg: string) => void; confirmAction: (msg: string) => Promise<boolean> }
const ToastContext = createContext<ToastContextValue>({ showToast: () => {}, confirmAction: async () => false })

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<string | null>(null)

  const [confirmState, setConfirmState] = useState<{ msg: string; resolve: (value: boolean) => void } | null>(null)

  const confirmAction = useCallback((msg: string) => new Promise<boolean>((resolve) => {
    setConfirmState({ msg, resolve })
  }), [])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast, confirmAction }}>
      {children}
      {confirmState && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]" role="presentation">
          <div dir="rtl" role="dialog" aria-modal="true" aria-labelledby="dm-confirm-title" className="w-full max-w-md rounded-2xl border border-white/10 bg-white p-5 shadow-2xl">
            <h2 id="dm-confirm-title" className="text-base font-bold text-ink-950">تأكيد الإجراء</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">{confirmState.msg}</p>
            <div className="mt-5 flex gap-2 justify-start">
              <button type="button" onClick={() => { confirmState.resolve(false); setConfirmState(null) }} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">إلغاء</button>
              <button type="button" autoFocus onClick={() => { confirmState.resolve(true); setConfirmState(null) }} className="rounded-xl bg-ink-950 px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">متابعة</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div role="status" aria-live="polite" className="fixed top-6 left-1/2 z-[100] w-[min(92vw,520px)] -translate-x-1/2 rounded-xl bg-ink-950 px-5 py-3 text-center text-sm text-sand-50 shadow-lg">
          {toast}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
