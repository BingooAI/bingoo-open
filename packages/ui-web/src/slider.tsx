// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import type { ReactNode } from 'react'
import { Label, Slider as AriaSlider, SliderOutput, SliderThumb, SliderTrack } from 'react-aria-components'

export interface SliderProps {
  label?: ReactNode
  value?: number
  defaultValue?: number
  onChange?: (value: number) => void
  minValue?: number
  maxValue?: number
  step?: number
  formatOptions?: Intl.NumberFormatOptions
}

/** Accessible single-thumb slider (keyboard, ARIA, live output) from React Aria. */
export function Slider({
  label,
  value,
  defaultValue = 50,
  onChange,
  minValue = 0,
  maxValue = 100,
  step = 1,
  formatOptions,
}: SliderProps) {
  return (
    <AriaSlider
      value={value}
      defaultValue={defaultValue}
      onChange={(v) => onChange?.(v as number)}
      minValue={minValue}
      maxValue={maxValue}
      step={step}
      formatOptions={formatOptions}
      className="flex w-full flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        {label ? <Label className="text-sm font-medium text-foreground">{label}</Label> : null}
        <SliderOutput className="text-sm tabular-nums text-foreground-muted" />
      </div>
      <SliderTrack className="relative flex h-5 w-full items-center">
        {({ state }) => (
          <>
            <div className="h-2 w-full rounded-full bg-surface-muted" />
            <div
              className="absolute h-2 rounded-full bg-primary"
              style={{ width: `${state.getThumbPercent(0) * 100}%` }}
            />
            <SliderThumb className="top-1/2 size-5 rounded-full border-2 border-primary bg-surface shadow-sm outline-none transition-transform data-[dragging]:scale-110 data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring data-[focus-visible]:ring-offset-2 data-[focus-visible]:ring-offset-background" />
          </>
        )}
      </SliderTrack>
    </AriaSlider>
  )
}
