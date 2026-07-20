/**
 * engine/brief.ts — LessonBrief: the REQUIRED input contract for lesson generation.
 *
 * The studio does not decide pedagogy. An upstream engine (curriculum planner,
 * content-ops tool, bingoo API…) owns grounding, fact verification, objective
 * design and quality review — and feeds the studio a LessonBrief. The studio's
 * job at this boundary is to VALIDATE the brief, translate it into generation
 * constraints (prompts, pacing, theme), and stamp its provenance on the output
 * doc. Nothing downstream may hardcode an audience, subject or language.
 *
 * Contract rules (see docs/INPUT-CONTRACT.md for the upstream-facing spec):
 *  - `parseBrief` is the single entry point; an invalid brief is rejected with
 *    structured issues, never "fixed up" silently.
 *  - Facts in `facts[]` are ALREADY VERIFIED upstream (FR-G-03 lives there);
 *    generation must narrate around them verbatim and never re-compute.
 *  - `source.grounding === "strict"` means every claim must come from
 *    `source.materials`; the studio enforces that materials exist.
 *  - AUDIENCE_PROFILES / SUBJECT_STRATEGIES are studio-owned lookup data keyed
 *    by the brief's enums — the upstream engine only picks a key.
 *
 * Pure TS + zod only. No platform imports (this file ships with the engine
 * package when the studio is embedded in a host app).
 */
import { z } from 'zod'

/* ------------------------------------------------------------------ schema */

export const AudienceStage = z.enum(['preschool', 'primary', 'middle', 'high', 'adult'])
export type AudienceStage = z.infer<typeof AudienceStage>

export const Objective = z.object({
  id: z.string().min(1),
  /** One observable learning outcome ("Learner can tell time to the half hour"). */
  statement: z.string().min(1),
  /** Optional cognitive level tag (bloom-ish: remember|understand|apply|analyze). */
  level: z.string().optional(),
  /** Must at least one gate assess this objective? Default true. */
  assess: z.boolean().default(true),
  /** Skill slugs this objective anchors to. When present, the generator pulls
   *  APPROVED, difficulty-calibrated questions from the ContentItem bank for
   *  these skills and REUSES them verbatim in the gate — instead of authoring a
   *  fresh, unmoderated question. Optional: upstream supplies them when known. */
  skills: z.array(z.string()).default([]),
})
export type Objective = z.infer<typeof Objective>

export const SourceMaterial = z.object({
  id: z.string().min(1),
  kind: z.enum(['text', 'curriculum', 'standard', 'url']).default('text'),
  title: z.string().optional(),
  /** The material body. For kind:"url" this is the FETCHED text — the studio
   *  never fetches; the upstream engine resolves URLs before feeding. */
  content: z.string().min(1),
})
export type SourceMaterial = z.infer<typeof SourceMaterial>

export const BriefAsset = z.object({
  id: z.string().min(1),
  /** Renderable URL (R2/CDN/host path). The upstream asset library owns bytes,
   *  moderation and licensing; the studio only references. */
  url: z.string().min(1),
  /** What the asset depicts — the writer matches assets to content by this. */
  label: z.string().min(1),
  /** Optional routing hints ("animal", "phonics:a", "money:vnd"…). */
  tags: z.array(z.string()).default([]),
})
export type BriefAsset = z.infer<typeof BriefAsset>

export const VerifiedFact = z.object({
  id: z.string().min(1),
  /** The fact, stated exactly as it may be narrated ("7:30 is half past seven"). */
  statement: z.string().min(1),
  /** Machine-usable value when the fact is numeric ("value": 12). */
  value: z.union([z.string(), z.number()]).optional(),
  /** Upstream verification note ("solver", "curriculum p.14") — provenance only. */
  verifiedBy: z.string().optional(),
})
export type VerifiedFact = z.infer<typeof VerifiedFact>

