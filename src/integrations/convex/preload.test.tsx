// @vitest-environment jsdom
import { useSyncExternalStore } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useIntentPreloadTarget } from './preload'

function IntentPreloadHarness() {
  const { store, getIntentProps } = useIntentPreloadTarget<
    'hotel-1' | 'hotel-2'
  >()
  const activeTarget = useSyncExternalStore(
    store.subscribe,
    store.getActiveTarget,
    store.getActiveTarget,
  )

  return (
    <>
      <a href="/hotel-1" {...getIntentProps('hotel-1')}>
        Hotel one
      </a>
      <a href="/hotel-2" {...getIntentProps('hotel-2')}>
        Hotel two
      </a>
      <output aria-label="active preload">{activeTarget ?? 'none'}</output>
    </>
  )
}

describe('useIntentPreloadTarget', () => {
  beforeEach(() => vi.useFakeTimers())

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('waits for sustained hover intent and deactivates on leave', () => {
    render(<IntentPreloadHarness />)
    const link = screen.getByRole('link', { name: 'Hotel one' })

    fireEvent.mouseEnter(link)
    act(() => vi.advanceTimersByTime(49))
    expect(screen.getByLabelText('active preload').textContent).toBe('none')

    act(() => vi.advanceTimersByTime(1))
    expect(screen.getByLabelText('active preload').textContent).toBe('hotel-1')

    fireEvent.mouseLeave(link)
    expect(screen.getByLabelText('active preload').textContent).toBe('none')
  })

  it('cancels brief hover intent before the preload starts', () => {
    render(<IntentPreloadHarness />)
    const link = screen.getByRole('link', { name: 'Hotel one' })

    fireEvent.mouseEnter(link)
    act(() => vi.advanceTimersByTime(25))
    fireEvent.mouseLeave(link)
    act(() => vi.advanceTimersByTime(50))

    expect(screen.getByLabelText('active preload').textContent).toBe('none')
  })

  it('supports keyboard intent and releases it on blur', () => {
    render(<IntentPreloadHarness />)
    const link = screen.getByRole('link', { name: 'Hotel two' })

    fireEvent.focus(link)
    act(() => vi.advanceTimersByTime(50))
    expect(screen.getByLabelText('active preload').textContent).toBe('hotel-2')

    fireEvent.blur(link)
    expect(screen.getByLabelText('active preload').textContent).toBe('none')
  })

  it('clears delayed work when its list unmounts', () => {
    const view = render(<IntentPreloadHarness />)

    fireEvent.mouseEnter(screen.getByRole('link', { name: 'Hotel one' }))
    expect(vi.getTimerCount()).toBe(1)

    view.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
