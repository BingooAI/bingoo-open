import { cookies } from 'next/headers';
import { redirect } from '@/i18n/navigation';

/**
 * Server-side session for route gating (option B). The Next server reads the
 * same-origin session cookie and validates it against the API's get-session
 * (which hits the DB — no cookie cache — so revoked/expired sessions fail). This
 * is a real server-side gate (no content leak, no-JS safe), but the ultimate AAA
 * boundary is still the API: every data call is re-checked there.
 */
const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface ServerSession {
  user: {
    id: string;
    name: string;
    email: string | null;
    image?: string | null;
    role?: string | null;
    accountType?: string | null;
    publicId?: string;
  };
  session: { id: string };
}

/** Resolve + validate the current session; null when unauthenticated. Never throws. */
export async function getServerSession(): Promise<ServerSession | null> {
  const cookie = (await cookies()).toString();
  if (!cookie) return null;
  try {
    const res = await fetch(`${API_URL}/api/auth/get-session`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ServerSession | null;
    return data?.user ? data : null;
  } catch {
    return null;
  }
}

/** Gate a server layout/page: return the session or redirect to /login. */
export async function requireSession(locale: string): Promise<ServerSession> {
  const session = await getServerSession();
  if (!session) {
    redirect({ href: '/login', locale });
  }
  // redirect() has thrown when session is null; the cast reflects that invariant.
  return session as ServerSession;
}
