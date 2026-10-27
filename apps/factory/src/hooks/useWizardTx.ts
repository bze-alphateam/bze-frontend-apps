'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import type { TxFailureDetails } from '@bze/bze-ui-kit'
import { getSettings, prettyError } from '@bze/bze-ui-kit'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import { PendingTx, usePendingTx } from '@/contexts/pending-tx'
import { TxReader, checkTxStatus, restTxReader } from '@/lib/tx-lookup'
import type { TxPanelError, TxPanelProps } from '@/components/guided/tx-panel'

type Msgs = Parameters<ReturnType<typeof useFactoryTx>['tx']>[0]

/** No result this long after broadcast: "Taking longer than usual". */
export const SLOW_AFTER_MS = 60_000
/** While waiting for a block, the hash is looked up this often. */
export const WATCH_EVERY_MS = 10_000

export interface WizardTxDone<D> {
    /** What `submit` was given (also after a page reload, from the stored entry). */
    input: D | undefined;
    hash: string;
    height?: number;
}

export interface WizardTxOptions<D> {
    /** What the transaction does, in a few words ("Create token HONEY"). */
    title: string;
    /** Continue on Confirmed: draw the Done screen. */
    onDone: (done: WizardTxDone<D>) => void;
    /** Edit answers on Declined: back to the Review step. */
    onEdit?: () => void;
    /** The wizard page with its query. Default: the current one. */
    href?: string;
    /** Where hashes are looked up. Default: the chain's REST from the settings. */
    reader?: TxReader;
}

/** Outcomes before anything was broadcast: they never reach the pending store. */
type Local<D> =
    | { phase: 'idle' }
    | { phase: 'confirm'; input: D | undefined }
    | { phase: 'declined'; input: D | undefined }
    | { phase: 'failed'; input: D | undefined; error: TxPanelError }

function useCurrentHref(): string {
    const pathname = usePathname()
    const params = useSearchParams()
    const query = params?.toString() ?? ''
    return query ? `${pathname}?${query}` : (pathname ?? '')
}

function failedPanel(entry: PendingTx): TxPanelError {
    return { reason: entry.reason ?? 'The chain refused this transaction.', details: entry.details, feeSpent: entry.feeSpent }
}

/**
 * True from the moment this wizard's transaction is broadcast until Continue, Retry or Edit
 * clears it. Pass the same `href` as to `useWizardTx` when it gets one.
 */
export function useWizardTxBroadcast(href?: string): boolean {
    const { entries } = usePendingTx()
    const currentHref = useCurrentHref()
    const target = href ?? currentHref
    return entries.some(e => e.href === target)
}

/**
 * The wizard's transaction: signs `buildMsgs()` through `useFactoryTx` (gas pre-flight kept,
 * toasts off) and drives the TxPanel's six states. Once broadcast, the hash goes to the
 * PendingTxProvider, so the header shows the "in progress" pill and the panel comes back
 * after the user leaves and returns. Pre-broadcast outcomes (wallet confirm, declined, a
 * refusal before the wallet opened) stay local.
 *
 * `panelProps` is undefined while nothing is in flight: the page then shows its Review step.
 */
