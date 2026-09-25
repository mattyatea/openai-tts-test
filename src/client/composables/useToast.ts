import { ref } from 'vue'

export interface ToastItem {
  id: number
  title: string
  description?: string
  tone: 'neutral' | 'ok' | 'error'
}

const toasts = ref<ToastItem[]>([])
let nextId = 1

function push(toast: Omit<ToastItem, 'id'>): void {
  const item: ToastItem = { ...toast, id: nextId++ }
  toasts.value = [...toasts.value, item]
  setTimeout(() => {
    toasts.value = toasts.value.filter((entry) => entry.id !== item.id)
  }, 3600)
}

export function useToast() {
  return {
    toasts,
    show: (title: string, description?: string) => push({ title, description, tone: 'neutral' }),
    ok: (title: string, description?: string) => push({ title, description, tone: 'ok' }),
    error: (title: string, description?: string) => push({ title, description, tone: 'error' }),
  }
}
