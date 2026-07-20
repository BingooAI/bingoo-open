import { createHash } from 'node:crypto';
import type { LocalizedText } from '@bingoo/core';
import { db } from '@bingoo/db';
import { getAi, getStorage } from '../providers';
import { initialModeration } from '../lib/media-moderation';
import { extForMime, renditionStorageKey } from '../lib/media-serialize';
import { createAsset, putRendition } from '../repos/media-asset.repo';
import {
  getTemplateByKey,
  type TemplateSection,
  type TemplateStyle,
} from '../repos/document-template.repo';
import { renderPrompt } from '../prompts';
import { enrichAsset } from './media-enrich.service';

/**
 * High-quality document generation (docs/media-library-design.md §6). Driven by a
 * DocumentTemplate — the LLM fills declared sections as STRUCTURED output (not
 * free text), the draft is validated then SCORED against the template rubric and
 * refined once if weak, and finally rendered to Markdown (the canonical source;
 * pdf/docx are derived renditions added later). Moderation follows the shared R5
 * rule (`initialModeration`): PENDING unless the caller may already approve it.
 */

const ACTIVE_STORAGE = process.env.STORAGE_PROVIDER ?? 'r2';
const QUALITY_THRESHOLD = 0.75;

export interface GenerateDocInput {
  templateKey: string;
  inputs: { topic: string; gradeBand?: string; notes?: string; locale?: string };
  folderId?: string | null;
  scope?: 'GLOBAL' | 'ORG' | 'CLASS' | 'COMMUNITY' | 'USER';
  scopeId?: string | null;
  visibility?: 'PRIVATE' | 'SCOPE' | 'PUBLIC';
  createdById?: string | null;
  /** Creator's platform role — decides whether the asset is born PENDING or APPROVED. */
  createdByRole?: string | null;
}

export interface DocQuality {
  score: number;
  issues: string[];
  refined: boolean;
}

export interface GenerateDocResult {
  assetId: string;
  quality: DocQuality;
}

function loc(text: LocalizedText | undefined, locale: string): string {
  if (!text) return '';
  return text[locale] ?? text.en ?? text.vi ?? Object.values(text)[0] ?? '';
}

/** Draft = title + a markdown string per section key. */
interface Draft {
  title: string;
  sections: Record<string, string>;
}

/** Placeholder values for the `media.doc.author` prompt (see prompt catalog). */
function authorVars(
  style: TemplateStyle | undefined,
  locale: string,
  refineIssues?: string[],
): Record<string, string> {
  return {
    locale,
    tone: style?.tone ? `Tone: ${style.tone}.` : '',
    gradeBand: style?.gradeBand ? `Target grade band: ${style.gradeBand}.` : '',
    length: style?.length ? `Length guidance: ${style.length}.` : '',
    refine: refineIssues?.length ? `Revise to fix these issues: ${refineIssues.join('; ')}.` : '',
  };
}

/** The user message: topic/notes + the section spec the model must fill. */
function authorUserMessage(
  sections: TemplateSection[],
  inputs: GenerateDocInput['inputs'],
  locale: string,
): string {
  const sectionSpec = sections
    .map(
      (s) =>
        `- "${s.key}"${s.required ? ' (required)' : ''}: ${loc(s.title, locale)} — ${s.instruction}`,
    )
    .join('\n');
  return [
    `Topic: ${inputs.topic}`,
    inputs.gradeBand ? `Grade band: ${inputs.gradeBand}` : '',
    inputs.notes ? `Notes: ${inputs.notes}` : '',
    '',
    'Sections to fill:',
    sectionSpec,
  ]
    .filter(Boolean)
    .join('\n');
}

function parseJson<T>(text: string): T | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}

function validateDraft(draft: Draft | null, sections: TemplateSection[]): draft is Draft {
  if (!draft || typeof draft.title !== 'string' || !draft.sections) return false;
  for (const s of sections) {
    const val = draft.sections[s.key];
    if (s.required && !(val && val.trim())) return false;
  }
  return true;
}

/** Score a draft against the rubric (verify pass). Returns 1.0 when no rubric. */
async function scoreDraft(
  markdown: string,
  rubric: string[] | undefined,
): Promise<{ score: number; issues: string[] }> {
  if (!rubric?.length) return { score: 1, issues: [] };
  const res = await getAi().generateText({
    system: await renderPrompt('media.doc.score'),
    messages: [
      { role: 'user', content: `Rubric:\n- ${rubric.join('\n- ')}\n\nDocument:\n${markdown}` },
    ],
    maxTokens: 400,
  });
  const parsed = parseJson<{ score: number; issues: string[] }>(res.text);
  if (!parsed || typeof parsed.score !== 'number') return { score: 1, issues: [] };
  return {
    score: Math.max(0, Math.min(1, parsed.score)),
    issues: Array.isArray(parsed.issues) ? parsed.issues : [],
  };
}

