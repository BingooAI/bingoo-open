// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { providerFor } from '../core/profile'
import { createRegistry } from '../core/registry'
import { llmTranslationAdapter } from './adapters/llm'
import type { TranslationPort } from './port'

export const translationRegistry = createRegistry<TranslationPort>(
  'translation',
  providerFor('translation'),
  [llmTranslationAdapter],
)

export type * from './port'
