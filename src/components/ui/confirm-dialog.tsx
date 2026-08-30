'use client'

import * as React from 'react'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type ConfirmVariant =
  | 'default'
  | 'destructive'
  | 'warning'
  | 'info'
  | 'success'

export interface ConfirmOptions {
  title?: React.ReactNode
  description?: React.ReactNode
  confirmText?: React.ReactNode
  cancelText?: React.ReactNode
  variant?: ConfirmVariant
  icon?: LucideIcon
  confirmButtonVariant?:
    | 'default'
    | 'destructive'
    | 'outline'
    | 'secondary'
    | 'ghost'
  cancelButtonVariant?:
    | 'default'
    | 'destructive'
    | 'outline'
    | 'secondary'
    | 'ghost'
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>
}

const ConfirmContext = React.createContext<ConfirmContextType | null>(null)

const variantStyles: Record<
  ConfirmVariant,
  {
    icon: LucideIcon
    iconBg: string
    iconColor: string
    confirmButtonVariant:
      | 'default'
      | 'destructive'
      | 'outline'
      | 'secondary'
      | 'ghost'
  }
> = {
  destructive: {
    icon: AlertTriangle,
    iconBg:
      'bg-rose-500/10 dark:bg-rose-500/20 ring-8 ring-rose-500/5 dark:ring-rose-500/10',
    iconColor: 'text-rose-600 dark:text-rose-400',
    confirmButtonVariant: 'destructive',
  },
  warning: {
    icon: AlertCircle,
    iconBg:
      'bg-amber-500/10 dark:bg-amber-500/20 ring-8 ring-amber-500/5 dark:ring-amber-500/10',
    iconColor: 'text-amber-600 dark:text-amber-400',
    confirmButtonVariant: 'default',
  },
  info: {
    icon: HelpCircle,
    iconBg:
      'bg-violet-500/10 dark:bg-violet-500/20 ring-8 ring-violet-500/5 dark:ring-violet-500/10',
    iconColor: 'text-violet-600 dark:text-violet-400',
    confirmButtonVariant: 'default',
  },
  default: {
    icon: HelpCircle,
    iconBg:
      'bg-violet-500/10 dark:bg-violet-500/20 ring-8 ring-violet-500/5 dark:ring-violet-500/10',
    iconColor: 'text-violet-600 dark:text-violet-400',
    confirmButtonVariant: 'default',
  },
  success: {
    icon: CheckCircle2,
    iconBg:
      'bg-emerald-500/10 dark:bg-emerald-500/20 ring-8 ring-emerald-500/5 dark:ring-emerald-500/10',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    confirmButtonVariant: 'default',
  },
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const [options, setOptions] = React.useState<ConfirmOptions>({})
  const resolverRef = React.useRef<((value: boolean) => void) | null>(null)

  const confirm = React.useCallback(
    (opts: ConfirmOptions | string): Promise<boolean> => {
      const normalizedOpts =
        typeof opts === 'string' ? { description: opts } : opts
      setOptions(normalizedOpts)
      setOpen(true)

      return new Promise<boolean>((resolve) => {
        resolverRef.current = resolve
      })
    },
    [],
  )

  const handleConfirm = () => {
    setOpen(false)
    resolverRef.current?.(true)
    resolverRef.current = null
  }

  const handleCancel = () => {
    setOpen(false)
    resolverRef.current?.(false)
    resolverRef.current = null
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      handleCancel()
    }
  }

  const variant = options.variant || 'default'
  const style = variantStyles[variant]
  const IconComponent = options.icon || style.icon
  const confirmBtnVariant =
    options.confirmButtonVariant || style.confirmButtonVariant
  const cancelBtnVariant = options.cancelButtonVariant || 'outline'

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="max-w-md border-border/80 bg-card/95 p-6 shadow-2xl backdrop-blur-xl sm:max-w-md rounded-2xl"
          showCloseButton={false}
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  'flex size-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-200',
                  style.iconBg,
                  style.iconColor,
                )}
              >
                <IconComponent className="size-5.5" />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                {options.title && (
                  <DialogTitle className="font-heading text-lg font-semibold tracking-tight text-foreground">
                    {options.title}
                  </DialogTitle>
                )}
                {options.description && (
                  <DialogDescription className="mt-1.5 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                    {options.description}
                  </DialogDescription>
                )}
              </div>
            </div>

            <DialogFooter className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <Button
                type="button"
                variant={cancelBtnVariant}
                onClick={handleCancel}
                className="rounded-xl px-4 py-2 text-sm font-medium transition-all"
              >
                {options.cancelText || 'Cancel'}
              </Button>
              <Button
                type="button"
                variant={confirmBtnVariant}
                onClick={handleConfirm}
                className={cn(
                  'rounded-xl px-4 py-2 text-sm font-medium shadow-sm transition-all',
                  confirmBtnVariant === 'default' &&
                    'bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20',
                  confirmBtnVariant === 'destructive' &&
                    'bg-destructive text-white hover:bg-destructive/90 shadow-destructive/20',
                )}
                autoFocus
              >
                {options.confirmText || 'Confirm'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const context = React.useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider')
  }
  return context.confirm
}

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  onCancel?: () => void
  title?: React.ReactNode
  description?: React.ReactNode
  confirmText?: React.ReactNode
  cancelText?: React.ReactNode
  variant?: ConfirmVariant
  icon?: LucideIcon
  isLoading?: boolean
  confirmButtonVariant?:
    | 'default'
    | 'destructive'
    | 'outline'
    | 'secondary'
    | 'ghost'
}

export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  icon,
  isLoading = false,
  confirmButtonVariant,
}: ConfirmDialogProps) {
  const style = variantStyles[variant]
  const IconComponent = icon || style.icon
  const confirmBtnVariant = confirmButtonVariant || style.confirmButtonVariant

  const handleCancel = () => {
    onCancel?.()
    onOpenChange(false)
  }

  const handleConfirm = () => {
    onConfirm()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md border-border/80 bg-card/95 p-6 shadow-2xl backdrop-blur-xl sm:max-w-md rounded-2xl"
        showCloseButton={false}
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-200',
                style.iconBg,
                style.iconColor,
              )}
            >
              <IconComponent className="size-5.5" />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              {title && (
                <DialogTitle className="font-heading text-lg font-semibold tracking-tight text-foreground">
                  {title}
                </DialogTitle>
              )}
              {description && (
                <DialogDescription className="mt-1.5 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                  {description}
                </DialogDescription>
              )}
            </div>
          </div>

          <DialogFooter className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
              className="rounded-xl px-4 py-2 text-sm font-medium transition-all"
            >
              {cancelText}
            </Button>
            <Button
              type="button"
              variant={confirmBtnVariant}
              onClick={handleConfirm}
              disabled={isLoading}
              className={cn(
                'rounded-xl px-4 py-2 text-sm font-medium shadow-sm transition-all',
                confirmBtnVariant === 'default' &&
                  'bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20',
                confirmBtnVariant === 'destructive' &&
                  'bg-destructive text-white hover:bg-destructive/90 shadow-destructive/20',
              )}
              autoFocus
            >
              {confirmText}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
