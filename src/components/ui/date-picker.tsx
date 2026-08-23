import { useMemo, useState } from 'react'
import { Popover as PopoverPrimitive } from 'radix-ui'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

import { useI18n } from '../../lib/i18n/provider'
import { cn } from '@/lib/utils'

interface DatePickerProps {
  /** Selected date as a YYYY-MM-DD string, or '' when empty. */
  value: string
  onChange: (value: string) => void
  /** Inclusive lower bound as YYYY-MM-DD. */
  min?: string
  /** Inclusive upper bound as YYYY-MM-DD. */
  max?: string
  placeholder?: string
  ariaLabel?: string
  id?: string
  className?: string
  disabled?: boolean
}

function pad(value: number): string {
  return `${value}`.padStart(2, '0')
}

function toISO(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

function parseISO(value: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  return { year: Number(match[1]), month: Number(match[2]) - 1 }
}

function getTodayISO(): string {
  const now = new Date()
  return toISO(now.getFullYear(), now.getMonth(), now.getDate())
}

interface DayCell {
  iso: string
  day: number
  outside: boolean
  disabled: boolean
}

function buildCalendar(
  year: number,
  month: number,
  min?: string,
  max?: string,
): Array<DayCell> {
  const firstWeekday = new Date(year, month, 1).getDay()
  const cells: Array<DayCell> = []

  for (let i = 0; i < 42; i += 1) {
    const date = new Date(year, month, 1 - firstWeekday + i)
    const iso = toISO(date.getFullYear(), date.getMonth(), date.getDate())
    const disabled = (!!min && iso < min) || (!!max && iso > max)
    cells.push({
      iso,
      day: date.getDate(),
      outside: date.getMonth() !== month,
      disabled,
    })
  }

  return cells
}

export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder,
  ariaLabel,
  id,
  className,
  disabled,
}: DatePickerProps) {
  const { t, locale } = useI18n()
  const [open, setOpen] = useState(false)

  const todayISO = getTodayISO()
  const parsed = parseISO(value)
  const fallback = parseISO(min ?? '') ?? parseISO(todayISO)!
  const [view, setView] = useState(() => parsed ?? fallback)

  const weekdays = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' })
    // 2024-01-07 is a Sunday — build a Sun..Sat label row.
    return Array.from({ length: 7 }, (_, i) =>
      formatter.format(new Date(2024, 0, 7 + i)),
    )
  }, [locale])

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: 'long',
        year: 'numeric',
      }).format(new Date(view.year, view.month, 1)),
    [locale, view],
  )

  const triggerLabel = useMemo(() => {
    if (!value) return placeholder ?? t('datePicker.placeholder')
    const cells = parseISO(value)
    if (!cells) return value
    const [, , dayStr] = value.split('-')
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(cells.year, cells.month, Number(dayStr)))
  }, [value, placeholder, t, locale])

  const days = useMemo(
    () => buildCalendar(view.year, view.month, min, max),
    [view, min, max],
  )

  function shiftMonth(delta: number) {
    setView((prev) => {
      const next = new Date(prev.year, prev.month + delta, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })
  }

  function select(iso: string) {
    onChange(iso)
    setOpen(false)
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      setView(parseISO(value) ?? fallback)
    }
    setOpen(next)
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          id={id}
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn(
            'flex w-full items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-left text-sm text-slate-900 transition-all hover:border-violet-400 focus:border-violet-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:text-base dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:border-violet-500/40 dark:focus:border-violet-500/50',
            className,
          )}
        >
          {/* Placeholder text needs dark-mode slate-400 to meet WCAG AA on the
              translucent slate-800 trigger surface. */}
          <span className={cn(!value && 'text-slate-500 dark:text-slate-400')}>
            {triggerLabel}
          </span>
          <CalendarDays className="size-4 shrink-0 text-violet-600 dark:text-violet-400" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={8}
          className="z-50 w-[19rem] origin-(--radix-popover-content-transform-origin) rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-2xl shadow-slate-900/15 outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:shadow-black/40"
        >
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              aria-label={t('datePicker.previousMonth')}
              onClick={() => shiftMonth(-1)}
              className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-violet-100 hover:text-violet-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-semibold text-slate-900 capitalize dark:text-slate-100">
              {monthLabel}
            </span>
            <button
              type="button"
              aria-label={t('datePicker.nextMonth')}
              onClick={() => shiftMonth(1)}
              className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-violet-100 hover:text-violet-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7">
            {weekdays.map((weekday) => (
              <div
                key={weekday}
                className="flex h-8 items-center justify-center text-xs font-medium text-slate-500 dark:text-slate-400"
              >
                {weekday}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1">
            {days.map((cell) => {
              const selected = cell.iso === value
              const isToday = cell.iso === todayISO
              return (
                <button
                  key={cell.iso}
                  type="button"
                  disabled={cell.disabled}
                  onClick={() => select(cell.iso)}
                  className={cn(
                    'mx-auto flex size-9 cursor-pointer items-center justify-center rounded-lg text-sm transition-colors',
                    cell.outside
                      ? 'text-gray-400 dark:text-slate-600'
                      : 'text-slate-700 dark:text-slate-200',
                    !cell.disabled &&
                      !selected &&
                      'hover:bg-violet-100 hover:font-semibold hover:text-violet-900 dark:hover:bg-slate-800 dark:hover:text-slate-100',
                    selected &&
                      'bg-violet-600 font-semibold text-white hover:bg-violet-600 dark:text-white',
                    isToday &&
                      !selected &&
                      'ring-1 ring-violet-400 ring-inset dark:ring-violet-500/50',
                    cell.disabled &&
                      'cursor-not-allowed text-gray-300 hover:bg-transparent dark:text-slate-700',
                  )}
                >
                  {cell.day}
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-3 dark:border-slate-800">
            <button
              type="button"
              onClick={() => select('')}
              className="cursor-pointer text-sm font-medium text-gray-500 transition-colors hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-200"
            >
              {t('datePicker.clear')}
            </button>
            <button
              type="button"
              disabled={(!!min && todayISO < min) || (!!max && todayISO > max)}
              onClick={() => select(todayISO)}
              className="cursor-pointer text-sm font-medium text-violet-600 transition-colors hover:text-violet-800 disabled:cursor-not-allowed disabled:opacity-40 dark:text-violet-400 dark:hover:text-violet-300"
            >
              {t('datePicker.today')}
            </button>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