function renderMarkdown(draft: Draft, sections: TemplateSection[], locale: string): string {
  const parts = [`# ${draft.title}`];
  for (const s of sections) {
    const content = draft.sections[s.key];
    if (!content) continue;
    // Defensively drop a leading heading the model may have added despite the
    // instruction, so section titles aren't duplicated.
    const body = content.trim().replace(/^#{1,6}\s+.*(?:\r?\n)+/, '');
    parts.push(`\n## ${loc(s.title, locale)}\n\n${body}`);
  }
  return parts.join('\n') + '\n';
}

export async function generateDocument(input: GenerateDocInput): Promise<GenerateDocResult> {
  const template = await getTemplateByKey(input.templateKey);
  if (!template) throw new Error('template not found');
  if (template.status !== 'active') throw new Error('template is not active');

  const sections = template.sections as unknown as TemplateSection[];
  const style = (template.style as TemplateStyle | null) ?? undefined;
  const rubric = (template.rubric as string[] | null) ?? undefined;
  const locale = input.inputs.locale ?? template.locale ?? 'vi';
  const ai = getAi();

  // 1) structured draft (one validation retry)
  const user = authorUserMessage(sections, input.inputs, locale);
  let draft: Draft | null = null;
  for (let attempt = 0; attempt < 2 && !validateDraft(draft, sections); attempt++) {
    const system = await renderPrompt('media.doc.author', authorVars(style, locale));
    const res = await ai.generateText({
      system,
      messages: [{ role: 'user', content: user }],
      maxTokens: 2000,
    });
    draft = parseJson<Draft>(res.text);
  }
  if (!validateDraft(draft, sections))
    throw new Error('failed to produce a valid draft for the template');

  // 2) verify pass → refine once if below threshold
  let markdown = renderMarkdown(draft, sections, locale);
  let { score, issues } = await scoreDraft(markdown, rubric);
  let refined = false;
  if (score < QUALITY_THRESHOLD && issues.length) {
    const system = await renderPrompt('media.doc.author', authorVars(style, locale, issues));
    const res = await ai.generateText({
      system,
      messages: [{ role: 'user', content: user }],
      maxTokens: 2000,
    });
    const revised = parseJson<Draft>(res.text);
    if (validateDraft(revised, sections)) {
      draft = revised;
      markdown = renderMarkdown(draft, sections, locale);
      const rescored = await scoreDraft(markdown, rubric);
      score = rescored.score;
      issues = rescored.issues;
      refined = true;
    }
  }

  // 3) persist as a DOCUMENT asset (moderated per R5), markdown = canonical source
  const moderation = initialModeration(input.createdByRole);
  const asset = await createAsset({
    kind: 'DOCUMENT',
    title: { [locale]: draft.title },
    folderId: input.folderId ?? null,
    scope: input.scope,
    scopeId: input.scopeId ?? null,
    visibility: input.visibility ?? 'SCOPE',
    locale,
    mimeType: 'text/markdown',
    source: 'ai:document',
    createdById: input.createdById ?? null,
    moderation,
  });

  const bytes = new Uint8Array(Buffer.from(markdown, 'utf8'));
  const key = renditionStorageKey(
    asset.scope,
    asset.scopeId,
    asset.id,
    'original',
    extForMime('text/markdown'),
  );
  await getStorage().putObject({ key, body: bytes, contentType: 'text/markdown' });
  await putRendition(asset.id, {
    kind: 'ORIGINAL',
    provider: ACTIVE_STORAGE,
    storageKey: key,
    checksum: createHash('sha256').update(bytes).digest('hex'),
    mimeType: 'text/markdown',
    byteSize: bytes.byteLength,
  });
  await db.mediaAsset.update({
    where: { id: asset.id },
    data: {
      // PROCESSING is "waiting for a moderator"; born-approved docs are already READY.
      status: moderation === 'APPROVED' ? 'READY' : 'PROCESSING',
      metadata: {
        aiGenerated: true,
        generator: {
          provider: 'ai',
          kind: 'document',
          templateKey: template.key,
          inputs: { ...input.inputs },
          quality: { score, issues, refined },
        },
      },
    },
  });
  void enrichAsset(asset.id, moderation === 'APPROVED' ? {} : { embedOnly: true }).catch((e) =>
    console.error('[media.gen-doc] enrich failed', e),
  );

  return { assetId: asset.id, quality: { score, issues, refined } };
}
