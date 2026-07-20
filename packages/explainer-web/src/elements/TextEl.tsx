/**
 * TextEl.tsx — localized text (spec §9). String comes from the locale bundle
 * (resolved in frame()), so switching locale swaps text with no re-authoring.
 *
 * SIZE COMES FROM THE TYPE SCALE, NOT FROM THE SLOT.
 *
 * Two wrong models were tried and both produce the same complaint — "the sizes
 * aren't relative to each other":
 *
 *   1. absolute theme px (title 64 / label 24) — authored for a 1600-wide canvas
 *      and then rendered inside a 300px slot, so a label became a speck;
 *   2. fit-each-text-to-its-own-slot — a one-word callout in a tall box ballooned
 *      to 3× the size of a longer line in a short box. Rank stopped meaning rank.
 *
 * The right model: a rung (`title`/`body`/`label`…) is a RANK, and rank must map
 * to ONE size everywhere in the lesson. So size = rung × the canvas unit (the
 * canvas's short side — identical, 900, at both 16:9 and 9:16, so a title is the
 * same size in both). Fitting may only ever SHRINK that size, in steps, when a
 * long string would otherwise overflow — never grow it. Rank is therefore
 * preserved by construction: a title always reads bigger than a body, which
 * always reads bigger than a label, in every scene and every aspect.
 */
import * as React from 'react';
import type { RenderItem, TextContent } from '@bingoo/explainer';
import type { ThemeTokens } from '@bingoo/explainer';
import { resolveStyle } from '../theme/tokens';
import { itemTransform, wrapText } from './util';
import { rungSize, MIN_SHRINK } from '@bingoo/explainer';

const BOX_W = 0.96;
const BOX_H = 0.96;

/* The type scale lives in the ENGINE (@bingoo/explainer type.ts), not here —
 * the authoring contract quotes character budgets computed from the SAME numbers
 * the renderer draws with. Two copies would drift, and generation would emit
 * text that overflows a slot the contract swore it fit in. */

/** Start at the rung's size and step DOWN only until the wrapped text fits. */
function fitText(text: string, rect: { w: number; h: number }, ideal: number) {
  const floor = Math.max(12, ideal * MIN_SHRINK);
  for (let size = ideal; size >= floor; size -= 1) {
    const lines = wrapText(text, size, rect.w * BOX_W);
    if (lines.length * size * 1.22 <= rect.h * BOX_H) return { size, lines };
  }
  return { size: floor, lines: wrapText(text, floor, rect.w * BOX_W) };
}

export function TextEl({
  item,
  theme,
  canvas,
}: {
  item: RenderItem;
  theme: ThemeTokens;
  canvas: { w: number; h: number };
}) {
  const c = item.content as TextContent;
  const { transform, opacity } = itemTransform(item);
  const s = resolveStyle(theme, item.style);
  const rung = item.style?.fontSize;
  const { size: fontSize, lines } = fitText(c.text, item.rect, rungSize(rung, canvas));

  const lineH = fontSize * 1.22;
  const totalH = lines.length * lineH;
  const startY = item.rect.h / 2 - totalH / 2 + fontSize * 0.8;
  const anchor = s.align === 'left' ? 'start' : s.align === 'right' ? 'end' : 'middle';
  const x = anchor === 'start' ? 0 : anchor === 'end' ? item.rect.w : item.rect.w / 2;
  const isTitle = rung === 'title' || rung === 'huge';
  const fontWeight = isTitle ? 800 : rung === 'label' ? 700 : 600;

  return (
    <g transform={transform} opacity={opacity}>
      <text
        x={x}
        y={startY}
        fontSize={fontSize}
        fontWeight={fontWeight}
        fill={s.stroke}
        textAnchor={anchor}
        style={{
          userSelect: 'none',
          letterSpacing: isTitle ? '0.01em' : undefined,
          fontFamily: s.fontFamily,
        }}
      >
        {lines.map((ln, i) => (
          <tspan key={i} x={x} dy={i === 0 ? 0 : lineH}>
            {ln}
          </tspan>
        ))}
      </text>
    </g>
  );
}
