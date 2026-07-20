import { requireEnv } from '../../core/config'
import { ProviderError } from '../../core/errors'
import type { ProviderAdapter } from '../../core/registry'
import type { CreateVideoInput, VideoPlaybackInfo, VideoPort } from '../port'

// Bunny Stream REST API (https://docs.bunny.net/reference/video_*). No SDK — the
// surface is small enough to hit directly with fetch.
const REQUIRED = ['BUNNY_STREAM_API_KEY', 'BUNNY_STREAM_LIBRARY_ID', 'BUNNY_STREAM_CDN_HOSTNAME'] as const

export const bunnyAdapter: ProviderAdapter<VideoPort> = {
  key: 'bunny',
  requiredEnv: REQUIRED,
  create(): VideoPort {
    const env = requireEnv('video', 'bunny', REQUIRED)
    const apiKey = env.BUNNY_STREAM_API_KEY
    const base = `https://video.bunnycdn.com/library/${env.BUNNY_STREAM_LIBRARY_ID}/videos`
    const cdn = env.BUNNY_STREAM_CDN_HOSTNAME.replace(/^https?:\/\//, '').replace(/\/$/, '')
    const jsonHeaders = {
      AccessKey: apiKey,
      'content-type': 'application/json',
      accept: 'application/json',
    }

    async function call(url: string, init: RequestInit): Promise<Response> {
      const res = await fetch(url, init)
      if (!res.ok) throw new ProviderError('video', 'bunny', `${res.status} ${await res.text()}`)
      return res
    }

    return {
      async createVideo(input: CreateVideoInput) {
        const res = await call(base, {
          method: 'POST',
          headers: jsonHeaders,
          body: JSON.stringify({ title: input.title, collectionId: input.collectionId }),
        })
        const json = (await res.json()) as { guid: string }
        return { videoId: json.guid }
      },
      getUploadTarget(videoId: string) {
        // Client/server PUTs the raw file bytes to this URL with the AccessKey header.
        return { url: `${base}/${videoId}`, headers: { AccessKey: apiKey } }
      },
      async getPlaybackInfo(videoId: string): Promise<VideoPlaybackInfo> {
        const res = await call(`${base}/${videoId}`, { method: 'GET', headers: jsonHeaders })
        const json = (await res.json()) as { status: number }
        return {
          videoId,
          hlsUrl: `https://${cdn}/${videoId}/playlist.m3u8`,
          thumbnailUrl: `https://${cdn}/${videoId}/thumbnail.jpg`,
          status: String(json.status),
        }
      },
      async deleteVideo(videoId: string) {
        await call(`${base}/${videoId}`, { method: 'DELETE', headers: { AccessKey: apiKey } })
      },
    }
  },
}
