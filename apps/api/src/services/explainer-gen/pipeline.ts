// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * gen/pipeline.ts — the multi-stage lesson generator (studio-owned quality).
 *
 *   OUTLINE → WRITE → CRITIC → REGEN(weak scenes)
 *
 * Why multi-stage (vs one 16k-token call): each stage is small, validated, and
 * locally repairable — a weak scene is rewritten alone, not the whole lesson.
 * The CRITIC is engine-aware (it judges sync, one-idea-per-beat, and whether a
 * gate tests an objective the lesson actually taught) — knowledge only the
 * studio has. Every stage is BEST-EFFORT: if outline/critic/regen fail, the
 * pipeline still returns the validated WRITE output, so it is never worse than
 * the single-shot path. Pedagogy still comes from the LessonBrief (upstream).
 */
import { parseDoc, parseBundle, lintDoc } from '@bingoo.ai/explainer'
import type { ExplainerDoc, LocaleBundle } from '@bingoo.ai/explainer'
import { briefPromptSections, AUDIENCE_PROFILES, planForScenes } from '@bingoo.ai/explainer'
import type { LessonBrief } from '@bingoo.ai/explainer'
import { extractJson } from './json'
import { checkScene, checkLesson } from '@bingoo.ai/explainer'
import { Outline, Critique, RegenResult, REGEN_THRESHOLD } from './schemas'

export type LlmLike = {
  complete(req: {
    system: string
    messages: { role: 'user' | 'assistant'; content: string }[]
    maxTokens?: number
  }): Promise<string>
}
export type GenStep = (id: string, status: 'run' | 'done' | 'error', note?: string) => void
/** An APPROVED question pulled from the ContentItem bank for reuse in a gate. */
export type BankItem = {
  skills: string[]
  primitiveKind: string
  difficulty: number
  /** a @bingoo.ai/core QuizQuestion, valid as `gate.activity.quiz` verbatim */
  payload: unknown
}

export type GenDeps = {
  llm: LlmLike
  rules: string
  manifest: string
  wantImages: boolean
  assetsPresent: boolean
  langName: string
  /** Optional: fetch APPROVED, calibrated questions from the content bank for a
   *  set of skill slugs. Absent (tests, banks not mounted) → the writer authors
   *  every question from scratch, exactly as before. */
  bank?: (skills: string[]) => Promise<BankItem[]>
}
export type GenResult = {
  doc: ExplainerDoc
  bundle: LocaleBundle
  report: string
  outline: Outline | null
}

const LINT_ERR = (doc: ExplainerDoc, b: LocaleBundle) =>
  lintDoc(doc, [b])
    .filter((i) => i.level === 'error')
    .map((e) => `${e.code}: ${e.message}`)

/** Total error count across ALL gates the writer must pass — lint + per-scene
 *  layout + lesson arc/richness. Used to guard regen: a rewrite that fixes a
 *  pedagogy note but breaks layout or makes a scene static must be rejected, not
 *  just one that adds a lint error. Same gates checkLesson/checkScene enforce on
 *  import, so the final output can never fall below what WRITE guaranteed. */
const GATE_ERR = (doc: ExplainerDoc, b: LocaleBundle, locale: string) =>
  LINT_ERR(doc, b).length +
  doc.scenes.reduce(
    (n, sc) => n + checkScene(sc, b.strings, locale).filter((f) => f.level === 'error').length,
    0,
  ) +
  checkLesson(doc, b).filter((f) => f.level === 'error').length

/* ------------------------------------------------------------- prompts */

/** Build the reuse block: for each objective that carries skills, the APPROVED
 *  bank questions the writer must place verbatim in that objective's gate. Empty
 *  when no bank is mounted or nothing matches — then the writer authors freely. */
