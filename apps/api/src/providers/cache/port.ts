// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/** Key-value cache capability (Redis today, swappable). */
export interface CachePort {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlSeconds?: number): Promise<void>
  getJson<T>(key: string): Promise<T | null>
  setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void>
  delete(key: string): Promise<void>
  has(key: string): Promise<boolean>
  increment(key: string, by?: number): Promise<number>
  expire(key: string, ttlSeconds: number): Promise<void>
}
