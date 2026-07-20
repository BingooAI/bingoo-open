import { readEnv } from '../core/config';
import { createRegistry } from '../core/registry';
import { claudeVisionAdapter } from './adapters/claude';
import type { VisionPort } from './port';

export const visionRegistry = createRegistry<VisionPort>(
  'vision',
  readEnv('VISION_PROVIDER') ?? 'claude',
  [claudeVisionAdapter],
);

export type * from './port';
