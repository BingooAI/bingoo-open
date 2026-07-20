// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { providerFor } from '../core/profile'
import { createRegistry } from '../core/registry'
import { r2Adapter } from './adapters/r2'
import type { StoragePort } from './port'

export const storageRegistry = createRegistry<StoragePort>('storage', providerFor('storage'), [r2Adapter])

export type * from './port'
