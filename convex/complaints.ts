import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { getHotelAssignment, requireCustomer, requireUser } from './lib/auth'

const complaintValidator = v.object({
  _id: v.id('complaints'),
  _creationTime: v.number(),
  userId: v.id('users'),
  hotelId: v.id('hotels'),
  bookingId: v.optional(v.id('bookings')),
  subject: v.string(),
  description: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
})

const bookingSummaryValidator = v.object({
  _id: v.id('bookings'),
  checkIn: v.string(),
  checkOut: v.string(),
  status: v.union(
    v.literal('held'),
    v.literal('pending_payment'),
    v.literal('confirmed'),
    v.literal('checked_in'),
    v.literal('checked_out'),
    v.literal('cancelled'),
    v.literal('expired'),
    v.literal('outsourced'),
  ),
})

const listForAssignedHotelItemValidator = v.object({
  complaint: complaintValidator,
  customer: v.union(
    v.object({
      _id: v.id('users'),
      email: v.string(),
    }),
    v.null(),
  ),
  booking: v.union(bookingSummaryValidator, v.null()),
})

const getStaffAssignmentForComplaints = async (
  ctx: Parameters<typeof requireUser>[0],
) => {
  const user = await requireUser(ctx)
  const assignment = await getHotelAssignment(ctx, user._id)

  if (
    !assignment ||
    !['hotel_admin', 'hotel_cashier'].includes(assignment.role)
  ) {
    throw new ConvexError({
      code: 'FORBIDDEN',
      message: 'Only assigned hotel admins and cashiers can view complaints.',
    })
  }

  return assignment
}

const normalizeSingleLine = (value: string) =>
  value
    .replace(/\s+/g, ' ')
    .trim()

const normalizeMultiline = (value: string) => value.trim()

// Creates a new complaint for a customer against a hotel.
// Only signed-in customers can submit complaints.
export const submit = mutation({
  args: {
    hotelId: v.id('hotels'),
    subject: v.string(),
    description: v.string(),
    bookingId: v.optional(v.id('bookings')),
  },
  returns: v.id('complaints'),
  handler: async (ctx, args) => {
    const customer = await requireCustomer(ctx)

    const hotel = await ctx.db.get(args.hotelId)
    if (!hotel || hotel.isDeleted) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Hotel not found.',
      })
    }

    const subject = normalizeSingleLine(args.subject)
    const description = normalizeMultiline(args.description)

    if (subject.length < 5 || subject.length > 120) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Subject must be between 5 and 120 characters.',
      })
    }

    if (description.length < 20 || description.length > 2000) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Description must be between 20 and 2000 characters.',
      })
    }

    if (args.bookingId) {
      const booking = await ctx.db.get(args.bookingId)

      if (!booking) {
        throw new ConvexError({
          code: 'NOT_FOUND',
          message: 'Booking not found.',
        })
      }

      if (booking.userId !== customer._id) {
        throw new ConvexError({
          code: 'FORBIDDEN',
          message: 'You can only attach your own booking to a complaint.',
        })
      }

      if (booking.hotelId !== args.hotelId) {
        throw new ConvexError({
          code: 'INVALID_INPUT',
          message: 'Booking must belong to the selected hotel.',
        })
      }
    }

    const now = Date.now()

    return await ctx.db.insert('complaints', {
      userId: customer._id,
      hotelId: args.hotelId,
      bookingId: args.bookingId,
      subject,
      description,
      createdAt: now,
      updatedAt: now,
    })
  },
})

// Lists complaints for the current staff member's assigned hotel.
// Access is strictly limited to hotel_admin and hotel_cashier roles.
export const listForAssignedHotel = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(listForAssignedHotelItemValidator),
  handler: async (ctx, args) => {
    const assignment = await getStaffAssignmentForComplaints(ctx)

    const limit = Math.max(1, Math.min(args.limit ?? 100, 200))

    const complaints = await ctx.db
      .query('complaints')
      .withIndex('by_hotel_and_created_at', (q) =>
        q.eq('hotelId', assignment.hotelId),
      )
      .order('desc')
      .take(limit)

    const result = []

    for (const complaint of complaints) {
      const customer = await ctx.db.get(complaint.userId)
      const booking = complaint.bookingId
        ? await ctx.db.get(complaint.bookingId)
        : null

      result.push({
        complaint,
        customer: customer
          ? {
              _id: customer._id,
              email: customer.email,
            }
          : null,
        booking: booking
          ? {
              _id: booking._id,
              checkIn: booking.checkIn,
              checkOut: booking.checkOut,
              status: booking.status,
            }
          : null,
      })
    }

    return result
  },
})

// Fetches a single complaint for the current staff member's assigned hotel.
// Access is strictly limited to hotel_admin and hotel_cashier roles.
export const getForAssignedHotel = query({
  args: {
    complaintId: v.id('complaints'),
  },
  returns: v.union(listForAssignedHotelItemValidator, v.null()),
  handler: async (ctx, args) => {
    const assignment = await getStaffAssignmentForComplaints(ctx)

    const complaint = await ctx.db.get(args.complaintId)
    if (!complaint) {
      return null
    }

    if (complaint.hotelId !== assignment.hotelId) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'You do not have access to this complaint.',
      })
    }

    const customer = await ctx.db.get(complaint.userId)
    const booking = complaint.bookingId ? await ctx.db.get(complaint.bookingId) : null

    return {
      complaint,
      customer: customer
        ? {
            _id: customer._id,
            email: customer.email,
          }
        : null,
      booking: booking
        ? {
            _id: booking._id,
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
            status: booking.status,
          }
        : null,
    }
  },
})