export const LessonBrief = z
  .object({
    version: z.literal('brief/v1'),
    /** Lesson working title / topic sentence. */
    topic: z.string().min(1),
    /** BCP-47-ish locale codes; first is the authoring language. */
    locales: z.array(z.string().min(2)).min(1),
    audience: z.object({
      stage: AudienceStage,
      /** Optional finer grain: grade label ("3", "K2", "year 5"). */
      grade: z.string().optional(),
      ageRange: z.tuple([z.number(), z.number()]).optional(),
    }),
    subject: z.object({
      /** Free domain key; SUBJECT_STRATEGIES matches known keys, else `default`. */
      domain: z.string().min(1),
      /** Upstream notes for the writer ("focus on quarter hours, no 24h clock"). */
      notes: z.string().optional(),
    }),
    /** ≥1 required — a lesson without objectives cannot be assessed. */
    objectives: z.array(Objective).min(1),
    source: z
      .object({
        materials: z.array(SourceMaterial).default([]),
        /**
         * strict  — every claim must come from materials (requires ≥1 material)
         * prefer  — ground in materials when they cover the point, else general
         * open    — materials are inspiration only (also valid with none)
         */
        grounding: z.enum(['strict', 'prefer', 'open']).default('prefer'),
      })
      .default({ materials: [], grounding: 'open' }),
    /** Pre-verified computational/factual anchors (verified UPSTREAM, FR-G-03). */
    facts: z.array(VerifiedFact).default([]),
    /** Curated, already-moderated media the lesson SHOULD compose from
     *  (image elements + kit `assets` maps). When present and imagePolicy is
     *  not "rich", the writer uses these instead of asking for generated art. */
    assets: z.array(BriefAsset).default([]),
    /** Misconceptions to pre-empt in teaching and to use as MCQ distractors. */
    misconceptions: z.array(z.string()).default([]),
    /** What the learner is assumed to already know. */
    priorKnowledge: z.array(z.string()).default([]),
    assessment: z
      .object({
        /** Extra question-bank gates to request (0 disables the quiz stage). */
        extraGateCount: z.number().int().min(0).max(6).optional(),
        difficulty: z.enum(['intro', 'practice', 'challenge']).default('practice'),
      })
      .default({ difficulty: 'practice' }),
    constraints: z
      .object({
        sceneCount: z.number().int().min(3).max(12).default(6),
        register: z.enum(['warm', 'clean']).optional(),
        imagePolicy: z.enum(['none', 'sparing', 'rich']).default('sparing'),
      })
      .default({ sceneCount: 6, imagePolicy: 'sparing' }),
  })
  .superRefine((b, ctx) => {
    // `code: "custom"` (string literal) is stable across zod v3.25 and v4;
    // the v3 `z.ZodIssueCode.custom` enum was removed in v4.
    if (b.source.grounding === 'strict' && b.source.materials.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['source', 'materials'],
        message: 'grounding "strict" requires at least one source material',
      })
    }
    const ids = new Set<string>()
    for (const o of b.objectives) {
      if (ids.has(o.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['objectives'],
          message: `duplicate objective id "${o.id}"`,
        })
      }
      ids.add(o.id)
    }
  })
export type LessonBrief = z.infer<typeof LessonBrief>

/** Boundary API: never throws. Invalid input → structured issues for the caller
 *  (the upstream engine) to fix — the studio does not repair briefs. */
export type BriefParse =
  { ok: true; brief: LessonBrief } | { ok: false; issues: { path: string; message: string }[] }
export function parseBrief(raw: unknown): BriefParse {
  const r = LessonBrief.safeParse(raw)
  if (r.success) return { ok: true, brief: r.data }
  return {
    ok: false,
    issues: r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  }
}

/* -------------------------------------------------------- audience profiles */
/**
 * Studio-owned pedagogy knobs per stage. `learner` / `voice` / `feedback` are
 * English prompt fragments (prompts are authored in English); numeric knobs
 * drive pacing hints and theme scaling. Extend by adding a stage — no call
 * site enumerates stages.
 */
