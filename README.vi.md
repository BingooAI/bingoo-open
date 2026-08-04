# Bingoo Open

**Biến một tài liệu chương trình thành bài dạy mà bạn bảo vệ được.**

Bingoo Open là bộ công cụ dạy học bạn tự chạy. Đưa cho nó một tài liệu — chuẩn quốc gia, một
chương sách giáo khoa, hay giáo trình của riêng bạn — nó tìm ra phải học những gì và theo thứ tự
nào, soạn bài dựa trên bản đồ đó, rồi theo dõi từng em thật sự nắm được gì.

Chỗ đáng nói: **mọi khẳng định nó đưa ra đều mở ra xem được.** Bấm vào một khái niệm, một quan hệ
tiên quyết hay một mục tiêu, bạn thấy ngay **câu trong chính tài liệu của bạn** làm căn cứ, trang
số mấy, và máy đã *chứng minh* được điều đó hay chỉ *đoán*. Không có khẳng định nào không kèm
đường kiểm lại.

Bạn chạy trên máy hoặc máy chủ của mình. Không tài khoản, không tính tiền theo đầu người, không có
bên thứ ba nào giữ dữ liệu học sinh của bạn.

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A522-brightgreen.svg)](package.json)

[English](README.md) · [Đóng góp](CONTRIBUTING.md) · [Bảo mật](SECURITY.md)

---

## Dùng nó trông như thế nào

1. **Tải một tài liệu lên.** File PDF, một thư mục ảnh quét, hoặc văn bản thuần.
2. **Máy đọc rồi dựng bản đồ nháp** — các khái niệm, cái nào phải học trước, và những mục tiêu
   tài liệu nêu ra.
3. **Bạn duyệt với căn cứ mở sẵn.** Mỗi dòng hiện rõ: khẳng định gì, câu trích nào đứng sau, và
   những phép kiểm nào đạt, cái nào không.
4. **Bạn duyệt, hoặc từ chối kèm lý do.** Lý do từ chối được giữ lại, để người sau còn biết cái gì
   đã bị loại và vì sao.
5. **Giáo án được soạn từ bản đồ đã duyệt**, và cũng phải có người duyệt trước khi tới tay trẻ.
6. **Học sinh học các bài đó**, và mỗi lần làm bài trở thành một mẩu minh chứng có mốc thời gian
   và nguồn gốc.

Bước 3 và 4 mới là điểm cốt lõi. Máy đọc sách giáo khoa thì thế nào cũng có chỗ sai; câu hỏi là
bạn có **nhìn thấy** chỗ sai đó không, trước khi một đứa trẻ nhìn thấy.

## Căn cứ mở ra xem được

Đây là thứ người duyệt nhìn thấy với một mục tiêu bóc từ tài liệu đã tải lên:

```
Mục tiêu    "Đếm đến 20 và đếm ngược"                          file của bạn · trang 12
  trích     "Học sinh đếm được đến 20 và đếm ngược từ 20."     tìm thấy trong tài liệu
  kiểm      có ít nhất một khái niệm phủ mục tiêu này          ✔ đạt
  kiểm      các khái niệm đó phân biệt được với nhau           ✔ đạt
  căn cứ    FROM_SOURCE — câu này CÓ trong file của bạn, không phải máy bịa

Tiên quyết  "Đếm đến 10"  ──▶  "Đếm đến 20"
  kiểm      kỹ năng trước nằm gọn trong kỹ năng sau            ✔ đạt
  kiểm      tài liệu dạy chúng đúng theo thứ tự đó             ✔ đạt
  căn cứ    STRUCTURAL — suy ra từ bản đồ, không phải câu trích
```

Ba điều đáng nói rõ:

- **`căn cứ` cho biết khẳng định từ đâu ra.** `FROM_SOURCE` nghĩa là câu trích đã được định vị
  trong file bạn tải lên. `STRUCTURAL` nghĩa là nó suy ra từ bản đồ. `AI_INFERRED` nghĩa là mô
  hình tự nói ra và không có gì kiểm chứng — điều đó không bị cấm, nhưng **được dán nhãn**.
- **Tìm thấy câu trích không phải là chứng minh.** Định vị được một câu chỉ cho thấy câu đó tồn
  tại, chứ không cho thấy nó chứng minh khẳng định. Phán đoán đó vẫn là của bạn; việc của công cụ
  là **đưa câu ấy ra trước mặt bạn**, không phải tóm tắt nó đi.
- **Phép kiểm được chạy lại về sau.** Một khẳng định từng đúng với một phiên bản tài liệu có thể
  âm thầm hết đúng khi bản đồ bên dưới đổi. Mở thẻ ra là nó kiểm lại và báo cho bạn biết câu trả
  lời đã trôi đi so với lúc ghi hay chưa.

