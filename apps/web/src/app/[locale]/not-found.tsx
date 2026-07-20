import { useTranslations } from 'next-intl'
import { Mascot } from '@/components/brand/mascot'
import { buttonVariants } from '@bingoo.ai/ui-web'
import { Link } from '@/i18n/navigation'

export default function NotFound() {
  const t = useTranslations('notFound')
  return (
    <div className="grid min-h-dvh place-items-center bg-gradient-sky px-6 py-16 text-center">
      <div className="flex flex-col items-center">
        <Mascot emotion="confused" size={180} float alt="" />
        <p className="mt-6 font-display text-7xl font-bold text-primary">404</p>
        <h1 className="mt-2 font-display text-2xl font-bold text-foreground sm:text-3xl">{t('title')}</h1>
        <p className="mt-2 max-w-md text-foreground-muted">{t('subtitle')}</p>
        <Link href="/" className={buttonVariants({ variant: 'primary', size: 'lg' }) + ' mt-8'}>
          {t('cta')}
        </Link>
      </div>
    </div>
  )
}
