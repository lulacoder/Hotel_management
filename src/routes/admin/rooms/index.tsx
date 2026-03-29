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
import { useTheme } from '@/lib/theme'
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
  const { theme } = useTheme()
  const isDark = theme === 'dark'
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
          className={`text-3xl font-semibold tracking-tight mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {t('admin.nav.rooms')}
        </h1>
        <p
          className={`text-[0.95rem] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
        >
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
              isDark
                ? searchFocused
                  ? 'bg-slate-800/60 border-violet-500/30 shadow-[0_0_20px_-4px_rgba(139,92,246,0.15)]'
                  : 'bg-slate-900/40 border-slate-800/50 hover:border-slate-700/60'
                : searchFocused
                  ? 'bg-white border-violet-400/60 shadow-[0_0_16px_-4px_rgba(139,92,246,0.15)]'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
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
                isDark
                  ? searchFocused
                    ? 'text-violet-400'
                    : 'text-slate-500'
                  : searchFocused
                    ? 'text-violet-500'
                    : 'text-slate-400'
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
            className={`w-full pl-12 pr-4 py-3.5 bg-transparent focus:outline-none transition-all rounded-xl ${isDark ? 'text-slate-200 placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'}`}
          />
        </div>
      </motion.div>

      {/* Filter notice banner */}
      {search.operationalStatus !== 'all' && (
        <motion.div
          className={`mb-7 flex items-center gap-3 rounded-xl border px-5 py-3.5 text-sm overflow-hidden relative ${
            isDark
              ? 'border-violet-500/15 bg-violet-950/20 backdrop-blur-sm text-violet-100'
              : 'border-violet-400/25 bg-violet-50 text-violet-800'
          }`}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.35 }}
        >
          {/* Left accent bar */}
          <div
            className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl ${isDark ? 'bg-gradient-to-b from-violet-400 to-violet-500' : 'bg-gradient-to-b from-violet-400 to-violet-600'}`}
          />
          <SlidersHorizontal
            className={`h-4 w-4 flex-shrink-0 ml-1 ${isDark ? 'text-violet-300' : 'text-violet-600'}`}
          />
          <span className={isDark ? 'text-violet-100/90' : 'text-violet-700'}>
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
            <div
              className={`animate-spin rounded-full h-9 w-9 border-2 ${isDark ? 'border-violet-500/20 border-t-violet-400' : 'border-violet-500/20 border-t-violet-500'}`}
            />
            <div
              className={`absolute inset-0 rounded-full animate-ping opacity-20 border ${isDark ? 'border-violet-400' : 'border-violet-400'}`}
            />
          </div>
        </div>
      ) : filteredHotels?.length === 0 ? (
        <motion.div
          className={`relative rounded-2xl border p-14 text-center overflow-hidden ${isDark ? 'border-slate-800/50' : 'border-slate-200/80 bg-white/80 shadow-sm backdrop-blur-sm'}`}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {isDark && (
            <>
              <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-slate-900/60 to-slate-950/90" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.03)_0%,transparent_70%)]" />
            </>
          )}

          <div className="relative z-10">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 ${
                isDark
                  ? 'bg-gradient-to-br from-slate-800 to-slate-800/60 border border-slate-700/40 shadow-lg shadow-slate-950/50'
                  : 'bg-slate-100 border border-slate-200'
              }`}
            >
              <Hotel
                className={`w-8 h-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
              />
            </div>
            <h3
              className={`text-lg font-semibold mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {searchTerm
                ? t('admin.hotels.noneFound')
                : t('admin.hotels.noneYet')}
            </h3>
            <p
              className={`mb-8 max-w-md mx-auto leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
            >
              {searchTerm
                ? t('admin.rooms.trySearchAdjust')
                : t('admin.rooms.createHotelFirst')}
            </p>
            {!searchTerm && (
              <Link
                to="/admin/hotels"
                className={`group/btn relative inline-flex items-center gap-2 px-6 py-2.5 font-medium rounded-xl transition-all duration-300 border ${
                  isDark
                    ? 'border-violet-500/25 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 hover:border-violet-500/40 hover:shadow-[0_0_24px_-6px_rgba(139,92,246,0.25)]'
                    : 'border-violet-400/40 bg-violet-500/10 text-violet-600 hover:bg-violet-500/20 hover:border-violet-400/60'
                }`}
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
                className={`group relative flex items-center justify-between rounded-xl p-5 transition-all duration-300 overflow-hidden border ${
                  isDark
                    ? 'bg-slate-900/50 border-slate-800/50 hover:border-slate-700/50 hover:bg-slate-800/30'
                    : 'bg-white/80 border-slate-200/80 hover:border-slate-300 hover:shadow-md shadow-sm backdrop-blur-sm'
                }`}
              >
                {/* Gradient left border accent */}
                <div
                  className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
                    isDark
                      ? 'bg-gradient-to-b from-violet-500/60 via-violet-500/40 to-transparent'
                      : 'bg-gradient-to-b from-violet-400 via-violet-500/60 to-transparent'
                  }`}
                />

                <div className="flex items-center gap-4">
                  {/* Icon with gradient background */}
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                      isDark
                        ? 'bg-gradient-to-br from-slate-800 to-violet-950/60 border border-slate-700/30 group-hover:border-violet-500/20 shadow-sm'
                        : 'bg-slate-100 border border-slate-200 group-hover:border-violet-300'
                    }`}
                  >
                    <Building2
                      className={`w-6 h-6 transition-colors duration-300 ${isDark ? 'text-slate-400 group-hover:text-violet-400' : 'text-slate-400 group-hover:text-violet-500'}`}
                    />
                  </div>
                  <div>
                    <h3
                      className={`font-semibold transition-colors duration-300 ${isDark ? 'text-slate-200 group-hover:text-violet-400' : 'text-slate-800 group-hover:text-violet-600'}`}
                    >
                      <span className="relative">
                        {hotel.name}
                        {/* Hover underline animation */}
                        <span
                          className={`absolute -bottom-px left-0 w-0 h-px group-hover:w-full transition-all duration-300 ${isDark ? 'bg-violet-400/60' : 'bg-violet-400/70'}`}
                        />
                      </span>
                    </h3>
                    <div
                      className={`flex items-center gap-2 text-sm mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>
                        {hotel.city}, {hotel.country}
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight
                  className={`w-5 h-5 transition-all duration-300 group-hover:translate-x-1 ${isDark ? 'text-slate-600 group-hover:text-violet-400' : 'text-slate-400 group-hover:text-violet-500'}`}
                />
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
