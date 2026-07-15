import { v } from 'convex/values'

import { internalMutation } from './_generated/server'
import { resend } from './paymentEmails'

function getEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not configured`)
  return value
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

function getRoleLabel(role: 'hotel_admin' | 'hotel_cashier') {
  return role === 'hotel_admin' ? 'Hotel Administrator' : 'Hotel Cashier'
}

// Enqueues a branded English invitation through the existing durable Resend
// component. The opaque token is used only to construct this one email link.
export const enqueue = internalMutation({
  args: {
    invitationId: v.id('hotelStaffInvitations'),
    email: v.string(),
    hotelName: v.string(),
    hotelCity: v.string(),
    role: v.union(v.literal('hotel_admin'), v.literal('hotel_cashier')),
    invitedByEmail: v.string(),
    expiresAt: v.number(),
    token: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const webAppUrl = normalizeWebAppUrl(getEnv('WEB_APP_URL'))
    const invitationUrl = new URL(
      `/staff-invitations/${args.invitationId}`,
      `${webAppUrl}/`,
    )
    invitationUrl.searchParams.set('token', args.token)

    const roleLabel = getRoleLabel(args.role)
    const expiry = new Date(args.expiresAt).toUTCString()
    const subject = `Invitation to join ${args.hotelName} as ${roleLabel}`
    const text = [
      'You have been invited to join the TripWays Hotels staff portal.',
      '',
      `Hotel: ${args.hotelName}, ${args.hotelCity}`,
      `Role: ${roleLabel}`,
      `Invited by: ${args.invitedByEmail}`,
      `Invitation expires: ${expiry}`,
      '',
      `Accept invitation: ${invitationUrl.toString()}`,
      '',
      `This invitation is intended for ${args.email}. Sign in or create an account with this exact email address.`,
      'If you were not expecting this invitation, you can ignore this email.',
    ].join('\n')
    const html = `
      <div style="margin:0;padding:32px 12px;background:#020617;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;margin:0 auto;background:#0f172a;border:1px solid #334155;border-radius:18px;overflow:hidden;font-family:'DM Sans','Segoe UI',sans-serif;color:#e2e8f0;">
          <tr>
            <td style="padding:24px;background:#5b21b6;">
              <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#ddd6fe;font-weight:700;">TripWays Hotels</div>
              <div style="margin-top:8px;font-size:25px;line-height:1.25;color:#fff;font-weight:750;">You are invited to the hotel team</div>
            </td>
          </tr>
          <tr>
            <td style="padding:26px;">
              <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#cbd5e1;">A staff administrator has invited you to access the TripWays Hotels operations portal.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #334155;border-radius:12px;background:#0b1220;">
                <tr><td style="padding:12px 14px;color:#94a3b8;font-size:13px;font-weight:700;width:34%;border-bottom:1px solid #334155;">Hotel</td><td style="padding:12px 14px;color:#f8fafc;font-size:14px;border-bottom:1px solid #334155;">${escapeHtml(args.hotelName)}, ${escapeHtml(args.hotelCity)}</td></tr>
                <tr><td style="padding:12px 14px;color:#94a3b8;font-size:13px;font-weight:700;border-bottom:1px solid #334155;">Role</td><td style="padding:12px 14px;color:#f8fafc;font-size:14px;border-bottom:1px solid #334155;">${escapeHtml(roleLabel)}</td></tr>
                <tr><td style="padding:12px 14px;color:#94a3b8;font-size:13px;font-weight:700;">Expires</td><td style="padding:12px 14px;color:#f8fafc;font-size:14px;">${escapeHtml(expiry)}</td></tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:22px;"><tr><td style="border-radius:10px;background:#8b5cf6;"><a href="${escapeHtml(invitationUrl.toString())}" style="display:inline-block;padding:12px 20px;color:#fff;text-decoration:none;font-size:14px;font-weight:750;">Accept invitation</a></td></tr></table>
              <p style="margin:20px 0 0;font-size:12px;line-height:1.65;color:#94a3b8;">This invitation is intended for ${escapeHtml(args.email)}. Sign in or create an account with this exact email. If you were not expecting it, you can safely ignore this message.</p>
            </td>
          </tr>
        </table>
      </div>
    `

    const emailId = await resend.sendEmail(ctx, {
      from: getEnv('NOTIFICATION_FROM_EMAIL'),
      to: args.email,
      subject,
      text,
      html,
    })
    return String(emailId)
  },
})