async function bankBlock(brief: LessonBrief, deps: GenDeps): Promise<string> {
  if (!deps.bank) return ''
  const parts: string[] = []
  for (const o of brief.objectives) {
    if (!o.skills.length) continue
    let items: BankItem[] = []
    try {
      items = await deps.bank(o.skills)
    } catch {
      items = []
    }
    if (!items.length) continue
    parts.push(
      `Objective [${o.id}] "${o.statement}" — reuse ONE of these exact payloads as \`gate.activity.quiz\`:\n` +
        items
          .slice(0, 4)
          .map((it) => `  ${JSON.stringify(it.payload)}`)
          .join('\n'),
    )
  }
  if (!parts.length) return ''
  return (
    'APPROVED QUESTION BANK — these questions are already moderated and difficulty-calibrated for the named objectives. When you write a gate that assesses one of these objectives, set `gate.activity.quiz` to one of its EXACT payloads below (copy verbatim; do NOT invent a new question when a bank question fits). Only author a fresh question if none suits the gate. The scene AROUND the question (narration, beats, layout) is still yours to compose.\n\n' +
    parts.join('\n\n')
  )
}

function writeSystem(brief: LessonBrief, deps: GenDeps, bank = ''): string {
  const profile = AUDIENCE_PROFILES[brief.audience.stage]
  return [
    `You are an expert author of interactive whiteboard explainer LESSONS, writing for ${profile.learner}. You output ONLY a single JSON object with exactly two keys: \`doc\` (an ExplainerDoc) and \`bundle\` (a LocaleBundle). No prose, no markdown fences.`,
    ...briefPromptSections(brief),
    // THE authoring contract — the SAME text that `promptMarkdown()` generates
    // for the file the author downloads and pastes into ChatGPT. It is built
    // entirely from source (kit registry + defaultParams/verbs/enums, the 55
    // quiz shapes, arcGuide + RICHNESS, the SFX catalogue, the layout contract,
    // and the gold reference lesson), so nothing here is hand-copied and it can
    // never drift from the engine or the gate. The server writer and the
    // downloadable prompt are now ONE source of truth.
    'Follow this authoring contract EXACTLY:\n\n' + deps.rules,
    // Deployment-specific: whether THIS install may spend money generating
    // pictures, and whether an asset library is mounted. Not part of the generic
    // contract because it depends on the runtime, not the engine.
    deps.wantImages
      ? 'ILLUSTRATIONS: for STORY objects (the thing being counted, a character, a real-world referent) add `image` elements with `content:{"query":"<description>","tags":[...],"alt":"<caption>","prompt":"<English gen fallback>"}` and NO `src` — the studio searches the media library first and generates only as a fallback. Use them GENEROUSLY; place semantically via `region`; animate via beats; NEVER put a query/prompt on a manipulative.'
      : 'Compose visuals from manipulatives, stick figures and props' +
        (deps.assetsPresent ? ', plus `image` elements whose `content.src` is an ASSET LIBRARY url.' : '.'),
    'OUTPUT: a single JSON object {doc, bundle}. Everything the learner reads lives in the bundle (strings + narration), never hardcoded in the doc. The result MUST pass lintDoc, the per-scene layout gate, AND the lesson gate (arc + richness) with 0 errors — those run on your output before it is accepted.',
    bank,
  ]
    .filter(Boolean)
    .join('\n\n---\n\n')
}

function writeUser(brief: LessonBrief, deps: GenDeps, outline: Outline | null): string {
  const plan = outline
    ? `Follow this approved outline EXACTLY (same scene ids, kinds and order); flesh each scene out:\n${outline.scenes.map((s, i) => `${i + 1}. [${s.id}] ${s.kind} — ${s.goal}${s.objectiveIds.length ? ` (objectives: ${s.objectiveIds.join(',')})` : ''}${s.suggest ? ` · use: ${s.suggest}` : ''}`).join('\n')}\n\n`
    : ''
  return (
    plan +
    `Write the lesson in ${deps.langName} on: "${brief.topic}". ` +
    `Each teaching scene uses the most fitting manipulative/diagram for the SUBJECT strategy (one kit per scene, driven by verbs at cues); include at least 1 auto-graded manipulate gate and 1 quiz gate placed right after the material they test; end with a summary scene restating each objective as something the learner can now do. ` +
    `All narration/strings/prompts/feedback in ${deps.langName}, in the AUDIENCE voice.` +
    (brief.constraints.register ? ` Theme register: "${brief.constraints.register}".` : '') +
    ` Return JSON {doc, bundle}.`
  )
}

