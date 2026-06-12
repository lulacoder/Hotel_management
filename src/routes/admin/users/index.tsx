// User administration route for assigning and managing staff access.
import { createFileRoute } from '@tanstack/react-router'
import { Building2, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { m } from 'motion/react'
import { api } from '../../../../convex/_generated/api'
import { useI18n } from '../../../lib/i18n/provider'
import { useTheme } from '../../../lib/theme'
import { AssignModal } from './components/-AssignModal'
import type { Id } from '../../../../convex/_generated/dataModel'
import { useMutation, useQuery } from '@/integrations/convex/hooks'
import { Button } from '@/components/ui/button'
import { useAdminSession } from '@/lib/adminSession'

export const Route = createFileRoute('/admin/users/')({
  // Register staff/user assignment route (room_admin only).
  component: AdminUsersPage,
})

function AdminUsersPage() {
  // Query users and assignment actions; keep search + modal state local.
  const { t } = useI18n()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<Id<'users'> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { profile } = useAdminSession()

  // Get all users with their hotel assignments for display in the user management table.
  const users = useQuery(
    api.hotelStaff.listAllUsers,
    profile.role === 'room_admin' ? {} : 'skip',
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

  // Restrict access to this route to room_admin users only; show message if not authorized.
  if (profile.role !== 'room_admin') {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="admin-empty-state border-red-500/20 p-8">
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
      <m.div
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
      </m.div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-300 rounded-xl p-3 mb-4">
          {error}
        </div>
      )}

      {/* Search input for filtering users by email. */}
      <m.div
        className="relative mb-6 w-full min-w-0"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
      >
        <Search
          className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
        />
        <input
          aria-label={t('admin.users.searchPlaceholder')}
          type="text"
          placeholder={t('admin.users.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="admin-field w-full min-w-0 !pl-12"
        />
      </m.div>

      {/* User list table with assignment status and actions. */}
      <m.div
        className="admin-table-shell overflow-hidden"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
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
                    className="admin-table-row last:border-b-0"
                  >
                    <td className="px-6 py-4">
                      <span
                        className={`block max-w-[280px] truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}
                        title={listedUser.email}
                      >
                        {listedUser.email}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium border ${
                          listedUser.role === 'room_admin'
                            ? 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                            : isDark
                              ? 'bg-slate-700/40 text-slate-300 border-slate-700'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {roleLabelByCode[listedUser.role] || listedUser.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {listedUser.assignment ? (
                        <div
                          className={`flex min-w-0 items-center gap-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}
                        >
                          <Building2
                            className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                          />
                          <span
                            className="block truncate"
                            title={`${listedUser.assignment.hotelName}, ${listedUser.assignment.hotelCity}`}
                          >
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
                              ? 'bg-violet-500/10 text-violet-400 border-violet-500/20'
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
                        <Button
                          type="button"
                          variant="destructive"
                          size="lg"
                          onClick={() => handleUnassign(listedUser._id)}
                          className="px-4"
                        >
                          {t('admin.users.unassign')}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          size="lg"
                          onClick={() => setSelectedUserId(listedUser._id)}
                          className="px-4"
                        >
                          {t('admin.users.assign')}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </m.div>

      {selectedUserId && (
        <AssignModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </div>
  )
}
