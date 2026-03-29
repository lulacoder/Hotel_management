/**
 * Internationalization (i18n) Provider and Hooks.
 * This file manages the language state, provides translation functions,
 * and synchronizes the selected locale with the browser.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  LOCALE_STORAGE_KEY,
  enMessages,
  locales,
  loadLocaleMessages,
  type LocaleMessages,
  type Locale,
  type TranslationKey,
} from './messages'

/**
 * The default language to use if no preference is found.
 */
const DEFAULT_LOCALE: Locale = 'en'

/**
 * Type guard to check if a value is a valid supported locale.
 */
function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && locales.includes(value as Locale)
}

/**
 * Replaces placeholders in a template string with actual values.
 * e.g., interpolate("Hello {name}", { name: "John" }) -> "Hello John"
 */
function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key]
    return value === undefined ? `{${key}}` : String(value)
  })
}

/**
 * Reads the initial locale from localStorage or defaults to English.
 * Safely handles server-side rendering (SSR) environments.
 */
function readInitialLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE
  const value = window.localStorage.getItem(LOCALE_STORAGE_KEY)
  return isLocale(value) ? value : DEFAULT_LOCALE
}

/**
 * A small script string to be injected into the HTML <head> to prevent FOUC
 * (Flash of Unstyled Content) by setting the correct doc lang before React hydrates.
 */
export const localeBootstrapScript = `(function(){try{var key='${LOCALE_STORAGE_KEY}';var value=window.localStorage.getItem(key);var locale=value==='am'?'am':'en';document.documentElement.lang=locale;}catch(e){document.documentElement.lang='en';}})();`

interface I18nContextValue {
  /** The current active locale (e.g., 'en', 'am') */
  locale: Locale
  /** Function to switch the application language */
  setLocale: (locale: Locale) => void
  /**
   * Main translation function.
   * Finds the string for the given key in the current locale.
   */
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

/**
 * Provider component that wraps the application to provide i18n context.
 * It handles persisting the locale to localStorage and updating the <html> tag lang attribute.
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readInitialLocale)
  const [activeMessages, setActiveMessages] =
    useState<LocaleMessages>(enMessages)

  // Sync locale changes to localStorage and DOM
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
    document.documentElement.lang = locale
  }, [locale])

  // Load only the active locale dictionary (English stays in the initial bundle).
  useEffect(() => {
    let isActive = true

    if (locale === 'en') {
      setActiveMessages(enMessages)
      return () => {
        isActive = false
      }
    }

    void loadLocaleMessages(locale)
      .then((messagesForLocale) => {
        if (isActive) {
          setActiveMessages(messagesForLocale)
        }
      })
      .catch(() => {
        if (isActive) {
          setActiveMessages(enMessages)
        }
      })

    return () => {
      isActive = false
    }
  }, [locale])

  /** Updates the state with a new locale */
  const setLocale = useCallback((value: Locale) => {
    setLocaleState(value)
  }, [])

  /**
   * Core translation logic.
   * Falls back to English if a key is missing in the current locale.
   */
  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => {
      const localized = activeMessages[key] ?? enMessages[key] ?? key
      return interpolate(localized, params)
    },
    [activeMessages],
  )

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/**
 * Hook to access the current i18n context.
 * Usage: const { t, locale, setLocale } = useI18n();
 */
export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return context
}
