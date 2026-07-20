import { providerFor } from '../core/profile'
import { createRegistry } from '../core/registry'
import { upstashWorkflowAdapter } from './adapters/upstash'
import type { WorkflowPort } from './port'

export const workflowRegistry = createRegistry<WorkflowPort>('workflow', providerFor('workflow'), [
  upstashWorkflowAdapter,
])

export type * from './port'
