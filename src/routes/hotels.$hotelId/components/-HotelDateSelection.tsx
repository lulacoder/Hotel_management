import { useI18n } from '../../../lib/i18n'

interface HotelDateSelectionProps {
  checkIn: string
  checkOut: string
  nights: number
  onCheckInChange: (value: string) => void
  onCheckOutChange: (value: string) => void
}

export function HotelDateSelection({
  checkIn,
  checkOut,
  nights,
  onCheckInChange,
  onCheckOutChange,
}: HotelDateSelectionProps) {
  const { t } = useI18n()
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="mb-8 rounded-2xl border border-slate-800/50 bg-slate-900/50 p-6">
      <h2 className="mb-4 text-lg font-semibold text-slate-200">
        {t('hotel.selectDates')}
      </h2>
      <p className="mb-4 text-sm text-slate-400">
        {t('hotel.selectDatesDescription')}
      </p>
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="flex-1">
          <label className="mb-2 block text-sm text-slate-400">
            {t('booking.checkIn')}
          </label>
          <input
            type="date"
            value={checkIn}
            min={today}
            onChange={(event) => onCheckInChange(event.target.value)}
            className="hotel-date-input w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-slate-200 transition-all focus:border-blue-500/50 focus:outline-none"
          />
        </div>
        <div className="flex-1">
          <label className="mb-2 block text-sm text-slate-400">
            {t('booking.checkOut')}
          </label>
          <input
            type="date"
            value={checkOut}
            min={checkIn || today}
            onChange={(event) => onCheckOutChange(event.target.value)}
            className="hotel-date-input w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-slate-200 transition-all focus:border-blue-500/50 focus:outline-none"
          />
        </div>
        {nights > 0 && (
          <div className="flex items-end">
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3">
              <span className="font-semibold text-blue-400">
                {nights} {nights !== 1 ? t('hotel.nights') : t('hotel.night')}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
