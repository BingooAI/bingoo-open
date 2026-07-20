/** Video hosting / streaming capability (upload → transcode → HLS playback). */
export interface CreateVideoInput {
  title: string;
  collectionId?: string;
}

export interface CreateVideoResult {
  videoId: string;
}

export interface VideoUploadTarget {
  /** URL the client/server uploads the raw file to (PUT). */
  url: string;
  headers: Record<string, string>;
}

export interface VideoPlaybackInfo {
  videoId: string;
  hlsUrl: string;
  thumbnailUrl: string;
  status: string;
}

export interface VideoPort {
  createVideo(input: CreateVideoInput): Promise<CreateVideoResult>;
  getUploadTarget(videoId: string): VideoUploadTarget;
  getPlaybackInfo(videoId: string): Promise<VideoPlaybackInfo>;
  deleteVideo(videoId: string): Promise<void>;
}
