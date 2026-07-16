// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearStaffInvitationContinuation,
  getStaffInvitationContinuation,
  isStaffInvitationRedirect,
  rememberStaffInvitationContinuation,
} from './staffInvitationContinuation'

const INVITATION_REDIRECT = '/staff-invitations/invite-123?token=secret-token'

describe('staff invitation auth continuation', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    vi.useRealTimers()
  })

  it('accepts only local token-bearing staff invitation paths', () => {
    expect(isStaffInvitationRedirect(INVITATION_REDIRECT)).toBe(true)
    expect(isStaffInvitationRedirect('/staff-invitations/invite-123')).toBe(
      false,
    )
    expect(isStaffInvitationRedirect('/select-location?token=secret')).toBe(
      false,
    )
    expect(
      isStaffInvitationRedirect(
        'https://malicious.example/staff-invitations/invite-123?token=secret',
      ),
    ).toBe(false)
  })

  it('stores and restores a valid invitation in the current tab', () => {
    expect(rememberStaffInvitationContinuation(INVITATION_REDIRECT)).toBe(true)
    expect(getStaffInvitationContinuation()).toBe(INVITATION_REDIRECT)
  })

  it('does not store normal authentication destinations', () => {
    expect(rememberStaffInvitationContinuation('/select-location')).toBe(false)
    expect(getStaffInvitationContinuation()).toBeUndefined()
  })

  it('ignores expired continuations', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-16T10:00:00Z'))
    rememberStaffInvitationContinuation(INVITATION_REDIRECT)

    vi.advanceTimersByTime(60 * 60 * 1000 + 1)
    expect(getStaffInvitationContinuation()).toBeUndefined()
  })

  it('clears the continuation after the invitation resumes', () => {
    rememberStaffInvitationContinuation(INVITATION_REDIRECT)
    clearStaffInvitationContinuation()

    expect(getStaffInvitationContinuation()).toBeUndefined()
  })
})
