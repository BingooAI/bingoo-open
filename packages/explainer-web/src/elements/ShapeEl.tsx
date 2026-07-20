/**
 * ShapeEl.tsx — thin adapter: resolves style tokens, builds a PropCtx, and
 * delegates drawing to the shared prop kit (src/kit/props.tsx). All the visual
 * variety + internal animation lives in the kit, so scenes just reference a
 * prop by name (spec §8, §12: element/verb is a shared, extendable kit).
 */
import * as React from 'react';
import type { RenderItem, ShapeContent } from '@bingoo/explainer';
import type { ThemeTokens } from '@bingoo/explainer';
import { resolveStyle } from '../theme/tokens';
import { getProp, type PropCtx } from '../kit/props';
import { itemTransform } from './util';

export function ShapeEl({ item, theme }: { item: RenderItem; theme: ThemeTokens }) {
  const c = item.content as ShapeContent;
  const { transform, opacity } = itemTransform(item);
  const s = resolveStyle(theme, item.style);
  const draw = item.pose.drawProgress;

  const ctx: PropCtx = {
    w: item.rect.w,
    h: item.rect.h,
    stroke: s.stroke,
    fill: s.fill === 'none' ? 'none' : s.fill,
    strokeWidth: s.strokeWidth,
    t: item.t,
    seed: item.seed,
    draw,
    fillOpacity: draw !== undefined ? draw : 1,
  };

  return (
    <g transform={transform} opacity={opacity}>
      {getProp(c.shape)(ctx)}
      {c.text ? (
        <text
          x={item.rect.w / 2}
          y={item.rect.h / 2 + s.fontSize * 0.35}
          fontSize={s.fontSize * 0.8}
          fill={s.stroke}
          textAnchor="middle"
          style={{ userSelect: 'none', fontFamily: s.fontFamily }}
        >
          {c.text}
        </text>
      ) : null}
    </g>
  );
}
