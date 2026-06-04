import { useMutation, useQuery } from '@/integrations/convex/hooks'
import { useAuth } from '@clerk/clerk-react'
import { useEffect, useRef, useState } from 'react'
import { Bell, BellOff, Check, CheckCheck, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { cn } from '../lib/utils'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { ScrollArea } from './ui/scroll-area'

const notificationMeta = {
  booking_payment_proof_submitted: {
    label: 'New Payment Proof',
    color: 'text-amber-500 dark:text-amber-400',
    dot: 'bg-amber-500 dark:bg-amber-400',
  },
  booking_confirmed: {
    label: 'Booking Confirmed',
    color: 'text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500 dark:bg-emerald-400',
  },
  booking_cancelled: {
    label: 'Booking Cancelled',
    color: 'text-red-600 dark:text-red-400',
    dot: 'bg-red-500 dark:bg-red-400',
  },
  booking_payment_rejected: {
    label: 'Payment Rejected',
    color: 'text-orange-600 dark:text-orange-400',
    dot: 'bg-orange-500 dark:bg-orange-400',
  },
} as const

type NotificationType = keyof typeof notificationMeta

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function bookingLink(
  type: NotificationType,
  bookingId: Id<'bookings'>,
): string {
  if (type === 'booking_payment_proof_submitted') {
    return `/admin/bookings/${bookingId}`
  }
  return '/bookings'
}

interface NotificationBellProps {
  dropDirection?: 'down' | 'up'
}

export function NotificationBell({
  dropDirection = 'down',
}: NotificationBellProps) {
  const { isSignedIn } = useAuth()
  const [open, setOpen] = useState(false)
  const prevCountRef = useRef<number | undefined>(undefined)

  const notifications = useQuery(
    api.notifications.getMyNotifications,
    isSignedIn ? {} : 'skip',
  )
  const unreadCount = useQuery(
    api.notifications.getUnreadCount,
    isSignedIn ? {} : 'skip',
  )

  const markAsRead = useMutation(api.notifications.markAsRead)
  const markAllAsRead = useMutation(api.notifications.markAllAsRead)
  const clearAll = useMutation(api.notifications.clearAll)

  useEffect(() => {
    if (unreadCount === undefined) return

    if (
      prevCountRef.current !== undefined &&
      unreadCount > prevCountRef.current
    ) {
      const diff = unreadCount - prevCountRef.current
      toast.info(
        diff === 1
          ? 'You have a new notification'
          : `You have ${diff} new notifications`,
        { duration: 4000 },
      )
    }

    prevCountRef.current = unreadCount
  }, [unreadCount])

  if (!isSignedIn) return null

  const count = unreadCount ?? 0
  const side = dropDirection === 'up' ? 'top' : 'bottom'

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative rounded-xl border border-transparent hover:border-border hover:bg-accent/60"
          aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ''}`}
        >
          <Bell className="size-5 text-slate-500 dark:text-slate-300" />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white shadow-lg shadow-red-500/40">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side={side}
        align="end"
        className="notification-bell-panel w-[min(24rem,calc(100vw-1rem))] rounded-2xl border border-border/80 bg-popover/95 p-0 shadow-2xl backdrop-blur-xl"
      >
        <div className="flex items-center justify-between border-b border-border/80 px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-muted-foreground" />
            <span className="notification-bell-title text-sm font-semibold">
              Notifications
            </span>
            {count > 0 && (
              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-500 dark:text-amber-400">
                {count} unread
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {count > 0 && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => markAllAsRead({})}
                title="Mark all as read"
              >
                <CheckCheck size={14} />
              </Button>
            )}
            {(notifications?.length ?? 0) > 0 && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => clearAll({})}
                title="Clear all notifications"
                className="text-muted-foreground hover:text-red-500"
              >
                <Trash2 size={14} />
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-[420px]">
          {notifications === undefined && (
            <div className="flex items-center justify-center py-10">
              <div className="size-6 animate-spin rounded-full border-2 border-violet-500/20 border-t-violet-500" />
            </div>
          )}

          {notifications?.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
              <div className="rounded-xl bg-muted p-3">
                <BellOff size={22} className="text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                No notifications yet
              </p>
            </div>
          )}

          {notifications?.map((notification) => {
            const meta = notificationMeta[notification.type]
            const link = bookingLink(notification.type, notification.bookingId)

            return (
              <a
                key={notification._id}
                href={link}
                onClick={() => {
                  if (!notification.isRead) {
                    void markAsRead({ notificationId: notification._id })
                  }
                  setOpen(false)
                }}
                className={cn(
                  'notification-bell-item group flex items-start gap-3 border-b border-border/60 px-4 py-3.5 transition-colors last:border-b-0',
                  notification.isRead
                    ? 'notification-bell-item--read hover:bg-muted/60'
                    : 'notification-bell-item--unread bg-amber-500/5 hover:bg-amber-500/10',
                )}
              >
                <div className="mt-1.5 shrink-0">
                  <div
                    className={cn(
                      'size-2 rounded-full',
                      notification.isRead ? 'bg-transparent' : meta.dot,
                    )}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'notification-bell-label text-xs font-semibold uppercase tracking-wide',
                      meta.color,
                    )}
                  >
                    {meta.label}
                  </span>
                  <p
                    className={cn(
                      'notification-bell-message mt-0.5 text-sm leading-snug',
                      notification.isRead
                        ? 'text-muted-foreground'
                        : 'text-foreground',
                    )}
                  >
                    {notification.message}
                  </p>
                  <p className="notification-bell-time mt-1 text-xs text-muted-foreground">
                    {timeAgo(notification.createdAt)}
                  </p>
                </div>

                {!notification.isRead && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      void markAsRead({ notificationId: notification._id })
                    }}
                    title="Mark as read"
                  >
                    <Check size={14} />
                  </Button>
                )}
              </a>
            )
          })}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
