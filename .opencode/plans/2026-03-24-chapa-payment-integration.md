# Chapa Payment Integration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Chapa as an online payment option alongside the existing manual bank transfer flow, allowing customers to choose their preferred payment method after holding a room.

**Architecture:**

- **Frontend:** Add payment method selection (Chapa vs Bank Transfer) to step 3 of BookingModal. Chapa option redirects to hosted checkout, returns to /bookings?payment=success.
- **Backend:** Create Node.js actions for Chapa API calls, HTTP endpoint for webhooks, internal mutations for payment state management. Webhook auto-confirms payments with double verification.
- **Data:** New `chapaPayments` table tracks Chapa-specific transaction data; `bookings` table gets updated on webhook confirmation.

**Tech Stack:** Convex (actions, HTTP endpoints, mutations), Chapa REST API (ETB currency), TanStack Start, React, TypeScript

---

## File Structure

| File                                                      | Purpose                                                      |
| --------------------------------------------------------- | ------------------------------------------------------------ |
| `convex/schema.ts`                                        | Add `chapaPayments` table definition                         |
| `convex/chapaActions.ts`                                  | **NEW** - Node.js actions for Chapa API (initialize, verify) |
| `convex/chapaInternal.ts`                                 | **NEW** - Internal mutations for payment record management   |
| `convex/chapaWebhook.ts`                                  | **NEW** - Webhook signature verification action              |
| `convex/chapaQueries.ts`                                  | **NEW** - Public queries for admin payment details           |
| `convex/http.ts`                                          | Add `/chapa` webhook route                                   |
| `convex/bookings.ts`                                      | Add internal query and `confirmChapaPayment` mutation        |
| `src/routes/hotels.$hotelId/components/-BookingModal.tsx` | Add payment method selection UI                              |
| `src/routes/_authenticated/bookings.tsx`                  | Handle ?payment=success query param                          |
| `src/lib/i18n/en.ts`                                      | Add Chapa-related translations                               |
| `src/lib/i18n/am.ts`                                      | Add Chapa-related translations (Amharic)                     |

---

## Chunk 1: Database Schema and Types

### Task 1: Add chapaPayments table to schema

**Files:**

- Modify: `convex/schema.ts:280-300`

- [ ] **Step 1: Read current schema end section**

Verify the current end of schema.ts to understand insertion point.

- [ ] **Step 2: Add chapaPayments table definition**

Add before the closing `})`:

```typescript
  // Chapa payment transactions
  chapaPayments: defineTable({
    bookingId: v.id('bookings'),
    txRef: v.string(), // Our unique reference (idempotency key)
    chapaReference: v.optional(v.string()), // Chapa's reference ID
    amount: v.number(), // In cents (matches booking.totalPrice)
    currency: v.literal('ETB'),
    status: v.union(
      v.literal('pending'), // Payment initialized
      v.literal('success'), // Webhook confirmed
      v.literal('failed'),
      v.literal('cancelled'),
      v.literal('refunded'),
    ),
    paymentMethod: v.optional(v.string()), // "telebirr", "cbebirr", "card", etc.
    checkoutUrl: v.optional(v.string()), // For retries/admin reference
    webhookReceivedAt: v.optional(v.number()), // When webhook was processed
    webhookPayload: v.optional(v.any()), // Raw webhook data for debugging
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_booking', ['bookingId'])
    .index('by_tx_ref', ['txRef'])
    .index('by_status', ['status']),
```

- [ ] **Step 3: Run Convex codegen to verify schema**

Run: `npx convex dev --once`
Expected: Schema compiles without errors, new table types generated

- [ ] **Step 4: Commit schema changes**

```bash
git add convex/schema.ts
git commit -m "feat(schema): add chapaPayments table for Chapa integration"
```

---

## Chunk 2: Chapa Internal Mutations

### Task 2: Create internal mutations for payment record management

**Files:**

- Create: `convex/chapaInternal.ts`

- [ ] **Step 1: Create chapaInternal.ts with createPaymentRecord mutation**

