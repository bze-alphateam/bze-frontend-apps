import type {ActionKind} from '@/hooks/useActionFlow';
import type {DraftStorage} from '../propose/draft';
import {clearPendingAt, loadPendingAt, savePendingAt} from '../propose/pending';

// The console transaction whose result was not seen (a confirmation timeout, or a reload while it was in the
// block): remembered per DAO and wallet so a reload cannot turn into a second send. A resend of a payment pays twice.

export const adminPendingKey = (daoId: string, wallet: string): string => `bze-dao:admin-pending:${daoId}:${wallet.toLowerCase()}`;

const KINDS: readonly ActionKind[] = ['admin-execute', 'nominate', 'withdraw', 'hand-over', 'accept'];

export function saveAdminPending(storage: DraftStorage | null, daoId: string, wallet: string, hash: string, kind: ActionKind): void {
    savePendingAt(storage, adminPendingKey(daoId, wallet), hash, kind);
}

export function clearAdminPending(storage: DraftStorage | null, daoId: string, wallet: string): void {
    clearPendingAt(storage, adminPendingKey(daoId, wallet));
}

/** The stored transaction, with its kind checked against the console's own (an unknown kind is read as an admin execute: judged by its hash). */
export function loadAdminPending(storage: DraftStorage | null, daoId: string, wallet: string): {hash: string; kind: ActionKind} | null {
    const record = loadPendingAt(storage, adminPendingKey(daoId, wallet));
    if (!record) return null;
    return {hash: record.hash, kind: KINDS.find((k) => k === record.kind) ?? 'admin-execute'};
}
