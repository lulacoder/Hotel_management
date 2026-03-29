import {
  Bed,
  Building2,
  CheckCircle,
  Cigarette,
  CigaretteOff,
  Coffee,
  Tv,
  Users,
  Wifi,
  Wind,
} from 'lucide-react'

import { useI18n } from '../../../lib/i18n'
import type { Id } from '../../../../convex/_generated/dataModel'

interface RoomSummary {
  _id: Id<'rooms'>
  amenities?: Array<string>
  basePrice: number
  bedOptions?: string
  description?: string
  imageUrl?: string
  maxOccupancy: number
  roomNumber: string
  smokingAllowed?: boolean
  type: 'budget' | 'standard' | 'suite' | 'deluxe'
}

interface HotelRoomsGridProps {
  isSignedIn: boolean
  nights: number
  onBookRoom: (roomId: Id<'rooms'>) => void
  rooms: Array<RoomSummary> | undefined
  selectedDates: {
    checkIn: string
    checkOut: string
  }
}

const amenityIcons: Record<string, typeof Wifi> = {
  'Air Conditioning': Wind,
  'Mini Bar': Coffee,
  TV: Tv,
  WiFi: Wifi,
}

export function HotelRoomsGrid({
  isSignedIn,
  nights,
  onBookRoom,
  rooms,
  selectedDates,
}: HotelRoomsGridProps) {
  const { t } = useI18n()

  const roomTypeLabels: Record<RoomSummary['type'], string> = {
    budget: t('hotel.budgetRoom'),
    deluxe: t('hotel.deluxeRoom'),
    standard: t('hotel.standardRoom'),
    suite: t('hotel.suiteRoom'),
  }

  return (
    <>
      <h2 className="mb-4 text-xl font-semibold text-slate-200">
        {selectedDates.checkIn && selectedDates.checkOut
          ? t('hotel.availableRooms')
          : t('hotel.allRooms')}
      </h2>

      {rooms === undefined ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500/20 border-t-violet-500"></div>
        </div>
      ) : rooms.length === 0 ? (
        <div className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800">
            <Building2 className="h-8 w-8 text-slate-600" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-slate-300">
            {t('hotel.noRoomsAvailable')}
          </h3>
          <p className="text-slate-500">
            {selectedDates.checkIn && selectedDates.checkOut
              ? t('hotel.tryDifferentDates')
              : t('hotel.noAvailableRooms')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => {
            const amenities = room.amenities ?? []

            return (
              <div
                key={room._id}
                className="overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 transition-all hover:border-slate-700/50"
              >
                <div className="relative flex h-32 items-center justify-center overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900">
                  {room.imageUrl ? (
                    <img
                      src={room.imageUrl}
                      alt={`${t('hotel.room')} ${room.roomNumber}`}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <Building2 className="h-12 w-12 text-slate-700" />
                  )}
                </div>

                <div className="p-4">
                  <div className="mb-2.5 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-200">
                        {t('hotel.room')} {room.roomNumber}
                      </h3>
                      <p className="text-sm text-slate-400">
                        {roomTypeLabels[room.type]}
                      </p>
                      {room.description && (
                        <p className="mt-1 text-xs text-slate-500">
                          {room.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-violet-400">
                        ${(room.basePrice / 100).toFixed(0)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {t('hotel.perNight')}
                      </p>
                    </div>
                  </div>

                  <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-slate-400">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>
                        {t('hotel.upTo', { count: room.maxOccupancy })}
                      </span>
                    </div>
                    {room.bedOptions && (
                      <div className="flex items-center gap-1">
                        <Bed className="h-4 w-4" />
                        <span>{room.bedOptions}</span>
                      </div>
                    )}
                    {room.smokingAllowed !== undefined && (
                      <div className="flex items-center gap-1">
                        {room.smokingAllowed ? (
                          <>
                            <Cigarette className="h-4 w-4 text-amber-500" />
                            <span className="text-amber-500">
                              {t('hotel.smoking')}
                            </span>
                          </>
                        ) : (
                          <>
                            <CigaretteOff className="h-4 w-4 text-emerald-500" />
                            <span className="text-emerald-500">
                              {t('hotel.nonSmoking')}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {amenities.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {amenities.slice(0, 4).map((amenity) => {
                        const Icon = amenityIcons[amenity] || CheckCircle

                        return (
                          <div
                            key={amenity}
                            className="flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-xs text-slate-400"
                          >
                            <Icon className="h-3 w-3" />
                            {amenity}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {nights > 0 && (
                    <div className="mb-3 rounded-xl bg-slate-800/50 p-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">
                          ${(room.basePrice / 100).toFixed(0)} x {nights}{' '}
                          {nights !== 1 ? t('hotel.nights') : t('hotel.night')}
                        </span>
                        <span className="font-semibold text-slate-200">
                          ${((room.basePrice * nights) / 100).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => onBookRoom(room._id)}
                    disabled={!selectedDates.checkIn || !selectedDates.checkOut}
                    className="room-book-button w-full rounded-xl border border-slate-700/40 bg-white py-2.5 font-semibold text-slate-900 transition-all hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {selectedDates.checkIn && selectedDates.checkOut
                      ? isSignedIn
                        ? t('hotel.bookNow')
                        : t('hotel.signInToBook')
                      : t('hotel.selectDatesToBook')}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
