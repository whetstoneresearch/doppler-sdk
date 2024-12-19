import { Drift } from '@delvtech/drift'
import { viemAdapter, ViemReadAdapter } from '@delvtech/drift-viem'
import { getPublicClient } from '@wagmi/core'
import { config } from './wagmi'
import type { PublicClient } from 'viem'

export function getDrift(): Drift<ViemReadAdapter<PublicClient>> {
  const publicClient = getPublicClient(config)
  return new Drift({ adapter: viemAdapter({ publicClient }) })
}
