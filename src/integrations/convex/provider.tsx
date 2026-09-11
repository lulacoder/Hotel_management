import { useAuth } from '@clerk/clerk-react'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { ConvexQueryCacheProvider } from 'convex-helpers/react/cache'
import { ConvexProviderWithClerk } from 'convex/react-clerk'

const CONVEX_URL = (import.meta as any).env.VITE_CONVEX_URL
if (!CONVEX_URL) {
  console.error('missing envar VITE_CONVEX_URL')
}
const convexQueryClient = new ConvexQueryClient(CONVEX_URL)

export default function AppConvexProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ConvexProviderWithClerk
      client={convexQueryClient.convexClient}
      useAuth={useAuth} // Pass Clerk's useAuth hook to integrate authentication with Convex
    >
      <ConvexQueryCacheProvider
        expiration={300000}
        maxIdleEntries={250}
        debug={false}
      >
        {children}
      </ConvexQueryCacheProvider>
    </ConvexProviderWithClerk>
  )
}
