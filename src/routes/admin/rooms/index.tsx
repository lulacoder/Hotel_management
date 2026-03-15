// Room inventory management route scoped by hotel assignment/role.
import { createFileRoute, Link } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import {
  Building2,
  Hotel,
  MapPin,
  Search,
  ChevronRight,
  SlidersHorizontal,
} from 'lucide-react'
import { useState } from 'react'
import { motion } from 'motion/react'
import { useI18n } from '@/lib/i18n'
import {
  normalizeAnalyticsWindow,
  normalizeRoomOperationalStatusFilter,
} from '@/lib/adminAnalytics'

export const Route = createFileRoute('/admin/rooms/')({
  validateSearch: (search: Record<string, unknown>) => ({
    operationalStatus: normalizeRoomOperationalStatusFilter(
      search.operationalStatus,
    ),
    window: normalizeAnalyticsWindow(search.window),
  }),
  // Register rooms entry route that links to hotel-scoped room management.
  component: RoomsPage,
})

function RoomsPage() {
  const { user } = useUser()
  const { t } = useI18n()
  const search = Route.useSearch()
  const [searchTerm, setSearchTerm] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

  const hotels = useQuery(api.hotels.list, {})
  const profile = useQuery(api.users.getMe, user?.id ? {} : 'skip')
  const hotelAssignment = useQuery(
    api.hotelStaff.getMyAssignment,
    profile ? {} : 'skip',
  )

  const visibleHotels =
    profile?.role === 'room_admin'
      ? hotels
      : hotels?.filter((hotel) => hotel._id === hotelAssignment?.hotelId)

  const filteredHotels = visibleHotels?.filter(
    (hotel) =>
      hotel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      hotel.city.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        className="mb-10"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1
          className="text-3xl font-semibold tracking-tight text-slate-100 mb-2"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {t('admin.nav.rooms')}
        </h1>
        <p className="text-slate-400 text-[0.95rem] leading-relaxed">
          {t('admin.rooms.description')}
        </p>
      </motion.div>

      {/* Search — frosted glass */}
      <motion.div
        className="relative mb-8 group/search"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          className={`
            relative rounded-xl border backdrop-blur-md transition-all duration-300
            ${
              searchFocused
                ? 'bg-slate-800/60 border-cyan-500/30 shadow-[0_0_20px_-4px_rgba(34,211,238,0.15)]'
                : 'bg-slate-900/40 border-slate-800/50 hover:border-slate-700/60'
            }
          `}
        >
          <motion.div
            className="absolute left-4 top-1/2 -translate-y-1/2"
            animate={{ scale: searchFocused ? 1.15 : 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <Search
              className={`w-5 h-5 transition-colors duration-300 ${
                searchFocused ? 'text-cyan-400' : 'text-slate-500'
              }`}
            />
          </motion.div>
          <input
            type="text"
            placeholder={t('admin.rooms.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="w-full pl-12 pr-4 py-3.5 bg-transparent text-slate-200 placeholder-slate-500 focus:outline-none transition-all rounded-xl"
          />
        </div>
      </motion.div>

      {/* Filter notice banner */}
      {search.operationalStatus !== 'all' && (
        <motion.div
          className="mb-7 flex items-center gap-3 rounded-xl border border-cyan-500/15 bg-cyan-950/20 backdrop-blur-sm px-5 py-3.5 text-sm text-cyan-100 overflow-hidden relative"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.35 }}
        >
          {/* Left accent bar */}
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-cyan-400 to-blue-500 rounded-l-xl" />
          <SlidersHorizontal className="h-4 w-4 text-cyan-300 flex-shrink-0 ml-1" />
          <span className="text-cyan-100/90">
            {t('admin.rooms.analyticsFilterNotice' as never, {
              status: t(
                `admin.hotels.status.${
                  search.operationalStatus === 'out_of_order'
                    ? 'outOfOrder'
                    : search.operationalStatus
                }` as never,
              ),
            })}
          </span>
        </motion.div>
      )}

      {/* Hotels List */}
      {visibleHotels === undefined ? (
        <div className="flex items-center justify-center py-24">
          <div className="relative">
            <div className="animate-spin rounded-full h-9 w-9 border-2 border-cyan-500/20 border-t-cyan-400" />
            <div className="absolute inset-0 rounded-full animate-ping opacity-20 border border-cyan-400" />
          </div>
        </div>
      ) : filteredHotels?.length === 0 ? (
        <motion.div
          className="relative rounded-2xl border border-slate-800/50 p-14 text-center overflow-hidden"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Atmospheric background */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-slate-900/60 to-slate-950/90" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.03)_0%,transparent_70%)]" />

          <div className="relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-800/60 border border-slate-700/40 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-slate-950/50">
              <Hotel className="w-8 h-8 text-slate-500" />
            </div>
            <h3
              className="text-lg font-semibold text-slate-300 mb-2"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {searchTerm
                ? t('admin.hotels.noneFound')
                : t('admin.hotels.noneYet')}
            </h3>
            <p className="text-slate-500 mb-8 max-w-md mx-auto leading-relaxed">
              {searchTerm
                ? t('admin.rooms.trySearchAdjust')
                : t('admin.rooms.createHotelFirst')}
            </p>
            {!searchTerm && (
              <Link
                to="/admin/hotels"
                className="light-hover-accent group/btn relative inline-flex items-center gap-2 px-6 py-2.5 font-medium rounded-xl transition-all duration-300 border border-cyan-500/25 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-500/40 hover:shadow-[0_0_24px_-6px_rgba(34,211,238,0.25)]"
              >
                {t('admin.rooms.goToHotels')}
                <ChevronRight className="w-4 h-4 transition-transform duration-300 group-hover/btn:translate-x-0.5" />
              </Link>
            )}
          </div>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {filteredHotels?.map((hotel, index) => (
            <motion.div
              key={hotel._id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: index * 0.06,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <Link
                to="/admin/hotels/$hotelId"
                params={{ hotelId: hotel._id }}
                search={{
                  operationalStatus: search.operationalStatus,
                  window: search.window,
                }}
                className="group light-hover-surface relative flex items-center justify-between rounded-xl p-5 transition-all duration-300 bg-slate-900/50 border border-slate-800/50 hover:border-slate-700/50 hover:bg-slate-800/30 overflow-hidden"
              >
                {/* Gradient left border accent */}
                <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl bg-gradient-to-b from-blue-500/60 via-indigo-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div className="flex items-center gap-4">
                  {/* Icon with gradient background */}
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-800 to-indigo-950/60 border border-slate-700/30 flex items-center justify-center group-hover:border-indigo-500/20 transition-all duration-300 shadow-sm">
                    <Building2 className="w-6 h-6 text-slate-400 group-hover:text-cyan-400 transition-colors duration-300" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-200 group-hover:text-cyan-400 transition-colors duration-300">
                      <span className="relative">
                        {hotel.name}
                        {/* Hover underline animation */}
                        <span className="absolute -bottom-px left-0 w-0 h-px bg-cyan-400/60 group-hover:w-full transition-all duration-300" />
                      </span>
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-slate-500 mt-0.5">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>
                        {hotel.city}, {hotel.country}
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-cyan-400 transition-all duration-300 group-hover:translate-x-1" />
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
