<!-- GENERATED từ engine đang chạy. Đừng sửa tay — sinh lại bằng:
     pnpm --filter @bingoo/explainer prompt   (hoặc tải từ trang /vi/explainer-import) -->

# Sinh một bài giảng Explainer (JSON)

Bạn là người soạn bài giảng tương tác. Hãy trả về **DUY NHẤT một object JSON**, không văn xuôi, không ```fence:

```
{ "doc": <ExplainerDoc>, "bundle": <LocaleBundle> }
```

Dán JSON đó vào trang **/vi/explainer-import** của bingoo để xem bài chạy thật.

---

## −1. Explainer là gì

Explainer không phải PowerPoint. Một bài viết như xấp slide sẽ không qua được cổng kiểm tra.

Nó là một **bảng trắng động, tua được, do LỜI GIẢNG điều khiển**. Về mặt kỹ thuật:

- Engine là một hàm thuần: `frame(program, t) → hình ảnh`. Cùng `t` ⇒ cùng pixel. Học sinh **tua ngược được**, và mọi thứ chạy lùi đúng như đã chạy tới.
- Bạn **không vẽ hình**. Bạn viết **một dòng thời gian buộc vào giọng nói**: cô giáo nói tới đâu, hình động tới đó.
- Bố cục do engine tính, cho **cả 16:9 lẫn 9:16**. Bạn chỉ đặt tên slot.
- **Manipulative là vật thao tác BIẾT LÀM ĐỘNG TÁC**, không phải hình minh hoạ. Nó đếm, ghép đôi, tách nhóm, tô màu — **ngay trước mắt học sinh, trong lúc cô đang nói**.
- Học sinh **làm bài ngay trong dòng thời gian** (`gate`), và có thể **kéo/chạm trực tiếp lên chính vật thao tác vừa học**.
- Sơ đồ, biểu đồ, bảng: engine **tự tính** vị trí node, chiều cao cột, góc quạt. Bạn chỉ đưa dữ liệu.

### Bạn có gì trong tay (kho learning primitives)

| Kho                      | Số lượng | Dùng ở đâu                                                                                       |
| ------------------------ | -------- | ------------------------------------------------------------------------------------------------ |
| **Template bố cục**      | 20       | `scene.layout.template` — §2                                                                     |
| **Loại phần tử**         | 11       | text · list · table · chart · stat · quote · image · shape · diagram · manipulative · stick — §3 |
| **Manipulative kit**     | 67       | `type:"manipulative"` và `activity.manip` — §4                                                   |
| **Verb của kit**         | 297      | `content.actions` — chạy theo cue lời giảng                                                      |
| **Loại câu hỏi**         | 55       | `activity.quiz` — §6                                                                             |
| **Kiểu đánh giá**        | 4        | quiz · manip · tracing · coloring — §6                                                           |
| **Hiệu ứng (beat verb)** | 12       | reveal · emphasize · drawOn · exit · revealAll · revealNode · connect… — §5                      |
| **Nền**                  | 5        | gradient · meadow · sky · grid · paper                                                           |

Đây **không phải danh sách để đọc cho vui** — bài dùng đi dùng lại **một** kit và **một** loại câu hỏi sẽ bị cổng từ chối (`few-kits`, `few-quiz-types`, `few-templates`).

**Hệ quả cho cách bạn viết:** mỗi câu lời giảng là **một nhịp** — một thứ xuất hiện, một thứ được nhấn, một vật thao tác làm một động tác. Một scene có hình đứng im trong lúc cô nói ba câu là một scene **hỏng**, dù nó hợp lệ về mặt schema.

---

## 0. CƠ CHẾ CUE — trái tim của engine

Đây là thứ buộc hình vào tiếng. Ba nơi phải **khớp tên với nhau**:

```json
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
```

Kết quả: học sinh **thấy tám ngôi sao ghép đôi ĐÚNG LÚC** cô đang đếm "hai, bốn, sáu, tám", rồi chữ "CHẴN" hiện ra đúng lúc cô nói "không còn bạn nào đứng một mình".

**LUẬT SỐNG CÒN — hình PHẢI bắt nhịp lời:** lời giảng nói bao nhiêu Ý thì màn hình phải động bấy nhiêu lần. Mỗi `[[cue:...]]` = một ý mới, và mỗi ý phải **mang MỘT thứ lên màn hình**: một callout hiện ra, một phần được nhấn, một dòng bullet, hoặc một verb của kit.

Sai điển hình (bị cổng `static-scene` từ chối): nhét **lời giảng nhiều ý lên `title-card`** (chỉ có 1 ảnh) — cô nói ba câu mà slide đứng im một tấm ảnh. **Cách đúng:**

- Lời giảng dài, nhiều ý → dùng `bullets` + beat `revealAll` (mỗi ý hiện một dòng theo cue), hoặc `teach` với các `callout` text `reveal` theo từng cue.
- Hoặc **TÁCH thành nhiều scene**, mỗi scene một ý — đừng dồn cả đoạn giải thích vào một slide tĩnh.
- `title-card`/`section` chỉ dành cho **một câu ngắn** (tên bài / tên phần), KHÔNG phải để giải thích.

**Luật:** mọi `cue` trong `beats` và mọi `at:"@..."` trong `actions` **phải** có `[[cue:...]]` trong script **và** một mục trong `marks`. Thiếu một trong ba = hiệu ứng không bao giờ chạy.

---

## 0b. Khung ngoài

```json
{
  "doc": {
    "version": "explainer/v2",
    "meta": { "id": "<slug>", "title": "<Tên bài>", "defaultLocale": "vi" },
    "locales": ["vi"],
    "theme": {
      "colors": {
        "ink": "#2b2724",
        "inkSoft": "#7d736a",
        "paper": "#f7f2e9",
        "accent": "#e07a42",
        "accent2": "#3f83bf",
        "good": "#3f9d5a",
        "warn": "#d98b2b",
        "faint": "#d8cfc2",
        "cloudFill": "#fbf8f2",
        "sunCore": "#f7d488",
        "leaf": "#bcd9a6",
        "leafDeep": "#6fae5a",
        "ground": "#cbb99c"
      },
      "fontSizes": { "label": 24, "caption": 28, "body": 32, "title": 64, "huge": 96 },
      "weights": { "sm": 4, "md": 7, "lg": 11 },
      "fonts": {
        "hand": "var(--font-baloo), ui-rounded, system-ui, sans-serif",
        "sans": "var(--font-bvp), system-ui, sans-serif"
      },
      "register": "warm"
    },
    "background": {
      "kind": "gradient",
      "from": "sunCore",
      "to": "paper",
      "angle": 160,
      "panel": true
    },
    "scenes": [/* 6–10 scene */]
  },
  "bundle": {
    "locale": "vi",
    "strings": { "<elementId>": "<chữ hiển thị>" },
    "narration": {
      "<ref>": {
        "script": "[[cue:c1]] Câu một. [[cue:c2]] Câu hai.",
        "voice": "vi-VN",
        "marks": [
          { "cue": "c1", "t": 0.2 },
          { "cue": "c2", "t": 2.4 }
        ]
      }
    }
  }
}
```

**`background.kind`**: `gradient` | `meadow` | `sky` | `grid` | `paper`. `panel: true` = bài nằm trên thẻ nổi giữa nền; `false` = tràn nền.

---

## 1. Quy ước bố cục

1. **Không viết toạ độ.** Không `place`, `x`, `y`, `size`, `w`, `h`, `overrides`. Engine tự tính rect cho **cả 16:9 lẫn 9:16**. Mỗi phần tử chỉ khai `region` = tên slot.
2. **Chỉ dùng tên slot có trong §2.** Slot lạ khiến phần tử rơi vào ô dự phòng.
3. **`maxChars` là số ĐO ĐƯỢC**, ở khổ chật hơn trong hai khổ. Vượt quá thì **cắt chữ** — hệ thống sẽ không thu nhỏ chữ để cứu bạn.
4. **Slot chứa nhiều phần tử** (steps, grid, stats, laneLabels) → mỗi phần tử **phải** có `flow: { order: 1..n }`.
5. **Chữ hiển thị**: `text`/`shape`/`quote` LUÔN lấy chữ từ `bundle.strings[id]` (để `content:{}`). Các loại slide (`list`/`table`/`stat`/`chart`), nhãn kit, `alt` ảnh và tiêu đề bài **có thể** viết inline trong doc (đơn giản cho bài MỘT ngôn ngữ) — engine đọc `bundle.strings[<khoá>]` trước, không có mới dùng inline làm dự phòng. **Để dịch / đa ngôn ngữ, xem §3b.**
6. **Mỗi `beat.cue` phải có `[[cue:...]]` tương ứng** trong `narration.script` **và** một mục trong `marks`.
7. **Biểu đồ: chỉ đưa `series`.** Chiều cao cột, góc quạt, mốc trục do engine tính — đừng tự tính.
8. **Ảnh: 4 trường TIẾNG ANH + 1 trường tiếng Việt.** Thư viện media là MỘT kho dùng chung cho cả sản phẩm, nên metadata của nó **là tiếng Anh**. Thiếu trường nào thì ảnh đó **không tìm lại được**, và bài sau lại phải sinh lại (tốn tiền).
   ```json
   {
     "kind": "image",
     "query": "a smiling yellow cartoon star for kids", // EN — tìm trong thư viện
     "prompt": "a smiling yellow cartoon star for kids, flat vector, white background", // EN — nếu phải sinh mới
     "tags": ["star", "yellow", "cartoon", "kids"], // EN, 2–5 từ khoá — KHÔNG có tag là KHÔNG lọc được
     "alt": "Ngôi sao vàng", // TIẾNG VIỆT — hiển thị cho học sinh
     "w": 1024,
     "h": 1024
   }
   ```
9. **Kit ship nhãn TIẾNG ANH mặc định.** Nếu bài không phải tiếng Anh, **luôn ghi đè** `labels` trong `params` — xem `defaultParams` ở §4 để biết kit nào có nhãn. Bỏ qua là bài hiện "7 is ODD" giữa bài tiếng Việt.
10. **Đừng bịa `src`.** Hệ thống tìm trong thư viện trước; không có mới sinh, và chỉ sinh khi người soạn bấm.

---

## 2. HỢP ĐỒNG BỐ CỤC

## teach

Giảng MỘT ý bằng một vật thao tác (manipulative) hoặc một hình lớn.

- `title` (text ×1 · rung=title · ≤37 ký tự) — Ý đang dạy, nói thành câu ngắn
- `stage` (image|shape|manipulative|stick|chart|table|list|stat ×1) — Vật chính học sinh nhìn vào
- `callout` (text ×0–1 · rung=label · ≤31 ký tự) — Kết luận một-hai chữ (VD: CHẴN)

## practice

Học sinh LÀM. Dùng cho scene kind='gate'.

- `prompt` (text ×1 · rung=title · ≤67 ký tự) — Câu lệnh của bài tập
- `activity` (image|shape|manipulative|stick|chart|table|list|stat ×0–1) — Hoạt động (gate tự dựng)

## compare

Đặt hai thứ cạnh nhau để lộ ra khác biệt.

- `title` (text ×1 · rung=title · ≤37 ký tự) — Câu hỏi so sánh
- `left` (image|shape|manipulative|stick|chart|table|list|stat ×1) — Vế trái
- `right` (image|shape|manipulative|stick|chart|table|list|stat ×1) — Vế phải
- `leftLabel` (text ×0–1 · rung=label · ≤55 ký tự) — Nhãn vế trái
- `rightLabel` (text ×0–1 · rung=label · ≤55 ký tự) — Nhãn vế phải

## rule

Chốt một quy tắc để nhớ.

- `title` (text ×1 · rung=title · ≤37 ký tự) — Tên quy tắc
- `card` (text ×1 · rung=body · ≤106 ký tự) — Nội dung quy tắc — NGẮN, học sinh phải nhớ được
- `support` (image|shape|manipulative|stick|chart|table|list|stat ×0–1) — Hình minh hoạ nhỏ

## sequence

Các bước theo thứ tự. Mỗi phần tử cần flow.order.

- `title` (text ×1 · rung=title · ≤37 ký tự) — Tên quy trình
- `steps` (image|shape|manipulative|stick|chart|table|list|stat ×2–5) — Mỗi bước một phần tử, ĐẶT flow.order 1..n

## recap

Tổng kết bài.

- `title` (text ×1 · rung=title · ≤37 ký tự) — Tiêu đề tổng kết
- `grid` (image|shape|manipulative|stick|chart|table|list|stat ×2–6) — Các ý đã học

## title-card

Mở bài.

- `title` (text ×1 · rung=title · ≤70 ký tự) — Tên bài
- `focal` (image|shape|manipulative|stick|chart|table|list|stat ×0–1) — Một hình duy nhất

## flow

Quy trình / cây / vòng lặp → element type='diagram'.

- `title` (text ×1 · rung=title · ≤37 ký tự) — Tên sơ đồ
- `diagram` (diagram ×1) — diagram (engine tự xếp node & cạnh)

## swimlane

BPMN — quy trình có nhiều vai.

- `title` (text ×1 · rung=title · ≤37 ký tự) — Tên quy trình
- `laneLabels` (text ×0–4 · rung=label · ≤28 ký tự) — Tên các vai
- `diagram` (diagram ×1) — diagram

## bullets

Ý chính dạng gạch đầu dòng. Thêm beat revealAll để build từng dòng theo lời giảng.

- `title` (text ×1 · rung=title · ≤67 ký tự) — Tiêu đề slide
- `list` (list ×1 · rung=body) — list, 3–5 items

## bullets-media

Gạch đầu dòng + một hình minh hoạ.

- `title` (text ×1 · rung=title · ≤37 ký tự) — Tiêu đề
- `list` (list ×1 · rung=body) — list, 3–4 items
- `media` (image|manipulative|shape ×1) — Hình

## two-col

Hai khối bất kỳ đặt cạnh nhau (VD: biểu đồ đối checklist).

- `title` (text ×1 · rung=title · ≤37 ký tự) — Tiêu đề
- `colA` (image|shape|manipulative|stick|chart|table|list|stat ×1) — Cột trái
- `colB` (image|shape|manipulative|stick|chart|table|list|stat ×1) — Cột phải

## data

Trình bày số liệu. Engine TỰ vẽ cột/quạt từ series — KHÔNG được tự tính chiều cao cột.

- `title` (text ×1 · rung=title · ≤37 ký tự) — Câu hỏi mà dữ liệu trả lời
- `chart` (chart ×1) — chart, 2–6 điểm dữ liệu
- `insight` (text ×0–1 · rung=body · ≤78 ký tự) — Điều rút ra — nói ý NGHĨA, đừng đọc lại số

## stats

2–4 con số đáng nhớ.

- `title` (text ×1 · rung=title · ≤67 ký tự) — Tiêu đề
- `stats` (stat ×2–4) — Mỗi ô một stat, ĐẶT flow.order

## quote

Một câu đáng nhớ. KHÔNG có tiêu đề — câu nói LÀ tiêu đề.

- `quote` (quote ×1 · rung=title) — quote (text + by)

## table

So sánh nhiều thứ theo nhiều chiều.

- `title` (text ×1 · rung=title · ≤37 ký tự) — Tiêu đề
- `table` (table ×1) — table, ≤4 cột × ≤5 hàng

## image-grid

Nhiều hình cùng loại để đếm/nhóm/đối chiếu.

- `title` (text ×1 · rung=title · ≤37 ký tự) — Tiêu đề
- `grid` (image|manipulative|shape ×2–6) — Các hình, ĐẶT flow.order

## definition

Định nghĩa một thuật ngữ.

- `term` (text ×1 · rung=huge · ≤23 ký tự) — Thuật ngữ (1–3 chữ)
- `meaning` (text ×1 · rung=body · ≤159 ký tự) — Nghĩa, bằng lời của học sinh
- `example` (text ×0–1 · rung=body · ≤106 ký tự) — Ví dụ cụ thể

## worked-example

Bài mẫu: đề → các bước → đáp án. Hình dạng chuẩn của một bài toán.

- `title` (text ×1 · rung=title · ≤37 ký tự) — Tiêu đề
- `problem` (text ×1 · rung=body · ≤106 ký tự) — Đề bài
- `steps` (list ×1 · rung=body) — list style='number', 2–4 bước
- `answer` (stat|text ×1 · ≤41 ký tự) — Đáp án

## section

Vách ngăn giữa các phần của bài.

- `kicker` (text ×0–1 · rung=label · ≤66 ký tự) — Nhãn phần (VD: PHẦN 2)
- `title` (text ×1 · rung=huge · ≤46 ký tự) — Tên phần

---

## 3. Loại phần tử

| type           | content                                                                                                                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `text`         | `{}` — chữ lấy từ `bundle.strings[id]`; `style.fontSize` = rung mà slot yêu cầu                                                                                                                |
| `list`         | `{ "style":"bullet\|number\|check\|dash", "items":["...", "..."] }`                                                                                                                            |
| `table`        | `{ "header":[...], "rows":[[...]] }` — ≤4 cột × ≤5 hàng                                                                                                                                        |
| `chart`        | `{ "chart":"bar\|column\|line\|area\|pie\|donut", "series":[{"label":"...","value":18,"color":"good"}], "unit":" bạn" }`                                                                       |
| `stat`         | `{ "value":"50", "unit":"%", "label":"...", "color":"accent" }`                                                                                                                                |
| `quote`        | `{}` — chữ ở `strings[id]`, tác giả ở `strings["<id>.by"]`                                                                                                                                     |
| `image`        | `{ "kind":"image", "query":"<EN>", "prompt":"<EN>", "tags":["<EN>",…], "alt":"<tiếng Việt>", "w":1024, "h":1024 }` — xem §1.8                                                                  |
| `diagram`      | `{ "layoutKind":"flow\|tree\|cycle\|grid\|timeline", "direction":"auto", "nodes":[{"id","label","shape":"box\|diamond\|circle\|pill"}], "edges":[{"id","from","to","label","kind":"arrow"}] }` |
| `manipulative` | `{ "kind":"<xem §4>", "params":{...} }`                                                                                                                                                        |

---

## 3b. Chữ & đa ngôn ngữ (localization)

MỌI chữ tác giả trong bài đều **ghi đè được theo ngôn ngữ** qua `bundle.strings`, theo đúng khoá dưới. Engine đọc `bundle.strings[KHOÁ]` trước; không có thì dùng chữ inline trong doc (làm dự phòng cho ngôn ngữ gốc).

| Nội dung                                    | Khoá trong `bundle.strings`      |
| ------------------------------------------- | -------------------------------- |
| Tiêu đề bài                                 | `"meta.title"`                   |
| `text` / `shape`                            | `"<id>"`                         |
| `quote` — câu · tác giả                     | `"<id>"` · `"<id>.by"`           |
| `list` item thứ i (0-based)                 | `"<id>.<i>"`                     |
| `chart` nhãn series thứ i                   | `"<id>.<i>"`                     |
| `table` header i · ô hàng r cột c           | `"<id>.h<i>"` · `"<id>.<r>.<c>"` |
| `stat` giá trị · nhãn                       | `"<id>.value"` · `"<id>.label"`  |
| `image` `alt` (hiện ở placeholder)          | `"<id>.alt"`                     |
| `manipulative` nhãn k trong `params.labels` | `"<id>.label.<k>"`               |

**Bài MỘT ngôn ngữ** → viết chữ inline trong doc (items/header/rows/value/label/alt/params.labels) là đủ; trả `{ doc, bundle }`.

**Bài NHIỀU ngôn ngữ → SINH NỘI DUNG NATIVE cho từng ngôn ngữ, KHÔNG dịch máy.** Trả `{ "doc": …, "bundles": { "vi": {…}, "en": {…} } }` (dùng `bundles` thay `bundle`), `doc.locales` liệt kê đủ. Một `doc` DÙNG CHUNG (cùng scene, cùng cue, cùng manipulative, cùng nhịp) — chỉ phần CHỮ khác nhau, đặt trong bundle mỗi ngôn ngữ theo ĐẦY ĐỦ khoá ở bảng trên.

- **Viết như một giáo viên BẢN NGỮ của ngôn ngữ đó**, không phải người dịch: mỗi ngôn ngữ diễn đạt tự nhiên, đúng văn phong trẻ em bản xứ, cùng Ý nhưng KHÔNG bám câu chữ tiếng gốc. Dịch word-for-word làm mất bản chất — lời giảng đọc gượng, ví dụ/cách nói không hợp văn hoá.
- **Giữ NGUYÊN nhịp sư phạm**: mỗi `bundle.narration[ref].script` phải có ĐÚNG các `[[cue:cN]]` như bản gốc (cùng số cue, cùng thứ tự) để khớp `beats`/`marks` của doc dùng chung. Ý mỗi cue giữ nguyên; chỉ lời văn đổi.
- **Nội dung đang DẠY giữ y hệt mọi ngôn ngữ.** Bài dạy tiếng Trung: `你好`/`谢谢`/`再见` (và phiên âm `nǐ hǎo`), hay số/công thức toán — **KHÔNG đổi**, chúng là thứ học sinh phải học. Chỉ chữ HƯỚNG DẪN quanh chúng viết lại theo từng ngôn ngữ.

`{ doc, bundle }` (một ngôn ngữ) vẫn nhận bình thường.

---

## 4. Bộ manipulative (67 kit)

Mỗi kit: **nó là gì** · `params` · `verbs` **kèm args**. Chỉ dùng những gì có trong danh sách — bịa ra là bài hỏng.
Copy shape từ `params`, **ghi đè `labels` sang tiếng Việt** nếu kit đó có, và **luôn gọi verb theo cue**.

```
### numberline
NumberLine manipulative.
params: {"min":0,"max":10,"step":1,"marks":[],"points":[],"point":null,"range":null}
verbs:  jump({a,from,b,to}) · placePoint({x}) · mark({x}) · highlightRange({a,from,b,to})