export function useWizardTx<D = unknown>(buildMsgs: () => Msgs | undefined, options: WizardTxOptions<D>) {
    const { title, onDone, onEdit, reader: injectedReader } = options
    const { tx } = useFactoryTx()
    const { store, entries } = usePendingTx()
    const currentHref = useCurrentHref()
    const href = options.href ?? currentHref
    const reader = useMemo(() => injectedReader ?? restTxReader(getSettings().endpoints.restEndpoint), [injectedReader])

    const [local, setLocal] = useState<Local<D>>({ phase: 'idle' })
    // Slow = the 60 s passed for this hash; waitFrom restarts the 60 s after "Keep waiting".
    const [slowHash, setSlowHash] = useState<string | undefined>(undefined)
    const [waitFrom, setWaitFrom] = useState<{ hash: string; at: number } | undefined>(undefined)
    const [checking, setChecking] = useState(false)

    const entry = local.phase === 'idle' ? entries.find(e => e.href === href) : undefined
    const watching = entry?.status === 'pending'
    const hash = entry?.hash

    const submit = useCallback((input?: D) => {
        const msgs = buildMsgs()
        if (!msgs) return
        setLocal({ phase: 'confirm', input })
        let broadcast: string | undefined

        void tx(msgs, {
            toasts: false,
            onBroadcast: (txHash) => {
                broadcast = txHash
                store.add({ href, hash: txHash, title, startedAt: Date.now(), doneInput: input })
                setLocal({ phase: 'idle' })
            },
            onSuccess: (res) => {
                store.resolve(broadcast ?? res.txhash, { status: 'confirmed', height: res.height })
            },
            onFailure: (reason: string, details?: TxFailureDetails) => {
                const txHash = broadcast ?? details?.txHash
                // The wait gave up but the tx may still land: keep watching the hash.
                if (details?.stage === 'timeout') return
                if (txHash) {
                    store.resolve(txHash, {
                        status: 'failed',
                        reason,
                        details: details?.rawLog,
                        // A code means it was executed in a block, which charges the network fee.
                        feeSpent: details?.code !== undefined,
                    })
                    return
                }
                // Nothing was broadcast: the wallet didn't sign it, or a check refused it first.
                setLocal(details?.stage === 'sign'
                    ? { phase: 'declined', input }
                    : { phase: 'failed', input, error: { reason } })
            },
        }).then((ok) => {
            // A refusal that reported nothing (should not happen): never leave "Confirm in your wallet" up.
            if (!ok) setLocal(l => l.phase === 'confirm' ? { phase: 'failed', input, error: { reason: 'The transaction could not be sent. Please try again.' } } : l)
        })
    }, [buildMsgs, tx, store, href, title])

    // The 60 s window of a broadcast hash.
    useEffect(() => {
        if (!watching || !entry || slowHash === entry.hash) return
        const from = waitFrom?.hash === entry.hash ? waitFrom.at : entry.startedAt
        const timer = setTimeout(() => setSlowHash(entry.hash), Math.max(0, from + SLOW_AFTER_MS - Date.now()))
        return () => clearTimeout(timer)
    }, [watching, entry, slowHash, waitFrom])

    // Look the hash up right away (a returning user) and then every 10 s until the 60 s pass.
    const isSlow = watching && slowHash === hash
    useEffect(() => {
        if (!watching || !hash) return
        let stopped = false
        const look = async () => {
            const check = await checkTxStatus(reader, hash)
            if (stopped) return
            if (check.result === 'confirmed') store.resolve(hash, { status: 'confirmed', height: check.height })
            if (check.result === 'failed') {
                store.resolve(hash, { status: 'failed', reason: prettyError(check.rawLog) ?? 'The chain refused this transaction.', details: check.rawLog, feeSpent: true })
            }
        }
        void look()
        const timer = isSlow ? undefined : setInterval(() => void look(), WATCH_EVERY_MS)
        return () => {
            stopped = true
            if (timer) clearInterval(timer)
        }
    }, [watching, hash, isSlow, reader, store])

    const checkStatus = useCallback(async () => {
        if (!hash) return
        setChecking(true)
        const check = await checkTxStatus(reader, hash)
        if (check.result === 'confirmed') store.resolve(hash, { status: 'confirmed', height: check.height })
        if (check.result === 'failed') {
            store.resolve(hash, { status: 'failed', reason: prettyError(check.rawLog) ?? 'The chain refused this transaction.', details: check.rawLog, feeSpent: true })
        }
        // Not found (or the node is unreachable): still "Taking longer".
        setChecking(false)
    }, [hash, reader, store])

    const keepWaiting = useCallback(() => {
        if (!hash) return
        setWaitFrom({ hash, at: Date.now() })
        setSlowHash(undefined)
    }, [hash])

    const input = local.phase === 'idle' ? (entry?.doneInput as D | undefined) : local.input
    const clear = useCallback(() => {
        if (hash) store.remove(hash)
        setLocal({ phase: 'idle' })
    }, [hash, store])

    const retry = useCallback(() => {
        clear()
        submit(input)
    }, [clear, submit, input])

    const edit = useCallback(() => {
        clear()
        onEdit?.()
    }, [clear, onEdit])

    const cont = useCallback(() => {
        if (!entry) return
        onDone({ input: entry.doneInput as D | undefined, hash: entry.hash, height: entry.height })
        store.remove(entry.hash)
    }, [entry, onDone, store])

    const base = { onRetry: retry, onEdit: edit, onContinue: cont, onCheckStatus: checkStatus, onKeepWaiting: keepWaiting }
    let panelProps: TxPanelProps | undefined
    if (local.phase === 'confirm') panelProps = { ...base, status: 'confirm' }
    else if (local.phase === 'declined') panelProps = { ...base, status: 'declined' }
    else if (local.phase === 'failed') panelProps = { ...base, status: 'failed', error: local.error }
    else if (entry?.status === 'confirmed') panelProps = { ...base, status: 'confirmed', hash: entry.hash, height: entry.height }
    else if (entry?.status === 'failed') panelProps = { ...base, status: 'failed', hash: entry.hash, error: failedPanel(entry) }
    else if (entry) panelProps = { ...base, status: isSlow ? 'slow' : 'submitted', hash: entry.hash, checking }

    return { submit, panelProps }
}
