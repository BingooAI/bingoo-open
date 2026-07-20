import { providerFor } from '../core/profile'
import { createRegistry } from '../core/registry'
import { vietqrAdapter } from './adapters/vietqr'
import type { PaymentGatewayPort } from './port'

export const paymentRegistry = createRegistry<PaymentGatewayPort>('payment', providerFor('payment'), [
  vietqrAdapter,
])

export type * from './port'
