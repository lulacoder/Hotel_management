import { useNavigate } from '@tanstack/react-router'
import { Star, X } from 'lucide-react'

interface RatingModalProps {
  isSignedIn: boolean
  hotelName: string
  hasExistingRating: boolean
  ratingValue: number
  ratingText: string
  ratingError: string
  ratingSaving: boolean
  ratingRedirect: string
  onClose: () => void
  onSubmit: (event: React.FormEvent) => void
  onRatingChange: (value: number) => void
  onRatingTextChange: (value: string) => void
}

export function RatingModal({
  isSignedIn,
  hotelName,
  hasExistingRating,
  ratingValue,
  ratingText,
  ratingError,
  ratingSaving,
  ratingRedirect,
  onClose,
  onSubmit,
  onRatingChange,
  onRatingTextChange,
}: RatingModalProps) {
  const navigate = useNavigate()

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
              {hasExistingRating ? 'Update Rating' : 'Rate This Hotel'}
            </h2>
            <p
              id="rating-modal-description"
              className="text-sm text-slate-500 mt-1"
            >
              {hotelName || 'Share your experience'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close rating modal"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6">
          {!isSignedIn ? (
            <div className="space-y-5">
              <p className="text-slate-400">
                Sign in to leave a rating for this hotel.
              </p>
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
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigate({
                      to: '/sign-up',
                      search: { redirect: ratingRedirect },
                    })
                  }
                  className="flex-1 px-4 py-3 bg-amber-500 text-slate-900 font-semibold rounded-xl hover:bg-amber-400 transition-colors"
                >
                  Sign Up
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              {ratingError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
                  {ratingError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Your Rating
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => onRatingChange(value)}
                      className="p-1"
                      aria-label={`Rate ${value} star`}
                    >
                      <Star
                        className={`w-6 h-6 ${
                          value <= ratingValue
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-600'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-sm text-slate-500 ml-2">
                    {ratingValue > 0 ? `${ratingValue}/5` : 'Select a rating'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Review (optional)
                </label>
                <textarea
                  rows={4}
                  value={ratingText}
                  onChange={(event) => onRatingTextChange(event.target.value)}
                  maxLength={500}
                  placeholder="Share anything you liked about your stay."
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition-all resize-none"
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
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={ratingSaving}
                  className="flex-1 px-4 py-3 bg-amber-500 text-slate-900 font-semibold rounded-xl hover:bg-amber-400 transition-colors disabled:opacity-60"
                >
                  {ratingSaving ? 'Saving...' : 'Save Rating'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