### base10
Base-10 blocks. The regroup / "nhớ" (carry) is the whole point: ten loose ones physically gather and snap into a single ten-rod (or ten rods into a hundred-flat), driven by a baked progress so it seek
params: {"hundreds":0,"tens":0,"ones":0}
verbs:  add({n}) · remove({n}) · group10 · regroup

### fraction
Fraction. A bar or circle divided into `denominator` equal parts, some shaded.
params: {"denominator":2,"shaded":[0],"shape":"bar","compareTo":null}
verbs:  split({n}) · shade({k}) · merge · equivalent({n}) · compare({other})

### arrayarea
Array / area model for multiplication & area.
params: {"rows":3,"cols":4,"filled":false,"split":null,"highlight":null}
verbs:  fill · splitArea({a}) · highlightCell({r,c})

### barmodel
Singapore bar model.
params: {"bars":[{"label":"a","value":4},{"label":"b","value":6}],"parts":null,"revealUnknown":false,"combined":false}
verbs:  partition({n}) · compare · showUnknown · combine

### graph
params: {"xRange":[-5,5],"yRange":[-5,5],"points":[],"functions":[],"trace":null,"axisHi":null}
verbs:  plotPoint · drawCurve · traceValue · highlightAxis

### expression
algebra expression.
params: {"tree":{"id":"r","type":"op","op":"+","args":[{"id":"a","type":"num","value":2},{"id":"b","type":"op","op":"*","args":[{"id":"c","type":"num","value":3},{"id":"x","type":"var","name":"x"}]}]},"highlight":[],"subst":{},"moved":null}
verbs:  highlightTerm({id}) · moveTerm({id}) · substitute({id,val}) · simplifyStep

### clock
analog clock.
params: {"hour":3,"minute":0,"showAngle":false,"sweep":null}
verbs:  setTime({h,m}) · advance({min}) · showAngle · sweep({from,to})

### geoshape
geometry shape. A polygon (normalised vertices) with side labels, angle arcs and tick marks. Rigid transforms are stored as a POSE (rot / mirror / translate) over fixed base vertices, so rotate/reflec
params: {"base":[[0.3,0.7],[0.7,0.7],[0.5,0.3]],"rot":0,"sx":1,"sy":1,"tx":0,"ty":0,"sideLabels":{},"angleArcs":[],"ticks":[]}
verbs:  rotate({deg}) · reflect({axis}) · translate({dx,dy}) · labelSide({edge,label}) · markAngle({vertex})

### tenframe
Ten frame (Cambridge Primary, early number / bonds). A 2×5 grid (or two, for 20) filled with counters.
params: {"capacity":10,"count":0,"bond":null,"icon":"dot"}
giá trị hợp lệ → icon: dot | circle | star | apple | heart | flower
verbs:  add({n}) · remove({n}) · bond({k}) · fill({n})

### partwhole
Part-whole ("cherry") model (Cambridge: number bonds, missing part). A whole on top, parts below joined by connectors.
params: {"whole":10,"parts":[6,4],"unknown":null,"revealed":false}
verbs:  split({parts}) · showWhole · showPart({i}) · findUnknown({which}) · reveal

### placevalue
Place-value chart with counters/discs (Cambridge: place value, exchange/regroup). Columns labelled (Th H T O …) hold a digit card + that many discs. `exchange` animates ten discs in a column collapsin
params: {"places":["H","T","O"],"digits":[0,0,0],"expanded":false}
verbs:  setValue({n}) · addCounter({col}) · exchange({col}) · partition

### hundredsquare
1..100 grid (Cambridge: counting, patterns, multiples).
params: {"rows":10,"cols":10,"highlight":[],"multiples":null,"countStep":null,"cover":null}
verbs:  highlightNumber({n}) · highlightMultiples({k}) · countBy({step}) · coverRange({a,b})

### fractionwall
Fraction wall (Cambridge: compare & equivalent fractions). Stacked unit bars each split into 1, 2, 3 … equal parts.
params: {"rows":[1,2,3,4],"shade":{},"highlight":[]}
verbs:  addRow({n}) · highlightRow({n}) · shadeRow({n,k}) · compare({a,b})

### money
coins & notes (Cambridge: money, making amounts, change). Values in the smallest unit (e.g. cents). `total` is the sum → verifiable by code.
params: {"coins":[],"target":null,"currency":{"major":"$","minor":"¢","ratio":100},"totalLabel":"Total"}
verbs:  addCoin({value}) · makeAmount({amount}) · giveChange({paid,cost}) · setTarget({amount})

### measurescale
pan balance (Cambridge: mass, comparing, equality). The beam tilts by the difference of the two pans; equal → level.
params: {"left":0,"right":0,"showCompare":false}
verbs:  setLeft({n}) · setRight({n}) · addLeft({n}) · addRight({n}) · compare

### datachart
categorical data (Cambridge: Statistics — pictogram, bar chart, tally). One dataset, three views.
params: {"categories":[{"label":"Red","value":4},{"label":"Blue","value":6},{"label":"Yellow","value":3}],"mode":"bar","unit":1,"highlight":null,"showTotal":false,"labels":{"total":"Total = {n}"}}
verbs:  setMode({mode}) · addData({label,n}) · highlightBar({label}) · showTotal

### spinner
probability spinner (Cambridge: probability, likelihood). A wheel of weighted sectors + a pointer. `spin(to)` rotates the pointer (baked, multi- turn, settling on a sector) — deterministic, no live ra
params: {"sectors":[{"label":"A","weight":1},{"label":"B","weight":1},{"label":"C","weight":1},{"label":"D","weight":1}],"angle":0,"highlight":null,"labels":{"result":"Result: {label}"}}
verbs:  spin({to}) · addSector({label,weight}) · highlightOutcome({index})

### net3d
2D net ↔ 3D solid (Cambridge: 3D shapes, nets, faces/edges/vertices). Shows a cube net and an isometric cube; `fold` crossfades net→solid.
params: {"solid":"cube","faces":6,"edges":12,"vertices":8,"folded":false,"highlightFace":null,"showCounts":false,"labels":{"counts":"Faces {faces} · Edges {edges} · Vertices {vertices}"}}
verbs:  showNet · fold · highlightFace({i}) · showCounts

### coordinategrid
coordinate grid (Cambridge: position & direction). First- quadrant integer grid; plot points, read coordinates, translate/reflect a point.
params: {"size":6,"points":[],"mover":null,"read":null}
verbs:  plot({x,y,label}) · translate({dx,dy}) · reflect({axis}) · readCoord({x,y})

### phonics
Phonics sound blocks (Cambridge Primary English: Reading — phonics & word recognition). A word shown as grapheme boxes with "sound buttons"; `segment` slides them apart to sound each phoneme, `blend`
params: {"graphemes":["c","a","t"],"segmented":false,"sounded":null}
verbs:  segment · blend · sound({i}) · setWord({graphemes,word})

### wordbuilder
letter tiles (Cambridge Primary English: spelling, word families, minimal pairs — cat → cot → cog).
params: {"letters":["c","a","t"],"highlight":null}
verbs:  addLetter({ch}) · removeLetter · changeLetter({i,ch}) · highlight({i})

### syllable
syllable splitting & stress (Cambridge Primary English: reading longer words, spelling).
params: {"syllables":["but","ter","fly"],"split":false,"stress":null,"labels":{"syllables":"{n} syllables"}}
verbs:  split({syllables}) · clap · stress({i})

### wordclass
parts of speech (Cambridge Primary English: Grammar). Each word in a sentence carries a word class; revealing/ tagging colours it and shows a legend.
params: {"tokens":[{"word":"the","cls":"det"},{"word":"big","cls":"adj"},{"word":"dog","cls":"noun"},{"word":"runs","cls":"verb"}],"revealed":[],"highlight":null,"labels":{"noun":"noun","verb":"verb","adj":"adjective","adv":"adverb","pron":"pronoun","det":"determiner","prep":"preposition","conj":"conjunction"}}
verbs:  tag({i,cls}) · revealClass({cls}) · highlightClass({cls}) · reveal

### punctuation
capital letters & punctuation (Cambridge Primary English: Writing — punctuation). Fix a plain string: capitalise words, drop in end marks / commas.
params: {"words":["i","like","cats"],"capitals":[],"marks":[]}
verbs:  capitalize({i}) · addMark({after,mark}) · addComma({after})

### tense
verb tense timeline (Cambridge Primary English: Grammar — past / present / future). A verb form sits in the active time zone; `conjugate` reveals all three.
params: {"forms":{"past":"walked","present":"walk","future":"will walk"},"tense":"present","showAll":false,"labels":{"past":"Past","present":"Present","future":"Future"}}
verbs:  setTense({t}) · conjugate · highlight({t})

### morpheme
prefix + root + suffix (Cambridge Primary English: vocabulary & spelling — word building, e.g. un + happy + ness).
params: {"root":"happy","prefix":null,"suffix":null,"highlight":null,"labels":{"prefix":"prefix","suffix":"suffix","root":"root"}}
verbs:  addPrefix({p}) · addSuffix({s}) · removeAffix({which}) · highlight({part})

### story
story structure (Cambridge Primary English: Reading & Writing — sequencing, beginning/middle/end). Stage boxes joined by arrows, events dropped into stages.
params: {"stages":["Beginning","Middle","End"],"events":[],"highlight":null,"arrows":false}
verbs:  addEvent({stage,text}) · highlightStage({i}) · reveal

### alphabet
alphabet arc (Cambridge Primary English: phonics/handwriting — letter knowledge, upper/lower case, vowels).
params: {"highlight":null,"match":null,"vowels":false}
verbs:  highlightLetter({ch}) · matchCase({ch}) · showVowels

### states
states of matter (Cambridge Primary Science: Chemistry — solids, liquids, gases & changes of state). A particle model: heating loosens the arrangement (solid→liquid→gas), cooling tightens it. Particle
params: {"state":"solid","count":25,"labels":{"solid":"Solid","liquid":"Liquid","gas":"Gas"}}
verbs:  heat · cool · setState({state})

### circuit
simple electric circuit (Cambridge Primary Science: Physics — electricity). A loop with a cell, a bulb and a switch. Closing the switch lets current flow (dots travel the loop, bulb lights).
params: {"closed":false,"bulbs":1,"labels":{"closed":"Circuit closed — lamp on","open":"Circuit open — lamp off"}}
verbs:  closeSwitch · openSwitch · setBulbs({n})

### forces
forces & motion (Cambridge Primary Science: Physics — pushes, pulls, balanced/unbalanced forces). Arrows on a box; the net force shifts it.
params: {"left":0,"right":0,"showNet":false,"labels":{"balanced":"Balanced — object at rest","net":"Net force {n} to the {dir} — object moves","left":"left","right":"right"}}
verbs:  pushLeft({n}) · pushRight({n}) · setForces({left,right}) · showNet · reset

### lifecycle
life cycle (Cambridge Primary Science: Biology — life cycles of plants & animals). Stages arranged in a ring with arrows; advance moves the marker.
params: {"stages":["Egg","Larva","Pupa","Butterfly"],"current":0,"revealed":false}
verbs:  advance · setStage({i}) · reveal

### foodchain
food chain / energy flow (Cambridge Primary Science: Biology — feeding relationships). Organisms linked left→right by energy arrows.
params: {"organisms":["Grass","Grasshopper","Frog","Snake"],"links":0,"highlight":null,"labels":{"energyFlow":"→ direction of energy flow"}}
verbs:  addLink · addOrganism({label}) · highlight({i})

### organism
labelled organism (Cambridge Primary Science: Biology — parts of a plant / animal). A simple plant diagram; reveal leader-lines + labels for each part.
params: {"parts":[{"name":"flower","x":0.5,"y":0.2},{"name":"leaf","x":0.63,"y":0.45},{"name":"stem","x":0.5,"y":0.55},{"name":"root","x":0.5,"y":0.85}],"revealed":[],"highlight":null}
verbs:  revealPart({name}) · highlightPart({name}) · revealAll

