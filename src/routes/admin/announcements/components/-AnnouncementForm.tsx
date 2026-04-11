import { useEffect, useMemo, useState } from 'react'
import { useMutation } from 'convex/react'
import { toast } from 'sonner'
import { AlertCircle, AlertTriangle, Info, Megaphone, X } from 'lucide-react'
import { useForm, useStore } from '@tanstack/react-form'
import { z } from 'zod'

import { api } from '../../../../../convex/_generated/api'
import { useI18n } from '../../../../lib/i18n'
import { useTheme } from '../../../../lib/theme'
import type { Id } from '../../../../../convex/_generated/dataModel'

type Priority = 'normal' | 'important' | 'urgent'

interface AnnouncementFormProps {
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

function getFirstErrorMessage(errors: unknown[] | undefined): string | null {
  if (!errors) {
    return null
  }

  for (const error of errors) {
    if (!error) {
      continue
    }

    if (typeof error === 'string') {
      return error
    }

    if (typeof error === 'object' && 'message' in error) {
      const message = error.message
      if (typeof message === 'string') {
        return message
      }
    }
  }

  return null
}

export function AnnouncementForm({ editing, onClose }: AnnouncementFormProps) {
  const { t } = useI18n()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [submitError, setSubmitError] = useState('')

  const createAnnouncement = useMutation(api.announcements.create)
  const updateAnnouncement = useMutation(api.announcements.update)

  const isEditing = Boolean(editing)

  const schema = useMemo(
    () =>
      z.object({
        title: z
          .string()
          .trim()
          .min(3, t('admin.announcements.form.titleMin'))
          .max(120, t('admin.announcements.form.titleMax')),
        body: z
          .string()
          .trim()
          .min(10, t('admin.announcements.form.bodyMin'))
          .max(2000, t('admin.announcements.form.bodyMax')),
        priority: z.enum(['normal', 'important', 'urgent']),
      }),
    [t],
  )

  const form = useForm({
    defaultValues: {
      title: editing?.title ?? '',
      body: editing?.body ?? '',
      priority: editing?.priority ?? ('normal' as Priority),
    },
    validators: {
      onBlur: schema,
      onSubmit: schema,
    },
    onSubmit: async ({ value }) => {
      setSubmitError('')

      try {
        if (isEditing && editing) {
          await updateAnnouncement({
            announcementId: editing._id,
            title: value.title.trim(),
            body: value.body.trim(),
            priority: value.priority,
          })
          toast.success('Announcement updated successfully')
        } else {
          await createAnnouncement({
            title: value.title.trim(),
            body: value.body.trim(),
            priority: value.priority,
          })
          toast.success('Announcement published successfully')
        }
        onClose()
      } catch {
        const message = isEditing
          ? 'Failed to update announcement'
          : 'Failed to publish announcement'
        setSubmitError(message)
        toast.error(message)
      }
    },
  })

  useEffect(() => {
    form.reset({
      title: editing?.title ?? '',
      body: editing?.body ?? '',
      priority: editing?.priority ?? 'normal',
    })
    setSubmitError('')
  }, [editing?._id, editing?.body, editing?.priority, editing?.title, form])

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting)
  const titleValue = useStore(form.store, (state) => state.values.title)
  const bodyValue = useStore(form.store, (state) => state.values.body)
  const priorityValue = useStore(form.store, (state) => state.values.priority)

