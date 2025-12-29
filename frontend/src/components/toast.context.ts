import { createContext } from 'react'

export type Toast = {
  id: string
  title: string
  message?: string
  variant?: 'info' | 'success' | 'error'
}

export type ToastContextValue = {
  push: (t: Omit<Toast, 'id'>) => void
}

export const ToastContext = createContext<ToastContextValue | undefined>(undefined)


