// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { readEnv, requireEnv } from '../../core/config'
import type { ProviderAdapter } from '../../core/registry'
import type { PutObjectInput, SignedUrlInput, StoragePort } from '../port'

/**
 * Object storage over the S3 API.
 *
 * One implementation serves every S3-compatible store — MinIO, AWS, Backblaze B2, Wasabi,
 * Garage, Cloudflare R2 — because they differ in exactly three things: the endpoint, the
 * region, and whether the bucket goes in the path or the hostname.
 *
 * That matters more than it sounds. A school that must keep children's data on its own
 * premises, or a tutor who does not want a monthly bill, needs somewhere to put files before
 * anything else in this project is usable to them. Requiring one vendor for that is requiring
 * an account before the first lesson.
 *
 * Two keys are registered from the same code:
 *
 * - `s3` — configured explicitly. `S3_ENDPOINT` points anywhere.
 * - `r2` — Cloudflare R2, whose endpoint is derived from the account id. Kept so existing
 *   deployments keep working with the environment they already have.
 */

export interface S3Config {
  readonly endpoint: string | undefined
  readonly region: string
  readonly bucket: string
  readonly accessKeyId: string
  readonly secretAccessKey: string
  readonly forcePathStyle: boolean
  readonly publicBase: string | undefined
  readonly defaultTtl: number
}

/**
 * Accept a bare host (`files.example.org`) or a full URL, and always yield an origin with no
 * trailing slash, so joining a key never produces a double slash.
 */
function normaliseBase(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined
  const withScheme = /^https?:\/\//.test(raw) ? raw : `https://${raw}`
  return withScheme.replace(/\/+$/, '')
}

/** Anything but an explicit "false"/"0" counts as on, matching how the other flags read. */
function readBool(name: string, fallback: boolean): boolean {
  const raw = readEnv(name)
  if (raw === undefined) return fallback
  return raw !== 'false' && raw !== '0'
}

function readTtl(name: string): number {
  const n = Number(readEnv(name))
  return Number.isFinite(n) && n > 0 ? n : 900
}

/**
 * MinIO and Garage serve buckets from the path (`http://host/bucket/key`); AWS and R2 serve
 * them from the hostname. Getting this wrong yields a 404 that looks like a missing object
 * rather than a misconfiguration, so it defaults to whatever suits the endpoint: a custom one
 * is far more often a self-hosted store than not.
 */
export function resolveS3Config(): S3Config {
  const env = requireEnv('storage', 's3', ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'])
  const endpoint = readEnv('S3_ENDPOINT')
  return {
    endpoint,
    region: readEnv('S3_REGION') ?? 'auto',
    bucket: env.S3_BUCKET,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    forcePathStyle: readBool('S3_FORCE_PATH_STYLE', endpoint !== undefined),
    publicBase: normaliseBase(readEnv('S3_PUBLIC_BASE_URL')),
    defaultTtl: readTtl('S3_SIGNED_URL_TTL'),
  }
}

/** Cloudflare R2: the endpoint follows from the account id, and the region is always `auto`. */
export function resolveR2Config(): S3Config {
  const env = requireEnv('storage', 'r2', [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET',
  ])
  return {
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    region: 'auto',
    bucket: env.R2_BUCKET,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    forcePathStyle: false,
    publicBase: normaliseBase(readEnv('R2_PUBLIC_BASE_URL')),
    defaultTtl: readTtl('R2_SIGNED_URL_TTL'),
  }
}

function makePort(config: S3Config): StoragePort {
  const client = new S3Client({
    region: config.region,
    ...(config.endpoint !== undefined ? { endpoint: config.endpoint } : {}),
    forcePathStyle: config.forcePathStyle,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    /**
     * Đừng ký một checksum mô tả THÂN RỖNG vào URL dành cho một tệp chưa tồn tại.
     *
     * Từ bản ~3.729 SDK mặc định tính CRC32 cho lệnh ghi. Gửi thẳng từ server thì đúng — nó có sẵn
     * nội dung. Ký sẵn thì không: lúc ký chưa có byte nào, nên thứ chui vào chữ ký là
     * `x-amz-checksum-crc32=AAAAAA==`, tức CRC32 của chuỗi rỗng, gắn lên một URL sẽ dùng để tải
     * một tệp vài trăm KB.
     *
     * ĐÃ ĐO trên R2: nó BỎ QUA tham số này, PUT vẫn trả 200. Nên đây không phải thứ đang chặn ai
     * cả, và chỗ này không được nói rằng nó là — nhưng một kho khác thì đối xử khác, và AWS S3
     * kiểm khi thấy header/tham số checksum. Cùng một mã nguồn phải chạy được trên MinIO, Garage,
     * B2, Wasabi, AWS: một lời khai sai về nội dung, nằm sẵn trong chữ ký, là thứ chỉ lộ ra ở kho
     * của người khác chứ không lộ ở đây.
     *
     * `WHEN_REQUIRED` = chỉ tính khi chính lệnh đó bắt buộc.
     */
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })
  const { bucket, defaultTtl, publicBase } = config

  return {
    async putObject(input: PutObjectInput) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType,
          CacheControl: input.cacheControl,
        }),
      )
      return { key: input.key }
    },
    async createSignedUploadUrl(input: SignedUrlInput) {
      const url = await getSignedUrl(
        client,
        new PutObjectCommand({ Bucket: bucket, Key: input.key, ContentType: input.contentType }),
        { expiresIn: input.expiresInSeconds ?? defaultTtl },
      )
      return { url, key: input.key }
    },
    async createSignedDownloadUrl(input: SignedUrlInput) {
      const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: input.key }), {
        expiresIn: input.expiresInSeconds ?? defaultTtl,
      })
      return { url }
    },
    async deleteObject(key: string) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    },
    getPublicUrl(key: string) {
      return publicBase !== undefined ? `${publicBase}/${key}` : null
    },
  }
}

export const s3Adapter: ProviderAdapter<StoragePort> = {
  key: 's3',
  requiredEnv: ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'],
  create: () => makePort(resolveS3Config()),
}

export const r2Adapter: ProviderAdapter<StoragePort> = {
  key: 'r2',
  requiredEnv: ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'],
  create: () => makePort(resolveR2Config()),
}
