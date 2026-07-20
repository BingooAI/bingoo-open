'use client';

import { getNet, netBounds, type NetDef, type Solid3DName } from '@bingoo/core';
import { GeoShape } from './geo-shape';
import { cn } from './lib/cn';
import { stagger, tile, tileState } from './lib/interactive';

export interface NetPickerProps {
  /** pick = which net folds into this solid? name = which solid does this net make? */
  task?: 'pick' | 'name';
  /** pick: the target solid, shown in 3D (turn it to see every face). */
  solid?: Solid3DName;
  /** pick: the nets to choose from (ids from `NET_LIBRARY`). */
  options?: string[];
  /** name: the net shown. */
  net?: string;
  /** name: the solids to choose from. */
  solidOptions?: Solid3DName[];
  /** Localized names for the solids — the component itself is i18n-free. */
  solidLabels?: Partial<Record<Solid3DName, string>>;
  value: string | null;
  onChange: (choice: string) => void;
  reveal?: { correct: boolean; answer: string | null };
  disabled?: boolean;
  className?: string;
}

/** Draw a net — flat polygons + circles, scaled to fit its box. */
export function NetShape({
  net,
  size = 110,
  className,
}: {
  net: NetDef;
  size?: number;
  className?: string;
}) {
  const b = netBounds(net);
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  const pad = 0.15;
  return (
    <svg
      viewBox={`${b.minX - pad} ${b.minY - pad} ${w + 2 * pad} ${h + 2 * pad}`}
      width={size}
      height={(size * (h + 2 * pad)) / (w + 2 * pad)}
      className={className}
    >
      {net.polys.map((poly, i) => (
        <polygon
          key={i}
          points={poly.map(([x, y]) => `${x},${y}`).join(' ')}
          className="fill-primary-soft stroke-primary"
          strokeWidth={0.05}
          strokeLinejoin="round"
        />
      ))}
      {(net.circles ?? []).map((c, i) => (
        <circle
          key={i}
          cx={c.cx}
          cy={c.cy}
          r={c.r}
          className="fill-primary-soft stroke-primary"
          strokeWidth={0.05}
        />
      ))}
    </svg>
  );
}

/**
 * Nets — match the flat shape to the solid it folds into, or name the solid a net makes.
 * The right answer is derived from `NET_LIBRARY` in `@bingoo/core`, never authored, and
 * the distractors are real nets that fold into nothing. Tap-based → web + mobile.
 */
export function NetPicker({
  task = 'pick',
  solid,
  options = [],
  net,
  solidOptions = [],
  solidLabels,
  value,
  onChange,
  reveal,
  disabled,
  className,
}: NetPickerProps) {
  const locked = !!reveal || disabled;

  const tone = (id: string) =>
    cn(
      tile({
        state: tileState({
          selected: value === id,
          revealed: !!reveal,
          correct: reveal?.correct,
          missed: reveal?.answer === id,
        }),
        size: 'none',
      }),
      'p-2 motion-safe:animate-fade-up',
    );

  return (
    <div className={cn('flex flex-col items-center gap-5', className)}>
      {/* what you are looking at */}
      {task === 'pick' && solid ? <GeoShape kind="3d" name={solid} size={150} rotatable /> : null}
      {task === 'name' && net && getNet(net) ? (
        <div className={cn(tile({ state: 'quiet', size: 'none' }), 'p-3')}>
          <NetShape net={getNet(net)!} size={160} />
        </div>
      ) : null}

      {/* what you choose from */}
      {task === 'pick' ? (
        <div className="flex flex-wrap justify-center gap-3">
          {options.map((id, i) => {
            const def = getNet(id);
            if (!def) return null;
            return (
              <button
                key={id}
                type="button"
                disabled={locked}
                onClick={() => onChange(id)}
                style={stagger(i)}
                className={tone(id)}
              >
                <NetShape net={def} size={110} />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-3">
          {solidOptions.map((name, i) => (
            <button
              key={name}
              type="button"
              disabled={locked}
              onClick={() => onChange(name)}
              style={stagger(i)}
              className={cn(tone(name), 'flex flex-col items-center gap-1 px-3')}
            >
              <GeoShape kind="3d" name={name} size={84} rotatable={false} />
              <span className="text-sm font-semibold text-foreground">
                {solidLabels?.[name] ?? name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
