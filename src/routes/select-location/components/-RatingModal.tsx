import { useNavigate } from '@tanstack/react-router'
import { Star } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useForm, useStore } from '@tanstack/react-form'
import { z } from 'zod'

import { Button } from '../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog'
import { Label } from '../../../components/ui/label'
import { Textarea } from '../../../components/ui/textarea'
import { useI18n } from '../../../lib/i18n/provider'

export interface RatingFormValues {
  rating: number
  review: string
}

interface RatingModalProps {
  isSignedIn: boolean
  hotelName: string
  hasExistingRating: boolean
  initialRatingValue: number
  initialRatingText: string
  ratingError: string
  ratingSaving: boolean
  ratingRedirect: string
  onClose: () => void
  onSubmit: (values: RatingFormValues) => Promise<void>
}

function getFirstErrorMessage(
  errors: Array<unknown> | undefined,
): string | null {
  if (!errors) {
    return null
  }

  for (const error of errors) {
    if (!error) {
      continue
    }

    if (typeof error === 'string') {
      return error
    }

    if (typeof error === 'object' && 'message' in error) {
      const message = error.message
      if (typeof message === 'string') {
        return message
      }
    }
  }

  return null
}

export function RatingModal({
  isSignedIn,
  hotelName,
  hasExistingRating,
  initialRatingValue,
  initialRatingText,
  ratingError,
  ratingSaving,
  ratingRedirect,
  onClose,
  onSubmit,
}: RatingModalProps) {
  const navigate = useNavigate()
  const { t } = useI18n()

  const schema = useMemo(
    () =>
      z.object({
        rating: z
          .number()
          .int()
          .min(1, t('rating.selectRating'))
          .max(5, t('rating.selectRating')),
        review: z.string().max(500),
      }),
    [t],
  )

  const form = useForm({
    defaultValues: {
      rating: initialRatingValue,
      review: initialRatingText,
    } satisfies RatingFormValues,
    validators: {
      onBlur: schema,
      onSubmit: schema,
    },
    onSubmit: async ({ value }) => {
      await onSubmit(value)
    },
  })

  useEffect(() => {
    form.reset({
      rating: initialRatingValue,
      review: initialRatingText,
    })
  }, [form, initialRatingText, initialRatingValue])

  const reviewValue = useStore(form.store, (state) => state.values.review)
  const ratingFieldError = getFirstErrorMessage(
    form.getFieldMeta('rating')?.errors,
  )
  const reviewFieldError = getFirstErrorMessage(
    form.getFieldMeta('review')?.errors,
  )

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg border-slate-800 bg-slate-900 p-0 text-slate-100 sm:max-w-lg">
        <DialogHeader className="border-b border-slate-800 p-6">
          <DialogTitle id="rating-modal-title" className="text-xl">
            {hasExistingRating ? t('rating.updateTitle') : t('rating.newTitle')}
          </DialogTitle>
          <DialogDescription
            id="rating-modal-description"
            className="mt-1 text-sm text-slate-500"
          >
            {hotelName || t('rating.shareExperience')}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6">
          {!isSignedIn ? (
            <div className="space-y-5">
              <p className="text-slate-400">{t('rating.signInPrompt')}</p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    navigate({
                      to: '/sign-in',
                      search: { redirect: ratingRedirect },
                    })
                  }
                  className="flex-1 border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                >
                  {t('header.signIn')}
                </Button>
                <Button
                  type="button"
                  onClick={() =>
                    navigate({
                      to: '/sign-up',
                      search: { redirect: ratingRedirect },
                    })
                  }
                  className="flex-1 bg-white text-slate-900 hover:bg-slate-100"
                >
                  {t('header.signUp')}
                </Button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                event.stopPropagation()
                void form.handleSubmit()
              }}
              className="space-y-5"
            >
              {ratingError ? (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
                  {ratingError}
                </div>
              ) : null}

              <form.Field name="rating">
                {(field) => (
                  <div>
                    <Label className="mb-2 block text-sm font-medium text-slate-300">
                      {t('rating.yourRating')}
                    </Label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <Button
                          key={value}
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            field.handleChange(value)
                            field.handleBlur()
                          }}
                          className="hover:bg-transparent"
                          aria-label={t('rating.rateStar', { value })}
                        >
                          <Star
                            className={`h-6 w-6 ${
                              value <= field.state.value
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-slate-600'
                            }`}
                          />
                        </Button>
                      ))}
                      <span className="ml-2 text-sm text-slate-500">
                        {field.state.value > 0
                          ? `${field.state.value}/5`
                          : t('rating.selectRating')}
                      </span>
                    </div>
                    {ratingFieldError ? (
                      <p className="mt-2 text-xs text-red-400">
                        {ratingFieldError}
                      </p>
                    ) : null}
                  </div>
                )}
              </form.Field>

              <form.Field name="review">
                {(field) => (
                  <div>
                    <Label className="mb-2 block text-sm font-medium text-slate-300">
                      {t('rating.reviewOptional')}
                    </Label>
                    <Textarea
                      rows={4}
                      value={field.state.value}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      onBlur={field.handleBlur}
                      maxLength={500}
                      placeholder={t('rating.reviewPlaceholder')}
                      className="resize-none border-slate-700 bg-slate-800/50 text-slate-200 placeholder:text-slate-500"
                    />
                    {reviewFieldError ? (
                      <p className="mt-2 text-xs text-red-400">
                        {reviewFieldError}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-slate-500">
                      {reviewValue.length}/500
                    </p>
                  </div>
                )}
              </form.Field>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="flex-1 border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={ratingSaving}
                  className="flex-1 bg-white text-slate-900 hover:bg-slate-100"
                >
                  {ratingSaving ? t('common.saving') : t('common.saveChanges')}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
