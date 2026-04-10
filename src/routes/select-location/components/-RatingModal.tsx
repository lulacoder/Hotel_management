// Modal for creating/updating a user's hotel rating and optional written review.
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { Star } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { useEffect, useMemo } from 'react'

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
import { useI18n } from '../../../lib/i18n'
import { createRatingFormSchema } from './-ratingFormSchema'
import type { RatingFormValues } from './-ratingFormSchema'

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
  // Handles both authenticated rating form flow and guest sign-in prompts.
  const navigate = useNavigate()
  const { t } = useI18n()
  const schema = useMemo(
    () => createRatingFormSchema(t('rating.selectRating')),
    [t],
  )
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
    watch,
  } = useForm<RatingFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      rating: initialRatingValue,
      review: initialRatingText,
    },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  })
  const ratingText = watch('review')
  const formError =
    errors.rating?.message ?? errors.review?.message ?? ratingError

  useEffect(() => {
    reset({
      rating: initialRatingValue,
      review: initialRatingText,
    })
  }, [initialRatingText, initialRatingValue, reset])

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg border-slate-800 bg-slate-900 p-0 text-slate-100 sm:max-w-lg">
        <DialogHeader className="border-b border-slate-800 px-6 py-6">
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
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {formError && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
                  {formError}
                </div>
              )}

              <div>
                <Label className="mb-2 block text-sm font-medium text-slate-300">
                  {t('rating.yourRating')}
                </Label>
                <Controller
                  control={control}
                  name="rating"
                  render={({ field }) => (
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <Button
                          key={value}
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => field.onChange(value)}
                          className="hover:bg-transparent"
                          aria-label={t('rating.rateStar', { value })}
                        >
                          <Star
                            className={`h-6 w-6 ${
                              value <= field.value
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-slate-600'
                            }`}
                          />
                        </Button>
                      ))}
                      <span className="ml-2 text-sm text-slate-500">
                        {field.value > 0
                          ? `${field.value}/5`
                          : t('rating.selectRating')}
                      </span>
                    </div>
                  )}
                />
              </div>

              <div>
                <Label className="mb-2 block text-sm font-medium text-slate-300">
                  {t('rating.reviewOptional')}
                </Label>
                <Textarea
                  rows={4}
                  {...register('review')}
                  maxLength={500}
                  placeholder={t('rating.reviewPlaceholder')}
                  className="resize-none border-slate-700 bg-slate-800/50 text-slate-200 placeholder:text-slate-500"
                />
                <p className="mt-2 text-xs text-slate-500">
                  {ratingText.length}/500
                </p>
              </div>

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
