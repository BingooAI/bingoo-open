// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Image generation capability. (R5): generated images shown to children must be
 * moderated at the service layer before delivery.
 */
export interface GenerateImageInput {
  prompt: string
  model?: string
  /** e.g. "1024x1024". */
  size?: string
  count?: number
  /** Alpha handling — 'transparent' yields a real alpha channel (sprites/overlays).
   *  Only honoured by models that support it (e.g. gpt-image-1); ignored otherwise. */
  background?: 'transparent' | 'opaque' | 'auto'
  /** Abort the underlying provider call (e.g. a cancelled background job). */
  signal?: AbortSignal
}

export interface GeneratedImage {
  b64?: string
  url?: string
}

export interface GenerateImageResult {
  images: GeneratedImage[]
  model: string
}

export interface ImagePort {
  generate(input: GenerateImageInput): Promise<GenerateImageResult>
}
