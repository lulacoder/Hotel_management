import { Link, createFileRoute } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useQuery } from 'convex/react'
import { AlertTriangle, MessageSquareText } from 'lucide-react'

import { api } from '../../../../convex/_generated/api'
import { useI18n } from '../../../lib/i18n'

export const Route = createFileRoute('/admin/complaints/')({
  component: AdminComplaintsPage,
})

function AdminComplaintsPage() {
  const { user } = useUser()
  const { t, locale } = useI18n()
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
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500/20 border-t-blue-500"></div>
      </div>
    )
  }

  if (!canViewComplaints) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-slate-900/50 border border-red-500/20 rounded-2xl p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-red-400 mb-2">
            {t('admin.complaints.accessDeniedTitle')}
          </h2>
          <p className="text-slate-400">
            {t('admin.complaints.accessDeniedDescription')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-slate-100 tracking-tight mb-2">
          {t('admin.nav.complaints')}
        </h1>
        <p className="text-slate-400">{t('admin.complaints.description')}</p>
        {assignedHotel && (
          <p className="text-sm text-slate-500 mt-2">
            {t('admin.complaints.assignedHotel')}: {assignedHotel.name}
          </p>
        )}
      </div>

      {complaints === undefined ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500/20 border-t-blue-500"></div>
        </div>
      ) : complaints.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <MessageSquareText className="w-8 h-8 text-slate-500" />
          </div>
          <h2 className="text-lg font-semibold text-slate-200 mb-2">
            {t('admin.complaints.noneFound')}
          </h2>
          <p className="text-slate-500">{t('admin.complaints.noneFoundHint')}</p>
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
                className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-5"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h2 className="text-lg font-semibold text-slate-100">
                    {item.complaint.subject}
                  </h2>
                  <div className="text-right">
                    <span className="text-xs text-slate-500 block">
                      {new Date(item.complaint.createdAt).toLocaleDateString(
                        dateLocale,
                        {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        },
                      )}
                    </span>
                    <span className="text-xs text-blue-400 mt-1 inline-block">
                      {t('admin.complaints.openDetails')}
                    </span>
                  </div>
                </div>

                <p className="text-slate-300 whitespace-pre-wrap mb-4">
                  {item.complaint.description}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="bg-slate-800/50 border border-slate-700 rounded-xl px-3 py-2">
                    <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">
                      {t('admin.complaints.customer')}
                    </p>
                    <p className="text-slate-200 break-all">
                      {item.customer?.email || t('admin.hotels.unknownUser')}
                    </p>
                  </div>

                  <div className="bg-slate-800/50 border border-slate-700 rounded-xl px-3 py-2">
                    <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">
                      {t('admin.complaints.booking')}
                    </p>
                    {booking ? (
                      <div className="text-slate-200 space-y-1">
                        <p>{booking._id}</p>
                        <p>
                          {booking.checkIn} - {booking.checkOut}
                        </p>
                        <p className="text-slate-400">
                          {t(`booking.status.${booking.status}` as never)}
                        </p>
                      </div>
                    ) : (
                      <p className="text-slate-400">{t('admin.complaints.noBooking')}</p>
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
