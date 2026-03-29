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

async function requireHotelStaffOrAdmin(ctx: any) {
  const user = await requireUser(ctx)
  if (user.role === 'room_admin') {
    return user
  }
  // For hotel staff, verify they have an active assignment to ensure they are not a former employee.
  const assignment = await getHotelAssignment(ctx, user._id)
  if (
    !assignment ||
    !['hotel_admin', 'hotel_cashier'].includes(assignment.role)
  ) {
    throw new ConvexError({
      code: 'FORBIDDEN',
      message: 'Hotel staff access required.',
    })
  }

  return user
}

// Retrieves or creates a guest profile for a walk-in guest based on phone or email.
// Requires the caller to be an authorized hotel staff member (admin or cashier) or room admin.
// Normalizes the phone number (digits only) and email address (lowercase trimmed).
// Reuses an existing profile if there is an exact match on either phone or email;
// otherwise, creates a new profile.
export const findOrCreate = mutation({
  args: {
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  returns: v.id('guestProfiles'),
  handler: async (ctx, args) => {
    const actor = await requireHotelStaffOrAdmin(ctx)

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

// Searches guest profiles by a search term, matching on either phone (digits) or email (lowercase).
// Requires hotel staff (admin or cashier) or room admin privileges.
// Returns the top 10 matching guest profiles, along with the total count of their associated bookings.
export const search = query({
  args: {
    searchTerm: v.string(),
  },
  returns: v.array(
    v.object({
      profile: guestProfileValidator,
      bookingCount: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireHotelStaffOrAdmin(ctx)

    const rawTerm = args.searchTerm.trim()
    if (rawTerm.length < 2) {
      return []
    }

    const phoneTerm = normalizePhone(rawTerm)
    const emailTerm = rawTerm.toLowerCase()
    const matchedById = new Map<string, any>()

    if (phoneTerm) {
      const byPhone = await ctx.db
        .query('guestProfiles')
        .withIndex('by_phone', (q: any) =>
          q.gte('phone', phoneTerm).lt('phone', `${phoneTerm}\uffff`),
        )
        .take(10)

      for (const profile of byPhone) {
        matchedById.set(String(profile._id), profile)
      }
    }

    const byEmail = await ctx.db
      .query('guestProfiles')
      .withIndex('by_email', (q: any) =>
        q.gte('email', emailTerm).lt('email', `${emailTerm}\uffff`),
      )
      .take(10)

    for (const profile of byEmail) {
      matchedById.set(String(profile._id), profile)
    }

    const matchedProfiles = Array.from(matchedById.values()).slice(0, 10)

    return await Promise.all(
      matchedProfiles.map(async (profile) => {
        const bookings = await ctx.db
          .query('bookings')
          .withIndex('by_guest_profile', (q: any) =>
            q.eq('guestProfileId', profile._id),
          )
          .collect()

        return {
          profile,
          bookingCount: bookings.length,
        }
      }),
    )
  },
})

// Retrieves a single guest profile by its ID.
// The caller must be an authorized hotel staff member or room admin.
// Returns null if the profile is not found.
export const get = query({
  args: {
    guestProfileId: v.id('guestProfiles'),
  },
  returns: v.union(guestProfileValidator, v.null()),
  handler: async (ctx, args) => {
    await requireHotelStaffOrAdmin(ctx)
    return await ctx.db.get(args.guestProfileId)
  },
})
