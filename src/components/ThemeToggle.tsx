import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../lib/theme'

interface ThemeToggleProps {
  compact?: boolean
  className?: string
}

export function ThemeToggle({ compact = false, className = '' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const toneClasses = isDark
    ? 'border-slate-700 bg-slate-800/80 text-slate-200 hover:border-amber-500/50 hover:bg-slate-700/85 hover:text-amber-300 hover:shadow-lg hover:shadow-amber-500/20'
    : 'border-slate-300 bg-white/95 text-slate-700 hover:-translate-y-px hover:border-amber-500/70 hover:bg-amber-50 hover:text-amber-700 hover:shadow-lg hover:shadow-amber-500/35'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-amber-500/40 ${toneClasses} ${compact ? 'h-9 min-w-9' : 'h-10'} ${className}`}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {!compact && (
        <span className="text-sm font-medium">
          {isDark ? 'Light mode' : 'Dark mode'}
        </span>
      )}
    </button>
  )
}
