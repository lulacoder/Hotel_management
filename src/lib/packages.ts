import type { TranslationKey } from './i18n'

export type PackageType = 'room_only' | 'with_breakfast' | 'full_package'

export interface StayPackage {
  type: PackageType
  addOnPerNight: number
  labelKey: TranslationKey
  descriptionKey: TranslationKey
  inclusionKeys: Array<TranslationKey>
}

export const PACKAGES: Array<StayPackage> = [
  {
    type: 'room_only',
    addOnPerNight: 0,
    labelKey: 'package.roomOnly.label',
    descriptionKey: 'package.roomOnly.description',
    inclusionKeys: [
      'package.inclusion.roomAccommodation',
      'package.inclusion.wifi',
      'package.inclusion.tv',
      'package.inclusion.dailyHousekeeping',
    ],
  },
  {
    type: 'with_breakfast',
    addOnPerNight: 1500,
    labelKey: 'package.withBreakfast.label',
    descriptionKey: 'package.withBreakfast.description',
    inclusionKeys: [
      'package.inclusion.roomAccommodation',
      'package.inclusion.wifi',
      'package.inclusion.tv',
      'package.inclusion.dailyHousekeeping',
      'package.inclusion.dailyBreakfastBuffet',
    ],
  },
  {
    type: 'full_package',
    addOnPerNight: 4000,
    labelKey: 'package.fullPackage.label',
    descriptionKey: 'package.fullPackage.description',
    inclusionKeys: [
      'package.inclusion.roomAccommodation',
      'package.inclusion.wifi',
      'package.inclusion.tv',
      'package.inclusion.dailyHousekeeping',
      'package.inclusion.dailyBreakfastBuffet',
      'package.inclusion.swimmingPoolAccess',
      'package.inclusion.spaAccess',
      'package.inclusion.gymAccess',
    ],
  },
]

export const PACKAGE_BY_TYPE: Record<PackageType, StayPackage> = {
  room_only: PACKAGES[0],
  with_breakfast: PACKAGES[1],
  full_package: PACKAGES[2],
}

export function getPackageByType(type: PackageType): StayPackage {
  return PACKAGE_BY_TYPE[type]
}

type TranslateFn = (key: TranslationKey) => string

export function getPackageLabel(type: PackageType, t: TranslateFn): string {
  return t(PACKAGE_BY_TYPE[type].labelKey)
}

export function getPackageDescription(
  type: PackageType,
  t: TranslateFn,
): string {
  return t(PACKAGE_BY_TYPE[type].descriptionKey)
}

export function getPackageInclusions(
  type: PackageType,
  t: TranslateFn,
): string[] {
  return PACKAGE_BY_TYPE[type].inclusionKeys.map((key) => t(key))
}

export function getPackageLabelOrDefault(
  type: PackageType | undefined,
  t: TranslateFn,
  fallback = 'package.notSpecified' as TranslationKey,
): string {
  if (!type) return t(fallback)
  return getPackageLabel(type, t)
}

export function formatPackageAddOn(
  addOnPerNight: number,
  t: TranslateFn,
): string {
  if (addOnPerNight <= 0) return t('package.included')
  return `+$${(addOnPerNight / 100).toFixed(0)}/${t('hotel.night')}`
}
