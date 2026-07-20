// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * ManipulativeEl.tsx — web SVG renderer for the math kit in the baked player. It
 * draws the platform-neutral `Prim[]` the engine computed, via the shared Prims
 * renderer (prims.tsx), positioned by the pose × laid-out rect transform. No
 * math/animation logic lives here (that's all pure in the engine).
 */
import * as React from 'react'
import type { RenderItem, ManipulativeRenderContent } from '@bingoo.ai/explainer'
import type { ThemeTokens } from '@bingoo.ai/explainer'
import { Prims, computeFit } from './prims'
import { itemTransform } from './util'

export function ManipulativeEl({ item, theme }: { item: RenderItem; theme: ThemeTokens }) {
  const c = item.content as ManipulativeRenderContent
  const { transform, opacity } = itemTransform(item)
  // shrink/center content to the element's box so edge labels never clip
  const fit = computeFit(c.model.prims, { w: item.rect.w, h: item.rect.h })
  return (
    <g transform={transform} opacity={opacity} data-manip={c.manipKind}>
      <Prims prims={c.model.prims} theme={theme} transform={fit?.transform} />
    </g>
  )
}
