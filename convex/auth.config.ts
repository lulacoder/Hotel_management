import type { AuthConfig } from 'convex/server'

export default {
  providers: [
    {
      // Clerk Frontend API URL — set this on the Convex dashboard for both
      // dev and prod deployments.  Format:
      //   dev:  https://verb-noun-00.clerk.accounts.dev
      //   prod: https://clerk.<your-domain>.com
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: 'convex',
    },
  ],
} satisfies AuthConfig
