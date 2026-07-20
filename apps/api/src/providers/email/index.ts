import { providerFor } from '../core/profile'
import { createRegistry } from '../core/registry'
import { resendAdapter } from './adapters/resend'
import type { EmailPort } from './port'

export const emailRegistry = createRegistry<EmailPort>('email', providerFor('email'), [resendAdapter])

export type * from './port'
