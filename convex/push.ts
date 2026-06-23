import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction } from './_generated/server'

// ---------------------------------------------------------------------------
// Expo push API
// ---------------------------------------------------------------------------

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send'
const MAX_MESSAGES_PER_REQUEST = 100

type ExpoPushMessage = {
  to: string
  sound: 'default'
  title: string
  body: string
  data?: unknown
  channelId: 'default'
  priority: 'high'
}

type ExpoPushTicket =
  | { status: 'ok'; id: string }
  | {
      status: 'error'
      message: string
      details?: { error?: string }
    }

type ExpoPushResponse = {
  data?: Array<ExpoPushTicket>
  errors?: Array<{ code: string; message: string }>
}

function chunk<T>(items: Array<T>, size: number): Array<Array<T>> {
  const out: Array<Array<T>> = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}

// Fire-and-forget action that pushes a single notification to every device
// belonging to `userId`. Token cleanup on DeviceNotRegistered is scheduled
// rather than awaited so transient failures don't block the user-visible flow.
export const sendExpoPush = internalAction({
  args: {
    userId: v.id('users'),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tokens = await ctx.runQuery(internal.pushTokens.getTokensForUser, {
      userId: args.userId,
    })

    const valid = tokens.filter((t) =>
      t.token.startsWith('ExponentPushToken['),
    )

    if (valid.length === 0) {
      return null
    }

    const messages: Array<ExpoPushMessage> = valid.map((t) => ({
      to: t.token,
      sound: 'default',
      title: args.title,
      body: args.body,
      data: args.data ?? {},
      channelId: 'default',
      priority: 'high',
    }))

    for (const batch of chunk(messages, MAX_MESSAGES_PER_REQUEST)) {
      try {
        const response = await fetch(EXPO_PUSH_ENDPOINT, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(batch),
        })

        if (!response.ok) {
          // Whole-request failure (rate limit, server error). Skip this batch.
          continue
        }

        const json = (await response.json()) as ExpoPushResponse
        const tickets = json.data ?? []

        for (let i = 0; i < tickets.length; i += 1) {
          const ticket = tickets[i]
          if (
            ticket.status === 'error' &&
            ticket.details?.error === 'DeviceNotRegistered'
          ) {
            const deadToken = batch[i].to
            await ctx.scheduler.runAfter(
              0,
              internal.pushTokens.deleteByToken,
              { token: deadToken },
            )
          }
        }
      } catch {
        // Network / parse errors are non-fatal — the in-app notification was
        // still inserted, so the user will see it on next app open.
        continue
      }
    }

    return null
  },
})