```typescript
import { v } from 'convex/values'
import { internalMutation, internalQuery } from './_generated/server'

// Status validator for Chapa payments
const chapaPaymentStatusValidator = v.union(
  v.literal('pending'),
  v.literal('success'),
  v.literal('failed'),
  v.literal('cancelled'),
  v.literal('refunded'),
)

// Validator for chapaPayments document
export const chapaPaymentValidator = v.object({
  _id: v.id('chapaPayments'),
  _creationTime: v.number(),
  bookingId: v.id('bookings'),
  txRef: v.string(),
  chapaReference: v.optional(v.string()),
  amount: v.number(),
  currency: v.literal('ETB'),
  status: chapaPaymentStatusValidator,
  paymentMethod: v.optional(v.string()),
  checkoutUrl: v.optional(v.string()),
  webhookReceivedAt: v.optional(v.number()),
  webhookPayload: v.optional(v.any()),
  createdAt: v.number(),
  updatedAt: v.number(),
})

// Creates a pending Chapa payment record when payment is initialized
export const createPaymentRecord = internalMutation({
  args: {
    bookingId: v.id('bookings'),
    txRef: v.string(),
    amount: v.number(),
    checkoutUrl: v.string(),
  },
  returns: v.id('chapaPayments'),
  handler: async (ctx, args) => {
    const now = Date.now()

    return await ctx.db.insert('chapaPayments', {
      bookingId: args.bookingId,
      txRef: args.txRef,
      amount: args.amount,
      currency: 'ETB',
      status: 'pending',
      checkoutUrl: args.checkoutUrl,
      createdAt: now,
      updatedAt: now,
    })
  },
})

// Query payment by tx_ref (used by webhook handler)
export const getByTxRef = internalQuery({
  args: {
    txRef: v.string(),
  },
  returns: v.union(chapaPaymentValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('chapaPayments')
      .withIndex('by_tx_ref', (q) => q.eq('txRef', args.txRef))
      .unique()
  },
})

// Query payment by booking ID (for admin view)
export const getByBooking = internalQuery({
  args: {
    bookingId: v.id('bookings'),
  },
  returns: v.union(chapaPaymentValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('chapaPayments')
      .withIndex('by_booking', (q) => q.eq('bookingId', args.bookingId))
      .order('desc')
      .first()
  },
})

// Mark payment as successful (called after webhook verification)
export const markPaymentSuccess = internalMutation({
  args: {
    txRef: v.string(),
    chapaReference: v.string(),
    paymentMethod: v.optional(v.string()),
    webhookPayload: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query('chapaPayments')
      .withIndex('by_tx_ref', (q) => q.eq('txRef', args.txRef))
      .unique()

    if (!payment) {
      console.error(`Chapa payment not found for tx_ref: ${args.txRef}`)
      return null
    }

    // Idempotency: skip if already processed
    if (payment.status === 'success') {
      console.log(`Payment ${args.txRef} already marked as success, skipping`)
      return null
    }

    const now = Date.now()

    await ctx.db.patch(payment._id, {
      status: 'success',
      chapaReference: args.chapaReference,
      paymentMethod: args.paymentMethod,
      webhookReceivedAt: now,
      webhookPayload: args.webhookPayload,
      updatedAt: now,
    })

    return null
  },
})

// Mark payment as failed
export const markPaymentFailed = internalMutation({
  args: {
    txRef: v.string(),
    webhookPayload: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query('chapaPayments')
      .withIndex('by_tx_ref', (q) => q.eq('txRef', args.txRef))
      .unique()

    if (!payment) {
      console.error(`Chapa payment not found for tx_ref: ${args.txRef}`)
      return null
    }

    // Idempotency: skip if already in terminal state
    if (payment.status === 'success' || payment.status === 'failed') {
      console.log(
        `Payment ${args.txRef} already in terminal state: ${payment.status}`,
      )
      return null
    }

    const now = Date.now()

    await ctx.db.patch(payment._id, {
      status: 'failed',
      webhookReceivedAt: now,
      webhookPayload: args.webhookPayload,
      updatedAt: now,
    })

    return null
  },
})
```

- [ ] **Step 2: Run Convex codegen**

Run: `npx convex dev --once`
Expected: Compiles without errors

- [ ] **Step 3: Commit internal mutations**

```bash
git add convex/chapaInternal.ts
git commit -m "feat(chapa): add internal mutations for payment record management"
```

---

## Chunk 3: Chapa Node.js Actions

### Task 3: Create Chapa API actions

**Files:**

- Create: `convex/chapaActions.ts`

- [ ] **Step 1: Create chapaActions.ts with initializePayment action**

