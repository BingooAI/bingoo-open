/** Realtime audio/video rooms capability (WebRTC via LiveKit or similar). */
export interface AccessTokenInput {
  identity: string;
  roomName: string;
  name?: string;
  canPublish?: boolean;
  canSubscribe?: boolean;
  canPublishData?: boolean;
  ttlSeconds?: number;
  metadata?: string;
}

export interface AccessTokenResult {
  token: string;
  /** The realtime server URL the client connects to. */
  url: string;
  identity: string;
  roomName: string;
}

export interface CreateRoomInput {
  name: string;
  emptyTimeoutSeconds?: number;
  maxParticipants?: number;
  metadata?: string;
}

export interface RoomInfo {
  name: string;
  sid?: string;
}

export interface RealtimePort {
  createAccessToken(input: AccessTokenInput): Promise<AccessTokenResult>;
  createRoom(input: CreateRoomInput): Promise<RoomInfo>;
  deleteRoom(name: string): Promise<void>;
}
