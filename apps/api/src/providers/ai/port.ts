/**
 * LLM / agent capability. Deliberately a small, vendor-neutral chat surface.
 * NOTE (R5): output shown to children must pass moderation/guardrails at the
 * service layer above this port — adapters return raw model output.
 */
export type AiRole = 'user' | 'assistant';

export interface AiMessage {
  role: AiRole;
  content: string;
}

export interface GenerateTextInput {
  messages: AiMessage[];
  system?: string;
  model?: string;
  maxTokens?: number;
  /**
   * Optional sampling hint. Some providers/models reject it (e.g. Claude Opus
   * 4.8) — those adapters ignore it and steer via prompting instead.
   */
  temperature?: number;
  /**
   * Optional abort signal — lets a long generation be CANCELLED (e.g. a plan-gen
   * job the user aborts). Adapters forward it to the SDK request so the underlying
   * HTTP call is torn down, not just ignored.
   */
  signal?: AbortSignal;
}

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface GenerateTextResult {
  text: string;
  model: string;
  finishReason?: string;
  usage?: AiUsage;
}

export interface AiPort {
  generateText(input: GenerateTextInput): Promise<GenerateTextResult>;
  /** Streams the assistant text incrementally (deltas). */
  streamText(input: GenerateTextInput): AsyncIterable<string>;
}