```typescript
'use node'

import { v, ConvexError } from 'convex/values'
import { internalAction, action } from './_generated/server'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'

// Chapa API base URL
const CHAPA_API_BASE = 'https://api.chapa.co/v1'

// Response types from Chapa API
interface ChapaInitializeResponse {
  message: string
  status: string
  data?: {
    checkout_url: string
  }
}

interface ChapaVerifyResponse {
  message: string
  status: string
  data?: {
    first_name: string
    last_name: string
    email: string
    currency: string
    amount: string
    charge: string
    mode: string
    method: string
    type: string
    status: string
    reference: string
    tx_ref: string
    customization: {
      title: string | null
      description: string | null
      logo: string | null
    }
    meta: unknown
    created_at: string
    updated_at: string
  }
}

// Generate unique transaction reference
function generateTxRef(bookingId: Id<'bookings'>): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `booking_${bookingId}_${timestamp}_${random}`
}

// Initialize a Chapa payment transaction
// Called from frontend after room is held
export const initializePayment = action({
  args: {
    bookingId: v.id('bookings'),
  },
  returns: v.object({
    success: v.boolean(),
    checkoutUrl: v.optional(v.string()),
    txRef: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Get authenticated user
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({
        code: 'UNAUTHORIZED',
        message: 'You must be logged in to make a payment',
      })
    }

    // Verify environment variables
    const secretKey = process.env.CHAPA_SECRET_KEY
    if (!secretKey) {
      console.error('CHAPA_SECRET_KEY not set')
      return {
        success: false,
        error: 'Payment system not configured',
      }
    }

    // Get booking details
    const booking = await ctx.runQuery(internal.bookings.getBookingById, {
      bookingId: args.bookingId,
    })

    if (!booking) {
      throw new ConvexError({
        code: 'NOT_FOUND',
        message: 'Booking not found',
      })
    }

    // Verify booking is in held status
    if (booking.status !== 'held') {
      throw new ConvexError({
        code: 'INVALID_STATE',
        message: `Cannot pay for booking in ${booking.status} status`,
      })
    }

    // Generate unique tx_ref
    const txRef = generateTxRef(args.bookingId)

    // Amount in ETB (convert from cents to birr)
    const amountInBirr = (booking.totalPrice / 100).toFixed(2)

    // Get return URL from environment or use default
    const baseUrl = process.env.APP_URL || 'http://localhost:3000'
    const returnUrl = `${baseUrl}/bookings?payment=success&tx_ref=${txRef}`
    const callbackUrl = `${process.env.CONVEX_SITE_URL}/chapa`

    // Prepare Chapa request payload
    const payload = {
      amount: amountInBirr,
      currency: 'ETB',
      email: booking.guestEmail || identity.email || '',
      first_name: booking.guestName?.split(' ')[0] || 'Guest',
      last_name: booking.guestName?.split(' ').slice(1).join(' ') || '',
      tx_ref: txRef,
      return_url: returnUrl,
      callback_url: callbackUrl,
      customization: {
        title: 'Hotel Booking Payment',
        description: `Room booking from ${booking.checkIn} to ${booking.checkOut}`,
      },
    }

    try {
      // Call Chapa initialize API
      const response = await fetch(`${CHAPA_API_BASE}/transaction/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secretKey}`,
        },
        body: JSON.stringify(payload),
      })

      const data: ChapaInitializeResponse = await response.json()

      if (data.status !== 'success' || !data.data?.checkout_url) {
        console.error('Chapa initialization failed:', data)
        return {
          success: false,
          error: data.message || 'Failed to initialize payment',
        }
      }

      // Store payment record
      await ctx.runMutation(internal.chapaInternal.createPaymentRecord, {
        bookingId: args.bookingId,
        txRef,
        amount: booking.totalPrice,
        checkoutUrl: data.data.checkout_url,
      })

      return {
        success: true,
        checkoutUrl: data.data.checkout_url,
        txRef,
      }
    } catch (error) {
      console.error('Chapa API error:', error)
      return {
        success: false,
        error: 'Failed to connect to payment service',
      }
    }
  },
})

// Verify a transaction with Chapa API (called by webhook handler)
export const verifyTransaction = internalAction({
  args: {
    txRef: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    status: v.optional(v.string()),
    amount: v.optional(v.string()),
    paymentMethod: v.optional(v.string()),
    reference: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const secretKey = process.env.CHAPA_SECRET_KEY
    if (!secretKey) {
      console.error('CHAPA_SECRET_KEY not set')
      return { success: false }
    }

    try {
      const response = await fetch(
        `${CHAPA_API_BASE}/transaction/verify/${args.txRef}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${secretKey}`,
          },
        },
      )

      const data: ChapaVerifyResponse = await response.json()

      if (data.status !== 'success' || !data.data) {
        console.error('Chapa verification failed:', data)
        return { success: false }
      }

      return {
        success: true,
        status: data.data.status,
        amount: data.data.amount,
        paymentMethod: data.data.method,
        reference: data.data.reference,
      }
    } catch (error) {
      console.error('Chapa verify API error:', error)
      return { success: false }
    }
  },
})
```

