import { useI18n } from '../lib/i18n'

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
    <div
      className={`inline-flex items-center rounded-xl border border-slate-700 bg-slate-800/70 p-1 ${className}`}
      role="group"
      aria-label={t('language.switcherLabel')}
    >
      <button
        type="button"
        onClick={() => setLocale('en')}
        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
          locale === 'en'
            ? 'bg-white text-slate-900'
            : 'text-slate-300 hover:text-white'
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLocale('am')}
        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
          locale === 'am'
            ? 'bg-white text-slate-900'
            : 'text-slate-300 hover:text-white'
        } ${compact ? '' : 'min-w-[2.5rem]'}`}
      >
        አማ
      </button>
    </div>
  )
}
