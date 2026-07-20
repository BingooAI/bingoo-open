/**
 * prompt.ts — the complete, self-contained brief you hand to a model.
 *
 * It is a FUNCTION, not a file. The build script writes it to
 * `contract/PROMPT.md` and the admin's import page offers it as a download, but
 * both call this — so the copy on someone's desktop, the copy in the repo and the
 * copy the pipeline injects are the same text, generated from the engine that is
 * actually running. A prompt doc that is a hand-maintained file always ends up
 * describing an engine that no longer exists; that is how these die.
 *
 * Everything interpolated below is derived: the slot names and MEASURED character
 * budgets from the layout engine, the kit list from the live registry, the worked
 * examples from `examples.ts` (each re-checked against the gate before shipping).
 */
import { MANIPULATIVES, KIT_DOCS } from '@bingoo/manipulatives'
import { QUIZ_TYPES } from '@bingoo/core'
import { quizGuide } from './quizdoc'
import { arcGuide, planFor, DEFAULT_MINUTES, RICHNESS } from './arc'
import { SFX_NAMES } from './sfx-catalog'
import { AUDIENCE_PROFILES, type AudienceStage } from './brief'
import { REFERENCE_DOC, REFERENCE_BUNDLE } from './reference'
import { authoringGuide } from './authoring'
import { templateCatalog } from './catalog'
import { EXAMPLES } from './examples'

/**
 * The message a human sends ALONGSIDE the file. The file is the contract; this is
 * the assignment. Kept here, next to the contract it refers to, so the two can't
 * describe different rules.
 */
/** The audience list — from the engine's OWN profiles, so a picker in the admin
 *  and the prompt can never offer different options. */
export const AUDIENCES: { id: AudienceStage; label: string }[] = (
  Object.keys(AUDIENCE_PROFILES) as AudienceStage[]
).map((id) => ({ id, label: AUDIENCE_PROFILES[id].label }))

export function promptMessage(
  topic = '<CHỦ ĐỀ>',
  audience = '<ĐỐI TƯỢNG>',
  minutes = DEFAULT_MINUTES,
  lang = 'tiếng Việt',
): string {
  const plan = planFor(minutes)
  return [
    'Đọc file đính kèm — đó là đặc tả định dạng JSON của bài giảng. Vài điểm cần lưu ý:',
    '- không viết toạ độ, chỉ dùng "region";',
    '- không vượt maxChars của slot;',
    '- ảnh chỉ đưa "query", đừng bịa "src";',
    '- MỌI manipulative phải có `actions` chạy theo cue của lời giảng.',
    '',
    `Soạn bài: "${topic}"`,
    `Đối tượng: ${audience}`,
    `Thời lượng: ${plan.minutes} phút → khoảng ${plan.scenes} scene`,
    `Ngôn ngữ: ${lang}`,
    '',
    `Đặt meta.targetMinutes = ${plan.minutes} trong doc.`,
    'Tự chấm theo checklist ở mục cuối của file trước khi trả lời.',
    '',
    'Trả kết quả dưới dạng MỘT FILE .json tải xuống được (không in JSON ra trong chat,',
    'không giải thích, không ```fence). Nội dung file là object { doc, bundle }.',
  ].join('\n')
}

/**
 * @param brief  produce the UPLOAD version: compact and neutrally worded.
 *
 * The full document is 130KB of absolute imperatives ("NEVER", "REJECTED") and
 * four large embedded-JSON reference dumps. To an upload-time safety classifier
 * that reads like a prompt-injection payload, and ChatGPT/Claude refuse the file.
 * The content is a grade-1 maths lesson spec — the SHAPE is what trips it. The
 * brief keeps every rule but states them as a spec, drops the 35KB sample-lesson
 * dump and the per-kit param blocks, and trims the worked examples. The full
 * version stays for the server pipeline, where nothing classifies the upload.
 */
