import { readEnv } from '../core/config';
import { createRegistry } from '../core/registry';
import { fcmAdapter } from './adapters/fcm';
import type { NotificationPort } from './port';

export const notificationRegistry = createRegistry<NotificationPort>(
  'notification',
  readEnv('NOTIFICATION_PROVIDER') ?? 'fcm',
  [fcmAdapter],
);

export type * from './port';
