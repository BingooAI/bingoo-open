// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { providerFor } from '../core/profile'
import { createRegistry } from '../core/registry'
import { openaiImageAdapter } from './adapters/openai'
import type { ImagePort } from './port'

export const imageRegistry = createRegistry<ImagePort>('image', providerFor('image'), [openaiImageAdapter])

export type * from './port'
