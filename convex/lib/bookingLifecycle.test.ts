import { describe, expect, it } from 'vitest'

import {
  BOOKING_STATUSES,
  BOOKING_TRANSITION_EVENTS,
  BOOKING_TRANSITION_RULES,
  canApplyBookingTransition,
  canCustomerCancelBooking,
  getAllowedBookingTransitions,
} from './bookingLifecycle'

describe('booking lifecycle policy', () => {
  it('accepts every declared event-scoped transition', () => {
    for (const event of BOOKING_TRANSITION_EVENTS) {
      for (const [from, to] of BOOKING_TRANSITION_RULES[event]) {
        expect(canApplyBookingTransition(event, from, to)).toBe(true)
      }
    }
  })

  it('rejects undeclared transitions for every event', () => {
    for (const event of BOOKING_TRANSITION_EVENTS) {
      const declared = new Set(
        BOOKING_TRANSITION_RULES[event].map(([from, to]) => `${from}:${to}`),
      )

      for (const from of BOOKING_STATUSES) {
        for (const to of BOOKING_STATUSES) {
          expect(canApplyBookingTransition(event, from, to)).toBe(
            declared.has(`${from}:${to}`),
          )
        }
      }
    }
  })

  it('keeps the staff UI list limited to manual actions', () => {
    expect(getAllowedBookingTransitions('held')).toEqual(['cancelled'])
    expect(getAllowedBookingTransitions('confirmed')).toEqual([
      'checked_in',
      'cancelled',
    ])
    expect(getAllowedBookingTransitions('checked_in')).toEqual(['checked_out'])
    expect(getAllowedBookingTransitions('unknown')).toEqual([])
  })

  it('allows customers to cancel unpaid confirmed bookings but not paid ones', () => {
    expect(canCustomerCancelBooking('confirmed', 'pending')).toBe(true)
    expect(canCustomerCancelBooking('confirmed')).toBe(true)
    expect(canCustomerCancelBooking('confirmed', 'paid')).toBe(false)
  })
})
