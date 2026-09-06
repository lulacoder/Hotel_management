import { useEffect, useEffectEvent, useState } from 'react'
import type { ComponentProps } from 'react'

interface SearchInputProps extends Omit<
  ComponentProps<'input'>,
  'value' | 'onChange' | 'onCompositionStart' | 'onCompositionEnd'
> {
  value: string
  onValueChange: (value: string) => void
}

// Keep typing local so result filtering and navigation wait until the user pauses
export function SearchInput({
  value,
  onValueChange,
  ...props
}: SearchInputProps) {
  const [draft, setDraft] = useState(value)
  const [previousValue, setPreviousValue] = useState(value)
  const [isComposing, setIsComposing] = useState(false)

  // Restore the input when browser navigation or another control changes the search
  if (previousValue !== value) {
    setPreviousValue(value)
    setDraft(value)
  }

  // Use the latest route callback without restarting the delay on unrelated renders
  const commit = useEffectEvent((nextValue: string) => onValueChange(nextValue))

  // Cancel superseded searches and prevent a pending search from firing after leaving
  useEffect(() => {
    if (isComposing || draft === value) return
    // Publish only the final text in a burst of keystrokes
    const timer = window.setTimeout(() => commit(draft), 200)
    // Cancel the pending search before the next edit or unmount
    return () => window.clearTimeout(timer)
  }, [draft, value, isComposing])

  // Update only this input while the user types
  return (
    <input
      {...props}
      value={draft}
      onCompositionStart={() => setIsComposing(true)}
      onCompositionEnd={() => setIsComposing(false)}
      onChange={(event) => setDraft(event.target.value)}
    />
  )
}
