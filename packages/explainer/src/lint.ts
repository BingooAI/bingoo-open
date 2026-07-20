/**
 * lint.ts — headless validation (spec §17 B9, editor §4.13).
 *
 * Because resolveLayout runs headless, we can check overflow across BOTH aspects
 * and check cue/mark integrity without rendering anything. Runs in the demo's
 * dev overlay and is the same check the editor's lint panel will call.
 */
import type { ExplainerDoc, LocaleBundle, Scene, Rect } from './schema'
import { ExplainerDoc as DocSchema } from './schema'
import { resolveLayout } from './layout'
import { getManipulative, manipulativeKinds } from '@bingoo.ai/manipulatives'

export type LintIssue = {
  level: 'error' | 'warn'
  code: string
  message: string
}

/** Element types whose rects must not collide (they carry readable content).
 *  Scenery (shape/stick/stroke) is decorative and expected to layer. */
const CONTENT_TYPES = new Set(['text', 'diagram', 'manipulative', 'image'])

/** Fraction of the smaller element's area that must be covered to count as a
 *  real overlap (not incidental touching). Catches the orphan-fallback stack
 *  (two unplaced elements land on the identical centered rect → ratio ≈ 1). */
const OVERLAP_RATIO = 0.5

function intersectionArea(a: Rect, b: Rect): number {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
  return x * y
}

/** All narration refs a scene uses (legacy single ref + multi-segment list). */
function narrationRefs(scene: Scene): string[] {
  const refs: string[] = []
  if (scene.narrationRef) refs.push(scene.narrationRef)
  for (const n of scene.narrations ?? []) refs.push(n.ref)
  return refs
}

/** The cue names available to a scene across all its narration segments, per
 *  locale bundle. A beat/action cue must exist in at least one of them. */
function cuesForScene(scene: Scene, bundle: LocaleBundle): Set<string> {
  const cues = new Set<string>()
  for (const ref of narrationRefs(scene)) {
    for (const m of bundle.narration[ref]?.marks ?? []) cues.add(m.cue)
  }
  return cues
}

