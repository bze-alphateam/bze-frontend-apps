'use client'

import React, { createContext, useContext, useMemo, useSyncExternalStore } from 'react'

/** Entries older than this are dropped: the panel would only show a stale "waiting". */
export const PENDING_TX_TTL_MS = 30 * 60 * 1000
const STORAGE_KEY = 'factory:pending-tx'

export type PendingTxStatus = 'pending' | 'confirmed' | 'failed'

/** A wizard transaction between broadcast and the user reading its result. */
export interface PendingTx {
    /** The wizard page with its query: where the header pill leads back to. */
    href: string;
    hash: string;
    /** What it does, in a few words ("Create token HONEY"). */
    title: string;
    startedAt: number;
    /** What the wizard needs to draw its Done screen (serialisable). */
    doneInput?: unknown;
    status: PendingTxStatus;
    height?: number;
    /** When failed: the plain reason and the raw log. */
    reason?: string;
    details?: string;
    /** It was executed (and refused) in a block, so the network fee was spent. */
    feeSpent?: boolean;
}

/** Where the entries are kept between page loads (sessionStorage in the app). */
export interface PendingTxStorage {
    read(): string | null;
    write(value: string): void;
}

export interface PendingTxStore {
    subscribe(onChange: () => void): () => void;
    getSnapshot(): readonly PendingTx[];
    add(entry: Omit<PendingTx, 'status'>): void;
    /** Records the result of a stored hash; the entry stays until the wizard consumes it. */
    resolve(hash: string, result: Pick<PendingTx, 'status' | 'height' | 'reason' | 'details' | 'feeSpent'>): void;
    remove(hash: string): void;
}

const EMPTY: readonly PendingTx[] = []

function isEntry(e: unknown): e is PendingTx {
    const x = e as Partial<PendingTx> | null
    return Boolean(x) && typeof x?.href === 'string' && typeof x?.hash === 'string' && typeof x?.startedAt === 'number'
}

export const sessionPendingTxStorage: PendingTxStorage = {
    read() {
        try { return window.sessionStorage.getItem(STORAGE_KEY) } catch { return null }
    },
    write(value) {
        try { window.sessionStorage.setItem(STORAGE_KEY, value) } catch { /* private mode: memory only */ }
    },
}

/** The pending-transaction list over a storage, with expiry. */
export function createPendingTxStore(storage: PendingTxStorage, now: () => number = Date.now): PendingTxStore {
    const listeners = new Set<() => void>()
    let entries: readonly PendingTx[] | undefined

    const fresh = (list: readonly PendingTx[]) => list.filter(e => now() - e.startedAt < PENDING_TX_TTL_MS)

    const load = (): readonly PendingTx[] => {
        if (entries) return entries
        try {
            const parsed: unknown = JSON.parse(storage.read() ?? '[]')
            entries = Array.isArray(parsed) ? fresh(parsed.filter(isEntry)) : EMPTY
        } catch {
            entries = EMPTY
        }
        return entries
    }

    const commit = (next: readonly PendingTx[]) => {
        entries = fresh(next)
        storage.write(JSON.stringify(entries))
        listeners.forEach(l => l())
    }

    return {
        subscribe(onChange) {
            listeners.add(onChange)
            return () => { listeners.delete(onChange) }
        },
        getSnapshot() {
            const list = load()
            // Expire on read too, so a tab left open drops old entries.
            if (list.some(e => now() - e.startedAt >= PENDING_TX_TTL_MS)) {
                entries = fresh(list)
                storage.write(JSON.stringify(entries))
            }
            return entries ?? EMPTY
        },
        add(entry) {
            commit([...load().filter(e => e.hash !== entry.hash && e.href !== entry.href), { ...entry, status: 'pending' }])
        },
        resolve(hash, result) {
            if (!load().some(e => e.hash === hash)) return
            commit(load().map(e => (e.hash === hash ? { ...e, ...result } : e)))
        },
        remove(hash) {
            if (!load().some(e => e.hash === hash)) return
            commit(load().filter(e => e.hash !== hash))
        },
    }
}

const PendingTxContext = createContext<PendingTxStore | undefined>(undefined)

/**
 * Keeps the wizard transactions that were broadcast, so the header can show an "in progress"
 * pill on the nav item that owns the wizard and the wizard can show its panel again when the
 * user comes back. Mounted once in the app's providers.
 */
export function PendingTxProvider({ store, children }: { store?: PendingTxStore; children: React.ReactNode }) {
    const value = useMemo(() => store ?? createPendingTxStore(sessionPendingTxStorage), [store])
    return <PendingTxContext.Provider value={value}>{children}</PendingTxContext.Provider>
}

/** The store and its current entries (none on the server render). */
export function usePendingTx() {
    const store = useContext(PendingTxContext)
    if (!store) throw new Error('usePendingTx must be used within a PendingTxProvider')
    const entries = useSyncExternalStore(store.subscribe, store.getSnapshot, () => EMPTY)
    return { store, entries }
}
