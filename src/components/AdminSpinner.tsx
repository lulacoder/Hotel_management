import { createPortal } from 'react-dom'

interface AdminSpinnerProps {
  className?: string
  fullScreen?: boolean
  label?: string
  overlay?: boolean
  sizeClassName?: string
}

// Renders the shared app loading indicator inline, full-screen, or over active UI
export function AdminSpinner({
  className = 'flex items-center justify-center py-20',
  fullScreen = false,
  label,
  overlay = false,
  sizeClassName = 'size-8',
}: AdminSpinnerProps) {
  const placementClassName = overlay
    ? 'fixed inset-0 z-[99999] flex items-center justify-center bg-background/95 px-6 text-foreground backdrop-blur-md'
    : fullScreen
      ? 'flex min-h-screen items-center justify-center bg-background px-6 text-foreground'
      : className

  const spinner = (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={placementClassName}
    >
      <div className="flex flex-col items-center text-center">
        <div
          className={`animate-spin rounded-full ${sizeClassName} border-2 border-violet-500/20 border-t-violet-500`}
        />
        {label ? (
          <p className="mt-4 text-sm font-medium text-foreground">{label}</p>
        ) : null}
      </div>
    </div>
  )

  if (overlay && typeof document !== 'undefined') {
    return createPortal(spinner, document.body)
  }

  return spinner
}
