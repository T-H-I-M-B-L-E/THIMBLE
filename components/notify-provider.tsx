"use client"

import { createContext, useCallback, useContext, useState, ReactNode } from "react"
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react"

type ToastTone = "info" | "success" | "error"

interface ToastEntry {
  id: number
  message: string
  tone: ToastTone
}

interface ConfirmState {
  id: number
  title: string
  message?: string
  confirmLabel: string
  cancelLabel: string
  destructive: boolean
  resolve: (ok: boolean) => void
}

interface NotifyApi {
  info: (message: string) => void
  success: (message: string) => void
  error: (message: string) => void
  confirm: (opts: {
    title: string
    message?: string
    confirmLabel?: string
    cancelLabel?: string
    destructive?: boolean
  }) => Promise<boolean>
}

const NotifyContext = createContext<NotifyApi | null>(null)

let toastCounter = 0
let confirmCounter = 0

export function NotifyProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)

  const pushToast = useCallback((message: string, tone: ToastTone) => {
    const id = ++toastCounter
    setToasts(prev => [...prev, { id, message, tone }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  const api: NotifyApi = {
    info: (m) => pushToast(m, "info"),
    success: (m) => pushToast(m, "success"),
    error: (m) => pushToast(m, "error"),
    confirm: (opts) =>
      new Promise<boolean>(resolve => {
        setConfirmState({
          id: ++confirmCounter,
          title: opts.title,
          message: opts.message,
          confirmLabel: opts.confirmLabel ?? "Confirm",
          cancelLabel: opts.cancelLabel ?? "Cancel",
          destructive: opts.destructive ?? false,
          resolve,
        })
      }),
  }

  const handleConfirm = (ok: boolean) => {
    if (confirmState) {
      confirmState.resolve(ok)
      setConfirmState(null)
    }
  }

  return (
    <NotifyContext.Provider value={api}>
      {children}

      {/* Toast stack */}
      <div className="t-toast-stack" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`t-toast-card t-toast-${t.tone}`}>
            <span className="t-toast-icon">
              {t.tone === "success" ? <CheckCircle2 size={16} /> :
               t.tone === "error" ? <AlertCircle size={16} /> :
               <Info size={16} />}
            </span>
            <span className="t-toast-msg">{t.message}</span>
            <button
              className="t-toast-close"
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Confirm modal */}
      {confirmState && (
        <div className="t-confirm-backdrop" onClick={() => handleConfirm(false)}>
          <div className="t-confirm-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="t-confirm-title">{confirmState.title}</h3>
            {confirmState.message && <p className="t-confirm-msg">{confirmState.message}</p>}
            <div className="t-confirm-actions">
              <button
                className="t-confirm-cancel"
                onClick={() => handleConfirm(false)}
              >
                {confirmState.cancelLabel}
              </button>
              <button
                className={confirmState.destructive ? "t-confirm-danger" : "t-confirm-primary"}
                onClick={() => handleConfirm(true)}
                autoFocus
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </NotifyContext.Provider>
  )
}

export function useNotify(): NotifyApi {
  const ctx = useContext(NotifyContext)
  if (!ctx) throw new Error("useNotify must be used inside NotifyProvider")
  return ctx
}
