import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { Building2, Hotel, MapPin, Search, ChevronRight } from 'lucide-react'
import { useState } from 'react'

export const Route = createFileRoute('/admin/rooms/')({
  component: RoomsPage,
})

function RoomsPage() {
  const [searchTerm, setSearchTerm] = useState('')

  const hotels = useQuery(api.hotels.list, {})

  const filteredHotels = hotels?.filter(
    (hotel) =>
      hotel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      hotel.city.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-slate-100 tracking-tight mb-2">
          Rooms
        </h1>
        <p className="text-slate-400">Select a hotel to manage its rooms.</p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
        <input
          type="text"
          placeholder="Search hotels..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-slate-900/50 border border-slate-800/50 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
        />
      </div>

      {/* Hotels List */}
      {hotels === undefined ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500/20 border-t-amber-500"></div>
        </div>
      ) : filteredHotels?.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <Hotel className="w-8 h-8 text-slate-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-300 mb-2">
            {searchTerm ? 'No hotels found' : 'No hotels yet'}
          </h3>
          <p className="text-slate-500 mb-6">
            {searchTerm
              ? 'Try adjusting your search.'
              : 'Create a hotel first to manage rooms.'}
          </p>
          {!searchTerm && (
            <Link
              to="/admin/hotels"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500/10 text-amber-400 font-medium rounded-xl hover:bg-amber-500/20 transition-colors border border-amber-500/20"
            >
              Go to Hotels
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredHotels?.map((hotel) => (
            <Link
              key={hotel._id}
              to="/admin/hotels/$hotelId"
              params={{ hotelId: hotel._id }}
              className="flex items-center justify-between bg-slate-900/50 border border-slate-800/50 rounded-xl p-5 hover:border-slate-700/50 hover:bg-slate-800/30 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center group-hover:bg-slate-700 transition-colors">
                  <Building2 className="w-6 h-6 text-slate-400 group-hover:text-amber-400 transition-colors" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-200 group-hover:text-amber-400 transition-colors">
                    {hotel.name}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>
                      {hotel.city}, {hotel.country}
                    </span>
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-amber-400 transition-colors" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
