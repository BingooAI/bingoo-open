/** Lightweight, dependency-free validators for demo forms. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function minLength(value: string, min: number): boolean {
  return value.trim().length >= min;
}
