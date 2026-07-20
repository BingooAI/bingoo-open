// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { hasEnv } from './config'
import { ProviderError } from './errors'
import type { ProviderStatus } from './types'

/**
 * One vendor implementation of a capability's port. `create()` builds the port
 * lazily (and throws ProviderNotConfigured if its env is missing); `requiredEnv`
 * lets the registry report readiness without constructing anything.
 */
export interface ProviderAdapter<P> {
  readonly key: string
  readonly requiredEnv: readonly string[]
  create(): P
}

/**
 * A swappable set of adapters for one capability. Call sites depend only on the
 * port `P` via `get()`; switching vendors is a config change (the `*_PROVIDER`
 * env), never a code change. Instances are memoized per provider key.
 */
export interface Registry<P> {
  readonly capability: string
  readonly activeKey: string
  get(key?: string): P
  list(): string[]
  health(): ProviderStatus[]
}

export function createRegistry<P>(
  capability: string,
  activeKey: string,
  adapters: readonly ProviderAdapter<P>[],
): Registry<P> {
  const byKey = new Map(adapters.map((a) => [a.key, a] as const))
  const cache = new Map<string, P>()

  if (!byKey.has(activeKey)) {
    throw new Error(
      `[providers] ${capability}: active provider "${activeKey}" is not registered (have: ${[...byKey.keys()].join(', ')})`,
    )
  }

  return {
    capability,
    activeKey,
    list: () => [...byKey.keys()],
    get(key) {
      const resolved = key ?? activeKey
      const adapter = byKey.get(resolved)
      if (!adapter) throw new ProviderError(capability, resolved, `unknown provider "${resolved}"`)
      let instance = cache.get(resolved)
      if (instance === undefined) {
        instance = adapter.create()
        cache.set(resolved, instance)
      }
      return instance
    },
    health() {
      return adapters.map((a) => ({
        capability,
        provider: a.key,
        configured: hasEnv(a.requiredEnv),
        active: a.key === activeKey,
      }))
    },
  }
}
