import { createFileRoute } from '@tanstack/react-router'

import { normalizeAnalyticsWindow } from '@/lib/adminAnalytics'

export const Route = createFileRoute('/admin/')({
  validateSearch: (search: Record<string, unknown>) => ({
    window: normalizeAnalyticsWindow(search.window),
  }),
})