- [ ] **Step 2: Run Convex codegen**

Run: `npx convex dev --once`
Expected: Compiles without errors

- [ ] **Step 3: Commit Chapa actions**

```bash
git add convex/chapaActions.ts
git commit -m "feat(chapa): add Node.js actions for Chapa API integration"
```

---

## Chunk 4: Internal Booking Query and Confirmation

### Task 4: Add internal query and confirmation mutation to bookings

**Files:**

- Modify: `convex/bookings.ts`

- [ ] **Step 1: Add internalQuery and internalMutation imports**

Ensure the import at the top includes both:

```typescript
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
} from './_generated/server'
```

- [ ] **Step 2: Add internal query at the end of bookings.ts**

Add these near the end of the file:

```typescript
// ---------------------------------------------------------------------------
// Internal Queries and Mutations (for use by actions)
// ---------------------------------------------------------------------------

// Internal query to get booking by ID (used by Chapa actions)
export const getBookingById = internalQuery({
  args: {
    bookingId: v.id('bookings'),
  },
  returns: v.union(bookingValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.bookingId)
  },
})

// Internal mutation to confirm booking after Chapa payment
// Called by webhook handler after payment verification
export const confirmChapaPayment = internalMutation({
  args: {
    bookingId: v.id('bookings'),
    chapaReference: v.string(),
    paymentMethod: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId)
    if (!booking) {
      console.error(`Booking not found: ${args.bookingId}`)
      return null
    }

    // Idempotency: skip if already confirmed
    if (booking.status === 'confirmed' && booking.paymentStatus === 'paid') {
      console.log(`Booking ${args.bookingId} already confirmed, skipping`)
      return null
    }

    // Only confirm if booking is in held status
    if (booking.status !== 'held') {
      console.error(`Cannot confirm booking in ${booking.status} status`)
      return null
    }

    const now = Date.now()

    // Update booking to confirmed
    await ctx.db.patch(args.bookingId, {
      status: 'confirmed',
      paymentStatus: 'paid',
      transactionId: args.chapaReference,
      holdExpiresAt: undefined, // Clear hold expiration
      updatedAt: now,
    })

    // Send notification to customer
    if (booking.userId) {
      await ctx.runMutation(internal.notificationsInternal.create, {
        userId: booking.userId,
        type: 'booking_confirmed',
        bookingId: args.bookingId,
        hotelId: booking.hotelId,
        message: `Your booking has been confirmed! Payment received via Chapa.`,
      })
    }

    console.log(`Booking ${args.bookingId} confirmed via Chapa payment`)
    return null
  },
})
```

- [ ] **Step 3: Run Convex codegen**

Run: `npx convex dev --once`
Expected: Compiles without errors

- [ ] **Step 4: Commit booking changes**

```bash
git add convex/bookings.ts
git commit -m "feat(bookings): add internal query and Chapa payment confirmation"
```

---

## Chunk 5: Webhook Signature Verification

### Task 5: Create webhook signature verification action

**Files:**

- Create: `convex/chapaWebhook.ts`

- [ ] **Step 1: Create chapaWebhook.ts**

```typescript
'use node'

import { v } from 'convex/values'
import { internalAction } from './_generated/server'
import * as crypto from 'crypto'

// Verify Chapa webhook signature
// Chapa sends signature as HMAC SHA256 of the payload
export const verifySignature = internalAction({
  args: {
    body: v.string(),
    chapaSignature: v.optional(v.string()),
    xChapaSignature: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const webhookSecret = process.env.CHAPA_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('CHAPA_WEBHOOK_SECRET not set')
      // In development, allow unsigned webhooks for testing
      if (process.env.NODE_ENV === 'development') {
        console.warn('Allowing unsigned webhook in development mode')
        return true
      }
      return false
    }

    // Chapa sends signature in 'chapa-signature' header (HMAC of secret key)
    // and 'x-chapa-signature' header (HMAC of payload)
    // We need to verify at least one of them

    // Verify x-chapa-signature (HMAC of payload)
    if (args.xChapaSignature) {
      const expectedPayloadSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(args.body)
        .digest('hex')

      if (args.xChapaSignature === expectedPayloadSignature) {
        return true
      }
    }

    // Verify chapa-signature (HMAC of secret key itself)
    if (args.chapaSignature) {
      const expectedKeySignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(webhookSecret)
        .digest('hex')

      if (args.chapaSignature === expectedKeySignature) {
        return true
      }
    }

    // Neither signature matched
    console.error('Chapa webhook signature verification failed')
    return false
  },
})
```

