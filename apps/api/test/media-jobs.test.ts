/**
 * Registry job sinh media — logic thuần in-memory: start → running, done MANG result, error MANG
 * message, cancel abort signal thật → cancelled. Chạy offline (không provider, không I/O).
 */

import { describe, expect, it } from 'vitest'
import { cancelMediaJob, getMediaJob, startMediaJob } from '../src/services/media-jobs'

/** Chờ mọi microtask đã xếp hàng chạy xong (fn của job không được await trong start). */
const flush = () => new Promise<void>((r) => setTimeout(r, 0))

describe('media-jobs', () => {
  it('start → running ngay, chưa có result', () => {
    const job = startMediaJob('image', 'job-run', () => new Promise(() => {}))
    expect(job.state).toBe('running')
    expect(job.kind).toBe('image')
    expect(job.id).toBe('job-run')
    expect(job.etaMs).toBeGreaterThan(0)
    expect(job.result).toBeUndefined()
    cancelMediaJob('job-run') // dọn (promise không bao giờ resolve)
  })

  it('fn resolve → done + MANG result đã trả', async () => {
    startMediaJob('audio', 'job-done', () => Promise.resolve({ ok: 1 }))
    await flush()
    const j = getMediaJob('job-done')
    expect(j?.state).toBe('done')
    expect(j?.result).toEqual({ ok: 1 })
    expect(j?.finishedAt).toBeGreaterThan(0)
  })

  it('fn reject → error + MANG message người đọc được', async () => {
    startMediaJob('image', 'job-err', () => Promise.reject(new Error('provider 429')))
    await flush()
    const j = getMediaJob('job-err')
    expect(j?.state).toBe('error')
    expect(j?.error).toBe('provider 429')
  })

  it('cancel → abort signal thật → cancelled, KHÔNG phải error', async () => {
    let seen: AbortSignal | undefined
    startMediaJob(
      'image',
      'job-cancel',
      (signal) =>
        new Promise((_res, rej) => {
          seen = signal
          signal.addEventListener('abort', () => rej(new DOMException('Aborted', 'AbortError')))
        }),
    )
    // abort() phát tín hiệu NGAY (đồng bộ); state chuyển 'cancelled' ở microtask .catch sau đó.
    expect(cancelMediaJob('job-cancel')).toBeDefined()
    expect(seen?.aborted).toBe(true)
    await flush()
    const j = getMediaJob('job-cancel')
    expect(j?.state).toBe('cancelled')
    expect(j?.error).toBeUndefined()
  })

  it('id lạ → undefined (get) / undefined (cancel)', () => {
    expect(getMediaJob('nope')).toBeUndefined()
    expect(cancelMediaJob('nope')).toBeUndefined()
  })
})
