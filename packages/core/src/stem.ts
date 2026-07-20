// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Shared media + rich-content schema — the ONE place that defines what a picture, a
 * sound, a clip or a block of prose looks like, so every learning primitive AND the
 * content blocks speak the same language.
 *
 * Lives in its own module (imported by both `quiz.ts` and `content.ts`) so there is no
 * import cycle and no second, drifting definition. Pure Zod → it serialises to JSON and
 * is stored verbatim in the DB (`ContentItem.payload`), so adding to it here needs no
 * migration.
 */
import { z } from 'zod'

/** How a single asset is referenced — a library id (preferred) or a resolved URL. */
const assetRef = {
  assetId: z
    .string()
    .min(1)
    .optional()
    .describe('Media-library asset id (preferred — the server resolves it to a URL).'),
  src: z.string().url().optional().describe('Resolved or external absolute URL.'),
  alt: z.string().optional().describe('Alt text (image/video) or a transcript hint (audio).'),
  caption: z.string().optional().describe('Optional caption shown with the media.'),
}

/** A single piece of media — an image, a sound clip, or a short video. */
export const MediaResource = z
  .object({
    kind: z.enum(['image', 'audio', 'video']).describe('What kind of media this is.'),
    ...assetRef,
  })
  .superRefine((m, ctx) => {
    if (!m.assetId && !m.src)
      ctx.addIssue({
        code: 'custom',
        message: 'media needs assetId (library) or src (external) — at least one',
      })
  })
export type MediaResource = z.infer<typeof MediaResource>

/**
 * A rich block — the building unit of a question's `body` (its stem). A stem is an
 * ordered list of these, so a listening question can be "a line of text, then an audio
 * clip, then a picture", exactly like a page of content.
 */
export const RichBlock = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('text'),
      text: z.string().min(1).describe('A paragraph of text. Plain text, one idea.'),
      emphasis: z
        .enum(['normal', 'lead', 'quote'])
        .optional()
        .describe('normal body (default), a larger lead line, or a quoted aside.'),
    })
    .describe('A paragraph of prose in the question body.'),
  z.object({ type: z.literal('image'), ...assetRef }).describe('A picture in the question body.'),
  z
    .object({ type: z.literal('audio'), ...assetRef })
    .describe('A sound clip in the question body (listening tasks).'),
  z.object({ type: z.literal('video'), ...assetRef }).describe('A short video in the question body.'),
  z
    .object({
      type: z.literal('list'),
      ordered: z.boolean().optional().describe('true = numbered, false/omitted = bulleted.'),
      items: z.array(z.string().min(1)).min(1).describe('The list items.'),
    })
    .describe('A bulleted or numbered list in the question body.'),
])
export type RichBlock = z.infer<typeof RichBlock>

/** Every media/prose block a question's body carries a `src` OR an `assetId`. */
function refineBlockAsset(b: RichBlock, ctx: z.RefinementCtx, i: number) {
  if (b.type === 'image' || b.type === 'audio' || b.type === 'video') {
    if (!b.assetId && !b.src)
      ctx.addIssue({
        code: 'custom',
        path: [i],
        message: `${b.type} block needs assetId (library) or src (external)`,
      })
  }
}

/**
 * A question's rich body — text, pictures, sound and video, in order. Optional: a plain
 * `prompt` string is still enough for a simple question. This is what makes "listen and
 * point to the picture" possible on ANY primitive, not just multiple-choice.
 */
export const Stem = z
  .array(RichBlock)
  .superRefine((blocks, ctx) => blocks.forEach((b, i) => refineBlockAsset(b, ctx, i)))
  .describe('Rich question body — an ordered mix of text, images, audio and video.')
export type Stem = z.infer<typeof Stem>
