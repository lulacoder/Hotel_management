import { z } from 'zod'

export function createRatingFormSchema(selectRatingMessage: string) {
  return z.object({
    rating: z
      .number()
      .int()
      .min(1, selectRatingMessage)
      .max(5, selectRatingMessage),
    review: z.string().max(500),
  })
}

export type RatingFormValues = z.input<
  ReturnType<typeof createRatingFormSchema>
>

export function normalizeRatingFormValues(values: RatingFormValues) {
  return {
    rating: values.rating,
    review: values.review.trim() || undefined,
  }
}
