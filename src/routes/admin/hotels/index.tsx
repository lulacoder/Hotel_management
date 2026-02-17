import { createFileRoute, Link } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import {
  Plus,
  Search,
  MapPin,
  Building2,
  MoreVertical,
  Pencil,
  Trash2,
  Eye,
} from 'lucide-react'
import { useState } from 'react'
import { Id } from '../../../../convex/_generated/dataModel'
import { HotelModal } from './index/components/-HotelModal'

export const Route = createFileRoute('/admin/hotels/')({
  component: HotelsPage,
})

function HotelsPage() {
  const { user } = useUser()
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingHotel, setEditingHotel] = useState<Id<'hotels'> | null>(null)
  const [activeMenu, setActiveMenu] = useState<Id<'hotels'> | null>(null)

  const hotels = useQuery(api.hotels.list, {})
  const profile = useQuery(
    api.users.getByClerkId,
    user?.id ? { clerkUserId: user.id } : 'skip',
  )
  const hotelAssignment = useQuery(
    api.hotelStaff.getByUserId,
    user?.id && profile?._id
      ? { clerkUserId: user.id, userId: profile._id }
      : 'skip',
  )
  const deleteHotel = useMutation(api.hotels.softDelete)

  const canAddHotel = profile?.role === 'room_admin'
  const canEditHotel =
    profile?.role === 'room_admin' || hotelAssignment?.role === 'hotel_admin'

  const visibleHotels =
    profile?.role === 'room_admin'
      ? hotels
      : hotels?.filter((hotel) => hotel._id === hotelAssignment?.hotelId)

  const filteredHotels = visibleHotels?.filter(
    (hotel) =>
      hotel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      hotel.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      hotel.country.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleDelete = async (hotelId: Id<'hotels'>) => {
    if (!user?.id) return
    if (!canAddHotel) return
    if (confirm('Are you sure you want to delete this hotel?')) {
      await deleteHotel({ clerkUserId: user.id, hotelId })
    }
    setActiveMenu(null)
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-slate-100 tracking-tight mb-2">
            Hotels
          </h1>
          <p className="text-slate-400">
            Manage your hotel properties and locations.
          </p>
        </div>
        {canAddHotel && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-medium rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all duration-200 shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-5 h-5" />
            Add Hotel
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
        <input
          type="text"
          placeholder="Search hotels by name, city, or country..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-slate-900/50 border border-slate-800/50 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
        />
      </div>

      {/* Hotels Grid */}
      {visibleHotels === undefined ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500/20 border-t-amber-500"></div>
        </div>
      ) : filteredHotels?.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-slate-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-300 mb-2">
            {searchTerm ? 'No hotels found' : 'No hotels yet'}
          </h3>
          <p className="text-slate-500 mb-6">
            {searchTerm
              ? 'Try adjusting your search terms.'
              : 'Get started by adding your first hotel property.'}
          </p>
          {!searchTerm && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500/10 text-amber-400 font-medium rounded-xl hover:bg-amber-500/20 transition-colors border border-amber-500/20"
            >
              <Plus className="w-5 h-5" />
              Add Your First Hotel
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredHotels?.map((hotel) => (
            <div
              key={hotel._id}
              className="group bg-slate-900/50 border border-slate-800/50 rounded-2xl p-6 hover:border-slate-700/50 transition-all duration-200 relative"
            >
              {/* Menu Button */}
              <div className="absolute top-4 right-4">
                <button
                  onClick={() =>
                    setActiveMenu(activeMenu === hotel._id ? null : hotel._id)
                  }
                  className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <MoreVertical className="w-5 h-5 text-slate-500" />
                </button>

                {/* Dropdown Menu */}
                {activeMenu === hotel._id && (
                  <div className="absolute right-0 top-10 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-10 overflow-hidden">
                    <Link
                      to="/admin/hotels/$hotelId"
                      params={{ hotelId: hotel._id }}
                      className="flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-slate-700 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      View Details
                    </Link>
                    {canEditHotel && (
                      <button
                        onClick={() => {
                          setEditingHotel(hotel._id)
                          setActiveMenu(null)
                        }}
                        className="flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-slate-700 transition-colors w-full"
                      >
                        <Pencil className="w-4 h-4" />
                        Edit Hotel
                      </button>
                    )}
                    {canAddHotel && (
                      <button
                        onClick={() => handleDelete(hotel._id)}
                        className="flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-slate-700 transition-colors w-full"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Hotel
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Hotel Info */}
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-slate-200 mb-2 pr-8">
                  {hotel.name}
                </h3>
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <MapPin className="w-4 h-4" />
                  <span>
                    {hotel.city}, {hotel.country}
                  </span>
                </div>
              </div>

              <p className="text-sm text-slate-500 mb-4 line-clamp-2">
                {hotel.address}
              </p>

              <Link
                to="/admin/hotels/$hotelId"
                params={{ hotelId: hotel._id }}
                className="inline-flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors font-medium"
              >
                Manage Rooms
                <span className="text-lg">→</span>
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingHotel) && canEditHotel && (
        <HotelModal
          hotelId={editingHotel}
          onClose={() => {
            setShowCreateModal(false)
            setEditingHotel(null)
          }}
        />
      )}

      {/* Click outside to close menu */}
      {activeMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setActiveMenu(null)}
        />
      )}
    </div>
  )
}
