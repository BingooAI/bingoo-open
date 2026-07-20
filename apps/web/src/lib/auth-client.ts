import { createAuthClient } from 'better-auth/react';

/**
 * Better Auth browser client. Calls are SAME-ORIGIN: Next proxies /api/auth/* to
 * the API (see next.config `rewrites`), so the session cookie is set on this
 * origin and the Next server can read + validate it for route gating. No secrets
 * here (R1) — the API stays the real AAA boundary; this is the UX/session layer.
 * With no baseURL, the client targets the current origin.
 */
export const authClient = createAuthClient({
  fetchOptions: { credentials: 'include' },
});

export const {
  signIn,
  signUp,
  signOut,
  requestPasswordReset,
  resetPassword,
  useSession,
  listSessions,
  revokeSession,
  revokeOtherSessions,
} = authClient;
