import type { Id } from '../_generated/dataModel'
import { ConvexError } from 'convex/values'

export type AnalyticsScope =
  | { kind: 'global' }
  | {
      kind: 'hotel'
      hotelId: Id<'hotels'>
      assignmentRole: 'hotel_admin' | 'hotel_cashier'
    }

export function resolveAnalyticsScope(
  user: { role: 'room_admin' | 'customer' },
  assignment: {
    hotelId: Id<'hotels'>
    role: 'hotel_admin' | 'hotel_cashier'
  } | null,
): AnalyticsScope {
  if (user.role === 'room_admin') {
    return { kind: 'global' }
  }

  if (!assignment) {
    throw new ConvexError({
      code: 'FORBIDDEN',
      message: 'Analytics access requires a hotel assignment.',
    })
  }

  return {
    kind: 'hotel',
    hotelId: assignment.hotelId,
    assignmentRole: assignment.role,
  }
}
