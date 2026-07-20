/**
 * dragState.ts — ephemeral hand-off for dragging a media tile onto the canvas.
 * A tile's dragstart stashes its element FACTORY here; PreviewStage's drop reads
 * it, stamps the element at the drop point, and clears it. One shared factory is
 * used for BOTH click-to-add and drag-to-place, so there's no duplicated logic.
 */
import type { Element } from '@bingoo.ai/explainer'

export type ElFactory = (id: string) => { el: Element; text?: string }

export const dragState: { make: ElFactory | null } = { make: null }