/** The exact WRITE-stage prompt the pipeline sends — exposed so you can dump it
 *  and paste it into ANY LLM playground to generate a lesson by hand, then
 *  validate the result. `outline` is optional guidance. */
export function buildWritePrompt(
  brief: LessonBrief,
  deps: GenDeps,
  outline: Outline | null = null,
): { system: string; user: string } {
  return { system: writeSystem(brief, deps), user: writeUser(brief, deps, outline) }
}

/* ------------------------------------------------------------- stages */

/** OUTLINE — a validated scene plan tied to objectives. Best-effort. */
async function makeOutline(brief: LessonBrief, deps: GenDeps): Promise<Outline | null> {
  // The SAME plan the writer's contract and checkDoc use — so the outline never
  // asks for fewer scenes than the arc gate then demands (which would make WRITE
  // fail every retry). The brief's sceneCount is lifted to the arc floor here.
  const plan = planForScenes(brief.constraints.sceneCount)
  const system = [
    `You are a lesson architect for ${AUDIENCE_PROFILES[brief.audience.stage].learner}. Plan the scenes BEFORE any wording. Output ONLY JSON matching { "scenes": [{ "id", "kind":"exposition"|"gate", "goal", "objectiveIds":[], "suggest" }] }. No prose.`,
    ...briefPromptSections(brief),
    `Rules: one idea per scene; teach an objective before a gate assesses it; ~${plan.scenes} scenes across the 8-phase arc (explore → orient → teach → formalize → guided → practice → recap → checkout), incl. an opening hook, teaching scenes, ≥1 manipulate gate + 1 quiz gate placed right after their material, and a summary. \`suggest\` names a manipulative kind or "diagram:flow|cycle|tree" from the manifest.`,
    'Manifest of valid kinds (names only):\n' + deps.manifest,
  ].join('\n\n---\n\n')
  try {
    const out = await deps.llm.complete({
      system,
      messages: [
        {
          role: 'user',
          content: `Plan ~${plan.scenes} scenes for: "${brief.topic}". Return ONLY the outline JSON.`,
        },
      ],
      maxTokens: 2000,
    })
    const r = Outline.safeParse(extractJson(out))
    return r.success ? r.data : null
  } catch {
    return null
  }
}

/** WRITE — the full doc+bundle, guided by the outline. Required; up to 3 tries
 *  where parse/lint failures are fed back for repair. */
async function writeLesson(
  brief: LessonBrief,
  deps: GenDeps,
  outline: Outline | null,
): Promise<{ doc: ExplainerDoc; bundle: LocaleBundle }> {
  const system = writeSystem(brief, deps, await bankBlock(brief, deps))
  const user = writeUser(brief, deps, outline)
  let out = '',
    lastErr = ''
  for (let attempt = 0; attempt < 3; attempt++) {
    const messages =
      attempt === 0
        ? [{ role: 'user' as const, content: user }]
        : [
            { role: 'user' as const, content: user },
            { role: 'assistant' as const, content: out },
            {
              role: 'user' as const,
              content: `The JSON is invalid:\n${lastErr}\nReturn ONLY valid JSON {doc, bundle} with 0 lint errors. Keep the lesson's ideas.`,
            },
          ]
    out = await deps.llm.complete({ system, messages, maxTokens: 16000 })
    try {
      const raw = extractJson(out) as { doc?: unknown; bundle?: unknown }
      const doc = parseDoc(raw.doc)
      const bundle = parseBundle({ ...(raw.bundle as object), locale: brief.locales[0] })
      const errs = LINT_ERR(doc, bundle)
      if (errs.length) throw new Error('lint errors:\n' + errs.join('\n'))
      // The LAYOUT GATE — measured against the same resolveLayout the renderer
      // uses, at BOTH aspects. Each finding carries a mechanical `fix`, so the
      // retry is a repair instruction rather than "try again and hope".
      const layout = doc.scenes.flatMap((sc) =>
        checkScene(sc, bundle.strings, brief.locales[0])
          .filter((f) => f.level === 'error')
          .map(
            (f) =>
              `scene "${sc.id}"${f.elementId ? ` · "${f.elementId}"` : ''}: ${f.message}\n  FIX: ${f.fix}`,
          ),
      )
      if (layout.length) throw new Error('layout errors:\n' + layout.join('\n'))
      // The DOC-LEVEL gate — the SAME checkLesson() that runs on import. It
      // catches what per-scene checks can't see: a missing arc phase, too few
      // distinct templates/kits/quiz types, and the "static-scene" poverty case
      // (voice covers many ideas, screen barely moves). Running it here means the
      // server never emits a lesson that import would then reject.
      const doclvl = checkLesson(doc, bundle)
        .filter((f) => f.level === 'error')
        .map((f) => `${f.code}: ${f.message}${f.fix ? `\n  FIX: ${f.fix}` : ''}`)
      if (doclvl.length) throw new Error('lesson errors:\n' + doclvl.join('\n'))
      return { doc, bundle }
    } catch (e) {
      lastErr = String((e as Error).message)
    }
  }
  throw new Error(lastErr || 'write failed')
}

