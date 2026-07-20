/**
 * Provider facade — the only thing the rest of the API imports. Every external
 * vendor (R2, Resend, ElevenLabs, OpenAI, LiveKit, Claude, Bunny, Redis) sits
 * behind a capability port; the active vendor is chosen by the `*_PROVIDER` env,
 * so switching providers is config, not code. All are server-only (R1) and, for
 * child-facing output (ai/tts/image), must be moderated at the service layer (R5).
 */
import { aiRegistry } from './ai'
import { cacheRegistry } from './cache'
import { embeddingRegistry } from './embedding'
import { imageRegistry } from './image'
import { searchRegistry } from './search'
import { storageRegistry } from './storage'
import { translationRegistry } from './translation'
import { ttsRegistry } from './tts'
import { visionRegistry } from './vision'
import type { ProviderStatus } from './core/types'

export const getStorage = (key?: string) => storageRegistry.get(key)
export const getTts = (key?: string) => ttsRegistry.get(key)
export const getAi = (key?: string) => aiRegistry.get(key)
export const getImage = (key?: string) => imageRegistry.get(key)
export const getEmbedding = (key?: string) => embeddingRegistry.get(key)
export const getSearch = (key?: string) => searchRegistry.get(key)
export const getCache = (key?: string) => cacheRegistry.get(key)
export const getTranslation = (key?: string) => translationRegistry.get(key)
export const getVision = (key?: string) => visionRegistry.get(key)

const registries = [
  storageRegistry,
  ttsRegistry,
  aiRegistry,
  imageRegistry,
  cacheRegistry,
  translationRegistry,
  embeddingRegistry,
  searchRegistry,
  visionRegistry,
]

/** Readiness of every registered provider — powers GET /health/providers. */
export function providersHealth(): ProviderStatus[] {
  return registries.flatMap((r) => r.health())
}

export { ProviderError, ProviderNotConfiguredError } from './core/errors'
export type { ProviderStatus } from './core/types'
export type * from './storage/port'
export type * from './tts/port'
export type * from './ai/port'
export type * from './image/port'
export type * from './embedding/port'
export type * from './search/port'
export type * from './cache/port'
export type * from './translation/port'
