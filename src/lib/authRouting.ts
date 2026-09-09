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

export interface ClientImpersonationData {
  isImpersonating: true
  targetUserId: string
  targetRole: string
  expiresAt: number
}

const IMPERSONATION_STORAGE_KEY = 'convex_active_impersonation'

// Clears the route bootstrap cache from both browser storage scopes
export function clearClientImpersonation(): void {
  if (typeof window === 'undefined') return

  try {
    window.sessionStorage.removeItem(IMPERSONATION_STORAGE_KEY)
    window.localStorage.removeItem(IMPERSONATION_STORAGE_KEY)
  } catch {
    // Browser privacy settings can disable storage access
  }
}

// Reads and validates the short-lived cache used before Convex has hydrated
function readClientImpersonation(): ClientImpersonationData | null {
  if (typeof window === 'undefined') return null

  try {
    const raw =
      window.sessionStorage.getItem(IMPERSONATION_STORAGE_KEY) ||
      window.localStorage.getItem(IMPERSONATION_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<ClientImpersonationData>
    const isValid =
      parsed.isImpersonating === true &&
      typeof parsed.targetUserId === 'string' &&
      typeof parsed.targetRole === 'string' &&
      typeof parsed.expiresAt === 'number'

    if (!isValid || Date.now() >= parsed.expiresAt!) {
      clearClientImpersonation()
      return null
    }

    return parsed as ClientImpersonationData
  } catch {
    clearClientImpersonation()
    return null
  }
}

// Reports whether route guards should temporarily use the impersonated role
export function isClientImpersonating(): boolean {
  return readClientImpersonation() !== null
}

// Stores the minimum session data needed by client-side route guards
export function setClientImpersonation(data: ClientImpersonationData): void {
  if (typeof window === 'undefined') return

  try {
    const serializedSession = JSON.stringify(data)

    if (
      window.sessionStorage.getItem(IMPERSONATION_STORAGE_KEY) !==
      serializedSession
    ) {
      window.sessionStorage.setItem(
        IMPERSONATION_STORAGE_KEY,
        serializedSession,
      )
    }

    if (
      window.localStorage.getItem(IMPERSONATION_STORAGE_KEY) !==
      serializedSession
    ) {
      window.localStorage.setItem(IMPERSONATION_STORAGE_KEY, serializedSession)
    }
  } catch {
    // Browser privacy settings can disable storage access
  }
}

export interface ClientAuthSnapshot {
  globalRole: GlobalUserRole
  isLoaded: boolean
  isSignedIn: boolean
  userId: string | null
  isImpersonating: boolean
}

declare global {
  interface Window {
    Clerk?: ClerkLikeInstance
  }
}

function resolveGlobalRole(
  user: ClerkLikeUser | null | undefined,
): GlobalUserRole {
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
      isImpersonating: false,
    }
  }

  const clerk = window.Clerk
  const user = clerk?.user ?? null
  const impersonating = isClientImpersonating()
  const rawRole = resolveGlobalRole(user)

  return {
    globalRole: impersonating ? 'customer' : rawRole,
    isLoaded: Boolean(clerk?.loaded),
    isSignedIn: Boolean(user),
    userId: user?.id ?? null,
    isImpersonating: impersonating,
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