/** A compact per-scene digest the judge reads (cheaper + more focused than raw
 *  JSON): the narration, the beats' cues, and the elements/gate in play. */
function digest(doc: ExplainerDoc, bundle: LocaleBundle, brief: LessonBrief): string {
  const objectives = brief.objectives.map((o) => `[${o.id}] ${o.statement}`).join('; ')
  const scenes = doc.scenes
    .map((s) => {
      const refs = [s.narrationRef, ...(s.narrations ?? []).map((n) => n.ref)].filter(Boolean) as string[]
      const script = refs
        .map((r) => bundle.narration[r]?.script ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
      const marks = new Set(refs.flatMap((r) => (bundle.narration[r]?.marks ?? []).map((m) => m.cue)))
      const els = s.elements
        .map((e) =>
          e.type === 'manipulative' ? `manip:${(e.content as { kind?: string })?.kind ?? '?'}` : e.type,
        )
        .join(',')
      const beatCues = (s.beats ?? []).map((b) => b.cue).join(',')
      const gate = s.gate
        ? `GATE ${s.gate.kind}${s.gate.manip ? `(${s.gate.manip.kind})` : ''}: ${s.gate.prompt ?? ''}`
        : ''
      // richness signals for the judge: does the scene compose a whiteboard?
      const verbs = (s.beats ?? []).flatMap((b) => b.actions.map((a) => a.verb))
      const rich =
        s.kind === 'exposition'
          ? ` | rich: stick=${s.elements.some((e) => e.type === 'stick') ? 'y' : 'N'} scenery=${s.elements.filter((e) => e.type === 'shape').length} callouts=${s.elements.filter((e) => e.type === 'text').length} verbs=[${[...new Set(verbs)].join(',') || 'none'}]`
          : ''
      return `- [${s.id}] ${s.kind} | els: ${els || '—'} | beats@cues: ${beatCues || '—'} | marks: ${[...marks].join(',') || '—'}${rich}\n    narration: ${script.slice(0, 240)}${gate ? `\n    ${gate}` : ''}`
    })
    .join('\n')
  return `OBJECTIVES: ${objectives}\n\nSCENES:\n${scenes}`
}

/** CRITIC — an engine-aware LLM-judge. Best-effort; on any failure returns an
 *  empty critique (→ no regen), so it never blocks a valid lesson. */
async function critique(
  doc: ExplainerDoc,
  bundle: LocaleBundle,
  brief: LessonBrief,
  deps: GenDeps,
): Promise<Critique> {
  const system = [
    `You are a strict pedagogy AND visual-direction reviewer for ${AUDIENCE_PROFILES[brief.audience.stage].learner}. Score EACH scene 1–5 and output ONLY JSON { "scenes":[{"id","score","issues":[],"fix"}], "overall" }. No prose.`,
    "Score against: (1) SYNC — every beat cue has a narration mark and one big idea per beat; (2) TEACHING — the scene shows a worked example before asking, in the audience's voice, advancing its objective; (3) GATES — a gate must test an objective the lesson TAUGHT EARLIER and its target must be reachable by the kit; (4) PACING/CLARITY for this audience; (5) VISUAL RICHNESS — an exposition scene that is just a single manipulative + a caption, with NO stick character (rich:stick=N), NO scenery (scenery=0), NO callout labels revealing the reasoning (callouts≤1), or NO emphasis/move/drawOn verbs, is a SKELETON — score it ≤2 and set `fix` to add: a `stick` teacher who points/reacts on cue, an ambient scenery frame, callout labels that reveal one idea per cue, and emphasis on the focal element (per AUTHORING §11).",
    "Also flag: a quiz that tests untaught material, a manipulative whose verbs don't match its narration, missing summary of objectives, or a misconception never addressed. The `rich:` line per scene tells you what's present — a low count there is a real defect, not a nitpick.",
  ].join('\n\n---\n\n')
  // fold hard-lint warnings in as objective signal for the judge
  const warns = lintDoc(doc, [bundle])
    .filter((i) => i.level === 'warn')
    .map((w) => `${w.code}: ${w.message}`)
  // arc/richness signal the LLM-judge can't see from the digest alone — a scene
  // that only borderline-tracks the voice, a thin phase, a lesson running short.
  // Errors are already impossible here (WRITE blocks on them); these are the
  // sub-threshold warns, and folding them in points regen at the real weak spots.
  const rich = checkLesson(doc, bundle)
    .filter((f) => f.level === 'warn')
    .map((f) => `${f.code}: ${f.message}`)
  const user =
    digest(doc, bundle, brief) +
    (warns.length ? `\n\nLINT WARNINGS (fix the referenced scenes):\n${warns.join('\n')}` : '') +
    (rich.length ? `\n\nARC/RICHNESS NOTES (fix the referenced scenes):\n${rich.join('\n')}` : '') +
    `\n\nMISCONCEPTIONS to have addressed: ${brief.misconceptions.join('; ') || '(none given)'}`
  try {
    const out = await deps.llm.complete({
      system,
      messages: [{ role: 'user', content: user }],
      maxTokens: 3000,
    })
    const r = Critique.safeParse(extractJson(out))
    return r.success ? r.data : { scenes: [], overall: '' }
  } catch {
    return { scenes: [], overall: '' }
  }
}

/** REGEN — rewrite only the flagged scenes, splice them back by id so untouched
 *  scenes stay identical. Best-effort + guarded: the result is kept ONLY if it
 *  parses and has no MORE lint errors than before. */
async function regen(
  doc: ExplainerDoc,
  bundle: LocaleBundle,
  brief: LessonBrief,
  deps: GenDeps,
  weak: { id: string; fix: string; issues: string[] }[],
): Promise<{ doc: ExplainerDoc; bundle: LocaleBundle }> {
  const ids = new Set(weak.map((w) => w.id))
  const targets = doc.scenes.filter((s) => ids.has(s.id))
  if (targets.length === 0) return { doc, bundle }
  const locale = brief.locales[0] ?? 'en'
  const beforeErr = GATE_ERR(doc, bundle, locale)

  const system = [
    `You improve specific scenes of an existing explainer lesson for ${AUDIENCE_PROFILES[brief.audience.stage].learner}. Output ONLY JSON { "scenes":[{ "id", "scene":<full Scene object>, "strings":{elId:text}, "narration":{narrRef:{script,voice,marks,...}} }] } — one entry per scene id you were asked to fix. Keep each scene's id, kind, and cue names (c1..cN) STABLE. No prose.`,
    'Follow these authoring rules EXACTLY:\n\n' + deps.rules,
    'Valid kinds/verbs/params (never invent):\n\n' + deps.manifest,
    "The `strings` are that scene's element texts; `narration` are the scene's narration entries keyed by ref (script with [[cue:cN]] markers + a `marks` array giving each cue a scene-local time). Every beat/action cue MUST have a mark.",
  ].join('\n\n---\n\n')
  const ask = weak
    .map((w) => `[${w.id}] issues: ${w.issues.join('; ') || '(see fix)'} → FIX: ${w.fix}`)
    .join('\n')
  const ctx = targets.map((s) => `SCENE ${s.id} (current):\n${JSON.stringify(s)}`).join('\n\n')
  try {
    const out = await deps.llm.complete({
      system,
      messages: [
        {
          role: 'user',
          content: `Language: ${deps.langName}.\nRewrite ONLY these scenes to fix the problems:\n${ask}\n\n${ctx}\n\nReturn ONLY the replacement JSON.`,
        },
      ],
      maxTokens: 8000,
    })
    const r = RegenResult.safeParse(extractJson(out))
    if (!r.success || r.data.scenes.length === 0) return { doc, bundle }

    const repl = new Map(r.data.scenes.map((s) => [s.id, s]))
    const scenes = doc.scenes.map((s) => (repl.has(s.id) ? (repl.get(s.id)!.scene ?? s) : s))
    let strings = { ...bundle.strings }
    let narration: Record<string, unknown> = { ...bundle.narration }
    for (const s of r.data.scenes) {
      strings = { ...strings, ...s.strings }
      narration = { ...narration, ...s.narration }
    }

    const doc2 = parseDoc({ ...doc, scenes })
    const bundle2 = parseBundle({ ...bundle, strings, narration })
    // guard: never accept a regen that adds errors to ANY gate (lint, layout, or
    // arc/richness) — a "fix" that makes a scene static is worse than the note.
    if (GATE_ERR(doc2, bundle2, locale) > beforeErr) return { doc, bundle }
    return { doc: doc2, bundle: bundle2 }
  } catch {
    return { doc, bundle }
  }
}

/* ------------------------------------------------------------- orchestrator */

export async function generateLesson(brief: LessonBrief, deps: GenDeps, step: GenStep): Promise<GenResult> {
  // ① OUTLINE (best-effort — a plan the writer follows)
  step('outline', 'run')
  const outline = await makeOutline(brief, deps)
  step(
    'outline',
    outline ? 'done' : 'error',
    outline ? `${outline.scenes.length} scene` : 'bỏ qua (dùng cấu trúc mặc định)',
  )

  // ② WRITE (required)
  step('write', 'run')
  let { doc, bundle } = await writeLesson(brief, deps, outline)
  step('write', 'done')

  // ③ CRITIC (best-effort, engine-aware)
  step('critic', 'run')
  const crit = await critique(doc, bundle, brief, deps)
  const weak = crit.scenes
    .filter((s) => s.score <= REGEN_THRESHOLD)
    .map((s) => ({ id: s.id, fix: s.fix, issues: s.issues }))
  step(
    'critic',
    'done',
    weak.length
      ? `${weak.length}/${doc.scenes.length} scene cần cải thiện`
      : `đạt (${crit.scenes.length} scene chấm)`,
  )

  // ④ REGEN weak scenes only (best-effort, guarded)
  if (weak.length) {
    step('regen', 'run')
    const before = JSON.stringify(doc.scenes.filter((s) => weak.some((w) => w.id === s.id)))
    ;({ doc, bundle } = await regen(doc, bundle, brief, deps, weak))
    const after = JSON.stringify(doc.scenes.filter((s) => weak.some((w) => w.id === s.id)))
    step(
      'regen',
      'done',
      before !== after ? `đã cải thiện ${weak.length} scene` : 'giữ nguyên (bản mới không tốt hơn)',
    )
  }

  const report = [
    crit.overall,
    ...crit.scenes.map((s) => `[${s.id}] ${s.score}/5${s.issues.length ? ' — ' + s.issues.join('; ') : ''}`),
  ]
    .filter(Boolean)
    .join('\n')
  return { doc, bundle, report, outline }
}
