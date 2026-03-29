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
import { BankAccountModal } from './$hotelId/components/-BankAccountModal'
import type { Id } from '../../../../convex/_generated/dataModel'
import { useI18n } from '../../../lib/i18n'
import { useTheme } from '../../../lib/theme'
import {
  normalizeAnalyticsWindow,
  normalizeRoomOperationalStatusFilter,
} from '../../../lib/adminAnalytics'

export const Route = createFileRoute('/admin/hotels/$hotelId')({
  validateSearch: (search: Record<string, unknown>) => ({
    operationalStatus: normalizeRoomOperationalStatusFilter(
      search.operationalStatus,
    ),
    window: normalizeAnalyticsWindow(search.window),
  }),
  // Register per-hotel admin route for rooms, ratings, and metadata updates.
  component: HotelDetailPage,
})

function HotelDetailPage() {
  const { hotelId } = Route.useParams()
  const search = Route.useSearch()
  const { user } = useUser()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [showCreateRoom, setShowCreateRoom] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Id<'rooms'> | null>(null)
  const [activeMenu, setActiveMenu] = useState<Id<'rooms'> | null>(null)
  const [showEditHotel, setShowEditHotel] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)
  const [showBankAccountModal, setShowBankAccountModal] = useState(false)
  const [editingBankAccount, setEditingBankAccount] = useState<{
    _id: Id<'hotelBankAccounts'>
    bankName: string
    accountNumber: string
  } | null>(null)
  const [bankAccountsBackfilled, setBankAccountsBackfilled] = useState(false)
  const { t, locale } = useI18n()
  const dateLocale = locale === 'am' ? 'am-ET' : 'en-US'

  const profile = useQuery(api.users.getMe, user?.id ? {} : 'skip')
  const hotelAssignment = useQuery(
    api.hotelStaff.getMyAssignment,
    profile ? {} : 'skip',
  )

  const canManagePaymentSettings =
    hotelAssignment?.hotelId === (hotelId as Id<'hotels'>) &&
    ['hotel_admin', 'hotel_cashier'].includes(hotelAssignment.role)

  const hotel = useQuery(api.hotels.get, { hotelId: hotelId as Id<'hotels'> })
  const bankAccounts = useQuery(api.hotelBankAccounts.listByHotel, {
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
    user?.id ? { hotelId: hotelId as Id<'hotels'> } : 'skip',
  )

  const deleteRoom = useMutation(api.rooms.softDelete)
  const updateRoomStatus = useMutation(api.rooms.updateStatus)
  const deleteRating = useMutation(api.ratings.softDeleteRating)
  const deleteBankAccount = useMutation(api.hotelBankAccounts.softDelete)
  const backfillBankAccounts = useMutation(
    api.hotelBankAccounts.backfillDefaultName,
  )

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    if (!canManagePaymentSettings || bankAccountsBackfilled) {
      return
    }

    backfillBankAccounts({ hotelId: hotelId as Id<'hotels'> })
      .catch(() => {})
      .finally(() => {
        setBankAccountsBackfilled(true)
      })
  }, [
    backfillBankAccounts,
    bankAccountsBackfilled,
    canManagePaymentSettings,
    hotelId,
  ])

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

  const handleDeleteBankAccount = async (account: {
    _id: Id<'hotelBankAccounts'>
  }) => {
    if (!user?.id || !canManagePaymentSettings) {
      return
    }

    if (!confirm(t('admin.hotels.payment.confirmDeleteAccount'))) {
      return
    }

    await deleteBankAccount({ accountId: account._id })
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
        <div
          className={`animate-spin rounded-full h-8 w-8 border-2 ${isDark ? 'border-violet-500/20 border-t-violet-500' : 'border-violet-500/20 border-t-violet-500'}`}
        ></div>
      </div>
    )
  }

  if (hotel === null) {
    return (
      <div className="max-w-7xl mx-auto">
        <div
          className={`border rounded-2xl p-12 text-center ${isDark ? 'bg-slate-900/50 border-slate-800/50' : 'bg-white/80 border-slate-200/80 shadow-sm backdrop-blur-sm'}`}
        >
          <h2
            className={`text-xl font-semibold mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
          >
            {t('hotel.notFoundTitle')}
          </h2>
          <p className={`mb-6 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            {t('hotel.notFoundDescription')}
          </p>
          <Link
            to="/admin/hotels"
            className={`inline-flex items-center gap-2 px-5 py-2.5 font-medium rounded-xl transition-colors ${isDark ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            <ArrowLeft className="w-5 h-5" />
            {t('admin.hotels.backToHotels')}
          </Link>
        </div>
      </div>
    )
  }

  const cardClass = `border rounded-2xl ${isDark ? 'bg-slate-900/50 border-slate-800/50' : 'bg-white/80 border-slate-200/80 shadow-sm backdrop-blur-sm'}`
  const innerCellClass = `border rounded-xl ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`

  return (
    <div className="max-w-7xl mx-auto">
      {/* Back Link */}
      <Link
        to="/admin/hotels"
        className={`inline-flex items-center gap-2 transition-colors mb-6 ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
      >
        <ArrowLeft className="w-4 h-4" />
        {t('admin.hotels.backToHotels')}
      </Link>

      {/* Hotel Header */}
      <div className={`${cardClass} p-6 mb-8`}>
        <div className="flex items-start justify-between">
          <div>
            <h1
              className={`text-2xl font-semibold mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
            >
              {hotel.name}
            </h1>
            <div
              className={`flex items-center gap-2 mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
            >
              <MapPin className="w-4 h-4" />
              <span>{hotel.address}</span>
            </div>
            <p className={isDark ? 'text-slate-500' : 'text-slate-400'}>
              {hotel.city}, {hotel.country}
            </p>
          </div>
          <button
            onClick={() => setShowEditHotel(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors border ${isDark ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 shadow-sm'}`}
          >
            <Edit className="w-4 h-4" />
            {t('admin.hotels.editHotel')}
          </button>
        </div>
      </div>

      {canManagePaymentSettings && (
        <div className={`${cardClass} p-6 mb-8`}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2
                className={`text-xl font-semibold mb-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}
              >
                {t('admin.hotels.payment.title')}
              </h2>
              <p
                className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}
              >
                {t('admin.hotels.payment.description')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingBankAccount(null)
                setShowBankAccountModal(true)
              }}
              className="px-4 py-2 bg-violet-500/10 text-violet-400 font-medium rounded-xl hover:bg-violet-500/20 transition-colors border border-violet-500/20"
            >
              {t('admin.hotels.payment.addAccount')}
            </button>
          </div>

          {bankAccounts === undefined ? (
            <div className="flex items-center justify-center py-6">
              <div
                className={`animate-spin rounded-full h-6 w-6 border-2 ${isDark ? 'border-violet-500/20 border-t-violet-500' : 'border-violet-500/20 border-t-violet-500'}`}
              ></div>
            </div>
          ) : bankAccounts.length === 0 ? (
            <div
              className={`${innerCellClass} p-4 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
            >
              {t('admin.hotels.payment.noAccounts')}
            </div>
          ) : (
            <div className="space-y-3">
              {bankAccounts.map((account) => (
                <div
                  key={account._id}
                  className={`flex items-center justify-between gap-4 ${innerCellClass} p-4`}
                >
                  <div>
                    <p
                      className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}
                    >
                      {account.bankName}
                    </p>
                    <p
                      className={`text-xs break-all ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
                    >
                      {account.accountNumber}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBankAccount(account)
                        setShowBankAccountModal(true)
                      }}
                      className={`px-3 py-1.5 text-sm border rounded-lg transition-colors ${isDark ? 'text-slate-300 bg-slate-800 border-slate-700 hover:bg-slate-700' : 'text-slate-600 bg-white border-slate-200 hover:bg-slate-50'}`}
                    >
                      {t('admin.hotels.payment.editAccount')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBankAccount(account)}
                      className="px-3 py-1.5 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors"
                    >
                      {t('admin.hotels.payment.deleteAccount')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {search.operationalStatus !== 'all' && (
        <div
          className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${isDark ? 'border-blue-500/20 bg-blue-500/10 text-blue-100' : 'border-amber-500/30 bg-amber-50 text-amber-700'}`}
        >
          {t('admin.rooms.analyticsFilterNotice' as never, {
            status: t(
              `admin.hotels.status.${
                search.operationalStatus === 'out_of_order'
                  ? 'outOfOrder'
                  : search.operationalStatus
              }` as never,
            ),
          })}
        </div>
      )}

      {/* Rooms Section */}
      <div className="flex items-center justify-between mb-6">
        <h2
          className={`text-xl font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}
        >
          {t('admin.nav.rooms')}
        </h2>
        <button
          onClick={() => setShowCreateRoom(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white text-slate-900 font-medium rounded-xl hover:bg-slate-100 transition-all duration-200 shadow-lg shadow-white/10"
        >
          <Plus className="w-5 h-5" />
          {t('admin.hotels.addRoom')}
        </button>
      </div>

      {/* Rooms Grid */}
      {rooms === undefined ? (
        <div className="flex items-center justify-center py-12">
          <div
            className={`animate-spin rounded-full h-8 w-8 border-2 ${isDark ? 'border-violet-500/20 border-t-violet-500' : 'border-violet-500/20 border-t-violet-500'}`}
          ></div>
        </div>
      ) : rooms.length === 0 ? (
        <div className={`${cardClass} p-12 text-center`}>
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}
          >
            <Building2
              className={`w-8 h-8 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}
            />
          </div>
          <h3
            className={`text-lg font-semibold mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
          >
            {t('admin.hotels.noRooms')}
          </h3>
          <p className={`mb-6 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            {t('admin.hotels.noRoomsDescription')}
          </p>
          <button
            onClick={() => setShowCreateRoom(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-500/10 text-violet-400 font-medium rounded-xl hover:bg-violet-500/20 transition-colors border border-violet-500/20"
          >
            <Plus className="w-5 h-5" />
            {t('admin.hotels.addFirstRoom')}
          </button>
        </div>
      ) : rooms.filter((room) => {
          if (search.operationalStatus === 'all') {
            return true
          }

          return room.operationalStatus === search.operationalStatus
        }).length === 0 ? (
        <div className={`${cardClass} p-12 text-center`}>
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}
          >
            <Building2
              className={`w-8 h-8 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}
            />
          </div>
          <h3
            className={`text-lg font-semibold mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
          >
            {t('admin.analytics.noData' as never)}
          </h3>
          <p className={isDark ? 'text-slate-500' : 'text-slate-500'}>
            {t('admin.rooms.filteredNoRooms' as never)}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms
            .filter((room) => {
              if (search.operationalStatus === 'all') {
                return true
              }

              return room.operationalStatus === search.operationalStatus
            })
            .map((room) => {
              const status = statusConfig[room.liveState]
              const StatusIcon = status.icon

              return (
                <div
                  key={room._id}
                  className={`${cardClass} p-5 hover:border-slate-300/80 transition-all relative`}
                >
                  {/* Menu Button */}
                  <div className="absolute top-4 right-4">
                    <button
                      onClick={() =>
                        setActiveMenu(activeMenu === room._id ? null : room._id)
                      }
                      className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
                    >
                      <MoreVertical
                        className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                      />
                    </button>

                    {activeMenu === room._id && (
                      <div
                        className={`absolute right-0 top-8 w-52 border rounded-xl shadow-xl z-10 overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                      >
                        <button
                          onClick={() => {
                            setEditingRoom(room._id)
                            setActiveMenu(null)
                          }}
                          className={`flex items-center gap-3 px-4 py-2.5 transition-colors w-full text-sm ${isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50'}`}
                        >
                          <Pencil className="w-4 h-4" />
                          {t('admin.hotels.editRoom')}
                        </button>
                        <div
                          className={`border-t my-1 ${isDark ? 'border-slate-700' : 'border-slate-100'}`}
                        ></div>
                        <p
                          className={`px-4 py-2 text-xs font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                        >
                          {t('admin.hotels.setStatus')}
                        </p>
                        {operationalStatusOptions.map((key) => {
                          const config = statusConfig[key]

                          return (
                            <button
                              key={key}
                              onClick={() => handleStatusChange(room._id, key)}
                              className={`flex items-center gap-3 px-4 py-2 transition-colors w-full text-sm ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-50'} ${
                                room.operationalStatus === key
                                  ? config.color
                                  : isDark
                                    ? 'text-slate-400'
                                    : 'text-slate-500'
                              }`}
                            >
                              <config.icon className="w-4 h-4" />
                              {config.label}
                            </button>
                          )
                        })}
                        <div
                          className={`border-t my-1 ${isDark ? 'border-slate-700' : 'border-slate-100'}`}
                        ></div>
                        <button
                          onClick={() => handleDeleteRoom(room._id)}
                          className={`flex items-center gap-3 px-4 py-2.5 text-red-400 transition-colors w-full text-sm ${isDark ? 'hover:bg-slate-700' : 'hover:bg-red-50'}`}
                        >
                          <Trash2 className="w-4 h-4" />
                          {t('admin.hotels.deleteRoom')}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Room Info */}
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}
                    >
                      <Building2
                        className={`w-6 h-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
                      />
                    </div>
                    <div>
                      <h3
                        className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}
                      >
                        {t('hotel.room')} {room.roomNumber}
                      </h3>
                      <p
                        className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}
                      >
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
                    <div
                      className={`flex items-center gap-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>
                        ${(room.basePrice / 100).toFixed(2)}/{t('hotel.night')}
                      </span>
                    </div>
                    <div
                      className={`flex items-center gap-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
                    >
                      <Users className="w-4 h-4" />
                      <span>
                        {t('admin.hotels.maxOccupancy', {
                          count: room.maxOccupancy,
                        })}
                      </span>
                    </div>
                  </div>

                  {room.amenities && room.amenities.length > 0 && (
                    <div
                      className={`mt-4 pt-4 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}
                    >
                      <div className="flex flex-wrap gap-2">
                        {room.amenities.slice(0, 3).map((amenity) => (
                          <span
                            key={amenity}
                            className={`px-2 py-1 rounded text-xs ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}
                          >
                            {amenity}
                          </span>
                        ))}
                        {room.amenities.length > 3 && (
                          <span
                            className={`px-2 py-1 rounded text-xs ${isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'}`}
                          >
                            {t('grid.more', {
                              count: room.amenities.length - 3,
                            })}
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
          <h2
            className={`text-xl font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}
          >
            {t('admin.hotels.ratings')}
          </h2>
          <span
            className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}
          >
            {t('admin.hotels.totalCount', { count: ratings?.length ?? 0 })}
          </span>
        </div>

        {ratings === undefined ? (
          <div className="flex items-center justify-center py-8">
            <div
              className={`animate-spin rounded-full h-6 w-6 border-2 ${isDark ? 'border-violet-500/20 border-t-violet-500' : 'border-violet-500/20 border-t-violet-500'}`}
            ></div>
          </div>
        ) : ratings.length === 0 ? (
          <div
            className={`${cardClass} p-8 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
          >
            {t('admin.hotels.noRatings')}
          </div>
        ) : (
          <div className="space-y-4">
            {ratings.map((rating) => (
              <div key={rating._id} className={`${cardClass} p-5`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((value) => (
                          <Star
                            key={value}
                            className={`w-4 h-4 ${
                              value <= rating.rating
                                ? 'text-amber-400 fill-amber-400'
                                : isDark
                                  ? 'text-slate-600'
                                  : 'text-slate-300'
                            }`}
                          />
                        ))}
                      </div>
                      <span
                        className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                      >
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

                    <p
                      className={`text-sm mt-3 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}
                    >
                      {rating.review || t('admin.hotels.noReviewText')}
                    </p>
                    <p
                      className={`text-xs mt-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                    >
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

      {showBankAccountModal && (
        <BankAccountModal
          hotelId={hotelId as Id<'hotels'>}
          account={editingBankAccount}
          onClose={() => {
            setShowBankAccountModal(false)
            setEditingBankAccount(null)
          }}
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
