import { useClerk, useUser } from '@clerk/clerk-react'
import { useNavigate } from '@tanstack/react-router'
import { LogOut, Settings } from 'lucide-react'

import { cn } from '../lib/utils'
import { useI18n } from '../lib/i18n/provider'
import { useTheme } from '../lib/theme'
import { NotificationBell } from './NotificationBell'

interface MobileAccountActionsProps {
  displayName?: string
  email?: string
  isDark?: boolean
  onRequestClose?: () => void
  showNotifications?: boolean
  className?: string
}

// Mobile drawer account controls avoid Clerk's portalled UserButton menu, which can be dismissed before its actions receive taps.
export function MobileAccountActions({
  displayName,
  email,
  isDark,
  onRequestClose,
  showNotifications = false,
  className,
}: MobileAccountActionsProps) {
  const clerk = useClerk()
  const { user } = useUser()
  const navigate = useNavigate()
  const { t } = useI18n()
  const { theme } = useTheme()

  const useDarkSurface = isDark ?? theme === 'dark'
  const primaryEmail = user?.primaryEmailAddress?.emailAddress
  const firstEmail = user?.emailAddresses[0]?.emailAddress
  const resolvedEmail = email ?? primaryEmail ?? firstEmail
  const resolvedName =
    displayName ??
    user?.fullName ??
    user?.firstName ??
    user?.username ??
    resolvedEmail ??
    ''
  const fallbackInitial = (
    user?.firstName?.charAt(0) ??
    user?.username?.charAt(0) ??
    resolvedEmail?.charAt(0) ??
    '?'
  ).toUpperCase()

  const handleManageAccount = () => {
    onRequestClose?.()
    window.setTimeout(() => {
      clerk.openUserProfile()
    }, 0)
  }

  const handleSignOut = async () => {
    onRequestClose?.()
    await clerk.signOut({ redirectUrl: '/' })
    await navigate({ to: '/' })
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-3 px-1">
        {user?.imageUrl ? (
          <img
            src={user.imageUrl}
            alt={resolvedName || 'User avatar'}
            className="size-10 rounded-full object-cover"
          />
        ) : (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-violet-500 text-sm font-semibold text-white shadow-lg shadow-violet-500/25">
            {fallbackInitial}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'truncate text-sm font-semibold',
              useDarkSurface ? 'text-slate-100' : 'text-slate-900',
            )}
          >
            {resolvedName}
          </p>
          {resolvedEmail && (
            <p
              className={cn(
                'truncate text-xs',
                useDarkSurface ? 'text-slate-400' : 'text-slate-500',
              )}
            >
              {resolvedEmail}
            </p>
          )}
        </div>

        {showNotifications && <NotificationBell dropDirection="up" />}
      </div>

      <div
        className={cn(
          'overflow-hidden rounded-xl border',
          useDarkSurface
            ? 'border-slate-700/60 bg-slate-900/45'
            : 'border-slate-200 bg-white shadow-sm',
        )}
      >
        <button
          type="button"
          onClick={handleManageAccount}
          className={cn(
            'flex min-h-12 w-full cursor-pointer items-center gap-3 px-4 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60',
            useDarkSurface
              ? 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100 focus-visible:bg-slate-800/80'
              : 'text-slate-700 hover:bg-slate-50 hover:text-slate-950 focus-visible:bg-slate-50',
          )}
        >
          <Settings className="size-4 shrink-0" />
          <span>{t('header.manageAccount')}</span>
        </button>

        <button
          type="button"
          onClick={handleSignOut}
          className={cn(
            'flex min-h-12 w-full cursor-pointer items-center gap-3 border-t px-4 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50',
            useDarkSurface
              ? 'border-slate-700/60 text-slate-300 hover:bg-rose-500/10 hover:text-rose-300 focus-visible:bg-rose-500/10'
              : 'border-slate-200 text-slate-700 hover:bg-rose-50 hover:text-rose-600 focus-visible:bg-rose-50',
          )}
        >
          <LogOut className="size-4 shrink-0" />
          <span>{t('header.signOut')}</span>
        </button>
      </div>
    </div>
  )
}
