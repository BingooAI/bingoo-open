import { readEnv } from '../core/config';
import { createRegistry } from '../core/registry';
import { openaiImageAdapter } from './adapters/openai';
import type { ImagePort } from './port';

export const imageRegistry = createRegistry<ImagePort>(
  'image',
  readEnv('IMAGE_PROVIDER') ?? 'openai',
  [openaiImageAdapter],
);

export type * from './port';
