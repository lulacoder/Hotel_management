// User administration route for assigning and managing staff access.
import { createFileRoute } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useMutation, useQuery } from 'convex/react'
import { Building2, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import { useI18n } from '../../../lib/i18n'
import { AssignModal } from './components/-AssignModal'
import type { Id } from '../../../../convex/_generated/dataModel'


export const Route = createFileRoute('/admin/users/')({
  // Register staff/user assignment route (room_admin only).
  component: AdminUsersPage,
})

function AdminUsersPage() {
  // Query users and assignment actions; keep search + modal state local.
  const { user } = useUser()
  const { t } = useI18n()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<Id<'users'> | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch user profile to determine role and permissions.
  const profile = useQuery(
    api.users.getByClerkId,
    user?.id ? { clerkUserId: user.id } : 'skip',
  )


  // Get all users with their hotel assignments for display in the user management table.
  const users = useQuery(
    api.hotelStaff.listAllUsers,
    user?.id ? { clerkUserId: user.id } : 'skip',// Only fetch if we have a logged-in user to determine permissions.
  )

  const unassignUser = useMutation(api.hotelStaff.unassign)
  const roleLabelByCode: Record<string, string> = {
    room_admin: t('admin.role.roomAdmin'),
    hotel_admin: t('admin.role.hotelAdmin'),
    hotel_cashier: t('admin.role.hotelCashier'),
  }

  // Filter users based on search query for responsive client-side searching.
  const filteredUsers = useMemo(() => {
    if (!users) return []
    return users.filter((u) =>
      u.email.toLowerCase().includes(searchQuery.toLowerCase()),
    )
  }, [users, searchQuery])

  const handleUnassign = async (targetUserId: Id<'users'>) => {
    // Remove hotel assignment after user confirmation.
    if (!user?.id) return
    if (!confirm(t('admin.users.confirmUnassign'))) return

    setError(null)
    try {
      await unassignUser({ clerkUserId: user.id, targetUserId })
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : t('admin.users.unassignFailed'),
      )
    }
  }

  if (profile === undefined) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-8 text-center text-slate-500">
          {t('admin.users.loadingProfile')}
        </div>
      </div>
    )
  }
 
  // Restrict access to this route to room_admin users only; show message if not authorized.
  if (profile?.role !== 'room_admin') {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-slate-900/50 border border-red-500/20 rounded-2xl p-8 text-center">
          <h2 className="text-xl font-semibold text-red-400 mb-2">
            {t('admin.accessDenied')}
          </h2>
          <p className="text-slate-400">{t('admin.users.onlyRoomAdmins')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-slate-100 tracking-tight mb-2">
          {t('admin.nav.users')}
        </h1>
        <p className="text-slate-400">{t('admin.users.description')}</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-300 rounded-xl p-3 mb-4">
          {error}
        </div>
      )}

      {/* Search input for filtering users by email. */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
        <input
          type="text"
          placeholder={t('admin.users.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-slate-900/50 border border-slate-800/50 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
        />
      </div>

      {/* User list table with assignment status and actions. */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800/70 text-left">
                <th className="px-6 py-4 text-xs text-slate-500 font-medium uppercase tracking-wider">
                  {t('admin.users.email')}
                </th>
                <th className="px-6 py-4 text-xs text-slate-500 font-medium uppercase tracking-wider">
                  {t('admin.users.globalRole')}
                </th>
                <th className="px-6 py-4 text-xs text-slate-500 font-medium uppercase tracking-wider">
                  {t('admin.users.hotelAssignment')}
                </th>
                <th className="px-6 py-4 text-xs text-slate-500 font-medium uppercase tracking-wider">
                  {t('admin.users.hotelRole')}
                </th>
                <th className="px-6 py-4 text-xs text-slate-500 font-medium uppercase tracking-wider">
                  {t('admin.bookings.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Show loading state, empty state */}
              {users === undefined ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    {t('admin.users.loadingUsers')}
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    {t('admin.users.noneFound')}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((listedUser) => (
                  <tr
                    key={listedUser._id}
                    className="border-b border-slate-800/40 last:border-b-0 hover:bg-slate-800/20"
                  >
                    <td className="px-6 py-4 text-slate-200">
                      {listedUser.email}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium border ${
                          listedUser.role === 'room_admin' // Highlight room_admin users with a distinct color badge.
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : 'bg-slate-700/40 text-slate-300 border-slate-700'
                        }`}
                      >
                        {roleLabelByCode[listedUser.role] || listedUser.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-300 text-sm">
                      {listedUser.assignment ? (
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-500" />
                          <span>
                            {listedUser.assignment.hotelName},{' '}
                            {listedUser.assignment.hotelCity}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">
                          {t('admin.users.notAssigned')}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {listedUser.assignment ? (
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium border ${
                            listedUser.assignment.role === 'hotel_admin'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          }`}
                        >
                          {roleLabelByCode[listedUser.assignment.role] ||
                            listedUser.assignment.role}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-sm">
                          {t('admin.bookings.na')}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {listedUser.assignment ? (
                        <button
                          onClick={() => handleUnassign(listedUser._id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                        >
                          {t('admin.users.unassign')}
                        </button>
                      ) : (
                        <button
                          onClick={() => setSelectedUserId(listedUser._id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20"
                        >
                          {t('admin.users.assign')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedUserId && (
        <AssignModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </div>
  )
}
