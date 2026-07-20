import { readEnv } from '../core/config'
import { createRegistry } from '../core/registry'
import { upstashWorkflowAdapter } from './adapters/upstash'
import type { WorkflowPort } from './port'

export const workflowRegistry = createRegistry<WorkflowPort>(
  'workflow',
  readEnv('WORKFLOW_PROVIDER') ?? 'upstash',
  [upstashWorkflowAdapter],
)

export type * from './port'
