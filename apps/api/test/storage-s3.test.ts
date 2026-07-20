// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { afterEach, describe, expect, it } from 'vitest'
import { resolveR2Config, resolveS3Config } from '../src/providers/storage/adapters/s3'

/**
 * The S3 client itself is not worth testing — it is someone else's, and testing it would mean
 * standing up a store. What is worth testing is the configuration in front of it, because every
 * mistake there produces the same symptom: a 404 that looks like a missing object rather than a
 * misconfigured endpoint. That is an expensive hour for whoever hits it.
 */

const KEYS = [
  'S3_ENDPOINT',
  'S3_REGION',
  'S3_BUCKET',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'S3_FORCE_PATH_STYLE',
  'S3_PUBLIC_BASE_URL',
  'S3_SIGNED_URL_TTL',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'R2_PUBLIC_BASE_URL',
  'R2_SIGNED_URL_TTL',
]

afterEach(() => {
  for (const k of KEYS) delete process.env[k]
})

function minio(): void {
  process.env.S3_ENDPOINT = 'http://localhost:9000'
  process.env.S3_BUCKET = 'bingoo'
  process.env.S3_ACCESS_KEY_ID = 'minioadmin'
  process.env.S3_SECRET_ACCESS_KEY = 'minioadmin'
}

describe('S3 configuration', () => {
  it('serves a self-hosted store from the path, because MinIO and Garage require it', () => {
    minio()
    expect(resolveS3Config().forcePathStyle).toBe(true)
  })

  it('serves AWS from the hostname, because there is no custom endpoint to imply otherwise', () => {
    process.env.S3_BUCKET = 'bingoo'
    process.env.S3_ACCESS_KEY_ID = 'k'
    process.env.S3_SECRET_ACCESS_KEY = 's'
    process.env.S3_REGION = 'ap-southeast-1'
    const c = resolveS3Config()
    expect(c.endpoint).toBeUndefined()
    expect(c.forcePathStyle).toBe(false)
    expect(c.region).toBe('ap-southeast-1')
  })

  it('lets the operator overrule the path-style guess in either direction', () => {
    minio()
    process.env.S3_FORCE_PATH_STYLE = 'false'
    expect(resolveS3Config().forcePathStyle).toBe(false)
  })

  it('refuses to start without a bucket or credentials, naming what is missing', () => {
    process.env.S3_ENDPOINT = 'http://localhost:9000'
    expect(() => resolveS3Config()).toThrow(/S3_BUCKET/)
  })

  it('defaults the region to auto, which every S3-compatible store accepts', () => {
    minio()
    expect(resolveS3Config().region).toBe('auto')
  })
})

describe('public base URL', () => {
  it('accepts a bare host and adds a scheme', () => {
    minio()
    process.env.S3_PUBLIC_BASE_URL = 'files.example.org'
    expect(resolveS3Config().publicBase).toBe('https://files.example.org')
  })

  it('keeps http for a local store rather than forcing https onto it', () => {
    minio()
    process.env.S3_PUBLIC_BASE_URL = 'http://localhost:9000/bingoo'
    expect(resolveS3Config().publicBase).toBe('http://localhost:9000/bingoo')
  })

  it('strips trailing slashes, so joining a key never doubles them', () => {
    minio()
    process.env.S3_PUBLIC_BASE_URL = 'https://files.example.org///'
    expect(resolveS3Config().publicBase).toBe('https://files.example.org')
  })

  it('is undefined when unset — the port reports no public URL rather than a broken one', () => {
    minio()
    expect(resolveS3Config().publicBase).toBeUndefined()
  })
})

describe('signed URL lifetime', () => {
  it('falls back to fifteen minutes when unset or nonsense', () => {
    minio()
    expect(resolveS3Config().defaultTtl).toBe(900)
    process.env.S3_SIGNED_URL_TTL = 'soon'
    expect(resolveS3Config().defaultTtl).toBe(900)
    process.env.S3_SIGNED_URL_TTL = '-5'
    expect(resolveS3Config().defaultTtl).toBe(900)
  })

  it('honours a sensible value', () => {
    minio()
    process.env.S3_SIGNED_URL_TTL = '3600'
    expect(resolveS3Config().defaultTtl).toBe(3600)
  })
})

describe('R2 keeps working exactly as before', () => {
  it('derives the endpoint from the account id and pins region auto', () => {
    process.env.R2_ACCOUNT_ID = 'abc123'
    process.env.R2_ACCESS_KEY_ID = 'k'
    process.env.R2_SECRET_ACCESS_KEY = 's'
    process.env.R2_BUCKET = 'bingoo'
    const c = resolveR2Config()
    expect(c.endpoint).toBe('https://abc123.r2.cloudflarestorage.com')
    expect(c.region).toBe('auto')
    expect(c.forcePathStyle).toBe(false)
    expect(c.bucket).toBe('bingoo')
  })

  it('still reports which R2 variable is missing', () => {
    process.env.R2_ACCOUNT_ID = 'abc123'
    expect(() => resolveR2Config()).toThrow(/R2_BUCKET/)
  })
})