### orbit
Sun–planet orbit & day/night (Cambridge Primary Science: Earth & Space). A planet circles the Sun; its lit half faces the Sun (day), the far half is night.
params: {"angle":0,"dayNight":false,"labels":{"sun":"Sun","dayNight":"day | night","caption":"Earth orbits the Sun"}}
verbs:  orbit({to}) · showDayNight · spin

### thermometer
thermometer (Cambridge Primary Science: measuring temperature; enquiry). A scale + liquid column.
params: {"temp":20,"min":-10,"max":110,"marks":[]}
verbs:  setTemp({n}) · mark({n}) · compare({n})

### shadow
light & shadow (Cambridge Primary Science: Physics — light, how shadows form and change). A light source casts an object's shadow on the ground; moving the light changes the shadow's direction & lengt
params: {"lightX":0.2,"height":0.4,"rays":false,"labels":{"caption":"Low light → long shadow; high light → short shadow"}}
verbs:  moveLight({x}) · showRays · setHeight({h})

### count
CountObjects (đếm vật thật). Shows `count` icons (apple / star / flower / heart / dot) arranged like a ten-frame (rows of 5) with a big number, for teaching one-to-one counting 1→10. Icons are path/ci
params: {"count":0,"shape":"apple","highlight":null}
giá trị hợp lệ → shape: apple | star | flower | heart | dot
verbs:  add({n}) · remove({n}) · setCount({n}) · setShape({shape}) · highlight({i})

### share
equal sharing / grouping (chia đều) — division. `total` objects are dealt one-by-one, round-robin, into `groups` bins; the leftover is the remainder. Teaches total ÷ groups = perGroup (dư remainder).
params: {"total":12,"groups":3,"dealt":12,"highlight":null,"labels":{"result":"{total} ÷ {g} = {per}","remainder":" r {rem}","dealing":"Sharing {total} into {g} groups…"}}
verbs:  setTotal({n}) · setGroups({g}) · deal · highlight({bin})

### evenodd
even / odd (số chẵn, số lẻ). `number` objects arranged in pairs (2 columns); if one is left over the number is odd, else even. Teaches n = 2·k (+1).
params: {"number":7,"showResult":false,"labels":{"odd":"{n} is ODD","even":"{n} is EVEN"},"icon":"star"}
giá trị hợp lệ → icon: dot | circle | star | apple | heart | flower
verbs:  setNumber({n}) · add({n}) · remove({n}) · showResult

### estimate
estimation (ước lượng). A jar of `actual` objects (scattered, so hard to count exactly); the learner sets a `guess` on a 0..max scale, then `reveal` neatly arranges & counts them to compare.
params: {"actual":18,"guess":10,"max":30,"revealed":false,"labels":{"revealed":"Guess: {guess} · Actual: {actual}","close":" — very close!","guessing":"Your guess: {guess}"}}
verbs:  setActual({n}) · guess({n}) · setMax({m}) · reveal

### table
params: {"columns":["Mon","Wed","Fri"],"rows":[{"label":"Apple","values":[3,5,2]},{"label":"Banana","values":[4,4,6]},{"label":"Orange","values":[2,3,3]}],"highlight":null,"showTotal":false,"totalLabel":"Total"}
verbs:  highlightRow · highlightCol · showTotal · clear

### pattern
PatternTrain (quy luật lặp: AB, AAB, ABC…). A train of coloured shapes sits on a baseline; the repeating unit is bracketed and lettered (A B / A A B …) so the child SEES the rule, then extends the tra
params: {"unit":["red","blue"],"items":6,"hidden":null,"choice":null,"sizeHint":1}
verbs:  extend({n}) · hide({i}) · revealHidden · setUnit({unit}) · chooseNext({v})

### subitize
Subitize (nhìn nhanh số lượng — instant recognition of 1–10 without counting). A big dot card shows `count` dots in one of four arrangements (dice / pairs / random / tenframe); the SAME number can be
params: {"count":5,"arrangement":"dice","revealed":true,"flash":false,"showNumeral":false,"guess":null,"icon":"dot"}
giá trị hợp lệ → arrangement: dice | pairs | random | tenframe  ·  icon: dot | circle | star | apple | heart | flower
verbs:  show({count,arrangement}) · hideCard · reveal · rearrange({arrangement}) · guess({n})

### comparegroups
CompareGroups (so sánh nhiều hơn / ít hơn / bằng nhau). Two groups of counters (left = accent, right = accent2) with ONE-TO-ONE pairing lines: pair them up, the leftovers get a warn ring — that group
params: {"left":3,"right":5,"leftLabel":"A","rightLabel":"B","paired":0,"symbol":null,"choice":null,"icon":"circle"}
giá trị hợp lệ → icon: dot | circle | star | apple | heart | flower
verbs:  addLeft({n}) · addRight({n}) · pairUp · showSymbol · chooseSymbol({s}) · clear

### ordinal
OrdinalQueue (số thứ tự 1st..10th). A queue of little stick figures walks toward a flag; positions are counted FROM the flag, so DIRECTION matters — an arrow under the queue shows the counting directi
params: {"n":5,"highlight":1,"labels":true,"facing":"right"}
verbs:  highlightPos({pos}) · setCount({n}) · showLabels · flip

### addstory
AdditionStory (bài toán có lời văn trực quan: gộp vào / bớt đi). A scene: `a` icons (birds / fish / apples / dots) settled on a branch; for "+" the `b` group flies IN from the right edge along an arc,
params: {"a":3,"b":2,"op":"+","icon":"bird","phase":"done","answer":null}
giá trị hợp lệ → icon: bird | fish | apple | dot
verbs:  setStory({op,a,b}) · act · showResult · answer({n}) · reset

### integerchips
IntegerChips (số nguyên âm — chip dương/âm & cặp triệt tiêu). Middle-school (THCS, grade 6) integers: plus chips live in a top zone, minus chips in a bottom zone; `cancelPairs` slides one +/− pair at
params: {"pos":4,"neg":2,"showValue":false,"pairing":0}
verbs:  addPos({n}) · addNeg({n}) · cancelPairs · showValue

### algebratile
AlgebraTiles (giải phương trình bằng gạch đại số). Middle school (THCS, grades 6–8): model a linear equation on a two-sided mat — x-tiles (long rects, labeled "x") and unit tiles (small squares); nega
params: {"left":{"x":2,"units":3},"right":{"x":0,"units":7},"showSolution":false,"split":false,"answer":null}
verbs:  addBoth({x,units}) · removeBoth({x,units}) · splitEqually · showSolution · setAnswer({v})

### equationbalance
EquationBalance (cân thăng bằng phương trình ax+b=c). Middle school (THCS, grades 6–8): a beam balance that stays LEVEL — the equation is always true — with `a` x-bags + `b` unit weights on the left p
params: {"a":2,"b":3,"c":11,"step":"start","showX":false,"answer":null}
giá trị hợp lệ → step: start | minusB | divided
verbs:  takeFromBoth({n}) · divideBoth · showX · setAnswer({v})

### functionmachine
FunctionMachine (máy hàm số). A linear function y = kx + b as an input → rule → output machine for upper primary / middle school (ages 9–14): a number ball is fed into the left chute, the gears turn,
params: {"rule":{"k":2,"b":1},"ruleVisible":false,"history":[{"x":1,"y":3},{"x":2,"y":5}],"feeding":null,"guess":null,"answer":null}
verbs:  feed({x}) · setRule({k,b}) · revealRule · clear · guessRule({k,b}) · answer({y})

### ratiotable
RatioTable (bảng tỉ số / quy tắc tam suất). Ratio & proportion on a double-row table for upper primary / middle school (9–13): row A and row B stay in the fixed ratio baseA : baseB, every column is th
params: {"baseA":2,"baseB":3,"unitA":"cups","unitB":"lemons","columns":[1],"highlight":null,"showUnitRate":false,"filled":null}
verbs:  addColumn({m}) · highlight({m}) · showUnitRate · setBase({a,b}) · fillCell({row,m,v})

### factortree
FactorTree (cây thừa số nguyên tố). Prime factorization as a splitting tree for upper primary / middle school (ages 10–14): the number n sits at the root; each split [a,b] breaks the current leftmost
params: {"n":36,"splits":[],"circled":false,"showProduct":false}
verbs:  split({a,b}) · splitBy({d}) · circlePrimes · showProduct · reset({n})

