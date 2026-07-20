import { providerFor } from '../core/profile'
import { createRegistry } from '../core/registry'
import { fcmAdapter } from './adapters/fcm'
import type { NotificationPort } from './port'

export const notificationRegistry = createRegistry<NotificationPort>(
  'notification',
  providerFor('notification'),
  [fcmAdapter],
)

export type * from './port'
