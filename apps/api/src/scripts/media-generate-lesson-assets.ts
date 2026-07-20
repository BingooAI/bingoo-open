/**
 * One-off content generation: the "counting lesson" demo asset set (teacher poses,
 * counted objects, scenery, rewards). Each image is generated via OpenAI, stored in
 * R2, and landed in the library as a PENDING asset (R5) with FULL metadata + tags so
 * NLP / semantic / LLM search work later:
 *   • localized title + description + altText (vi + en)          — R4
 *   • a controlled-vocabulary tag set (STYLE/SUBJECT/TOPIC/ENTITY/FORMAT/…)
 *   • keyword projection (GIN) refreshed from the tags
 *   • embedding index + AI suggestions via enrichAsset()
 *
 * Run (inside apps/api, costs real image + embedding + LLM credit):
 *   node --env-file=.env --import tsx src/scripts/media-generate-lesson-assets.ts
 */
import type { LocalizedText } from '@bingoo.ai/core'
import { db } from '@bingoo.ai/db'
import type { TagKind } from '@bingoo.ai/db'
import { createFolder } from '../repos/media-folder.repo'
import { addAssetTags, upsertTag } from '../repos/media-tag.repo'
import { getAssetById, updateAsset } from '../repos/media-asset.repo'
import { generateImageAssets } from '../services/media-generate.service'
import { enrichAsset } from '../services/media-enrich.service'

const ACTOR = 'system:media-gen' // provenance marker (no user FK on these columns)

// ── Controlled-vocabulary tag catalog (slug → {kind,label}) ──────────────────
const TAGS: Record<string, { kind: TagKind; label: LocalizedText }> = {
  // style
  'flat-vector': { kind: 'STYLE', label: { vi: 'Vector phẳng', en: 'Flat vector' } },
  'kid-friendly': { kind: 'STYLE', label: { vi: 'Thân thiện trẻ em', en: 'Kid-friendly' } },
  'bold-outline': { kind: 'STYLE', label: { vi: 'Viền đậm rõ', en: 'Bold outline' } },
  'warm-palette': { kind: 'STYLE', label: { vi: 'Tông màu ấm', en: 'Warm palette' } },
  'textbook-style': {
    kind: 'STYLE',
    label: { vi: 'Phong cách sách giáo khoa', en: 'Textbook style' },
  },
  // subject / grade / age / source
  math: { kind: 'SUBJECT', label: { vi: 'Toán học', en: 'Mathematics' } },
  primary: { kind: 'GRADE_BAND', label: { vi: 'Tiểu học', en: 'Primary school' } },
  everyone: { kind: 'AGE_RATING', label: { vi: 'Mọi lứa tuổi', en: 'Everyone' } },
  'ai-generated': { kind: 'SOURCE', label: { vi: 'Sinh bởi AI', en: 'AI-generated' } },
  // topics
  'counting-lesson': { kind: 'TOPIC', label: { vi: 'Bài học đếm số', en: 'Counting lesson' } },
  character: { kind: 'TOPIC', label: { vi: 'Nhân vật', en: 'Character' } },
  reward: { kind: 'TOPIC', label: { vi: 'Phần thưởng', en: 'Reward' } },
  scenery: { kind: 'TOPIC', label: { vi: 'Khung cảnh', en: 'Scenery' } },
  // formats
  'transparent-png': { kind: 'FORMAT', label: { vi: 'PNG nền trong suốt', en: 'Transparent PNG' } },
  'landscape-16-9': { kind: 'FORMAT', label: { vi: 'Ảnh ngang 16:9', en: 'Landscape 16:9' } },
  // entities
  teacher: { kind: 'ENTITY', label: { vi: 'Cô giáo', en: 'Teacher' } },
  star: { kind: 'ENTITY', label: { vi: 'Ngôi sao', en: 'Star' } },
  sock: { kind: 'ENTITY', label: { vi: 'Chiếc tất', en: 'Sock' } },
  sun: { kind: 'ENTITY', label: { vi: 'Mặt trời', en: 'Sun' } },
  tree: { kind: 'ENTITY', label: { vi: 'Cái cây', en: 'Tree' } },
  medal: { kind: 'ENTITY', label: { vi: 'Huy chương', en: 'Medal' } },
  confetti: { kind: 'ENTITY', label: { vi: 'Kim tuyến', en: 'Confetti' } },
  meadow: { kind: 'ENTITY', label: { vi: 'Đồng cỏ', en: 'Meadow' } },
  // keywords
  waving: { kind: 'KEYWORD', label: { vi: 'Vẫy tay', en: 'Waving' } },
  pointing: { kind: 'KEYWORD', label: { vi: 'Chỉ tay', en: 'Pointing' } },
  cheering: { kind: 'KEYWORD', label: { vi: 'Reo mừng', en: 'Cheering' } },
  thinking: { kind: 'KEYWORD', label: { vi: 'Suy nghĩ', en: 'Thinking' } },
  gold: { kind: 'KEYWORD', label: { vi: 'Màu vàng', en: 'Gold' } },
  pair: { kind: 'KEYWORD', label: { vi: 'Một đôi', en: 'Pair' } },
  single: { kind: 'KEYWORD', label: { vi: 'Đơn lẻ', en: 'Single' } },
  striped: { kind: 'KEYWORD', label: { vi: 'Kẻ sọc', en: 'Striped' } },
  celebration: { kind: 'KEYWORD', label: { vi: 'Ăn mừng', en: 'Celebration' } },
  sky: { kind: 'KEYWORD', label: { vi: 'Bầu trời', en: 'Sky' } },
  vietnamese: { kind: 'KEYWORD', label: { vi: 'Người Việt', en: 'Vietnamese' } },
}

