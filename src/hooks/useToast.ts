import { useState, useCallback } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  message: string
  type: ToastType
}

export interface UseToastResult {
  toasts: Toast[]
  addToast: (message: string, type: ToastType, duration?: number) => void
  removeToast: (id: string) => void
}

let counter = 0

export function useToast(): UseToastResult {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback((message: string, type: ToastType, duration?: number) => {
    const id = `toast-${++counter}`
    setToasts(prev => [...prev, { id, message, type }])
    if (duration) {
      setTimeout(() => removeToast(id), duration)
    }
  }, [removeToast])

  return { toasts, addToast, removeToast }
}
