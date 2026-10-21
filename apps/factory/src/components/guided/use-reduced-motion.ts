'use client'

import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function mediaQuery(): MediaQueryList | undefined {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
    return window.matchMedia(QUERY)
}

function subscribe(onChange: () => void) {
    const mq = mediaQuery()
    mq?.addEventListener?.('change', onChange)
    return () => mq?.removeEventListener?.('change', onChange)
}

/** True when the user asked the system for less motion: no slides, instant scrolling. */
export function usePrefersReducedMotion(): boolean {
    return useSyncExternalStore(subscribe, () => mediaQuery()?.matches ?? false, () => false)
}
