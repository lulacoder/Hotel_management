import { createFileRoute } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Users, Building, Calendar, TrendingUp } from 'lucide-react'

export const Route = createFileRoute('/admin/')({
  component: AdminDashboard,
})

function AdminDashboard() {
  const { user } = useUser()

  const profile = useQuery(
    api.users.getByClerkId,
    user?.id ? { clerkUserId: user.id } : 'skip',
  )

  // Mock stats - replace with actual data from Convex
  const stats = [
    {
      label: 'Total Rooms',
      value: '0',
      icon: Building,
      color: 'bg-blue-500',
    },
    {
      label: 'Active Bookings',
      value: '0',
      icon: Calendar,
      color: 'bg-green-500',
    },
    {
      label: 'Total Customers',
      value: '0',
      icon: Users,
      color: 'bg-purple-500',
    },
    {
      label: 'Revenue',
      value: '$0',
      icon: TrendingUp,
      color: 'bg-orange-500',
    },
  ]

  return (
    <div>
      {/* Welcome Card */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white mb-6">
        <h1 className="text-2xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-blue-100">
          Welcome to the hotel management admin portal. You're signed in as{' '}
          <span className="font-medium">{profile?.email}</span> with role{' '}
          <span className="font-medium uppercase">{profile?.role}</span>.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl shadow-md p-6 flex items-center gap-4"
          >
            <div className={`${stat.color} rounded-lg p-3`}>
              <stat.icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            disabled
            className="p-4 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 cursor-not-allowed"
          >
            <Building className="w-8 h-8 mx-auto mb-2" />
            <p className="font-medium">Add Room</p>
            <p className="text-sm">Coming Soon</p>
          </button>
          <button
            disabled
            className="p-4 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 cursor-not-allowed"
          >
            <Calendar className="w-8 h-8 mx-auto mb-2" />
            <p className="font-medium">View Bookings</p>
            <p className="text-sm">Coming Soon</p>
          </button>
          <button
            disabled
            className="p-4 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 cursor-not-allowed"
          >
            <Users className="w-8 h-8 mx-auto mb-2" />
            <p className="font-medium">Manage Users</p>
            <p className="text-sm">Coming Soon</p>
          </button>
        </div>
      </div>

      {/* Info Card */}
      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-xl p-6">
        <h3 className="font-semibold text-yellow-800 mb-2">
          Role-Based Authentication Active
        </h3>
        <p className="text-yellow-700 text-sm">
          This dashboard is protected by role-based authentication. Only users
          with the{' '}
          <code className="bg-yellow-100 px-1 rounded">room_admin</code> role
          can access this area. Customers are automatically redirected to the
          customer portal.
        </p>
      </div>
    </div>
  )
}
