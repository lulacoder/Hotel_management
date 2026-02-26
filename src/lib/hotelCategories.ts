import type { TranslationKey } from './i18n'

const HOTEL_CATEGORY_LABEL_KEYS: Record<string, TranslationKey> = {
  Boutique: 'hotel.category.boutique',
  Budget: 'hotel.category.budget',
  Luxury: 'hotel.category.luxury',
  'Resort and Spa': 'hotel.category.resortSpa',
  'Extended-Stay': 'hotel.category.extendedStay',
  Suite: 'hotel.category.suite',
}

type TranslateFn = (key: TranslationKey) => string

export function getHotelCategoryLabel(
  category: string | undefined,
  t: TranslateFn,
): string {
  if (!category) return ''
  const key = HOTEL_CATEGORY_LABEL_KEYS[category]
  return key ? t(key) : category
}
