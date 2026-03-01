// Admin dashboard landing page with summary cards and quick actions.
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
import { useI18n } from '../../lib/i18n'

export const Route = createFileRoute('/admin/')({
  // Register admin dashboard home route.
  component: AdminDashboard,
})

function AdminDashboard() {
  // Aggregate role context and lightweight metrics for overview cards.
  const { user } = useUser()
  const { t } = useI18n()
  // Fetch user profile to determine role and permissions.
  const profile = useQuery(api.users.getMe, user?.id ? {} : 'skip')

  // Fetch hotel assignment for non-room_admin users to show relevant data.
  const hotelAssignment = useQuery(
    api.hotelStaff.getMyAssignment,
    profile ? {} : 'skip',
  )
 
  // If assigned to a hotel, fetch that hotel's details for display in the dashboard.
  const assignedHotel = useQuery(
    api.hotels.get,
    hotelAssignment?.hotelId ? { hotelId: hotelAssignment.hotelId } : 'skip',
  )

  // Get real data from Convex
  const hotels = useQuery(api.hotels.list, {})

  // Get stats
  const totalHotels = hotels?.length ?? 0

  const stats = [
    {
      label: t('admin.stats.totalHotels'),
      value: totalHotels.toString(),
      icon: Hotel,
      color: 'from-blue-500 to-blue-600',
      shadowColor: 'shadow-blue-500/20',
    },
    {
      label: t('admin.stats.totalRooms'),
      value: '-',
      icon: Building2,
      color: 'from-blue-500 to-blue-600',
      shadowColor: 'shadow-blue-500/20',
    },
    {
      label: t('admin.stats.activeBookings'),
      value: '-',
      icon: Calendar,
      color: 'from-emerald-500 to-emerald-600',
      shadowColor: 'shadow-emerald-500/20',
    },
    {
      label: t('admin.stats.totalRevenue'),
      value: '$0',
      icon: TrendingUp,
      color: 'from-violet-500 to-violet-600',
      shadowColor: 'shadow-violet-500/20',
    },
  ]

  const roleLabelByCode: Record<string, string> = {
    room_admin: t('admin.role.roomAdmin'),
    hotel_admin: t('admin.role.hotelAdmin'),
    hotel_cashier: t('admin.role.hotelCashier'),
  }

  const quickActions = [
    // Navigation shortcuts shown based on user permissions.
    {
      label: t('admin.nav.hotels'),
      description: t('admin.hotels.description'),
      icon: Hotel,
      to: '/admin/hotels',
    },
    {
      label: t('admin.nav.rooms'),
      description: t('admin.rooms.description'),
      icon: Building2,
      to: '/admin/rooms',
    },
    {
      label: t('admin.nav.bookings'),
      description: t('admin.bookings.description'),
      icon: Calendar,
      to: '/admin/bookings',
    },
  ].filter((action) => {
    if (profile?.role === 'room_admin') {
      return true
    }

    if (hotelAssignment?.role === 'hotel_cashier') {
      return action.to === '/admin/bookings'
    }

    return true
  })

  return (
    <div className="max-w-7xl mx-auto">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-slate-100 tracking-tight mb-2">
          {t('admin.welcomeBack', {
            name: user?.firstName || t('admin.defaultUserName'),
          })}
        </h1>
        <p className="text-slate-400">{t('admin.overview')}</p>
      </div>
      
      {hotelAssignment && assignedHotel && profile?.role !== 'room_admin' && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-400 mb-1">
                {t('admin.users.hotelAssignment')}
              </h3>
              <p className="text-slate-300 text-sm">
                {t('admin.dashboard.assignmentSummary', {
                  hotelName: assignedHotel.name,
                  city: assignedHotel.city,
                  role:
                    roleLabelByCode[hotelAssignment.role] || hotelAssignment.role,
                })}
              </p>
            </div>
          </div>
        </div>
      )}

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
          {t('admin.quickActions')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              to={action.to}
              className="group light-hover-surface bg-slate-900/50 border border-slate-800/50 rounded-2xl p-6 hover:bg-slate-800/50 hover:border-slate-700/50 transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center group-hover:bg-slate-700 transition-colors">
                  <action.icon className="w-6 h-6 text-slate-400 group-hover:text-blue-400 transition-colors" />
                </div>
                <ArrowUpRight className="w-5 h-5 text-slate-600 group-hover:text-blue-400 transition-colors" />
              </div>
              <h3 className="font-semibold text-slate-200 mb-1 group-hover:text-blue-400 transition-colors">
                {action.label}
              </h3>
              <p className="text-sm text-slate-500">{action.description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-slate-900/50 border border-blue-500/20 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-blue-400 mb-1">
              {t('admin.dashboard.roleAccessTitle')}
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              {t('admin.dashboard.roleAccessDescription', {
                email: profile?.email || t('admin.bookings.na'),
                role:
                  roleLabelByCode[profile?.role || ''] ||
                  profile?.role ||
                  t('admin.role.user'),
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
