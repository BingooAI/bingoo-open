// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { providerFor } from '../core/profile'
import { createRegistry } from '../core/registry'
import { claudeVisionAdapter } from './adapters/claude'
import type { VisionPort } from './port'

export const visionRegistry = createRegistry<VisionPort>('vision', providerFor('vision'), [
  claudeVisionAdapter,
])

export type * from './port'
