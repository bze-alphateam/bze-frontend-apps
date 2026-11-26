import {draftKey, type DraftStorage} from './draft';
import {proposalIdFromTx} from './submit-result';

// The transaction a submit sent whose result was not seen (a confirmation timeout). It is remembered per DAO
// so a reload cannot turn into a second submit: the page keeps submit locked, shows the hash and asks the node.

const VERSION = 1;
const HASH = /^[0-9A-Fa-f]{64}$/;

export const pendingKey = (daoId: string): string => `${draftKey(daoId)}:pending`;

/** A transaction whose result was not seen, as stored: its hash, and what it was when the page knows (`kind`). */
export interface PendingRecord {
    hash: string;
    kind: string | null;
}

/** Remembers an unconfirmed transaction under `key`; storage that throws loses the memory only, the lock still holds in this page. */
export function savePendingAt(storage: DraftStorage | null, key: string, hash: string, kind?: string): void {
    try {
        storage?.setItem(key, JSON.stringify({v: VERSION, hash, ...(kind ? {kind} : {})}));
    } catch {
        // the lock still holds in this page
    }
}

export function clearPendingAt(storage: DraftStorage | null, key: string): void {
    try {
        storage?.removeItem(key);
    } catch {
        // nothing to clear
    }
}

/** The unconfirmed transaction stored under `key`; null when there is none or the entry is not a valid record. */
export function loadPendingAt(storage: DraftStorage | null, key: string): PendingRecord | null {
    try {
        const raw = storage?.getItem(key);
        if (!raw) return null;
        const data: unknown = JSON.parse(raw);
        if (typeof data !== 'object' || data === null) return null;
        const {v, hash, kind} = data as {v?: unknown; hash?: unknown; kind?: unknown};
        return v === VERSION && typeof hash === 'string' && HASH.test(hash) ? {hash, kind: typeof kind === 'string' ? kind : null} : null;
    } catch {
        return null;
    }
}

export const savePending = (storage: DraftStorage | null, daoId: string, hash: string): void => savePendingAt(storage, pendingKey(daoId), hash);

export const clearPending = (storage: DraftStorage | null, daoId: string): void => clearPendingAt(storage, pendingKey(daoId));

/** The hash of an unconfirmed submit for this DAO; null when there is none or the entry is not a valid record. */
export const loadPending = (storage: DraftStorage | null, daoId: string): string | null => loadPendingAt(storage, pendingKey(daoId))?.hash ?? null;

/** Looks the events of a transaction up by hash (the node's REST gateway). */
export type FetchTxEvents = (txHash: string) => Promise<unknown>;

/**
 * The id of the proposal a transaction created: from the response's own events, else from the
 * transaction as the node stored it. Null when neither names it.
 */
export async function readProposalId(response: object, txHash: string, fetchTxEvents: FetchTxEvents): Promise<string | null> {
    const own = proposalIdFromTx(response);
    if (own) return own;
    try {
        return proposalIdFromTx({events: await fetchTxEvents(txHash)});
    } catch {
        return null;
    }
}
