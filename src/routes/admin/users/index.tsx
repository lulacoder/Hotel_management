import { createFileRoute } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useMutation, useQuery } from 'convex/react'
import { Building2, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import { AssignModal } from './components/-AssignModal'
import type { Id } from '../../../../convex/_generated/dataModel'

export const Route = createFileRoute('/admin/users/')({
  component: AdminUsersPage,
})

function AdminUsersPage() {
  const { user } = useUser()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<Id<'users'> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const profile = useQuery(
    api.users.getByClerkId,
    user?.id ? { clerkUserId: user.id } : 'skip',
  )

  const users = useQuery(
    api.hotelStaff.listAllUsers,
    user?.id ? { clerkUserId: user.id } : 'skip',
  )

  const unassignUser = useMutation(api.hotelStaff.unassign)

  const filteredUsers = useMemo(() => {
    if (!users) return []
    return users.filter((u) =>
      u.email.toLowerCase().includes(searchQuery.toLowerCase()),
    )
  }, [users, searchQuery])

  const handleUnassign = async (targetUserId: Id<'users'>) => {
    if (!user?.id) return
    if (!confirm('Are you sure you want to unassign this user?')) return

    setError(null)
    try {
      await unassignUser({ clerkUserId: user.id, targetUserId })
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'Failed to unassign user.',
      )
    }
  }

  if (profile === undefined) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-8 text-center text-slate-500">
          Loading profile...
        </div>
      </div>
    )
  }

  if (profile?.role !== 'room_admin') {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-slate-900/50 border border-red-500/20 rounded-2xl p-8 text-center">
          <h2 className="text-xl font-semibold text-red-400 mb-2">Access Denied</h2>
          <p className="text-slate-400">Only room administrators can manage users.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-slate-100 tracking-tight mb-2">Users</h1>
        <p className="text-slate-400">
          Assign users to hotels and manage hotel staff roles.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-300 rounded-xl p-3 mb-4">
          {error}
        </div>
      )}

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
        <input
          type="text"
          placeholder="Search users by email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-slate-900/50 border border-slate-800/50 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20"
        />
      </div>

      <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800/70 text-left">
                <th className="px-6 py-4 text-xs text-slate-500 font-medium uppercase tracking-wider">Email</th>
                <th className="px-6 py-4 text-xs text-slate-500 font-medium uppercase tracking-wider">Global Role</th>
                <th className="px-6 py-4 text-xs text-slate-500 font-medium uppercase tracking-wider">Hotel Assignment</th>
                <th className="px-6 py-4 text-xs text-slate-500 font-medium uppercase tracking-wider">Hotel Role</th>
                <th className="px-6 py-4 text-xs text-slate-500 font-medium uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users === undefined ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    Loading users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No users found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((listedUser) => (
                  <tr
                    key={listedUser._id}
                    className="border-b border-slate-800/40 last:border-b-0 hover:bg-slate-800/20"
                  >
                    <td className="px-6 py-4 text-slate-200">{listedUser.email}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium border ${
                          listedUser.role === 'room_admin'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-slate-700/40 text-slate-300 border-slate-700'
                        }`}
                      >
                        {listedUser.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-300 text-sm">
                      {listedUser.assignment ? (
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-500" />
                          <span>
                            {listedUser.assignment.hotelName}, {listedUser.assignment.hotelCity}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">Not assigned</span>
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
                          {listedUser.assignment.role}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {listedUser.assignment ? (
                        <button
                          onClick={() => handleUnassign(listedUser._id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                        >
                          Unassign
                        </button>
                      ) : (
                        <button
                          onClick={() => setSelectedUserId(listedUser._id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20"
                        >
                          Assign
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
        <AssignModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
      )}
    </div>
  )
}