export type AudienceProfile = {
  label: string
  /** Who the learner is, for the writer's role line. */
  learner: string
  /** Vocabulary + sentence guidance. */
  language: string
  /** Narration persona and tone. */
  voice: string
  /** How correct/wrong feedback should sound. */
  feedback: string
  /** Target pace: seconds of narration per beat/idea. */
  paceSecPerBeat: number
  /** Multiplier applied to theme fontSizes (bigger for younger learners). */
  fontScale: number
  /** Interaction guidance for gates. */
  interaction: string
}

export const AUDIENCE_PROFILES: Record<AudienceStage, AudienceProfile> = {
  preschool: {
    label: 'Mầm non (3–5)',
    learner: 'a preschool child (age 3–5) who cannot read yet',
    language:
      'Use only everyday spoken words a 4-year-old knows. One idea per sentence, max ~8 words. Repeat key words. Never rely on on-screen text to carry meaning — the narration must say everything.',
    voice:
      "A warm, playful kindergarten teacher. Frequent direct address ('con', 'bạn nhỏ'), sing-song rhythm, lots of encouragement.",
    feedback:
      "Celebrate every attempt. Wrong answers get a cheerful nudge and a concrete hint ('Đếm lại cùng cô nhé — một, hai…'), never the word 'sai'.",
    paceSecPerBeat: 4.5,
    fontScale: 1.3,
    interaction:
      'One very simple action per gate (tap one thing, drag one thing). Options ≤ 3, each option must be understandable from the picture alone.',
  },
  primary: {
    label: 'Tiểu học (6–10)',
    learner: 'a primary-school child (age 6–10)',
    language:
      'Short, concrete sentences (~12 words). Introduce at most 1–2 new terms per lesson and define each with an example the child has seen in real life.',
    voice:
      "A friendly primary-school teacher. Ask small check-in questions ('Em thấy gì nào?'), use familiar objects for examples.",
    feedback:
      'Encouraging and specific: say what was right in the attempt, then one hint that points at the method, not the answer.',
    paceSecPerBeat: 3,
    fontScale: 1,
    interaction: 'Hands-on manipulate gates preferred over multiple choice. Options ≤ 4.',
  },
  middle: {
    label: 'THCS (11–14)',
    learner: 'a middle-school student (age 11–14)',
    language:
      'Clear explanatory prose; correct subject terminology introduced with a plain-language gloss the first time. Avoid babyish phrasing.',
    voice:
      "An engaging subject teacher. Motivate each concept with 'why it matters' or a real problem before the definition.",
    feedback:
      "Respectful and diagnostic: name the likely mistake ('Có vẻ em đổi nhầm đơn vị') and point back to the step that fixes it.",
    paceSecPerBeat: 2.8,
    fontScale: 0.95,
    interaction:
      'Mix manipulate and reasoning gates; multiple-choice distractors must each encode a specific known misconception.',
  },
  high: {
    label: 'THPT (15–18)',
    learner: 'a high-school student (age 15–18)',
    language:
      'Precise academic language with correct notation and units. Compress the obvious, expand the subtle. Connect to exam-style applications.',
    voice:
      'A sharp, respectful teacher who treats the learner as capable. Rhetorical questions that set up the next step.',
    feedback:
      "Direct and analytical: state what's wrong, why, and the principle that decides it. No cheerleading filler.",
    paceSecPerBeat: 2.6,
    fontScale: 0.9,
    interaction:
      'Gates should require applying the idea to a new case, not recalling the example just shown.',
  },
  adult: {
    label: 'Người đi làm',
    learner: 'an adult professional learner',
    language:
      "Concise professional prose. Lead with the takeaway, then the mechanism. Use the domain's standard terminology without apology; define only genuinely niche terms.",
    voice:
      "A competent peer/trainer. No classroom mannerisms, no exclamation-mark enthusiasm. Respect the learner's time.",
    feedback:
      'Matter-of-fact: correct answer, why the chosen option fails in practice, and when the distinction matters on the job.',
    paceSecPerBeat: 2.4,
    fontScale: 0.85,
    interaction:
      'Prefer scenario/process gates (sequence, decision diagrams, predict-check on a realistic case) over toy manipulatives.',
  },
}

