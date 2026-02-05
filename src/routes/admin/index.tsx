import { createFileRoute } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import {
  Building2,
  Calendar,
  Users,
  TrendingUp,
  Hotel,
  ArrowUpRight,
} from 'lucide-react'
import { Link } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/')({
  component: AdminDashboard,
})

function AdminDashboard() {
  const { user } = useUser()

  const profile = useQuery(
    api.users.getByClerkId,
    user?.id ? { clerkUserId: user.id } : 'skip',
  )

  // Get real data from Convex
  const hotels = useQuery(api.hotels.list, {})

  // Get stats
  const totalHotels = hotels?.length ?? 0

  const stats = [
    {
      label: 'Total Hotels',
      value: totalHotels.toString(),
      icon: Hotel,
      color: 'from-amber-500 to-amber-600',
      shadowColor: 'shadow-amber-500/20',
    },
    {
      label: 'Total Rooms',
      value: '-',
      icon: Building2,
      color: 'from-blue-500 to-blue-600',
      shadowColor: 'shadow-blue-500/20',
    },
    {
      label: 'Active Bookings',
      value: '-',
      icon: Calendar,
      color: 'from-emerald-500 to-emerald-600',
      shadowColor: 'shadow-emerald-500/20',
    },
    {
      label: 'Total Revenue',
      value: '$0',
      icon: TrendingUp,
      color: 'from-violet-500 to-violet-600',
      shadowColor: 'shadow-violet-500/20',
    },
  ]

  const quickActions = [
    {
      label: 'Manage Hotels',
      description: 'Add, edit, or remove hotel properties',
      icon: Hotel,
      to: '/admin/hotels',
    },
    {
      label: 'Manage Rooms',
      description: 'Configure room inventory and pricing',
      icon: Building2,
      to: '/admin/rooms',
    },
    {
      label: 'View Bookings',
      description: 'Review and manage customer reservations',
      icon: Calendar,
      to: '/admin/bookings',
    },
  ]

  return (
    <div className="max-w-7xl mx-auto">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-slate-100 tracking-tight mb-2">
          Welcome back, {user?.firstName || 'Admin'}
        </h1>
        <p className="text-slate-400">
          Here's an overview of your hotel management system.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-6 backdrop-blur-xl"
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg ${stat.shadowColor}`}
              >
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
            <p className="text-3xl font-semibold text-slate-100 mb-1">
              {stat.value}
            </p>
            <p className="text-sm text-slate-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-slate-200 mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              to={action.to}
              className="group bg-slate-900/50 border border-slate-800/50 rounded-2xl p-6 hover:bg-slate-800/50 hover:border-slate-700/50 transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center group-hover:bg-slate-700 transition-colors">
                  <action.icon className="w-6 h-6 text-slate-400 group-hover:text-amber-400 transition-colors" />
                </div>
                <ArrowUpRight className="w-5 h-5 text-slate-600 group-hover:text-amber-400 transition-colors" />
              </div>
              <h3 className="font-semibold text-slate-200 mb-1 group-hover:text-amber-400 transition-colors">
                {action.label}
              </h3>
              <p className="text-sm text-slate-500">{action.description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-slate-900/50 border border-amber-500/20 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-amber-400 mb-1">
              Role-Based Access Active
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              You're signed in as{' '}
              <span className="text-slate-300 font-medium">
                {profile?.email}
              </span>{' '}
              with{' '}
              <span className="text-amber-400 font-medium uppercase text-xs tracking-wider">
                {profile?.role}
              </span>{' '}
              privileges. Only administrators can access this dashboard.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
