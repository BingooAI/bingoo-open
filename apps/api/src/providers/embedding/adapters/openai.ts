// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import OpenAI from 'openai'
import { readEnv, requireEnv } from '../../core/config'
import type { ProviderAdapter } from '../../core/registry'
import type { EmbeddingPort } from '../port'

const REQUIRED = ['OPENAI_API_KEY'] as const

// Native output dimensions per model. The media_embedding column is vector(1536),
// so the default (text-embedding-3-small) matches without a `dimensions` override.
const MODEL_DIM: Record<string, number> = {
  'text-embedding-3-small': 1536,
  'text-embedding-3-large': 3072,
  'text-embedding-ada-002': 1536,
}

export const openaiEmbeddingAdapter: ProviderAdapter<EmbeddingPort> = {
  key: 'openai',
  requiredEnv: REQUIRED,
  create(): EmbeddingPort {
    const env = requireEnv('embedding', 'openai', REQUIRED)
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY, baseURL: readEnv('OPENAI_BASE_URL') })
    const model = readEnv('EMBEDDING_MODEL') ?? 'text-embedding-3-small'
    const dim = MODEL_DIM[model] ?? 1536

    return {
      dim,
      async embed(input) {
        const res = await client.embeddings.create({ model, input: input.texts })
        return {
          vectors: res.data.map((d) => d.embedding),
          model: res.model,
          dim,
        }
      },
    }
  },
}
