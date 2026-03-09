import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { createAuditLog } from './audit'
import { requireHotelAccess } from './lib/auth'

// this query retrieves the bank account information for a specific hotel, while the mutation allows authorized hotel staff to set or update the bank account number. Both operations include access control checks to ensure that only users with the appropriate roles can perform these actions, and they also log changes for auditing purposes. 
export const getByHotel = query({
  args: {
    hotelId: v.id('hotels'),
  },
  returns: v.union(
    v.object({
      accountNumber: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query('hotelBankAccounts')
      .withIndex('by_hotel', (q) => q.eq('hotelId', args.hotelId))
      .unique()

    if (!account) {
      return null
    }

    return {
      accountNumber: account.accountNumber,
    }
  },
})

// 
export const set = mutation({
  args: {
    hotelId: v.id('hotels'),
    accountNumber: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const trimmedAccountNumber = args.accountNumber.trim()
    if (!trimmedAccountNumber) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Bank account number is required.',
      })
    }

    const { user, assignment } = await requireHotelAccess(ctx, args.hotelId)

    if (user.role === 'room_admin') {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'Only hotel staff can update payment settings.',
      })
    }

    // Hotel staff must have an active assignment to update bank account info, ensuring that former employees cannot make changes.
    if (!assignment || !['hotel_admin', 'hotel_cashier'].includes(assignment.role)) {
      throw new ConvexError({
        code: 'FORBIDDEN',
        message: 'Only hotel admins and cashiers can update payment settings.',
      })
    }

    // Check if an account already exists for the hotel
    const existing = await ctx.db
      .query('hotelBankAccounts')
      .withIndex('by_hotel', (q) => q.eq('hotelId', args.hotelId))
      .unique()

    const now = Date.now()

    // if it exists,update the account number and log it
    if (existing) {
      await ctx.db.patch(existing._id, {
        accountNumber: trimmedAccountNumber,
        setBy: user._id,
        updatedAt: now,
      })

      await createAuditLog(ctx, {
        actorId: user._id,
        action: 'hotel_bank_account_updated',
        targetType: 'hotel',
        targetId: args.hotelId,
        previousValue: { accountNumber: existing.accountNumber },
        newValue: { accountNumber: trimmedAccountNumber },
      })

      return null
    }

    // if it doesn't exist, create a new record and log it
    await ctx.db.insert('hotelBankAccounts', {
      hotelId: args.hotelId,
      accountNumber: trimmedAccountNumber,
      setBy: user._id,
      updatedAt: now,
    })

    await createAuditLog(ctx, {
      actorId: user._id,
      action: 'hotel_bank_account_created',
      targetType: 'hotel',
      targetId: args.hotelId,
      newValue: { accountNumber: trimmedAccountNumber },
    })

    return null
  },
})
