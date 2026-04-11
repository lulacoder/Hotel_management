import { Link, createFileRoute } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useQuery } from 'convex/react'
import { AlertTriangle, MessageSquareText } from 'lucide-react'

import { api } from '../../../../convex/_generated/api'
import { useI18n } from '../../../lib/i18n'
import { useTheme } from '../../../lib/theme'

export const Route = createFileRoute('/admin/complaints/')({
  component: AdminComplaintsPage,
})

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
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-violet-500/20 border-t-violet-500"></div>
      </div>
    )
  }

  if (!canViewComplaints) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="admin-empty-state border-red-500/20 p-10">
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
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1
          className={`text-3xl font-semibold tracking-tight mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
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
      </div>

      {complaints === undefined ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-violet-500/20 border-t-violet-500"></div>
        </div>
      ) : complaints.length === 0 ? (
        <div className="admin-empty-state p-12">
          <div className="admin-empty-icon">
            <MessageSquareText className="w-8 h-8 text-slate-500" />
          </div>
          <h2
            className={`text-lg font-semibold mb-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}
          >
            {t('admin.complaints.noneFound')}
          </h2>
          <p className={isDark ? 'text-slate-500' : 'text-slate-500'}>
            {t('admin.complaints.noneFoundHint')}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {complaints.map((item) => {
            const booking = item.booking

            return (
              <Link
                key={item.complaint._id}
                to="/admin/complaints/$complaintId"
                params={{ complaintId: item.complaint._id }}
                className={`admin-surface block p-5 transition-all ${
                  isDark
                    ? 'hover:border-slate-700/80 hover:bg-slate-900/80'
                    : 'hover:border-slate-300 hover:shadow-md'
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
                        {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        },
                      )}
                    </span>
                    <span className="text-xs text-violet-400 mt-1 inline-block">
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
                  <div className="admin-surface-muted px-3 py-2">
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

                  <div className="admin-surface-muted px-3 py-2">
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
                        className={isDark ? 'text-slate-400' : 'text-slate-500'}
                      >
                        {t('admin.complaints.noBooking')}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
