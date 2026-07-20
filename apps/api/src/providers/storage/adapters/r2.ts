import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { readEnv, requireEnv } from '../../core/config';
import type { ProviderAdapter } from '../../core/registry';
import type { PutObjectInput, SignedUrlInput, StoragePort } from '../port';

// Cloudflare R2 is S3-compatible; only the endpoint + `region: "auto"` differ.
const REQUIRED = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
] as const;

export const r2Adapter: ProviderAdapter<StoragePort> = {
  key: 'r2',
  requiredEnv: REQUIRED,
  create(): StoragePort {
    const env = requireEnv('storage', 'r2', REQUIRED);
    const bucket = env.R2_BUCKET;
    // Normalize the public base: accept a bare host (storage.bingoo.ai) or a full
    // URL, always yield an https:// origin with no trailing slash.
    const publicBaseRaw = readEnv('R2_PUBLIC_BASE_URL');
    const publicBase = publicBaseRaw
      ? (/^https?:\/\//.test(publicBaseRaw) ? publicBaseRaw : `https://${publicBaseRaw}`).replace(
          /\/$/,
          '',
        )
      : undefined;
    const defaultTtl = Number(readEnv('R2_SIGNED_URL_TTL')) || 900;
    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });

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
        );
        return { key: input.key };
      },
      async createSignedUploadUrl(input: SignedUrlInput) {
        const url = await getSignedUrl(
          client,
          new PutObjectCommand({ Bucket: bucket, Key: input.key, ContentType: input.contentType }),
          { expiresIn: input.expiresInSeconds ?? defaultTtl },
        );
        return { url, key: input.key };
      },
      async createSignedDownloadUrl(input: SignedUrlInput) {
        const url = await getSignedUrl(
          client,
          new GetObjectCommand({ Bucket: bucket, Key: input.key }),
          {
            expiresIn: input.expiresInSeconds ?? defaultTtl,
          },
        );
        return { url };
      },
      async deleteObject(key: string) {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      },
      getPublicUrl(key: string) {
        return publicBase ? `${publicBase}/${key}` : null;
      },
    };
  },
};
