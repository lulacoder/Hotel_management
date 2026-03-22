import { useQuery, useMutation } from 'convex/react'
import { useAuth } from '@clerk/clerk-react'
import { useEffect, useRef, useState, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { Bell, BellOff, Check, CheckCheck, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

// Maps notification types to display labels and styles.
const notificationMeta = {
  booking_payment_proof_submitted: {
    label: 'New Payment Proof',
    color: 'text-amber-500 dark:text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20 dark:bg-amber-400/10 dark:border-amber-400/20',
    dot: 'bg-amber-500 dark:bg-amber-400',
  },
  booking_confirmed: {
    label: 'Booking Confirmed',
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20 dark:bg-emerald-400/10 dark:border-emerald-400/20',
    dot: 'bg-emerald-500 dark:bg-emerald-400',
  },
  booking_cancelled: {
    label: 'Booking Cancelled',
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-500/10 border-red-500/20 dark:bg-red-400/10 dark:border-red-400/20',
    dot: 'bg-red-500 dark:bg-red-400',
  },
  booking_payment_rejected: {
    label: 'Payment Rejected',
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-500/10 border-orange-500/20 dark:bg-orange-400/10 dark:border-orange-400/20',
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

// Derives the correct booking detail path based on notification type.
// Staff notifications link to the admin booking view; customer notifications
// link to the customer bookings page.
function bookingLink(
  type: NotificationType,
  bookingId: Id<'bookings'>,
): string {
  if (type === 'booking_payment_proof_submitted') {
    return `/admin/bookings/${bookingId}`
  }
  return `/bookings`
}

interface NotificationBellProps {
  dropDirection?: 'down' | 'up'
}

export function NotificationBell({
  dropDirection = 'down',
}: NotificationBellProps) {
  const { isSignedIn } = useAuth()
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef<number | undefined>(undefined)
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({})

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

  // Compute the portal panel position based on the bell button's DOM rect.
  const updatePanelPosition = useCallback(() => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const panelWidth = Math.min(384, window.innerWidth - 16) // w-96 = 384px

    if (dropDirection === 'up') {
      // Align left edge with button, open upward
      let left = rect.left
      if (left + panelWidth > window.innerWidth - 8) {
        left = window.innerWidth - panelWidth - 8
      }
      setPanelStyle({
        position: 'fixed',
        bottom: window.innerHeight - rect.top + 8,
        left: Math.max(8, left),
        width: panelWidth,
        zIndex: 2147483000,
      })
    } else {
      // Align right edge with button, open downward
      let right = window.innerWidth - rect.right
      if (right < 8) right = 8
      setPanelStyle({
        position: 'fixed',
        top: rect.bottom + 8,
        right: Math.max(8, right),
        width: panelWidth,
        zIndex: 2147483000,
      })
    }
  }, [dropDirection])

  // Recompute position whenever the panel opens or window resizes/scrolls.
  useEffect(() => {
    if (!open) return
    updatePanelPosition()

    window.addEventListener('resize', updatePanelPosition)
    window.addEventListener('scroll', updatePanelPosition, true)
    return () => {
      window.removeEventListener('resize', updatePanelPosition)
      window.removeEventListener('scroll', updatePanelPosition, true)
    }
  }, [open, updatePanelPosition])

  // Fire a toast whenever unreadCount increases (real-time new notification).
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

  // Close panel on outside click.
  useEffect(() => {
    if (!open) return

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  if (!isSignedIn) return null

  const handleMarkAsRead = async (notificationId: Id<'notifications'>) => {
    await markAsRead({ notificationId })
  }

  const handleMarkAllAsRead = async () => {
    await markAllAsRead({})
  }

  const handleClearAll = async () => {
    await clearAll({})
  }

  const count = unreadCount ?? 0

  const panel = open
    ? ReactDOM.createPortal(
        <div
          ref={panelRef}
          style={panelStyle}
          className="notification-bell-panel bg-white/80 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl shadow-sm dark:shadow-black/40 backdrop-blur-sm overflow-hidden"
        >
          {/* Panel Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/80 dark:border-slate-800/60">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-slate-500 dark:text-slate-400" />
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                Notifications
              </span>
              {count > 0 && (
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/20 dark:border-amber-400/20 px-2 py-0.5 rounded-full">
                  {count} unread
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {(notifications?.length ?? 0) > 0 && (
                <>
                  {count > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      title="Mark all as read"
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    >
                      <CheckCheck size={15} />
                    </button>
                  )}
                  <button
                    onClick={handleClearAll}
                    title="Clear all notifications"
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400 hover:text-red-500 dark:hover:text-red-400"
                  >
                    <Trash2 size={15} />
                  </button>
                </>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-[420px] overflow-y-auto">
            {notifications === undefined && (
              <div className="flex items-center justify-center py-10">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500/20 border-t-blue-500" />
              </div>
            )}

            {notifications?.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-3">
                <div className="p-3 bg-slate-100 dark:bg-slate-800/60 rounded-xl">
                  <BellOff
                    size={22}
                    className="text-slate-400 dark:text-slate-500"
                  />
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-500 font-medium">
                  No notifications yet
                </p>
              </div>
            )}

            {notifications?.map((n) => {
              const meta =
                notificationMeta[n.type as NotificationType] ??
                notificationMeta.booking_confirmed
              const link = bookingLink(n.type as NotificationType, n.bookingId)

              return (
                <div
                  key={n._id}
                  className={`notification-bell-item group flex items-start gap-3 px-4 py-3.5 border-b border-slate-200/80 dark:border-slate-800/40 last:border-0 transition-colors ${
                    n.isRead
                      ? 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                      : 'bg-amber-50/60 dark:bg-slate-800/20 hover:bg-amber-50/80 dark:hover:bg-slate-800/40'
                  }`}
                >
                  {/* Unread dot */}
                  <div className="mt-1.5 shrink-0">
                    <div
                      className={`w-2 h-2 rounded-full ${n.isRead ? 'bg-transparent' : meta.dot}`}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <a
                      href={link}
                      onClick={() => {
                        if (!n.isRead) handleMarkAsRead(n._id)
                        setOpen(false)
                      }}
                      className="block"
                    >
                      <span
                        className={`text-xs font-semibold uppercase tracking-wide ${meta.color}`}
                      >
                        {meta.label}
                      </span>
                      <p
                        className={`text-sm mt-0.5 leading-snug ${n.isRead ? 'text-slate-600 dark:text-slate-400' : 'text-slate-900 dark:text-slate-200'}`}
                      >
                        {n.message}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                        {timeAgo(n.createdAt)}
                      </p>
                    </a>
                  </div>

                  {/* Mark as read button (only shown when unread) */}
                  {!n.isRead && (
                    <button
                      onClick={() => handleMarkAsRead(n._id)}
                      title="Mark as read"
                      className="shrink-0 p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-slate-200/80 dark:hover:bg-slate-700 transition-all text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    >
                      <Check size={14} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <div className="relative z-[70]">
      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={() => setOpen((prev) => !prev)}
        className="relative p-2 rounded-xl border border-transparent hover:border-slate-300/80 hover:bg-white/80 dark:hover:border-transparent dark:hover:bg-white/10 transition-all duration-200 group"
        aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ''}`}
      >
        <Bell
          size={20}
          className="text-slate-500 dark:text-slate-300 group-hover:text-slate-800 dark:group-hover:text-white transition-colors"
        />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 leading-none shadow-lg shadow-red-500/40">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {panel}
    </div>
  )
}
