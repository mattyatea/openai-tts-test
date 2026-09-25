import { ref } from 'vue'

import type { ServerInfo } from '@/contract'
import { client, errorMessage } from '../lib/orpc'

const info = ref<ServerInfo | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
let loaded = false

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    info.value = await client.system.info()
    loaded = true
  } catch (caught) {
    error.value = errorMessage(caught)
  } finally {
    loading.value = false
  }
}

export function useServerInfo() {
  if (!loaded && !loading.value) void load()
  return { info, loading, error, reload: load }
}
