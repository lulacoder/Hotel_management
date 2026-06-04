import { cn } from '../lib/utils'
import { useI18n } from '../lib/i18n/provider'
import { Button } from './ui/button'

interface LanguageSwitcherProps {
  compact?: boolean
  className?: string
}

export function LanguageSwitcher({
  compact = false,
  className = '',
}: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n()

  return (
    <fieldset
      className={cn(
        'inline-flex items-center rounded-xl border border-border bg-card/80 p-1 shadow-sm backdrop-blur-sm',
        className,
      )}
    >
      <legend className="sr-only">{t('language.switcherLabel')}</legend>
      <Button
        onClick={() => setLocale('en')}
        variant={locale === 'en' ? 'secondary' : 'ghost'}
        size="xs"
        className={`rounded-lg px-2.5 ${
          locale === 'en'
            ? 'bg-white text-slate-900 hover:bg-white'
            : 'text-muted-foreground hover:bg-transparent hover:text-foreground'
        }`}
      >
        EN
      </Button>
      <Button
        onClick={() => setLocale('am')}
        variant={locale === 'am' ? 'secondary' : 'ghost'}
        size="xs"
        className={`rounded-lg px-2.5 ${
          locale === 'am'
            ? 'bg-white text-slate-900 hover:bg-white'
            : 'text-muted-foreground hover:bg-transparent hover:text-foreground'
        } ${compact ? '' : 'min-w-[2.5rem]'}`}
      >
        አማ
      </Button>
    </fieldset>
  )
}