Cùng một dạng thẻ đó phục vụ **bảy loại khẳng định**: một mục tiêu tồn tại · một khái niệm tồn
tại · cái này học trước cái kia · một mục tiêu đã được phủ · hai khái niệm thật ra là một · một
bài học phục vụ mục tiêu nào · một khái niệm mới được đề xuất.

## Bắt đầu nhanh

```bash
git clone https://github.com/BingooAI/bingoo-open.git
cd bingoo-open
pnpm install
pnpm build     # các package resolve nhau qua dist/, nên bước này phải chạy trước
pnpm dev
```

Cần **Node ≥ 22** và **pnpm ≥ 9**.

Ba ứng dụng chạy lên, dữ liệu mẫu nạp sẵn nên bạn bấm thử được ngay mà chưa cần cấu hình gì:

| | Địa chỉ | Dành cho ai |
|---|---|---|
| **Ứng dụng học** | `localhost:3000` | Thứ trẻ và phụ huynh nhìn thấy: bài học, luyện tập, tiến bộ |
| **Bảng điều khiển** | `localhost:3001` | Nạp chương trình, duyệt bản nháp với căn cứ mở sẵn, phê duyệt, xem từng em đang ở đâu |
| **API** | `localhost:4000` | Máy chủ mà mọi thứ nói chuyện với |

