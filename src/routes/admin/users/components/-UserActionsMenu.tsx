import { Ellipsis, UserMinus, UserPlus, UserRoundCog } from 'lucide-react'

import { Button } from '../../../../components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../../components/ui/dropdown-menu'
import { useI18n } from '../../../../lib/i18n/provider'

interface UserActionsMenuProps {
  canImpersonate: boolean
  isAssigned: boolean
  userEmail: string
  onAssign: () => void
  onImpersonate: () => void
  onUnassign: () => void
}

// Groups user management actions behind one accessible overflow menu
export function UserActionsMenu({
  canImpersonate,
  isAssigned,
  userEmail,
  onAssign,
  onImpersonate,
  onUnassign,
}: UserActionsMenuProps) {
  const { t } = useI18n()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          aria-label={`${t('admin.bookings.actions')}: ${userEmail}`}
        >
          <Ellipsis className="size-5" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="admin-menu-panel w-52 p-1.5">
        {isAssigned ? (
          <DropdownMenuItem
            variant="destructive"
            onSelect={onUnassign}
            className="admin-menu-item rounded-lg px-3 py-2.5"
          >
            <UserMinus className="size-4" aria-hidden="true" />
            {t('admin.users.unassign')}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onSelect={onAssign}
            className="admin-menu-item rounded-lg px-3 py-2.5"
          >
            <UserPlus className="size-4" aria-hidden="true" />
            {t('admin.users.assign')}
          </DropdownMenuItem>
        )}

        {canImpersonate ? (
          <>
            <DropdownMenuSeparator className="bg-slate-700/50 dark:bg-slate-700/70" />
            <DropdownMenuItem
              onSelect={onImpersonate}
              className="admin-menu-item rounded-lg px-3 py-2.5 text-amber-600 focus:text-amber-700 dark:text-amber-400 dark:focus:text-amber-300"
            >
              <UserRoundCog className="size-4" aria-hidden="true" />
              {t('admin.users.impersonate')}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
