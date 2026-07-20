import { readEnv } from '../core/config';
import { createRegistry } from '../core/registry';
import { openaiEmbeddingAdapter } from './adapters/openai';
import type { EmbeddingPort } from './port';

export const embeddingRegistry = createRegistry<EmbeddingPort>(
  'embedding',
  readEnv('EMBEDDING_PROVIDER') ?? 'openai',
  [openaiEmbeddingAdapter],
);

export type * from './port';
