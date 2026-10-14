import BigNumber from 'bignumber.js'
import {
    getFromLocalStorage,
    prettyAmount,
    removeFromLocalStorage,
    setInLocalStorage,
    uAmountToBigNumberAmount,
} from '@bze/bze-ui-kit'
import { MULTISEND_BATCH_SIZE, Recipient } from '@/lib/multisend'

/**
 * A long list is sent as several MsgMultiSend transactions ("batches"), signed one per click.
 * The run record is kept in the browser so a stopped or interrupted run resumes without
 * paying anyone twice:
 *
 *   pending ──sign──▶ sending ──included──▶ sent (final)
 *      ▲                 │
 *      └──rejected / failed result (confirmed on chain)
 *                        │
 *                        └──unclear (timeout, page closed)──▶ unknown ──chain check──▶ sent | pending | unknown (not found)
 *
 * An `unknown` batch is only sent again after the chain check could not find it, and only on
 * an explicit click.
 */

export type BatchStatus = 'pending' | 'sending' | 'sent' | 'unknown'

/** One planned transaction: up to MULTISEND_BATCH_SIZE outputs, in list order. */
export interface Batch {
    /** 1-based. */
    id: number;
    outputs: Recipient[];
}

export interface RunBatch {
    id: number;
    count: number;
    /** Sum of the outputs, base units. */
    total: string;
    status: BatchStatus;
    txHash?: string;
    /** The wallet that signed it, for the chain check. */
    sender?: string;
    /** `unknown` only: the chain check ran and found nothing. */
    notFound?: boolean;
}

export interface MultiSendRun {
    fingerprint: string;
    denom: string;
    batches: RunBatch[];
    /** Unix ms. */
    startedAt: number;
}

export function planBatches(ready: ReadonlyArray<Recipient>, size: number = MULTISEND_BATCH_SIZE): Batch[] {
    const batches: Batch[] = []
    for (let i = 0; i < ready.length; i += size) {
        batches.push({ id: batches.length + 1, outputs: ready.slice(i, i + size) })
    }
    return batches
}

/** SHA-256 (hex) of the token and the exact list: same wallets, amounts and order. */
export async function listFingerprint(denom: string, ready: ReadonlyArray<Recipient>): Promise<string> {
    const json = JSON.stringify({ denom, ready: ready.map(r => [r.address, r.amount]) })
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json))
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
}

const sumOf = (outputs: ReadonlyArray<Recipient>) =>
    outputs.reduce((sum, r) => sum.plus(r.amount), new BigNumber(0)).toFixed(0)

export function startRun(fingerprint: string, denom: string, batches: ReadonlyArray<Batch>, now: number = Date.now()): MultiSendRun {
    return {
        fingerprint,
        denom,
        startedAt: now,
        batches: batches.map(b => ({ id: b.id, count: b.outputs.length, total: sumOf(b.outputs), status: 'pending' })),
    }
}

/** The first batch still to send, or undefined. */
export function nextBatch(run: MultiSendRun): RunBatch | undefined {
    return run.batches.find(b => b.status === 'pending')
}

export const sentCount = (run: MultiSendRun) => run.batches.filter(b => b.status === 'sent').length
export const isRunDone = (run: MultiSendRun) => run.batches.every(b => b.status === 'sent')

/** A batch may be signed when it is pending, or unknown after the chain check found nothing. */
export function canSendBatch(batch: RunBatch): boolean {
    return batch.status === 'pending' || (batch.status === 'unknown' && batch.notFound === true)
}

function update(run: MultiSendRun, id: number, change: (b: RunBatch) => RunBatch): MultiSendRun {
    return {
        ...run,
        // A sent batch is final: its wallets are never paid again in this run.
        batches: run.batches.map(b => (b.id === id && b.status !== 'sent' ? change(b) : b)),
    }
}

/** About to sign. Refused (run unchanged) unless `canSendBatch`. */
export function markSending(run: MultiSendRun, id: number, sender: string): MultiSendRun {
    return update(run, id, b => (canSendBatch(b) ? { id: b.id, count: b.count, total: b.total, status: 'sending', sender } : b))
}

/** Broadcast: the hash is known before inclusion. */
export function markBroadcast(run: MultiSendRun, id: number, txHash: string): MultiSendRun {
    return update(run, id, b => (b.status === 'sending' ? { ...b, txHash } : b))
}

export function markSent(run: MultiSendRun, id: number, txHash: string): MultiSendRun {
    return update(run, id, b => ({ ...b, status: 'sent', txHash, notFound: undefined }))
}