export function promptMarkdown(minutes = DEFAULT_MINUTES, brief = false): string {
  // The manifest used to list only kind + verb names. A model therefore had NO
  // WAY to know a kit takes `labels`, so every evenodd rendered "7 is ODD" in
  // English inside a Vietnamese lesson. Ship the defaultParams: they are the
  // only place the param SHAPE is written down.
  // params shape AND verb signatures with their ARGS. Without the args a model
  // cannot call a verb, so it calls none, so the kit stands still, so the lesson
  // is a slide deck. This is the single highest-leverage thing in the file.
  // WHAT each kit is, its params shape, and its verbs WITH ARGS. Handing a model
  // 67 bare names is handing it nothing: it cannot tell a ten-frame from a bar
  // model, so it picks the one word it recognises and uses it four times.
  const kits = MANIPULATIVES.map((m) => {
    const d = KIT_DOCS[m.kind]
    const verbs = d?.verbs || Object.keys(m.verbs).join(' · ') || '—'
    if (brief) {
      // one line per kit — enough to choose one and call its verbs
      return `- \`${m.kind}\` — ${(d?.desc ?? '').slice(0, 90)} · verbs: ${verbs}`
    }
    const enums = d?.paramEnums
      ? Object.entries(d.paramEnums)
          .map(([k, v]) => `${k}: ${v.join(' | ')}`)
          .join('  ·  ')
      : ''
    return [
      `### ${m.kind}`,
      d?.desc ?? '',
      `params: ${JSON.stringify(m.defaultParams ?? {})}`,
      enums ? `giá trị hợp lệ → ${enums}` : '',
      `verbs:  ${verbs}`,
    ]
      .filter(Boolean)
      .join('\n')
  }).join(brief ? '\n' : '\n\n')
  // In brief mode show a representative FEW — teach, sequence (with actions),
  // data (chart), practice (gate). Twenty inline JSON blocks is what bloats the
  // file and reads as an attack payload.
  const exampleKeys = brief ? ['teach', 'sequence', 'data', 'practice'] : Object.keys(EXAMPLES)
  const examples = exampleKeys
    .filter((tpl) => EXAMPLES[tpl as keyof typeof EXAMPLES])
    .map((tpl) => {
      const ex = EXAMPLES[tpl as keyof typeof EXAMPLES]!
      return `### \`${tpl}\`\n> ${ex.why}\n\n\`\`\`json\n${JSON.stringify({ scene: ex.scene, strings: ex.strings }, null, 2)}\n\`\`\`\n`
    })
    .join('\n')

  return `<!-- GENERATED từ engine đang chạy. Đừng sửa tay — sinh lại bằng:
     pnpm --filter @bingoo/explainer prompt   (hoặc tải từ trang /vi/explainer-import) -->

# Sinh một bài giảng Explainer (JSON)

Bạn là người soạn bài giảng tương tác. Hãy trả về **DUY NHẤT một object JSON**, không văn xuôi, không \`\`\`fence:

\`\`\`
{ "doc": <ExplainerDoc>, "bundle": <LocaleBundle> }
\`\`\`

Dán JSON đó vào trang **/vi/explainer-import** của bingoo để xem bài chạy thật.

---

## −1. Explainer là gì

Explainer không phải PowerPoint. Một bài viết như xấp slide sẽ không qua được cổng kiểm tra.

Nó là một **bảng trắng động, tua được, do LỜI GIẢNG điều khiển**. Về mặt kỹ thuật:

- Engine là một hàm thuần: \`frame(program, t) → hình ảnh\`. Cùng \`t\` ⇒ cùng pixel. Học sinh **tua ngược được**, và mọi thứ chạy lùi đúng như đã chạy tới.
- Bạn **không vẽ hình**. Bạn viết **một dòng thời gian buộc vào giọng nói**: cô giáo nói tới đâu, hình động tới đó.
- Bố cục do engine tính, cho **cả 16:9 lẫn 9:16**. Bạn chỉ đặt tên slot.
- **Manipulative là vật thao tác BIẾT LÀM ĐỘNG TÁC**, không phải hình minh hoạ. Nó đếm, ghép đôi, tách nhóm, tô màu — **ngay trước mắt học sinh, trong lúc cô đang nói**.
- Học sinh **làm bài ngay trong dòng thời gian** (\`gate\`), và có thể **kéo/chạm trực tiếp lên chính vật thao tác vừa học**.
- Sơ đồ, biểu đồ, bảng: engine **tự tính** vị trí node, chiều cao cột, góc quạt. Bạn chỉ đưa dữ liệu.

### Bạn có gì trong tay (kho learning primitives)

| Kho | Số lượng | Dùng ở đâu |
|---|---|---|
| **Template bố cục** | ${templateCatalog().length} | \`scene.layout.template\` — §2 |
| **Loại phần tử** | 11 | text · list · table · chart · stat · quote · image · shape · diagram · manipulative · stick — §3 |
| **Manipulative kit** | ${MANIPULATIVES.length} | \`type:"manipulative"\` và \`activity.manip\` — §4 |
| **Verb của kit** | ${Object.values(KIT_DOCS).reduce((n, d) => n + d.verbs.split('·').length, 0)} | \`content.actions\` — chạy theo cue lời giảng |
| **Loại câu hỏi** | ${QUIZ_TYPES.length} | \`activity.quiz\` — §6 |
| **Kiểu đánh giá** | 4 | quiz · manip · tracing · coloring — §6 |
| **Hiệu ứng (beat verb)** | 12 | reveal · emphasize · drawOn · exit · revealAll · revealNode · connect… — §5 |
| **Nền** | 5 | gradient · meadow · sky · grid · paper |

Đây **không phải danh sách để đọc cho vui** — bài dùng đi dùng lại **một** kit và **một** loại câu hỏi sẽ bị cổng từ chối (\`few-kits\`, \`few-quiz-types\`, \`few-templates\`).

**Hệ quả cho cách bạn viết:** mỗi câu lời giảng là **một nhịp** — một thứ xuất hiện, một thứ được nhấn, một vật thao tác làm một động tác. Một scene có hình đứng im trong lúc cô nói ba câu là một scene **hỏng**, dù nó hợp lệ về mặt schema.

---

## 0. CƠ CHẾ CUE — trái tim của engine

Đây là thứ buộc hình vào tiếng. Ba nơi phải **khớp tên với nhau**:

\`\`\`json
// 1) lời giảng: đánh dấu bằng [[cue:...]] ngay trước câu tương ứng
"narration": { "n2": {
  "script": "[[cue:c1]] Em nhìn này, cô có tám ngôi sao. [[cue:c2]] Mình ghép chúng thành từng đôi nhé: hai, bốn, sáu, tám. [[cue:c3]] Không còn bạn nào đứng một mình cả!",
  "voice": "vi-VN",
  "marks": [ {"cue":"c1","t":0.3}, {"cue":"c2","t":3.1}, {"cue":"c3","t":8.4} ]
}}

// 2) vật thao tác: mỗi verb chạy TẠI một cue  (at: "@<cue>")
{ "id":"kit", "type":"manipulative", "region":"stage",
  "content": {
    "kind": "evenodd",
    "params": { "number": 8, "icon": "star", "labels": {"even":"{n} là số CHẴN","odd":"{n} là số LẺ"} },
    "actions": [
      { "verb":"setNumber", "at":"@c1", "args": { "n": 8 } },
      { "verb":"showResult", "at":"@c3" }
    ]
  } }

// 3) beat: hiệu ứng khác (hiện chữ, nhấn mạnh, vẽ nét) cũng bám vào cue
"beats": [
  { "id":"b2", "cue":"c2", "actions":[{ "verb":"emphasize", "target":"kit", "style":"pulse" }] },
  { "id":"b3", "cue":"c3", "actions":[{ "verb":"reveal", "target":"co" }, { "verb":"sfx", "sound":"success" }] }
]
\`\`\`

Kết quả: học sinh **thấy tám ngôi sao ghép đôi ĐÚNG LÚC** cô đang đếm "hai, bốn, sáu, tám", rồi chữ "CHẴN" hiện ra đúng lúc cô nói "không còn bạn nào đứng một mình".

**LUẬT SỐNG CÒN — hình PHẢI bắt nhịp lời:** lời giảng nói bao nhiêu Ý thì màn hình phải động bấy nhiêu lần. Mỗi \`[[cue:...]]\` = một ý mới, và mỗi ý phải **mang MỘT thứ lên màn hình**: một callout hiện ra, một phần được nhấn, một dòng bullet, hoặc một verb của kit.

Sai điển hình (bị cổng \`static-scene\` từ chối): nhét **lời giảng nhiều ý lên \`title-card\`** (chỉ có 1 ảnh) — cô nói ba câu mà slide đứng im một tấm ảnh. **Cách đúng:**
- Lời giảng dài, nhiều ý → dùng \`bullets\` + beat \`revealAll\` (mỗi ý hiện một dòng theo cue), hoặc \`teach\` với các \`callout\` text \`reveal\` theo từng cue.
- Hoặc **TÁCH thành nhiều scene**, mỗi scene một ý — đừng dồn cả đoạn giải thích vào một slide tĩnh.
- \`title-card\`/\`section\` chỉ dành cho **một câu ngắn** (tên bài / tên phần), KHÔNG phải để giải thích.

**Luật:** mọi \`cue\` trong \`beats\` và mọi \`at:"@..."\` trong \`actions\` **phải** có \`[[cue:...]]\` trong script **và** một mục trong \`marks\`. Thiếu một trong ba = hiệu ứng không bao giờ chạy.

---

## 0b. Khung ngoài

\`\`\`json
{
  "doc": {
    "version": "explainer/v2",
    "meta": { "id": "<slug>", "title": "<Tên bài>", "defaultLocale": "vi" },
    "locales": ["vi"],
    "theme": {
      "colors": { "ink":"#2b2724","inkSoft":"#7d736a","paper":"#f7f2e9","accent":"#e07a42","accent2":"#3f83bf","good":"#3f9d5a","warn":"#d98b2b","faint":"#d8cfc2","cloudFill":"#fbf8f2","sunCore":"#f7d488","leaf":"#bcd9a6","leafDeep":"#6fae5a","ground":"#cbb99c" },
      "fontSizes": { "label":24,"caption":28,"body":32,"title":64,"huge":96 },
      "weights": { "sm":4,"md":7,"lg":11 },
      "fonts": { "hand": "var(--font-baloo), ui-rounded, system-ui, sans-serif", "sans": "var(--font-bvp), system-ui, sans-serif" },
      "register": "warm"
    },
    "background": { "kind": "gradient", "from": "sunCore", "to": "paper", "angle": 160, "panel": true },
    "scenes": [ /* 6–10 scene */ ]
  },
  "bundle": {
    "locale": "vi",
    "strings": { "<elementId>": "<chữ hiển thị>" },
    "narration": { "<ref>": { "script": "[[cue:c1]] Câu một. [[cue:c2]] Câu hai.", "voice": "vi-VN", "marks": [{"cue":"c1","t":0.2},{"cue":"c2","t":2.4}] } }
  }
}
\`\`\`

**\`background.kind\`**: \`gradient\` | \`meadow\` | \`sky\` | \`grid\` | \`paper\`. \`panel: true\` = bài nằm trên thẻ nổi giữa nền; \`false\` = tràn nền.

---

## 1. Quy ước bố cục

1. **Không viết toạ độ.** Không \`place\`, \`x\`, \`y\`, \`size\`, \`w\`, \`h\`, \`overrides\`. Engine tự tính rect cho **cả 16:9 lẫn 9:16**. Mỗi phần tử chỉ khai \`region\` = tên slot.
2. **Chỉ dùng tên slot có trong §2.** Slot lạ khiến phần tử rơi vào ô dự phòng.
3. **\`maxChars\` là số ĐO ĐƯỢC**, ở khổ chật hơn trong hai khổ. Vượt quá thì **cắt chữ** — hệ thống sẽ không thu nhỏ chữ để cứu bạn.
4. **Slot chứa nhiều phần tử** (steps, grid, stats, laneLabels) → mỗi phần tử **phải** có \`flow: { order: 1..n }\`.
5. **Chữ hiển thị**: \`text\`/\`shape\`/\`quote\` LUÔN lấy chữ từ \`bundle.strings[id]\` (để \`content:{}\`). Các loại slide (\`list\`/\`table\`/\`stat\`/\`chart\`), nhãn kit, \`alt\` ảnh và tiêu đề bài **có thể** viết inline trong doc (đơn giản cho bài MỘT ngôn ngữ) — engine đọc \`bundle.strings[<khoá>]\` trước, không có mới dùng inline làm dự phòng. **Để dịch / đa ngôn ngữ, xem §3b.**
6. **Mỗi \`beat.cue\` phải có \`[[cue:...]]\` tương ứng** trong \`narration.script\` **và** một mục trong \`marks\`.
7. **Biểu đồ: chỉ đưa \`series\`.** Chiều cao cột, góc quạt, mốc trục do engine tính — đừng tự tính.
8. **Ảnh: 4 trường TIẾNG ANH + 1 trường tiếng Việt.** Thư viện media là MỘT kho dùng chung cho cả sản phẩm, nên metadata của nó **là tiếng Anh**. Thiếu trường nào thì ảnh đó **không tìm lại được**, và bài sau lại phải sinh lại (tốn tiền).
   \`\`\`json
   { "kind":"image",
     "query":  "a smiling yellow cartoon star for kids",   // EN — tìm trong thư viện
     "prompt": "a smiling yellow cartoon star for kids, flat vector, white background",  // EN — nếu phải sinh mới
     "tags":   ["star","yellow","cartoon","kids"],          // EN, 2–5 từ khoá — KHÔNG có tag là KHÔNG lọc được
     "alt":    "Ngôi sao vàng",                             // TIẾNG VIỆT — hiển thị cho học sinh
     "w": 1024, "h": 1024 }
   \`\`\`
9. **Kit ship nhãn TIẾNG ANH mặc định.** Nếu bài không phải tiếng Anh, **luôn ghi đè** \`labels\` trong \`params\` — xem \`defaultParams\` ở §4 để biết kit nào có nhãn. Bỏ qua là bài hiện "7 is ODD" giữa bài tiếng Việt.
10. **Đừng bịa \`src\`.** Hệ thống tìm trong thư viện trước; không có mới sinh, và chỉ sinh khi người soạn bấm.

---

## 2. HỢP ĐỒNG BỐ CỤC

${authoringGuide().split('\n').slice(5).join('\n')}

---

## 3. Loại phần tử

| type | content |
|---|---|
| \`text\` | \`{}\` — chữ lấy từ \`bundle.strings[id]\`; \`style.fontSize\` = rung mà slot yêu cầu |
| \`list\` | \`{ "style":"bullet\\|number\\|check\\|dash", "items":["...", "..."] }\` |
| \`table\` | \`{ "header":[...], "rows":[[...]] }\` — ≤4 cột × ≤5 hàng |
| \`chart\` | \`{ "chart":"bar\\|column\\|line\\|area\\|pie\\|donut", "series":[{"label":"...","value":18,"color":"good"}], "unit":" bạn" }\` |
| \`stat\` | \`{ "value":"50", "unit":"%", "label":"...", "color":"accent" }\` |
| \`quote\` | \`{}\` — chữ ở \`strings[id]\`, tác giả ở \`strings["<id>.by"]\` |
| \`image\` | \`{ "kind":"image", "query":"<EN>", "prompt":"<EN>", "tags":["<EN>",…], "alt":"<tiếng Việt>", "w":1024, "h":1024 }\` — xem §1.8 |
| \`diagram\` | \`{ "layoutKind":"flow\\|tree\\|cycle\\|grid\\|timeline", "direction":"auto", "nodes":[{"id","label","shape":"box\\|diamond\\|circle\\|pill"}], "edges":[{"id","from","to","label","kind":"arrow"}] }\` |
| \`manipulative\` | \`{ "kind":"<xem §4>", "params":{...} }\` |

---

## 3b. Chữ & đa ngôn ngữ (localization)

MỌI chữ tác giả trong bài đều **ghi đè được theo ngôn ngữ** qua \`bundle.strings\`, theo đúng khoá dưới. Engine đọc \`bundle.strings[KHOÁ]\` trước; không có thì dùng chữ inline trong doc (làm dự phòng cho ngôn ngữ gốc).

| Nội dung | Khoá trong \`bundle.strings\` |
|---|---|
| Tiêu đề bài | \`"meta.title"\` |
| \`text\` / \`shape\` | \`"<id>"\` |
| \`quote\` — câu · tác giả | \`"<id>"\` · \`"<id>.by"\` |
| \`list\` item thứ i (0-based) | \`"<id>.<i>"\` |
| \`chart\` nhãn series thứ i | \`"<id>.<i>"\` |
| \`table\` header i · ô hàng r cột c | \`"<id>.h<i>"\` · \`"<id>.<r>.<c>"\` |
| \`stat\` giá trị · nhãn | \`"<id>.value"\` · \`"<id>.label"\` |
| \`image\` \`alt\` (hiện ở placeholder) | \`"<id>.alt"\` |
| \`manipulative\` nhãn k trong \`params.labels\` | \`"<id>.label.<k>"\` |

**Bài MỘT ngôn ngữ** → viết chữ inline trong doc (items/header/rows/value/label/alt/params.labels) là đủ; trả \`{ doc, bundle }\`.

**Bài NHIỀU ngôn ngữ → SINH NỘI DUNG NATIVE cho từng ngôn ngữ, KHÔNG dịch máy.** Trả \`{ "doc": …, "bundles": { "vi": {…}, "en": {…} } }\` (dùng \`bundles\` thay \`bundle\`), \`doc.locales\` liệt kê đủ. Một \`doc\` DÙNG CHUNG (cùng scene, cùng cue, cùng manipulative, cùng nhịp) — chỉ phần CHỮ khác nhau, đặt trong bundle mỗi ngôn ngữ theo ĐẦY ĐỦ khoá ở bảng trên.

- **Viết như một giáo viên BẢN NGỮ của ngôn ngữ đó**, không phải người dịch: mỗi ngôn ngữ diễn đạt tự nhiên, đúng văn phong trẻ em bản xứ, cùng Ý nhưng KHÔNG bám câu chữ tiếng gốc. Dịch word-for-word làm mất bản chất — lời giảng đọc gượng, ví dụ/cách nói không hợp văn hoá.
- **Giữ NGUYÊN nhịp sư phạm**: mỗi \`bundle.narration[ref].script\` phải có ĐÚNG các \`[[cue:cN]]\` như bản gốc (cùng số cue, cùng thứ tự) để khớp \`beats\`/\`marks\` của doc dùng chung. Ý mỗi cue giữ nguyên; chỉ lời văn đổi.
- **Nội dung đang DẠY giữ y hệt mọi ngôn ngữ.** Bài dạy tiếng Trung: \`你好\`/\`谢谢\`/\`再见\` (và phiên âm \`nǐ hǎo\`), hay số/công thức toán — **KHÔNG đổi**, chúng là thứ học sinh phải học. Chỉ chữ HƯỚNG DẪN quanh chúng viết lại theo từng ngôn ngữ.

\`{ doc, bundle }\` (một ngôn ngữ) vẫn nhận bình thường.

---

## 4. Bộ manipulative (${MANIPULATIVES.length} kit)

Mỗi kit: **nó là gì** · \`params\` · \`verbs\` **kèm args**. Chỉ dùng những gì có trong danh sách — bịa ra là bài hỏng.
Copy shape từ \`params\`, **ghi đè \`labels\` sang tiếng Việt** nếu kit đó có, và **luôn gọi verb theo cue**.

\`\`\`
${kits}
\`\`\`

---

## 5. Hiệu ứng theo lời giảng (\`beats\`)

\`\`\`json
"beats": [{ "id":"b1", "cue":"c1", "actions":[{ "verb":"reveal", "target":"<id>" }] }]
\`\`\`

Verb: \`reveal\` · \`drawOn\` · \`emphasize{style:pulse|glow|shake|flash|tada}\` · \`exit{to:"fade"}\` · \`revealNode{diagram,node}\` · \`connect{diagram,edge}\` · **\`revealAll{target}\`** (hiện lần lượt từng dòng của list/table/chart — dùng cho slide \`bullets\`) · \`revealItem{target,index}\` · \`sfx{sound}\`.

**\`sfx.sound\` PHẢI là một tên trong kho dưới đây** (tên lạ = bài bị từ chối). ${SFX_NAMES.length} âm thanh:
\`\`\`
${SFX_NAMES.join(' · ')}
\`\`\`

Phần tử **không** được beat nào chạm tới thì phải đặt \`"startVisible": true\`, nếu không nó sẽ không bao giờ hiện.

---

## 6. Gate — 4 KIỂU ĐÁNH GIÁ TƯƠNG TÁC

Học sinh **làm** ở đây. Có **4 kiểu**, và **cả 4 đều được CHẤM BẰNG CODE**, không phải bằng cảm tính:

| \`activity.*\` | Học sinh làm gì | Chấm bằng |
|---|---|---|
| \`quiz\` | Trả lời câu hỏi (${QUIZ_TYPES.length} loại) | \`gradeQuestion\` |
| \`manip\` | **Thao tác trên chính vật vừa học** (kéo, đếm, ghép) — ${MANIPULATIVES.length} kit | \`checkAnswer\` |
| \`tracing\` | **Viết** chữ / hình theo nét mẫu | \`scoreTracedStroke\` (chấm từng nét) |
| \`coloring\` | **Tô màu** theo yêu cầu | \`coloringScore\` (so với \`targetColor\`) |

**Chọn kiểu theo NGƯỜI HỌC, không theo cái nào dễ viết.** Trẻ mầm non **chưa đọc được** — với chúng, \`tracing\` và \`coloring\` và \`manip\` là đánh giá thật; một dãy nút bấm chữ thì không.

\`\`\`json
// manip — em tự lấy đủ 10 ngôi sao
"activity": { "manip": { "kind":"count", "params":{"count":3,"shape":"star"}, "target":{"count":10} } }

// tracing — em viết chữ A
"activity": { "tracing": { "id":"a", "label":"A",
  "strokes":[ {"id":"s1","points":[{"x":20,"y":90},{"x":50,"y":10}]},
              {"id":"s2","points":[{"x":50,"y":10},{"x":80,"y":90}]},
              {"id":"s3","points":[{"x":33,"y":55},{"x":67,"y":55}]} ] } }

// coloring — tô các ô CHẴN màu xanh
"activity": { "coloring": { "id":"pic",
  "regions":[ {"id":"r2","d":"M10 10h40v40h-40z","targetColor":"#3f9d5a"},
              {"id":"r3","d":"M60 10h40v40h-40z","targetColor":"#e07a42"} ] } }
\`\`\`

\`activity.quiz\` là **một câu hỏi @bingoo/core**. Sai shape thì QuizShell vẽ **thẻ rỗng** — và cổng kiểm tra sẽ từ chối bài.

\`\`\`json
{ "id":"g1", "kind":"gate", "layout":{"template":"practice","regions":{}},
  "elements":[{ "id":"g1_pr","type":"text","region":"prompt","style":{"fontSize":"title"},"startVisible":true }],
  "gate": { "kind":"activity", "prompt":"Số 5 là chẵn hay lẻ?", "answer":"", "onPass":"resume",
            "activity": { "quiz": {
              "id":"q1", "type":"single", "prompt":"Số 5 là chẵn hay lẻ?",
              "choices":[{"id":"even","label":"Chẵn"},{"id":"odd","label":"Lẻ"}],
              "answerId":"odd"
            } } } }
\`\`\`

**Bẫy hay mắc:**
- type là \`single\` (KHÔNG phải \`single-choice\`); mảng là \`choices\` (KHÔNG phải \`options\`).
- Câu hỏi **phải có \`id\`**, và **đáp án nằm TRONG câu hỏi** (\`answerId\`), không phải ở \`gate.answer\`.
- \`activity\` **không có** key \`kind\` — chỉ \`quiz\` hoặc \`manip\`.

### ${QUIZ_TYPES.length} loại câu hỏi — SHAPE ĐẦY ĐỦ

Player vẽ được **cả ${QUIZ_TYPES.length}/${QUIZ_TYPES.length}** và \`gradeQuestion\` chấm hết. **Đừng chỉ dùng \`single\`.**
Chọn loại theo **thứ cần đo**: đo học sinh có PHÂN LOẠI được không thì dùng \`categorize\`, có ĐẶT ĐÚNG VỊ TRÍ trên trục số không thì \`numberline\`, có XẾP ĐÚNG THỨ TỰ không thì \`order\`. Hỏi cùng một dạng nhiều lần chỉ đo được trí nhớ về DẠNG BÀI.

${quizGuide(brief)}

---

Ít nhất **1 gate**, đặt **ngay sau** phần nó kiểm tra.

---

## 7. VÍ DỤ MẪU

Mỗi ví dụ dưới đây **đã chạy qua bộ kiểm tra thật và đạt 0 lỗi**. Hãy bắt chước *hình dạng* của chúng.

${examples}

---

## 8. Bố cục sư phạm của bài học

Đây là phần bị làm ẩu nhiều nhất. Một bài 10 scene, mỗi scene một ý, xem xong là hết — đó là **trailer**, không phải bài học.

${arcGuide(minutes)}

---

${
  brief
    ? ''
    : `## 9. Bài mẫu hoàn chỉnh

Một bài học thật, đủ 14 scene, đã qua toàn bộ cổng kiểm tra (0 lỗi, 0 cảnh báo): đủ 8 giai đoạn, kit chạy verb theo cue, ba cách biểu diễn (ghép đôi · khung mười · trục số), sơ đồ quyết định, một gate cho học sinh thao tác tay, một câu kiểm tra cuối khác dạng với lúc luyện.

\`\`\`json
${JSON.stringify({ doc: REFERENCE_DOC, bundle: REFERENCE_BUNDLE }, null, 2)}
\`\`\`

---`
}

