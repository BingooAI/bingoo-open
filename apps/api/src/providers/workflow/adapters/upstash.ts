import { Client } from '@upstash/workflow'
import { requireEnv } from '../../core/config'
import type { ProviderAdapter } from '../../core/registry'
import type { WorkflowPort } from '../port'

// Upstash Workflow is built on QStash; the client authenticates with QSTASH_TOKEN.
const REQUIRED = ['QSTASH_TOKEN'] as const

export const upstashWorkflowAdapter: ProviderAdapter<WorkflowPort> = {
  key: 'upstash',
  requiredEnv: REQUIRED,
  create(): WorkflowPort {
    const env = requireEnv('workflow', 'upstash', REQUIRED)
    const client = new Client({ token: env.QSTASH_TOKEN })

    return {
      async trigger(input) {
        const res = await client.trigger({
          url: input.url,
          body: input.body,
          headers: input.headers,
          workflowRunId: input.workflowRunId,
          retries: input.retries,
        })
        return { runId: res.workflowRunId }
      },
      async cancel(runId) {
        await client.cancel(runId)
      },
    }
  },
}
