import { useEffect, useState } from 'react'
import { useMutation } from 'convex/react'
import { toast } from 'sonner'
import { AlertCircle, AlertTriangle, Info, Megaphone, X } from 'lucide-react'
import { api } from '../../../../../convex/_generated/api'
import { useI18n } from '../../../../lib/i18n'
import { useTheme } from '../../../../lib/theme'
import type { Id } from '../../../../../convex/_generated/dataModel'

type Priority = 'normal' | 'important' | 'urgent'

interface AnnouncementFormProps {
  /** Pass a full announcement to edit, or leave undefined to create a new one */
  editing?: {
    _id: Id<'announcements'>
    title: string
    body: string
    priority: Priority
  } | null
  onClose: () => void
}

const priorityConfig: Record<
  Priority,
  { icon: typeof Megaphone; color: string; ring: string; label: string }
> = {
  normal: {
    icon: Info,
    color: 'text-blue-400',
    ring: 'ring-blue-500/40',
    label: 'admin.announcements.priority.normal',
  },
  important: {
    icon: AlertCircle,
    color: 'text-amber-400',
    ring: 'ring-amber-500/40',
    label: 'admin.announcements.priority.important',
  },
  urgent: {
    icon: AlertTriangle,
    color: 'text-red-400',
    ring: 'ring-red-500/40',
    label: 'admin.announcements.priority.urgent',
  },
}

