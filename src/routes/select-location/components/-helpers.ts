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

// Category badge styles used by hotel cards. Solid, vibrant fills with crisp
// light text read clearly over both bright cover images and the dark
// placeholder, and stay saturated in light mode (these hues aren't remapped).
export const categoryColors: Record<string, string> = {
  Boutique: 'bg-violet-500 text-slate-50 border-violet-400/40',
  Budget: 'bg-emerald-500 text-slate-50 border-emerald-400/40',
  Luxury: 'bg-blue-500 text-slate-50 border-blue-400/40',
  'Resort and Spa': 'bg-pink-500 text-slate-50 border-pink-400/40',
  'Extended-Stay': 'bg-blue-500 text-slate-50 border-blue-400/40',
  Suite: 'bg-cyan-500 text-slate-50 border-cyan-400/40',
}
