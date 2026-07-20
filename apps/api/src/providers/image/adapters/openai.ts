import OpenAI from 'openai';
import { readEnv, requireEnv } from '../../core/config';
import type { ProviderAdapter } from '../../core/registry';
import type { ImagePort } from '../port';

const REQUIRED = ['OPENAI_API_KEY'] as const;

export const openaiImageAdapter: ProviderAdapter<ImagePort> = {
  key: 'openai',
  requiredEnv: REQUIRED,
  create(): ImagePort {
    const env = requireEnv('image', 'openai', REQUIRED);
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY, baseURL: readEnv('OPENAI_BASE_URL') });
    const defaultModel = readEnv('OPENAI_IMAGE_MODEL') ?? 'gpt-image-1';
    const defaultSize = readEnv('OPENAI_IMAGE_SIZE') ?? '1024x1024';

    return {
      async generate(input) {
        const model = input.model ?? defaultModel;
        const res = await client.images.generate(
          {
            model,
            prompt: input.prompt,
            size: (input.size ?? defaultSize) as OpenAI.Images.ImageGenerateParams['size'],
            n: input.count,
            // Only gpt-image-1 accepts `background`; sending it to other models errors,
            // so pass it through only when the caller asked for a specific handling.
            ...(input.background
              ? { background: input.background as OpenAI.Images.ImageGenerateParams['background'] }
              : {}),
          },
          input.signal ? { signal: input.signal } : {},
        );
        const images = (res.data ?? []).map((d) => ({ b64: d.b64_json, url: d.url }));
        return { images, model };
      },
    };
  },
};