- [ ] **Step 2: Run Convex codegen**

Run: `npx convex dev --once`
Expected: Compiles without errors

- [ ] **Step 3: Commit webhook verification**

```bash
git add convex/chapaWebhook.ts
git commit -m "feat(chapa): add webhook signature verification action"
```

---

## Chunk 6: HTTP Webhook Endpoint

### Task 6: Add Chapa webhook HTTP endpoint

**Files:**

- Modify: `convex/http.ts`

- [ ] **Step 1: Add Chapa webhook route to http.ts**

Add after the Clerk webhook route (before `export default http`):

```typescript
// Chapa webhook endpoint for payment notifications
// Validates HMAC signature and processes payment events
http.route({
  path: '/chapa',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    // Get signature from headers
    const chapaSignature = request.headers.get('chapa-signature')
    const xChapaSignature = request.headers.get('x-chapa-signature')

    // Get raw body for signature verification
    const body = await request.text()

    // Parse the webhook payload
    let payload: {
      event?: string
      tx_ref?: string
      reference?: string
      status?: string
      amount?: string
      payment_method?: string
    }

    try {
      payload = JSON.parse(body)
    } catch {
      console.error('Chapa webhook: Invalid JSON body')
      return new Response('Invalid JSON', { status: 400 })
    }

    // Log incoming webhook for debugging
    console.log('Chapa webhook received:', {
      event: payload.event,
      tx_ref: payload.tx_ref,
      status: payload.status,
    })

    // Verify signature using the action
    const isValid = await ctx.runAction(internal.chapaWebhook.verifySignature, {
      body,
      chapaSignature: chapaSignature || undefined,
      xChapaSignature: xChapaSignature || undefined,
    })

    if (!isValid) {
      console.error('Chapa webhook: Invalid signature')
      return new Response('Invalid signature', { status: 400 })
    }

    // Handle different event types
    const event = payload.event
    const txRef = payload.tx_ref

    if (!txRef) {
      console.error('Chapa webhook: Missing tx_ref')
      return new Response('Missing tx_ref', { status: 400 })
    }

    if (event === 'charge.success') {
      // Double-verify with Chapa API
      const verification = await ctx.runAction(
        internal.chapaActions.verifyTransaction,
        {
          txRef,
        },
      )

      if (!verification.success || verification.status !== 'success') {
        console.error('Chapa webhook: Verification failed for', txRef)
        return new Response('Verification failed', { status: 400 })
      }

      // Get payment record to find booking
      const payment = await ctx.runQuery(internal.chapaInternal.getByTxRef, {
        txRef,
      })

      if (!payment) {
        console.error('Chapa webhook: Payment record not found for', txRef)
        return new Response('Payment not found', { status: 404 })
      }

      // Update payment record
      await ctx.runMutation(internal.chapaInternal.markPaymentSuccess, {
        txRef,
        chapaReference: verification.reference || payload.reference || '',
        paymentMethod: verification.paymentMethod || payload.payment_method,
        webhookPayload: payload,
      })

      // Confirm the booking
      await ctx.runMutation(internal.bookings.confirmChapaPayment, {
        bookingId: payment.bookingId,
        chapaReference: verification.reference || payload.reference || '',
        paymentMethod: verification.paymentMethod || payload.payment_method,
      })

      console.log('Chapa webhook: Payment confirmed for', txRef)
    } else if (event === 'charge.failed' || event === 'charge.cancelled') {
      // Mark payment as failed
      await ctx.runMutation(internal.chapaInternal.markPaymentFailed, {
        txRef,
        webhookPayload: payload,
      })

      console.log('Chapa webhook: Payment failed for', txRef)
    }

    return new Response('OK', { status: 200 })
  }),
})
```

- [ ] **Step 2: Run Convex codegen**

Run: `npx convex dev --once`
Expected: Compiles without errors

- [ ] **Step 3: Commit HTTP route**

```bash
git add convex/http.ts
git commit -m "feat(http): add Chapa webhook endpoint for payment notifications"
```

---

## Chunk 7: Admin Payment Details Query

### Task 7: Create public query for admin payment details

**Files:**

- Create: `convex/chapaQueries.ts`

- [ ] **Step 1: Create chapaQueries.ts**

