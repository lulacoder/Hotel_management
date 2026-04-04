import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { internal } from './_generated/api'

const http = httpRouter()

// Endpoint handling the Clerk webhook callbacks (e.g. for user creation).
// Validates Svix signatures and delegates processing to `clerk.verifyAndProcessWebhook`.
http.route({
  path: '/clerk',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const svixId = request.headers.get('svix-id')
    const svixTimestamp = request.headers.get('svix-timestamp')
    const svixSignature = request.headers.get('svix-signature')

    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response('Missing Svix headers', { status: 400 })
    }

    const body = await request.text()

    try {
      await ctx.runAction(internal.clerk.verifyAndProcessWebhook, {
        body,
        svixId,
        svixTimestamp,
        svixSignature,
      })
      return new Response('OK', { status: 200 })
    } catch (error) {
      console.error('Clerk webhook error:', error)
      return new Response('Webhook verification failed', { status: 400 })
    }
  }),
})

http.route({
  path: '/chapa/webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const body = await request.text()

    const result = await ctx.runAction(internal.chapaActions.processWebhook, {
      body,
      chapaSignature: request.headers.get('chapa-signature') ?? undefined,
      xChapaSignature: request.headers.get('x-chapa-signature') ?? undefined,
    })

    return new Response(result.body, { status: result.statusCode })
  }),
})

http.route({
  path: '/chapa/callback',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url)
    const txRef = url.searchParams.get('tx_ref') ?? url.searchParams.get('trx_ref')

    if (!txRef) {
      return new Response('Missing tx_ref', { status: 400 })
    }

    const result = await ctx.runAction(internal.chapaActions.processCallback, {
      refId: url.searchParams.get('ref_id') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
      txRef,
    })

    return new Response(result.body, { status: result.statusCode })
  }),
})

http.route({
  path: '/chapa/mobile-return',
  method: 'GET',
  handler: httpAction(async (_ctx, request) => {
    const url = new URL(request.url)
    const txRef = url.searchParams.get('tx_ref') ?? url.searchParams.get('trx_ref')
    const mobileReturnBaseUrl = process.env.MOBILE_APP_RETURN_URL_BASE

    if (!txRef) {
      return new Response('Missing tx_ref', { status: 400 })
    }

    if (!mobileReturnBaseUrl) {
      return new Response('MOBILE_APP_RETURN_URL_BASE is not configured', {
        status: 500,
      })
    }

    const redirectUrl = new URL(mobileReturnBaseUrl)
    redirectUrl.searchParams.set('payment', 'processing')
    redirectUrl.searchParams.set('tx_ref', txRef)

    const status = url.searchParams.get('status')
    if (status) {
      redirectUrl.searchParams.set('status', status)
    }

    const refId = url.searchParams.get('ref_id')
    if (refId) {
      redirectUrl.searchParams.set('ref_id', refId)
    }

    return Response.redirect(redirectUrl.toString(), 302)
  }),
})

export default http
