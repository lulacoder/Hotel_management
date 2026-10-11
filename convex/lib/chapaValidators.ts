import { v } from 'convex/values'

import type { Infer } from 'convex/values'

// Provider amounts can be JSON numbers or decimal strings
const amountValidator = v.union(v.string(), v.number())
const optionalNullableString = v.optional(v.union(v.string(), v.null()))

export const chapaInitializeResponseValidator = v.object({
  message: v.optional(v.any()),
  status: v.string(),
  data: v.optional(
    v.union(v.object({ checkout_url: v.optional(v.string()) }), v.null()),
  ),
})

const refundDataValidator = v.object({
  ref_id: v.optional(v.string()),
  reference: v.optional(v.string()),
  status: v.optional(v.string()),
})

// Error messages remain opaque until the existing message extractor checks them
export const chapaRefundResponseValidator = v.object({
  message: v.optional(v.any()),
  status: v.string(),
  data: v.optional(v.union(refundDataValidator, v.null())),
})

export const chapaRefundVerifyResponseValidator =
  chapaRefundResponseValidator.extend({
    data: v.optional(
      v.union(
        refundDataValidator.extend({
          amount: v.optional(amountValidator),
          currency: v.optional(v.string()),
        }),
        v.null(),
      ),
    ),
  })

export const chapaVerifyResponseValidator = v.object({
  status: v.string(),
  data: v.optional(
    v.union(
      v.object({
        amount: v.optional(amountValidator),
        currency: v.optional(v.string()),
        method: optionalNullableString,
        mode: optionalNullableString,
        payment_method: optionalNullableString,
        reference: optionalNullableString,
        status: optionalNullableString,
        tx_ref: optionalNullableString,
      }),
      v.null(),
    ),
  ),
})

export const chapaWebhookValidator = v.object({
  event: v.optional(v.string()),
  tx_ref: v.optional(v.string()),
  trx_ref: v.optional(v.string()),
})

export const initializeCheckoutResultValidator = v.union(
  v.object({
    success: v.literal(true),
    checkoutUrl: v.string(),
    txRef: v.string(),
  }),
  v.object({
    success: v.literal(false),
    error: v.string(),
    txRef: v.optional(v.string()),
  }),
)

export type ChapaInitializeResponse = Infer<
  typeof chapaInitializeResponseValidator
>
export type ChapaRefundResponse = Infer<typeof chapaRefundResponseValidator>
export type ChapaVerifyResponse = Infer<typeof chapaVerifyResponseValidator>
export type InitializeCheckoutResult = Infer<
  typeof initializeCheckoutResultValidator
>
