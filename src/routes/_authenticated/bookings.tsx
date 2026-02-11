import { createFileRoute, Link } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Id } from '../../../convex/_generated/dataModel'
import { Calendar, Loader2 } from 'lucide-react'
import { useState } from 'react'

import { BookingsHeader } from './bookings/components/BookingsHeader'
import { BookingsFilters } from './bookings/components/BookingsFilters'
import { BookingsList } from './bookings/components/BookingsList'

export const Route = createFileRoute('/_authenticated/bookings')({
  component: BookingsPage,
})

function BookingsPage() {
  const { user } = useUser()
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const bookings = useQuery(
    api.bookings.getMyBookingsEnriched,
    user?.id ? { clerkUserId: user.id } : 'skip',
  )

  const cancelBooking = useMutation(api.bookings.cancelBooking)

  const handleCancel = async (bookingId: Id<'bookings'>) => {
    if (!user?.id) return

    const confirmed = window.confirm(
      'Are you sure you want to cancel this booking?',
    )
    if (!confirmed) return

    setCancellingId(bookingId)
    try {
      await cancelBooking({
        clerkUserId: user.id,
        bookingId,
      })
    } catch (error) {
      console.error('Failed to cancel booking:', error)
      alert('Failed to cancel booking. Please try again.')
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
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredBookings?.length === 0 && (
          <div className="bg-slate-900 rounded-2xl border border-slate-800/50 p-12 text-center">
            <Calendar className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">
              {statusFilter === 'all'
                ? 'No Bookings Yet'
                : `No ${statusFilter.replace('_', ' ')} bookings`}
            </h2>
            <p className="text-slate-400 mb-6">
              {statusFilter === 'all'
                ? "You haven't made any bookings. Start by selecting a location!"
                : 'Try changing the filter to see other bookings.'}
            </p>
            <Link
              to="/select-location"
              className="inline-flex items-center px-6 py-3 bg-amber-500 text-slate-900 font-semibold rounded-xl hover:bg-amber-400 transition-colors"
            >
              Browse Hotels
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