```typescript
import { v } from 'convex/values'
import { query } from './_generated/server'
import { requireHotelAccess } from './lib/auth'
import { chapaPaymentValidator } from './chapaInternal'

// Get Chapa payment details for a booking (admin access)
export const getPaymentForBooking = query({
  args: {
    bookingId: v.id('bookings'),
    hotelId: v.id('hotels'),
  },
  returns: v.union(chapaPaymentValidator, v.null()),
  handler: async (ctx, args) => {
    // Verify admin has access to the hotel
    await requireHotelAccess(ctx, args.hotelId)

    return await ctx.db
      .query('chapaPayments')
      .withIndex('by_booking', (q) => q.eq('bookingId', args.bookingId))
      .order('desc')
      .first()
  },
})
```

- [ ] **Step 2: Run Convex codegen**

Run: `npx convex dev --once`
Expected: Compiles without errors

- [ ] **Step 3: Commit admin queries**

```bash
git add convex/chapaQueries.ts
git commit -m "feat(chapa): add public query for admin payment details"
```

---

## Chunk 8: Frontend Translations

### Task 8: Add Chapa translations

**Files:**

- Modify: `src/lib/i18n/en.ts`
- Modify: `src/lib/i18n/am.ts`

- [ ] **Step 1: Add English translations**

Find the `bookingModal` section and add these keys:

```typescript
// Chapa payment
selectPaymentMethod: 'Select Payment Method',
payWithChapa: 'Pay Online with Chapa',
chapaDescription: 'Pay instantly with telebirr, CBE Birr, or card',
payWithBank: 'Bank Transfer',
bankDescription: 'Transfer to hotel bank account manually',
chapaRedirectNotice: 'You will be redirected to Chapa to complete your payment securely.',
proceedToChapa: 'Proceed to Payment',
redirectingToChapa: 'Redirecting...',
chapaError: 'Failed to initialize payment. Please try again.',
paymentSuccessTitle: 'Payment Successful!',
paymentSuccessMessage: 'Your booking has been confirmed.',
```

- [ ] **Step 2: Add Amharic translations**

Add corresponding Amharic translations:

```typescript
// Chapa payment
selectPaymentMethod: 'የክፍያ ዘዴ ይምረጡ',
payWithChapa: 'በቻፓ በመስመር ላይ ይክፈሉ',
chapaDescription: 'በቴሌብር፣ ሲቢኢ ብር ወይም ካርድ ወዲያውኑ ይክፈሉ',
payWithBank: 'የባንክ ዝውውር',
bankDescription: 'ወደ ሆቴል ባንክ አካውንት በእጅ ያስተላልፉ',
chapaRedirectNotice: 'ክፍያዎን በሚገባ ለማጠናቀቅ ወደ ቻፓ ይዛወራሉ።',
proceedToChapa: 'ወደ ክፍያ ቀጥል',
redirectingToChapa: 'በማዛወር ላይ...',
chapaError: 'ክፍያን ማስጀመር አልተሳካም። እባክዎ እንደገና ይሞክሩ።',
paymentSuccessTitle: 'ክፍያ ተሳክቷል!',
paymentSuccessMessage: 'ቦታ ማስያዝዎ ተረጋግጧል።',
```

- [ ] **Step 3: Commit translations**

```bash
git add src/lib/i18n/en.ts src/lib/i18n/am.ts
git commit -m "feat(i18n): add Chapa payment translations"
```

---

## Chunk 9: Frontend Payment Method Selection

### Task 9: Update BookingModal with payment method selection

**Files:**

- Modify: `src/routes/hotels.$hotelId/components/-BookingModal.tsx`

- [ ] **Step 1: Add Chapa-related imports**

Add to imports at top:

```typescript
import { useAction } from 'convex/react'
import { CreditCard, Landmark } from 'lucide-react'
```

- [ ] **Step 2: Add state variables and action hook**

Add after existing state declarations (around line 85):

```typescript
const [paymentMethod, setPaymentMethod] = useState<'chapa' | 'bank' | null>(
  null,
)
const [chapaLoading, setChapaLoading] = useState(false)
```

Add the action hook after other hooks:

```typescript
const initializeChapaPayment = useAction(api.chapaActions.initializePayment)
```

- [ ] **Step 3: Add handleChapaPayment function**

Add after handleSubmitPaymentProof function (around line 197):

