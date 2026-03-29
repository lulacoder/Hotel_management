import { enMessages } from './messages.en'
import type { LocaleMessages, TranslationKey } from './messages.en'

/**
 * Key used for storing the user's preferred locale in localStorage.
 */
export const LOCALE_STORAGE_KEY = 'hotel.locale'

/**
 * List of supported locales in the application.
 */
export const locales = ['en', 'am'] as const

/**
 * Type representing one of the supported locales.
 */
export type Locale = (typeof locales)[number]

export { enMessages }
export type { LocaleMessages, TranslationKey }

/**
 * Loads only the requested locale dictionary.
 */
export async function loadLocaleMessages(
  locale: Locale,
): Promise<LocaleMessages> {
  if (locale === 'en') {
    return enMessages
  }

  const { amMessages } = await import('./messages.am')
  return amMessages
}
