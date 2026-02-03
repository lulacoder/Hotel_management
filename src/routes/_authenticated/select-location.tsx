import { createFileRoute } from '@tanstack/react-router'
import { useUser, UserButton } from '@clerk/clerk-react'
import { MapPin } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/select-location')({
  component: SelectLocationPage,
})

function SelectLocationPage() {
  const { user } = useUser()

  // Mock locations - replace with actual data from Convex
  const locations = [
    {
      id: '1',
      name: 'Grand Hotel Downtown',
      address: '123 Main St, City Center',
    },
    {
      id: '2',
      name: 'Seaside Resort',
      address: '456 Beach Blvd, Coastal Area',
    },
    {
      id: '3',
      name: 'Mountain Lodge',
      address: '789 Summit Rd, Highland District',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-800">Hotel Management</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              Welcome,{' '}
              {user?.firstName || user?.emailAddresses[0]?.emailAddress}
            </span>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">
            Select Your Location
          </h2>
          <p className="text-gray-600">
            Choose a hotel location to view available rooms and make a booking.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {locations.map((location) => (
            <button
              key={location.id}
              className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6 text-left group"
            >
              <div className="flex items-start gap-4">
                <div className="bg-blue-100 rounded-lg p-3 group-hover:bg-blue-200 transition-colors">
                  <MapPin className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
                    {location.name}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {location.address}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-8 text-center">
          <a
            href="/bookings"
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            View My Bookings →
          </a>
        </div>
      </main>
    </div>
  )
}
