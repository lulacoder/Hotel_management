import { Moon, Sun } from 'lucide-react'
import { Button } from './ui/button'
import { useI18n } from '../lib/i18n'
import { useTheme } from '../lib/theme'

interface ThemeToggleProps {
  compact?: boolean
  className?: string
}

export function ThemeToggle({
  compact = false,
  className = '',
}: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()
  const { t } = useI18n()
  const isDark = theme === 'dark'

  return (
    <Button
      onClick={toggleTheme}
      aria-label={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
      title={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
      variant="outline"
      size={compact ? 'icon-sm' : 'sm'}
      className={`${
        isDark
          ? 'border-slate-700/80 bg-slate-800/80 text-slate-200 hover:border-violet-500/50 hover:bg-slate-700/85 hover:text-violet-300'
          : 'border-slate-300 bg-white/95 text-slate-700 hover:border-violet-500/70 hover:bg-violet-50 hover:text-violet-700'
      } ${!compact ? 'px-3.5' : ''} ${className}`}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {!compact && (
        <span className="text-sm font-medium">
          {isDark ? t('theme.lightMode') : t('theme.darkMode')}
        </span>
      )}
    </Button>
  )
}
