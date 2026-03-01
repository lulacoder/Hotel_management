// Hotel details management route inside admin, including room-level controls.
import { Link, createFileRoute } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useMutation, useQuery } from 'convex/react'
import {
  ArrowLeft,
  Building2,
  CheckCircle,
  DollarSign,
  Edit,
  MapPin,
  MoreVertical,
  Pencil,
  Plus,
  Sparkles,
  Star,
  Trash2,
  Users,
  Wrench,
  XCircle,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { api } from '../../../../convex/_generated/api'
import { RoomModal } from './$hotelId/components/-RoomModal'
import { HotelEditModal } from './$hotelId/components/-HotelEditModal'
import type { Id } from '../../../../convex/_generated/dataModel'
import { useI18n } from '../../../lib/i18n'

export const Route = createFileRoute('/admin/hotels/$hotelId')({
  // Register per-hotel admin route for rooms, ratings, and metadata updates.
  component: HotelDetailPage,
})

function HotelDetailPage() {
  // Hydrate hotel context and track UI state for room/rating management modals.
  const { hotelId } = Route.useParams()
  const { user } = useUser()
  const [showCreateRoom, setShowCreateRoom] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Id<'rooms'> | null>(null)
  const [activeMenu, setActiveMenu] = useState<Id<'rooms'> | null>(null)
  const [showEditHotel, setShowEditHotel] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)
  const [accountNumberInput, setAccountNumberInput] = useState('')
  const [savingAccount, setSavingAccount] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const { t, locale } = useI18n()
  const dateLocale = locale === 'am' ? 'am-ET' : 'en-US'

  const profile = useQuery(api.users.getMe, user?.id ? {} : 'skip')
  const hotelAssignment = useQuery(
    api.hotelStaff.getMyAssignment,
    profile ? {} : 'skip',
  )

  const hotel = useQuery(api.hotels.get, { hotelId: hotelId as Id<'hotels'> })
  const bankAccount = useQuery(api.hotelBankAccounts.getByHotel, {
    hotelId: hotelId as Id<'hotels'>,
  })
  const rooms = useQuery(
    api.rooms.getByHotelWithLiveState,
    user?.id
      ? {
          hotelId: hotelId as Id<'hotels'>,
        }
      : 'skip',
  )
  const ratings = useQuery(
    api.ratings.getHotelRatingsAdmin,
    user?.id
      ? { hotelId: hotelId as Id<'hotels'> }
      : 'skip',
  )

  const deleteRoom = useMutation(api.rooms.softDelete)
  const updateRoomStatus = useMutation(api.rooms.updateStatus)
  const deleteRating = useMutation(api.ratings.softDeleteRating)
  const setBankAccount = useMutation(api.hotelBankAccounts.set)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    setAccountNumberInput(bankAccount?.accountNumber ?? '')
  }, [bankAccount?.accountNumber])

  const handleDeleteRoom = async (roomId: Id<'rooms'>) => {
    if (!user?.id) return
    if (confirm(t('admin.hotels.confirmDeleteRoom'))) {
      await deleteRoom({ roomId })
    }
    setActiveMenu(null)
  }

  const handleDeleteRating = async (ratingId: Id<'hotelRatings'>) => {
    if (!user?.id) return
    if (confirm(t('admin.hotels.confirmDeleteRating'))) {
      await deleteRating({ ratingId })
    }
  }

  const handleStatusChange = async (
    roomId: Id<'rooms'>,
    status: 'available' | 'maintenance' | 'cleaning' | 'out_of_order',
  ) => {
    // Update room operational status from contextual quick actions.
    if (!user?.id) return
    await updateRoomStatus({
      roomId,
      operationalStatus: status,
    })
    setActiveMenu(null)
  }

  const canManagePaymentSettings =
    hotelAssignment?.hotelId === (hotelId as Id<'hotels'>) &&
    ['hotel_admin', 'hotel_cashier'].includes(hotelAssignment.role)

  const handleSaveBankAccount = async () => {
    if (!user?.id || !canManagePaymentSettings) {
      return
    }

    const trimmed = accountNumberInput.trim()
    if (!trimmed) {
      setPaymentError(t('admin.hotels.payment.accountRequired'))
      return
    }

    setSavingAccount(true)
    setPaymentError('')

    try {
      await setBankAccount({
        hotelId: hotelId as Id<'hotels'>,
        accountNumber: trimmed,
      })
    } catch (error: any) {
      setPaymentError(error?.message || t('admin.hotels.payment.saveFailed'))
    } finally {
      setSavingAccount(false)
    }
  }

  const statusConfig = {
    available: {
      label: t('admin.hotels.status.available'),
      icon: CheckCircle,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
    maintenance: {
      label: t('admin.hotels.status.maintenance'),
      icon: Wrench,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
    },
    cleaning: {
      label: t('admin.hotels.status.cleaning'),
      icon: Sparkles,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
    },
    out_of_order: {
      label: t('admin.hotels.status.outOfOrder'),
      icon: XCircle,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
    },
    held: {
      label: t('booking.status.held'),
      icon: CheckCircle,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
    },
    booked: {
      label: t('admin.hotels.status.booked'),
      icon: CheckCircle,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
    },
  }

  const operationalStatusOptions = [
    'available',
    'maintenance',
    'cleaning',
    'out_of_order',
  ] as const

  const roomTypeLabels: Record<string, string> = {
    budget: t('hotel.budgetRoom'),
    standard: t('hotel.standardRoom'),
    suite: t('hotel.suiteRoom'),
    deluxe: t('hotel.deluxeRoom'),
  }

  if (!isHydrated || hotel === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500/20 border-t-blue-500"></div>
      </div>
    )
  }

  if (hotel === null) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-12 text-center">
          <h2 className="text-xl font-semibold text-slate-300 mb-2">
            {t('hotel.notFoundTitle')}
          </h2>
          <p className="text-slate-500 mb-6">
            {t('hotel.notFoundDescription')}
          </p>
          <Link
            to="/admin/hotels"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-slate-200 font-medium rounded-xl hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('admin.hotels.backToHotels')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Back Link */}
      <Link
        to="/admin/hotels"
        className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('admin.hotels.backToHotels')}
      </Link>

      {/* Hotel Header */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-6 mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100 mb-2">
              {hotel.name}
            </h1>
            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <MapPin className="w-4 h-4" />
              <span>{hotel.address}</span>
            </div>
            <p className="text-slate-500">
              {hotel.city}, {hotel.country}
            </p>
          </div>
          <button
            onClick={() => setShowEditHotel(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-colors border border-slate-700"
          >
            <Edit className="w-4 h-4" />
            {t('admin.hotels.editHotel')}
          </button>
        </div>
      </div>

      {canManagePaymentSettings && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-6 mb-8">
          <h2 className="text-xl font-semibold text-slate-200 mb-2">
            {t('admin.hotels.payment.title')}
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            {t('admin.hotels.payment.description')}
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t('admin.hotels.payment.accountNumber')}
              </label>
              <input
                type="text"
                value={accountNumberInput}
                onChange={(e) => setAccountNumberInput(e.target.value)}
                placeholder={t('admin.hotels.payment.accountPlaceholder')}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-all"
              />
            </div>

            {paymentError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">
                {paymentError}
              </div>
            )}

            <div>
              <button
                type="button"
                onClick={handleSaveBankAccount}
                disabled={savingAccount}
                className="px-4 py-2 bg-blue-500/10 text-blue-400 font-medium rounded-xl hover:bg-blue-500/20 transition-colors border border-blue-500/20 disabled:opacity-50"
              >
                {savingAccount
                  ? t('admin.hotels.payment.saving')
                  : t('admin.hotels.payment.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rooms Section */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-slate-200">
          {t('admin.nav.rooms')}
        </h2>
        <button
          onClick={() => setShowCreateRoom(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg shadow-blue-500/20"
        >
          <Plus className="w-5 h-5" />
          {t('admin.hotels.addRoom')}
        </button>
      </div>

      {/* Rooms Grid */}
      {rooms === undefined ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500/20 border-t-blue-500"></div>
        </div>
      ) : rooms.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-slate-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-300 mb-2">
            {t('admin.hotels.noRooms')}
          </h3>
          <p className="text-slate-500 mb-6">
            {t('admin.hotels.noRoomsDescription')}
          </p>
          <button
            onClick={() => setShowCreateRoom(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-500/10 text-blue-400 font-medium rounded-xl hover:bg-blue-500/20 transition-colors border border-blue-500/20"
          >
            <Plus className="w-5 h-5" />
            {t('admin.hotels.addFirstRoom')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => {
            const status = statusConfig[room.liveState]
            const StatusIcon = status.icon

            return (
              <div
                key={room._id}
                className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-5 hover:border-slate-700/50 transition-all relative"
              >
                {/* Menu Button */}
                <div className="absolute top-4 right-4">
                  <button
                    onClick={() =>
                      setActiveMenu(activeMenu === room._id ? null : room._id)
                    }
                    className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <MoreVertical className="w-4 h-4 text-slate-500" />
                  </button>

                  {activeMenu === room._id && (
                    <div className="absolute right-0 top-8 w-52 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-10 overflow-hidden">
                      <button
                        onClick={() => {
                          setEditingRoom(room._id)
                          setActiveMenu(null)
                        }}
                        className="flex items-center gap-3 px-4 py-2.5 text-slate-300 hover:bg-slate-700 transition-colors w-full text-sm"
                      >
                        <Pencil className="w-4 h-4" />
                        {t('admin.hotels.editRoom')}
                      </button>
                      <div className="border-t border-slate-700 my-1"></div>
                      <p className="px-4 py-2 text-xs text-slate-500 font-medium">
                        {t('admin.hotels.setStatus')}
                      </p>
                      {operationalStatusOptions.map((key) => {
                        const config = statusConfig[key]

                        return (
                          <button
                            key={key}
                            onClick={() => handleStatusChange(room._id, key)}
                            className={`flex items-center gap-3 px-4 py-2 hover:bg-slate-700 transition-colors w-full text-sm ${
                              room.operationalStatus === key
                                ? config.color
                                : 'text-slate-400'
                            }`}
                          >
                            <config.icon className="w-4 h-4" />
                            {config.label}
                          </button>
                        )
                      })}
                      <div className="border-t border-slate-700 my-1"></div>
                      <button
                        onClick={() => handleDeleteRoom(room._id)}
                        className="flex items-center gap-3 px-4 py-2.5 text-red-400 hover:bg-slate-700 transition-colors w-full text-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                        {t('admin.hotels.deleteRoom')}
                      </button>
                    </div>
                  )}
                </div>

                {/* Room Info */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-slate-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-200">
                      {t('hotel.room')} {room.roomNumber}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {roomTypeLabels[room.type]}
                    </p>
                  </div>
                </div>

                {/* Status Badge */}
                <div
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${status.bg} ${status.color} ${status.border} border mb-4`}
                >
                  <StatusIcon className="w-3.5 h-3.5" />
                  {status.label}
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-slate-400">
                    <DollarSign className="w-4 h-4" />
                    <span>
                      ${(room.basePrice / 100).toFixed(2)}/{t('hotel.night')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Users className="w-4 h-4" />
                    <span>
                      {t('admin.hotels.maxOccupancy', {
                        count: room.maxOccupancy,
                      })}
                    </span>
                  </div>
                </div>

                {room.amenities && room.amenities.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-800">
                    <div className="flex flex-wrap gap-2">
                      {room.amenities.slice(0, 3).map((amenity) => (
                        <span
                          key={amenity}
                          className="px-2 py-1 bg-slate-800 text-slate-400 rounded text-xs"
                        >
                          {amenity}
                        </span>
                      ))}
                      {room.amenities.length > 3 && (
                        <span className="px-2 py-1 bg-slate-800 text-slate-500 rounded text-xs">
                          {t('grid.more', { count: room.amenities.length - 3 })}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Ratings Section */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-200">
            {t('admin.hotels.ratings')}
          </h2>
          <span className="text-sm text-slate-500">
            {t('admin.hotels.totalCount', { count: ratings?.length ?? 0 })}
          </span>
        </div>

        {ratings === undefined ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500/20 border-t-blue-500"></div>
          </div>
        ) : ratings.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-8 text-center text-slate-500">
            {t('admin.hotels.noRatings')}
          </div>
        ) : (
          <div className="space-y-4">
            {ratings.map((rating) => (
              <div
                key={rating._id}
                className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((value) => (
                          <Star
                            key={value}
                            className={`w-4 h-4 ${
                              value <= rating.rating
                                ? 'text-blue-400 fill-blue-400'
                                : 'text-slate-600'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-slate-500">
                        {new Date(rating.createdAt).toLocaleDateString(
                          dateLocale,
                          {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          },
                        )}
                      </span>
                    </div>

                    <p className="text-sm text-slate-400 mt-3">
                      {rating.review || t('admin.hotels.noReviewText')}
                    </p>
                    <p className="text-xs text-slate-500 mt-2">
                      {rating.user?.email || t('admin.hotels.unknownUser')}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteRating(rating._id)}
                    className="p-2 rounded-lg hover:bg-red-500/10 transition-colors text-red-400"
                    aria-label={t('admin.hotels.deleteRating')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Room Modal */}
      {(showCreateRoom || editingRoom) && (
        <RoomModal
          hotelId={hotelId as Id<'hotels'>}
          roomId={editingRoom}
          onClose={() => {
            setShowCreateRoom(false)
            setEditingRoom(null)
          }}
        />
      )}

      {/* Edit Hotel Modal */}
      {showEditHotel && (
        <HotelEditModal
          hotelId={hotelId as Id<'hotels'>}
          onClose={() => setShowEditHotel(false)}
        />
      )}

      {/* Click outside to close menu */}
      {activeMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setActiveMenu(null)}
        />
      )}
    </div>
  )
}
