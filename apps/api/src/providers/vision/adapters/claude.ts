import Anthropic from '@anthropic-ai/sdk';
import { readEnv, requireEnv } from '../../core/config';
import type { ProviderAdapter } from '../../core/registry';
import type { ExtractTextInput, VisionPort } from '../port';

const REQUIRED = ['ANTHROPIC_API_KEY'] as const;

const DEFAULT_PROMPT =
  'Transcribe ALL text in this document/image faithfully, preserving reading order and structure ' +
  '(headings, lists, tables as text). Output plain text only — no commentary.';

function isPdf(input: ExtractTextInput): boolean {
  return (
    input.mediaType === 'application/pdf' ||
    /^data:application\/pdf/i.test(input.image) ||
    /\.pdf($|\?)/i.test(input.image)
  );
}

/** source (URL | data URI | base64 thô) → khối image HOẶC document (PDF) của Anthropic. */
function sourceBlock(
  input: ExtractTextInput,
): Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam {
  const { image, mediaType } = input;
  const isUrl = /^https?:\/\//i.test(image);
  const dataUri = image.match(/^data:(.+?);base64,(.*)$/);

  // PDF → document block (đọc thẳng, KHÔNG cần rasterize).
  if (isPdf(input)) {
    if (isUrl) return { type: 'document', source: { type: 'url', url: image } };
    return {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: dataUri?.[2] ?? image },
    };
  }

  // Ảnh.
  if (isUrl) return { type: 'image', source: { type: 'url', url: image } };
  const media = (dataUri?.[1] ?? mediaType ?? 'image/png') as
    'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
  return {
    type: 'image',
    source: { type: 'base64', media_type: media, data: dataUri?.[2] ?? image },
  };
}

export const claudeVisionAdapter: ProviderAdapter<VisionPort> = {
  key: 'claude',
  requiredEnv: REQUIRED,
  create(): VisionPort {
    const env = requireEnv('vision', 'claude', REQUIRED);
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const model =
      readEnv('ANTHROPIC_VISION_MODEL') ?? readEnv('ANTHROPIC_MODEL') ?? 'claude-opus-4-8';
    const maxTokens = Number(readEnv('ANTHROPIC_VISION_MAX_TOKENS')) || 4096;

    return {
      async extractText(input) {
        const res = await client.messages.create({
          model,
          max_tokens: maxTokens,
          messages: [
            {
              role: 'user',
              content: [sourceBlock(input), { type: 'text', text: input.prompt ?? DEFAULT_PROMPT }],
            },
          ],
        });
        const text = res.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('');
        return { text, model: res.model };
      },
    };
  },
};
