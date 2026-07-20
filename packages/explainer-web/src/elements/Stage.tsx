/**
 * Stage.tsx — the web SVG renderer. Consumes a platform-neutral RenderModel
 * (spec §2, §7.2) and paints it to SVG. This is the ONLY place web drawing
 * happens; the editor preview and learner player both go through here, so
 * WYSIWYG is real (editor §1). The RN player swaps this for a Skia renderer.
 *
 * It paints in LAYERS, and the layers are what make a scene look composed
 * instead of "small and empty":
 *   1. backdrop  — atmosphere (framed art from the library, or a built-in)
 *   2. cards     — a panel behind each object's CELL, so objects read as grouped
 *   3. items     — the content
 *   4. chrome    — header (lesson + progress) and the caption band
 * Layers 1, 2 and 4 are reserved by the LAYOUT engine, so content can never
 * collide with them.
 */
import * as React from 'react';
import type { RenderModel, RenderItem } from '@bingoo/explainer';
import type { ThemeTokens } from '@bingoo/explainer';
import { CARD_SLOTS } from '@bingoo/explainer';
import { Stroke } from './Stroke';
import { TextEl } from './TextEl';
import { ShapeEl } from './ShapeEl';
import { Stick } from './Stick';
import { DiagramEl } from './DiagramEl';
import { ManipulativeEl } from './ManipulativeEl';
import { ImageEl } from './ImageEl';
import { ConnectorEl } from './ConnectorEl';
import { Backdrop } from './Backdrop';
import { Header, CaptionBand, SlotCard } from './Chrome';
import { ListEl, TableEl, ChartEl, StatEl, QuoteEl } from './SlideEls';

function ElementView({
  item,
  theme,
  canvas,
}: {
  item: RenderItem;
  theme: ThemeTokens;
  canvas: { w: number; h: number };
}) {
  switch (item.content.kind) {
    case 'connector':
      return <ConnectorEl item={item} theme={theme} />;
    case 'stroke':
      return <Stroke item={item} theme={theme} />;
    case 'text':
      return <TextEl item={item} theme={theme} canvas={canvas} />;
    case 'shape':
      return <ShapeEl item={item} theme={theme} />;
    case 'stick':
      return <Stick item={item} theme={theme} />;
    case 'diagram':
      return <DiagramEl item={item} theme={theme} />;
    case 'manipulative':
      return <ManipulativeEl item={item} theme={theme} />;
    case 'image':
      // media library image (R2 URL / local path / data-URI), embeddable in the
      // whiteboard like any element (reveal/move/emphasize/ambient all apply).
      return <ImageEl item={item} theme={theme} />;
    // ── slide layer ──
    case 'list':
      return <ListEl item={item} theme={theme} canvas={canvas} />;
    case 'table':
      return <TableEl item={item} theme={theme} canvas={canvas} />;
    case 'chart':
      return <ChartEl item={item} theme={theme} canvas={canvas} />;
    case 'stat':
      return <StatEl item={item} theme={theme} canvas={canvas} />;
    case 'quote':
      return <QuoteEl item={item} theme={theme} canvas={canvas} />;
    default:
      return null;
  }
}

/** Text is set ON the card, not IN a card of its own — a box around a title is
 *  clutter. Cards go behind objects that occupy their cell. */
function wantsCard(item: RenderItem): boolean {
  if (!item.cell || !item.slot) return false;
  // A box drawn around a title or a pull-quote is clutter — text is SET on the
  // card, it doesn't get one of its own. Cards go behind objects that occupy
  // their cell: a stage, a chart, a table, a picture, a bulleted block.
  if (item.type === 'text' || item.type === 'connector' || item.type === 'quote') return false;
  return CARD_SLOTS.has(item.slot);
}

export function Stage({
  model,
  theme,
  className,
  skipIds,
  chrome = true,
  caption = true,
}: {
  model: RenderModel;
  theme: ThemeTokens;
  className?: string;
  /** element ids to omit — e.g. an interactive manipulative drawn by an overlay */
  skipIds?: Set<string>;
  /** draw the header (off for thumbnails and editor previews) */
  chrome?: boolean;
  /**
   * Draw the caption band. OFF in the player, which renders its own caption as
   * HTML so it can highlight the word being spoken from the TTS timings. Both
   * drawing it meant every line of narration appeared TWICE, on top of itself.
   */
  caption?: boolean;
}) {
  const { canvas } = model;
  const unit = Math.min(canvas.w, canvas.h);
  const visible = model.items.filter((i) => !skipIds?.has(i.id));

  return (
    <svg
      className={className}
      viewBox={`0 0 ${canvas.w} ${canvas.h}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', width: '100%', height: '100%' }}
      role="img"
      aria-label={model.caption ?? model.lessonTitle}
    >
      <Backdrop
        bg={model.background}
        theme={theme}
        aspect={model.aspect}
        canvas={canvas}
        frame={model.chrome.frame}
      />

      {visible.filter(wantsCard).map((item) => (
        <SlotCard key={`card-${item.id}`} cell={item.cell!} theme={theme} />
      ))}

      {visible.map((item) => (
        <ElementView key={item.id} item={item} theme={theme} canvas={canvas} />
      ))}

      {chrome ? (
        <Header
          rect={model.chrome.header}
          title={model.lessonTitle}
          index={model.sceneIndex}
          count={model.sceneCount}
          theme={theme}
          unit={unit}
        />
      ) : null}
      {chrome && caption ? (
        <CaptionBand rect={model.chrome.caption} text={model.caption} theme={theme} unit={unit} />
      ) : null}
    </svg>
  );
}
