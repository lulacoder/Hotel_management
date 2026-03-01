import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { useAuth } from '@clerk/clerk-react'

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
      {children}
    </ConvexProviderWithClerk>
  )
}
