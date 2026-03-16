import { Link, createFileRoute } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useQuery } from 'convex/react'
import { AlertTriangle, MessageSquareText } from 'lucide-react'
import { motion } from 'motion/react'

import { api } from '../../../../convex/_generated/api'
import { useI18n } from '../../../lib/i18n'
import { useTheme } from '@/lib/theme'

export const Route = createFileRoute('/admin/complaints/')({
  component: AdminComplaintsPage,
})

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' as const },
  },
}

function AdminComplaintsPage() {
  const { user } = useUser()
  const { t, locale } = useI18n()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const dateLocale = locale === 'am' ? 'am-ET' : 'en-US'

  const profile = useQuery(api.users.getMe, user?.id ? {} : 'skip')
  const hotelAssignment = useQuery(
    api.hotelStaff.getMyAssignment,
    profile ? {} : 'skip',
  )

  const canViewComplaints = Boolean(
    hotelAssignment &&
    ['hotel_admin', 'hotel_cashier'].includes(hotelAssignment.role),
  )

  const assignedHotel = useQuery(
    api.hotels.get,
    hotelAssignment?.hotelId ? { hotelId: hotelAssignment.hotelId } : 'skip',
  )

  const complaints = useQuery(
    api.complaints.listForAssignedHotel,
    canViewComplaints ? {} : 'skip',
  )

  if (profile === undefined || hotelAssignment === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className={`animate-spin rounded-full h-8 w-8 border-2 ${isDark ? 'border-blue-500/20 border-t-blue-500' : 'border-amber-500/20 border-t-amber-500'}`}
        ></div>
      </div>
    )
  }

  if (!canViewComplaints) {
    return (
      <div className="max-w-7xl mx-auto">
        <div
          className={`border border-red-500/20 rounded-2xl p-10 text-center backdrop-blur-sm ${isDark ? 'bg-slate-900/50' : 'bg-white/80 shadow-sm'}`}
        >
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-red-400 mb-2">
            {t('admin.complaints.accessDeniedTitle')}
          </h2>
          <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
            {t('admin.complaints.accessDeniedDescription')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      className="max-w-7xl mx-auto"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="mb-8">
        <h1
          className={`text-3xl font-semibold tracking-tight mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {t('admin.nav.complaints')}
        </h1>
        <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
          {t('admin.complaints.description')}
        </p>
        {assignedHotel && (
          <p
            className={`text-sm mt-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
          >
            {t('admin.complaints.assignedHotel')}: {assignedHotel.name}
          </p>
        )}
      </motion.div>

      {complaints === undefined ? (
        <div className="flex items-center justify-center py-12">
          <div
            className={`animate-spin rounded-full h-8 w-8 border-2 ${isDark ? 'border-blue-500/20 border-t-blue-500' : 'border-amber-500/20 border-t-amber-500'}`}
          ></div>
        </div>
      ) : complaints.length === 0 ? (
        <motion.div
          variants={itemVariants}
          className={`border rounded-2xl p-12 text-center backdrop-blur-sm ${isDark ? 'bg-slate-900/50 border-slate-800/50' : 'bg-white/80 border-slate-200/80 shadow-sm'}`}
        >
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}
          >
            <MessageSquareText
              className={`w-8 h-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
            />
          </div>
          <h2
            className={`text-lg font-semibold mb-2 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}
          >
            {t('admin.complaints.noneFound')}
          </h2>
          <p className={isDark ? 'text-slate-500' : 'text-slate-400'}>
            {t('admin.complaints.noneFoundHint')}
          </p>
        </motion.div>
      ) : (
        <motion.div className="space-y-4" variants={containerVariants}>
          {complaints.map((item) => {
            const booking = item.booking

            return (
              <motion.div key={item.complaint._id} variants={itemVariants}>
                <Link
                  to="/admin/complaints/$complaintId"
                  params={{ complaintId: item.complaint._id }}
                  className={`block rounded-2xl p-5 border backdrop-blur-sm transition-all duration-300 ${
                    isDark
                      ? 'bg-slate-900/50 border-slate-800/50 hover:border-slate-700/50 hover:bg-slate-800/30'
                      : 'bg-white/80 border-slate-200/80 shadow-sm hover:border-amber-500/30 hover:bg-amber-50/20 hover:shadow-md hover:shadow-amber-500/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <h2
                      className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
                    >
                      {item.complaint.subject}
                    </h2>
                    <div className="text-right">
                      <span
                        className={`text-xs block ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                      >
                        {new Date(item.complaint.createdAt).toLocaleDateString(
                          dateLocale,
                          { month: 'short', day: 'numeric', year: 'numeric' },
                        )}
                      </span>
                      <span
                        className={`text-xs mt-1 inline-block ${isDark ? 'text-blue-400' : 'text-amber-600'}`}
                      >
                        {t('admin.complaints.openDetails')}
                      </span>
                    </div>
                  </div>

                  <p
                    className={`whitespace-pre-wrap mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}
                  >
                    {item.complaint.description}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div
                      className={`border rounded-xl px-3 py-2 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                    >
                      <p
                        className={`text-xs uppercase tracking-wide mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                      >
                        {t('admin.complaints.customer')}
                      </p>
                      <p
                        className={`break-all ${isDark ? 'text-slate-200' : 'text-slate-700'}`}
                      >
                        {item.customer?.email || t('admin.hotels.unknownUser')}
                      </p>
                    </div>

                    <div
                      className={`border rounded-xl px-3 py-2 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                    >
                      <p
                        className={`text-xs uppercase tracking-wide mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                      >
                        {t('admin.complaints.booking')}
                      </p>
                      {booking ? (
                        <div
                          className={`space-y-1 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}
                        >
                          <p>{booking._id}</p>
                          <p>
                            {booking.checkIn} - {booking.checkOut}
                          </p>
                          <p
                            className={
                              isDark ? 'text-slate-400' : 'text-slate-500'
                            }
                          >
                            {t(`booking.status.${booking.status}` as never)}
                          </p>
                        </div>
                      ) : (
                        <p
                          className={
                            isDark ? 'text-slate-400' : 'text-slate-500'
                          }
                        >
                          {t('admin.complaints.noBooking')}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </motion.div>
      )}
    </motion.div>
  )
}
