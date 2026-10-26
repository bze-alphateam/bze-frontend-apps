'use client'

import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'

export interface ReturnTo {
    /** Internal path to go back to, e.g. `/manage/token?denom=…&tab=trading`. */
    href: string;
    /** What the path is, for "Back to <label>". */
    label: string;
}

const DEFAULT_LABEL = 'where you were'
const MAX_LABEL_LENGTH = 40

// Only same-site paths: "/x" but never "//host" (protocol-relative), never a backslash
// (browsers read "/\host" as "//host"), never control characters (stripped by browsers,
// so "/\t/host" would become "//host"), and the decoded form must pass the same checks.
function isSafePath(path: string): boolean {
    if (!path.startsWith('/') || path.startsWith('//')) return false
    if (path.includes('\\') || /[\u0000-\u001f\u007f]/.test(path)) return false
    return true
}

function parseReturn(path: string | null, label: string | null): ReturnTo | undefined {
    if (!path || !isSafePath(path)) return undefined
    let decoded: string
    try {
        decoded = decodeURIComponent(path)
    } catch {
        return undefined
    }
    if (!isSafePath(decoded)) return undefined

    const cleanLabel = (label ?? '').trim().slice(0, MAX_LABEL_LENGTH)
    return { href: path, label: cleanLabel || DEFAULT_LABEL }
}

/**
 * The validated `?return=` / `?returnLabel=` of the current page: where a form opened from
 * a token's workspace or a playbook sends the user back after signing. Reads search
 * params, so callers must render inside a <Suspense> boundary.
 */
export function useReturnTo(): ReturnTo | undefined {
    const searchParams = useSearchParams()
    const path = searchParams.get('return')
    const label = searchParams.get('returnLabel')
    return useMemo(() => parseReturn(path, label), [path, label])
}

/**
 * The way back after a form succeeded: a playbook's return path names its step (`step=`), and
 * `completed=1` tells the playbook that step is done. A back link (the form not submitted)
 * never adds it. Other return paths are left as they are.
 */
export function completedReturnHref(href: string): string {
    const query = href.split('?')[1] ?? ''
    if (!new URLSearchParams(query).has('step')) return href
    return `${href}&completed=1`
}

/** `href` with the return params appended (unchanged when there is nowhere to return to). */
export function withReturn(href: string, returnTo?: ReturnTo): string {
    if (!returnTo) return href
    const params = new URLSearchParams({ return: returnTo.href, returnLabel: returnTo.label })
    return `${href}${href.includes('?') ? '&' : '?'}${params.toString()}`
}
