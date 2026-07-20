import { AccessToken, RoomServiceClient } from 'livekit-server-sdk'
import { readEnv, requireEnv } from '../../core/config'
import type { ProviderAdapter } from '../../core/registry'
import type { AccessTokenInput, CreateRoomInput, RealtimePort } from '../port'

const REQUIRED = ['LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'LIVEKIT_URL'] as const

export const livekitAdapter: ProviderAdapter<RealtimePort> = {
  key: 'livekit',
  requiredEnv: REQUIRED,
  create(): RealtimePort {
    const env = requireEnv('realtime', 'livekit', REQUIRED)
    const url = env.LIVEKIT_URL
    // RoomService is an HTTP API; the ws(s) client URL maps to http(s).
    const httpUrl = url.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://')
    const defaultTtl = Number(readEnv('LIVEKIT_TOKEN_TTL')) || 3600
    const svc = new RoomServiceClient(httpUrl, env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET)

    return {
      async createAccessToken(input: AccessTokenInput) {
        const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
          identity: input.identity,
          name: input.name,
          ttl: input.ttlSeconds ?? defaultTtl,
          metadata: input.metadata,
        })
        at.addGrant({
          roomJoin: true,
          room: input.roomName,
          canPublish: input.canPublish ?? true,
          canSubscribe: input.canSubscribe ?? true,
          canPublishData: input.canPublishData ?? true,
        })
        const token = await at.toJwt()
        return { token, url, identity: input.identity, roomName: input.roomName }
      },
      async createRoom(input: CreateRoomInput) {
        const room = await svc.createRoom({
          name: input.name,
          emptyTimeout: input.emptyTimeoutSeconds,
          maxParticipants: input.maxParticipants,
          metadata: input.metadata,
        })
        return { name: room.name, sid: room.sid }
      },
      async deleteRoom(name: string) {
        await svc.deleteRoom(name)
      },
    }
  },
}
