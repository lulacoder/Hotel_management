// Customer bookings route with filtering and list rendering.
import { Link, createFileRoute } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useMutation, useQuery } from 'convex/react'
import { Calendar, Loader2 } from 'lucide-react'
import { useState } from 'react'

import { api } from '../../../convex/_generated/api'
import { useI18n } from '../../lib/i18n'

import { BookingsHeader } from './bookings/components/-BookingsHeader'
import { BookingsFilters } from './bookings/components/-BookingsFilters'
import { BookingsList } from './bookings/components/-BookingsList'
import type { Id } from '../../../convex/_generated/dataModel'

export const Route = createFileRoute('/_authenticated/bookings')({
  component: BookingsPage,
  // Child route mounted under authenticated layout for customer booking history.
})

function BookingsPage() {
  const { user } = useUser()
  // Load current user profile/bookings and derive filter-ready display data.
  const { t } = useI18n()
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const bookings = useQuery(
    api.bookings.getMyBookingsEnriched,
    user?.id ? {} : 'skip',
  )

  const cancelBooking = useMutation(api.bookings.cancelBooking)

  const handleCancel = async (bookingId: Id<'bookings'>) => {
    if (!user?.id) return

    const confirmed = window.confirm(t('bookings.confirmCancel'))
    if (!confirmed) return

    setCancellingId(bookingId)
    try {
      await cancelBooking({
        bookingId,
      })
    } catch (error) {
      console.error('Failed to cancel booking:', error)
      alert(t('bookings.cancelFailed'))
    } finally {
      setCancellingId(null)
    }
  }

  const filteredBookings = bookings?.filter((b) => {
    if (statusFilter === 'all') return true
    return b.booking.status === statusFilter
  })

  const isLoading = bookings === undefined

  return (
    <div className="min-h-screen bg-slate-950">
      <BookingsHeader
        userName={
          user?.firstName || user?.emailAddresses[0]?.emailAddress || ''
        }
      />

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Filter */}
        <BookingsFilters
          statusFilter={statusFilter}
          onFilterChange={setStatusFilter}
        />

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredBookings?.length === 0 && (
          <div className="bg-slate-900 rounded-2xl border border-slate-800/50 p-12 text-center">
            <Calendar className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">
              {statusFilter === 'all'
                ? t('bookings.noBookingsYet')
                : t('bookings.noStatusBookings', {
                    status: statusFilter.replace('_', ' '),
                  })}
            </h2>
            <p className="text-slate-400 mb-6">
              {statusFilter === 'all'
                ? t('bookings.startSelectingLocation')
                : t('bookings.tryChangingFilter')}
            </p>
            <Link
              to="/select-location"
              className="inline-flex items-center px-6 py-3 bg-blue-500 text-slate-900 font-semibold rounded-xl hover:bg-blue-400 transition-colors"
            >
              {t('bookings.browseHotels')}
            </Link>
          </div>
        )}

        {/* Bookings List */}
        {!isLoading && filteredBookings && filteredBookings.length > 0 && (
          <BookingsList
            bookings={filteredBookings}
            cancellingId={cancellingId}
            onCancel={handleCancel}
          />
        )}
      </main>
    </div>
  )
}
