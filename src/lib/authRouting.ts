export type GlobalUserRole = 'customer' | 'room_admin' | null

interface ClerkLikeUser {
  id?: string
  publicMetadata?: {
    role?: unknown
  }
}

interface ClerkLikeInstance {
  loaded?: boolean
  user?: ClerkLikeUser | null
}

export interface ClientAuthSnapshot {
  globalRole: GlobalUserRole
  isLoaded: boolean
  isSignedIn: boolean
  userId: string | null
}

declare global {
  interface Window {
    Clerk?: ClerkLikeInstance
  }
}

function resolveGlobalRole(user: ClerkLikeUser | null | undefined): GlobalUserRole {
  if (!user) {
    return null
  }

  return user.publicMetadata?.role === 'room_admin' ? 'room_admin' : 'customer'
}

export function getClientAuthSnapshot(): ClientAuthSnapshot {
  if (typeof window === 'undefined') {
    return {
      globalRole: null,
      isLoaded: false,
      isSignedIn: false,
      userId: null,
    }
  }

  const clerk = window.Clerk
  const user = clerk?.user ?? null

  return {
    globalRole: resolveGlobalRole(user),
    isLoaded: Boolean(clerk?.loaded),
    isSignedIn: Boolean(user),
    userId: user?.id ?? null,
  }
}

export function sanitizeRedirect(value: unknown): string | undefined {
  return typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//')
    ? value
    : undefined
}

export function buildRedirectSearch(redirect: unknown): {
  redirect: string | undefined
} {
  return {
    redirect: sanitizeRedirect(redirect),
  }
}
