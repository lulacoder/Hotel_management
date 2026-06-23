// Admin hotels management route for creating, editing, and listing hotel properties.
import { Link, createFileRoute } from '@tanstack/react-router'
import {
  Building2,
  Eye,
  MapPin,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { m } from 'motion/react'
import { api } from '../../../../convex/_generated/api'
import { useAdminSession } from '../../../lib/adminSession'
import { useI18n } from '../../../lib/i18n/provider'
import { useTheme } from '../../../lib/theme'
import { HotelModal } from './index/components/-HotelModal'
import type { RequestForQueries } from 'convex/react'
import type { Id } from '../../../../convex/_generated/dataModel'
import { useMutation, useQuery } from '@/integrations/convex/hooks'
import {
  ConvexPreloader,
  useIntentPreloadTarget,
} from '@/integrations/convex/preload'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/admin/hotels/')({
  // Register hotels management route in admin section.
  component: HotelsPage,
})

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

function HotelsPage() {
  // Query hotels + role context, then derive visible/editable records.
  const { t } = useI18n()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingHotel, setEditingHotel] = useState<Id<'hotels'> | null>(null)
  const [activeMenu, setActiveMenu] = useState<Id<'hotels'> | null>(null)
  const [hotelToDelete, setHotelToDelete] = useState<Id<'hotels'> | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const { hotelAssignment, profile } = useAdminSession()
  const hotels = useQuery(api.hotels.list, {})
  const deleteHotel = useMutation(api.hotels.softDelete)
  const {
    store: preloadStore,
    getIntentProps: getPreloadIntentProps,
  } = useIntentPreloadTarget<Id<'hotels'>>()

  const canAddHotel = profile.role === 'room_admin'
  const canEditHotel =
    profile.role === 'room_admin' || hotelAssignment?.role === 'hotel_admin'

  const buildPreloadQueries = useCallback(
    (hotelId: Id<'hotels'>): RequestForQueries => {
      const canPreloadPaymentSettings = Boolean(
        hotelAssignment?.hotelId === hotelId &&
          ['hotel_admin', 'hotel_cashier'].includes(hotelAssignment.role),
      )

      return {
        hotel: {
          query: api.hotels.get,
          args: { hotelId },
        },
        rooms: {
          query: api.rooms.getByHotelWithLiveState,
          args: { hotelId },
        },
        ...(canPreloadPaymentSettings
          ? {
              bankAccounts: {
                query: api.hotelBankAccounts.listByHotel,
                args: { hotelId },
              },
            }
          : {}),
      }
    },
    [hotelAssignment],
  )

  const visibleHotels =
    profile.role === 'room_admin'
      ? hotels
      : hotels?.filter((hotel) => hotel._id === hotelAssignment?.hotelId)

  const filteredHotels = visibleHotels?.filter(
    (hotel) =>
      hotel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      hotel.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      hotel.country.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  // Close the open dropdown when clicking anywhere outside of it.
  useEffect(() => {
    if (!activeMenu) return
    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [activeMenu])

  const confirmDelete = async () => {
    // Soft delete after confirmation; restricted to top-level admins.
    if (!canAddHotel || !hotelToDelete) return
    setIsDeleting(true)
    try {
      await deleteHotel({ hotelId: hotelToDelete })
      setHotelToDelete(null)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      <ConvexPreloader store={preloadStore} buildQueries={buildPreloadQueries} />

      {/* Header */}
      <m.div
        className="flex items-center justify-between mb-8"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div>
          <h1
            className={`text-3xl font-semibold tracking-tight mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            {t('admin.nav.hotels')}
          </h1>
          <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
            {t('admin.hotels.description')}
          </p>
        </div>
        {canAddHotel && (
          <Button
            type="button"
            variant="default"
            size="lg"
            onClick={() => setShowCreateModal(true)}
            className="gap-2 px-4"
          >
            <Plus className="size-5" />
            {t('admin.hotels.addHotel')}
          </Button>
        )}
      </m.div>

      {/* Search */}
      <m.div
        className="relative mb-6 w-full min-w-0"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
      >
        <Search
          className={`absolute left-4 top-1/2 -translate-y-1/2 size-5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
        />
        <input
          aria-label={t('admin.hotels.searchPlaceholder')}
          type="text"
          placeholder={t('admin.hotels.searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="admin-field w-full min-w-0 !pl-12"
        />
      </m.div>

      {/* Hotels Grid */}
      {visibleHotels === undefined ? (
        <div className="flex items-center justify-center py-20">
          <div
            className={`animate-spin rounded-full size-8 border-2 ${isDark ? 'border-violet-500/20 border-t-violet-500' : 'border-violet-500/20 border-t-violet-500'}`}
          ></div>
        </div>
      ) : filteredHotels?.length === 0 ? (
        <m.div
          className="admin-empty-state p-12"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <div className="admin-empty-icon">
            <Building2
              className={`size-8 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}
            />
          </div>
          <h3
            className={`text-lg font-semibold mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
          >
            {searchTerm
              ? t('admin.hotels.noneFound')
              : t('admin.hotels.noneYet')}
          </h3>
          <p className={`mb-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {searchTerm
              ? t('admin.hotels.trySearchAdjust')
              : t('admin.hotels.getStarted')}
          </p>
          {!searchTerm && canAddHotel && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="admin-button-soft inline-flex items-center gap-2 px-5 py-2.5"
            >
              <Plus className="size-5" />
              {t('admin.hotels.addFirst')}
            </button>
          )}
        </m.div>
      ) : (
        <m.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {filteredHotels?.map((hotel) => (
            <m.div
              key={hotel._id}
              variants={itemVariants}
              className={`admin-surface group rounded-2xl p-6 transition-all duration-200 relative ${
                activeMenu === hotel._id ? 'z-20' : ''
              } ${
                isDark
                  ? 'hover:border-slate-700/50 hover:bg-slate-900/80'
                  : 'hover:shadow-md hover:border-slate-300'
              }`}
            >
              {/* Menu Button */}
              <div
                className="absolute top-4 right-4"
                ref={activeMenu === hotel._id ? menuRef : undefined}
              >
                <button
                  type="button"
                  onClick={() =>
                    setActiveMenu(activeMenu === hotel._id ? null : hotel._id)
                  }
                  className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
                >
                  <MoreVertical
                    className={`size-5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                  />
                </button>

                {/* Dropdown Menu */}
                {activeMenu === hotel._id && (
                  <div className="admin-menu-panel absolute right-0 top-10 w-48 z-10 overflow-hidden">
                    <Link
                      {...getPreloadIntentProps(hotel._id)}
                      to="/admin/hotels/$hotelId"
                      params={{ hotelId: hotel._id }}
                      search={{ operationalStatus: 'all', window: '30d' }}
                      onClick={() => setActiveMenu(null)}
                      className="admin-menu-item flex items-center gap-3 px-4 py-3"
                    >
                      <Eye className="size-4" />
                      {t('admin.hotels.viewDetails')}
                    </Link>
                    {canEditHotel && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingHotel(hotel._id)
                          setActiveMenu(null)
                        }}
                        className="admin-menu-item flex items-center gap-3 px-4 py-3 w-full"
                      >
                        <Pencil className="size-4" />
                        {t('admin.hotels.editHotel')}
                      </button>
                    )}
                    {canAddHotel && (
                      <button
                        type="button"
                        onClick={() => {
                          setHotelToDelete(hotel._id)
                          setActiveMenu(null)
                        }}
                        className={`admin-menu-item flex items-center gap-3 px-4 py-3 text-red-400 w-full ${
                          isDark ? 'hover:bg-slate-700' : 'hover:bg-red-50'
                        }`}
                      >
                        <Trash2 className="size-4" />
                        {t('admin.hotels.deleteHotel')}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Hotel Info */}
              <div className="mb-4">
                <h3
                  className={`text-lg font-semibold mb-2 pr-8 ${isDark ? 'text-slate-200' : 'text-slate-900'}`}
                >
                  {hotel.name}
                </h3>
                <div
                  className={`flex items-center gap-2 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
                >
                  <MapPin className="size-4" />
                  <span>
                    {hotel.city}, {hotel.country}
                  </span>
                </div>
              </div>

              <p
                className={`text-sm mb-4 line-clamp-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
              >
                {hotel.address}
              </p>

              <Link
                {...getPreloadIntentProps(hotel._id)}
                to="/admin/hotels/$hotelId"
                params={{ hotelId: hotel._id }}
                search={{ operationalStatus: 'all', window: '30d' }}
                className={`inline-flex items-center gap-2 text-sm font-medium transition-colors ${
                  isDark
                    ? 'text-violet-400 hover:text-violet-300'
                    : 'text-violet-600 hover:text-violet-700'
                }`}
              >
                {t('admin.hotels.manageRooms')}
                <span className="text-lg">→</span>
              </Link>
            </m.div>
          ))}
        </m.div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingHotel) && canEditHotel && (
        <HotelModal
          hotelId={editingHotel}
          onClose={() => {
            setShowCreateModal(false)
            setEditingHotel(null)
          }}
        />
      )}

      {/* Delete confirmation */}
      {hotelToDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
          <div className="admin-modal-panel my-4 w-full max-w-md">
            <div className="admin-modal-header">
              <h2
                className={`text-xl font-semibold ${
                  isDark ? 'text-slate-100' : 'text-slate-900'
                }`}
              >
                {t('admin.hotels.confirmDeleteTitle')}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {t('admin.hotels.confirmDeleteWarning')}
              </p>
            </div>
            <div className="admin-modal-body flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setHotelToDelete(null)}
                disabled={isDeleting}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={confirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? t('admin.hotels.deleting') : t('common.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
