import { createFileRoute, Link } from '@tanstack/react-router'
import { useUser, UserButton } from '@clerk/clerk-react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { MapPin, Search, Building2, Star } from 'lucide-react'
import { useState } from 'react'

export const Route = createFileRoute('/_authenticated/select-location')({
  component: SelectLocationPage,
})

function SelectLocationPage() {
  const { user } = useUser()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCity, setSelectedCity] = useState<string>('all')

  const hotels = useQuery(api.hotels.list, {})
  const cities = useQuery(api.hotels.getCities, {})

  const filteredHotels = hotels?.filter((hotel) => {
    const matchesSearch =
      hotel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      hotel.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      hotel.country.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCity = selectedCity === 'all' || hotel.city === selectedCity
    return matchesSearch && matchesCity
  })

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-slate-100">
              Hotel Booking
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/bookings"
              className="text-slate-400 hover:text-amber-400 transition-colors font-medium"
            >
              My Bookings
            </Link>
            <span className="text-sm text-slate-500">
              {user?.firstName || user?.emailAddresses[0]?.emailAddress}
            </span>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative py-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-violet-500/5"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-3xl"></div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold text-slate-100 mb-4 tracking-tight">
            Find Your Perfect Stay
          </h2>
          <p className="text-lg text-slate-400 mb-8">
            Browse our curated selection of hotels and book your next adventure.
          </p>

          {/* Search Bar */}
          <div className="flex flex-col md:flex-row gap-4 max-w-2xl mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                placeholder="Search hotels, cities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all"
              />
            </div>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="px-4 py-4 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500/50 transition-all min-w-[150px]"
            >
              <option value="all">All Cities</option>
              {cities?.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Hotels Grid */}
      <main className="max-w-7xl mx-auto px-4 pb-20">
        {hotels === undefined ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-amber-500/20 border-t-amber-500"></div>
          </div>
        ) : filteredHotels?.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-16 text-center">
            <div className="w-20 h-20 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-6">
              <Building2 className="w-10 h-10 text-slate-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-300 mb-3">
              {searchTerm || selectedCity !== 'all'
                ? 'No hotels found'
                : 'No hotels available'}
            </h3>
            <p className="text-slate-500">
              {searchTerm || selectedCity !== 'all'
                ? 'Try adjusting your search or filter.'
                : 'Check back soon for new listings.'}
            </p>
          </div>
        ) : filteredHotels ? (
          <>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-slate-200">
                {filteredHotels.length} hotel
                {filteredHotels.length !== 1 ? 's' : ''} available
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredHotels.map((hotel) => (
                <Link
                  key={hotel._id}
                  to="/hotels/$hotelId"
                  params={{ hotelId: hotel._id }}
                  className="group bg-slate-900/50 border border-slate-800/50 rounded-2xl overflow-hidden hover:border-amber-500/30 hover:shadow-xl hover:shadow-amber-500/5 transition-all duration-300"
                >
                  {/* Placeholder Image */}
                  <div className="h-48 bg-gradient-to-br from-slate-800 to-slate-900 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Building2 className="w-16 h-16 text-slate-700" />
                    </div>
                    {/* Rating Badge */}
                    <div className="absolute top-4 right-4 flex items-center gap-1 bg-slate-900/80 backdrop-blur-sm px-2 py-1 rounded-lg">
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                      <span className="text-sm text-slate-200 font-medium">
                        4.8
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-5">
                    <h4 className="text-lg font-semibold text-slate-200 mb-2 group-hover:text-amber-400 transition-colors">
                      {hotel.name}
                    </h4>
                    <div className="flex items-center gap-2 text-slate-400 text-sm mb-3">
                      <MapPin className="w-4 h-4" />
                      <span>
                        {hotel.city}, {hotel.country}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-2 mb-4">
                      {hotel.address}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-amber-400 font-semibold">
                        View Rooms →
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        ) : null}
      </main>
    </div>
  )
}