```typescript
const handleChapaPayment = async () => {
  if (!user?.id || !bookingId) return

  setChapaLoading(true)
  setError('')

  try {
    const result = await initializeChapaPayment({ bookingId })

    if (result.success && result.checkoutUrl) {
      // Redirect to Chapa checkout
      window.location.href = result.checkoutUrl
    } else {
      setError(result.error || t('bookingModal.chapaError'))
    }
  } catch (err: any) {
    setError(err.message || t('bookingModal.chapaError'))
  } finally {
    setChapaLoading(false)
  }
}
```

- [ ] **Step 4: Update confirm step UI with payment method selection**

Replace the entire confirm step content (the final `else` block that starts after `submitted ?` section, around line 505) with the new payment method selection UI. This is a large change - replace from `} : (` on line ~505 to the matching closing `)` before the final `)}` that closes the main conditional.

The new UI should have:

1. Success banner for room held
2. Price summary
3. Payment method selection buttons (Chapa / Bank Transfer)
4. Chapa payment flow (when selected)
5. Bank transfer flow (when selected) - this is the existing flow

See the full replacement code in the detailed implementation section below.

- [ ] **Step 5: Run dev server to verify UI compiles**

Run: `npm run dev`
Expected: No compilation errors

- [ ] **Step 6: Commit BookingModal changes**

```bash
git add "src/routes/hotels.\$hotelId/components/-BookingModal.tsx"
git commit -m "feat(ui): add Chapa payment option to booking modal"
```

---

### Task 9 Detailed Implementation: BookingModal confirm step replacement

Replace the confirm step section with this code structure:

```tsx
) : (
  <div className="space-y-4">
    {/* Room held success banner */}
    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
      <div className="flex items-center gap-2 text-emerald-400 mb-2">
        <CheckCircle className="w-5 h-5" />
        <span className="font-semibold">{t('bookingModal.heldSuccess')}</span>
      </div>
      <p className="text-slate-400 text-sm">{t('bookingModal.heldDescription')}</p>
    </div>

    {/* Price Summary */}
    <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 text-sm">
      {/* Room rate line */}
      {/* Package add-on line (if applicable) */}
      {/* Total line */}
    </div>

    {/* Payment Method Selection (when no method selected) */}
    {!paymentMethod && (
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-300">
          {t('bookingModal.selectPaymentMethod')}
        </p>

        {/* Chapa button */}
        <button onClick={() => setPaymentMethod('chapa')} ...>
          <CreditCard /> Pay Online with Chapa
        </button>

        {/* Bank Transfer button */}
        <button onClick={() => setPaymentMethod('bank')} ...>
          <Landmark /> Bank Transfer
        </button>

        {/* Cancel button */}
        <button onClick={onClose}>{t('bookingModal.cancelHold')}</button>
      </div>
    )}

    {/* Chapa Payment Flow */}
    {paymentMethod === 'chapa' && (
      <div className="space-y-4">
        {/* Redirect notice */}
        {/* Back and Proceed buttons */}
      </div>
    )}

    {/* Bank Transfer Flow (existing code moved here) */}
    {paymentMethod === 'bank' && (
      <div className="space-y-4">
        {/* Bank account selection */}
        {/* National ID upload */}
        {/* Transaction ID input */}
        {/* Back and Submit buttons */}
      </div>
    )}
  </div>
)
```

---

## Chunk 10: Success Page Handling

### Task 10: Handle payment success on bookings page

**Files:**

- Modify: `src/routes/_authenticated/bookings.tsx`

- [ ] **Step 1: Add imports for search params and state**

Add to imports:

```typescript
import { useSearch } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { CheckCircle, X } from 'lucide-react'
```

- [ ] **Step 2: Update route definition with search params**

Update the route definition to accept search params:

```typescript
export const Route = createFileRoute('/_authenticated/bookings')({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      payment: search.payment as string | undefined,
    }
  },
  component: BookingsPage,
})
```

- [ ] **Step 3: Add success state and effect inside component**

Add after existing hooks:

```typescript
const search = useSearch({ from: '/_authenticated/bookings' })
const [showPaymentSuccess, setShowPaymentSuccess] = useState(false)

useEffect(() => {
  if (search.payment === 'success') {
    setShowPaymentSuccess(true)
    // Clear the query param from URL without reload
    window.history.replaceState({}, '', '/bookings')
  }
}, [search.payment])
```

- [ ] **Step 4: Add success banner in JSX**

Add after the page header:

