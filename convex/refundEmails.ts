import { v } from 'convex/values'

import { internalMutation } from './_generated/server'
import { resend } from './paymentEmails'

type RefundEmailContext = {
  bookingCode: string
  checkIn: string
  checkOut: string
  guestName: string
  hotelName: string
  refundAmountEtb: string
  refundRefId: string
  roomNumber: string
  webAppUrl: string
}

// Reads a required deployment environment variable
function getEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not configured`)
  }

  return value
}

// Lowercases and trims an address, returning null when nothing usable remains
function normalizeEmail(email: string | null | undefined) {
  if (!email) {
    return null
  }

  const normalized = email.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

// Collapses a recipient list to distinct usable addresses in first-seen order
function uniqueEmails(emails: Array<string | null | undefined>) {
  const seen = new Set<string>()
  const result: Array<string> = []

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

// Escapes interpolated values so booking data cannot inject markup
function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

// Validates the configured web app origin and strips any trailing slash
function normalizeWebAppUrl(rawUrl: string) {
  const trimmed = rawUrl.trim()
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('WEB_APP_URL must start with http:// or https://')
  }

  return trimmed.replace(/\/+$/, '')
}

// Joins the web app origin to a path with exactly one separator
function buildUrl(baseUrl: string, path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${baseUrl}${normalizedPath}`
}

// Renders the administrator email announcing that Chapa accepted a refund
function buildRefundAcceptedPayload(context: RefundEmailContext) {
  const subject = `Chapa accepted the refund for booking #${context.bookingCode}`
  const headline = 'Chapa accepted this refund'
  const summary =
    'Chapa has taken the refund request and is settling it. No further action is needed unless the refund is later reversed, in which case you will be alerted.'
  const ctaLabel = 'Open Booking Dashboard'
  const ctaHref = buildUrl(context.webAppUrl, '/admin/bookings')
  const roleNote =
    'You are receiving this because you administer this hotel or requested this refund.'
  const closing =
    'Chapa charges on the original payment are not returned, and the refund is drawn from your available balance.'

  const rows: Array<[string, string]> = [
    ['Booking', `#${context.bookingCode}`],
    ['Guest', context.guestName],
    ['Hotel', context.hotelName],
    ['Room', context.roomNumber],
    ['Stay', `${context.checkIn} to ${context.checkOut}`],
    ['Refund amount', `ETB ${context.refundAmountEtb}`],
    ['Chapa reference', context.refundRefId],
  ]

  const text = [
    'Hello team,',
    '',
    `${headline}.`,
    summary,
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    `${ctaLabel}: ${ctaHref}`,
    roleNote,
    '',
    closing,
  ].join('\n')

  const rowsHtml = rows
    .map(([label, value], index) => {
      const divider =
        index < rows.length - 1 ? 'border-bottom:1px solid #334155;' : ''
      return `
              <tr>
                <td style="padding:10px 14px;${divider}font-size:13px;color:#94a3b8;font-weight:700;width:40%;">${escapeHtml(label)}</td>
                <td style="padding:10px 14px;${divider}font-size:13px;color:#f8fafc;">${escapeHtml(value)}</td>
              </tr>`
    })
    .join('')

  const html = `
    <div style="margin:0;padding:28px 12px;background:#020617;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;margin:0 auto;background:#0f172a;border:1px solid #334155;border-radius:16px;overflow:hidden;font-family:'DM Sans','Segoe UI',Arial,sans-serif;color:#e2e8f0;">
        <tr>
          <td style="padding:22px 24px;background:linear-gradient(135deg,#8b5cf6 0%,#7c3aed 52%,#5b21b6 100%);">
            <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#ede9fe;font-weight:700;">Hotel Booking Refund</div>
            <div style="margin-top:8px;font-size:22px;line-height:1.3;color:#ffffff;font-weight:700;font-family:'Outfit','DM Sans','Segoe UI',Arial,sans-serif;">
              ${escapeHtml(headline)}
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;">
            <p style="margin:0 0 12px;font-size:16px;line-height:1.6;color:#f8fafc;">Hello team,</p>
            <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#cbd5e1;">${escapeHtml(summary)}</p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #334155;border-radius:12px;overflow:hidden;background:#0b1220;">
              <tr>
                <td colspan="2" style="padding:12px 14px;background:#312e81;border-bottom:1px solid #4338ca;font-size:13px;font-weight:700;color:#ddd6fe;text-transform:uppercase;letter-spacing:0.06em;">
                  Refund details
                </td>
              </tr>${rowsHtml}
            </table>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:22px;">
              <tr>
                <td style="border-radius:10px;background:#7c3aed;box-shadow:0 14px 26px -18px rgba(139,92,246,0.9);">
                  <a href="${escapeHtml(ctaHref)}" style="display:inline-block;padding:11px 18px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">
                    ${escapeHtml(ctaLabel)}
                  </a>
                </td>
              </tr>
            </table>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:18px;width:100%;border:1px solid #334155;border-radius:10px;background:#1e293b;">
              <tr>
                <td style="padding:14px 14px 12px;font-size:14px;line-height:1.7;color:#e2e8f0;">${escapeHtml(closing)}</td>
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

// Emails the hotel's administrators once Chapa has accepted a refund request.
// Scheduled from recordRefundAcceptance so the mail only goes out for a refund
// Chapa actually took, never for a rejected or ambiguous attempt.
export const sendRefundAcceptedEmails = internalMutation({
  args: {
    bookingId: v.id('bookings'),
    refundRefId: v.string(),
    refundAmountMinor: v.number(),
    requestedBy: v.optional(v.id('users')),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) {
      return null
    }

    const [hotel, room, requester, staffAssignments] = await Promise.all([
      ctx.db.get(booking.hotelId),
      ctx.db.get(booking.roomId),
      args.requestedBy ? ctx.db.get(args.requestedBy) : Promise.resolve(null),
      ctx.db
        .query('hotelStaff')
        .withIndex('by_hotel', (q) => q.eq('hotelId', booking.hotelId))
        .collect(),
    ])

    // Cashiers cannot act on a refund, so only administrators are told
    const adminUsers = await Promise.all(
      staffAssignments
        .filter((assignment) => assignment.role === 'hotel_admin')
        .map((assignment) => ctx.db.get(assignment.userId)),
    )

    // Include whoever pressed the button so a global admin acting on a hotel
    // with no assigned administrator still gets the confirmation
    const recipients = uniqueEmails([
      ...adminUsers.map((admin) => admin?.email),
      requester?.email,
    ])

    if (recipients.length === 0) {
      return null
    }

    const payload = buildRefundAcceptedPayload({
      bookingCode: args.bookingId.slice(-6).toUpperCase(),
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      guestName: booking.guestName?.trim() || 'Guest',
      hotelName: hotel?.name ?? 'the hotel',
      refundAmountEtb: (args.refundAmountMinor / 100).toFixed(2),
      refundRefId: args.refundRefId,
      roomNumber: room?.roomNumber ?? 'N/A',
      webAppUrl: normalizeWebAppUrl(getEnv('WEB_APP_URL')),
    })

    const from = getEnv('NOTIFICATION_FROM_EMAIL')

    await Promise.allSettled(
      recipients.map((to) =>
        resend.sendEmail(ctx, {
          from,
          to,
          subject: payload.subject,
          text: payload.text,
          html: payload.html,
        }),
      ),
    )

    return null
  },
})
