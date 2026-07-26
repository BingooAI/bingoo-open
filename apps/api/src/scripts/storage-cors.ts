// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * KHAI CORS CHO BUCKET — bước bắt buộc, và là bước không ai đoán ra được.
 *
 * Tệp tin đi THẲNG từ trình duyệt lên kho, không qua API: server chỉ ký một URL rồi đưa cho trình
 * duyệt. Cách đó đúng — hàng trăm MB không cần chạy vòng qua máy chủ — nhưng nó biến việc tải lên
 * thành một yêu cầu KHÁC NGUỒN, nên bucket phải tự nói ra rằng nó chấp nhận origin của ứng dụng.
 *
 * Bucket mới KHÔNG chấp nhận origin nào cả, kể cả localhost. Người tự host dựng xong mọi thứ, bấm
 * tải một tệp, và nhận đúng một dòng: "No 'Access-Control-Allow-Origin' header is present". Dòng đó
 * không nhắc gì tới bucket, tới CORS phải khai ở đâu, hay tới việc mã nguồn hoàn toàn không sai —
 * nên nó ngốn hàng giờ. Script này để chỗ đó thành một câu lệnh.
 *
 *   set -a; . ./.env; set +a
 *   pnpm exec tsx src/scripts/storage-cors.ts --origins http://localhost:3000,http://localhost:3001
 *   pnpm exec tsx src/scripts/storage-cors.ts --show
 *
 * Không có tên bucket hay origin nào ghi cứng ở đây: tất cả đọc từ env và tham số, vì kho là của
 * người chạy, không phải của dự án.
 */

import { GetBucketCorsCommand, PutBucketCorsCommand, S3Client } from '@aws-sdk/client-s3'
import { resolveR2Config, resolveS3Config, type S3Config } from '../providers/storage/adapters/s3'

/**
 * Header trình duyệt được phép gửi kèm.
 *
 * `content-type` là bắt buộc: phía tải lên đặt nó để kho lưu đúng kiểu tệp, và chính nó khiến yêu
 * cầu không còn là "yêu cầu đơn giản" nữa. Thiếu nó trong danh sách thì preflight vẫn trượt, dù
 * origin đã đúng — và triệu chứng y hệt như chưa khai gì.
 */
const ALLOWED_HEADERS = ['content-type']

/** `ETag` phải phơi ra thì phía tải lên mới đọc được kết quả; mặc định trình duyệt giấu nó đi. */
const EXPOSE_HEADERS = ['ETag']

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}

/** Cấu hình kho đang bật, đọc qua đúng đường mà API dùng — không dựng lại một đường thứ hai. */
function activeConfig(): S3Config {
  const driver = (process.env.STORAGE_DRIVER ?? '').toLowerCase()
  if (driver === 'r2') return resolveR2Config()
  if (driver === 's3') return resolveS3Config()
  // Không khai thì đoán theo biến nào có mặt, và nói ra là đang đoán.
  if (process.env.R2_ACCOUNT_ID) {
    console.log('STORAGE_DRIVER chưa đặt — thấy R2_ACCOUNT_ID nên dùng cấu hình R2.')
    return resolveR2Config()
  }
  console.log('STORAGE_DRIVER chưa đặt — dùng cấu hình S3.')
  return resolveS3Config()
}

async function main(): Promise<void> {
  const config = activeConfig()
  const client = new S3Client({
    region: config.region,
    ...(config.endpoint !== undefined ? { endpoint: config.endpoint } : {}),
    forcePathStyle: config.forcePathStyle,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })

  if (process.argv.includes('--show')) {
    try {
      const cur = await client.send(new GetBucketCorsCommand({ Bucket: config.bucket }))
      console.log(JSON.stringify(cur.CORSRules, null, 2))
    } catch {
      // Kho trả lỗi khi CHƯA có quy tắc nào — đó là câu trả lời, không phải sự cố.
      console.log(`Bucket "${config.bucket}" chưa khai CORS. Tải lên từ trình duyệt sẽ bị chặn.`)
    }
    return
  }

  const origins = (arg('--origins') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
  if (origins.length === 0) {
    throw new Error(
      'cần --origins <danh sách, ngăn bởi dấu phẩy>, ví dụ http://localhost:3000,http://localhost:3001',
    )
  }
  // Dấu `*` mở bucket cho mọi trang web trên đời gọi tới bằng thông tin đăng nhập của người dùng.
  // Chặn ở đây, chứ không cảnh báo: một lan can khuyên nhủ là một lan can sẽ bị bỏ qua.
  if (origins.includes('*')) {
    throw new Error('không nhận "*" — hãy liệt kê đúng những origin của bạn')
  }

  await client.send(
    new PutBucketCorsCommand({
      Bucket: config.bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: origins,
            // PUT để tải lên; GET/HEAD để trình xem PDF đọc lại chính tệp đó qua URL ký sẵn.
            AllowedMethods: ['PUT', 'GET', 'HEAD'],
            AllowedHeaders: ALLOWED_HEADERS,
            ExposeHeaders: EXPOSE_HEADERS,
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  )
  console.log(`Đã khai CORS cho "${config.bucket}": ${origins.join(', ')}`)
  console.log('Kiểm lại bằng --show. Trình duyệt có thể còn nhớ kết quả preflight cũ tới 1 giờ.')
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e)
  process.exitCode = 1
})