/** Nothing reached the chain (rejected in the wallet), or the chain confirmed it failed. */
export function markPending(run: MultiSendRun, id: number): MultiSendRun {
    return update(run, id, b => ({ id: b.id, count: b.count, total: b.total, status: 'pending' }))
}

export function markUnknown(run: MultiSendRun, id: number, notFound: boolean = false): MultiSendRun {
    return update(run, id, b => ({ ...b, status: 'unknown', notFound: notFound || undefined }))
}

/** On load: a batch still `sending` was interrupted (page closed), so its outcome is unclear. */
export function settleInterrupted(run: MultiSendRun): MultiSendRun {
    return { ...run, batches: run.batches.map(b => (b.status === 'sending' ? { ...b, status: 'unknown' } : b)) }
}

/**
 * How a stored run relates to the list on screen: none stored, the same list (resume), or a
 * changed list (a new run needs a confirmation). 'checking' while the fingerprint is computed.
 */
export type ResumeState = 'none' | 'checking' | 'same' | 'changed'

export function resumeState(run: MultiSendRun | undefined, fingerprint: string | undefined): ResumeState {
    if (!run) return 'none'
    if (fingerprint === undefined) return 'checking'
    return run.fingerprint === fingerprint ? 'same' : 'changed'
}

const REPORT_STATUS: Record<BatchStatus, string> = {
    sent: 'sent',
    pending: 'not sent',
    sending: 'check',
    unknown: 'check',
}

/** `address,amount,ticker,status,tx_hash`, one line per wallet, amounts in display units. */
export function reportCsv(run: MultiSendRun, batches: ReadonlyArray<Batch>, decimals: number, ticker: string): string {
    const byId = new Map(run.batches.map(b => [b.id, b]))
    const lines = ['address,amount,ticker,status,tx_hash']
    for (const batch of batches) {
        const state = byId.get(batch.id)
        const status = state ? REPORT_STATUS[state.status] : 'not sent'
        const hash = state?.status === 'sent' ? state.txHash ?? '' : ''
        for (const r of batch.outputs) {
            const amount = uAmountToBigNumberAmount(r.amount, decimals).toFixed()
            lines.push([r.address, amount, ticker, status, hash].join(','))
        }
    }
    return lines.join('\n') + '\n'
}

/** E.g. "100 wallets · 250 TOK". */
export function batchLabel(batch: RunBatch, decimals: number, ticker: string): string {
    return `${batch.count} wallets · ${prettyAmount(uAmountToBigNumberAmount(batch.total, decimals))} ${ticker}`
}

export const MULTISEND_RUN_KEY = 'factory_multisend_run'
export const MULTISEND_RUN_TTL = 30 * 24 * 60 * 60

const STATUSES: ReadonlyArray<BatchStatus> = ['pending', 'sending', 'sent', 'unknown']

function readBatch(raw: unknown): RunBatch | undefined {
    if (!raw || typeof raw !== 'object') return undefined
    const b = raw as Record<string, unknown>
    if (typeof b.id !== 'number' || typeof b.count !== 'number' || typeof b.total !== 'string') return undefined
    if (!STATUSES.includes(b.status as BatchStatus)) return undefined
    return {
        id: b.id,
        count: b.count,
        total: b.total,
        status: b.status as BatchStatus,
        ...(typeof b.txHash === 'string' ? { txHash: b.txHash } : {}),
        ...(typeof b.sender === 'string' ? { sender: b.sender } : {}),
        ...(b.notFound === true ? { notFound: true } : {}),
    }
}

/** The stored run, or undefined when there is none (or it can't be read). */
export function loadMultiSendRun(): MultiSendRun | undefined {
    const raw = getFromLocalStorage(MULTISEND_RUN_KEY)
    if (!raw) return undefined
    try {
        const parsed = JSON.parse(raw) as Record<string, unknown>
        if (typeof parsed.fingerprint !== 'string' || typeof parsed.denom !== 'string' || !Array.isArray(parsed.batches)) {
            return undefined
        }
        const batches = parsed.batches.map(readBatch)
        if (batches.some(b => b === undefined)) return undefined
        return {
            fingerprint: parsed.fingerprint,
            denom: parsed.denom,
            batches: batches as RunBatch[],
            startedAt: typeof parsed.startedAt === 'number' ? parsed.startedAt : 0,
        }
    } catch {
        return undefined
    }
}

/** One run at a time: saving replaces the stored one. */
export function saveMultiSendRun(run: MultiSendRun): void {
    setInLocalStorage(MULTISEND_RUN_KEY, JSON.stringify(run), MULTISEND_RUN_TTL)
}

export function clearMultiSendRun(): void {
    removeFromLocalStorage(MULTISEND_RUN_KEY)
}
