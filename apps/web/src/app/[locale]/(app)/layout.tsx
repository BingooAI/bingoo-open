import { setRequestLocale } from 'next-intl/server';
import { AppShell } from '@/components/dashboard/app-shell';
import { requireSession } from '@/lib/session';

// Server-side gate (option B): unauthenticated users are redirected before any
// dashboard content renders. The API re-enforces AAA on every data call.
export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { user } = await requireSession(locale);

  return (
    <AppShell
      user={{
        name: user.name,
        email: user.email,
        role: user.role ?? null,
        image: user.image ?? null,
      }}
    >
      {children}
    </AppShell>
  );
}
