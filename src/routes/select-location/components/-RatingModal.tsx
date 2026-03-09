// Modal for creating/updating a user's hotel rating and optional written review.
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { Star, X } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { useEffect, useMemo } from 'react'

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
  const ratingValue = watch('rating')
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rating-modal-title"
        aria-describedby="rating-modal-description"
      >
        <div className="p-6 border-b border-slate-800 flex items-start justify-between gap-4">
          <div>
            <h2
              id="rating-modal-title"
              className="text-xl font-semibold text-slate-100"
            >
              {hasExistingRating
                ? t('rating.updateTitle')
                : t('rating.newTitle')}
            </h2>
            <p
              id="rating-modal-description"
              className="text-sm text-slate-500 mt-1"
            >
              {hotelName || t('rating.shareExperience')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label={t('rating.closeModal')}
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6">
          {!isSignedIn ? (
            <div className="space-y-5">
              <p className="text-slate-400">{t('rating.signInPrompt')}</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() =>
                    navigate({
                      to: '/sign-in',
                      search: { redirect: ratingRedirect },
                    })
                  }
                  className="flex-1 px-4 py-3 bg-slate-800 text-slate-200 font-medium rounded-xl hover:bg-slate-700 transition-colors"
                >
                  {t('header.signIn')}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigate({
                      to: '/sign-up',
                      search: { redirect: ratingRedirect },
                    })
                  }
                  className="flex-1 px-4 py-3 bg-blue-500 text-slate-900 font-semibold rounded-xl hover:bg-blue-400 transition-colors"
                >
                  {t('header.signUp')}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {formError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {t('rating.yourRating')}
                </label>
                <Controller
                  control={control}
                  name="rating"
                  render={({ field }) => (
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => field.onChange(value)}
                          className="p-1"
                          aria-label={t('rating.rateStar', { value })}
                        >
                          <Star
                            className={`w-6 h-6 ${
                              value <= field.value
                                ? 'text-blue-400 fill-blue-400'
                                : 'text-slate-600'
                            }`}
                          />
                        </button>
                      ))}
                      <span className="text-sm text-slate-500 ml-2">
                        {field.value > 0
                          ? `${field.value}/5`
                          : t('rating.selectRating')}
                      </span>
                    </div>
                  )}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {t('rating.reviewOptional')}
                </label>
                <textarea
                  rows={4}
                  {...register('review')}
                  maxLength={500}
                  placeholder={t('rating.reviewPlaceholder')}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-all resize-none"
                />
                <p className="text-xs text-slate-500 mt-2">
                  {ratingText.length}/500
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-3 bg-slate-800 text-slate-200 font-medium rounded-xl hover:bg-slate-700 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={ratingSaving}
                  className="flex-1 px-4 py-3 bg-blue-500 text-slate-900 font-semibold rounded-xl hover:bg-blue-400 transition-colors disabled:opacity-60"
                >
                  {ratingSaving ? t('common.saving') : t('common.saveChanges')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
