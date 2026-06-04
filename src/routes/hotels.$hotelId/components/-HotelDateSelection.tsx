import { useI18n } from '../../../lib/i18n/provider'

interface HotelDateSelectionProps {
  checkIn: string
  checkOut: string
  nights: number
  onCheckInChange: (value: string) => void
  onCheckOutChange: (value: string) => void
}

function getTodayDateString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00`)
  date.setDate(date.getDate() + days)

  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function HotelDateSelection({
  checkIn,
  checkOut,
  nights,
  onCheckInChange,
  onCheckOutChange,
}: HotelDateSelectionProps) {
  const { t } = useI18n()
  const today = getTodayDateString()
  const minCheckOut = checkIn ? addDays(checkIn, 1) : today

  return (
    <div className="mb-6 rounded-2xl border border-slate-800/50 bg-slate-900/50 p-5">
      <h2 className="mb-3 text-lg font-semibold text-slate-200">
        {t('hotel.selectDates')}
      </h2>
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="flex-1">
          <label className="mb-2 block text-sm text-slate-400">
            {t('booking.checkIn')}
          </label>
          <input
            aria-label={t('booking.checkIn')}
            type="date"
            value={checkIn}
            min={today}
            onChange={(event) => {
              const nextCheckIn = event.target.value
              onCheckInChange(nextCheckIn)

              if (
                nextCheckIn &&
                (!checkOut || checkOut < addDays(nextCheckIn, 1))
              ) {
                onCheckOutChange(addDays(nextCheckIn, 1))
              }
            }}
            className="hotel-date-input w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-slate-200 transition-all focus:border-violet-500/50 focus:outline-none"
          />
        </div>
        <div className="flex-1">
          <label className="mb-2 block text-sm text-slate-400">
            {t('booking.checkOut')}
          </label>
          <input
            aria-label={t('booking.checkOut')}
            type="date"
            value={checkOut}
            min={minCheckOut}
            onChange={(event) => {
              const nextCheckOut = event.target.value
              onCheckOutChange(
                nextCheckOut && nextCheckOut < minCheckOut
                  ? minCheckOut
                  : nextCheckOut,
              )
            }}
            className="hotel-date-input w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-slate-200 transition-all focus:border-violet-500/50 focus:outline-none"
          />
        </div>
        {nights > 0 && (
          <div className="flex items-end">
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 py-3">
              <span className="font-semibold text-violet-400">
                {nights} {nights !== 1 ? t('hotel.nights') : t('hotel.night')}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
