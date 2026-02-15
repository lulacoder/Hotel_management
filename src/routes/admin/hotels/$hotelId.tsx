import { Link, createFileRoute } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useMutation, useQuery } from 'convex/react'
import {
  ArrowLeft,
  Building2,
  CheckCircle,
  DollarSign,
  Edit,
  MapPin,
  MoreVertical,
  Pencil,
  Plus,
  Sparkles,
  Star,
  Trash2,
  Users,
  Wrench,
  XCircle,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { api } from '../../../../convex/_generated/api'
import { RoomModal } from './$hotelId/components/-RoomModal'
import { HotelEditModal } from './$hotelId/components/-HotelEditModal'
import type { Id } from '../../../../convex/_generated/dataModel'

export const Route = createFileRoute('/admin/hotels/$hotelId')({
  component: HotelDetailPage,
})

function HotelDetailPage() {
  const { hotelId } = Route.useParams()
  const { user } = useUser()
  const [showCreateRoom, setShowCreateRoom] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Id<'rooms'> | null>(null)
  const [activeMenu, setActiveMenu] = useState<Id<'rooms'> | null>(null)
  const [showEditHotel, setShowEditHotel] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)

  const hotel = useQuery(api.hotels.get, { hotelId: hotelId as Id<'hotels'> })
  const rooms = useQuery(api.rooms.getByHotel, {
    hotelId: hotelId as Id<'hotels'>,
  })
  const ratings = useQuery(
    api.ratings.getHotelRatingsAdmin,
    user?.id
      ? { clerkUserId: user.id, hotelId: hotelId as Id<'hotels'> }
      : 'skip',
  )

  const deleteRoom = useMutation(api.rooms.softDelete)
  const updateRoomStatus = useMutation(api.rooms.updateStatus)
  const deleteRating = useMutation(api.ratings.softDeleteRating)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  const handleDeleteRoom = async (roomId: Id<'rooms'>) => {
    if (!user?.id) return
    if (confirm('Are you sure you want to delete this room?')) {
      await deleteRoom({ clerkUserId: user.id, roomId })
    }
    setActiveMenu(null)
  }

  const handleDeleteRating = async (ratingId: Id<'hotelRatings'>) => {
    if (!user?.id) return
    if (confirm('Delete this rating? This will remove it from public view.')) {
      await deleteRating({ clerkUserId: user.id, ratingId })
    }
  }

  const handleStatusChange = async (
    roomId: Id<'rooms'>,
    status: 'available' | 'maintenance' | 'cleaning' | 'out_of_order',
  ) => {
    if (!user?.id) return
    await updateRoomStatus({
      clerkUserId: user.id,
      roomId,
      operationalStatus: status,
    })
    setActiveMenu(null)
  }

  const statusConfig = {
    available: {
      label: 'Available',
      icon: CheckCircle,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
    maintenance: {
      label: 'Maintenance',
      icon: Wrench,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
    },
    cleaning: {
      label: 'Cleaning',
      icon: Sparkles,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
    },
    out_of_order: {
      label: 'Out of Order',
      icon: XCircle,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
    },
  }

  const roomTypeLabels: Record<string, string> = {
    budget: 'Budget',
    standard: 'Standard',
    suite: 'Suite',
    deluxe: 'Deluxe',
  }

  if (!isHydrated || hotel === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500/20 border-t-amber-500"></div>
      </div>
    )
  }

  if (hotel === null) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-12 text-center">
          <h2 className="text-xl font-semibold text-slate-300 mb-2">
            Hotel not found
          </h2>
          <p className="text-slate-500 mb-6">
            This hotel may have been deleted or doesn't exist.
          </p>
          <Link
            to="/admin/hotels"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-slate-200 font-medium rounded-xl hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Hotels
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Back Link */}
      <Link
        to="/admin/hotels"
        className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Hotels
      </Link>

      {/* Hotel Header */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-6 mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100 mb-2">
              {hotel.name}
            </h1>
            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <MapPin className="w-4 h-4" />
              <span>{hotel.address}</span>
            </div>
            <p className="text-slate-500">
              {hotel.city}, {hotel.country}
            </p>
          </div>
          <button
            onClick={() => setShowEditHotel(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-colors border border-slate-700"
          >
            <Edit className="w-4 h-4" />
            Edit Hotel
          </button>
        </div>
      </div>

      {/* Rooms Section */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-slate-200">Rooms</h2>
        <button
          onClick={() => setShowCreateRoom(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-medium rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all duration-200 shadow-lg shadow-amber-500/20"
        >
          <Plus className="w-5 h-5" />
          Add Room
        </button>
      </div>

      {/* Rooms Grid */}
      {rooms === undefined ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500/20 border-t-amber-500"></div>
        </div>
      ) : rooms.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-slate-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-300 mb-2">
            No rooms yet
          </h3>
          <p className="text-slate-500 mb-6">
            Add rooms to this hotel to start accepting bookings.
          </p>
          <button
            onClick={() => setShowCreateRoom(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500/10 text-amber-400 font-medium rounded-xl hover:bg-amber-500/20 transition-colors border border-amber-500/20"
          >
            <Plus className="w-5 h-5" />
            Add First Room
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => {
            const status = statusConfig[room.operationalStatus]
            const StatusIcon = status.icon

            return (
              <div
                key={room._id}
                className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-5 hover:border-slate-700/50 transition-all relative"
              >
                {/* Menu Button */}
                <div className="absolute top-4 right-4">
                  <button
                    onClick={() =>
                      setActiveMenu(activeMenu === room._id ? null : room._id)
                    }
                    className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <MoreVertical className="w-4 h-4 text-slate-500" />
                  </button>

                  {activeMenu === room._id && (
                    <div className="absolute right-0 top-8 w-52 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-10 overflow-hidden">
                      <button
                        onClick={() => {
                          setEditingRoom(room._id)
                          setActiveMenu(null)
                        }}
                        className="flex items-center gap-3 px-4 py-2.5 text-slate-300 hover:bg-slate-700 transition-colors w-full text-sm"
                      >
                        <Pencil className="w-4 h-4" />
                        Edit Room
                      </button>
                      <div className="border-t border-slate-700 my-1"></div>
                      <p className="px-4 py-2 text-xs text-slate-500 font-medium">
                        Set Status
                      </p>
                      {Object.entries(statusConfig).map(([key, config]) => (
                        <button
                          key={key}
                          onClick={() =>
                            handleStatusChange(
                              room._id,
                              key as
                                | 'available'
                                | 'maintenance'
                                | 'cleaning'
                                | 'out_of_order',
                            )
                          }
                          className={`flex items-center gap-3 px-4 py-2 hover:bg-slate-700 transition-colors w-full text-sm ${
                            room.operationalStatus === key
                              ? config.color
                              : 'text-slate-400'
                          }`}
                        >
                          <config.icon className="w-4 h-4" />
                          {config.label}
                        </button>
                      ))}
                      <div className="border-t border-slate-700 my-1"></div>
                      <button
                        onClick={() => handleDeleteRoom(room._id)}
                        className="flex items-center gap-3 px-4 py-2.5 text-red-400 hover:bg-slate-700 transition-colors w-full text-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Room
                      </button>
                    </div>
                  )}
                </div>

                {/* Room Info */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-slate-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-200">
                      Room {room.roomNumber}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {roomTypeLabels[room.type]}
                    </p>
                  </div>
                </div>

                {/* Status Badge */}
                <div
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${status.bg} ${status.color} ${status.border} border mb-4`}
                >
                  <StatusIcon className="w-3.5 h-3.5" />
                  {status.label}
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-slate-400">
                    <DollarSign className="w-4 h-4" />
                    <span>${(room.basePrice / 100).toFixed(2)}/night</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Users className="w-4 h-4" />
                    <span>Max {room.maxOccupancy}</span>
                  </div>
                </div>

                {room.amenities && room.amenities.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-800">
                    <div className="flex flex-wrap gap-2">
                      {room.amenities.slice(0, 3).map((amenity) => (
                        <span
                          key={amenity}
                          className="px-2 py-1 bg-slate-800 text-slate-400 rounded text-xs"
                        >
                          {amenity}
                        </span>
                      ))}
                      {room.amenities.length > 3 && (
                        <span className="px-2 py-1 bg-slate-800 text-slate-500 rounded text-xs">
                          +{room.amenities.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Ratings Section */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-200">Ratings</h2>
          <span className="text-sm text-slate-500">
            {ratings?.length ?? 0} total
          </span>
        </div>

        {ratings === undefined ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-amber-500/20 border-t-amber-500"></div>
          </div>
        ) : ratings.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-8 text-center text-slate-500">
            No ratings yet.
          </div>
        ) : (
          <div className="space-y-4">
            {ratings.map((rating) => (
              <div
                key={rating._id}
                className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((value) => (
                          <Star
                            key={value}
                            className={`w-4 h-4 ${
                              value <= rating.rating
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-slate-600'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-slate-500">
                        {new Date(rating.createdAt).toLocaleDateString(
                          'en-US',
                          {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          },
                        )}
                      </span>
                    </div>

                    <p className="text-sm text-slate-400 mt-3">
                      {rating.review || 'No review text provided.'}
                    </p>
                    <p className="text-xs text-slate-500 mt-2">
                      {rating.user?.email || 'Unknown user'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteRating(rating._id)}
                    className="p-2 rounded-lg hover:bg-red-500/10 transition-colors text-red-400"
                    aria-label="Delete rating"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Room Modal */}
      {(showCreateRoom || editingRoom) && (
        <RoomModal
          hotelId={hotelId as Id<'hotels'>}
          roomId={editingRoom}
          onClose={() => {
            setShowCreateRoom(false)
            setEditingRoom(null)
          }}
        />
      )}

      {/* Edit Hotel Modal */}
      {showEditHotel && (
        <HotelEditModal
          hotelId={hotelId as Id<'hotels'>}
          onClose={() => setShowEditHotel(false)}
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