// Only true, asset-level classification. Lesson/subject context (math, counting)
// lives on the FOLDER, not stamped on every image — keeps per-image tags about the
// picture's actual content so search stays precise. Visual content tags are added
// automatically by the AI enrichment step (source=AI).
const COMMON = ['flat-vector', 'kid-friendly', 'bold-outline', 'warm-palette', 'everyone', 'ai-generated']

interface Spec {
  key: string
  prompt: string
  size: string
  background: 'transparent' | 'opaque'
  title: LocalizedText
  description: LocalizedText
  altText: LocalizedText
  tags: string[] // in addition to COMMON
}

const SPECS: Spec[] = [
  {
    key: 'teacher_stand',
    prompt:
      'A friendly young Vietnamese female teacher, flat vector illustration, kid-friendly primary-school textbook style, bold clean outlines, warm palette (soft orange áo dài-inspired top, dark hair in a bun). Full body, standing upright, gentle smile, one hand giving a small wave. Transparent background. No text, no letters. Centered, full figure visible.',
    size: '1024x1024',
    background: 'transparent',
    title: { vi: 'Cô giáo đứng vẫy tay', en: 'Teacher standing and waving' },
    description: {
      vi: 'Cô giáo trẻ người Việt thân thiện, áo cam, tóc búi, đứng thẳng mỉm cười và vẫy tay chào. Minh hoạ vector phẳng, viền đậm, nền trong suốt.',
      en: 'Friendly young Vietnamese teacher in an orange top with a hair bun, standing upright, gently smiling and giving a small wave. Flat vector illustration, bold outlines, transparent background.',
    },
    altText: { vi: 'Cô giáo đang vẫy tay chào', en: 'A teacher waving hello' },
    tags: ['character', 'teacher', 'transparent-png', 'waving', 'vietnamese'],
  },
  {
    key: 'teacher_point',
    prompt:
      'The SAME friendly young Vietnamese female teacher (same face, hair bun, orange top), flat vector illustration, bold clean outlines, warm palette. Full body, standing, smiling, RIGHT arm raised and clearly pointing to the right side of the frame. Transparent background. No text, no letters.',
    size: '1024x1024',
    background: 'transparent',
    title: { vi: 'Cô giáo chỉ tay sang phải', en: 'Teacher pointing to the right' },
    description: {
      vi: 'Vẫn cô giáo trẻ người Việt đó (cùng khuôn mặt, tóc búi, áo cam), đứng mỉm cười, tay phải giơ lên chỉ rõ sang phía bên phải khung hình. Vector phẳng, nền trong suốt.',
      en: 'The same young Vietnamese teacher (same face, bun, orange top), standing and smiling with her right arm raised, clearly pointing to the right of the frame. Flat vector, transparent background.',
    },
    altText: { vi: 'Cô giáo chỉ tay sang bên phải', en: 'A teacher pointing to the right' },
    tags: ['character', 'teacher', 'transparent-png', 'pointing', 'vietnamese'],
  },
  {
    key: 'teacher_cheer',
    prompt:
      'The SAME friendly young Vietnamese female teacher (same face, hair, orange top), flat vector illustration, bold clean outlines, warm palette. Full body, BOTH arms raised up in a happy cheer, big smile, slight hop. Transparent background. No text, no letters.',
    size: '1024x1024',
    background: 'transparent',
    title: { vi: 'Cô giáo reo mừng', en: 'Teacher cheering' },
    description: {
      vi: 'Vẫn cô giáo trẻ người Việt đó, cả hai tay giơ cao reo mừng, cười tươi, nhún nhảy nhẹ. Vector phẳng, viền đậm, nền trong suốt.',
      en: 'The same young Vietnamese teacher with both arms raised in a happy cheer, big smile, a slight hop. Flat vector, bold outlines, transparent background.',
    },
    altText: { vi: 'Cô giáo giơ hai tay reo mừng', en: 'A teacher cheering with both arms up' },
    tags: ['character', 'teacher', 'transparent-png', 'cheering', 'celebration', 'vietnamese'],
  },
  {
    key: 'teacher_think',
    prompt:
      'The SAME friendly young Vietnamese female teacher (same face, hair, orange top), flat vector illustration, bold clean outlines, warm palette. Full body, standing, one hand on chin in a thoughtful pose, curious expression, small tilt of the head. Transparent background. No text, no letters.',
    size: '1024x1024',
    background: 'transparent',
    title: { vi: 'Cô giáo đang suy nghĩ', en: 'Teacher thinking' },
    description: {
      vi: 'Vẫn cô giáo trẻ người Việt đó, đứng một tay chống cằm với vẻ mặt tò mò, hơi nghiêng đầu. Vector phẳng, nền trong suốt.',
      en: 'The same young Vietnamese teacher standing with one hand on her chin, a curious expression and a slight head tilt. Flat vector, transparent background.',
    },
    altText: {
      vi: 'Cô giáo chống cằm suy nghĩ',
      en: 'A teacher with a hand on her chin, thinking',
    },
    tags: ['character', 'teacher', 'transparent-png', 'thinking', 'vietnamese'],
  },
  {
    key: 'star_gold',
    prompt:
      'A single cute glossy gold star, flat vector illustration, kid-friendly style, bold clean dark outline, warm yellow with a soft highlight, tiny friendly smile optional. Centered, transparent background. No text, no letters. Simple enough to be repeated many times as a counter.',
    size: '1024x1024',
    background: 'transparent',
    title: { vi: 'Ngôi sao vàng', en: 'Gold star' },
    description: {
      vi: 'Một ngôi sao vàng bóng dễ thương, viền đậm, có điểm sáng nhẹ. Đủ đơn giản để lặp lại nhiều lần làm vật đếm. Vector phẳng, nền trong suốt.',
      en: 'A single cute glossy gold star with a bold outline and a soft highlight, simple enough to repeat many times as a counter. Flat vector, transparent background.',
    },
    altText: { vi: 'Một ngôi sao vàng', en: 'A single gold star' },
    tags: ['star', 'transparent-png', 'gold'],
  },
  {
    key: 'sock_pair',
    prompt:
      'A pair of matching striped socks side by side, flat vector illustration, kid-friendly style, bold clean outlines, warm palette (cream + orange + teal stripes). The two socks clearly grouped as one pair. Transparent background. No text, no letters.',
    size: '1024x1024',
    background: 'transparent',
    title: { vi: 'Đôi tất kẻ sọc', en: 'Pair of striped socks' },
    description: {
      vi: 'Một đôi tất kẻ sọc giống nhau đặt cạnh nhau (kem + cam + xanh mòng két), rõ ràng là một đôi. Vector phẳng, nền trong suốt.',
      en: 'A pair of matching striped socks (cream + orange + teal) side by side, clearly grouped as one pair. Flat vector, transparent background.',
    },
    altText: { vi: 'Một đôi tất kẻ sọc', en: 'A pair of striped socks' },
    tags: ['sock', 'transparent-png', 'pair', 'striped'],
  },
  {
    key: 'sock_single',
    prompt:
      'One single striped sock, flat vector illustration, kid-friendly style, bold clean outlines, warm palette (cream + orange stripes), leaning slightly as if left over/alone. Transparent background. No text, no letters.',
    size: '1024x1024',
    background: 'transparent',
    title: { vi: 'Chiếc tất lẻ', en: 'Single striped sock' },
    description: {
      vi: 'Một chiếc tất kẻ sọc đơn lẻ (kem + cam), hơi nghiêng như bị bỏ lại một mình. Vector phẳng, nền trong suốt.',
      en: 'One single striped sock (cream + orange) leaning slightly as if left over alone. Flat vector, transparent background.',
    },
    altText: { vi: 'Một chiếc tất lẻ', en: 'A single striped sock' },
    tags: ['sock', 'transparent-png', 'single', 'striped'],
  },
  {
    key: 'bg_meadow',
    prompt:
      "A wide, calm sunny meadow background for a children's lesson, flat vector illustration, kid-friendly textbook style, bold clean outlines, warm palette. Blue sky with 2–3 soft fluffy clouds, a smiling sun in the top-right corner, rolling green grass along the bottom, one round leafy tree on the left. IMPORTANT: keep the whole CENTER empty and uncluttered (space for the lesson content). 16:9 landscape. No text, no letters, no characters.",
    size: '1536x1024',
    background: 'opaque',
    title: { vi: 'Nền đồng cỏ nắng', en: 'Sunny meadow background' },
    description: {
      vi: 'Nền đồng cỏ nắng rộng, yên bình cho bài học trẻ em: bầu trời xanh với vài đám mây, mặt trời cười ở góc trên phải, cỏ xanh phía dưới, một cây tròn bên trái; phần giữa để trống cho nội dung. Ảnh ngang, vector phẳng.',
      en: "A wide, calm sunny meadow background for a children's lesson: blue sky with a few clouds, a smiling sun top-right, green grass along the bottom, one round tree on the left; the center is kept empty for lesson content. Landscape, flat vector.",
    },
    altText: {
      vi: 'Đồng cỏ nắng với mặt trời cười và một cái cây, phần giữa để trống',
      en: 'A sunny meadow with a smiling sun and a tree, center kept empty',
    },
    tags: ['scenery', 'meadow', 'sun', 'tree', 'landscape-16-9', 'sky'],
  },
  {
    key: 'sun_smile',
    prompt:
      'A smiling cartoon sun with simple rays, flat vector illustration, kid-friendly style, bold clean outline, warm yellow-orange. Transparent background. No text, no letters.',
    size: '1024x1024',
    background: 'transparent',
    title: { vi: 'Mặt trời cười', en: 'Smiling sun' },
    description: {
      vi: 'Mặt trời hoạt hình đang mỉm cười với những tia nắng đơn giản, tông vàng cam ấm, viền đậm. Vector phẳng, nền trong suốt.',
      en: 'A smiling cartoon sun with simple rays in warm yellow-orange, bold outline. Flat vector, transparent background.',
    },
    altText: { vi: 'Một mặt trời đang cười', en: 'A smiling sun' },
    tags: ['scenery', 'sun', 'transparent-png', 'sky'],
  },
  {
    key: 'tree_round',
    prompt:
      'A single round leafy green tree with a short brown trunk, flat vector illustration, kid-friendly style, bold clean outlines, soft green canopy. Transparent background. No text, no letters.',
    size: '1024x1024',
    background: 'transparent',
    title: { vi: 'Cây tròn xanh', en: 'Round leafy tree' },
    description: {
      vi: 'Một cây tròn tán lá xanh với thân nâu ngắn, tán mềm mại, viền đậm. Vector phẳng, nền trong suốt.',
      en: 'A single round leafy green tree with a short brown trunk and a soft canopy, bold outlines. Flat vector, transparent background.',
    },
    altText: { vi: 'Một cây tròn xanh', en: 'A round green tree' },
    tags: ['scenery', 'tree', 'transparent-png'],
  },
  {
    key: 'medal_star',
    prompt:
      'A gold star medal hanging from a red-and-blue ribbon, flat vector illustration, kid-friendly style, bold clean outlines, shiny gold star in the center. Transparent background. No text, no letters.',
    size: '1024x1024',
    background: 'transparent',
    title: { vi: 'Huy chương ngôi sao vàng', en: 'Gold star medal' },
    description: {
      vi: 'Huy chương ngôi sao vàng bóng treo trên dải ruy băng đỏ và xanh dương, viền đậm. Vector phẳng, nền trong suốt.',
      en: 'A shiny gold star medal hanging from a red-and-blue ribbon, bold outlines. Flat vector, transparent background.',
    },
    altText: { vi: 'Huy chương ngôi sao vàng', en: 'A gold star medal' },
    tags: ['reward', 'medal', 'star', 'transparent-png', 'gold'],
  },
  {
    key: 'confetti',
    prompt:
      'A colorful celebratory confetti burst, flat vector illustration, kid-friendly style, small paper pieces and streamers in warm and bright colors scattered outward, transparent background. No text, no letters.',
    size: '1024x1024',
    background: 'transparent',
    title: { vi: 'Pháo giấy ăn mừng', en: 'Confetti burst' },
    description: {
      vi: 'Một màn pháo giấy ăn mừng nhiều màu sắc, các mảnh giấy và dải kim tuyến tông ấm và tươi bắn ra mọi hướng. Vector phẳng, nền trong suốt.',
      en: 'A colorful celebratory confetti burst with small paper pieces and streamers in warm, bright colors scattered outward. Flat vector, transparent background.',
    },
    altText: { vi: 'Màn pháo giấy nhiều màu', en: 'A colorful confetti burst' },
    tags: ['reward', 'confetti', 'transparent-png', 'celebration'],
  },
]