export function lintDoc(doc: ExplainerDoc, bundles: LocaleBundle[]): LintIssue[] {
  const issues: LintIssue[] = []

  // 1. schema validity
  const parsed = DocSchema.safeParse(doc)
  if (!parsed.success) {
    for (const e of parsed.error.issues)
      issues.push({ level: 'error', code: 'schema', message: `${e.path.join('.')}: ${e.message}` })
    return issues // downstream checks assume a valid shape
  }

  const aspects = ['16:9', '9:16'] as const
  const knownKinds = new Set(manipulativeKinds())

  for (const scene of doc.scenes) {
    // 2. overflow at both aspects. Decorative kit props placed on the ground/sky
    //    (mountains, trees…) are ALLOWED to bleed off the frame like real
    //    scenery; only flag content that must stay fully visible (text/diagram).
    const byId = new Map(scene.elements.map((e) => [e.id, e] as const))
    for (const aspect of aspects) {
      const { rects, overflow } = resolveLayout(scene, aspect)
      for (const id of overflow) {
        const el = byId.get(id)
        const isScenery =
          el?.type === 'shape' && el.place && (el.place.at === 'ground' || el.place.at === 'sky')
        if (isScenery) continue
        issues.push({
          level: 'warn',
          code: 'overflow',
          message: `scene "${scene.id}" · ${aspect}: element "${id}" overflows canvas`,
        })
      }

      // 2b. content elements colliding. Two readable elements sharing the same
      //     space is almost always a layout bug — most commonly the orphan
      //     fallback dropping several unplaced elements onto one centered rect.
      const content = scene.elements.filter((e) => CONTENT_TYPES.has(e.type) && rects.has(e.id))
      for (let i = 0; i < content.length; i++) {
        for (let j = i + 1; j < content.length; j++) {
          const ra = rects.get(content[i]!.id)!,
            rb = rects.get(content[j]!.id)!
          const inter = intersectionArea(ra, rb)
          if (inter <= 0) continue
          const smaller = Math.min(ra.w * ra.h, rb.w * rb.h) || 1
          if (inter / smaller >= OVERLAP_RATIO) {
            issues.push({
              level: 'warn',
              code: 'overlap',
              message: `scene "${scene.id}" · ${aspect}: "${content[i]!.id}" and "${content[j]!.id}" overlap (${Math.round((inter / smaller) * 100)}% of the smaller) — likely unplaced/stacked`,
            })
          }
        }
      }
    }

    // 2c. dangling references & unknown kits/verbs. These render nothing / no-op
    //     TODAY and fail silently (choreographer/frame swallow them), so they are
    //     ERRORS — a lesson referencing a missing id or an invented kit is broken.
    for (const beat of scene.beats ?? []) {
      for (const a of beat.actions) {
        const tgt = 'target' in a ? (a as { target?: string }).target : undefined
        if (tgt !== undefined && !byId.has(tgt))
          issues.push({
            level: 'error',
            code: 'dangling-target',
            message: `scene "${scene.id}" · beat "${beat.id}": action "${a.verb}" targets missing element "${tgt}"`,
          })
        const dia = 'diagram' in a ? (a as { diagram?: string }).diagram : undefined
        if (dia !== undefined && byId.get(dia)?.type !== 'diagram')
          issues.push({
            level: 'error',
            code: 'dangling-diagram',
            message: `scene "${scene.id}" · beat "${beat.id}": "${a.verb}" references "${dia}" which is not a diagram element`,
          })
      }
    }

    // 2d. slide layer: a build verb that points past the end of a list reveals
    //     NOTHING, silently — same class of bug as a dangling target.
    for (const beat of scene.beats ?? []) {
      for (const a of beat.actions) {
        if (a.verb !== 'revealItem') continue
        const el = byId.get(a.target)
        if (!el) continue
        const c = (el.content ?? {}) as { items?: unknown[]; rows?: unknown[]; series?: unknown[] }
        const n = c.items?.length ?? c.rows?.length ?? c.series?.length ?? 0
        if (a.index < 0 || a.index >= n)
          issues.push({
            level: 'error',
            code: 'item-out-of-range',
            message: `scene "${scene.id}" · beat "${beat.id}": revealItem index ${a.index} is outside "${a.target}" (${n} rows) — reveals nothing`,
          })
      }
    }

    for (const el of scene.elements) {
      // slide layer: structure the renderer cannot recover from
      if (el.type === 'chart') {
        const c = (el.content ?? {}) as { series?: { value?: unknown }[] }
        if (!c.series?.length)
          issues.push({
            level: 'error',
            code: 'chart-empty',
            message: `scene "${scene.id}" · chart "${el.id}": no series (renders nothing)`,
          })
        for (const pt of c.series ?? []) {
          if (typeof pt.value !== 'number' || !Number.isFinite(pt.value))
            issues.push({
              level: 'error',
              code: 'chart-value',
              message: `scene "${scene.id}" · chart "${el.id}": a data point has a non-numeric value — the bars would be undrawable`,
            })
        }
      }
      if (el.type === 'table') {
        const c = (el.content ?? {}) as { header?: string[]; rows?: string[][] }
        const cols = c.header?.length ?? c.rows?.[0]?.length ?? 0
        for (const [i, r] of (c.rows ?? []).entries()) {
          if (cols && r.length !== cols)
            issues.push({
              level: 'warn',
              code: 'table-ragged',
              message: `scene "${scene.id}" · table "${el.id}": row ${i + 1} has ${r.length} cells but the table has ${cols} columns`,
            })
        }
      }
      if (el.type === 'list') {
        const c = (el.content ?? {}) as { items?: string[] }
        if (!c.items?.length)
          issues.push({
            level: 'error',
            code: 'list-empty',
            message: `scene "${scene.id}" · list "${el.id}": no items (renders nothing)`,
          })
      }
      // diagram edges must reference declared nodes
      if (el.type === 'diagram') {
        const d = el.content as {
          nodes?: { id: string }[]
          edges?: { id: string; from: string; to: string }[]
        }
        const nodeIds = new Set((d.nodes ?? []).map((n) => n.id))
        for (const e of d.edges ?? []) {
          if (!nodeIds.has(e.from) || !nodeIds.has(e.to))
            issues.push({
              level: 'error',
              code: 'diagram-edge',
              message: `scene "${scene.id}" · diagram "${el.id}": edge "${e.id}" links missing node (${e.from}→${e.to})`,
            })
        }
      }
      // manipulative: kind must exist and every action verb must be a real verb
      if (el.type === 'manipulative') {
        const c = el.content as { kind?: string; actions?: { verb: string }[] }
        const kit = c.kind ? getManipulative(c.kind) : null
        if (!c.kind || !knownKinds.has(c.kind)) {
          issues.push({
            level: 'error',
            code: 'unknown-kind',
            message: `scene "${scene.id}" · "${el.id}": unknown manipulative kind "${c.kind}" (renders nothing)`,
          })
        } else if (kit) {
          for (const a of c.actions ?? []) {
            if (!kit.verbs[a.verb])
              issues.push({
                level: 'error',
                code: 'unknown-verb',
                message: `scene "${scene.id}" · "${el.id}" (${c.kind}): unknown verb "${a.verb}" (ignored at compile)`,
              })
          }
        }
      }
    }

    // 3. competing large motions in one beat (house rule §6.1: "the eye can
    //    follow only one thing"). Multiple reveals are FINE — the choreographer
    //    staggers entrances (§6.1). The real violation is a `move` competing
    //    with another large motion, since moves aren't staggered.
    for (const beat of scene.beats ?? []) {
      const moves = beat.actions.filter((a) => a.verb === 'move').length
      const entrances = beat.actions.filter((a) => a.verb === 'reveal' || a.verb === 'revealNode').length
      if (moves >= 2 || (moves >= 1 && entrances >= 1))
        issues.push({
          level: 'warn',
          code: 'big-motion',
          message: `scene "${scene.id}" · beat "${beat.id}": competing large motions (${moves} move + ${entrances} reveal) — the eye follows one thing`,
        })
    }

    // 4. a gate must define how it's graded. "manipulate" grades params vs
    //    `manip.target`; "activity" carries a `quiz` (core question, self-graded)
    //    or a `manip`; every other gate kind needs an `answer`.
    if (scene.kind === 'gate' && scene.gate) {
      const g = scene.gate
      if (g.kind === 'manipulate') {
        if (!g.manip || g.manip.target === undefined || !g.manip.kind)
          issues.push({
            level: 'error',
            code: 'gate-manip',
            message: `manipulate gate "${scene.id}" missing manip.kind/target`,
          })
        else if (!knownKinds.has(g.manip.kind))
          issues.push({
            level: 'error',
            code: 'gate-manip-kind',
            message: `manipulate gate "${scene.id}": unknown manip kind "${g.manip.kind}"`,
          })
      } else if (g.kind === 'activity') {
        const a = g.activity
        if (!a || (a.quiz === undefined && a.manip === undefined))
          issues.push({
            level: 'error',
            code: 'gate-activity',
            message: `activity gate "${scene.id}" needs activity.quiz or activity.manip`,
          })
        else if (a.manip && !knownKinds.has(a.manip.kind))
          issues.push({
            level: 'error',
            code: 'gate-activity-kind',
            message: `activity gate "${scene.id}": unknown manip kind "${a.manip.kind}"`,
          })
      } else if (g.answer === undefined || g.answer === '') {
        issues.push({
          level: 'error',
          code: 'gate-answer',
          message: `gate scene "${scene.id}" missing answer`,
        })
      }
    }
  }

  // 5. cue integrity (cue-first sync §5): every beat cue AND every timed
  //    manipulative action (`at:"@cN"`) must have a matching narration mark in
  //    every locale. Covers legacy `narrationRef` AND multi-segment `narrations`.
  //    A missing mark means the visual silently falls back to the previous
  //    activity time (mis-synced), so it's a warn, not a hard error.
  for (const bundle of bundles) {
    for (const scene of doc.scenes) {
      if (narrationRefs(scene).length === 0) continue
      const cues = cuesForScene(scene, bundle)
      for (const beat of scene.beats ?? []) {
        if (!cues.has(beat.cue))
          issues.push({
            level: 'warn',
            code: 'missing-cue',
            message: `locale "${bundle.locale}" · scene "${scene.id}": beat cue "${beat.cue}" has no mark`,
          })
      }
      for (const el of scene.elements) {
        if (el.type !== 'manipulative') continue
        const c = el.content as { actions?: { at?: string }[] }
        for (const a of c.actions ?? []) {
          if (!a.at) continue // untimed actions auto-sequence — no cue needed
          const cue = a.at.replace(/^@/, '')
          if (!cues.has(cue))
            issues.push({
              level: 'warn',
              code: 'missing-cue',
              message: `locale "${bundle.locale}" · scene "${scene.id}" · "${el.id}": action cue "${cue}" has no mark`,
            })
        }
      }
    }
  }

  return issues
}
