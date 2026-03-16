import { Link, createFileRoute } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useQuery } from 'convex/react'
import { AlertTriangle, ArrowLeft, MessageSquareText } from 'lucide-react'
import { motion } from 'motion/react'

import { api } from '../../../../convex/_generated/api'
import { useI18n } from '../../../lib/i18n'
import { useTheme } from '@/lib/theme'
import type { Id } from '../../../../convex/_generated/dataModel'

export const Route = createFileRoute('/admin/complaints/$complaintId')({
  component: ComplaintDetailPage,
})

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: 'easeOut' as const },
  },
}

function ComplaintDetailPage() {
  const { complaintId } = Route.useParams()
  const typedComplaintId = complaintId as Id<'complaints'>
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

  const complaintDetail = useQuery(
    api.complaints.getForAssignedHotel,
    canViewComplaints ? { complaintId: typedComplaintId } : 'skip',
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
      <div className="max-w-4xl mx-auto">
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

  if (complaintDetail === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className={`animate-spin rounded-full h-8 w-8 border-2 ${isDark ? 'border-blue-500/20 border-t-blue-500' : 'border-amber-500/20 border-t-amber-500'}`}
        ></div>
      </div>
    )
  }

  if (complaintDetail === null) {
    return (
      <div className="max-w-4xl mx-auto">
        <div
          className={`border rounded-2xl p-12 text-center backdrop-blur-sm ${isDark ? 'bg-slate-900/50 border-slate-800/50' : 'bg-white/80 border-slate-200/80 shadow-sm'}`}
        >
          <h3
            className={`text-lg font-semibold mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
          >
            {t('admin.complaints.notFound')}
          </h3>
          <Link
            to="/admin/complaints"
            className={`inline-flex items-center gap-2 px-5 py-2.5 font-medium rounded-xl transition-colors ${isDark ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            <ArrowLeft className="w-4 h-4" />
            {t('admin.complaints.backToComplaints')}
          </Link>
        </div>
      </div>
    )
  }

  const booking = complaintDetail.booking

  return (
    <motion.div
      className="max-w-4xl mx-auto"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants}>
        <Link
          to="/admin/complaints"
          className={`inline-flex items-center gap-2 transition-colors mb-6 ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-900'}`}
        >
          <ArrowLeft className="w-4 h-4" />
          {t('admin.complaints.backToComplaints')}
        </Link>
      </motion.div>

      <motion.div
        variants={itemVariants}
        className={`border rounded-2xl p-6 mb-6 backdrop-blur-sm ${isDark ? 'bg-slate-900/50 border-slate-800/50' : 'bg-white/80 border-slate-200/80 shadow-sm'}`}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1
              className={`text-2xl font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {t('admin.complaints.detailTitle')}
            </h1>
            {assignedHotel && (
              <p
                className={`text-sm mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
              >
                {t('admin.complaints.assignedHotel')}: {assignedHotel.name}
              </p>
            )}
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <MessageSquareText className="w-3.5 h-3.5" />
            {t('admin.nav.complaints')}
          </div>
        </div>

        <h2
          className={`text-xl font-semibold mb-3 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
        >
          {complaintDetail.complaint.subject}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-5">
          <div
            className={`border rounded-xl p-4 ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
          >
            <p
              className={`mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
            >
              {t('admin.complaints.customer')}
            </p>
            <p
              className={`font-medium break-all ${isDark ? 'text-slate-100' : 'text-slate-800'}`}
            >
              {complaintDetail.customer?.email || t('admin.hotels.unknownUser')}
            </p>
          </div>
          <div
            className={`border rounded-xl p-4 ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
          >
            <p
              className={`mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
            >
              {t('admin.complaints.submittedAt')}
            </p>
            <p
              className={`font-medium ${isDark ? 'text-slate-100' : 'text-slate-800'}`}
            >
              {new Date(complaintDetail.complaint.createdAt).toLocaleString(
                dateLocale,
              )}
            </p>
            <p
              className={`text-xs mt-1 break-all ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
            >
              {t('admin.complaints.complaintId')}:{' '}
              {complaintDetail.complaint._id}
            </p>
          </div>
        </div>

        <div
          className={`border rounded-xl p-4 mb-5 ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
        >
          <p className={`mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {t('admin.complaints.descriptionLabel')}
          </p>
          <p
            className={`whitespace-pre-wrap ${isDark ? 'text-slate-200' : 'text-slate-700'}`}
          >
            {complaintDetail.complaint.description}
          </p>
        </div>

        <div
          className={`border rounded-xl p-4 text-sm ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
        >
          <p className={`mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {t('admin.complaints.booking')}
          </p>
          {booking ? (
            <div
              className={`space-y-1 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}
            >
              <p className="break-all">{booking._id}</p>
              <p>
                {booking.checkIn} - {booking.checkOut}
              </p>
              <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                {t(`booking.status.${booking.status}` as never)}
              </p>
              <Link
                to="/admin/bookings/$bookingId"
                params={{ bookingId: booking._id }}
                className={`inline-flex items-center mt-2 transition-colors ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-amber-600 hover:text-amber-700'}`}
              >
                {t('admin.complaints.openBooking')}
              </Link>
            </div>
          ) : (
            <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
              {t('admin.complaints.noBooking')}
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
