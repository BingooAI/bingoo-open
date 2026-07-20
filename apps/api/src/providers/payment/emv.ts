/**
 * EMVCo Merchant-Presented QR builder for VietQR (NAPAS 24/7 account transfer).
 * Pure functions — exported for unit testing (CRC has a known test vector).
 */
function tlv(id: string, value: string): string {
  return `${id}${value.length.toString().padStart(2, '0')}${value}`;
}

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), 4 upper-hex chars. */
export function crc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export interface VietQrInput {
  bin: string;
  accountNo: string;
  amount: number;
  content: string;
}

/** Build a dynamic (amount-carrying) VietQR EMV payload for an account transfer. */
export function buildVietQrString(input: VietQrInput): string {
  const merchant =
    tlv('00', 'A000000727') + // NAPAS GUID
    tlv('01', tlv('00', input.bin) + tlv('01', input.accountNo)) + // bank BIN + account
    tlv('02', 'QRIBFTTA'); // service: transfer to account
  const payload =
    tlv('00', '01') + // payload format indicator
    tlv('01', '12') + // dynamic (amount present)
    tlv('38', merchant) +
    tlv('53', '704') + // currency VND
    tlv('54', String(input.amount)) +
    tlv('58', 'VN') +
    tlv('62', tlv('08', input.content)); // additional data → purpose/content
  const withCrcTag = `${payload}6304`;
  return withCrcTag + crc16(withCrcTag);
}
