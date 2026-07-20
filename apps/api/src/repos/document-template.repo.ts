import type { LocalizedText } from '@bingoo.ai/core'
import { db } from '@bingoo.ai/db'
import type { MediaScope, Prisma } from '@bingoo.ai/db'

/**
 * DocumentTemplate (docs/media-library-design.md §6) — server-controlled (R6)
 * blueprint that drives high-quality document generation: the generator fills the
 * declared `sections` as structured output and scores the draft against `rubric`.
 */

export interface TemplateSection {
  key: string
  title: LocalizedText
  instruction: string // guidance the LLM follows for this section
  required?: boolean
  repeatable?: boolean
}

export interface TemplateStyle {
  tone?: string
  gradeBand?: string
  length?: string
}

export interface CreateTemplateInput {
  key: string
  name: LocalizedText
  description?: LocalizedText
  docKind: string
  scope?: MediaScope
  scopeId?: string | null
  locale?: string | null
  sections: TemplateSection[]
  style?: TemplateStyle
  rubric?: string[]
  createdById?: string | null
}

export function createTemplate(input: CreateTemplateInput) {
  return db.documentTemplate.create({
    data: {
      key: input.key,
      name: input.name,
      description: input.description ?? undefined,
      docKind: input.docKind,
      scope: input.scope ?? 'GLOBAL',
      scopeId: input.scopeId ?? null,
      locale: input.locale ?? null,
      sections: input.sections as unknown as Prisma.InputJsonValue,
      style: (input.style ?? undefined) as Prisma.InputJsonValue | undefined,
      rubric: (input.rubric ?? undefined) as Prisma.InputJsonValue | undefined,
      createdById: input.createdById ?? null,
    },
  })
}

export function getTemplateByKey(key: string) {
  return db.documentTemplate.findUnique({ where: { key } })
}

export function getTemplate(id: string) {
  return db.documentTemplate.findUnique({ where: { id } })
}

export function listTemplates(filter: { docKind?: string; scope?: MediaScope } = {}) {
  return db.documentTemplate.findMany({
    where: {
      status: 'active',
      ...(filter.docKind ? { docKind: filter.docKind } : {}),
      ...(filter.scope ? { scope: filter.scope } : {}),
    },
    orderBy: { createdAt: 'desc' },
  })
}

export interface UpdateTemplateInput {
  name?: LocalizedText
  description?: LocalizedText
  sections?: TemplateSection[]
  style?: TemplateStyle
  rubric?: string[]
  status?: string
}

export function updateTemplate(id: string, input: UpdateTemplateInput) {
  return db.documentTemplate.update({
    where: { id },
    data: {
      name: input.name ?? undefined,
      description: input.description ?? undefined,
      sections: (input.sections ?? undefined) as Prisma.InputJsonValue | undefined,
      style: (input.style ?? undefined) as Prisma.InputJsonValue | undefined,
      rubric: (input.rubric ?? undefined) as Prisma.InputJsonValue | undefined,
      status: input.status ?? undefined,
      ...(input.sections ? { version: { increment: 1 } } : {}),
    },
  })
}
