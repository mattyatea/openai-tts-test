import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { ContractRouterClient } from '@orpc/contract'

import type { AppContract } from '@/contract'

const link = new RPCLink({
  url: () => `${window.location.origin}/rpc`,
})

export const client: ContractRouterClient<AppContract> = createORPCClient(link)

/** oRPC のエラーを画面に出せる文言へ整える。 */
export function errorMessage(error: unknown): string {
  if (!error) return '不明なエラー'
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message)
  return String(error)
}
