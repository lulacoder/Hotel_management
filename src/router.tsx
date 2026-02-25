import { createRouter } from '@tanstack/react-router'

// Generated from file-based routes in `src/routes`.
import { routeTree } from './routeTree.gen'

// Factory keeps router creation SSR-safe and test-friendly.
export const getRouter = () => {
  const router = createRouter({
    // Full route graph TanStack Router uses for matching/navigation.
    routeTree,
    // Reserved for typed context injection if needed later.
    context: {},

    // Restore scroll position between navigations where possible.
    scrollRestoration: true,
    // Always re-evaluate route data on navigation.
    defaultPreloadStaleTime: 0,
  })

  return router
}
