// Hotel details management route inside admin, including room-level controls.
import { Link, createFileRoute } from '@tanstack/react-router'
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
import { useEffect, useMemo, useRef, useState } from 'react'

import { api } from '../../../../convex/_generated/api'
import { useI18n } from '../../../lib/i18n/provider'
import { useTheme } from '../../../lib/theme'
import {
  normalizeAnalyticsWindow,
  normalizeRoomOperationalStatusFilter,
} from '../../../lib/adminAnalytics'
import { RoomModal } from './$hotelId/components/-RoomModal'
import { HotelEditModal } from './$hotelId/components/-HotelEditModal'
import { BankAccountModal } from './$hotelId/components/-BankAccountModal'
import type { Id } from '../../../../convex/_generated/dataModel'
import { useMutation, useQuery } from '@/integrations/convex/hooks'
import { Button } from '@/components/ui/button'
import { useAdminSession } from '@/lib/adminSession'
import { AdminSpinner } from '@/components/AdminSpinner'
import { formatUsdAmount } from '@/lib/currency'

const OPERATIONAL_STATUS_OPTIONS = [
  'available',
  'maintenance',
  'cleaning',
  'out_of_order',
] as const

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
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [showCreateRoom, setShowCreateRoom] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Id<'rooms'> | null>(null)
  const [activeMenu, setActiveMenu] = useState<Id<'rooms'> | null>(null)
  const [showEditHotel, setShowEditHotel] = useState(false)
  const [showBankAccountModal, setShowBankAccountModal] = useState(false)
  const [editingBankAccount, setEditingBankAccount] = useState<{
    _id: Id<'hotelBankAccounts'>
    bankName: string
    accountNumber: string
  } | null>(null)
  const bankAccountsBackfilledRef = useRef(false)
  const { t, locale } = useI18n()
  const dateLocale = locale === 'am' ? 'am-ET' : 'en-US'

  const { hotelAssignment } = useAdminSession()

  const canManagePaymentSettings =
    hotelAssignment?.hotelId === (hotelId as Id<'hotels'>) &&
    ['hotel_admin', 'hotel_cashier'].includes(hotelAssignment.role)

  const hotel = useQuery(api.hotels.get, { hotelId: hotelId as Id<'hotels'> })
  const bankAccounts = useQuery(api.hotelBankAccounts.listByHotel, {
    hotelId: hotelId as Id<'hotels'>,
  })
  const rooms = useQuery(api.rooms.getByHotelWithLiveState, {
    hotelId: hotelId as Id<'hotels'>,
  })
  const ratings = useQuery(api.ratings.getHotelRatingsAdmin, {
    hotelId: hotelId as Id<'hotels'>,
  })

  const deleteRoom = useMutation(api.rooms.softDelete)
  const updateRoomStatus = useMutation(api.rooms.updateStatus)
  const deleteRating = useMutation(api.ratings.softDeleteRating)
  const deleteBankAccount = useMutation(api.hotelBankAccounts.softDelete)
  const backfillBankAccounts = useMutation(
    api.hotelBankAccounts.backfillDefaultName,
  )

  useEffect(() => {
    if (!canManagePaymentSettings || bankAccountsBackfilledRef.current) {
      return
    }

    bankAccountsBackfilledRef.current = true
    backfillBankAccounts({ hotelId: hotelId as Id<'hotels'> })
      .catch(() => {})
      .finally(() => {
        bankAccountsBackfilledRef.current = true
      })
  }, [backfillBankAccounts, canManagePaymentSettings, hotelId])

  const handleDeleteRoom = async (roomId: Id<'rooms'>) => {
    if (confirm(t('admin.hotels.confirmDeleteRoom'))) {
      await deleteRoom({ roomId })
    }
    setActiveMenu(null)
  }

  const handleDeleteRating = async (ratingId: Id<'hotelRatings'>) => {
    if (confirm(t('admin.hotels.confirmDeleteRating'))) {
      await deleteRating({ ratingId })
    }
  }

  const handleStatusChange = async (
    roomId: Id<'rooms'>,
    status: 'available' | 'maintenance' | 'cleaning' | 'out_of_order',
  ) => {
    // Update room operational status from contextual quick actions.
    await updateRoomStatus({
      roomId,
      operationalStatus: status,
    })
    setActiveMenu(null)
  }

  const handleDeleteBankAccount = async (account: {
    _id: Id<'hotelBankAccounts'>
  }) => {
    if (!canManagePaymentSettings) {
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

  const roomTypeLabels: Record<string, string> = {
    budget: t('hotel.budgetRoom'),
    standard: t('hotel.standardRoom'),
    suite: t('hotel.suiteRoom'),
    deluxe: t('hotel.deluxeRoom'),
  }

  const visibleRooms = useMemo(() => {
    if (!rooms) return rooms
    if (search.operationalStatus === 'all') return rooms
    return rooms.filter(
      (room) => room.operationalStatus === search.operationalStatus,
    )
  }, [rooms, search.operationalStatus])

  if (hotel === undefined) {
    return <AdminSpinner />
  }

  if (hotel === null) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="admin-empty-state p-12">
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
            className="admin-button-secondary inline-flex items-center gap-2"
          >
            <ArrowLeft className="size-5" />
            {t('admin.hotels.backToHotels')}
          </Link>
        </div>
      </div>
    )
  }

  const cardClass = 'admin-surface rounded-2xl'
  const innerCellClass = 'admin-surface-muted rounded-xl'

  return (
    <div className="max-w-7xl mx-auto">
      {/* Back Link */}
      <Link
        to="/admin/hotels"
        className={`inline-flex items-center gap-2 transition-colors mb-6 ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
      >
        <ArrowLeft className="size-4" />
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
              <MapPin className="size-4" />
              <span>{hotel.address}</span>
            </div>
            <p className={isDark ? 'text-slate-500' : 'text-slate-400'}>
              {hotel.city}, {hotel.country}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => setShowEditHotel(true)}
            className="gap-2 px-4"
          >
            <Edit className="size-4" />
            {t('admin.hotels.editHotel')}
          </Button>
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
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => {
                setEditingBankAccount(null)
                setShowBankAccountModal(true)
              }}
              className="px-4"
            >
              {t('admin.hotels.payment.addAccount')}
            </Button>
          </div>

          {bankAccounts === undefined ? (
            <AdminSpinner
              className="flex items-center justify-center py-6"
              sizeClassName="size-6"
            />
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingBankAccount(account)
                        setShowBankAccountModal(true)
                      }}
                    >
                      {t('admin.hotels.payment.editAccount')}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteBankAccount(account)}
                    >
                      {t('admin.hotels.payment.deleteAccount')}
                    </Button>
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
          {t('admin.rooms.analyticsFilterNotice', {
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
        <Button
          type="button"
          variant="default"
          size="lg"
          onClick={() => setShowCreateRoom(true)}
          className="gap-2 px-4"
        >
          <Plus className="size-5" />
          {t('admin.hotels.addRoom')}
        </Button>
      </div>

      {/* Rooms Grid */}
      {rooms === undefined ? (
        <AdminSpinner className="flex items-center justify-center py-12" />
      ) : visibleRooms?.length === 0 && rooms.length === 0 ? (
        <div className={`${cardClass} p-12 text-center`}>
          <div className="admin-empty-icon">
            <Building2
              className={`size-8 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}
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
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => setShowCreateRoom(true)}
            className="gap-2 px-5"
          >
            <Plus className="size-5" />
            {t('admin.hotels.addFirstRoom')}
          </Button>
        </div>
      ) : visibleRooms?.length === 0 ? (
        <div className={`${cardClass} p-12 text-center`}>
          <div className="admin-empty-icon">
            <Building2
              className={`size-8 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}
            />
          </div>
          <h3
            className={`text-lg font-semibold mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
          >
            {t('admin.analytics.noData')}
          </h3>
          <p className={isDark ? 'text-slate-500' : 'text-slate-500'}>
            {t('admin.rooms.filteredNoRooms')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleRooms?.map((room) => {
            const status = statusConfig[room.liveState]
            const StatusIcon = status.icon

            return (
              <div
                key={room._id}
                className={`${cardClass} p-5 transition-all relative overflow-visible ${
                  activeMenu === room._id ? 'z-40' : 'z-0'
                } ${
                  isDark
                    ? 'hover:border-slate-700/70 hover:bg-slate-900/80'
                    : 'hover:border-slate-300/80 hover:shadow-md'
                }`}
              >
                {/* Menu Button */}
                <div className="absolute top-4 right-4 z-50">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveMenu(activeMenu === room._id ? null : room._id)
                    }
                    aria-haspopup="menu"
                    aria-expanded={activeMenu === room._id}
                    className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
                  >
                    <MoreVertical
                      className={`size-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                    />
                  </button>

                  {activeMenu === room._id && (
                    <div
                      className="admin-menu-panel absolute right-0 top-8 z-[60] w-52 overflow-hidden shadow-xl"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRoom(room._id)
                          setActiveMenu(null)
                        }}
                        className="admin-menu-item flex items-center gap-3 px-4 py-2.5 w-full text-sm"
                      >
                        <Pencil className="size-4" />
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
                      {OPERATIONAL_STATUS_OPTIONS.map((key) => {
                        const config = statusConfig[key]

                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => handleStatusChange(room._id, key)}
                            className={`admin-menu-item flex items-center gap-3 px-4 py-2 w-full text-sm ${
                              room.operationalStatus === key
                                ? config.color
                                : isDark
                                  ? 'text-slate-400'
                                  : 'text-slate-500'
                            }`}
                          >
                            <config.icon className="size-4" />
                            {config.label}
                          </button>
                        )
                      })}
                      <div
                        className={`border-t my-1 ${isDark ? 'border-slate-700' : 'border-slate-100'}`}
                      ></div>
                      <button
                        type="button"
                        onClick={() => handleDeleteRoom(room._id)}
                        className={`admin-menu-item flex items-center gap-3 px-4 py-2.5 text-red-400 w-full text-sm ${
                          isDark ? 'hover:bg-slate-700' : 'hover:bg-red-50'
                        }`}
                      >
                        <Trash2 className="size-4" />
                        {t('admin.hotels.deleteRoom')}
                      </button>
                    </div>
                  )}
                </div>

                {/* Room Info */}
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`size-12 rounded-xl flex items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}
                  >
                    <Building2
                      className={`size-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
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
                  <StatusIcon className="size-3.5" />
                  {status.label}
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div
                    className={`flex items-center gap-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
                  >
                    <DollarSign className="size-4" />
                    <span>
                      {formatUsdAmount(room.basePrice)}/{t('hotel.night')}
                    </span>
                  </div>
                  <div
                    className={`flex items-center gap-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
                  >
                    <Users className="size-4" />
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
                      {room.amenities.slice(0, 3).map((amenity, index) => (
                        <span
                          key={`${room._id}-${amenity}-${index}`}
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
          <AdminSpinner
            className="flex items-center justify-center py-8"
            sizeClassName="size-6"
          />
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
                            className={`size-4 ${
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
                    className="admin-icon-button hover:bg-red-500/10 hover:text-red-400 text-red-400"
                    aria-label={t('admin.hotels.deleteRating')}
                  >
                    <Trash2 className="size-4" />
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
          key={editingBankAccount?._id ?? 'new-bank-account'}
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
        <button
          type="button"
          aria-label={t('common.close')}
          className="fixed inset-0 z-30"
          onClick={() => setActiveMenu(null)}
        />
      )}
    </div>
  )
}
