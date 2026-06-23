import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'

import { useQueries } from './hooks'
import type { FocusEventHandler, MouseEventHandler } from 'react'
import type { RequestForQueries } from 'convex/react'

const DEFAULT_INTENT_PRELOAD_DELAY = 50

interface IntentPreloadLinkProps {
  onBlur: FocusEventHandler<HTMLAnchorElement>
  onFocus: FocusEventHandler<HTMLAnchorElement>
  onMouseEnter: MouseEventHandler<HTMLAnchorElement>
  onMouseLeave: MouseEventHandler<HTMLAnchorElement>
}

export interface IntentPreloadStore<TTarget extends string> {
  subscribe: (listener: () => void) => () => void
  getActiveTarget: () => TTarget | null
  begin: (target: TTarget) => void
  end: (target: TTarget) => void
  dispose: () => void
}

// The active target lives in a plain object, not React state, so updating it
// only notifies the preloader below — never the list component that owns the
// links. That keeps hovering between cards from re-rendering the whole list.
function createIntentPreloadStore<TTarget extends string>(
  delay: number,
): IntentPreloadStore<TTarget> {
  let activeTarget: TTarget | null = null
  let pendingTarget: TTarget | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  const listeners = new Set<() => void>()

  const emit = () => {
    for (const listener of listeners) listener()
  }

  const clearPending = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    pendingTarget = null
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getActiveTarget() {
      return activeTarget
    },
    begin(target) {
      if (activeTarget === target || pendingTarget === target) {
        return
      }
      clearPending()
      pendingTarget = target
      timer = setTimeout(() => {
        timer = null
        pendingTarget = null
        activeTarget = target
        emit()
      }, delay)
    },
    end(target) {
      if (pendingTarget === target) {
        clearPending()
      }
      if (activeTarget === target) {
        activeTarget = null
        emit()
      }
    },
    dispose() {
      clearPending()
      listeners.clear()
    },
  }
}

interface ConvexPreloaderProps<TTarget extends string> {
  store: IntentPreloadStore<TTarget>
  buildQueries: (target: TTarget) => RequestForQueries
}

// Warm the Convex queries for whichever destination currently has user intent.
// This component is the only thing that re-renders when the target changes.
export function ConvexPreloader<TTarget extends string>({
  store,
  buildQueries,
}: ConvexPreloaderProps<TTarget>) {
  const target = useSyncExternalStore(
    store.subscribe,
    store.getActiveTarget,
    store.getActiveTarget,
  )
  useQueries(target ? buildQueries(target) : {})
  return null
}

// Track at most one destination as the active preload target, switching only
// after sustained pointer or keyboard intent. Returns a stable store (read by
// ConvexPreloader) and stable link handlers (spread onto each card's link).
export function useIntentPreloadTarget<TTarget extends string>(
  delay = DEFAULT_INTENT_PRELOAD_DELAY,
) {
  const storeRef = useRef<IntentPreloadStore<TTarget> | null>(null)
  if (storeRef.current === null) {
    storeRef.current = createIntentPreloadStore<TTarget>(delay)
  }
  const store = storeRef.current

  useEffect(() => store.dispose, [store])

  const getIntentProps = useCallback(
    (target: TTarget): IntentPreloadLinkProps => ({
      onBlur: () => store.end(target),
      onFocus: () => store.begin(target),
      onMouseEnter: () => store.begin(target),
      onMouseLeave: () => store.end(target),
    }),
    [store],
  )

  return { store, getIntentProps }
}
