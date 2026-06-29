interface AdminSpinnerProps {
  className?: string
  sizeClassName?: string
}

export function AdminSpinner({
  className = 'flex items-center justify-center py-20',
  sizeClassName = 'size-8',
}: AdminSpinnerProps) {
  return (
    <div className={className}>
      <div
        className={`animate-spin rounded-full ${sizeClassName} border-2 border-violet-500/20 border-t-violet-500`}
      />
    </div>
  )
}
