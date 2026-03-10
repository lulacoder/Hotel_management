import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { createAuditLog } from './audit'
import { requireHotelAccess } from './lib/auth'
import type { MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'

const DEFAULT_BANK_NAME = 'Default'

interface BankAccountSummary {
  _id: Id<'hotelBankAccounts'>
  bankName: string
  accountNumber: string
  createdAt: number
  updatedAt: number
}

const canManagePayment = async (
  ctx: MutationCtx,
  hotelId: Id<'hotels'>,
) => {
  const { user, assignment } = await requireHotelAccess(ctx, hotelId)

  if (user.role === 'room_admin') {
    throw new ConvexError({
      code: 'FORBIDDEN',
      message: 'Only hotel staff can update payment settings.',
    })
  }

  if (!assignment || !['hotel_admin', 'hotel_cashier'].includes(assignment.role)) {
    throw new ConvexError({
      code: 'FORBIDDEN',
      message: 'Only hotel admins and cashiers can update payment settings.',
    })
  }

  return { user, assignment }
}

export const listByHotel = query({
  args: {
    hotelId: v.id('hotels'),
  },
  returns: v.array(
    v.object({
      _id: v.id('hotelBankAccounts'),
      bankName: v.string(),
      accountNumber: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args): Promise<BankAccountSummary[]> => {
    const accounts = await ctx.db
      .query('hotelBankAccounts')
      .withIndex('by_hotel', (q) => q.eq('hotelId', args.hotelId))
      .collect()

    return accounts
      .filter((account) => !account.isDeleted)
      .map((account) => ({
        _id: account._id,
        bankName: account.bankName?.trim() || DEFAULT_BANK_NAME,
        accountNumber: account.accountNumber,
        createdAt: account.createdAt ?? account._creationTime,
        updatedAt: account.updatedAt,
      }))
      .sort((a, b) => a.createdAt - b.createdAt)
  },
})

export const create = mutation({
  args: {
    hotelId: v.id('hotels'),
    bankName: v.string(),
    accountNumber: v.string(),
  },
  returns: v.id('hotelBankAccounts'),
  handler: async (ctx, args): Promise<Id<'hotelBankAccounts'>> => {
    const trimmedBankName = args.bankName.trim()
    const trimmedAccountNumber = args.accountNumber.trim()

    if (!trimmedBankName) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Bank name is required.',
      })
    }

    if (!trimmedAccountNumber) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Bank account number is required.',
      })
    }

    const { user } = await canManagePayment(ctx, args.hotelId)

    const now = Date.now()
    const id = await ctx.db.insert('hotelBankAccounts', {
      hotelId: args.hotelId,
      bankName: trimmedBankName,
      accountNumber: trimmedAccountNumber,
      isDeleted: false,
      setBy: user._id,
      createdAt: now,
      updatedAt: now,
    })

    await createAuditLog(ctx, {
      actorId: user._id,
      action: 'hotel_bank_account_created',
      targetType: 'hotel',
      targetId: args.hotelId,
      newValue: { bankName: trimmedBankName, accountNumber: trimmedAccountNumber },
    })

    return id
  },
})

export const update = mutation({
  args: {
    accountId: v.id('hotelBankAccounts'),
    bankName: v.string(),
    accountNumber: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const trimmedBankName = args.bankName.trim()
    const trimmedAccountNumber = args.accountNumber.trim()

    if (!trimmedBankName) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Bank name is required.',
      })
    }

    if (!trimmedAccountNumber) {
      throw new ConvexError({
        code: 'INVALID_INPUT',
        message: 'Bank account number is required.',
      })
    }

    const existing = await ctx.db.get(args.accountId)
    if (!existing) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Bank account not found.',
      })
    }

    const { user } = await canManagePayment(ctx, existing.hotelId)

    const now = Date.now()
    await ctx.db.patch(args.accountId, {
      bankName: trimmedBankName,
      accountNumber: trimmedAccountNumber,
      setBy: user._id,
      updatedAt: now,
    })

    await createAuditLog(ctx, {
      actorId: user._id,
      action: 'hotel_bank_account_updated',
      targetType: 'hotel',
      targetId: existing.hotelId,
      previousValue: {
        bankName: existing.bankName ?? DEFAULT_BANK_NAME,
        accountNumber: existing.accountNumber,
      },
      newValue: { bankName: trimmedBankName, accountNumber: trimmedAccountNumber },
    })

    return null
  },
})

export const softDelete = mutation({
  args: {
    accountId: v.id('hotelBankAccounts'),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const existing = await ctx.db.get(args.accountId)
    if (!existing) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Bank account not found.',
      })
    }

    const { user } = await canManagePayment(ctx, existing.hotelId)

    const now = Date.now()
    await ctx.db.patch(args.accountId, {
      isDeleted: true,
      setBy: user._id,
      updatedAt: now,
    })

    await createAuditLog(ctx, {
      actorId: user._id,
      action: 'hotel_bank_account_deleted',
      targetType: 'hotel',
      targetId: existing.hotelId,
      previousValue: {
        bankName: existing.bankName ?? DEFAULT_BANK_NAME,
        accountNumber: existing.accountNumber,
      },
      newValue: { isDeleted: true },
    })

    return null
  },
})

export const backfillDefaultName = mutation({
  args: {
    hotelId: v.id('hotels'),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const { user } = await canManagePayment(ctx, args.hotelId)

    const accounts = await ctx.db
      .query('hotelBankAccounts')
      .withIndex('by_hotel', (q) => q.eq('hotelId', args.hotelId))
      .collect()

    const now = Date.now()

    for (const account of accounts) {
      const nextBankName = account.bankName?.trim() || DEFAULT_BANK_NAME
      const nextCreatedAt = account.createdAt ?? account._creationTime
      const nextIsDeleted = account.isDeleted ?? false

      if (
        account.bankName?.trim() === nextBankName &&
        account.createdAt === nextCreatedAt &&
        account.isDeleted === nextIsDeleted
      ) {
        continue
      }

      await ctx.db.patch(account._id, {
        bankName: nextBankName,
        createdAt: nextCreatedAt,
        isDeleted: nextIsDeleted,
        updatedAt: now,
        setBy: user._id,
      })
    }

    return null
  },
})
