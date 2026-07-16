import { sanitizeRedirect } from './authRouting'

const STAFF_INVITATION_CONTINUATION_KEY =
  'tripways.staff-invitation-continuation'
const STAFF_INVITATION_CONTINUATION_TTL_MS = 60 * 60 * 1000

interface StaffInvitationContinuation {
  kind: 'staff_invitation'
  redirect: string
  savedAt: number
}

// Restricts the auth override to token-bearing staff invitation routes.
export function isStaffInvitationRedirect(value: unknown): value is string {
  const redirect = sanitizeRedirect(value)
  if (!redirect) return false

  const url = new URL(redirect, 'https://tripways.local')
  const hasInvitationPath = /^\/staff-invitations\/[^/]+$/.test(url.pathname)
  const token = url.searchParams.get('token')

  return hasInvitationPath && Boolean(token?.trim())
}

// Remembers invitation intent in this tab when Clerk drops search parameters
// during a multi-step sign-in, sign-up, or email verification flow.
export function rememberStaffInvitationContinuation(value: unknown): boolean {
  if (typeof window === 'undefined' || !isStaffInvitationRedirect(value)) {
    return false
  }

  const continuation: StaffInvitationContinuation = {
    kind: 'staff_invitation',
    redirect: value,
    savedAt: Date.now(),
  }

  try {
    window.sessionStorage.setItem(
      STAFF_INVITATION_CONTINUATION_KEY,
      JSON.stringify(continuation),
    )
    return true
  } catch {
    return false
  }
}

// Reads a still-valid invitation continuation without affecting normal auth
// redirects or persisting the bearer link beyond the current browser tab.
export function getStaffInvitationContinuation(): string | undefined {
  if (typeof window === 'undefined') return undefined

  try {
    const stored = window.sessionStorage.getItem(
      STAFF_INVITATION_CONTINUATION_KEY,
    )
    if (!stored) return undefined

    const continuation = JSON.parse(
      stored,
    ) as Partial<StaffInvitationContinuation>
    const isFresh =
      typeof continuation.savedAt === 'number' &&
      Date.now() - continuation.savedAt <=
        STAFF_INVITATION_CONTINUATION_TTL_MS &&
      Date.now() >= continuation.savedAt

    return continuation.kind === 'staff_invitation' &&
      isFresh &&
      isStaffInvitationRedirect(continuation.redirect)
      ? continuation.redirect
      : undefined
  } catch {
    return undefined
  }
}

// Clears the one-time auth handoff once the signed-in user reaches the invite.
export function clearStaffInvitationContinuation(): void {
  if (typeof window === 'undefined') return

  try {
    window.sessionStorage.removeItem(STAFF_INVITATION_CONTINUATION_KEY)
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}
