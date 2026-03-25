// Shared types/constants for select-location filtering and sort behavior.
export type SortOption = 'name' | 'rating' | 'distance'

export function normalizeSortOption(value: unknown): SortOption {
  return value === 'rating' || value === 'distance' ? value : 'name'
}

export function normalizeFilterValue(value: unknown): string {
  return typeof value === 'string' && value.length > 0 ? value : 'all'
}

export function normalizeSearchTerm(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

// Category badge styles used by hotel cards.
export const categoryColors: Record<string, string> = {
  Boutique: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  Budget: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  Luxury: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'Resort and Spa': 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  'Extended-Stay': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  Suite: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
}
