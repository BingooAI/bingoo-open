import OpenAI from 'openai'
import { readEnv, requireEnv } from '../../core/config'
import type { ProviderAdapter } from '../../core/registry'
import type { AiPort, GenerateTextInput } from '../port'

const REQUIRED = ['OPENAI_API_KEY'] as const

export const openaiAiAdapter: ProviderAdapter<AiPort> = {
  key: 'openai',
  requiredEnv: REQUIRED,
  create(): AiPort {
    const env = requireEnv('ai', 'openai', REQUIRED)
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY, baseURL: readEnv('OPENAI_BASE_URL') })
    const defaultModel = readEnv('OPENAI_MODEL') ?? 'gpt-4o'
    const defaultMaxTokens = Number(readEnv('OPENAI_MAX_TOKENS')) || undefined

    const toMessages = (input: GenerateTextInput): OpenAI.Chat.ChatCompletionMessageParam[] => {
      const msgs: OpenAI.Chat.ChatCompletionMessageParam[] = []
      if (input.system) msgs.push({ role: 'system', content: input.system })
      for (const m of input.messages) msgs.push({ role: m.role, content: m.content })
      return msgs
    }

    return {
      async generateText(input) {
        const res = await client.chat.completions.create(
          {
            model: input.model ?? defaultModel,
            messages: toMessages(input),
            max_tokens: input.maxTokens ?? defaultMaxTokens,
            temperature: input.temperature,
          },
          input.signal ? { signal: input.signal } : undefined,
        )
        const choice = res.choices[0]
        return {
          text: choice?.message.content ?? '',
          model: res.model,
          finishReason: choice?.finish_reason ?? undefined,
          usage: res.usage
            ? { inputTokens: res.usage.prompt_tokens, outputTokens: res.usage.completion_tokens }
            : undefined,
        }
      },
      async *streamText(input) {
        const stream = await client.chat.completions.create({
          model: input.model ?? defaultModel,
          messages: toMessages(input),
          max_tokens: input.maxTokens ?? defaultMaxTokens,
          temperature: input.temperature,
          stream: true,
        })
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content
          if (delta) yield delta
        }
      },
    }
  },
}
