'use client'

import type { ReactNode } from 'react'
import { Label, Radio, RadioGroup as AriaRadioGroup } from 'react-aria-components'

export interface RadioOption {
  value: string
  label: ReactNode
  description?: ReactNode
  isDisabled?: boolean
}

export interface RadioGroupProps {
  label?: ReactNode
  options: RadioOption[]
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  name?: string
  orientation?: 'vertical' | 'horizontal'
  isDisabled?: boolean
}

/** Accessible radio group (arrow-key nav, single selection) from React Aria. */
export function RadioGroup({
  label,
  options,
  value,
  defaultValue,
  onChange,
  name,
  orientation = 'vertical',
  isDisabled,
}: RadioGroupProps) {
  return (
    <AriaRadioGroup
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      name={name}
      orientation={orientation}
      isDisabled={isDisabled}
      className="flex flex-col gap-2 data-[orientation=horizontal]:flex-row data-[orientation=horizontal]:gap-4"
    >
      {label ? <Label className="text-sm font-medium text-foreground">{label}</Label> : null}
      {options.map((o) => (
        <Radio
          key={o.value}
          value={o.value}
          isDisabled={o.isDisabled}
          className="group flex cursor-pointer items-start gap-2 text-sm text-foreground outline-none data-[disabled]:cursor-default data-[disabled]:opacity-50"
        >
          <span className="mt-0.5 grid size-5 place-items-center rounded-full border-2 border-border-strong transition-colors group-data-[selected]:border-primary group-data-[focus-visible]:ring-2 group-data-[focus-visible]:ring-ring group-data-[focus-visible]:ring-offset-2 group-data-[focus-visible]:ring-offset-background">
            <span className="size-2.5 scale-0 rounded-full bg-primary transition-transform group-data-[selected]:scale-100" />
          </span>
          <span className="flex flex-col">
            <span>{o.label}</span>
            {o.description ? <span className="text-xs text-foreground-muted">{o.description}</span> : null}
          </span>
        </Radio>
      ))}
    </AriaRadioGroup>
  )
}
