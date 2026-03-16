// Admin hotels management route for creating, editing, and listing hotel properties.
import { createFileRoute, Link } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import {
  Plus,
  Search,
  MapPin,
  Building2,
  MoreVertical,
  Pencil,
  Trash2,
  Eye,
} from 'lucide-react'
import { useState } from 'react'
import { motion } from 'motion/react'
import { Id } from '../../../../convex/_generated/dataModel'
import { HotelModal } from './index/components/-HotelModal'
import { useI18n } from '../../../lib/i18n'
import { useTheme } from '../../../lib/theme'

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
  const { user } = useUser()
  const { t } = useI18n()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingHotel, setEditingHotel] = useState<Id<'hotels'> | null>(null)
  const [activeMenu, setActiveMenu] = useState<Id<'hotels'> | null>(null)

  const hotels = useQuery(api.hotels.list, {})
  const profile = useQuery(api.users.getMe, user?.id ? {} : 'skip')
  const hotelAssignment = useQuery(
    api.hotelStaff.getMyAssignment,
    profile ? {} : 'skip',
  )
  const deleteHotel = useMutation(api.hotels.softDelete)

  const canAddHotel = profile?.role === 'room_admin'
  const canEditHotel =
    profile?.role === 'room_admin' || hotelAssignment?.role === 'hotel_admin'

  const visibleHotels =
    profile?.role === 'room_admin'
      ? hotels
      : hotels?.filter((hotel) => hotel._id === hotelAssignment?.hotelId)

  const filteredHotels = visibleHotels?.filter(
    (hotel) =>
      hotel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      hotel.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      hotel.country.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleDelete = async (hotelId: Id<'hotels'>) => {
    // Soft delete after confirmation; restricted to top-level admins.
    if (!user?.id) return
    if (!canAddHotel) return
    if (confirm(t('admin.hotels.confirmDelete'))) {
      await deleteHotel({ hotelId })
    }
    setActiveMenu(null)
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
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
          <button
            onClick={() => setShowCreateModal(true)}
            className={`flex items-center gap-2 px-5 py-2.5 font-medium rounded-xl transition-all duration-200 shadow-lg ${
              isDark
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-blue-500/20'
                : 'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-amber-500/20'
            }`}
          >
            <Plus className="w-5 h-5" />
            {t('admin.hotels.addHotel')}
          </button>
        )}
      </motion.div>

      {/* Search */}
      <motion.div
        className="relative mb-6"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
      >
        <Search
          className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
        />
        <input
          type="text"
          placeholder={t('admin.hotels.searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`w-full pl-12 pr-4 py-3 rounded-xl transition-all focus:outline-none ${
            isDark
              ? 'bg-slate-900/50 border border-slate-800/50 text-slate-200 placeholder-slate-500 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20'
              : 'bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 shadow-sm'
          }`}
        />
      </motion.div>

      {/* Hotels Grid */}
      {visibleHotels === undefined ? (
        <div className="flex items-center justify-center py-20">
          <div
            className={`animate-spin rounded-full h-8 w-8 border-2 ${isDark ? 'border-blue-500/20 border-t-blue-500' : 'border-amber-500/20 border-t-amber-500'}`}
          ></div>
        </div>
      ) : filteredHotels?.length === 0 ? (
        <motion.div
          className={`rounded-2xl p-12 text-center border ${isDark ? 'bg-slate-900/50 border-slate-800/50' : 'bg-white/80 border-slate-200/80 shadow-sm backdrop-blur-sm'}`}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
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
              onClick={() => setShowCreateModal(true)}
              className={`inline-flex items-center gap-2 px-5 py-2.5 font-medium rounded-xl transition-colors border ${
                isDark
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20'
                  : 'bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20'
              }`}
            >
              <Plus className="w-5 h-5" />
              {t('admin.hotels.addFirst')}
            </button>
          )}
        </motion.div>
      ) : (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {filteredHotels?.map((hotel) => (
            <motion.div
              key={hotel._id}
              variants={itemVariants}
              className={`group rounded-2xl p-6 hover:border-slate-700/50 transition-all duration-200 relative border ${
                isDark
                  ? 'bg-slate-900/50 border-slate-800/50 hover:border-slate-700/50'
                  : 'bg-white/80 border-slate-200/80 shadow-sm backdrop-blur-sm hover:shadow-md hover:border-slate-300'
              }`}
            >
              {/* Menu Button */}
              <div className="absolute top-4 right-4">
                <button
                  onClick={() =>
                    setActiveMenu(activeMenu === hotel._id ? null : hotel._id)
                  }
                  className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
                >
                  <MoreVertical
                    className={`w-5 h-5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                  />
                </button>

                {/* Dropdown Menu */}
                {activeMenu === hotel._id && (
                  <div
                    className={`absolute right-0 top-10 w-48 rounded-xl shadow-xl z-10 overflow-hidden border ${
                      isDark
                        ? 'bg-slate-800 border-slate-700'
                        : 'bg-white border-slate-200 shadow-lg'
                    }`}
                  >
                    <Link
                      to="/admin/hotels/$hotelId"
                      params={{ hotelId: hotel._id }}
                      search={{ operationalStatus: 'all', window: '30d' }}
                      className={`flex items-center gap-3 px-4 py-3 transition-colors ${isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      <Eye className="w-4 h-4" />
                      {t('admin.hotels.viewDetails')}
                    </Link>
                    {canEditHotel && (
                      <button
                        onClick={() => {
                          setEditingHotel(hotel._id)
                          setActiveMenu(null)
                        }}
                        className={`flex items-center gap-3 px-4 py-3 transition-colors w-full ${isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50'}`}
                      >
                        <Pencil className="w-4 h-4" />
                        {t('admin.hotels.editHotel')}
                      </button>
                    )}
                    {canAddHotel && (
                      <button
                        onClick={() => handleDelete(hotel._id)}
                        className={`flex items-center gap-3 px-4 py-3 text-red-400 transition-colors w-full ${isDark ? 'hover:bg-slate-700' : 'hover:bg-red-50'}`}
                      >
                        <Trash2 className="w-4 h-4" />
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
                  <MapPin className="w-4 h-4" />
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
                to="/admin/hotels/$hotelId"
                params={{ hotelId: hotel._id }}
                search={{ operationalStatus: 'all', window: '30d' }}
                className={`inline-flex items-center gap-2 text-sm font-medium transition-colors ${
                  isDark
                    ? 'text-blue-400 hover:text-blue-300'
                    : 'text-amber-600 hover:text-amber-700'
                }`}
              >
                {t('admin.hotels.manageRooms')}
                <span className="text-lg">→</span>
              </Link>
            </motion.div>
          ))}
        </motion.div>
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
