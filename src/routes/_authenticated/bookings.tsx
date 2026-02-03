import { createFileRoute, Link } from '@tanstack/react-router'
import { useUser, UserButton } from '@clerk/clerk-react'
import { Calendar, ArrowLeft } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/bookings')({
  component: BookingsPage,
})

function BookingsPage() {
  const { user } = useUser()

  // Mock bookings - replace with actual data from Convex
  const bookings: Array<{
    id: string
    hotelName: string
    roomType: string
    checkIn: string
    checkOut: string
    status: 'confirmed' | 'pending' | 'cancelled'
  }> = []

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link
              to="/select-location"
              className="text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold text-gray-800">My Bookings</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {user?.firstName || user?.emailAddresses[0]?.emailAddress}
            </span>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        {bookings.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              No Bookings Yet
            </h2>
            <p className="text-gray-600 mb-6">
              You haven't made any bookings. Start by selecting a location!
            </p>
            <Link
              to="/select-location"
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Browse Locations
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <div
                key={booking.id}
                className="bg-white rounded-xl shadow-md p-6"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-800">
                      {booking.hotelName}
                    </h3>
                    <p className="text-sm text-gray-500">{booking.roomType}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      booking.status === 'confirmed'
                        ? 'bg-green-100 text-green-800'
                        : booking.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {booking.status.charAt(0).toUpperCase() +
                      booking.status.slice(1)}
                  </span>
                </div>
                <div className="mt-4 flex gap-6 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">Check-in:</span>{' '}
                    {booking.checkIn}
                  </div>
                  <div>
                    <span className="font-medium">Check-out:</span>{' '}
                    {booking.checkOut}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
