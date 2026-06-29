interface ImageFieldProps {
  accept?: string
  inputAriaLabel: string
  isDark: boolean
  label: string
  maxSizeLabel: string
  onRemove: () => void
  onSelect: (file: File) => string | null
  onValidationError: (message: string) => void
  previewAlt: string
  previewClassName: string
  previewUrl: string
  removeLabel: string
}

export function ImageField({
  accept = 'image/*',
  inputAriaLabel,
  isDark,
  label,
  maxSizeLabel,
  onRemove,
  onSelect,
  onValidationError,
  previewAlt,
  previewClassName,
  previewUrl,
  removeLabel,
}: ImageFieldProps) {
  return (
    <div>
      <label
        className={`mb-2 block text-sm font-medium ${
          isDark ? 'text-slate-300' : 'text-slate-700'
        }`}
      >
        {label}
      </label>
      <input
        aria-label={inputAriaLabel}
        type="file"
        accept={accept}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (!file) {
            return
          }

          const validationError = onSelect(file)
          if (validationError) {
            onValidationError(validationError)
          }
        }}
        className={`admin-field py-2.5 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-violet-500/20 file:px-3 file:py-1.5 file:text-violet-300 ${
          isDark ? 'text-slate-300' : 'text-slate-600'
        }`}
      />
      <p
        className={`mt-2 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
      >
        {maxSizeLabel}
      </p>
      {previewUrl ? (
        <div className="mt-3">
          <img src={previewUrl} alt={previewAlt} className={previewClassName} />
          <button
            type="button"
            onClick={onRemove}
            className="mt-3 cursor-pointer text-sm font-medium text-red-400 transition-colors hover:text-red-300"
          >
            {removeLabel}
          </button>
        </div>
      ) : null}
    </div>
  )
}