  const titleError = getFirstErrorMessage(form.getFieldMeta('title')?.errors)
  const bodyError = getFirstErrorMessage(form.getFieldMeta('body')?.errors)
  const PriorityIcon = priorityConfig[priorityValue].icon

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="admin-modal-panel w-full max-w-lg max-h-[88vh] sm:max-h-[90vh]">
        <div className="admin-modal-header px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10">
              <Megaphone className="h-4 w-4 text-violet-400" />
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
              <p className="text-xs text-slate-500">
                {isEditing
                  ? 'Edit the existing announcement'
                  : 'Published immediately to all guests'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className={`rounded-xl p-2 transition-colors disabled:opacity-50 ${
              isDark
                ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
            }`}
          >
            <X size={16} />
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void form.handleSubmit()
          }}
          className="admin-modal-body space-y-5 p-5 sm:p-6"
        >
          {submitError ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
              {submitError}
            </div>
          ) : null}

          <form.Field name="priority">
            {(field) => (
              <div>
                <label
                  className={`mb-2 block text-sm font-medium ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}
                >
                  {t('admin.announcements.form.priorityLabel')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(priorityConfig) as Array<Priority>).map(
                    (priority) => {
                      const config = priorityConfig[priority]
                      const Icon = config.icon
                      const isSelected = field.state.value === priority

                      return (
                        <button
                          key={priority}
                          type="button"
                          onClick={() => field.handleChange(priority)}
                          className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-all ${
                            isSelected
                              ? isDark
                                ? `bg-slate-800 text-slate-100 ring-2 ${config.ring} border-slate-600 ${config.color}`
                                : `bg-white text-slate-900 ring-2 ${config.ring} border-slate-300 ${config.color}`
                              : isDark
                                ? 'border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                                : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:text-slate-700'
                          }`}
                        >
                          <Icon size={14} />
                          {t(config.label as Parameters<typeof t>[0])}
                        </button>
                      )
                    },
                  )}
                </div>
              </div>
            )}
          </form.Field>

          <form.Field name="title">
            {(field) => (
              <div>
                <label
                  htmlFor="ann-title"
                  className={`mb-1.5 block text-sm font-medium ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}
                >
                  {t('admin.announcements.form.titleLabel')}
                </label>
                <input
                  id="ann-title"
                  type="text"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={t('admin.announcements.form.titlePlaceholder')}
                  maxLength={120}
                  className={`admin-field text-sm ${
                    titleError
                      ? 'border-red-500/60 focus:border-red-500/80'
                      : ''
                  }`}
                />
                <div className="mt-1.5 flex items-start justify-between gap-2">
                  {titleError ? (
                    <p className="text-xs text-red-400">{titleError}</p>
                  ) : (
                    <span />
                  )}
                  <span className="shrink-0 text-xs text-slate-500">
                    {titleValue.length}/120
                  </span>
                </div>
              </div>
            )}
          </form.Field>

          <form.Field name="body">
            {(field) => (
              <div>
                <label
                  htmlFor="ann-body"
                  className={`mb-1.5 block text-sm font-medium ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}
                >
                  {t('admin.announcements.form.bodyLabel')}
                </label>
                <textarea
                  id="ann-body"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={t('admin.announcements.form.bodyPlaceholder')}
                  maxLength={2000}
                  rows={5}
                  className={`admin-textarea resize-none text-sm ${
                    bodyError ? 'border-red-500/60 focus:border-red-500/80' : ''
                  }`}
                />
                <div className="mt-1.5 flex items-start justify-between gap-2">
                  {bodyError ? (
                    <p className="text-xs text-red-400">{bodyError}</p>
                  ) : (
                    <span />
                  )}
                  <span className="shrink-0 text-xs text-slate-500">
                    {bodyValue.length}/2000
                  </span>
                </div>
              </div>
            )}
          </form.Field>

          <div
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
              priorityValue === 'urgent'
                ? 'border-red-500/20 bg-red-500/5'
                : priorityValue === 'important'
                  ? 'border-amber-500/20 bg-amber-500/5'
                  : 'border-blue-500/20 bg-blue-500/5'
            }`}
          >
            <PriorityIcon
              size={15}
              className={`mt-0.5 shrink-0 ${priorityConfig[priorityValue].color}`}
            />
            <div className="min-w-0">
              <p
                className={`mb-0.5 text-xs font-semibold uppercase tracking-wide ${priorityConfig[priorityValue].color}`}
              >
                {t(
                  priorityConfig[priorityValue].label as Parameters<
                    typeof t
                  >[0],
                )}
              </p>
              <p
                className={`truncate text-sm ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                {titleValue.trim() ||
                  t('admin.announcements.form.titlePlaceholder')}
              </p>
            </div>
          </div>

          <div className="admin-modal-footer pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="admin-button-secondary text-sm disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`admin-button-primary flex items-center gap-2 text-sm disabled:cursor-not-allowed disabled:opacity-60 ${
                priorityValue === 'urgent'
                  ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
                  : priorityValue === 'important'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700'
                    : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'
              }`}
            >
              {isSubmitting ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : null}
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