Xem thử thì không cần dịch vụ ngoài nào cả. Chỉ khi muốn máy đọc tài liệu của chính bạn mới cần
khoá — xem [Chạy theo cách của bạn](#chạy-theo-cách-của-bạn).

## Bên trong có gì

Năm khung, mỗi khung dùng độc lập được. Lấy trọn bộ, hoặc cài đúng một package và bỏ qua phần còn
lại. 21 package, 3 ứng dụng.

| Khung | Cho bạn cái gì | Package |
|---|---|---|
| **Kiến thức** | Đồ thị năng lực, quan hệ tiên quyết, quản lý phiên bản khung, gióng hai chương trình vào nhau | `contracts` · `knowledge-engine` · `facets` · `authoring` · `codecs` |
| **Sư phạm** | Giáo án, điểm tri thức, lỗi hiểu sai, tiêu chí đạt, cá nhân hoá theo từng em | `plans` · `personalization` |
| **Giảng dạy** | Engine trình bày bài giảng và 67 học cụ tương tác | `explainer` · `explainer-web` · `manipulatives` |
| **Nội dung** | Soạn và sinh bài tập — **55 dạng câu hỏi** — kèm ngân hàng item và theo dõi độ phủ | `content-gen` · `authored-item` · `core` |
| **Học** | Các chế độ học cho học sinh, luồng phiên học, thu thập minh chứng | `experiences` · `learning-experience` · `telemetry` |

Dùng chung cho cả năm: `ui-web` (component), `i18n` (tiếng Việt và tiếng Anh), `tokens` (giao diện
sáng/tối), `db`, và một API HTTP.

**67 học cụ** là đúng những thứ một người dạy giỏi hay lấy ra dùng trên giấy — tia số, khối cơ số
mười, thanh phân số, sơ đồ đoạn thẳng, cân thăng bằng, đồng hồ, mạch điện, lưới toạ độ — nay chạy
trong trình duyệt và dùng lại được qua nhiều bài.

**Đo bằng phương pháp khớp với thứ được đo, không phải một con số cho tất cả.** Kiến thức và quy
trình ước lượng bằng BKT và Elo. Kỹ năng do **người** chấm theo rubric, vì máy chấm kỹ năng mà
không có rubric là đoán. Thói quen và phẩm chất báo cáo bằng **tần suất quan sát kèm khoảng tin
cậy**, và **không bao giờ** hiện ra dưới dạng một phần trăm trần trụi cho trẻ hay phụ huynh —
bằng chứng mỏng thì phải trông cho ra mỏng, không làm tròn thành sự chính xác giả.

**Chương trình nạp vào qua [CASE](https://www.imsglobal.org/activity/case)**, chuẩn mở cho khung
năng lực, nên nạp một chuẩn quốc gia không phải việc làm riêng từng lần.

## Chạy theo cách của bạn

Mọi dịch vụ bên ngoài đều nằm sau một *capability port* — **chín** cái: mô hình AI, đọc ảnh, đọc
thành tiếng, sinh ảnh, embedding, dịch, lưu trữ, tìm kiếm, cache. Mỗi cái là một giao diện nhỏ với
adapter thay được, nên đổi nhà cung cấp là việc **cấu hình**, không phải viết lại.

```bash
DEPLOYMENT_PROFILE=local     # hoặc `cloud`
STORAGE_PROVIDER=s3          # đặt riêng từng capability thì thắng profile
```

**Cloud** là cách chạy được nhanh nhất, và là thứ cấu hình mặc định nhắm tới. Bạn dùng khoá của
chính mình; không có gì đi vòng qua chúng tôi.

**Local** quan trọng nếu dữ liệu trẻ em buộc phải nằm tại chỗ, hoặc đơn giản là bạn không muốn trả
tiền hằng tháng. Độ phủ chưa đầy đủ — sinh ảnh chưa có adapter chạy local
([#14](https://github.com/BingooAI/bingoo-open/issues/14)) — và tên nhà cung cấp lạ thì **bị từ
chối ngay lúc khởi động**, chứ không âm thầm lùi về cloud.

Lựa chọn là **theo từng capability**. Chạy Postgres ở máy nhà trong khi vẫn dùng nhà cung cấp mô
hình trên mạng là cấu hình bình thường, không phải trường hợp đặc biệt.

## Làm việc với trẻ em

Đây là phần mềm cho trẻ em, nên vài điều được chốt cứng chứ không để cấu hình:

- **AI chỉ soạn nháp; người duyệt.** Không nội dung sinh tự động nào tới tay học sinh mà chưa có
  người chịu trách nhiệm đồng ý.
- **Thứ hạng và kết quả của bạn khác không được đặt trước mặt một đứa trẻ.**
- **Thói quen và phẩm chất không bao giờ bị quy về một điểm số.**
- **Với phụ huynh, tiến bộ được *giải thích*, không phải chấm điểm.**

Đây là những cam kết, và [CONTRIBUTING.md](CONTRIBUTING.md) coi việc làm yếu đi một trong số đó là
lý do đủ để từ chối một thay đổi. Chỗ nào mã nguồn chưa giữ trọn được, chúng tôi **liệt kê ra dưới
đây** chứ không lặng lẽ bỏ qua.

## Những gì chưa có

Một danh sách thành thật thì có ích hơn một bảng tính năng dài.

- **Trang học sinh mẫu vẫn còn một bảng xếp hạng demo.** Nó chạy trên dữ liệu mẫu cố định nên chưa
  phơi em nào ra cả — nhưng phải bỏ đi trước khi trang đó trỏ vào học sinh thật.
- **Xuất minh chứng ra khỏi hệ thống còn dở.** Bộ mã hoá [xAPI](https://xapi.com/) đã viết và đã
  test, nhưng chưa route nào phục vụ nó, nên "mang dữ liệu của bạn mà đi" hôm nay **chưa làm
  được**.
- **Ứng dụng học chưa ghi lại cách đi tới đáp án** — dùng bao nhiêu gợi ý, thử lại mấy lần, mất bao
  lâu — dù mô hình được dựng để cân nhắc những thứ đó.
- **Câu trả lời bằng giọng nói hiện được chấm là ĐÚNG nếu có bất kỳ bản ghi nào**, kể cả im lặng.
  Hãy coi bài tập nói là **chưa được đánh giá** cho tới khi chỗ này được sửa.
- **Một số mục menu trong ứng dụng học chưa dẫn đi đâu**, và ô tìm kiếm cùng chuông thông báo ở
  đầu trang chưa nối vào gì cả.
- **Tầng giao diện chưa có test tự động nào**, bộ chấm bài cũng vậy.

Issue được theo dõi công khai ở
[github.com/BingooAI/bingoo-open/issues](https://github.com/BingooAI/bingoo-open/issues).

## Tình trạng

Pre-alpha, và nói thẳng như vậy. Mô hình đằng sau đã chạy qua chương trình thật và dữ liệu lớp học
thật trong một codebase riêng trước khi được mở ra; API của các package sẽ còn đổi, và chưa có bản
phát hành npm nào từ repo này.

Hữu ích ngay nếu bạn muốn đọc mô hình, phản biện nó, hoặc xây sớm trên nó. Chưa phải thứ để đem ra
dạy trọn một học kỳ.

## Đóng góp

Rất hoan nghênh issue và pull request — kể cả phản biện về mô hình, đó là loại đóng góp có ích
nhất. Xem [CONTRIBUTING.md](CONTRIBUTING.md). Chúng tôi dùng ký
[DCO](https://developercertificate.org/) (`git commit -s`), không dùng CLA.

Các quyết định thiết kế được ghi trong [`docs/adr/`](docs/adr/), kèm lý lẽ và những phương án đã bị
loại — gồm cả những quyết định về sau bị đảo ngược.

## Giấy phép

Mã nguồn theo [Apache-2.0](LICENSE). Xem [NOTICE](NOTICE) để biết phần ghi công và
[TRADEMARK.md](TRADEMARK.md) để biết tên và logo Bingoo được dùng tới đâu — giấy phép cấp quyền
với **mã nguồn**, không cấp quyền với **thương hiệu**.
