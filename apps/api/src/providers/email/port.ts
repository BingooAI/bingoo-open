/** Transactional email capability. */
export interface SendEmailInput {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  /** Overrides the provider's default sender. */
  from?: string
  replyTo?: string
  cc?: string | string[]
  bcc?: string | string[]
}

export interface EmailPort {
  send(input: SendEmailInput): Promise<{ id: string }>
}
