export type PackageType = 'room_only' | 'with_breakfast' | 'full_package'

export interface StayPackage {
  type: PackageType
  label: string
  addOnPerNight: number
  description: string
  inclusions: Array<string>
}

export const PACKAGES: Array<StayPackage> = [
  {
    type: 'room_only',
    label: 'Room Only',
    addOnPerNight: 0,
    description: 'Just the essentials for a comfortable stay.',
    inclusions: ['Room accommodation', 'WiFi', 'TV', 'Daily housekeeping'],
  },
  {
    type: 'with_breakfast',
    label: 'With Breakfast',
    addOnPerNight: 1500,
    description: 'Start every morning right with a full breakfast included.',
    inclusions: [
      'Room accommodation',
      'WiFi',
      'TV',
      'Daily housekeeping',
      'Daily breakfast buffet',
    ],
  },
  {
    type: 'full_package',
    label: 'Full Package',
    addOnPerNight: 4000,
    description: 'Everything you need for a complete hotel experience.',
    inclusions: [
      'Room accommodation',
      'WiFi',
      'TV',
      'Daily housekeeping',
      'Daily breakfast buffet',
      'Swimming pool access',
      'Spa access',
      'Gym access',
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

export function getPackageLabel(type: PackageType): string {
  return PACKAGE_BY_TYPE[type].label
}

export function getPackageLabelOrDefault(
  type: PackageType | undefined,
  fallback = 'Not specified',
): string {
  if (!type) return fallback
  return getPackageLabel(type)
}

export function formatPackageAddOn(addOnPerNight: number): string {
  if (addOnPerNight <= 0) return 'Included'
  return `+$${(addOnPerNight / 100).toFixed(0)}/night`
}
