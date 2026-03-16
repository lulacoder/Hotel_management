// User administration route for assigning and managing staff access.
import { createFileRoute } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useMutation, useQuery } from 'convex/react'
import { Building2, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { api } from '../../../../convex/_generated/api'
import { useI18n } from '../../../lib/i18n'
import { useTheme } from '../../../lib/theme'
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
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<Id<'users'> | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch user profile to determine role and permissions.
  const profile = useQuery(api.users.getMe, user?.id ? {} : 'skip')

  // Get all users with their hotel assignments for display in the user management table.
  const users = useQuery(
    api.hotelStaff.listAllUsers,
    user?.id ? {} : 'skip', // Only fetch if we have a logged-in user to determine permissions.
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
      await unassignUser({ targetUserId })
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
        <div
          className={`rounded-2xl p-8 text-center border ${isDark ? 'bg-slate-900/50 border-slate-800/50 text-slate-500' : 'bg-white/80 border-slate-200/80 text-slate-400 shadow-sm'}`}
        >
          {t('admin.users.loadingProfile')}
        </div>
      </div>
    )
  }

  // Restrict access to this route to room_admin users only; show message if not authorized.
  if (profile?.role !== 'room_admin') {
    return (
      <div className="max-w-7xl mx-auto">
        <div
          className={`rounded-2xl p-8 text-center border border-red-500/20 ${isDark ? 'bg-slate-900/50' : 'bg-white/80 shadow-sm'}`}
        >
          <h2 className="text-xl font-semibold text-red-400 mb-2">
            {t('admin.accessDenied')}
          </h2>
          <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
            {t('admin.users.onlyRoomAdmins')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1
          className={`text-3xl font-semibold tracking-tight mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {t('admin.nav.users')}
        </h1>
        <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>
          {t('admin.users.description')}
        </p>
      </motion.div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-300 rounded-xl p-3 mb-4">
          {error}
        </div>
      )}

      {/* Search input for filtering users by email. */}
      <motion.div
        className="relative mb-6"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
      >
        <Search
          className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
        />
        <input
          type="text"
          placeholder={t('admin.users.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={`w-full pl-12 pr-4 py-3 rounded-xl focus:outline-none transition-all ${
            isDark
              ? 'bg-slate-900/50 border border-slate-800/50 text-slate-200 placeholder-slate-500 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20'
              : 'bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 shadow-sm'
          }`}
        />
      </motion.div>

      {/* User list table with assignment status and actions. */}
      <motion.div
        className={`rounded-2xl overflow-hidden border ${isDark ? 'bg-slate-900/50 border-slate-800/50' : 'bg-white/80 border-slate-200/80 shadow-sm backdrop-blur-sm'}`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr
                className={`border-b text-left ${isDark ? 'border-slate-800/70' : 'border-slate-100'}`}
              >
                <th
                  className={`px-6 py-4 text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                >
                  {t('admin.users.email')}
                </th>
                <th
                  className={`px-6 py-4 text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                >
                  {t('admin.users.globalRole')}
                </th>
                <th
                  className={`px-6 py-4 text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                >
                  {t('admin.users.hotelAssignment')}
                </th>
                <th
                  className={`px-6 py-4 text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                >
                  {t('admin.users.hotelRole')}
                </th>
                <th
                  className={`px-6 py-4 text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                >
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
                    className={`px-6 py-8 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                  >
                    {t('admin.users.loadingUsers')}
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className={`px-6 py-8 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                  >
                    {t('admin.users.noneFound')}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((listedUser) => (
                  <tr
                    key={listedUser._id}
                    className={`last:border-b-0 ${isDark ? 'border-b border-slate-800/40 hover:bg-slate-800/20' : 'border-b border-slate-100 hover:bg-slate-50/60'}`}
                  >
                    <td
                      className={`px-6 py-4 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}
                    >
                      {listedUser.email}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium border ${
                          listedUser.role === 'room_admin'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : isDark
                              ? 'bg-slate-700/40 text-slate-300 border-slate-700'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {roleLabelByCode[listedUser.role] || listedUser.role}
                      </span>
                    </td>
                    <td
                      className={`px-6 py-4 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}
                    >
                      {listedUser.assignment ? (
                        <div className="flex items-center gap-2">
                          <Building2
                            className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                          />
                          <span>
                            {listedUser.assignment.hotelName},{' '}
                            {listedUser.assignment.hotelCity}
                          </span>
                        </div>
                      ) : (
                        <span
                          className={`italic ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                        >
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
                        <span
                          className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                        >
                          {t('admin.bookings.na')}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {listedUser.assignment ? (
                        <button
                          onClick={() => handleUnassign(listedUser._id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                        >
                          {t('admin.users.unassign')}
                        </button>
                      ) : (
                        <button
                          onClick={() => setSelectedUserId(listedUser._id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            isDark
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20'
                              : 'bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20'
                          }`}
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
      </motion.div>

      {selectedUserId && (
        <AssignModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </div>
  )
}
