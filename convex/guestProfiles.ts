import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { getHotelAssignment, requireUser } from './lib/auth'

const guestProfileValidator = v.object({
  _id: v.id('guestProfiles'),
  _creationTime: v.number(),
  name: v.string(),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  createdBy: v.id('users'),
  createdAt: v.number(),
  linkedUserId: v.optional(v.id('users')),
})

function normalizePhone(value?: string): string | undefined {
  if (!value) return undefined
  const digits = value.replace(/\D/g, '')
  return digits.length > 0 ? digits : undefined
}

function normalizeEmail(value?: string): string | undefined {
  if (!value) return undefined
  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : undefined
}

async function requireHotelStaffOrAdmin(ctx: any, clerkUserId: string) {
  const user = await requireUser(ctx, clerkUserId)
  if (user.role === 'room_admin') {
    return user
  }

  const assignment = await getHotelAssignment(ctx, user._id)
  if (!assignment || !['hotel_admin', 'hotel_cashier'].includes(assignment.role)) {
    throw new ConvexError({
      code: 'FORBIDDEN',
      message: 'Hotel staff access required.',
    })
  }

  return user
}

export const findOrCreate = mutation({
  args: {
    clerkUserId: v.string(),
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  returns: v.id('guestProfiles'),
  handler: async (ctx, args) => {
    const actor = await requireHotelStaffOrAdmin(ctx, args.clerkUserId)

    const name = args.name.trim()
    if (!name) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Guest name is required.',
      })
    }

    const normalizedPhone = normalizePhone(args.phone)
    const normalizedEmail = normalizeEmail(args.email)

    if (!normalizedPhone && !normalizedEmail) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'At least one contact method (phone or email) is required.',
      })
    }

    if (normalizedPhone) {
      const byPhone = await ctx.db
        .query('guestProfiles')
        .withIndex('by_phone', (q: any) => q.eq('phone', normalizedPhone))
        .first()

      if (byPhone) {
        return byPhone._id
      }
    }

    if (normalizedEmail) {
      const byEmail = await ctx.db
        .query('guestProfiles')
        .withIndex('by_email', (q: any) => q.eq('email', normalizedEmail))
        .first()

      if (byEmail) {
        return byEmail._id
      }
    }

    return await ctx.db.insert('guestProfiles', {
      name,
      phone: normalizedPhone,
      email: normalizedEmail,
      createdBy: actor._id,
      createdAt: Date.now(),
    })
  },
})

export const search = query({
  args: {
    clerkUserId: v.string(),
    searchTerm: v.string(),
  },
  returns: v.array(
    v.object({
      profile: guestProfileValidator,
      bookingCount: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireHotelStaffOrAdmin(ctx, args.clerkUserId)

    const rawTerm = args.searchTerm.trim()
    if (rawTerm.length < 2) {
      return []
    }

    const phoneTerm = normalizePhone(rawTerm)
    const emailTerm = rawTerm.toLowerCase()

    const profiles = await ctx.db.query('guestProfiles').collect()
    const matched = profiles.filter((profile) => {
      const byPhone = phoneTerm ? (profile.phone ?? '').includes(phoneTerm) : false
      const byEmail = (profile.email ?? '').toLowerCase().includes(emailTerm)
      return byPhone || byEmail
    })

    const result = []
    for (const profile of matched.slice(0, 10)) {
      const bookings = await ctx.db
        .query('bookings')
        .withIndex('by_guest_profile', (q: any) =>
          q.eq('guestProfileId', profile._id),
        )
        .collect()

      result.push({
        profile,
        bookingCount: bookings.length,
      })
    }

    return result
  },
})

export const get = query({
  args: {
    clerkUserId: v.string(),
    guestProfileId: v.id('guestProfiles'),
  },
  returns: v.union(guestProfileValidator, v.null()),
  handler: async (ctx, args) => {
    await requireHotelStaffOrAdmin(ctx, args.clerkUserId)
    return await ctx.db.get(args.guestProfileId)
  },
})
