import { z } from 'zod'

export function createComplaintFormSchema(messages: {
  hotelRequired: string
  subjectMin: string
  subjectMax: string
  descriptionMin: string
  descriptionMax: string
}) {
  return z.object({
    hotelId: z.string().min(1, messages.hotelRequired),
    subject: z
      .string()
      .trim()
      .min(5, messages.subjectMin)
      .max(120, messages.subjectMax),
    description: z
      .string()
      .trim()
      .min(20, messages.descriptionMin)
      .max(2000, messages.descriptionMax),
    bookingId: z.string().optional(),
  })
}

export type ComplaintFormValues = z.input<
  ReturnType<typeof createComplaintFormSchema>
>

export function normalizeComplaintFormValues(values: ComplaintFormValues) {
  return {
    hotelId: values.hotelId,
    subject: values.subject.trim(),
    description: values.description.trim(),
    bookingId: values.bookingId?.trim() || undefined,
  }
}
