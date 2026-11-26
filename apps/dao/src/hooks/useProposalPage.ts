import {useCallback, useEffect, useRef, useState} from 'react';
import {loadProposal, refreshProposal, reloadProposalAfterTx, type ProposalDeps, type ProposalLoad, type ProposalPageData} from '@/lib/proposal-loader';
import {useAsync, type AsyncValue} from './useAsync';

/** The chain is re-read this often while a proposal is in voting and the tab is visible. */
export const PROPOSAL_POLL_MS = 60_000;

export interface ProposalPage {
    load: AsyncValue<ProposalLoad>;
    /** The data to show: the polled copy once one has arrived, else the loaded one. */
    data: ProposalPageData | null;
    reload: () => void;
    /**
     * Re-reads the proposal from the chain in place (after a transaction) without leaving the page: 'ok' when
     * it was read, 'gone' when the chain no longer has it (the page then reloads into the archived view),
     * 'failed' when the chain could not be read (what is shown stays as it was).
     */
    refresh: () => Promise<'ok' | 'gone' | 'failed'>;
    /** Changes after every refresh: parts that read the wallet's own state key on it. */
    version: number;
}

/**
 * One proposal for its page. While it is in voting the chain's answer is polled in place (the page keeps
 * what it shows; a failed poll changes nothing) and the poll stops once it leaves voting.
 */
export function useProposalPage(deps: ProposalDeps, id: string, pollMs = PROPOSAL_POLL_MS): ProposalPage {
    const [reloads, setReloads] = useState(0);
    const key = `${id}:${reloads}`;
    const load = useAsync(key, () => loadProposal(deps, id));
    const [polled, setPolled] = useState<{key: string; data: ProposalPageData} | null>(null);

    const loaded = load.data?.state === 'ok' ? load.data.data : null;
    const data = polled && polled.key === key ? polled.data : loaded;

    const latest = useRef({data, deps, key});
    useEffect(() => {
        latest.current = {data, deps, key};
    });

    const live = !!data && data.model.status === 'VOTING' && !data.model.archived;
    useEffect(() => {
        if (!live) return;
        const timer = setInterval(() => {
            if (document.visibilityState !== 'visible') return;
            const {data: current, deps: currentDeps, key: currentKey} = latest.current;
            if (!current) return;
            refreshProposal(currentDeps, current).then((next) => {
                if (latest.current.key === currentKey) setPolled({key: currentKey, data: next});
            });
        }, pollMs);
        return () => clearInterval(timer);
    }, [live, pollMs]);

    const reload = useCallback(() => setReloads((n) => n + 1), []);
    const [version, setVersion] = useState(0);
    const refresh = useCallback(async (): Promise<'ok' | 'gone' | 'failed'> => {
        const {data: current, deps: currentDeps, key: currentKey} = latest.current;
        if (!current) return 'failed';
        try {
            const next = await reloadProposalAfterTx(currentDeps, current);
            if (latest.current.key !== currentKey) return 'ok';
            if (!next) {
                setReloads((n) => n + 1);
                return 'gone';
            }
            setPolled({key: currentKey, data: next});
            setVersion((n) => n + 1);
            return 'ok';
        } catch {
            return 'failed';
        }
    }, []);
    return {load, data, reload, refresh, version};
}