/* -------------------------------------------------------- subject strategies */
/**
 * Teaching-move guidance per subject domain. Matched by exact key, else
 * `default`. Deliberately advisory (prompt text), not code branches — adding a
 * domain is adding data.
 */
export type SubjectStrategy = {
  label: string
  moves: string
  kits: string
  gates: string
}

export const SUBJECT_STRATEGIES: Record<string, SubjectStrategy> = {
  math: {
    label: 'Toán',
    moves:
      "Follow concrete → pictorial → abstract: show the idea with objects/manipulatives first, then the notation. Every new step is demonstrated once ('cô làm'), then done together ('cùng làm'), before the gate asks the learner to do it alone.",
    kits: 'Prefer the specialised math kits over text, matched to the audience stage — preschool/grade 1: pattern, subitize, comparegroups, ordinal, sizeorder, addstory, count, tenframe; primary: numberline, base10, partwhole, placevalue, fraction, arrayarea, barmodel, clock, money; middle school: integerchips, ratiotable, factortree, algebratile, equationbalance, functionmachine; high school: trianglelab, transformgrid, unitcircle, probtree, statplot, calculusgraph, graph. One kit per teaching scene, driven by verbs at cues.',
    gates:
      'Manipulate gates with a code-checkable target. MCQ distractors = the standard wrong procedures (off-by-one, place-value slip, inverted fraction), not random numbers.',
  },
  literacy: {
    label: 'Tiếng Việt / Ngữ văn',
    moves:
      'Model → guided practice → independent use. Show the pattern in a real sentence before naming the rule. Recycle the same example words across scenes so the learner tracks one thing changing.',
    kits: 'Use phonics, vocabcard, rhymetime, wordbuilder, syllable, wordmatch, sentence, wordclass, punctuation, tense, morpheme, story kits; keep example words age-appropriate and consistent.',
    gates:
      'Sequence gates for word/sentence building; select gates where distractors are plausible misspellings or misuses actually made at this age.',
  },
  science: {
    label: 'Khoa học',
    moves:
      'Start from an observable phenomenon or question, elicit a prediction, then explain the mechanism, then return to the phenomenon with the new lens. Name the cause-effect chain explicitly.',
    kits: 'Use states, circuit, forces, lifecycle, foodchain, orbit, thermometer, shadow kits and `diagram` (cycle/flow) for processes.',
    gates:
      "Predict-check gates before the reveal; sequence gates for process order; misconception-based distractors (e.g. 'heavier falls faster').",
  },
  language: {
    label: 'Ngoại ngữ',
    moves:
      'Comprehensible input first: present the new form in a meaningful mini-context, contrast it with a known form, then drill production. Keep L1 scaffolding only where the brief allows.',
    kits: 'Match kits to level — beginners/children: vocabcard (picture-word), rhymetime, minimalpair (pronunciation contrast), wordmatch, phonics, wordbuilder, sentence, tense; exam prep (IELTS/TOEFL/TOEIC): cloze (gap-fill passages), wordform (word families), collocation, paraphrase (synonym alignment), stresspattern; professional/business: dialogue (functional exchanges), registerscale (formality), essaymap (structured writing). Pair new words with a picture (vocabcard assets or image element) when imagePolicy allows.',
    gates:
      'Production over recognition where gradable: wordbuilder/sentence/cloze/collocation manipulate gates; listening-style select gates keyed to narration.',
  },
  social: {
    label: 'Lịch sử / Địa lý / Xã hội',
    moves:
      'Anchor on a concrete story, place or person before generalising. Timelines and cause-effect diagrams carry the structure; keep dates/names to the ones in the objectives.',
    kits: 'Use `diagram` (timeline/flow/tree) as the backbone; story kit for narrative sequences; image elements for real referents when imagePolicy allows.',
    gates:
      "Sequence gates on chronology/causality; hotspot gates on the diagram; select gates on 'which came first / what caused what'.",
  },
  professional: {
    label: 'Kỹ năng nghề nghiệp',
    moves:
      'Problem-first: open with the realistic situation where this knowledge earns its keep, teach the decision procedure, then run a worked scenario end-to-end. State edge cases and when-not-to-use.',
    kits: 'Use `diagram` (flow with decision branches, cycle, grid) as the primary visual; tables for comparisons; keep whiteboard props minimal and businesslike.',
    gates:
      "Scenario predict-check and sequence gates ('what do you do next'); distractors = tempting-but-costly real-world choices.",
  },
  default: {
    label: 'Chung',
    moves:
      'One idea per beat. Motivate before defining. Show a worked example before asking the learner to act. Close by restating each objective as something the learner can now do.',
    kits: 'Choose the manipulative or diagram that makes the invisible visible; never use a wall of text where a kit exists.',
    gates: 'Every gate must test an objective that was explicitly taught earlier in THIS lesson.',
  },
}

