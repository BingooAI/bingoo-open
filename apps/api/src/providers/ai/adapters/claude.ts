import Anthropic from '@anthropic-ai/sdk';
import { readEnv, requireEnv } from '../../core/config';
import type { ProviderAdapter } from '../../core/registry';
import type { AiPort, GenerateTextInput } from '../port';

const REQUIRED = ['ANTHROPIC_API_KEY'] as const;

export const claudeAdapter: ProviderAdapter<AiPort> = {
  key: 'claude',
  requiredEnv: REQUIRED,
  create(): AiPort {
    const env = requireEnv('ai', 'claude', REQUIRED);
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const defaultModel = readEnv('ANTHROPIC_MODEL') ?? 'claude-opus-4-8';
    const defaultMaxTokens = Number(readEnv('ANTHROPIC_MAX_TOKENS')) || 4096;

    const toMessages = (input: GenerateTextInput): Anthropic.MessageParam[] =>
      input.messages.map((m) => ({ role: m.role, content: m.content }));

    return {
      async generateText(input) {
        // NOTE: `temperature` is intentionally not forwarded — claude-opus-4-8
        // (the default) rejects sampling params with a 400. Steer via prompting.
        const res = await client.messages.create(
          {
            model: input.model ?? defaultModel,
            max_tokens: input.maxTokens ?? defaultMaxTokens,
            system: input.system,
            messages: toMessages(input),
          },
          input.signal ? { signal: input.signal } : undefined,
        );
        const text = res.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('');
        return {
          text,
          model: res.model,
          finishReason: res.stop_reason ?? undefined,
          usage: { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens },
        };
      },
      async *streamText(input) {
        const stream = client.messages.stream({
          model: input.model ?? defaultModel,
          max_tokens: input.maxTokens ?? defaultMaxTokens,
          system: input.system,
          messages: toMessages(input),
        });
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            yield event.delta.text;
          }
        }
      },
    };
  },
};
