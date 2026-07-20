'use client'

import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  Button as AriaButton,
  ComboBox,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
} from 'react-aria-components'

export interface ComboboxOption {
  id: string
  label: string
}

export interface ComboboxProps {
  label?: ReactNode
  options: ComboboxOption[]
  placeholder?: string
  selectedKey?: string | null
  onSelectionChange?: (key: string | null) => void
}

/** Accessible combobox / autocomplete (filter, keyboard, ARIA) from React Aria. */
export function Combobox({ label, options, placeholder, selectedKey, onSelectionChange }: ComboboxProps) {
  return (
    <ComboBox
      className="flex w-full flex-col gap-1.5"
      items={options}
      selectedKey={selectedKey}
      onSelectionChange={(k) => onSelectionChange?.(k == null ? null : String(k))}
    >
      {label ? <Label className="text-sm font-medium text-foreground">{label}</Label> : null}
      <div className="relative flex items-center">
        <Input
          placeholder={placeholder}
          className="h-11 w-full rounded-2xl border border-border bg-surface pl-4 pr-10 text-sm text-foreground outline-none transition-colors placeholder:text-foreground-muted focus:border-primary focus:ring-2 focus:ring-ring/45"
        />
        <AriaButton className="absolute right-2 grid size-7 place-items-center rounded-lg text-foreground-muted outline-none">
          <ChevronDown className="size-4" aria-hidden />
        </AriaButton>
      </div>
      <Popover className="z-[var(--z-popover)] max-h-60 w-[var(--trigger-width)] overflow-auto rounded-xl border border-border bg-surface p-1 shadow-lg outline-none data-[entering]:animate-[pop-in_.15s_var(--ease-out-soft)]">
        <ListBox
          className="outline-none"
          renderEmptyState={() => <div className="px-3 py-2 text-sm text-foreground-muted">—</div>}
        >
          {(item: ComboboxOption) => (
            <ListBoxItem
              id={item.id}
              textValue={item.label}
              className="cursor-pointer rounded-lg px-3 py-2 text-sm text-foreground outline-none data-[focused]:bg-surface-muted data-[selected]:font-semibold data-[selected]:text-primary"
            >
              {item.label}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </ComboBox>
  )
}
