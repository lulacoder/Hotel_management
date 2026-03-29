import { Link } from '@tanstack/react-router'
import { AlertCircle, AlertTriangle, Info, Megaphone } from 'lucide-react'

import { useI18n } from '../../../lib/i18n'
import { useTheme } from '../../../lib/theme'

interface AnnouncementPreview {
  _id: string
  body: string
  priority: 'normal' | 'important' | 'urgent'
  title: string
}

interface HotelAnnouncementsPreviewProps {
  announcements: Array<AnnouncementPreview>
  hotelId: string
}

export function HotelAnnouncementsPreview({
  announcements,
  hotelId,
}: HotelAnnouncementsPreviewProps) {
  const { t } = useI18n()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  if (announcements.length === 0) {
    return null
  }

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-violet-400" />
          <h2
            className={`text-base font-semibold ${
              isDark ? 'text-slate-200' : 'text-slate-800'
            }`}
          >
            {t('announcements.preview')}
          </h2>
          <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-400">
            {announcements.length}
          </span>
        </div>
        <Link
          to="/announcements"
          search={{ hotelId }}
          className={`text-xs transition-colors ${
            isDark
              ? 'text-violet-400 hover:text-violet-300'
              : 'text-violet-600 hover:text-violet-700'
          }`}
        >
          {t('announcements.viewAll')} →
        </Link>
      </div>

      <div className="space-y-2">
        {announcements.slice(0, 3).map((announcement) => {
          const isUrgent = announcement.priority === 'urgent'
          const isImportant = announcement.priority === 'important'
          const Icon = isUrgent
            ? AlertTriangle
            : isImportant
              ? AlertCircle
              : Info
          const accentBar = isUrgent
            ? 'bg-red-500'
            : isImportant
              ? 'bg-amber-500'
              : 'bg-violet-500'
          const cardBg = isUrgent
            ? isDark
              ? 'bg-red-500/5 border-red-500/20'
              : 'bg-red-50/70 border-red-200'
            : isImportant
              ? isDark
                ? 'bg-amber-500/5 border-amber-500/20'
                : 'bg-amber-50/70 border-amber-200'
              : isDark
                ? 'bg-slate-800/40 border-slate-700/60'
                : 'bg-white/80 border-slate-200/80 shadow-sm backdrop-blur-sm'
          const iconColor = isUrgent
            ? 'text-red-400'
            : isImportant
              ? 'text-amber-400'
              : 'text-violet-400'
          const badgeColor = isUrgent
            ? isDark
              ? 'bg-red-500/15 text-red-400'
              : 'bg-red-100 text-red-600'
            : isImportant
              ? isDark
                ? 'bg-amber-500/15 text-amber-400'
                : 'bg-amber-100 text-amber-600'
              : isDark
                ? 'bg-violet-500/10 text-violet-400'
                : 'bg-violet-100 text-violet-600'
          const priorityLabel = isUrgent
            ? t('announcements.priority.urgent')
            : isImportant
              ? t('announcements.priority.important')
              : t('announcements.priority.normal')

          return (
            <div
              key={announcement._id}
              className={`relative overflow-hidden rounded-xl border ${cardBg}`}
            >
              <div className={`absolute inset-y-0 left-0 w-1 ${accentBar}`} />
              <div className="flex items-start gap-3 px-4 py-3 pl-4">
                <Icon size={14} className={`mt-0.5 shrink-0 ${iconColor}`} />
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeColor}`}
                    >
                      {priorityLabel}
                    </span>
                  </div>
                  <p
                    className={`truncate text-sm font-medium ${
                      isDark ? 'text-slate-200' : 'text-slate-800'
                    }`}
                  >
                    {announcement.title}
                  </p>
                  <p
                    className={`mt-0.5 line-clamp-1 text-xs ${
                      isDark ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    {announcement.body}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {announcements.length > 3 && (
        <Link
          to="/announcements"
          search={{ hotelId }}
          className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border py-2 text-xs transition-all ${
            isDark
              ? 'border-slate-700/50 bg-slate-800/40 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800'
          }`}
        >
          <Megaphone size={12} />
          {t('announcements.viewAll')} ({announcements.length})
        </Link>
      )}
    </div>
  )
}
