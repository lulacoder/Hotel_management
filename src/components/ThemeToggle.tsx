import { Moon, Sun } from 'lucide-react'
import { Button } from './ui/button'
import { useI18n } from '../lib/i18n/provider'
import { useTheme } from '../lib/theme'

interface ThemeToggleProps {
  compact?: boolean
  className?: string
  labelMode?: 'state' | 'control'
}

export function ThemeToggle({
  compact = false,
  className = '',
  labelMode = 'state',
}: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()
  const { t } = useI18n()
  const isDark = theme === 'dark'
  const showControlLabel = !compact && labelMode === 'control'
  const label = showControlLabel
    ? t('theme.label' as never)
    : isDark
      ? t('theme.lightMode')
      : t('theme.darkMode')

  return (
    <Button
      onClick={toggleTheme}
      aria-label={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
      title={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
      variant="outline"
      size={compact ? 'icon-sm' : 'sm'}
      className={`${
        showControlLabel
          ? isDark
            ? 'h-10 rounded-xl border-slate-700/80 bg-slate-800/80 px-3.5 text-slate-200 shadow-sm shadow-black/15 backdrop-blur-sm hover:border-violet-500/45 hover:bg-slate-700/85 hover:text-violet-200'
            : 'h-10 rounded-xl border-slate-300/95 bg-white/92 px-3.5 text-slate-700 shadow-sm shadow-slate-300/70 backdrop-blur-sm hover:border-violet-500/55 hover:bg-violet-50/90 hover:text-violet-700'
          : isDark
            ? 'border-slate-700/80 bg-slate-800/80 text-slate-200 hover:border-violet-500/50 hover:bg-slate-700/85 hover:text-violet-300'
            : 'border-slate-300 bg-white/95 text-slate-700 hover:border-violet-500/70 hover:bg-violet-50 hover:text-violet-700'
      } ${!compact ? 'px-3.5' : ''} ${className}`}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      {!compact && <span className="text-sm font-medium">{label}</span>}
    </Button>
  )
}
