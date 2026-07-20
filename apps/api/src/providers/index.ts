/**
 * Provider facade — the only thing the rest of the API imports. Every external
 * vendor (R2, Resend, ElevenLabs, OpenAI, LiveKit, Claude, Bunny, Redis) sits
 * behind a capability port; the active vendor is chosen by the `*_PROVIDER` env,
 * so switching providers is config, not code. All are server-only (R1) and, for
 * child-facing output (ai/tts/image), must be moderated at the service layer (R5).
 */
import { aiRegistry } from './ai';
import { cacheRegistry } from './cache';
import { emailRegistry } from './email';
import { embeddingRegistry } from './embedding';
import { imageRegistry } from './image';
import { notificationRegistry } from './notification';
import { paymentRegistry } from './payment';
import { realtimeRegistry } from './realtime';
import { searchRegistry } from './search';
import { storageRegistry } from './storage';
import { translationRegistry } from './translation';
import { ttsRegistry } from './tts';
import { videoRegistry } from './video';
import { visionRegistry } from './vision';
import { workflowRegistry } from './workflow';
import type { ProviderStatus } from './core/types';

export const getStorage = (key?: string) => storageRegistry.get(key);
export const getEmail = (key?: string) => emailRegistry.get(key);
export const getTts = (key?: string) => ttsRegistry.get(key);
export const getRealtime = (key?: string) => realtimeRegistry.get(key);
export const getAi = (key?: string) => aiRegistry.get(key);
export const getImage = (key?: string) => imageRegistry.get(key);
export const getEmbedding = (key?: string) => embeddingRegistry.get(key);
export const getSearch = (key?: string) => searchRegistry.get(key);
export const getVideo = (key?: string) => videoRegistry.get(key);
export const getCache = (key?: string) => cacheRegistry.get(key);
export const getWorkflow = (key?: string) => workflowRegistry.get(key);
export const getPayment = (key?: string) => paymentRegistry.get(key);
export const getNotification = (key?: string) => notificationRegistry.get(key);
export const getTranslation = (key?: string) => translationRegistry.get(key);
export const getVision = (key?: string) => visionRegistry.get(key);

const registries = [
  storageRegistry,
  emailRegistry,
  ttsRegistry,
  realtimeRegistry,
  aiRegistry,
  imageRegistry,
  videoRegistry,
  cacheRegistry,
  workflowRegistry,
  paymentRegistry,
  notificationRegistry,
  translationRegistry,
  embeddingRegistry,
  searchRegistry,
  visionRegistry,
];

/** Readiness of every registered provider — powers GET /health/providers. */
export function providersHealth(): ProviderStatus[] {
  return registries.flatMap((r) => r.health());
}

export { ProviderError, ProviderNotConfiguredError } from './core/errors';
export type { ProviderStatus } from './core/types';
export type * from './storage/port';
export type * from './email/port';
export type * from './tts/port';
export type * from './realtime/port';
export type * from './ai/port';
export type * from './image/port';
export type * from './embedding/port';
export type * from './search/port';
export type * from './video/port';
export type * from './cache/port';
export type * from './workflow/port';
export type * from './payment/port';
export type * from './notification/port';
export type * from './translation/port';
