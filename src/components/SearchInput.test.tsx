// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SearchInput } from './SearchInput'

// Use a deterministic clock to verify search timing and cancellation
beforeEach(() => vi.useFakeTimers())

// Remove mounted inputs and restore the clock between cases
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// Protect immediate typing, navigation restoration, and delayed search cleanup
describe('SearchInput', () => {
  // An input method must finish composing before its text becomes a search
  it('waits for text composition to finish', () => {
    const onValueChange = vi.fn()
    render(<SearchInput value="" onValueChange={onValueChange} />)
    const input = screen.getByRole('textbox')
    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: 'አዲስ' } })
    act(() => vi.advanceTimersByTime(300))
    expect(onValueChange).not.toHaveBeenCalled()
    fireEvent.compositionEnd(input)
    act(() => vi.advanceTimersByTime(200))
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('አዲስ')
  })

  // Rapid typing must update the input immediately and publish only the final search
  it('keeps keystrokes local and commits after a pause', () => {
    const onValueChange = vi.fn()
    render(
      <SearchInput
        aria-label="Destination"
        value=""
        onValueChange={onValueChange}
      />,
    )
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Ad' } })
    act(() => vi.advanceTimersByTime(150))
    fireEvent.change(input, { target: { value: 'Addis' } })
    expect((input as HTMLInputElement).value).toBe('Addis')
    act(() => vi.advanceTimersByTime(199))
    expect(onValueChange).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('Addis')
  })

  // Browser history must supersede any uncommitted text without bouncing back later
  it('cancels pending edits when the external search changes', () => {
    const onValueChange = vi.fn()
    const { rerender } = render(
      <SearchInput value="Addis" onValueChange={onValueChange} />,
    )
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Gondar' },
    })
    rerender(<SearchInput value="Hawassa" onValueChange={onValueChange} />)
    expect(screen.getByRole<HTMLInputElement>('textbox').value).toBe(
      'Hawassa',
    )
    act(() => vi.advanceTimersByTime(300))
    expect(onValueChange).not.toHaveBeenCalled()
  })

  // Updated filter callbacks must not postpone typing or use stale route state
  it('uses the latest callback without restarting the delay', () => {
    const previous = vi.fn()
    const latest = vi.fn()
    const { rerender } = render(
      <SearchInput value="" onValueChange={previous} />,
    )
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Addis' },
    })
    act(() => vi.advanceTimersByTime(150))
    rerender(<SearchInput value="" onValueChange={latest} />)
    act(() => vi.advanceTimersByTime(50))
    expect(previous).not.toHaveBeenCalled()
    expect(latest).toHaveBeenCalledExactlyOnceWith('Addis')
  })

  // Leaving the page must not trigger a delayed navigation back to discovery
  it('cancels a pending search when unmounted', () => {
    const onValueChange = vi.fn()
    const { unmount } = render(
      <SearchInput value="" onValueChange={onValueChange} />,
    )
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Addis' },
    })
    unmount()
    act(() => vi.advanceTimersByTime(300))
    expect(onValueChange).not.toHaveBeenCalled()
  })
})
