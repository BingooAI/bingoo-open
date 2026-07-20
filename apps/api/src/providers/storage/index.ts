// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { createRegistry } from '../core/registry'
import { providerFor } from '../core/profile'
import { r2Adapter, s3Adapter } from './adapters/s3'
import type { StoragePort } from './port'

export const storageRegistry = createRegistry<StoragePort>('storage', providerFor('storage'), [
  s3Adapter,
  r2Adapter,
])

export type * from './port'
