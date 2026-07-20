'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  Controller,
  useForm,
  type FieldValues,
  type Resolver,
  type UseFormProps,
  type UseFormReturn,
} from 'react-hook-form'
import type { z } from 'zod'

// Re-export the controlled-input bridge for non-native fields (Select, Checkbox…).
export { Controller }

/**
 * react-hook-form wired to a zod schema — typed to the schema's input/output.
 * Use the returned `register` / `handleSubmit` / `formState.errors` as usual;
 * validation runs from the shared zod schema (see `@bingoo/contracts` later).
 */
export function useZodForm<TIn extends FieldValues, TOut extends FieldValues = TIn>(
  schema: z.ZodType<TOut, TIn>,
  options?: Omit<UseFormProps<TIn, unknown, TOut>, 'resolver'>,
): UseFormReturn<TIn, unknown, TOut> {
  return useForm<TIn, unknown, TOut>({
    ...options,
    resolver: zodResolver(schema) as Resolver<TIn, unknown, TOut>,
  })
}
