import en from '../messages/en.json';
import vi from '../messages/vi.json';
import type { Locale } from './config';

export * from './config';

/** Message catalog keyed by locale. The web request-config picks `messages[locale]`. */
export const messages = { vi, en } as const satisfies Record<Locale, unknown>;

/** Shape of a message bundle (derived from the default locale) — for typed `useTranslations`. */
export type Messages = typeof vi;