```tsx
{
  showPaymentSuccess && (
    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-6 h-6 text-emerald-400" />
          <div>
            <p className="font-semibold text-emerald-400">
              {t('bookingModal.paymentSuccessTitle')}
            </p>
            <p className="text-sm text-slate-300">
              {t('bookingModal.paymentSuccessMessage')}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowPaymentSuccess(false)}
          className="text-slate-400 hover:text-slate-200"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run dev server to verify**

Run: `npm run dev`
Expected: Navigate to /bookings?payment=success shows banner

- [ ] **Step 6: Commit success page changes**

```bash
git add src/routes/_authenticated/bookings.tsx
git commit -m "feat(ui): add payment success banner on bookings page"
```

---

## Chunk 11: Environment Variables Setup

### Task 11: Document required environment variables

- [ ] **Step 1: Set Convex environment variables**

Run these commands to set required environment variables:

```bash
# Set Chapa secret key (get from Chapa dashboard)
npx convex env set CHAPA_SECRET_KEY "CHASECK_TEST-xxxxxxxxxxxxxxxx"

# Set Chapa webhook secret (set in Chapa dashboard)
npx convex env set CHAPA_WEBHOOK_SECRET "your-webhook-secret-hash"

# Set app URL for return redirects
npx convex env set APP_URL "http://localhost:3000"
```

- [ ] **Step 2: Configure Chapa dashboard**

In Chapa dashboard:

1. Go to Profile Settings > Webhooks
2. Set Webhook URL to: `https://<your-convex-deployment>.convex.site/chapa`
3. Set a secret hash and save it
4. Use the same secret hash in CHAPA_WEBHOOK_SECRET

- [ ] **Step 3: Update .env.example**

Add to `.env.example`:

```bash
# Chapa Payment Integration
# Set these in Convex via: npx convex env set KEY "value"
# CHAPA_SECRET_KEY=CHASECK_TEST-xxxxxxxxxxxxxxxx
# CHAPA_WEBHOOK_SECRET=your-webhook-secret
# APP_URL=http://localhost:3000
```

- [ ] **Step 4: Commit environment documentation**

```bash
git add .env.example
git commit -m "docs: add Chapa environment variables documentation"
```

---

## Chunk 12: Testing and Verification

### Task 12: Test the integration end-to-end

- [ ] **Step 1: Start development servers**

```bash
# Terminal 1: Convex
npx convex dev

# Terminal 2: Frontend
npm run dev
```

- [ ] **Step 2: Test Chapa payment flow**

1. Sign in as a customer
2. Browse to a hotel and select a room
3. Select dates and proceed through booking modal
4. On step 3, select "Pay with Chapa"
5. Click "Proceed to Payment"
6. Verify redirect to Chapa checkout page
7. Use Chapa test credentials to complete payment
8. Verify redirect back to /bookings?payment=success
9. Verify success banner appears
10. Verify booking status changed to "confirmed"

- [ ] **Step 3: Test bank transfer flow still works**

1. Create another booking
2. On step 3, select "Bank Transfer"
3. Verify bank account details display
4. Complete payment proof submission
5. Verify booking goes to "pending_payment" status

- [ ] **Step 4: Test webhook handling**

Use Chapa's test webhook feature or curl:

```bash
curl -X POST https://<your-convex-deployment>.convex.site/chapa \
  -H "Content-Type: application/json" \
  -H "x-chapa-signature: <calculated-signature>" \
  -d '{"event":"charge.success","tx_ref":"booking_xxx_123_abc","reference":"AP123456","status":"success"}'
```

- [ ] **Step 5: Verify admin can see Chapa payment details**

1. Sign in as hotel admin
2. View the Chapa-paid booking
3. Verify Chapa reference, payment method displayed

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete Chapa payment integration"
```

---

## Summary

This plan implements Chapa payment integration with:

1. **Schema**: New `chapaPayments` table for transaction tracking
2. **Backend**:
   - Node.js actions for Chapa API calls (initialize, verify)
   - HTTP webhook endpoint with signature verification
   - Internal mutations for payment state management
3. **Frontend**: Payment method selection (Chapa vs Bank Transfer)
4. **UX**: Success banner on bookings page after payment
5. **Admin**: Payment details visibility for hotel staff

**Key Security Features:**

- HMAC SHA256 webhook signature verification
- Double verification with Chapa API before confirming
- Idempotent payment processing
- Secret keys stored in environment variables

**Testing Checklist:**

- [ ] Chapa payment flow end-to-end
- [ ] Bank transfer flow still works
- [ ] Webhook processes correctly
- [ ] Failed payment handled
- [ ] Admin can view payment details
- [ ] Hold expiration still works for abandoned payments
