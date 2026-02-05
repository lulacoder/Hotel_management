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
import { useEffect, useState } from 'react'
import { Id } from '../../../../convex/_generated/dataModel'

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
  const deleteHotel = useMutation(api.hotels.softDelete)

  const filteredHotels = hotels?.filter(
    (hotel) =>
      hotel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      hotel.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      hotel.country.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleDelete = async (hotelId: Id<'hotels'>) => {
    if (!user?.id) return
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
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-medium rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all duration-200 shadow-lg shadow-amber-500/20"
        >
          <Plus className="w-5 h-5" />
          Add Hotel
        </button>
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
      {hotels === undefined ? (
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
                    <button
                      onClick={() => handleDelete(hotel._id)}
                      className="flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-slate-700 transition-colors w-full"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Hotel
                    </button>
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
      {(showCreateModal || editingHotel) && (
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

// Hotel Create/Edit Modal
function HotelModal({
  hotelId,
  onClose,
}: {
  hotelId: Id<'hotels'> | null
  onClose: () => void
}) {
  const { user } = useUser()
  const hotel = useQuery(api.hotels.get, hotelId ? { hotelId } : 'skip')
  const createHotel = useMutation(api.hotels.create)
  const updateHotel = useMutation(api.hotels.update)

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    country: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Hydrate form data from fetched hotel or reset for create mode.
  useEffect(() => {
    if (hotelId && hotel) {
      setFormData({
        name: hotel.name,
        address: hotel.address,
        city: hotel.city,
        country: hotel.country,
      })
      return
    }

    if (!hotelId) {
      setFormData({
        name: '',
        address: '',
        city: '',
        country: '',
      })
    }
  }, [hotelId, hotel])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) return

    setLoading(true)
    setError('')

    try {
      if (hotelId) {
        await updateHotel({
          clerkUserId: user.id,
          hotelId,
          ...formData,
        })
      } else {
        await createHotel({
          clerkUserId: user.id,
          ...formData,
        })
      }
      onClose()
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-semibold text-slate-100">
            {hotelId ? 'Edit Hotel' : 'Add New Hotel'}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {hotelId
              ? 'Update the hotel details below.'
              : 'Fill in the details to create a new hotel.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Hotel Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Grand Hotel"
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Address
            </label>
            <input
              type="text"
              required
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              placeholder="123 Main Street"
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                City
              </label>
              <input
                type="text"
                required
                value={formData.city}
                onChange={(e) =>
                  setFormData({ ...formData, city: e.target.value })
                }
                placeholder="New York"
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Country
              </label>
              <input
                type="text"
                required
                value={formData.country}
                onChange={(e) =>
                  setFormData({ ...formData, country: e.target.value })
                }
                placeholder="USA"
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 font-medium rounded-xl hover:bg-slate-700 transition-colors border border-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-medium rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? 'Saving...'
                : hotelId
                  ? 'Update Hotel'
                  : 'Create Hotel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