async function main() {
  console.log(`Generating ${SPECS.length} lesson assets → R2 (PENDING moderation)…\n`)

  // 1. Upsert the whole tag vocabulary once, map slug → id.
  const tagId: Record<string, string> = {}
  for (const [slug, def] of Object.entries(TAGS)) {
    const t = await upsertTag({ slug, kind: def.kind, label: def.label })
    tagId[slug] = t.id
  }
  console.log(`✔ ${Object.keys(tagId).length} tags upserted`)

  // 2. One GLOBAL folder to hold the set.
  const folder = await createFolder({
    name: { vi: 'Bài đếm số – tài nguyên demo', en: 'Counting lesson – demo assets' },
    description: {
      vi: 'Bộ minh hoạ vector cho bài học đếm số (cô giáo, vật đếm, khung cảnh, phần thưởng).',
      en: 'Vector illustration set for a counting lesson (teacher, counted objects, scenery, rewards).',
    },
    scope: 'GLOBAL',
    visibility: 'SCOPE',
    createdById: ACTOR,
  })
  console.log(`✔ folder ${folder.id}\n`)

  let ok = 0
  const rows: string[] = []
  for (const spec of SPECS) {
    try {
      process.stdout.write(`… ${spec.key} (${spec.size}, ${spec.background}) `)
      const [asset] = await generateImageAssets({
        prompt: spec.prompt,
        size: spec.size,
        background: spec.background,
        count: 1,
        folderId: folder.id,
        scope: 'GLOBAL',
        visibility: 'SCOPE',
        title: spec.title,
        createdById: ACTOR,
      })
      if (!asset) throw new Error('no asset returned')

      // Full localized metadata (R4) + record the semantic key for later lookup.
      await updateAsset(asset.id, { description: spec.description, altText: spec.altText })
      await db.mediaAsset.update({
        where: { id: asset.id },
        data: {
          metadata: {
            ...((await getAssetById(asset.id))?.metadata as Record<string, unknown> | null),
            assetKey: spec.key,
          },
        },
      })

      // Controlled-vocabulary tags → refreshes the keyword GIN projection.
      const slugs = [...new Set([...COMMON, ...spec.tags])]
      const keywords = await addAssetTags({
        assetId: asset.id,
        tagIds: slugs.map((s) => tagId[s]).filter((id): id is string => Boolean(id)),
        source: 'AI',
        addedById: ACTOR,
      })

      // Embedding index (NLP/semantic) + AI suggestions (LLM), now over the rich text.
      const enrich = await enrichAsset(asset.id, { force: true })

      ok++
      rows.push(
        `  ${spec.key.padEnd(14)} ${asset.publicId}  tags=${slugs.length} kw=${keywords.length} ` +
          `emb=${enrich.embedded ? 'y' : 'n'} sug=${enrich.suggested ? 'y' : 'n'}`,
      )
      console.log('✅')
    } catch (err) {
      console.log('❌')
      rows.push(`  ${spec.key.padEnd(14)} FAILED — ${err instanceof Error ? err.message : err}`)
    }
  }

  console.log(`\n${ok}/${SPECS.length} generated. Folder: ${folder.id}\n`)
  console.log(rows.join('\n'))
  console.log('\nAll assets are PENDING moderation (R5) — approve them before child delivery.')

  await db.$disconnect()
  process.exit(ok === SPECS.length ? 0 : 1)
}

main().catch(async (err) => {
  console.error('lesson-asset generation crashed:', err)
  await db.$disconnect()
  process.exit(1)
})