## 10. Tự rà trước khi trả lời

Một cổng kiểm tra bằng code sẽ rà bài. Rà nhanh danh sách này rồi trả JSON — mỗi mục là một lỗi cổng có thể báo:

**Sư phạm**
- [ ] ~${planFor(minutes).scenes} scene, và lời giảng đủ dài để chạy hết ${planFor(minutes).minutes} phút? (\`too-short\`, \`runs-short\`)
- [ ] Mọi scene có \`phase\`? (\`no-phase\`)
- [ ] Đủ 8 giai đoạn, đúng thứ tự, không đi lùi? (\`phase-thin\`, \`phase-out-of-order\`)
- [ ] \`practice\` và \`checkout\` là \`kind:"gate"\`? (\`phase-not-gate\`)
- [ ] Mọi scene exposition có lời giảng dài, giọng nói với trẻ? (\`no-narration\`, \`narration-thin\`)

**Dùng đúng engine**
- [ ] **Mọi manipulative có \`actions\` buộc vào cue?** (\`kit-static\` — lỗi nặng nhất)
- [ ] ≥${RICHNESS.kits} loại kit khác nhau? (\`few-kits\`)
- [ ] ≥${RICHNESS.templates} template khác nhau? (\`few-templates\`)
- [ ] ≥${RICHNESS.quizTypes} loại câu hỏi? (\`few-quiz-types\`)
- [ ] ≥${RICHNESS.beatsPerScene} beat mỗi scene? (\`few-beats\`)
- [ ] Có diagram/chart/table? Có gate \`activity.manip\`? (\`no-structure\`, \`no-manip-gate\`)

**Kỹ thuật**
- [ ] Không có \`place\`/\`x\`/\`y\`/\`size\` ở bất cứ đâu? (\`unknown-slot\`, \`overflow\`)
- [ ] Mọi \`region\` là slot có thật của template đó? (\`unknown-slot\`, \`wrong-type\`)
- [ ] Chữ không vượt \`maxChars\`? (\`over-budget\`)
- [ ] Slot nhiều phần tử đều có \`flow.order\`? (\`missing-order\`)
- [ ] Mọi \`cue\` và \`at:"@..."\` đều có \`[[cue:]]\` + \`marks\`? (\`dangling-cue\`)
- [ ] Kit có \`labels\` đều đã dịch sang ngôn ngữ bài? (\`kit-labels-english\`)
- [ ] Giá trị enum trong \`params\` (shape, icon…) nằm trong danh sách hợp lệ ở §4? (\`kit-param-value\`)
- [ ] Câu hỏi đúng contract core: \`single\` + \`choices\` + \`answerId\`? (\`activity-quiz\`)

---

## 11. Việc của bạn

Soạn bài **"<CHỦ ĐỀ>"** cho **<ĐỐI TƯỢNG>**:

- **~${planFor(minutes).scenes} scene** cho bài ${planFor(minutes).minutes} phút, đi đủ 8 giai đoạn ở §8, mỗi scene khai \`phase\`. Đặt \`meta.targetMinutes\`.
- Mỗi scene **một ý**. Chọn template theo *việc nó phải làm*, không theo cái nào trông đẹp.
- **Manipulative phải có \`actions\`** buộc vào cue — kit đứng im là bài hỏng.
- Lời giảng viết bằng **giọng nói với người học đó** (gọi "em", hỏi han, chỉ vào thứ đang hiện), không phải giọng sách giáo khoa. Mỗi câu một \`[[cue:...]]\`, mỗi cue một beat.

Trả về **CHỈ** JSON \`{doc, bundle}\`.
`
}
