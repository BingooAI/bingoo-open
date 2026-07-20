# Bingoo Open

**Dạy theo đúng sức từng em, và biết được là có hiệu quả hay không.**

Bingoo Open là bộ công cụ cho người đi dạy: gia sư, giáo viên tự do, trung tâm và trường nhỏ.
Nó giúp bạn dựng bản đồ những gì học sinh cần học, soạn bài vừa sức từng em, dạy bằng học cụ
tương tác, và nhìn thấy — bằng minh chứng kiểm tra được bằng tay — em thật sự nắm được gì.

Bạn tự chạy trên máy hoặc máy chủ của mình. Không phải tạo tài khoản, không tính tiền theo đầu
người, và không có bên thứ ba nào giữ dữ liệu học sinh của bạn.

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A522-brightgreen.svg)](package.json)

[English](README.md) · [Đóng góp](CONTRIBUTING.md) · [Bảo mật](SECURITY.md)

---

> **Tình trạng: đang lắp ráp.** Repo này đang được dựng lại từ một codebase riêng đang chạy.
> `contracts` và `codecs` đã vào chỗ; các package giảng dạy, nội dung và học tập đang được
> chuyển sang. Chưa có gì ổn định — đọc mục [Tình trạng](#tình-trạng) trước khi dựa vào nó.

## Bạn làm được gì với nó

**Dựng bản đồ: học gì, học theo thứ tự nào.** Nạp một chương trình vào — chuẩn quốc gia ở
định dạng CASE, một cuốn sách giáo khoa, hay giáo trình của riêng bạn — và nhận về đồ thị các
khái niệm kèm quan hệ tiên quyết. Chính đồ thị này cho phép hệ thống nói *"em chưa làm được
bài này **vì** chưa nắm được cái kia"*, thay vì chỉ chấm sai một câu.

**Soạn bài từ bản đồ đó.** Mỗi khái niệm mang theo đúng những thứ người dạy cần: các lỗi hiểu
sai học sinh thường mắc, cách biểu diễn theo mạch cụ thể → hình ảnh → trừu tượng, và thế nào
là đạt. Giáo án sinh ra ở dạng nháp; phải có người duyệt trước khi tới tay trẻ.

**Dạy bằng 67 học cụ tương tác.** Tia số, khối cơ số mười, thanh phân số, sơ đồ đoạn thẳng,
cân thăng bằng, đồng hồ, mạch điện, lưới toạ độ… — đúng những thứ một người dạy giỏi hay lấy
ra dùng trên giấy, nay chạy trong trình duyệt và dùng lại được qua nhiều bài.

**Đo mà không tô vẽ.** Mỗi lần làm bài trở thành một mẩu minh chứng có mốc thời gian và nguồn
gốc. Kiến thức và quy trình được ước lượng bằng BKT và Elo; kỹ năng do **người** chấm theo
rubric, vì máy chấm kỹ năng mà không có rubric là đoán. Thói quen và phẩm chất được báo cáo
bằng **tần suất quan sát kèm khoảng tin cậy** — không bao giờ quy thành một điểm số, và không
bao giờ trộn vào điểm học tập.

**Giải thích được mọi con số bạn đưa ra.** Mỗi ước lượng mức thành thạo đều xuất ra được: kết
luận là gì, dựa trên minh chứng nào, tính bằng công thức nào, và cần thay đổi gì thì con số sẽ
khác đi. Con số không giải thích được cho phụ huynh thì không nên hiện lên màn hình.

## Bắt đầu nhanh

```bash
git clone https://github.com/BingooAI/bingoo-open.git
cd bingoo-open
pnpm install
pnpm dev
```

Cần **Node ≥ 22** và **pnpm ≥ 9**.

Ứng dụng web chạy ở `localhost:3000` với dữ liệu mẫu sẵn, nên bạn bấm thử trọn một bài học
được ngay mà chưa cần cấu hình gì. Muốn xem thử thì không cần dịch vụ ngoài nào cả.

## Bên trong có gì

Năm khung, mỗi khung dùng độc lập được. Lấy trọn bộ, hoặc cài đúng một package và bỏ qua
phần còn lại.

| Khung | Cho bạn cái gì | Package |
|---|---|---|
| **Kiến thức** | Đồ thị năng lực, quan hệ tiên quyết, quản lý phiên bản khung, gióng hai chương trình vào nhau | `contracts` · `knowledge-engine` · `facets` · `authoring` · `codecs` |
| **Sư phạm** | Giáo án, điểm tri thức, lỗi hiểu sai, tiêu chí đạt, cá nhân hoá theo từng em | `plans` · `personalization` |
| **Giảng dạy** | Engine trình bày bài giảng và 67 học cụ | `explainer` · `explainer-web` · `manipulatives` |
| **Nội dung** | Soạn và sinh câu hỏi, sáu dạng câu hỏi, ngân hàng item kèm theo dõi độ phủ | `content-gen` · `authored-item` · `core` |
| **Học** | Các chế độ học cho học sinh, luồng phiên học, thu thập minh chứng | `experiences` · `learning-experience` · `telemetry` |

Dùng chung cho cả năm: `ui-web` (component), `i18n` (tiếng Việt và tiếng Anh), `tokens` (giao
diện sáng/tối), `db`, và một API HTTP.

**Chuẩn mở, nên dữ liệu vẫn là của bạn.** Chương trình nạp vào qua
[CASE](https://www.imsglobal.org/activity/case); minh chứng học tập xuất ra qua
[xAPI](https://xapi.com/). Bạn rời đi lúc nào cũng được, và mang theo cả đồ thị lẫn minh chứng.

## Chạy theo cách của bạn

Mọi dịch vụ bên ngoài đều nằm sau một *capability port* — có 17 cái, bao gồm lưu trữ, cơ sở dữ
liệu, LLM, đọc thành tiếng, sinh ảnh, embedding, email, cache, tìm kiếm, realtime… Mỗi cái là
một giao diện nhỏ với adapter thay được, nên đổi nhà cung cấp là việc **cấu hình**, không phải
viết lại.

**Cloud** là cách chạy được nhanh nhất, và là thứ cấu hình mặc định nhắm tới. Bạn dùng khoá
của chính mình; không có gì đi vòng qua chúng tôi.

**Local** quan trọng nếu bạn làm việc với dữ liệu trẻ em theo quy định bắt giữ tại chỗ, hoặc
đơn giản là không muốn trả tiền hằng tháng. Adapter chạy local đang được bổ sung dần — xem
[trang issue](https://github.com/BingooAI/bingoo-open/issues) để biết hiện đã hỗ trợ tới đâu.

Dù cách nào thì lựa chọn cũng là **theo từng capability**. Chạy Postgres ở máy nhà trong khi
vẫn dùng nhà cung cấp mô hình trên mạng là cấu hình bình thường, không phải trường hợp đặc biệt.

## Làm việc với trẻ em

Đây là phần mềm cho trẻ em, nên vài điều được chốt cứng chứ không để cấu hình:

- **AI chỉ soạn nháp; người duyệt.** Không nội dung sinh tự động nào tới tay học sinh mà chưa
  có người chịu trách nhiệm đồng ý.
- **Mặc định không có bảng xếp hạng.** Thứ hạng và điểm của bạn khác không bị phơi ra. Thi đua
  là tự nguyện và ghép theo đúng sức.
- **Với phụ huynh, tiến bộ được *giải thích*, không phải chấm điểm.**

## Tình trạng

Pre-alpha, và nói thẳng như vậy. Mô hình đằng sau đã chạy qua chương trình thật và dữ liệu lớp
học thật trong một codebase riêng; repo này là bản mở lại của công việc đó, đang làm dở. API
của các package sẽ còn đổi. Chưa có bản phát hành npm nào từ repo này.

Hữu ích ngay nếu bạn muốn đọc mô hình, phản biện nó, hoặc xây sớm trên nó. Chưa phải thứ để
đem ra dạy trọn một học kỳ.

## Đóng góp

Rất hoan nghênh issue và pull request — kể cả phản biện về mô hình, đó là loại đóng góp có ích
nhất. Xem [CONTRIBUTING.md](CONTRIBUTING.md). Chúng tôi dùng ký
[DCO](https://developercertificate.org/) (`git commit -s`), không dùng CLA.

Các quyết định thiết kế được ghi trong [`docs/adr/`](docs/adr/), kèm lý lẽ và những phương án
đã bị loại.

## Giấy phép

Mã nguồn theo [Apache-2.0](LICENSE). Xem [NOTICE](NOTICE) để biết phần ghi công và
[TRADEMARK.md](TRADEMARK.md) để biết tên và logo Bingoo được dùng tới đâu — giấy phép cấp
quyền với **mã nguồn**, không cấp quyền với **thương hiệu**.