export function AnnouncementForm({ editing, onClose }: AnnouncementFormProps) {
  const { t } = useI18n()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [title, setTitle] = useState(editing?.title ?? '')
  const [body, setBody] = useState(editing?.body ?? '')
  const [priority, setPriority] = useState<Priority>(
    editing?.priority ?? 'normal',
  )
  const [errors, setErrors] = useState<{ title?: string; body?: string }>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const createAnnouncement = useMutation(api.announcements.create)
  const updateAnnouncement = useMutation(api.announcements.update)

  const isEditing = Boolean(editing)

  // Reset form when the editing target changes
  useEffect(() => {
    setTitle(editing?.title ?? '')
    setBody(editing?.body ?? '')
    setPriority(editing?.priority ?? 'normal')
    setErrors({})
  }, [editing?._id])

  function validate(): boolean {
    const next: { title?: string; body?: string } = {}
    const trimmedTitle = title.trim()
    const trimmedBody = body.trim()

    if (trimmedTitle.length < 3) {
      next.title = t('admin.announcements.form.titleMin')
    } else if (trimmedTitle.length > 120) {
      next.title = t('admin.announcements.form.titleMax')
    }

    if (trimmedBody.length < 10) {
      next.body = t('admin.announcements.form.bodyMin')
    } else if (trimmedBody.length > 2000) {
      next.body = t('admin.announcements.form.bodyMax')
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    try {
      if (isEditing && editing) {
        await updateAnnouncement({
          announcementId: editing._id,
          title: title.trim(),
          body: body.trim(),
          priority,
        })
        toast.success('Announcement updated successfully')
      } else {
        await createAnnouncement({
          title: title.trim(),
          body: body.trim(),
          priority,
        })
        toast.success('Announcement published successfully')
      }
      onClose()
    } catch {
      toast.error(
        isEditing
          ? 'Failed to update announcement'
          : 'Failed to publish announcement',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const PriorityIcon = priorityConfig[priority].icon

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`w-full max-w-lg max-h-[88vh] sm:max-h-[90vh] border rounded-2xl shadow-2xl flex flex-col overflow-hidden ${
          isDark
            ? 'bg-slate-900 border-slate-700/60 shadow-black/50'
            : 'bg-white border-slate-200 shadow-slate-300/40'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-5 sm:px-6 py-4 border-b ${
            isDark ? 'border-slate-800/60' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Megaphone className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h2
                className={`text-base font-semibold ${
                  isDark ? 'text-slate-100' : 'text-slate-900'
                }`}
              >
                {isEditing
                  ? t('admin.announcements.form.editTitle')
                  : t('admin.announcements.form.createTitle')}
              </h2>
              <p
                className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}
              >
                {isEditing
                  ? 'Edit the existing announcement'
                  : 'Published immediately to all guests'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className={`p-2 rounded-xl transition-colors disabled:opacity-50 ${
              isDark
                ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                : 'hover:bg-slate-100 text-slate-500 hover:text-slate-700'
            }`}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="p-5 sm:p-6 space-y-5 overflow-y-auto"
        >
          {/* Priority selector */}
          <div>
            <label
              className={`block text-sm font-medium mb-2 ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}
            >
              {t('admin.announcements.form.priorityLabel')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(priorityConfig) as Array<Priority>).map((p) => {
                const cfg = priorityConfig[p]
                const Icon = cfg.icon
                const isSelected = priority === p
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      isSelected
                        ? isDark
                          ? `bg-slate-800 border-slate-600 ${cfg.color} ring-2 ${cfg.ring}`
                          : `bg-white border-slate-300 ${cfg.color} ring-2 ${cfg.ring}`
                        : isDark
                          ? 'bg-slate-800/40 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-700'
                    }`}
                  >
                    <Icon size={14} />
                    {t(cfg.label as Parameters<typeof t>[0])}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label
              htmlFor="ann-title"
              className={`block text-sm font-medium mb-1.5 ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}
            >
              {t('admin.announcements.form.titleLabel')}
            </label>
            <input
              id="ann-title"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                if (errors.title)
                  setErrors((prev) => ({ ...prev, title: undefined }))
              }}
              placeholder={t('admin.announcements.form.titlePlaceholder')}
              maxLength={120}
              className={`w-full px-4 py-3 border rounded-xl focus:outline-none transition-all text-sm ${
                isDark
                  ? 'bg-slate-800/50 text-slate-200 placeholder-slate-500'
                  : 'bg-white text-slate-800 placeholder-slate-400 shadow-sm'
              } ${
                errors.title
                  ? 'border-red-500/60 focus:border-red-500/80'
                  : isDark
                    ? 'border-slate-700 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20'
                    : 'border-slate-200 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20'
              }`}
            />
            <div className="flex items-start justify-between mt-1.5 gap-2">
              {errors.title ? (
                <p className="text-xs text-red-400">{errors.title}</p>
              ) : (
                <span />
              )}
              <span
                className={`text-xs shrink-0 ${
                  isDark ? 'text-slate-500' : 'text-slate-500'
                }`}
              >
                {title.length}/120
              </span>
            </div>
          </div>

          {/* Body */}
          <div>
            <label
              htmlFor="ann-body"
              className={`block text-sm font-medium mb-1.5 ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}
            >
              {t('admin.announcements.form.bodyLabel')}
            </label>
            <textarea
              id="ann-body"
              value={body}
              onChange={(e) => {
                setBody(e.target.value)
                if (errors.body)
                  setErrors((prev) => ({ ...prev, body: undefined }))
              }}
              placeholder={t('admin.announcements.form.bodyPlaceholder')}
              maxLength={2000}
              rows={5}
              className={`w-full px-4 py-3 border rounded-xl focus:outline-none transition-all text-sm resize-none ${
                isDark
                  ? 'bg-slate-800/50 text-slate-200 placeholder-slate-500'
                  : 'bg-white text-slate-800 placeholder-slate-400 shadow-sm'
              } ${
                errors.body
                  ? 'border-red-500/60 focus:border-red-500/80'
                  : isDark
                    ? 'border-slate-700 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20'
                    : 'border-slate-200 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20'
              }`}
            />
            <div className="flex items-start justify-between mt-1.5 gap-2">
              {errors.body ? (
                <p className="text-xs text-red-400">{errors.body}</p>
              ) : (
                <span />
              )}
              <span
                className={`text-xs shrink-0 ${
                  isDark ? 'text-slate-500' : 'text-slate-500'
                }`}
              >
                {body.length}/2000
              </span>
            </div>
          </div>

          {/* Preview pill */}
          <div
            className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${
              priority === 'urgent'
                ? 'bg-red-500/5 border-red-500/20'
                : priority === 'important'
                  ? 'bg-amber-500/5 border-amber-500/20'
                  : 'bg-blue-500/5 border-blue-500/20'
            }`}
          >
            <PriorityIcon
              size={15}
              className={`mt-0.5 shrink-0 ${priorityConfig[priority].color}`}
            />
            <div className="min-w-0">
              <p
                className={`text-xs font-semibold uppercase tracking-wide mb-0.5 ${priorityConfig[priority].color}`}
              >
                {t(priorityConfig[priority].label as Parameters<typeof t>[0])}
              </p>
              <p
                className={`text-sm truncate ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                {title.trim() || t('admin.announcements.form.titlePlaceholder')}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className={`px-5 py-2.5 text-sm font-medium border rounded-xl transition-all disabled:opacity-50 ${
                isDark
                  ? 'text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 border-slate-700'
                  : 'text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 border-slate-200'
              }`}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 ${
                priority === 'urgent'
                  ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
                  : priority === 'important'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700'
                    : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'
              }`}
            >
              {isSubmitting && (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {isSubmitting
                ? isEditing
                  ? t('admin.announcements.form.updating')
                  : t('admin.announcements.form.publishing')
                : isEditing
                  ? t('admin.announcements.form.update')
                  : t('admin.announcements.form.publish')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
