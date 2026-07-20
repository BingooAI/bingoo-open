/**
 * Payment gateway capability — vendor-agnostic. Covers both bank-transfer/QR
 * flows (VietQR today) and hosted-checkout flows (Stripe later, via checkoutUrl).
 * Money-facing: webhook auth is mandatory and reconciliation must be idempotent
 * (enforced in the payment service layer).
 */
export interface CreateChargeInput {
  /** Amount in the smallest indivisible unit the currency uses (VND: whole đồng). */
  amount: number;
  /** Your order/user reference to correlate the payment. */
  orderRef?: string;
  description?: string;
  expiresInSeconds?: number;
}

export interface Charge {
  /** Unique code embedded in the transfer content, used to match the payment. */
  reference: string;
  amount: number;
  /** EMV QR payload for client-side rendering (bank-transfer gateways). */
  qrString?: string;
  /** Ready-to-use QR image URL. */
  qrImageUrl?: string;
  /** Hosted-checkout URL (card gateways like Stripe). */
  checkoutUrl?: string;
  expiresAt?: string;
}

/** A normalized inbound payment event, parsed from a gateway/relay webhook. */
export interface IncomingTransaction {
  amount: number;
  /** Reference extracted from the transfer content; '' when none was found. */
  reference: string;
  /** Gateway/relay transaction id, if provided (used for idempotency). */
  txId?: string;
  rawContent?: string;
  paidAt?: string;
}

export interface WebhookInput {
  rawBody: string;
  headers: Record<string, string>;
}

export interface PaymentGatewayPort {
  createCharge(input: CreateChargeInput): Promise<Charge>;
  /** Authenticate + parse an inbound webhook. Throws on bad auth / malformed body. */
  verifyWebhook(input: WebhookInput): IncomingTransaction;
}
