/**
 * Push notification capability (FCM today) — delivers to web + Android + iOS
 * device tokens. Vendor-agnostic; the service layer above resolves a user's
 * device tokens and moderates child-facing content (R5) before calling this.
 */
export interface NotificationMessage {
  title: string;
  body: string;
  imageUrl?: string;
  /** FCM data payload — values must be strings. */
  data?: Record<string, string>;
}

export interface SendToTokensResult {
  successCount: number;
  failureCount: number;
  /** Tokens the provider reported as unregistered/invalid — prune these from DB. */
  invalidTokens: string[];
}

export interface NotificationPort {
  sendToTokens(tokens: string[], message: NotificationMessage): Promise<SendToTokensResult>;
  sendToTopic(topic: string, message: NotificationMessage): Promise<{ messageId: string }>;
}
