/**
 * Durable background workflow capability (Upstash Workflow today). Triggers a
 * deployed workflow endpoint to run asynchronously and reliably (with retries).
 */
export interface WorkflowTriggerInput {
  /** URL of the deployed workflow endpoint to execute. */
  url: string
  body?: unknown
  headers?: Record<string, string>
  /** Provide to make the run idempotent / addressable for cancellation. */
  workflowRunId?: string
  retries?: number
}

export interface WorkflowPort {
  trigger(input: WorkflowTriggerInput): Promise<{ runId: string }>
  cancel(runId: string): Promise<void>
}
