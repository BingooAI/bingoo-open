// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/** Object storage capability (files, media). Vendor-agnostic. */
export interface PutObjectInput {
  key: string
  body: Uint8Array | Buffer | string
  contentType?: string
  cacheControl?: string
}

export interface SignedUrlInput {
  key: string
  expiresInSeconds?: number
  /** For upload URLs: the Content-Type the client will send. */
  contentType?: string
}

export interface StoragePort {
  /** Upload bytes directly from the server. */
  putObject(input: PutObjectInput): Promise<{ key: string }>
  /** Presigned URL the client can PUT to (direct-to-storage upload). */
  createSignedUploadUrl(input: SignedUrlInput): Promise<{ url: string; key: string }>
  /** Presigned URL to GET a private object. */
  createSignedDownloadUrl(input: SignedUrlInput): Promise<{ url: string }>
  deleteObject(key: string): Promise<void>
  /** Stable public URL if the bucket is served from a public domain, else null. */
  getPublicUrl(key: string): string | null
}