export function strategyFor(domain: string): SubjectStrategy {
  return SUBJECT_STRATEGIES[domain] ?? SUBJECT_STRATEGIES.default!
}

/* ------------------------------------------------------- prompt compilation */

const MATERIAL_CHAR_CAP = 6000 // per material
const MATERIALS_TOTAL_CAP = 24000 // across all materials

function clamp(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n) + '\n…[truncated]'
}

/**
 * Compile the brief into named prompt sections. The route joins these into the
 * system prompt; nothing in the route re-states audience/subject/grounding by
 * hand. All fragments are English (prompt language), content stays in the
 * brief's own language.
 */
export function briefPromptSections(brief: LessonBrief): string[] {
  const p = AUDIENCE_PROFILES[brief.audience.stage]
  const s = strategyFor(brief.subject.domain)
  const sections: string[] = []

  sections.push(
    `AUDIENCE — write for ${p.learner}${brief.audience.grade ? ` (grade: ${brief.audience.grade})` : ''}.\n` +
      `Language: ${p.language}\nVoice: ${p.voice}\nFeedback style: ${p.feedback}\n` +
      `Pacing: aim for ~${p.paceSecPerBeat}s of narration per beat (one idea per beat).\n` +
      `Interactions: ${p.interaction}`,
  )

  sections.push(
    `SUBJECT (${brief.subject.domain}) — teaching moves: ${s.moves}\nVisuals: ${s.kits}\nAssessment: ${s.gates}` +
      (brief.subject.notes ? `\nUpstream notes: ${brief.subject.notes}` : ''),
  )

  sections.push(
    'LEARNING OBJECTIVES — the lesson exists to achieve exactly these; do not add or drop any:\n' +
      brief.objectives
        .map(
          (o) =>
            `- [${o.id}] ${o.statement}${o.level ? ` (level: ${o.level})` : ''}${o.assess ? '' : ' (teach only — no gate required)'}`,
        )
        .join('\n') +
      '\nEvery objective marked for assessment MUST be tested by at least one gate, and every gate must test material this lesson explicitly taught first.' +
      (brief.priorKnowledge.length
        ? `\nAssume already known (do not re-teach): ${brief.priorKnowledge.join('; ')}`
        : ''),
  )

  if (brief.source.materials.length) {
    let budget = MATERIALS_TOTAL_CAP
    const parts: string[] = []
    for (const m of brief.source.materials) {
      if (budget <= 0) break
      const body = clamp(m.content, Math.min(MATERIAL_CHAR_CAP, budget))
      budget -= body.length
      parts.push(
        `<material id="${m.id}" kind="${m.kind}"${m.title ? ` title="${m.title}"` : ''}>\n${body}\n</material>`,
      )
    }
    const rule =
      brief.source.grounding === 'strict'
        ? "STRICT GROUNDING: every factual claim, example, term and number in the lesson MUST come from these materials. If the materials don't cover something an objective needs, teach only what they do cover — never fill gaps from general knowledge."
        : brief.source.grounding === 'prefer'
          ? 'Ground the lesson in these materials wherever they cover the point; use general knowledge only for connective explanation, never to contradict them.'
          : 'These materials are optional inspiration.'
    sections.push(`SOURCE MATERIAL — ${rule}\n\n${parts.join('\n\n')}`)
  } else if (brief.source.grounding !== 'open') {
    sections.push(
      'SOURCE MATERIAL — none provided; keep to uncontroversial, curriculum-standard content for this audience.',
    )
  }

  if (brief.facts.length) {
    sections.push(
      'VERIFIED FACTS — these values were verified by the upstream system. Use them VERBATIM wherever relevant. Do NOT compute, round, or restate them differently, and do NOT introduce other numeric claims that are not derived from them:\n' +
        brief.facts
          .map(
            (f) =>
              `- [${f.id}] ${f.statement}${f.value !== undefined ? ` (value: ${JSON.stringify(f.value)})` : ''}`,
          )
          .join('\n'),
    )
  }

  if (brief.assets.length) {
    sections.push(
      'ASSET LIBRARY — curated, approved media. Compose visuals from these FIRST: use them as `image` elements (content.src = the url) or inside kit `assets` maps (e.g. count objects). Reference by exact url. Only request generated pictures (content.prompt) for needs no library asset covers' +
        (brief.constraints.imagePolicy === 'none'
          ? ' — and image generation is DISABLED for this lesson, so library assets are the only pictures available'
          : '') +
        ':\n' +
        brief.assets.map((a) => `- ${a.label} [${a.tags.join(', ')}] → ${a.url}`).join('\n'),
    )
  }

  if (brief.misconceptions.length) {
    sections.push(
      'KNOWN MISCONCEPTIONS — address each one explicitly in the teaching, and use them as the wrong options (distractors) in select/predict-check gates so a learner holding the misconception picks it and gets corrective feedback:\n' +
        brief.misconceptions.map((m) => `- ${m}`).join('\n'),
    )
  }

  sections.push(
    `DIFFICULTY: ${brief.assessment.difficulty}. ` +
      (brief.assessment.difficulty === 'intro'
        ? 'First exposure — small steps, heavy worked examples, gates check recognition and single-step actions.'
        : brief.assessment.difficulty === 'challenge'
          ? 'The learner has practised this — compress exposition, gates require transfer to unseen cases.'
          : 'The learner has seen the idea — balance re-explanation with application; gates check the method, not just the fact.'),
  )

  return sections
}

/** Scale the doc theme for the audience (font sizes only, deterministic). */
export function applyAudienceTheme<T extends { fontSizes: Record<string, number> }>(
  theme: T,
  stage: AudienceStage,
): T {
  const k = AUDIENCE_PROFILES[stage].fontScale
  if (k === 1) return theme
  const fontSizes = Object.fromEntries(
    Object.entries(theme.fontSizes).map(([key, v]) => [key, Math.round(v * k)]),
  )
  return { ...theme, fontSizes }
}

/* ----------------------------------------------------------- legacy adapter */
/**
 * Back-compat shim for topic-only requests (the studio's own demo form).
 * Deprecated as an integration path: hosts must send a full LessonBrief.
 */
export function briefFromTopic(topic: string, locales: string[], sceneCount = 6): LessonBrief {
  return LessonBrief.parse({
    version: 'brief/v1',
    topic,
    locales,
    audience: { stage: 'primary' },
    subject: { domain: 'default' },
    objectives: [{ id: 'obj1', statement: `Learner understands: ${topic}`, assess: true }],
    source: { materials: [], grounding: 'open' },
    constraints: { sceneCount, imagePolicy: 'sparing' },
  })
}
