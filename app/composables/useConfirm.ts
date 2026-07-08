/**
 * Модальное подтверждение вместо window.confirm.
 * Использование: `const { confirm } = useConfirm()` → `if (!(await confirm(...))) return`.
 * Диалог рендерит глобальный <ConfirmDialog /> (в layout).
 */
export interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  tone?: 'default' | 'danger'
}

const confirmState = reactive({
  open: false,
  title: undefined as string | undefined,
  message: '',
  confirmText: 'Подтвердить',
  cancelText: 'Отмена',
  tone: 'default' as 'default' | 'danger',
})

let resolver: ((value: boolean) => void) | null = null

export function useConfirm() {
  function confirm(options: ConfirmOptions | string): Promise<boolean> {
    const o = typeof options === 'string' ? { message: options } : options
    confirmState.title = o.title
    confirmState.message = o.message
    confirmState.confirmText = o.confirmText ?? 'Подтвердить'
    confirmState.cancelText = o.cancelText ?? 'Отмена'
    confirmState.tone = o.tone ?? 'default'
    confirmState.open = true
    // Закрываем предыдущий висящий промис, если был
    resolver?.(false)
    return new Promise<boolean>((resolve) => {
      resolver = resolve
    })
  }

  function resolveConfirm(value: boolean) {
    if (!confirmState.open) return
    confirmState.open = false
    resolver?.(value)
    resolver = null
  }

  return { confirmState, confirm, resolveConfirm }
}
