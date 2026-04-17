import { Resend } from '@convex-dev/resend'
import { v } from 'convex/values'

import { components } from './_generated/api'
import { internalMutation } from './_generated/server'

type PaymentChannel = 'bank' | 'chapa'

const PAYMENT_CHANNEL_LABEL: Record<PaymentChannel, string> = {
  bank: 'Bank payment verification',
  chapa: 'Chapa payment',
}

function getEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not configured`)
  }

  return value
}

function normalizeEmail(email: string | null | undefined) {
  if (!email) {
    return null
  }

  const normalized = email.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

function uniqueEmails(emails: Array<string | null | undefined>) {
  const seen = new Set<string>()
  const result: string[] = []

  for (const email of emails) {
    const normalized = normalizeEmail(email)
    if (!normalized || seen.has(normalized)) {
      continue
    }

    seen.add(normalized)
    result.push(normalized)
  }

  return result
}

export const resend = new Resend(components.resend, {
  testMode: false,
})

export const sendPaymentSuccessEmails = internalMutation({
  args: {
    bookingId: v.id('bookings'),
    channel: v.union(v.literal('bank'), v.literal('chapa')),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) {
      return null
    }

    const [hotel, room, customerUser, staffAssignments] = await Promise.all([
      ctx.db.get(booking.hotelId),
      ctx.db.get(booking.roomId),
      booking.userId ? ctx.db.get(booking.userId) : Promise.resolve(null),
      ctx.db
        .query('hotelStaff')
        .withIndex('by_hotel', (q) => q.eq('hotelId', booking.hotelId))
        .collect(),
    ])

    const staffUsers = await Promise.all(
      staffAssignments.map((assignment) => ctx.db.get(assignment.userId)),
    )

    const recipientEmails = uniqueEmails([
      booking.guestEmail,
      customerUser?.email,
      ...staffUsers.map((staff) => staff?.email),
    ])

    if (recipientEmails.length === 0) {
      return null
    }

    const from = getEnv('NOTIFICATION_FROM_EMAIL')
    const bookingCode = args.bookingId.slice(-6).toUpperCase()
    const paymentChannel = PAYMENT_CHANNEL_LABEL[args.channel]
    const hotelName = hotel?.name ?? 'the hotel'
    const roomNumber = room?.roomNumber ?? 'N/A'
    const guestName = booking.guestName?.trim() || 'Guest'
    const subject = `Payment confirmed for booking #${bookingCode}`
    const totalPriceUsd = (booking.totalPrice / 100).toFixed(2)

    const text = [
      `Hello,`,
      ``,
      `A payment has been confirmed for booking #${bookingCode}.`,
      ``,
      `Guest: ${guestName}`,
      `Hotel: ${hotelName}`,
      `Room: ${roomNumber}`,
      `Stay: ${booking.checkIn} to ${booking.checkOut}`,
      `Amount: $${totalPriceUsd} USD`,
      `Channel: ${paymentChannel}`,
      ``,
      `Thank you.`,
    ].join('\n')

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
        <p>Hello,</p>
        <p>A payment has been confirmed for booking <strong>#${bookingCode}</strong>.</p>
        <p>
          <strong>Guest:</strong> ${guestName}<br />
          <strong>Hotel:</strong> ${hotelName}<br />
          <strong>Room:</strong> ${roomNumber}<br />
          <strong>Stay:</strong> ${booking.checkIn} to ${booking.checkOut}<br />
          <strong>Amount:</strong> $${totalPriceUsd} USD<br />
          <strong>Channel:</strong> ${paymentChannel}
        </p>
        <p>Thank you.</p>
      </div>
    `

    await Promise.allSettled(
      recipientEmails.map((to) =>
        resend.sendEmail(ctx, {
          from,
          to,
          subject,
          text,
          html,
        }),
      ),
    )

    return null
  },
})
