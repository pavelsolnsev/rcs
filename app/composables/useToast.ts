/**
 * Всплывающие уведомления (тосты) вместо window.alert.
 * Использование: `const { error, success } = useToast()`.
 * Рендерит глобальный <ToastHost /> (в layout).
 */
export type ToastType = 'error' | 'success' | 'info'
export interface ToastItem {
  id: number
  message: string
  type: ToastType
}

const toasts = reactive<ToastItem[]>([])
let seq = 1

export function useToast() {
  function push(message: string, type: ToastType = 'info', timeout = 4500) {
    const id = seq++
    toasts.push({ id, message, type })
    if (timeout) setTimeout(() => dismiss(id), timeout)
    return id
  }

  function dismiss(id: number) {
    const i = toasts.findIndex((t) => t.id === id)
    if (i !== -1) toasts.splice(i, 1)
  }

  return {
    toasts,
    dismiss,
    toast: push,
    error: (m: string) => push(m, 'error'),
    success: (m: string) => push(m, 'success'),
    info: (m: string) => push(m, 'info'),
  }
}
