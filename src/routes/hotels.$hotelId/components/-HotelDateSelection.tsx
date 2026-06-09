import { useI18n } from '../../../lib/i18n/provider'
import { DatePicker } from '@/components/ui/date-picker'

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
          <DatePicker
            ariaLabel={t('booking.checkIn')}
            value={checkIn}
            min={today}
            onChange={(nextCheckIn) => {
              onCheckInChange(nextCheckIn)

              if (
                nextCheckIn &&
                (!checkOut || checkOut < addDays(nextCheckIn, 1))
              ) {
                onCheckOutChange(addDays(nextCheckIn, 1))
              }
            }}
          />
        </div>
        <div className="flex-1">
          <label className="mb-2 block text-sm text-slate-400">
            {t('booking.checkOut')}
          </label>
          <DatePicker
            ariaLabel={t('booking.checkOut')}
            value={checkOut}
            min={minCheckOut}
            onChange={(nextCheckOut) => {
              onCheckOutChange(
                nextCheckOut && nextCheckOut < minCheckOut
                  ? minCheckOut
                  : nextCheckOut,
              )
            }}
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
