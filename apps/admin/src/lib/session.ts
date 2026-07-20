import { cookies } from 'next/headers';
import { redirect } from '@/i18n/navigation';
import { isStaff } from './roles';

/**
 * Server-side session for route gating. The Next server reads the same-origin
 * session cookie and validates it against the API's get-session (which hits the
 * DB — no cookie cache — so revoked/expired sessions fail). This is a real
 * server-side gate (no content leak, no-JS safe), but the ultimate AAA boundary
 * is still the API: every media/prompt call is re-checked + RBAC-enforced there.
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

/**
 * Gate an admin layout/page: return the session for a STAFF user, else redirect.
 *  - unauthenticated  → /login
 *  - authenticated but not staff → /login?denied=1 (a non-staff account can't
 *    see the admin app; the login screen explains why)
 * The API still independently enforces per-resource RBAC on every data call.
 */
export async function requireStaff(locale: string): Promise<ServerSession> {
  const session = await getServerSession();
  if (!session) {
    redirect({ href: '/login', locale });
  }
  if (!isStaff(session!.user.role)) {
    redirect({ href: { pathname: '/login', query: { denied: '1' } }, locale });
  }
  // redirect() throws on both branches above; the cast reflects that invariant.
  return session as ServerSession;
}