### unitcircle
UnitCircle (đường tròn lượng giác, THPT 15–18). The trig unit circle: a radius GLIDES to any angle (linear in angle value — never the "short way", so 350°→10° sweeps back through 180°) while sin (vert
params: {"angle":45,"showSin":true,"showCos":true,"showTan":false,"radians":false,"sweep":true}
verbs:  setAngle · showSin · showCos · showTan · toRadians · toDegrees

### trianglelab
TriangleLab (tam giác THPT 15–18): three reasoning modes. "angles": a triangle built from two given angles; showWork tears the three angle wedges off the vertices and re-lines them up on a straight li
params: {"mode":"angles","angles":[60,50],"legs":[3,4],"showWork":false,"highlight":null,"ratioFn":"sin","answer":null,"sideNames":{"hyp":"hyp","opp":"opp","adj":"adj"}}
giá trị hợp lệ → mode: angles | pythagoras | ratio
verbs:  setMode({mode}) · setAngles({a,b}) · setLegs({a,b}) · showWork · highlightSide({side}) · setRatio({fn}) · answer

### transformgrid
TransformGrid (phép biến hình trên lưới, THPT 15–18). Geometric transformations of a polygon on a −R..R coordinate grid: tịnh tiến (translate), đối xứng trục (reflect across x/y axis), quay quanh gốc
params: {"shape":[[0,0],[2,0],[2,1],[1,1],[1,2],[0,2]],"transforms":[],"showGhosts":true,"gridRange":6,"mark":null}
verbs:  translate({dx,dy}) · reflect({axis}) · rotate({deg}) · dilate({k}) · resetShape({shape}) · toggleGhosts · markPoint({x,y})

### probtree
ProbabilityTree (cây xác suất hai tầng). A two-stage probability tree: root → stage-1 branches → stage-2 sub-branches, with the branch probability written on every segment and the product probability
params: {"stage1":[{"label":"H","p":0.5},{"label":"T","p":0.5}],"stage2":[{"label":"H","p":0.5},{"label":"T","p":0.5}],"revealed":2,"highlightPath":null,"showProducts":false,"answer":null}
verbs:  reveal({stage}) · highlight({path}) · showProducts · setStages({stage1,stage2}) · answer({p})

### statplot
StatPlot (thống kê mô tả: trung bình, trung vị, mốt, khoảng biến thiên). A dot plot on a number axis with live COMPUTED statistics: mean (balance-triangle + dashed line), median (flag), mode (ringed c
params: {"data":[3,5,5,6,7,8,8,8,10],"min":0,"max":15,"show":{"mean":false,"median":false,"mode":false,"range":false},"labels":{"mean":"mean","median":"median","mode":"mode","range":"range"},"answer":null}
verbs:  addData({v}) · removeData({v}) · showMean · showMedian · showMode · showRange · setData({data}) · answer({v})

### calculusgraph
CalculusGraph (giải tích: đạo hàm là hệ số góc tiếp tuyến, tích phân là diện tích dưới đường cong). One curve, two modes: · tangent — a point that GLIDES along the curve with its tangent line, a rise/
params: {"fn":"quadratic","mode":"tangent","x0":2,"a":0,"b":4,"bars":4,"showValue":false,"answer":null}
giá trị hợp lệ → fn: quadratic | cubic | sin
verbs:  setPoint({x}) · setInterval({a,b}) · refine · setBars({n}) · showValue · setMode({mode}) · setFn({fn}) · answer({v})

### rhymetime
RhymeTime (vần điệu / word families: cat–hat–bat). A rime (e.g. "-at") sits in a central box; onset letters queue on the left and GLIDE in to snap in front of the rime, building one rhyming word per r
params: {"rime":"at","onsets":["c","h","b","s"],"built":0,"odd":{"word":"dog","present":false},"oddMarked":false,"highlightRime":false,"choice":null}
verbs:  build · buildAll · highlightRime · showOdd({word}) · spotOdd · choose({word})

### minimalpair
MinimalPair (cặp âm tối thiểu: ship–sheep). Two word cards whose ONLY difference is one grapheme/phoneme — the contrasting letters are rendered bigger + accent inside each word, the IPA row highlights
params: {"a":{"word":"ship","ipa":"/ʃɪp/","mouth":"flat"},"b":{"word":"sheep","ipa":"/ʃiːp/","mouth":"wide"},"diffIndex":2,"focus":null,"showIpa":false,"chosen":null}
verbs:  focus({side}) · contrast · showIpa · choose({side}) · setPair({a,b,diffIndex})

### wordform
WordFormFamily (họ từ / word form — exam prep TOEIC/TOEFL/IELTS, e.g. decide → decision → decisive → decisively). The root word sits in a hub; POS satellites reveal each derived form with its suffix h
params: {"root":"decide","family":[{"pos":"noun","word":"decision"},{"pos":"verb","word":"decide"},{"pos":"adjective","word":"decisive"},{"pos":"adverb","word":"decisively"}],"posLabels":{"noun":"noun","verb":"verb","adjective":"adjective","adverb":"adverb"},"revealed":[],"sentence":{"template":"Her ___ was final.","correctPos":"noun"},"placed":null}
verbs:  reveal · revealAll · highlightSuffix · place · setFamily

### paraphrase
ParaphrasePair (nhận diện đồng nghĩa giữa câu hỏi và bài đọc — kỹ năng IELTS reading/listening, exam prep). Two sentences as rows of word chips; revealing an alignment underlines the matching chunks i
params: {"a":"The government increased funding for public schools.","b":"State financing of education rose.","links":[[[1],[0]],[[2,3],[1]],[[4,5,6],[2,3]]],"shown":0,"focus":null,"pick":null,"selA":null}
verbs:  showNext · showAll · focus · pick · clear · setPair

### essaymap
EssayMap: essay structure builder (IELTS Writing Task 2 / academic writing; ages 15+ / adult). A vertical map of essay blocks (hook → thesis → topic → evidence → conclusion) revealed top-down with lin
params: {"blocks":[{"role":"hook","text":"Remote work is now common worldwide."},{"role":"thesis","text":"I believe it benefits staff and firms."},{"role":"topic","text":"Employees save hours of commuting."},{"role":"evidence","text":"Surveys report two extra free hours a day."},{"role":"conclusion","text":"Flexible work is a clear win for both."}],"revealed":1,"order":[0,1,2,3,4],"connective":["First,","For example,","In conclusion,"],"mode":"build","rolesShown":true,"sel":null}
verbs:  reveal · revealAll · swap({i,j}) · showRoles · setMode({mode}) · setBlocks({blocks})

### dialogue
DialogueFlow: conversation / exchange builder (TOEIC conversations, business email chains, speaking-test role-play; teens–adult). A two-speaker chat: bubbles appear turn by turn (play mode), functiona
params: {"speakers":["A","B"],"turns":[{"who":0,"text":"Good morning! Could you review my report?","fn":"request"},{"who":1,"text":"Of course. When do you need it back?","fn":"agreeing"},{"who":0,"text":"Would this Friday be possible?","fn":"request"},{"who":1,"text":"Certainly — Friday works for me.","fn":"confirming"}],"shown":1,"order":[0,1,2,3],"mode":"play","highlightFn":null,"sel":null}
verbs:  next · playAll · swap({i,j}) · highlightFn · setDialogue({speakers,turns}) · setMode({mode})

### stresspattern
WordStress: word stress & syllables (academic pronunciation, IELTS speaking; teens–adult). Syllable boxes joined by dots; the learner marks the stressed syllable (big accent dot glides above it), metr
params: {"word":"photograph","syllables":["pho","to","graph"],"stressed":0,"marked":null,"compare":{"word":"photography","syllables":["pho","to","gra","phy"],"stressed":1},"showCompare":false,"showBeats":false}
verbs:  mark({i}) · showBeats · showCompare · reveal · setWord({word,syllables,stressed,compare})
```

---

## 5. Hiệu ứng theo lời giảng (`beats`)

```json
"beats": [{ "id":"b1", "cue":"c1", "actions":[{ "verb":"reveal", "target":"<id>" }] }]
```

Verb: `reveal` · `drawOn` · `emphasize{style:pulse|glow|shake|flash|tada}` · `exit{to:"fade"}` · `revealNode{diagram,node}` · `connect{diagram,edge}` · **`revealAll{target}`** (hiện lần lượt từng dòng của list/table/chart — dùng cho slide `bullets`) · `revealItem{target,index}` · `sfx{sound}`.

**`sfx.sound` PHẢI là một tên trong kho dưới đây** (tên lạ = bài bị từ chối). 162 âm thanh:

```
abacus · achievement · activate · activity_complete · ai_end · ai_feedback · ai_processing · ai_start · airplane · alarm_clock · animal_bear · animal_bee · animal_cat · animal_chicken · animal_cow · animal_cricket · animal_dog · animal_dolphin · animal_duck · animal_eagle · animal_elephant · animal_frog · animal_goat · animal_hamster · animal_horse · animal_lion · animal_monkey · animal_owl · animal_parrot · animal_pig · animal_seal · animal_sheep · animal_snake · animal_tiger · animal_whale · assignment_return · badge_unlock · bead · bicycle_bell · block_snap · book_open · bounce · bus_stop · cancel · car_drive · car_horn · car_start · card_flip · cave_drop · celebrate · chalk_write · character_enter · character_exit · chat_message · classroom_ambience · click_soft · clock_tick · close · code_block_snap · coin · collision_hard · collision_soft · confirm · correct · countdown_alert · course_complete · cup_clink · daily_reward · deactivate · ding · door_close · door_knock · door_open · drag_start · drop_fail · drop_success · encouragement · energy_charge · eraser · error_soft · fire · forest · fraction_snap · graduation · helicopter · hint · hover_invalid · hover_valid · incorrect · jump · kettle · lab_bubble · lab_click · land · lesson_complete · lesson_start · level_up · lock · magnet_attach · magnet_detach · microscope_focus · microwave · motorbike · next_question · ocean_wave · open · page_flip · participant_join · participant_leave · pass · pencil_write · phone_ring · pickup · pop_in · pop_out · puzzle_fit · quiz_end · quiz_start · rain_heavy · rain_light · retry · river · robot_beep · robot_move · rocket_launch · rotate_tick · save_success · school_bell · scissors · score_reveal · shape_place · ship_horn · shower · slide · snap · spark · splash · star · streak · submit · surprise · success · teacher_feedback · think · thunder · tile_click · timer_tick · train · treasure · unit_complete · unlock · volcano · warning_soft · water_tap · whoosh_close · whoosh_move · whoosh_open · wind · wire_connect · xp_gain · zoom_in · zoom_out
```

Phần tử **không** được beat nào chạm tới thì phải đặt `"startVisible": true`, nếu không nó sẽ không bao giờ hiện.

---

## 6. Gate — 4 KIỂU ĐÁNH GIÁ TƯƠNG TÁC

Học sinh **làm** ở đây. Có **4 kiểu**, và **cả 4 đều được CHẤM BẰNG CODE**, không phải bằng cảm tính:

| `activity.*` | Học sinh làm gì                                               | Chấm bằng                              |
| ------------ | ------------------------------------------------------------- | -------------------------------------- |
| `quiz`       | Trả lời câu hỏi (55 loại)                                     | `gradeQuestion`                        |
| `manip`      | **Thao tác trên chính vật vừa học** (kéo, đếm, ghép) — 67 kit | `checkAnswer`                          |
| `tracing`    | **Viết** chữ / hình theo nét mẫu                              | `scoreTracedStroke` (chấm từng nét)    |
| `coloring`   | **Tô màu** theo yêu cầu                                       | `coloringScore` (so với `targetColor`) |

**Chọn kiểu theo NGƯỜI HỌC, không theo cái nào dễ viết.** Trẻ mầm non **chưa đọc được** — với chúng, `tracing` và `coloring` và `manip` là đánh giá thật; một dãy nút bấm chữ thì không.

```json
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
```

`activity.quiz` là **một câu hỏi @bingoo/core**. Sai shape thì QuizShell vẽ **thẻ rỗng** — và cổng kiểm tra sẽ từ chối bài.

```json
{
  "id": "g1",
  "kind": "gate",
  "layout": { "template": "practice", "regions": {} },
  "elements": [
    {
      "id": "g1_pr",
      "type": "text",
      "region": "prompt",
      "style": { "fontSize": "title" },
      "startVisible": true
    }
  ],
  "gate": {
    "kind": "activity",
    "prompt": "Số 5 là chẵn hay lẻ?",
    "answer": "",
    "onPass": "resume",
    "activity": {
      "quiz": {
        "id": "q1",
        "type": "single",
        "prompt": "Số 5 là chẵn hay lẻ?",
        "choices": [
          { "id": "even", "label": "Chẵn" },
          { "id": "odd", "label": "Lẻ" }
        ],
        "answerId": "odd"
      }
    }
  }
}
```

**Bẫy hay mắc:**

- type là `single` (KHÔNG phải `single-choice`); mảng là `choices` (KHÔNG phải `options`).
- Câu hỏi **phải có `id`**, và **đáp án nằm TRONG câu hỏi** (`answerId`), không phải ở `gate.answer`.
- `activity` **không có** key `kind` — chỉ `quiz` hoặc `manip`.

### 55 loại câu hỏi — SHAPE ĐẦY ĐỦ

Player vẽ được **cả 55/55** và `gradeQuestion` chấm hết. **Đừng chỉ dùng `single`.**
Chọn loại theo **thứ cần đo**: đo học sinh có PHÂN LOẠI được không thì dùng `categorize`, có ĐẶT ĐÚNG VỊ TRÍ trên trục số không thì `numberline`, có XẾP ĐÚNG THỨ TỰ không thì `order`. Hỏi cùng một dạng nhiều lần chỉ đo được trí nhớ về DẠNG BÀI.

55 loại câu hỏi, tất cả chấm được bằng code (`gradeQuestion`). Mỗi câu cần `id` và nên có `prompt`; các trường riêng của từng loại ở dưới (dấu `?` = không bắt buộc).

- **`single`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `choices`: {id,label,emoji,image,imageAssetId,audio}[] — The answer choices (2 or more).
  - `answerId`: string — id of the one correct choice — must be one of choices[].id.
- **`multiple`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `choices`: {id,label,emoji,image,imageAssetId,audio}[] — The answer choices (2 or more). The correct ones are named in answerIds.
  - `answerIds`: string[] — ids of ALL correct choices — each must exist in choices[].id.
- **`boolean`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `answer`: boolean — Whether the statement is true.
  - `trueLabel`: string — Localized label for the "true" option.
  - `falseLabel`: string — Localized label for the "false" option.
- **`fill`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `segments`: union[] — Prompt as interleaved text + blanks.
  - `answers`: string[][] — Accepted answers per blank; answers[i] = variants for blank i (case-insensitive). Must have EXACTLY one entry per blank segment, in order.
- **`order`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `items`: {id,label,emoji,image,imageAssetId,audio}[] — Items in a stable presentation order.
  - `correctOrder`: string[] — The correct sequence — a permutation of items[].id (same ids, each exactly once).
- **`match`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `left`: {id,label,emoji,image,imageAssetId,audio}[] — Left-column items to match from.
  - `right`: {id,label,emoji,image,imageAssetId,audio}[] — Right-column items — the partners for the left column.
  - `pairs`: { [id]: value } — Correct pairing: leftId → rightId. Every left id appears exactly once as a key; every value must be a right id.
- **`numeric`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `answer`: number — The correct numeric value.
  - `tolerance?`: number — Accepted absolute deviation from answer (default 0 = exact).
  - `unitLabel?`: string — Unit shown next to the input, e.g. "cm".
  - `placeholder?`: string — Input placeholder.
- **`wordbank`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `bank`: string[] — The tappable word/token bank, INCLUDING distractors, in display order.
  - `answer`: string[] — The correct token sequence. Every token must be available in bank (respecting duplicates).
- **`categorize`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `categories`: {id,label,emoji,image,imageAssetId,audio}[] — The buckets (2 or more).
  - `items`: {id,label,emoji,image,imageAssetId,audio}[] — The items to sort.
  - `assignment`: { [id]: value } — Correct mapping: itemId → categoryId. Every item id appears exactly once as a key; values must be category ids.
- **`highlight`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `tokens`: string[] — The passage split into tappable tokens (words or short phrases), in reading order.
  - `correctIndexes`: number[] — 0-based indexes of the tokens that must be selected. Unique, each < tokens.length.
- **`numberline`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `min`: number — Left end of the line.
  - `max`: number — Right end of the line (must be > min).
  - `step?`: number — Tick interval; the marker snaps to it.
  - `answer`: number — The value to mark (must be between min and max, on a step).
- **`clock`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `answerHour`: number — Correct hour, 1–12.
  - `answerMinute`: number — Correct minute (Stage 1: 0 or 30).
  - `minuteOptions?`: number[] — Minute choices to offer the learner (default [0, 15, 30, 45]).
- **`venn`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `labelA`: string — Label of circle A.
  - `labelB`: string — Label of circle B.
  - `items`: {id,label,emoji,image,imageAssetId,audio}[] — The items to place.
  - `assignment`: { [id]: value } — Correct region per item id: "a" (A only), "b" (B only), "both" (overlap), "neither" (outside). Every item id appears exactly once.
- **`tablefill`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `columns`: string[] — Column header labels.
  - `rows`: {header,cells}[] — Table rows; a cell left as an empty string is a blank to fill in.
- **`tenframe`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `frames?`: union — Number of ten-frames (1 → 0–10, 2 → 0–20).
  - `answer`: number — The count to represent (0 … 10·frames).
- **`partwhole`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `whole?`: number — The whole, or null if it is the blank.
  - `parts`: number[] — The parts; exactly one value across whole+parts is null (the blank).
  - `answer`: number — The value of the blank.
- **`placevalue`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `answer`: number — The two-digit number to build (0–99).
- **`pattern`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `sequence`: {id,label,emoji,image,imageAssetId,audio}[] — The shown lead-in of the pattern (left → right).
  - `blanks`: number — How many trailing slots the learner fills.
  - `palette`: {id,label,emoji,image,imageAssetId,audio}[] — The tappable choices to fill blanks with.
  - `answer`: string[] — Correct palette item id per blank, in order.
- **`label`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `imageAssetId?`: string — Media-library image asset id for the figure (preferred).
  - `imageSrc?`: string — Resolved/external figure image URL.
  - `hotspots`: {id,x,y,emoji,label}[] — The points on the figure to label.
  - `labels`: {id,label,emoji,image,imageAssetId,audio}[] — The labels to place onto hotspots.
  - `answer`: { [id]: value } — Correct labelId → hotspotId. Every label appears exactly once; each value is a hotspot id.
- **`hotspot`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `imageAssetId?`: string — Media-library image asset id for the scene.
  - `imageSrc?`: string — Resolved/external scene image URL.
  - `hotspots`: {id,x,y,emoji,label}[] — The tappable spots in the scene.
  - `correctIds`: string[] — Hotspot ids that should be selected.
- **`arrow`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `imageAssetId?`: string — Media-library image asset id for the figure.
  - `imageSrc?`: string — Resolved/external figure image URL.
  - `nodes`: {id,x,y,emoji,label}[] — The points arrows connect (id + x/y as 0–100 %).
  - `directed?`: boolean — Arrows have a direction (from→to). false = plain undirected connectors.
  - `answer`: {from,to}[] — Correct arrows; each { from, to } is a pair of node ids.
- **`wordsearch`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `rows`: string[] — Grid rows; each row is a string of letters, all the same length.
  - `words`: string[] — Words hidden in the grid (any straight line, forward or backward).
- **`fraction`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `parts`: number — Number of equal parts the whole is divided into (the denominator).
  - `answer`: number — How many parts should be shaded (the numerator).
  - `shape?`: bar|circle — Render as a divided bar or a pie.
- **`carroll`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `rows`: string[] — Row headers (criterion 1, e.g. "Has 4 legs" / "No 4 legs").
  - `cols`: string[] — Column headers (criterion 2).
  - `items`: {id,label,emoji,image,imageAssetId,audio}[] — The items to classify.
  - `answer`: { [id]: value } — Correct itemId → cell "row-col" (0-indexed, e.g. "0-1").
- **`money`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `denominations`: {id,value,label,emoji}[] — Coins/notes the learner can add (repeats allowed).
  - `target`: number — The total amount to make (same unit as values).
  - `currency?`: VND|USD|GBP — Currency: VND (đồng), USD (cents), or GBP (pence).
- **`balance`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `left`: number — Quantity/weight on the left pan.
  - `right`: number — Quantity/weight on the right pan.
  - `leftLabel?`: string — Label under the left pan.
  - `rightLabel?`: string — Label under the right pan.
  - `leftEmoji?`: string — Emoji repeated `left` times to picture the left pan.
  - `rightEmoji?`: string — Emoji shown on the right pan.
  - `answer`: lt|eq|gt — left vs right: lt (<), eq (=), gt (>).
- **`barchart`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `categories`: {id,label,emoji,image,imageAssetId,audio}[] — The bars (id + label + optional emoji).
  - `maxValue`: number — Tallest value the axis allows.
  - `unitLabel?`: string — Axis unit, e.g. "students".
  - `answer`: { [id]: value } — Correct catId → bar height.
- **`ruler`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `max`: number — Ruler length (number of units).
  - `start?`: number — Where the object starts on the ruler.
  - `length`: number — The object length (units); the end tick is start + length.
  - `unitLabel?`: string — Unit, e.g. "cm".
- **`symmetry`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `rows`: number — Grid rows.
  - `cols`: number — Grid columns.
  - `axis?`: vertical|horizontal|diagonal — Mirror line. "diagonal" needs a square grid.
  - `mode?`: mirror|design — mirror = complete the given half. design = shade cellCount cells to make ANY symmetric pattern.
  - `cellCount?`: number — design mode: exactly how many cells the finished pattern must have.
  - `filled?`: string[] — Pre-filled cells "row-col" (the given half; may be empty in design mode).
- **`annotate`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `imageAssetId?`: string — Media-library image asset id (preferred).
  - `imageSrc?`: string — Resolved/external image URL.
  - `brushColor?`: string — Default stroke colour (hex).
- **`tally`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `categories`: {id,label,emoji,image,imageAssetId,audio}[] — Rows to tally (id + label + optional emoji).
  - `answer`: { [id]: value } — Correct catId → count.
- **`pictogram`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `categories`: {id,label,emoji,image,imageAssetId,audio}[] — Rows (id + label + emoji icon).
  - `maxIcons`: number — How many icons a row can hold.
  - `iconValue?`: number — Units each icon represents (key).
  - `answer`: { [id]: value } — Correct catId → number of icons.
- **`array`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `maxRows`: number — Grid height the learner can choose within.
  - `maxCols`: number — Grid width the learner can choose within.
  - `emoji?`: string — Optional dot emoji (defaults to a filled dot).
  - `allowTranspose?`: boolean — Accept the rotated array too (r×c or c×r).
  - `answer`: {rows,cols} — Correct array dimensions.
- **`rotation`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `steps?`: union — Positions around the dial (4 = quarter turns).
  - `start`: number — Starting position index (0 = up, clockwise).
  - `answer`: number — Final position index after the described turn.
  - `emoji?`: string — The thing that turns (defaults to an arrow).
- **`scale`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `shape?`: thermometer|dial — How the scale is drawn.
  - `min`: number — Smallest value on the scale.
  - `max`: number — Largest value on the scale.
  - `step?`: number — Interval between selectable ticks.
  - `answer`: number — The value the pointer/level should read.
  - `unitLabel?`: string — Unit, e.g. "grams" or "°C".
- **`digitalclock`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `mode?`: 12h|24h — Display mode.
  - `answer`: {hour,minute} — Correct time.
- **`route`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `rows`: number — Grid height in cells.
  - `cols`: number — Grid width in cells.
  - `start`: string — Start cell "row-col".
  - `target`: string — Target cell "row-col".
  - `blocked?`: string[] — Impassable cells "row-col".
  - `startEmoji?`: string — Emoji marking the start cell.
  - `targetEmoji?`: string — Emoji marking the goal cell.
- **`crossword`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `rows`: number — Grid height in cells.
  - `cols`: number — Grid width in cells.
  - `entries`: {number,row,col,dir,answer,clue}[] — The words to place, each with its number, position, direction, answer and clue.
- **`math`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `answer`: string — Correct expression as linear maths ("3/4", "x^2", "pi*r^2").
  - `gradeMode?`: numeric|exact — numeric = compare values; exact = compare normalised text (algebra).
  - `level?`: preschool|primary|secondary|advanced — Chooses the default keyboard layout for the audience.
  - `keys?`: string[] — Override the keyboard keys.
  - `tolerance?`: number — Numeric grading tolerance.
  - `placeholder?`: string — Greyed-out hint text inside the input.
- **`speech`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `text?`: string — The passage/word to read aloud.
  - `maxSeconds?`: number — Recording time limit.
  - `transcriptTarget?`: string — Expected transcript (reserved for future ASR grading).
- **`gridshape`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `rows`: number — Grid height in cells.
  - `cols`: number — Grid width in cells.
  - `given?`: string[] — Cells already shaded (locked) "row-col".
  - `requireContiguous?`: boolean — The shape must be one connected piece.
  - `target`: {area,perimeter,cells} — At least one of area / perimeter / cells must be given.
  - `unitLabel?`: string — e.g. "cm".
- **`chance`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `levels`: {id,label}[] — Likelihood levels in order, least → most likely (e.g. won't / might / will).
  - `items`: {id,label,emoji,image,imageAssetId,audio}[] — The events to place on the scale.
  - `answer`: { [id]: value } — Correct itemId → levelId.
- **`solid`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `shape`: cube|cuboid|cylinder|sphere|cone|pyramid — Which solid to inspect.
  - `task`: face|edge|vertex|curved — Which part kind to tap. "curved" = the curved surface (not a face).
- **`branchkey`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `subject`: string — What is being identified, e.g. "this animal".
  - `subjectEmoji?`: string — Emoji for the thing being identified.
  - `subjectImage?`: string — Image URL for the thing being identified.
  - `nodes`: {id,question,yes,no,result}[] — The key: question nodes + result (leaf) nodes.
  - `root`: string — Id of the first question.
  - `answer`: string — Id of the RESULT node the learner should reach.
- **`proofread`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `tokens`: string[] — The text, split into tokens (words/punctuation).
  - `errors`: { [id]: value } — Correct fixes: token INDEX (as a string) → the corrected text.
- **`coordinates`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `maxX`: number — The x-axis runs 0…maxX.
  - `maxY`: number — The y-axis runs 0…maxY.
  - `task?`: plot|read — plot = tap the grid to mark the given coordinates. read = write the coordinates of the marked points.
  - `coords`: {x,y,label}[] — The points: to plot (task=plot) or already marked (task=read).
- **`angle`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `task`: set|estimate|classify — set = drag the arm to MAKE the angle. estimate = guess the size of the shown angle. classify = name it.
  - `angle`: number — The angle in degrees: the one to make (set) or the one shown (estimate/classify).
  - `tolerance?`: number — Degrees of slack when grading set/estimate (estimate usually wants more).
  - `showProtractor?`: boolean — Draw the degree scale behind the angle.
- **`linegraph`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `style?`: line|dot — line = join the points. dot = a dot plot.
  - `xLabels`: string[] — Category/time labels along the x-axis.
  - `maxY`: number — The y-axis runs 0…maxY.
  - `stepY?`: number — Gridline interval on the y-axis (display only — any whole value can be plotted, as in the books).
  - `answer`: number[] — Correct y value for each x (same length as xLabels).
  - `xTitle?`: string — Title shown under the x-axis.
  - `yTitle?`: string — Title shown beside the y-axis.
- **`waffle`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `size?`: number — Grid is size×size (10 → 100 squares = %).
  - `categories`: {id,label,color}[] — The categories to shade, each with an id, label and optional colour.
  - `answer`: { [id]: value } — Correct catId → number of squares.
- **`translation`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `rows`: number — Grid height in cells.
  - `cols`: number — Grid width in cells.
  - `cells`: string[] — The original shape, as "row-col" cells.
  - `dx`: number — Squares right (negative = left).
  - `dy`: number — Squares UP (negative = down) — as the books say it.
  - `task?`: move|describe — move = shift the shape yourself. describe = both shapes are shown; say how far it moved.
- **`compass`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `maxX`: number — Map width in cells.
  - `maxY`: number — Map height in cells.
  - `places`: {id,label,x,y,emoji}[] — Places on the map, each with an id, label and x/y position.
  - `from`: string — Place id you start from.
  - `to`: string — Place id you travel to. The ANSWER is derived from the geometry.
- **`net`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `task?`: pick|name — pick = which net folds into this solid? name = which solid does this net make?
  - `solid?`: cube|cuboid|cylinder|sphere|cone|pyramid|triprism|hexprism|tetrahedron — pick: the target solid, shown in 3D.
  - `options?`: string[] — pick: net ids from NET_LIBRARY.
  - `net?`: string — name: the net id shown.
  - `solidOptions?`: cube|cuboid|cylinder|sphere|cone|pyramid|triprism|hexprism|tetrahedron[] — name: the solids to choose from.
- **`drawing`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `criteria`: {id,text}[] — Success criteria — shown BEFORE the learner starts.
  - `pass?`: number — How many criteria must be met to count as correct. Defaults to all of them.
  - `referenceImage?`: string — Optional picture to draw from / draw onto.
  - `exemplarImage?`: string — A model answer, revealed after the learner checks.
- **`writing`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `criteria`: {id,text}[] — Success criteria — shown BEFORE the learner starts.
  - `pass?`: number — How many criteria must be met to count as correct. Defaults to all of them.
  - `minWords?`: number — Fewest words the answer should have.
  - `maxWords?`: number — Most words the answer may have.
  - `starters?`: string[] — A writing frame — sentence openers the learner can tap to insert.
  - `exemplar?`: string — A model answer, revealed after the learner checks.
- **`estimate`**
  - `body?`: union[] — Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.
  - `actual`: number — The true value. The ESTIMATE is never marked — only this is.
  - `unit?`: string — cm, kg, minutes…
  - `tolerance?`: number — How far off an estimate may be and still count as a CLOSE estimate (praise, not marks).
  - `step?`: number — Increment of the +/- steppers.

---

Ít nhất **1 gate**, đặt **ngay sau** phần nó kiểm tra.

---

## 7. VÍ DỤ MẪU

Mỗi ví dụ dưới đây **đã chạy qua bộ kiểm tra thật và đạt 0 lỗi**. Hãy bắt chước _hình dạng_ của chúng.

### `title-card`

> Mở bài: một tên bài, một hình. Không nhồi thêm gì.

```json
{
  "scene": {
    "id": "ex",
    "kind": "exposition",
    "layout": {
      "template": "title-card",
      "regions": {}
    },
    "elements": [
      {
        "id": "ti",
        "type": "text",
        "region": "title",
        "style": {
          "fontSize": "title",
          "align": "center"
        },
        "startVisible": true
      },
      {
        "id": "fo",
        "type": "image",
        "region": "focal",
        "content": {
          "kind": "image",
          "query": "ngôi sao vàng vẽ hoạt hình",
          "prompt": "ngôi sao vàng vẽ hoạt hình, flat vector illustration, white background",
          "tags": ["sao"],
          "alt": "Ngôi sao",
          "w": 1024,
          "h": 1024
        },
        "startVisible": true
      }
    ]
  },
  "strings": {
    "ti": "Số chẵn & số lẻ"
  }
}
```

### `teach`

> Giảng MỘT ý bằng một vật thao tác. Callout chỉ chốt kết luận, không giảng lại.

```json
{
  "scene": {
    "id": "ex",
    "kind": "exposition",
    "layout": {
      "template": "teach",
      "regions": {}
    },
    "elements": [
      {
        "id": "ti",
        "type": "text",
        "region": "title",
        "style": {
          "fontSize": "title",
          "align": "center"
        },
        "startVisible": true
      },
      {
        "id": "kit",
        "type": "manipulative",
        "region": "stage",
        "content": {
          "kind": "evenodd",
          "params": {
            "number": 8,
            "showResult": true
          }
        },
        "startVisible": true
      },
      {
        "id": "co",
        "type": "text",
        "region": "callout",
        "style": {
          "fontSize": "label",
          "align": "center"
        },
        "startVisible": true
      }
    ],
    "narrationRef": "n",
    "beats": [
      {
        "id": "b1",
        "cue": "pair",
        "actions": [
          {
            "verb": "emphasize",
            "target": "kit",
            "style": "pulse"
          }
        ]
      }
    ]
  },
  "strings": {
    "ti": "Ghép đôi ngôi sao",
    "co": "CHẴN"
  }
}
```

### `compare`

> Hai thứ cạnh nhau để LỘ RA khác biệt. Hai vế phải cùng loại element.

```json
{
  "scene": {
    "id": "ex",
    "kind": "exposition",
    "layout": {
      "template": "compare",
      "regions": {}
    },
    "elements": [
      {
        "id": "ti",
        "type": "text",
        "region": "title",
        "style": {
          "fontSize": "title",
          "align": "center"
        },
        "startVisible": true
      },
      {
        "id": "L",
        "type": "image",
        "region": "left",
        "content": {
          "kind": "image",
          "query": "4 ngôi sao xếp thành 2 cặp",
          "prompt": "4 ngôi sao xếp thành 2 cặp, flat vector illustration, white background",
          "tags": ["sao"],
          "alt": "Ghép hết",
          "w": 1024,
          "h": 1024
        },
        "startVisible": true
      },
      {
        "id": "R",
        "type": "image",
        "region": "right",
        "content": {
          "kind": "image",
          "query": "5 ngôi sao, 2 cặp và 1 lẻ",
          "prompt": "5 ngôi sao, 2 cặp và 1 lẻ, flat vector illustration, white background",
          "tags": ["sao"],
          "alt": "Dư một",
          "w": 1024,
          "h": 1024
        },
        "startVisible": true
      },
      {
        "id": "ll",
        "type": "text",
        "region": "leftLabel",
        "style": {
          "fontSize": "label",
          "align": "center"
        },
        "startVisible": true
      },
      {
        "id": "rl",
        "type": "text",
        "region": "rightLabel",
        "style": {
          "fontSize": "label",
          "align": "center"
        },
        "startVisible": true
      }
    ]
  },
  "strings": {
    "ti": "Chẵn khác lẻ ở đâu?",
    "ll": "Ghép hết",
    "rl": "Dư một"
  }
}
```

### `sequence`

> Các bước. MỌI phần tử phải có flow.order — thiếu là các bước xếp sai.

```json
{
  "scene": {
    "id": "ex",
    "kind": "exposition",
    "layout": {
      "template": "sequence",
      "regions": {}
    },
    "elements": [
      {
        "id": "ti",
        "type": "text",
        "region": "title",
        "style": {
          "fontSize": "title",
          "align": "center"
        },
        "startVisible": true
      },
      {
        "id": "s1",
        "type": "manipulative",
        "region": "steps",
        "flow": {
          "order": 1
        },
        "content": {
          "kind": "count",
          "params": {
            "count": 4
          }
        },
        "startVisible": true
      },
      {
        "id": "s2",
        "type": "manipulative",
        "region": "steps",
        "flow": {
          "order": 2
        },
        "content": {
          "kind": "evenodd",
          "params": {
            "number": 4
          }
        },
        "startVisible": true
      },
      {
        "id": "s3",
        "type": "image",
        "region": "steps",
        "flow": {
          "order": 3
        },
        "content": {
          "kind": "image",
          "query": "pháo giấy ăn mừng",
          "prompt": "pháo giấy ăn mừng, flat vector illustration, white background",
          "tags": ["illustration"],
          "alt": "Xong!",
          "w": 1024,
          "h": 1024
        },
        "startVisible": true
      }
    ]
  },
  "strings": {
    "ti": "Ba bước"
  }
}
```

### `rule`

> Chốt quy tắc. `card` phải NGẮN — học sinh sẽ phải nhớ nguyên câu này.

```json
{
  "scene": {
    "id": "ex",
    "kind": "exposition",
    "layout": {
      "template": "rule",
      "regions": {}
    },
    "elements": [
      {
        "id": "ti",
        "type": "text",
        "region": "title",
        "style": {
          "fontSize": "title",
          "align": "center"
        },
        "startVisible": true
      },
      {
        "id": "ru",
        "type": "text",
        "region": "card",
        "style": {
          "fontSize": "body",
          "align": "center"
        },
        "startVisible": true
      },
      {
        "id": "su",
        "type": "image",
        "region": "support",
        "content": {
          "kind": "image",
          "query": "ngôi sao vàng",
          "prompt": "ngôi sao vàng, flat vector illustration, white background",
          "tags": ["sao"],
          "alt": "Sao",
          "w": 1024,
          "h": 1024
        },
        "startVisible": true
      }
    ]
  },
  "strings": {
    "ti": "Quy tắc",
    "ru": "Ghép hết → CHẴN. Dư 1 → LẺ."
  }
}
```

### `flow`

> Quy trình có rẽ nhánh → diagram. Engine tự xếp rank, tự vẽ cạnh — đừng tự đặt node.

```json
{
  "scene": {
    "id": "ex",
    "kind": "exposition",
    "layout": {
      "template": "flow",
      "regions": {}
    },
    "elements": [
      {
        "id": "ti",
        "type": "text",
        "region": "title",
        "style": {
          "fontSize": "title",
          "align": "center"
        },
        "startVisible": true
      },
      {
        "id": "dg",
        "type": "diagram",
        "region": "diagram",
        "startVisible": true,
        "content": {
          "layoutKind": "flow",
          "direction": "auto",
          "nodes": [
            {
              "id": "n1",
              "label": "Đếm",
              "shape": "pill"
            },
            {
              "id": "n2",
              "label": "Ghép đôi",
              "shape": "box"
            },
            {
              "id": "n3",
              "label": "Còn dư?",
              "shape": "diamond"
            },
            {
              "id": "n4",
              "label": "CHẴN",
              "shape": "circle"
            },
            {
              "id": "n5",
              "label": "LẺ",
              "shape": "circle"
            }
          ],
          "edges": [
            {
              "id": "e1",
              "from": "n1",
              "to": "n2",
              "kind": "arrow"
            },
            {
              "id": "e2",
              "from": "n2",
              "to": "n3",
              "kind": "arrow"
            },
            {
              "id": "e3",
              "from": "n3",
              "to": "n4",
              "label": "hết",
              "kind": "arrow"
            },
            {
              "id": "e4",
              "from": "n3",
              "to": "n5",
              "label": "dư 1",
              "kind": "arrow"
            }
          ]
        }
      }
    ]
  },
  "strings": {
    "ti": "Quy trình kiểm tra"
  }
}
```

### `bullets`

> Ý chính. Beat `revealAll` build từng dòng theo lời giảng — đừng đổ hết ra một lúc.

```json
{
  "scene": {
    "id": "ex",
    "kind": "exposition",
    "layout": {
      "template": "bullets",
      "regions": {}
    },
    "elements": [
      {
        "id": "ti",
        "type": "text",
        "region": "title",
        "style": {
          "fontSize": "title",
          "align": "center"
        },
        "startVisible": true
      },
      {
        "id": "ls",
        "type": "list",
        "region": "list",
        "content": {
          "style": "number",
          "items": [
            "Đếm xem có bao nhiêu vật.",
            "Ghép chúng thành từng cặp.",
            "Không dư ai → số CHẴN.",
            "Dư đúng một → số LẺ."
          ]
        }
      }
    ],
    "narrationRef": "n",
    "beats": [
      {
        "id": "b1",
        "cue": "build",
        "actions": [
          {
            "verb": "revealAll",
            "target": "ls"
          }
        ]
      }
    ]
  },
  "strings": {
    "ti": "Bốn bước nhận biết"
  }
}
```

### `bullets-media`

> Gạch đầu dòng + MỘT hình. Hình minh hoạ cho ý, không phải trang trí.

```json
{
  "scene": {
    "id": "ex",
    "kind": "exposition",
    "layout": {
      "template": "bullets-media",
      "regions": {}
    },
    "elements": [
      {
        "id": "ti",
        "type": "text",
        "region": "title",
        "style": {
          "fontSize": "title",
          "align": "center"
        },
        "startVisible": true
      },
      {
        "id": "ls",
        "type": "list",
        "region": "list",
        "startVisible": true,
        "content": {
          "style": "check",
          "items": ["0, 2, 4, 6, 8 là chẵn", "1, 3, 5, 7, 9 là lẻ", "Nhìn chữ số cuối là biết"]
        }
      },
      {
        "id": "im",
        "type": "image",
        "region": "media",
        "content": {
          "kind": "image",
          "query": "ngôi sao vàng",
          "prompt": "ngôi sao vàng, flat vector illustration, white background",
          "tags": ["sao"],
          "alt": "Sao",
          "w": 1024,
          "h": 1024
        },
        "startVisible": true
      }
    ]
  },
  "strings": {
    "ti": "Mẹo nhanh"
  }
}
```

### `data`

> Số liệu. CHỈ đưa series — engine tính cao cột, mốc trục, phần trăm. `insight` nói Ý NGHĨA, không đọc lại số.

```json
{
  "scene": {
    "id": "ex",
    "kind": "exposition",
    "layout": {
      "template": "data",
      "regions": {}
    },
    "elements": [
      {
        "id": "ti",
        "type": "text",
        "region": "title",
        "style": {
          "fontSize": "title",
          "align": "center"
        },
        "startVisible": true
      },
      {
        "id": "ch",
        "type": "chart",
        "region": "chart",
        "startVisible": true,
        "content": {
          "chart": "column",
          "unit": " bạn",
          "series": [
            {
              "label": "Chẵn",
              "value": 18,
              "color": "good"
            },
            {
              "label": "Lẻ",
              "value": 12,
              "color": "accent"
            },
            {
              "label": "Chưa rõ",
              "value": 4,
              "color": "faint"
            }
          ]
        }
      },
      {
        "id": "in",
        "type": "text",
        "region": "insight",
        "style": {
          "fontSize": "body",
          "align": "center"
        },
        "startVisible": true
      }
    ]
  },
  "strings": {
    "ti": "Lớp mình trả lời thế nào?",
    "in": "Hơn một nửa lớp đã nhận ra quy luật."
  }
}
```

### `stats`

> 2–4 con số đáng nhớ. Mỗi ô một stat, đặt flow.order.

```json
{
  "scene": {
    "id": "ex",
    "kind": "exposition",
    "layout": {
      "template": "stats",
      "regions": {}
    },
    "elements": [
      {
        "id": "ti",
        "type": "text",
        "region": "title",
        "style": {
          "fontSize": "title",
          "align": "center"
        },
        "startVisible": true
      },
      {
        "id": "k1",
        "type": "stat",
        "region": "stats",
        "flow": {
          "order": 1
        },
        "startVisible": true,
        "content": {
          "value": "5",
          "label": "chữ số chẵn",
          "color": "good"
        }
      },
      {
        "id": "k2",
        "type": "stat",
        "region": "stats",
        "flow": {
          "order": 2
        },
        "startVisible": true,
        "content": {
          "value": "5",
          "label": "chữ số lẻ",
          "color": "accent"
        }
      },
      {
        "id": "k3",
        "type": "stat",
        "region": "stats",
        "flow": {
          "order": 3
        },
        "startVisible": true,
        "content": {
          "value": "50",
          "unit": "%",
          "label": "chẵn trong 1–100",
          "color": "accent2"
        }
      }
    ]
  },
  "strings": {
    "ti": "Con số biết nói"
  }
}
```

### `table`

> So sánh nhiều thứ theo nhiều chiều. ≤4 cột × ≤5 hàng, nếu không thì không đọc nổi.

```json
{
  "scene": {
    "id": "ex",
    "kind": "exposition",
    "layout": {
      "template": "table",
      "regions": {}
    },
    "elements": [
      {
        "id": "ti",
        "type": "text",
        "region": "title",
        "style": {
          "fontSize": "title",
          "align": "center"
        },
        "startVisible": true
      },
      {
        "id": "tb",
        "type": "table",
        "region": "table",
        "startVisible": true,
        "content": {
          "header": ["Số", "Ghép đôi", "Dư", "Kết luận"],
          "rows": [
            ["6", "3 cặp", "0", "CHẴN"],
            ["7", "3 cặp", "1", "LẺ"],
            ["10", "5 cặp", "0", "CHẴN"]
          ]
        }
      }
    ]
  },
  "strings": {
    "ti": "Thử với vài số"
  }
}
```

### `two-col`

> Hai khối bất kỳ cạnh nhau. Dùng khi hai thứ BỔ TRỢ nhau (biểu đồ ↔ checklist).

```json
{
  "scene": {
    "id": "ex",
    "kind": "exposition",
    "layout": {
      "template": "two-col",
      "regions": {}
    },
    "elements": [
      {
        "id": "ti",
        "type": "text",
        "region": "title",
        "style": {
          "fontSize": "title",
          "align": "center"
        },
        "startVisible": true
      },
      {
        "id": "dn",
        "type": "chart",
        "region": "colA",
        "startVisible": true,
        "content": {
          "chart": "donut",
          "series": [
            {
              "label": "Chẵn",
              "value": 50,
              "color": "good"
            },
            {
              "label": "Lẻ",
              "value": 50,
              "color": "accent"
            }
          ]
        }
      },
      {
        "id": "ls",
        "type": "list",
        "region": "colB",
        "startVisible": true,
        "content": {
          "style": "dash",
          "items": ["Từ 1 đến 100", "Có 50 số chẵn", "Có 50 số lẻ"]
        }
      }
    ]
  },
  "strings": {
    "ti": "Chia đôi hoàn hảo"
  }
}
```

### `worked-example`

> Hình dạng chuẩn của một bài toán mẫu: đề → các bước → đáp án.

```json
{
  "scene": {
    "id": "ex",
    "kind": "exposition",
    "layout": {
      "template": "worked-example",
      "regions": {}
    },
    "elements": [
      {
        "id": "ti",
        "type": "text",
        "region": "title",
        "style": {
          "fontSize": "title",
          "align": "center"
        },
        "startVisible": true
      },
      {
        "id": "pr",
        "type": "text",
        "region": "problem",
        "style": {
          "fontSize": "body",
          "align": "center"
        },
        "startVisible": true
      },
      {
        "id": "st",
        "type": "list",
        "region": "steps",
        "startVisible": true,
        "content": {
          "style": "number",
          "items": ["14 có chữ số cuối là 4.", "4 nằm trong 0-2-4-6-8.", "Vậy 14 là số chẵn."]
        }
      },
      {
        "id": "an",
        "type": "stat",
        "region": "answer",
        "startVisible": true,
        "content": {
          "value": "CHẴN",
          "color": "good"
        }
      }
    ]
  },
  "strings": {
    "ti": "Ví dụ mẫu",
    "pr": "Số 14 là chẵn hay lẻ?"
  }
}
```

### `definition`

> Định nghĩa. `meaning` viết bằng LỜI CỦA HỌC SINH, không phải lời sách giáo khoa.

```json
{
  "scene": {
    "id": "ex",
    "kind": "exposition",
    "layout": {
      "template": "definition",
      "regions": {}
    },
    "elements": [
      {
        "id": "te",
        "type": "text",
        "region": "term",
        "style": {
          "fontSize": "huge",
          "align": "center"
        },
        "startVisible": true
      },
      {
        "id": "me",
        "type": "text",
        "region": "meaning",
        "style": {
          "fontSize": "body",
          "align": "center"
        },
        "startVisible": true
      },
      {
        "id": "ex2",
        "type": "text",
        "region": "example",
        "style": {
          "fontSize": "body",
          "align": "center"
        },
        "startVisible": true
      }
    ]
  },
  "strings": {
    "te": "Số chẵn",
    "me": "Là số ghép đôi được hết, không dư con nào.",
    "ex2": "Ví dụ: 2, 4, 6, 8, 10…"
  }
}
```

### `quote`

> Một câu đáng nhớ. KHÔNG có tiêu đề — câu nói LÀ tiêu đề.

```json
{
  "scene": {
    "id": "ex",
    "kind": "exposition",
    "layout": {
      "template": "quote",
      "regions": {}
    },
    "elements": [
      {
        "id": "q",
        "type": "quote",
        "region": "quote",
        "startVisible": true,
        "style": {
          "fontSize": "title"
        },
        "content": {
          "text": "",
          "by": ""
        }
      }
    ]
  },
  "strings": {
    "q": "Toán không phải nhớ công thức — mà là nhìn ra quy luật.",
    "q.by": "Lời cô giáo"
  }
}
```

### `section`

> Vách ngăn chương. Mắt chỉ có MỘT thứ để bám.

```json
{
  "scene": {
    "id": "ex",
    "kind": "exposition",
    "layout": {
      "template": "section",
      "regions": {}
    },
    "elements": [
      {
        "id": "ki",
        "type": "text",
        "region": "kicker",
        "style": {
          "fontSize": "label",
          "align": "center"
        },
        "startVisible": true
      },
      {
        "id": "ti",
        "type": "text",
        "region": "title",
        "style": {
          "fontSize": "huge",
          "align": "center"
        },
        "startVisible": true
      }
    ]
  },
  "strings": {
    "ki": "PHẦN 2",
    "ti": "Luyện tập"
  }
}
```

### `image-grid`

> Nhiều hình cùng loại để đếm/nhóm. Đặt flow.order.

```json
{
  "scene": {
    "id": "ex",
    "kind": "exposition",
    "layout": {
      "template": "image-grid",
      "regions": {}
    },
    "elements": [
      {
        "id": "ti",
        "type": "text",
        "region": "title",
        "style": {
          "fontSize": "title",
          "align": "center"
        },
        "startVisible": true
      },
      {
        "id": "g1",
        "type": "image",
        "region": "grid",
        "flow": {
          "order": 1
        },
        "content": {
          "kind": "image",
          "query": "ngôi sao vàng",
          "prompt": "ngôi sao vàng, flat vector illustration, white background",
          "tags": ["sao"],
          "alt": "Sao",
          "w": 1024,
          "h": 1024
        },
        "startVisible": true
      },
      {
        "id": "g2",
        "type": "image",
        "region": "grid",
        "flow": {
          "order": 2
        },
        "content": {
          "kind": "image",
          "query": "chiếc tất kẻ sọc",
          "prompt": "chiếc tất kẻ sọc, flat vector illustration, white background",
          "tags": ["chi"],
          "alt": "Tất",
          "w": 1024,
          "h": 1024
        },
        "startVisible": true
      },
      {
        "id": "g3",
        "type": "image",
        "region": "grid",
        "flow": {
          "order": 3
        },
        "content": {
          "kind": "image",
          "query": "cây tròn xanh",
          "prompt": "cây tròn xanh, flat vector illustration, white background",
          "tags": ["xanh"],
          "alt": "Cây",
          "w": 1024,
          "h": 1024
        },
        "startVisible": true
      },
      {
        "id": "g4",
        "type": "image",
        "region": "grid",
        "flow": {
          "order": 4
        },
        "content": {
          "kind": "image",
          "query": "mặt trời cười",
          "prompt": "mặt trời cười, flat vector illustration, white background",
          "tags": ["illustration"],
          "alt": "Mặt trời",
          "w": 1024,
          "h": 1024
        },
        "startVisible": true
      }
    ]
  },
  "strings": {
    "ti": "Đếm thử các nhóm này"
  }
}
```

### `practice`

> Học sinh LÀM. kind='gate' — activity do gate dựng, prompt là câu lệnh.

```json
{
  "scene": {
    "id": "ex",
    "kind": "gate",
    "layout": {
      "template": "practice",
      "regions": {}
    },
    "elements": [
      {
        "id": "pr",
        "type": "text",
        "region": "prompt",
        "style": {
          "fontSize": "title",
          "align": "center"
        },
        "startVisible": true
      }
    ],
    "gate": {
      "kind": "activity",
      "prompt": "Số 7 là chẵn hay lẻ?",
      "answer": "",
      "activity": {
        "quiz": {
          "id": "q1",
          "type": "single",
          "prompt": "Số 7 là chẵn hay lẻ?",
          "choices": [
            {
              "id": "even",
              "label": "Chẵn"
            },
            {
              "id": "odd",
              "label": "Lẻ"
            }
          ],
          "answerId": "odd"
        }
      },
      "onPass": "resume"
    }
  },
  "strings": {
    "pr": "Đến lượt em thử"
  }
}
```

### `swimlane`

> Quy trình có NHIỀU VAI. Chỉ dùng khi 'ai làm gì' là điều cần dạy.

```json
{
  "scene": {
    "id": "ex",
    "kind": "exposition",
    "layout": {
      "template": "swimlane",
      "regions": {}
    },
    "elements": [
      {
        "id": "ti",
        "type": "text",
        "region": "title",
        "style": {
          "fontSize": "title",
          "align": "center"
        },
        "startVisible": true
      },
      {
        "id": "l1",
        "type": "text",
        "region": "laneLabels",
        "flow": {
          "order": 1
        },
        "style": {
          "fontSize": "label"
        },
        "startVisible": true,
        "content": {}
      },
      {
        "id": "l2",
        "type": "text",
        "region": "laneLabels",
        "flow": {
          "order": 2
        },
        "style": {
          "fontSize": "label"
        },
        "startVisible": true,
        "content": {}
      },
      {
        "id": "dg",
        "type": "diagram",
        "region": "diagram",
        "startVisible": true,
        "content": {
          "layoutKind": "flow",
          "direction": "auto",
          "nodes": [
            {
              "id": "a1",
              "label": "Đọc đề",
              "group": "hs"
            },
            {
              "id": "a2",
              "label": "Chấm bài",
              "group": "gv"
            }
          ],
          "edges": [
            {
              "id": "e1",
              "from": "a1",
              "to": "a2",
              "kind": "arrow"
            }
          ]
        }
      }
    ]
  },
  "strings": {
    "ti": "Ai làm gì?",
    "l1": "Học sinh",
    "l2": "Giáo viên"
  }
}
```

### `recap`

> Tổng kết: nhắc lại từng mục tiêu như một việc học sinh GIỜ LÀM ĐƯỢC.

```json
{
  "scene": {
    "id": "ex",
    "kind": "exposition",
    "layout": {
      "template": "recap",
      "regions": {}
    },
    "elements": [
      {
        "id": "ti",
        "type": "text",
        "region": "title",
        "style": {
          "fontSize": "title",
          "align": "center"
        },
        "startVisible": true
      },
      {
        "id": "r1",
        "type": "list",
        "region": "grid",
        "flow": {
          "order": 1
        },
        "startVisible": true,
        "content": {
          "style": "check",
          "items": ["Em đếm được", "Em ghép đôi được"]
        }
      },
      {
        "id": "r2",
        "type": "list",
        "region": "grid",
        "flow": {
          "order": 2
        },
        "startVisible": true,
        "content": {
          "style": "check",
          "items": ["Em nói được chẵn hay lẻ"]
        }
      }
    ]
  },
  "strings": {
    "ti": "Em đã làm được gì?"
  }
}
```

---

## 8. Bố cục sư phạm của bài học

Đây là phần bị làm ẩu nhiều nhất. Một bài 10 scene, mỗi scene một ý, xem xong là hết — đó là **trailer**, không phải bài học.

Bài dài **8 phút** → cần **~15 scene**, trung bình **~32s mỗi scene**. Số scene suy ra từ thời lượng, không phải con số tuỳ ý.
Lời giảng tiếng Việt nói ~14 ký tự/giây; mỗi gate chiếm ~35s.
Cổng sẽ ƯỚC LƯỢNG thời lượng từ chính lời giảng bạn viết — viết đủ dài, đừng chỉ đủ số scene.

Bài phải có ĐỦ 8 giai đoạn, ĐÚNG thứ tự.
Mỗi scene khai `phase`. Bài không nên đi lùi (chốt quy tắc trước khi dạy).

**explore** — Khám phá (≥1 scene) · template: title-card / section / compare
Đặt câu hỏi, khơi tò mò. CHƯA dạy gì cả — học sinh phải muốn biết trước đã.
**orient** — Làm quen (≥1 scene) · template: teach / image-grid
Cho học sinh NHÌN và ĐẾM vật thật (manipulative) trước khi nghe bất kỳ quy tắc nào. Đây là bước 'concrete' — bỏ nó là quy tắc trở thành thứ phải học thuộc.
**teach** — Dạy (≥4 scene) · template: teach / compare / sequence / flow / bullets-media
Mỗi scene MỘT ý. Đi từ vật thật → hình vẽ. Ít nhất 3 scene: một ý mà chỉ nói một lần thì chưa ai học được.
**formalize** — Chốt quy tắc (≥1 scene) · template: rule / definition / bullets
Giờ mới trừu tượng hoá: gọi tên, viết quy tắc. Đến sau phần 'dạy', không bao giờ đến trước.
**guided** — Luyện có hướng dẫn (≥1 scene) · template: worked-example / sequence
'Cô làm cùng em': một bài mẫu giải từng bước. Đây là bước hay bị BỎ QUA nhất — nhảy thẳng từ xem sang tự làm là chỗ học sinh rơi.
**practice** — Thực hành (≥3 scene, PHẢI là gate) · template: practice
'Em tự làm.' Ít nhất 2 gate, khó dần. Đặt NGAY SAU phần chúng kiểm tra.
**recap** — Ôn tập (≥1 scene) · template: recap / bullets / stats
Nhắc lại từng thứ học sinh GIỜ LÀM ĐƯỢC — không phải liệt kê nội dung đã trình bày.
**checkout** — Kiểm tra cuối (≥1 scene, PHẢI là gate) · template: practice
Một câu hỏi cuối, kiểu khác với lúc luyện, để biết học sinh THẬT SỰ hiểu chứ không phải nhớ dạng bài.

Mỗi scene exposition PHẢI có lời giảng ≥60 ký tự. Không có lời giảng thì scene vụt qua trước khi học sinh kịp nhìn — đó là lý do bài "nhanh quá".

## Khai thác đúng sức mạnh của engine

**Manipulative KHÔNG được đứng im.** Đây là lỗi nặng nhất. Một kit không có `actions` chỉ là một tấm ảnh — và bài học mất đúng thứ khiến explainer khác PowerPoint. Kit có verb để CHẠY THEO LỜI GIẢNG: học sinh nhìn 8 ngôi sao ghép đôi _trong lúc_ cô đang đếm "hai, bốn, sáu, tám".

```json
{
  "id": "kit",
  "type": "manipulative",
  "region": "stage",
  "content": {
    "kind": "evenodd",
    "params": { "number": 8, "labels": { "even": "{n} là số CHẴN", "odd": "{n} là số LẺ" } },
    "actions": [
      { "verb": "setNumber", "at": "@c1", "args": { "n": 8 } },
      { "verb": "showResult", "at": "@c3" }
    ]
  }
}
```

- ≥6 template khác nhau (mỗi ý cần một CÁCH NHÌN khác).
- ≥3 loại manipulative khác nhau (cùng một kit lặp lại = một cách nhìn duy nhất).
- ≥2 loại câu hỏi (hỏi cùng một dạng = học sinh học thuộc DẠNG BÀI).
- ≥2 beat mỗi scene exposition — mỗi câu lời giảng một cue, mỗi cue một hiệu ứng.
- Ít nhất một `diagram`/`chart`/`table` — engine tự vẽ, và đó là cách duy nhất thấy QUAN HỆ.
- Ít nhất một gate dùng `activity.manip` — để học sinh THAO TÁC, không chỉ chọn đáp án.

---

## 9. Bài mẫu hoàn chỉnh

Một bài học thật, đủ 14 scene, đã qua toàn bộ cổng kiểm tra (0 lỗi, 0 cảnh báo): đủ 8 giai đoạn, kit chạy verb theo cue, ba cách biểu diễn (ghép đôi · khung mười · trục số), sơ đồ quyết định, một gate cho học sinh thao tác tay, một câu kiểm tra cuối khác dạng với lúc luyện.

```json
{
  "doc": {
    "version": "explainer/v2",
    "meta": {
      "id": "chan-le-lop-1",
      "title": "Số chẵn & số lẻ",
      "defaultLocale": "vi",
      "targetMinutes": 6
    },
    "locales": ["vi"],
    "theme": {
      "colors": {
        "ink": "#2b2724",
        "inkSoft": "#7d736a",
        "paper": "#f7f2e9",
        "accent": "#e07a42",
        "accent2": "#3f83bf",
        "good": "#3f9d5a",
        "warn": "#d98b2b",
        "faint": "#d8cfc2",
        "cloudFill": "#fbf8f2",
        "sunCore": "#f7d488",
        "leaf": "#bcd9a6",
        "leafDeep": "#6fae5a",
        "ground": "#cbb99c"
      },
      "fontSizes": {
        "label": 24,
        "caption": 28,
        "body": 32,
        "title": 64,
        "huge": 96
      },
      "weights": {
        "sm": 4,
        "md": 7,
        "lg": 11
      },
      "fonts": {
        "hand": "var(--font-baloo), ui-rounded, system-ui, sans-serif",
        "sans": "var(--font-bvp), system-ui, sans-serif"
      },
      "register": "warm"
    },
    "background": {
      "kind": "meadow",
      "panel": true
    },
    "scenes": [
      {
        "id": "s1",
        "kind": "exposition",
        "phase": "explore",
        "narrationRef": "n1",
        "layout": {
          "template": "title-card",
          "regions": {}
        },
        "elements": [
          {
            "id": "s1_ti",
            "type": "text",
            "region": "title",
            "style": {
              "fontSize": "title",
              "align": "center"
            },
            "startVisible": true,
            "content": {}
          },
          {
            "id": "s1_im",
            "type": "image",
            "region": "focal",
            "startVisible": true,
            "content": {
              "kind": "image",
              "query": "nhiều ngôi sao vàng vui vẻ, vẽ hoạt hình cho trẻ em",
              "prompt": "nhiều ngôi sao vàng vui vẻ, vẽ hoạt hình cho trẻ em, flat vector illustration, white background",
              "tags": ["nhi", "sao", "vui", "cho"],
              "alt": "Ngôi sao",
              "w": 1024,
              "h": 1024
            }
          }
        ],
        "beats": [
          {
            "id": "s1_b1",
            "cue": "c1",
            "actions": [
              {
                "verb": "reveal",
                "target": "s1_ti",
                "from": "up"
              }
            ]
          },
          {
            "id": "s1_b2",
            "cue": "c2",
            "actions": [
              {
                "verb": "emphasize",
                "target": "s1_im",
                "style": "bounce"
              }
            ]
          }
        ]
      },
      {
        "id": "s2",
        "kind": "exposition",
        "phase": "explore",
        "narrationRef": "n2",
        "layout": {
          "template": "compare",
          "regions": {}
        },
        "elements": [
          {
            "id": "s2_ti",
            "type": "text",
            "region": "title",
            "style": {
              "fontSize": "title",
              "align": "center"
            },
            "startVisible": true,
            "content": {}
          },
          {
            "id": "s2_L",
            "type": "manipulative",
            "region": "left",
            "content": {
              "kind": "count",
              "params": {
                "count": 0,
                "shape": "star"
              },
              "actions": [
                {
                  "verb": "setCount",
                  "at": "@c2",
                  "args": {
                    "n": 6
                  }
                }
              ]
            }
          },
          {
            "id": "s2_R",
            "type": "manipulative",
            "region": "right",
            "content": {
              "kind": "count",
              "params": {
                "count": 0,
                "shape": "star"
              },
              "actions": [
                {
                  "verb": "setCount",
                  "at": "@c3",
                  "args": {
                    "n": 7
                  }
                }
              ]
            }
          },
          {
            "id": "s2_ll",
            "type": "text",
            "region": "leftLabel",
            "style": {
              "fontSize": "label",
              "align": "center"
            },
            "content": {}
          },
          {
            "id": "s2_rl",
            "type": "text",
            "region": "rightLabel",
            "style": {
              "fontSize": "label",
              "align": "center"
            },
            "content": {}
          }
        ],
        "beats": [
          {
            "id": "s2_b1",
            "cue": "c2",
            "actions": [
              {
                "verb": "reveal",
                "target": "s2_ll"
              }
            ]
          },
          {
            "id": "s2_b2",
            "cue": "c3",
            "actions": [
              {
                "verb": "reveal",
                "target": "s2_rl"
              }
            ]
          },
          {
            "id": "s2_b3",
            "cue": "c4",
            "actions": [
              {
                "verb": "emphasize",
                "target": "s2_R",
                "style": "wobble"
              }
            ]
          }
        ]
      },
      {
        "id": "s3",
        "kind": "exposition",
        "phase": "orient",
        "narrationRef": "n3",
        "layout": {
          "template": "teach",
          "regions": {}
        },
        "elements": [
          {
            "id": "s3_ti",
            "type": "text",
            "region": "title",
            "style": {
              "fontSize": "title",
              "align": "center"
            },
            "startVisible": true,
            "content": {}
          },
          {
            "id": "s3_kit",
            "type": "manipulative",
            "region": "stage",
            "content": {
              "kind": "evenodd",
              "params": {
                "number": 0,
                "icon": "star",
                "showResult": false,
                "labels": {
                  "even": "{n} là số CHẴN",
                  "odd": "{n} là số LẺ"
                }
              },
              "actions": [
                {
                  "verb": "setNumber",
                  "at": "@c1",
                  "args": {
                    "n": 8
                  }
                },
                {
                  "verb": "showResult",
                  "at": "@c3"
                }
              ]
            }
          },
          {
            "id": "s3_co",
            "type": "text",
            "region": "callout",
            "style": {
              "fontSize": "label",
              "align": "center",
              "color": "good"
            },
            "content": {}
          }
        ],
        "beats": [
          {
            "id": "s3_b1",
            "cue": "c2",
            "actions": [
              {
                "verb": "emphasize",
                "target": "s3_kit",
                "style": "pulse"
              }
            ]
          },
          {
            "id": "s3_b2",
            "cue": "c3",
            "actions": [
              {
                "verb": "reveal",
                "target": "s3_co"
              },
              {
                "verb": "sfx",
                "sound": "success"
              }
            ]
          }
        ]
      },
      {
        "id": "s4",
        "kind": "exposition",
        "phase": "teach",
        "narrationRef": "n4",
        "layout": {
          "template": "teach",
          "regions": {}
        },
        "elements": [
          {
            "id": "s4_ti",
            "type": "text",
            "region": "title",
            "style": {
              "fontSize": "title",
              "align": "center"
            },
            "startVisible": true,
            "content": {}
          },
          {
            "id": "s4_kit",
            "type": "manipulative",
            "region": "stage",
            "content": {
              "kind": "evenodd",
              "params": {
                "number": 8,
                "icon": "star",
                "showResult": false,
                "labels": {
                  "even": "{n} là số CHẴN",
                  "odd": "{n} là số LẺ"
                }
              },
              "actions": [
                {
                  "verb": "remove",
                  "at": "@c1",
                  "args": {
                    "n": 1
                  }
                },
                {
                  "verb": "showResult",
                  "at": "@c3"
                }
              ]
            }
          },
          {
            "id": "s4_co",
            "type": "text",
            "region": "callout",
            "style": {
              "fontSize": "label",
              "align": "center",
              "color": "accent"
            },
            "content": {}
          }
        ],
        "beats": [
          {
            "id": "s4_b1",
            "cue": "c2",
            "actions": [
              {
                "verb": "emphasize",
                "target": "s4_kit",
                "style": "shake"
              }
            ]
          },
          {
            "id": "s4_b2",
            "cue": "c3",
            "actions": [
              {
                "verb": "reveal",
                "target": "s4_co"
              }
            ]
          }
        ]
      },
      {
        "id": "s5",
        "kind": "exposition",
        "phase": "teach",
        "narrationRef": "n5",
        "layout": {
          "template": "sequence",
          "regions": {}
        },
        "elements": [
          {
            "id": "s5_ti",
            "type": "text",
            "region": "title",
            "style": {
              "fontSize": "title",
              "align": "center"
            },
            "startVisible": true,
            "content": {}
          },
          {
            "id": "s5_a",
            "type": "manipulative",
            "region": "steps",
            "flow": {
              "order": 1
            },
            "content": {
              "kind": "tenframe",
              "params": {
                "count": 0
              },
              "actions": [
                {
                  "verb": "fill",
                  "at": "@c1",
                  "args": {
                    "n": 4
                  }
                }
              ]
            }
          },
          {
            "id": "s5_b",
            "type": "manipulative",
            "region": "steps",
            "flow": {
              "order": 2
            },
            "content": {
              "kind": "tenframe",
              "params": {
                "count": 0
              },
              "actions": [
                {
                  "verb": "fill",
                  "at": "@c2",
                  "args": {
                    "n": 5
                  }
                }
              ]
            }
          },
          {
            "id": "s5_c",
            "type": "manipulative",
            "region": "steps",
            "flow": {
              "order": 3
            },
            "content": {
              "kind": "tenframe",
              "params": {
                "count": 0
              },
              "actions": [
                {
                  "verb": "fill",
                  "at": "@c3",
                  "args": {
                    "n": 6
                  }
                }
              ]
            }
          }
        ],
        "beats": [
          {
            "id": "s5_b1",
            "cue": "c2",
            "actions": [
              {
                "verb": "emphasize",
                "target": "s5_b",
                "style": "wobble"
              }
            ]
          },
          {
            "id": "s5_b2",
            "cue": "c4",
            "actions": [
              {
                "verb": "emphasize",
                "target": "s5_c",
                "style": "pulse"
              }
            ]
          }
        ]
      },
      {
        "id": "s6",
        "kind": "exposition",
        "phase": "teach",
        "narrationRef": "n6",
        "layout": {
          "template": "teach",
          "regions": {}
        },
        "elements": [
          {
            "id": "s6_ti",
            "type": "text",
            "region": "title",
            "style": {
              "fontSize": "title",
              "align": "center"
            },
            "startVisible": true,
            "content": {}
          },
          {
            "id": "s6_nl",
            "type": "manipulative",
            "region": "stage",
            "content": {
              "kind": "numberline",
              "params": {
                "min": 0,
                "max": 10
              },
              "actions": [
                {
                  "verb": "jump",
                  "at": "@c1",
                  "args": {
                    "from": 0,
                    "to": 2
                  }
                },
                {
                  "verb": "jump",
                  "at": "@c2",
                  "args": {
                    "from": 2,
                    "to": 4
                  }
                },
                {
                  "verb": "jump",
                  "at": "@c3",
                  "args": {
                    "from": 4,
                    "to": 6
                  }
                }
              ]
            }
          },
          {
            "id": "s6_co",
            "type": "text",
            "region": "callout",
            "style": {
              "fontSize": "label",
              "align": "center",
              "color": "good"
            },
            "content": {}
          }
        ],
        "beats": [
          {
            "id": "s6_b1",
            "cue": "c3",
            "actions": [
              {
                "verb": "reveal",
                "target": "s6_co"
              }
            ]
          },
          {
            "id": "s6_b2",
            "cue": "c4",
            "actions": [
              {
                "verb": "emphasize",
                "target": "s6_co",
                "style": "tada"
              }
            ]
          }
        ]
      },
      {
        "id": "s7",
        "kind": "exposition",
        "phase": "formalize",
        "narrationRef": "n7",
        "layout": {
          "template": "flow",
          "regions": {}
        },
        "elements": [
          {
            "id": "s7_ti",
            "type": "text",
            "region": "title",
            "style": {
              "fontSize": "title",
              "align": "center"
            },
            "startVisible": true,
            "content": {}
          },
          {
            "id": "s7_dg",
            "type": "diagram",
            "region": "diagram",
            "content": {
              "layoutKind": "flow",
              "direction": "auto",
              "nodes": [
                {
                  "id": "n1",
                  "label": "Đếm",
                  "shape": "pill"
                },
                {
                  "id": "n2",
                  "label": "Ghép đôi",
                  "shape": "box"
                },
                {
                  "id": "n3",
                  "label": "Còn dư?",
                  "shape": "diamond"
                },
                {
                  "id": "n4",
                  "label": "CHẴN",
                  "shape": "circle"
                },
                {
                  "id": "n5",
                  "label": "LẺ",
                  "shape": "circle"
                }
              ],
              "edges": [
                {
                  "id": "e1",
                  "from": "n1",
                  "to": "n2",
                  "kind": "arrow"
                },
                {
                  "id": "e2",
                  "from": "n2",
                  "to": "n3",
                  "kind": "arrow"
                },
                {
                  "id": "e3",
                  "from": "n3",
                  "to": "n4",
                  "label": "hết",
                  "kind": "arrow"
                },
                {
                  "id": "e4",
                  "from": "n3",
                  "to": "n5",
                  "label": "dư 1",
                  "kind": "arrow"
                }
              ]
            }
          }
        ],
        "beats": [
          {
            "id": "s7_b1",
            "cue": "c1",
            "actions": [
              {
                "verb": "revealNode",
                "diagram": "s7_dg",
                "node": "n1"
              },
              {
                "verb": "revealNode",
                "diagram": "s7_dg",
                "node": "n2"
              },
              {
                "verb": "connect",
                "diagram": "s7_dg",
                "edge": "e1"
              }
            ]
          },
          {
            "id": "s7_b2",
            "cue": "c2",
            "actions": [
              {
                "verb": "revealNode",
                "diagram": "s7_dg",
                "node": "n3"
              },
              {
                "verb": "connect",
                "diagram": "s7_dg",
                "edge": "e2"
              }
            ]
          },
          {
            "id": "s7_b3",
            "cue": "c3",
            "actions": [
              {
                "verb": "revealNode",
                "diagram": "s7_dg",
                "node": "n4"
              },
              {
                "verb": "connect",
                "diagram": "s7_dg",
                "edge": "e3"
              }
            ]
          },
          {
            "id": "s7_b4",
            "cue": "c4",
            "actions": [
              {
                "verb": "revealNode",
                "diagram": "s7_dg",
                "node": "n5"
              },
              {
                "verb": "connect",
                "diagram": "s7_dg",
                "edge": "e4"
              }
            ]
          }
        ]
      },
      {
        "id": "s8",
        "kind": "exposition",
        "phase": "formalize",
        "narrationRef": "n8",
        "layout": {
          "template": "rule",
          "regions": {}
        },
        "elements": [
          {
            "id": "s8_ti",
            "type": "text",
            "region": "title",
            "style": {
              "fontSize": "title",
              "align": "center"
            },
            "startVisible": true,
            "content": {}
          },
          {
            "id": "s8_ru",
            "type": "text",
            "region": "card",
            "style": {
              "fontSize": "body",
              "align": "center",
              "color": "accent"
            },
            "content": {}
          },
          {
            "id": "s8_su",
            "type": "manipulative",
            "region": "support",
            "content": {
              "kind": "evenodd",
              "params": {
                "number": 6,
                "icon": "star",
                "showResult": false,
                "labels": {
                  "even": "{n} là số CHẴN",
                  "odd": "{n} là số LẺ"
                }
              },
              "actions": [
                {
                  "verb": "showResult",
                  "at": "@c2"
                }
              ]
            }
          }
        ],
        "beats": [
          {
            "id": "s8_b1",
            "cue": "c1",
            "actions": [
              {
                "verb": "reveal",
                "target": "s8_ru"
              }
            ]
          },
          {
            "id": "s8_b2",
            "cue": "c2",
            "actions": [
              {
                "verb": "emphasize",
                "target": "s8_ru",
                "style": "tada"
              }
            ]
          }
        ]
      },
      {
        "id": "s9",
        "kind": "exposition",
        "phase": "guided",
        "narrationRef": "n9",
        "layout": {
          "template": "worked-example",
          "regions": {}
        },
        "elements": [
          {
            "id": "s9_ti",
            "type": "text",
            "region": "title",
            "style": {
              "fontSize": "title",
              "align": "center"
            },
            "startVisible": true,
            "content": {}
          },
          {
            "id": "s9_pr",
            "type": "text",
            "region": "problem",
            "style": {
              "fontSize": "body",
              "align": "center",
              "color": "accent2"
            },
            "startVisible": true,
            "content": {}
          },
          {
            "id": "s9_st",
            "type": "list",
            "region": "steps",
            "content": {
              "style": "number",
              "items": [
                "Đếm: có 12 ngôi sao.",
                "Ghép đôi: 2, 4, 6, 8, 10, 12.",
                "Không dư ai → CHẴN."
              ]
            }
          },
          {
            "id": "s9_an",
            "type": "stat",
            "region": "answer",
            "content": {
              "value": "CHẴN",
              "color": "good"
            }
          }
        ],
        "beats": [
          {
            "id": "s9_b1",
            "cue": "c2",
            "actions": [
              {
                "verb": "revealAll",
                "target": "s9_st"
              }
            ]
          },
          {
            "id": "s9_b2",
            "cue": "c3",
            "actions": [
              {
                "verb": "reveal",
                "target": "s9_an"
              },
              {
                "verb": "emphasize",
                "target": "s9_an",
                "style": "tada"
              }
            ]
          }
        ]
      },
      {
        "id": "s10",
        "kind": "gate",
        "phase": "practice",
        "layout": {
          "template": "practice",
          "regions": {}
        },
        "elements": [
          {
            "id": "s10_pr",
            "type": "text",
            "region": "prompt",
            "style": {
              "fontSize": "title",
              "align": "center"
            },
            "startVisible": true,
            "content": {}
          }
        ],
        "gate": {
          "kind": "activity",
          "prompt": "Số 9 là chẵn hay lẻ?",
          "answer": "",
          "onPass": "resume",
          "activity": {
            "quiz": {
              "id": "q1",
              "type": "single",
              "prompt": "Số 9 là chẵn hay lẻ?",
              "choices": [
                {
                  "id": "even",
                  "label": "Chẵn"
                },
                {
                  "id": "odd",
                  "label": "Lẻ"
                }
              ],
              "answerId": "odd"
            }
          },
          "feedback": {
            "correct": "Đúng rồi! 9 ghép đôi còn dư một bạn.",
            "wrong": "Em thử ghép đôi 9 ngôi sao xem còn dư không nhé."
          }
        }
      },
      {
        "id": "s11",
        "kind": "gate",
        "phase": "practice",
        "layout": {
          "template": "practice",
          "regions": {}
        },
        "elements": [
          {
            "id": "s11_pr",
            "type": "text",
            "region": "prompt",
            "style": {
              "fontSize": "title",
              "align": "center"
            },
            "startVisible": true,
            "content": {}
          }
        ],
        "gate": {
          "kind": "activity",
          "prompt": "Em hãy lấy đủ 10 ngôi sao.",
          "answer": "",
          "onPass": "resume",
          "activity": {
            "manip": {
              "kind": "count",
              "params": {
                "count": 3,
                "shape": "star"
              },
              "target": {
                "count": 10
              }
            }
          },
          "feedback": {
            "correct": "Giỏi lắm! 10 ghép đôi hết, là số chẵn.",
            "wrong": "Em đếm lại xem đã đủ 10 chưa nhé."
          }
        }
      },
      {
        "id": "s12",
        "kind": "gate",
        "phase": "practice",
        "layout": {
          "template": "practice",
          "regions": {}
        },
        "elements": [
          {
            "id": "s12_pr",
            "type": "text",
            "region": "prompt",
            "style": {
              "fontSize": "title",
              "align": "center"
            },
            "startVisible": true,
            "content": {}
          }
        ],
        "gate": {
          "kind": "activity",
          "prompt": "Số 14 là số chẵn, đúng hay sai?",
          "answer": "",
          "onPass": "resume",
          "activity": {
            "quiz": {
              "id": "q2",
              "type": "boolean",
              "prompt": "Số 14 là số chẵn.",
              "trueLabel": "Đúng",
              "falseLabel": "Sai",
              "answer": true
            }
          },
          "feedback": {
            "correct": "Chuẩn! Chữ số cuối là 4, nằm trong 0-2-4-6-8.",
            "wrong": "Em nhìn chữ số cuối của 14 xem sao."
          }
        }
      },
      {
        "id": "s13",
        "kind": "exposition",
        "phase": "recap",
        "narrationRef": "n13",
        "layout": {
          "template": "bullets",
          "regions": {}
        },
        "elements": [
          {
            "id": "s13_ti",
            "type": "text",
            "region": "title",
            "style": {
              "fontSize": "title",
              "align": "center"
            },
            "startVisible": true,
            "content": {}
          },
          {
            "id": "s13_ls",
            "type": "list",
            "region": "list",
            "content": {
              "style": "check",
              "items": [
                "Em ghép đôi được các vật.",
                "Ghép hết → số CHẴN.",
                "Dư một bạn → số LẺ.",
                "Nhìn chữ số cuối là biết ngay."
              ]
            }
          }
        ],
        "beats": [
          {
            "id": "s13_b1",
            "cue": "c1",
            "actions": [
              {
                "verb": "revealAll",
                "target": "s13_ls"
              }
            ]
          },
          {
            "id": "s13_b2",
            "cue": "c2",
            "actions": [
              {
                "verb": "emphasize",
                "target": "s13_ls",
                "style": "pulse"
              }
            ]
          }
        ]
      },
      {
        "id": "s14",
        "kind": "gate",
        "phase": "checkout",
        "layout": {
          "template": "practice",
          "regions": {}
        },
        "elements": [
          {
            "id": "s14_pr",
            "type": "text",
            "region": "prompt",
            "style": {
              "fontSize": "title",
              "align": "center"
            },
            "startVisible": true,
            "content": {}
          }
        ],
        "gate": {
          "kind": "activity",
          "prompt": "Xếp các số vào đúng nhóm.",
          "answer": "",
          "onPass": "resume",
          "activity": {
            "quiz": {
              "id": "q3",
              "type": "categorize",
              "prompt": "Số nào chẵn, số nào lẻ?",
              "categories": [
                {
                  "id": "even",
                  "label": "CHẴN"
                },
                {
                  "id": "odd",
                  "label": "LẺ"
                }
              ],
              "items": [
                {
                  "id": "i2",
                  "label": "2"
                },
                {
                  "id": "i5",
                  "label": "5"
                },
                {
                  "id": "i8",
                  "label": "8"
                },
                {
                  "id": "i11",
                  "label": "11"
                }
              ],
              "assignment": {
                "i2": "even",
                "i5": "odd",
                "i8": "even",
                "i11": "odd"
              }
            }
          },
          "feedback": {
            "correct": "Em đã hiểu thật rồi đấy!",
            "wrong": "Em thử ghép đôi từng số xem nhé."
          }
        }
      }
    ]
  },
  "bundle": {
    "locale": "vi",
    "strings": {
      "s1_ti": "Số chẵn & số lẻ",
      "s2_ti": "Nhóm nào ghép đôi hết?",
      "s2_ll": "Sáu ngôi sao",
      "s2_rl": "Bảy ngôi sao",
      "s3_ti": "Ghép đôi 8 ngôi sao",
      "s3_co": "CHẴN",
      "s4_ti": "Bớt đi một thì sao?",
      "s4_co": "LẺ",
      "s5_ti": "Nhìn trên khung mười",
      "s6_ti": "Nhảy hai bước một",
      "s6_co": "Toàn số chẵn!",
      "s7_ti": "Cách kiểm tra",
      "s8_ti": "Quy tắc cần nhớ",
      "s8_ru": "Ghép hết → CHẴN. Dư 1 → LẺ.",
      "s9_ti": "Cô làm cùng em",
      "s9_pr": "12 ngôi sao là chẵn hay lẻ?",
      "s10_pr": "Đến lượt em!",
      "s11_pr": "Em lấy đủ 10 ngôi sao nhé",
      "s12_pr": "Đúng hay sai?",
      "s13_ti": "Em đã làm được gì?",
      "s14_pr": "Thử thách cuối"
    },
    "narration": {
      "n1": {
        "script": "[[cue:c1]] Chào em! Hôm nay cô và em sẽ khám phá một điều rất thú vị về các con số. [[cue:c2]] Em nhìn những ngôi sao này nhé — có những nhóm ghép đôi được hết, có nhóm lại dư ra một bạn. Vì sao lại thế nhỉ?",
        "voice": "vi-VN",
        "marks": [
          {
            "cue": "c1",
            "t": 0.3
          },
          {
            "cue": "c2",
            "t": 4.2
          }
        ]
      },
      "n2": {
        "script": "[[cue:c1]] Cô có hai nhóm ngôi sao. [[cue:c2]] Bên trái, cô đặt sáu ngôi sao. [[cue:c3]] Bên phải, cô đặt bảy ngôi sao. [[cue:c4]] Em thử nhìn kỹ xem: nhóm nào ghép đôi được hết, nhóm nào còn thừa một bạn? Đừng vội trả lời, cứ nhìn đã nhé.",
        "voice": "vi-VN",
        "marks": [
          {
            "cue": "c1",
            "t": 0.3
          },
          {
            "cue": "c2",
            "t": 2.4
          },
          {
            "cue": "c3",
            "t": 5
          },
          {
            "cue": "c4",
            "t": 7.6
          }
        ]
      },
      "n3": {
        "script": "[[cue:c1]] Bây giờ cô lấy tám ngôi sao. [[cue:c2]] Mình ghép chúng thành từng đôi nhé: hai, bốn, sáu, tám. [[cue:c3]] Em thấy không, không còn bạn nào đứng một mình cả! Số tám là số CHẴN.",
        "voice": "vi-VN",
        "marks": [
          {
            "cue": "c1",
            "t": 0.3
          },
          {
            "cue": "c2",
            "t": 3
          },
          {
            "cue": "c3",
            "t": 8.2
          }
        ]
      },
      "n4": {
        "script": "[[cue:c1]] Giờ cô bớt đi một ngôi sao, còn lại bảy. [[cue:c2]] Mình lại ghép đôi: hai, bốn, sáu... [[cue:c3]] Ơ kìa, còn một bạn đứng lẻ loi, không tìm được đôi! Số bảy là số LẺ.",
        "voice": "vi-VN",
        "marks": [
          {
            "cue": "c1",
            "t": 0.3
          },
          {
            "cue": "c2",
            "t": 3.4
          },
          {
            "cue": "c3",
            "t": 7.8
          }
        ]
      },
      "n5": {
        "script": "[[cue:c1]] Mình thử nhìn theo cách khác nhé — cô dùng khung mười ô. Bốn ô được tô. [[cue:c2]] Giờ là năm ô: em thấy hàng dưới có một ô lẻ loi không? [[cue:c3]] Còn sáu ô thì sao? [[cue:c4]] Sáu lại ghép đôi hết, không thừa ô nào. Chẵn!",
        "voice": "vi-VN",
        "marks": [
          {
            "cue": "c1",
            "t": 0.3
          },
          {
            "cue": "c2",
            "t": 4.5
          },
          {
            "cue": "c3",
            "t": 8.8
          },
          {
            "cue": "c4",
            "t": 10.8
          }
        ]
      },
      "n6": {
        "script": "[[cue:c1]] Còn một cách nữa: mình nhảy trên trục số, mỗi lần hai bước. Từ không nhảy tới hai. [[cue:c2]] Từ hai nhảy tới bốn. [[cue:c3]] Từ bốn nhảy tới sáu. [[cue:c4]] Em nhìn xem, những chỗ mình đáp xuống đều là số chẵn cả!",
        "voice": "vi-VN",
        "marks": [
          {
            "cue": "c1",
            "t": 0.3
          },
          {
            "cue": "c2",
            "t": 4.6
          },
          {
            "cue": "c3",
            "t": 6.8
          },
          {
            "cue": "c4",
            "t": 9
          }
        ]
      },
      "n7": {
        "script": "[[cue:c1]] Mình chốt lại cách làm nhé: đầu tiên em đếm, rồi em ghép đôi. [[cue:c2]] Sau đó em tự hỏi: còn dư bạn nào không? [[cue:c3]] Nếu ghép hết, không dư ai, thì đó là số CHẴN. [[cue:c4]] Còn nếu dư đúng một bạn, thì đó là số LẺ.",
        "voice": "vi-VN",
        "marks": [
          {
            "cue": "c1",
            "t": 0.3
          },
          {
            "cue": "c2",
            "t": 4.4
          },
          {
            "cue": "c3",
            "t": 7.2
          },
          {
            "cue": "c4",
            "t": 10.4
          }
        ]
      },
      "n8": {
        "script": "[[cue:c1]] Em nhớ giúp cô câu này nhé: ghép đôi hết thì là số CHẴN, còn dư một bạn thì là số LẺ. [[cue:c2]] Chỉ có vậy thôi, dễ lắm phải không nào!",
        "voice": "vi-VN",
        "marks": [
          {
            "cue": "c1",
            "t": 0.3
          },
          {
            "cue": "c2",
            "t": 6
          }
        ]
      },
      "n9": {
        "script": "[[cue:c1]] Giờ cô làm một bài cùng em nhé. Cô có mười hai ngôi sao. [[cue:c2]] Mình làm từng bước: đếm này, rồi ghép đôi này. [[cue:c3]] Không dư bạn nào cả — vậy mười hai là số CHẴN. Em thấy dễ chưa?",
        "voice": "vi-VN",
        "marks": [
          {
            "cue": "c1",
            "t": 0.3
          },
          {
            "cue": "c2",
            "t": 4
          },
          {
            "cue": "c3",
            "t": 8.5
          }
        ]
      },
      "n13": {
        "script": "[[cue:c1]] Em giỏi quá! Bây giờ em đã ghép đôi được, biết ghép hết là chẵn, dư một là lẻ. [[cue:c2]] Và em chỉ cần nhìn chữ số cuối cùng là trả lời được ngay rồi đấy!",
        "voice": "vi-VN",
        "marks": [
          {
            "cue": "c1",
            "t": 0.3
          },
          {
            "cue": "c2",
            "t": 6.4
          }
        ]
      }
    }
  }
}
```

---

## 10. Tự rà trước khi trả lời

Một cổng kiểm tra bằng code sẽ rà bài. Rà nhanh danh sách này rồi trả JSON — mỗi mục là một lỗi cổng có thể báo:

**Sư phạm**

- [ ] ~15 scene, và lời giảng đủ dài để chạy hết 8 phút? (`too-short`, `runs-short`)
- [ ] Mọi scene có `phase`? (`no-phase`)
- [ ] Đủ 8 giai đoạn, đúng thứ tự, không đi lùi? (`phase-thin`, `phase-out-of-order`)
- [ ] `practice` và `checkout` là `kind:"gate"`? (`phase-not-gate`)
- [ ] Mọi scene exposition có lời giảng dài, giọng nói với trẻ? (`no-narration`, `narration-thin`)

**Dùng đúng engine**

- [ ] **Mọi manipulative có `actions` buộc vào cue?** (`kit-static` — lỗi nặng nhất)
- [ ] ≥3 loại kit khác nhau? (`few-kits`)
- [ ] ≥6 template khác nhau? (`few-templates`)
- [ ] ≥2 loại câu hỏi? (`few-quiz-types`)
- [ ] ≥2 beat mỗi scene? (`few-beats`)
- [ ] Có diagram/chart/table? Có gate `activity.manip`? (`no-structure`, `no-manip-gate`)

**Kỹ thuật**

- [ ] Không có `place`/`x`/`y`/`size` ở bất cứ đâu? (`unknown-slot`, `overflow`)
- [ ] Mọi `region` là slot có thật của template đó? (`unknown-slot`, `wrong-type`)
- [ ] Chữ không vượt `maxChars`? (`over-budget`)
- [ ] Slot nhiều phần tử đều có `flow.order`? (`missing-order`)
- [ ] Mọi `cue` và `at:"@..."` đều có `[[cue:]]` + `marks`? (`dangling-cue`)
- [ ] Kit có `labels` đều đã dịch sang ngôn ngữ bài? (`kit-labels-english`)
- [ ] Giá trị enum trong `params` (shape, icon…) nằm trong danh sách hợp lệ ở §4? (`kit-param-value`)
- [ ] Câu hỏi đúng contract core: `single` + `choices` + `answerId`? (`activity-quiz`)

---

## 11. Việc của bạn

Soạn bài **"<CHỦ ĐỀ>"** cho **<ĐỐI TƯỢNG>**:

- **~15 scene** cho bài 8 phút, đi đủ 8 giai đoạn ở §8, mỗi scene khai `phase`. Đặt `meta.targetMinutes`.
- Mỗi scene **một ý**. Chọn template theo _việc nó phải làm_, không theo cái nào trông đẹp.
- **Manipulative phải có `actions`** buộc vào cue — kit đứng im là bài hỏng.
- Lời giảng viết bằng **giọng nói với người học đó** (gọi "em", hỏi han, chỉ vào thứ đang hiện), không phải giọng sách giáo khoa. Mỗi câu một `[[cue:...]]`, mỗi cue một beat.

Trả về **CHỈ** JSON `{doc, bundle}`.
