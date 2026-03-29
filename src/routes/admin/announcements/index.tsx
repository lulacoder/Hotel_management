import { createFileRoute } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useMutation, useQuery } from 'convex/react'
import {
  AlertCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  Info,
  Megaphone,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { api } from '../../../../convex/_generated/api'
import { useI18n } from '../../../lib/i18n'
import { useTheme } from '../../../lib/theme'
import { AnnouncementForm } from './components/-AnnouncementForm'
import type { Id } from '../../../../convex/_generated/dataModel'

export const Route = createFileRoute('/admin/announcements/')({
  component: AdminAnnouncementsPage,
})

type Priority = 'normal' | 'important' | 'urgent'

const priorityMeta: Record<
  Priority,
  { icon: typeof Info; label: string; bg: string; border: string; text: string }
> = {
  normal: {
    icon: Info,
    label: 'admin.announcements.priority.normal',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    text: 'text-blue-400',
  },
  important: {
    icon: AlertCircle,
    label: 'admin.announcements.priority.important',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    text: 'text-amber-400',
  },
  urgent: {
    icon: AlertTriangle,
    label: 'admin.announcements.priority.urgent',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    text: 'text-red-400',
  },
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}

function AdminAnnouncementsPage() {
  const { user } = useUser()
  const { t, locale } = useI18n()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const dateLocale = locale === 'am' ? 'am-ET' : 'en-US'

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<{
    _id: Id<'announcements'>
    title: string
    body: string
    priority: Priority
  } | null>(null)

  const profile = useQuery(api.users.getMe, user?.id ? {} : 'skip')
  const hotelAssignment = useQuery(
    api.hotelStaff.getMyAssignment,
    profile ? {} : 'skip',
  )

  const canManage = Boolean(
    hotelAssignment &&
    ['hotel_admin', 'hotel_cashier'].includes(hotelAssignment.role),
  )

  const assignedHotel = useQuery(
    api.hotels.get,
    hotelAssignment?.hotelId ? { hotelId: hotelAssignment.hotelId } : 'skip',
  )

  const announcements = useQuery(
    api.announcements.getHotelAnnouncements,
    canManage ? {} : 'skip',
  )

  const toggleActive = useMutation(api.announcements.toggleActive)
  const remove = useMutation(api.announcements.remove)

  // -------------------------------------------------------------------------
  // Guards
  // -------------------------------------------------------------------------

  if (profile === undefined || hotelAssignment === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-violet-500/20 border-t-violet-500" />
      </div>
    )
  }

  if (!canManage) {
    return (
      <div className="max-w-7xl mx-auto">
        <div
          className={`border border-red-500/20 rounded-2xl p-10 text-center ${
            isDark
              ? 'bg-slate-900/50'
              : 'bg-white/80 shadow-sm backdrop-blur-sm'
          }`}
        >
          <div
            className={`w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4 ${
              isDark ? '' : 'shadow-sm'
            }`}
          >
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-red-400 mb-2">
            {t('admin.announcements.accessDeniedTitle')}
          </h2>
          <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
            {t('admin.announcements.accessDeniedDescription')}
          </p>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  async function handleToggle(
    id: Id<'announcements'>,
    currentlyActive: boolean,
  ) {
    try {
      await toggleActive({ announcementId: id })
      toast.success(
        currentlyActive
          ? 'Announcement hidden from guests'
          : 'Announcement is now visible to guests',
      )
    } catch {
      toast.error('Failed to update announcement status')
    }
  }

  async function handleDelete(id: Id<'announcements'>) {
    if (!window.confirm(t('admin.announcements.deleteConfirm'))) return
    try {
      await remove({ announcementId: id })
      toast.success('Announcement deleted')
    } catch {
      toast.error('Failed to delete announcement')
    }
  }

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(ann: {
    _id: Id<'announcements'>
    title: string
    body: string
    priority: Priority
  }) {
    setEditing(ann)
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditing(null)
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1
            className={`text-3xl font-semibold tracking-tight mb-2 ${
              isDark ? 'text-slate-100' : 'text-slate-900'
            }`}
          >
            {t('admin.announcements.title')}
          </h1>
          <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
            {t('admin.announcements.description')}
          </p>
          {assignedHotel && (
            <p
              className={`text-sm mt-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}
            >
              {assignedHotel.name} &mdash; {assignedHotel.city}
            </p>
          )}
        </div>
        <button
          onClick={openCreate}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all shrink-0 ${
            isDark
              ? 'bg-white text-slate-900 hover:bg-slate-100 shadow-lg shadow-white/10'
              : 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/20'
          }`}
        >
          <Plus size={16} />
          {t('admin.announcements.newAnnouncement')}
        </button>
      </div>

      {/* Content */}
      {announcements === undefined ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-violet-500/20 border-t-violet-500" />
        </div>
      ) : announcements.length === 0 ? (
        <div
          className={`border rounded-2xl p-14 text-center ${
            isDark
              ? 'bg-slate-900/50 border-slate-800/50'
              : 'bg-white/80 border-slate-200/80 shadow-sm backdrop-blur-sm'
          }`}
        >
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
              isDark ? 'bg-slate-800' : 'bg-slate-100'
            }`}
          >
            <Megaphone
              className={`w-8 h-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
            />
          </div>
          <h2
            className={`text-lg font-semibold mb-2 ${
              isDark ? 'text-slate-200' : 'text-slate-700'
            }`}
          >
            {t('admin.announcements.noneYet')}
          </h2>
          <p className={`mb-6 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            {t('admin.announcements.noneYetHint')}
          </p>
          <button
            onClick={openCreate}
            className={`inline-flex items-center gap-2 px-5 py-2.5 border text-sm font-medium rounded-xl transition-all ${
              isDark
                ? 'bg-violet-500/10 hover:bg-violet-500/20 border-violet-500/20 text-violet-400'
                : 'bg-violet-500/10 hover:bg-violet-500/20 border-violet-500/20 text-violet-600'
            }`}
          >
            <Plus size={15} />
            {t('admin.announcements.newAnnouncement')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((ann) => {
            const priority = ann.priority as Priority
            const meta = priorityMeta[priority]
            const Icon = meta.icon

            return (
              <div
                key={ann._id}
                className={`border rounded-2xl overflow-hidden transition-all ${
                  isDark
                    ? 'bg-slate-900/50'
                    : 'bg-white/80 shadow-sm backdrop-blur-sm'
                } ${
                  ann.isActive
                    ? isDark
                      ? 'border-slate-800/50'
                      : 'border-slate-200/80'
                    : isDark
                      ? 'border-slate-800/30 opacity-60'
                      : 'border-slate-200/70 opacity-75'
                }`}
              >
                {/* Priority accent bar */}
                <div
                  className={`h-0.5 w-full ${
                    priority === 'urgent'
                      ? 'bg-gradient-to-r from-red-500 to-red-600'
                      : priority === 'important'
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600'
                        : 'bg-gradient-to-r from-blue-500 to-blue-600'
                  }`}
                />

                <div className="p-5">
                  {/* Top row: priority badge + title + status + actions */}
                  <div className="flex items-start gap-3">
                    {/* Priority icon */}
                    <div
                      className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${meta.bg} border ${meta.border}`}
                    >
                      <Icon size={15} className={meta.text} />
                    </div>

                    {/* Title + meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3
                          className={`text-base font-semibold truncate ${
                            isDark ? 'text-slate-100' : 'text-slate-900'
                          }`}
                        >
                          {ann.title}
                        </h3>
                        {/* Priority badge */}
                        <span
                          className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${meta.bg} ${meta.border} ${meta.text}`}
                        >
                          {t(meta.label as Parameters<typeof t>[0])}
                        </span>
                        {/* Active/Inactive badge */}
                        <span
                          className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                            ann.isActive
                              ? isDark
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-600'
                              : isDark
                                ? 'bg-slate-700/40 border-slate-600/30 text-slate-500'
                                : 'bg-slate-100 border-slate-200 text-slate-500'
                          }`}
                        >
                          {ann.isActive
                            ? t('admin.announcements.active')
                            : t('admin.announcements.inactive')}
                        </span>
                      </div>

                      {/* Body preview */}
                      <p
                        className={`text-sm line-clamp-2 mb-2 ${
                          isDark ? 'text-slate-400' : 'text-slate-600'
                        }`}
                      >
                        {ann.body}
                      </p>

                      {/* Footer meta */}
                      <div
                        className={`flex items-center gap-3 text-xs flex-wrap ${
                          isDark ? 'text-slate-500' : 'text-slate-500'
                        }`}
                      >
                        <span>
                          {t('admin.announcements.by')}{' '}
                          <span
                            className={
                              isDark ? 'text-slate-400' : 'text-slate-700'
                            }
                          >
                            {ann.createdByEmail}
                          </span>
                        </span>
                        <span>&bull;</span>
                        <span>
                          {t('admin.announcements.postedAt')}{' '}
                          {new Date(ann.createdAt).toLocaleDateString(
                            dateLocale,
                            { month: 'short', day: 'numeric', year: 'numeric' },
                          )}
                        </span>
                        {ann.updatedAt !== ann.createdAt && (
                          <>
                            <span>&bull;</span>
                            <span>
                              {t('admin.announcements.updatedAt')}{' '}
                              {timeAgo(ann.updatedAt)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Toggle active */}
                      <button
                        onClick={() => handleToggle(ann._id, ann.isActive)}
                        title={
                          ann.isActive
                            ? t('admin.announcements.inactive')
                            : t('admin.announcements.active')
                        }
                        className={`p-2 rounded-xl border transition-all ${
                          ann.isActive
                            ? isDark
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100'
                            : isDark
                              ? 'bg-slate-800/60 border-slate-700 text-slate-500 hover:text-slate-300 hover:bg-slate-700'
                              : 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {ann.isActive ? (
                          <Eye size={15} />
                        ) : (
                          <EyeOff size={15} />
                        )}
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() =>
                          openEdit({
                            _id: ann._id,
                            title: ann.title,
                            body: ann.body,
                            priority: ann.priority as Priority,
                          })
                        }
                        title="Edit"
                        className={`p-2 rounded-xl border transition-all ${
                          isDark
                            ? 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                            : 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        <Pencil size={15} />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(ann._id)}
                        title="Delete"
                        className={`p-2 rounded-xl border transition-all ${
                          isDark
                            ? 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20'
                            : 'bg-slate-100 border-slate-200 text-slate-500 hover:text-red-500 hover:bg-red-50 hover:border-red-200'
                        }`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create / Edit modal */}
      {formOpen && <AnnouncementForm editing={editing} onClose={closeForm} />}
    </div>
  )
}
