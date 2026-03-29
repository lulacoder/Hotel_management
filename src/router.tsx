import { createRouter } from '@tanstack/react-router'

// Generated from file-based routes in `src/routes`.
import { routeTree } from './routeTree.gen'
import { createRouterContext } from './lib/routerContext'

// Factory keeps router creation SSR-safe and test-friendly.
export const getRouter = () => {
  const router = createRouter({
    // Full route graph TanStack Router uses for matching/navigation.
    routeTree,
    context: createRouterContext(),

    // Restore scroll position between navigations where possible.
    scrollRestoration: true,
    defaultPreload: 'intent',
    // Keep preload results warm briefly to avoid repeated hover/focus refetches.
    defaultPreloadStaleTime: 30_000,
  })

  return router
}

// This is required to make the router type available globally in the app.
declare module '@tanstack/react-router' {
  interface Register {
    router: Awaited<ReturnType<typeof getRouter>>
  }
}
