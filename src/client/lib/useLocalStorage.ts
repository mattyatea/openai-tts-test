import { ref, watch, type Ref } from 'vue'

export function useLocalStorage<T>(key: string, initial: T): Ref<T> {
  const state = ref(initial) as Ref<T>
  try {
    const raw = localStorage.getItem(key)
    if (raw !== null) state.value = JSON.parse(raw) as T
  } catch {
    // 壊れた保存値は既定値で上書きする
  }
  watch(
    state,
    (value) => {
      try {
        localStorage.setItem(key, JSON.stringify(value))
      } catch {
        // 容量超過などは無視する
      }
    },
    { deep: true },
  )
  return state
}
