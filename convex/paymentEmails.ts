import { Resend } from '@convex-dev/resend'
import { v } from 'convex/values'

import { components } from './_generated/api'
import { internalMutation } from './_generated/server'

type PaymentChannel = 'bank' | 'chapa'
type PaymentAudience = 'customer' | 'staff'

type PaymentEmailContext = {
  bookingCode: string
  checkIn: string
  checkOut: string
  guestName: string
  hotelName: string
  paymentChannel: string
  roomNumber: string
  totalPriceUsd: string
  webAppUrl: string
}

type PaymentEmailPayload = {
  subject: string
  text: string
  html: string
}

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

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function normalizeWebAppUrl(rawUrl: string) {
  const trimmed = rawUrl.trim()
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('WEB_APP_URL must start with http:// or https://')
  }

  return trimmed.replace(/\/+$/, '')
}

function buildUrl(baseUrl: string, path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${baseUrl}${normalizedPath}`
}

function buildPaymentEmailPayload(
  audience: PaymentAudience,
  context: PaymentEmailContext,
): PaymentEmailPayload {
  const isCustomer = audience === 'customer'
  const subject = isCustomer
    ? `Payment confirmed for your booking #${context.bookingCode}`
    : `Payment confirmed for booking #${context.bookingCode}`
  const greeting = isCustomer ? `Hello ${context.guestName},` : 'Hello team,'
  const headline = isCustomer
    ? 'Your payment has been confirmed'
    : 'A booking payment has been confirmed'
  const summary = isCustomer
    ? 'Thanks for completing your payment. Your booking is now confirmed.'
    : 'A guest payment was confirmed. Please review the booking and prepare operations as needed.'
  const ctaLabel = isCustomer
    ? 'View All My Bookings'
    : 'Open Booking Dashboard'
  const ctaHref = isCustomer
    ? buildUrl(context.webAppUrl, '/bookings')
    : buildUrl(context.webAppUrl, '/admin/bookings')
  const detailLabel = isCustomer ? 'Booking details' : 'Payment details'
  const roleNote = isCustomer
    ? 'If anything looks incorrect, contact hotel support.'
    : 'You are receiving this because you are assigned as staff for this hotel.'
  const warmClosing = isCustomer
    ? 'Thank you for choosing us. We are excited to host you and wish you a wonderful stay.'
    : 'Thank you for everything you do to deliver a great guest experience.'

  const text = [
    greeting,
    '',
    `${headline}.`,
    summary,
    '',
    `Booking: #${context.bookingCode}`,
    `Guest: ${context.guestName}`,
    `Hotel: ${context.hotelName}`,
    `Room: ${context.roomNumber}`,
    `Stay: ${context.checkIn} to ${context.checkOut}`,
    `Amount: $${context.totalPriceUsd} USD`,
    `Channel: ${context.paymentChannel}`,
    '',
    `${ctaLabel}: ${ctaHref}`,
    roleNote,
    '',
    warmClosing,
  ].join('\n')

  const html = `
    <div style="margin:0;padding:28px 12px;background:#020617;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;margin:0 auto;background:#0f172a;border:1px solid #334155;border-radius:16px;overflow:hidden;font-family:'DM Sans','Segoe UI',Arial,sans-serif;color:#e2e8f0;">
        <tr>
          <td style="padding:22px 24px;background:linear-gradient(135deg,#8b5cf6 0%,#7c3aed 52%,#5b21b6 100%);">
            <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#ede9fe;font-weight:700;">Hotel Booking Payment</div>
            <div style="margin-top:8px;font-size:22px;line-height:1.3;color:#ffffff;font-weight:700;font-family:'Outfit','DM Sans','Segoe UI',Arial,sans-serif;">
              ${escapeHtml(headline)}
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;">
            <p style="margin:0 0 12px;font-size:16px;line-height:1.6;color:#f8fafc;">${escapeHtml(greeting)}</p>
            <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#cbd5e1;">${escapeHtml(summary)}</p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #334155;border-radius:12px;overflow:hidden;background:#0b1220;">
              <tr>
                <td colspan="2" style="padding:12px 14px;background:#312e81;border-bottom:1px solid #4338ca;font-size:13px;font-weight:700;color:#ddd6fe;text-transform:uppercase;letter-spacing:0.06em;">
                  ${escapeHtml(detailLabel)}
                </td>
              </tr>
              <tr>
                <td style="padding:10px 14px;border-bottom:1px solid #334155;font-size:13px;color:#94a3b8;font-weight:700;width:40%;">Booking</td>
                <td style="padding:10px 14px;border-bottom:1px solid #334155;font-size:13px;color:#f8fafc;">#${escapeHtml(context.bookingCode)}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;border-bottom:1px solid #334155;font-size:13px;color:#94a3b8;font-weight:700;">Guest</td>
                <td style="padding:10px 14px;border-bottom:1px solid #334155;font-size:13px;color:#f8fafc;">${escapeHtml(context.guestName)}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;border-bottom:1px solid #334155;font-size:13px;color:#94a3b8;font-weight:700;">Hotel</td>
                <td style="padding:10px 14px;border-bottom:1px solid #334155;font-size:13px;color:#f8fafc;">${escapeHtml(context.hotelName)}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;border-bottom:1px solid #334155;font-size:13px;color:#94a3b8;font-weight:700;">Room</td>
                <td style="padding:10px 14px;border-bottom:1px solid #334155;font-size:13px;color:#f8fafc;">${escapeHtml(context.roomNumber)}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;border-bottom:1px solid #334155;font-size:13px;color:#94a3b8;font-weight:700;">Stay</td>
                <td style="padding:10px 14px;border-bottom:1px solid #334155;font-size:13px;color:#f8fafc;">${escapeHtml(context.checkIn)} to ${escapeHtml(context.checkOut)}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;border-bottom:1px solid #334155;font-size:13px;color:#94a3b8;font-weight:700;">Amount</td>
                <td style="padding:10px 14px;border-bottom:1px solid #334155;font-size:13px;color:#f8fafc;">$${escapeHtml(context.totalPriceUsd)} USD</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;font-size:13px;color:#94a3b8;font-weight:700;">Channel</td>
                <td style="padding:10px 14px;font-size:13px;color:#f8fafc;">${escapeHtml(context.paymentChannel)}</td>
              </tr>
            </table>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:22px;">
              <tr>
                <td style="border-radius:10px;background:${isCustomer ? '#8b5cf6' : '#7c3aed'};box-shadow:0 14px 26px -18px rgba(139,92,246,0.9);">
                  <a href="${escapeHtml(ctaHref)}" style="display:inline-block;padding:11px 18px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">
                    ${escapeHtml(ctaLabel)}
                  </a>
                </td>
              </tr>
            </table>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:18px;width:100%;border:1px solid #334155;border-radius:10px;background:#1e293b;">
              <tr>
                <td style="padding:14px 14px 12px;font-size:14px;line-height:1.7;color:#e2e8f0;">${escapeHtml(warmClosing)}</td>
              </tr>
            </table>
            <p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">${escapeHtml(roleNote)}</p>
          </td>
        </tr>
      </table>
    </div>
  `

  return { subject, text, html }
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

    const customerEmails = uniqueEmails([
      booking.guestEmail,
      customerUser?.email,
    ])
    const customerEmailSet = new Set(customerEmails)
    const staffEmails = uniqueEmails(
      staffUsers.map((staff) => staff?.email),
    ).filter((email) => !customerEmailSet.has(email))

    if (customerEmails.length === 0 && staffEmails.length === 0) {
      return null
    }

    const from = getEnv('NOTIFICATION_FROM_EMAIL')
    const webAppUrl = normalizeWebAppUrl(getEnv('WEB_APP_URL'))
    const bookingCode = args.bookingId.slice(-6).toUpperCase()
    const paymentChannel = PAYMENT_CHANNEL_LABEL[args.channel]
    const hotelName = hotel?.name ?? 'the hotel'
    const roomNumber = room?.roomNumber ?? 'N/A'
    const guestName = booking.guestName?.trim() || 'Guest'
    const totalPriceUsd = (booking.totalPrice / 100).toFixed(2)

    const emailContext: PaymentEmailContext = {
      bookingCode,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      guestName,
      hotelName,
      paymentChannel,
      roomNumber,
      totalPriceUsd,
      webAppUrl,
    }

    const customerPayload = buildPaymentEmailPayload('customer', emailContext)
    const staffPayload = buildPaymentEmailPayload('staff', emailContext)

    const sendTasks = [
      ...customerEmails.map((to) =>
        resend.sendEmail(ctx, {
          from,
          to,
          subject: customerPayload.subject,
          text: customerPayload.text,
          html: customerPayload.html,
        }),
      ),
      ...staffEmails.map((to) =>
        resend.sendEmail(ctx, {
          from,
          to,
          subject: staffPayload.subject,
          text: staffPayload.text,
          html: staffPayload.html,
        }),
      ),
    ]

    await Promise.allSettled(sendTasks)

    return null
  },
})
