import { readEnv } from '../core/config';
import { createRegistry } from '../core/registry';
import { llmTranslationAdapter } from './adapters/llm';
import type { TranslationPort } from './port';

export const translationRegistry = createRegistry<TranslationPort>(
  'translation',
  readEnv('TRANSLATION_PROVIDER') ?? 'llm',
  [llmTranslationAdapter],
);

export type * from './port';
