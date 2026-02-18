import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type Theme = 'dark' | 'light'

export const THEME_STORAGE_KEY = 'hotel-theme'

const VALID_THEMES: Array<Theme> = ['dark', 'light']

function isTheme(value: string | null): value is Theme {
  return value !== null && VALID_THEMES.includes(value as Theme)
}

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'dark'
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  return isTheme(storedTheme) ? storedTheme : 'dark'
}

export function applyThemeToDocument(theme: Theme) {
  if (typeof document === 'undefined') {
    return
  }

  const root = document.documentElement
  root.dataset.theme = theme
  root.classList.remove('theme-dark', 'theme-light')
  root.classList.add(`theme-${theme}`)
}

export const themeBootstrapScript = `
(() => {
  const STORAGE_KEY = '${THEME_STORAGE_KEY}';
  const rawValue = window.localStorage.getItem(STORAGE_KEY);
  const theme = rawValue === 'light' || rawValue === 'dark' ? rawValue : 'dark';
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.remove('theme-dark', 'theme-light');
  root.classList.add('theme-' + theme);
})();
`

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')

  useEffect(() => {
    const nextTheme = getStoredTheme()
    setThemeState(nextTheme)
    applyThemeToDocument(nextTheme)
  }, [])

  const setTheme = (nextTheme: Theme) => {
    setThemeState(nextTheme)
    applyThemeToDocument(nextTheme)

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
    }
  }

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }

  return context
}
