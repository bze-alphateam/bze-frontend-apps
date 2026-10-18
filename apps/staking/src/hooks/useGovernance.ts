"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {
    getFinishedProposals, getGovParams, getOpenProposals, getProposalTally, getStakingPool,
    type GovParams, type GovProposal, type GovTally,
} from "@bze/bze-ui-kit";
import {isListed} from "@/lib/governance/proposal";

// The public governance data the list page shows: the gov params, the open
// proposals with their live tallies, the bonded tokens (for turnout) and the
// finished proposals page by page. Wallet-specific data (voting power, the
// user's vote) is layered on top by useVoter, keyed by the open proposals'
// ids, so this hook stays wallet-free.

/** The chain is kept light: tallies are re-read at most once a minute, only while the tab is visible. */
export const GOVERNANCE_POLL_MS = 60_000;

export interface OpenProposal {
    proposal: GovProposal;
    /** The live tally; null when the node didn't answer for this proposal. */
    tally: GovTally | null;
}

export interface GovernanceData {
    params: GovParams;
    open: OpenProposal[];
    /** Bonded tokens in ubze; "0" when the staking pool didn't answer. */
    bondedTokens: string;
    finished: GovProposal[];
}

const loadTallies = (proposals: GovProposal[]): Promise<OpenProposal[]> =>
    Promise.all(proposals.map(async (proposal) => ({
        proposal,
        tally: await getProposalTally(proposal.id).catch(() => null),
    })));

const byIdDesc = (a: GovProposal, b: GovProposal) => Number(b.id) - Number(a.id);

export function useGovernance() {
    const [data, setData] = useState<GovernanceData | undefined>();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<unknown>();
    const [nextKey, setNextKey] = useState<Uint8Array | null>(null);
    const [isLoadingOlder, setIsLoadingOlder] = useState(false);
    const [olderError, setOlderError] = useState(false);
    // Ignore answers from a load that a newer one replaced.
    const loadId = useRef(0);

    const load = useCallback(async () => {
        const id = ++loadId.current;
        setIsLoading(true);
        setError(undefined);
        try {
            const [params, openProposals, pool, finishedPage] = await Promise.all([
                getGovParams(),
                getOpenProposals(),
                getStakingPool(),
                getFinishedProposals(),
            ]);
            const open = await loadTallies(
                openProposals.filter((p) => p.status === "PROPOSAL_STATUS_VOTING_PERIOD").sort(byIdDesc)
            );
            if (id !== loadId.current) return;
            setData({
                params,
                open,
                bondedTokens: pool?.bonded_tokens ?? "0",
                finished: finishedPage.proposals.filter((p) => isListed(p.status)),
            });
            setNextKey(finishedPage.nextKey);
            setOlderError(false);
        } catch (e) {
            if (id !== loadId.current) return;
            console.error("failed to load governance data", e);
            setError(e);
        } finally {
            if (id === loadId.current) setIsLoading(false);
        }
    }, []);

    const loadOlder = useCallback(async () => {
        if (!nextKey || isLoadingOlder) return;
        setIsLoadingOlder(true);
        setOlderError(false);
        try {
            const page = await getFinishedProposals(nextKey);
            setData((current) => current && {
                ...current,
                finished: [...current.finished, ...page.proposals.filter((p) => isListed(p.status))],
            });
            setNextKey(page.nextKey);
        } catch (e) {
            console.error("failed to load older proposals", e);
            setOlderError(true);
        } finally {
            setIsLoadingOlder(false);
        }
    }, [nextKey, isLoadingOlder]);

    // Re-read the open proposals' tallies; a failed poll keeps the last ones.
    const openRef = useRef<OpenProposal[]>([]);
    useEffect(() => {
        openRef.current = data?.open ?? [];
    }, [data?.open]);

    const pollTallies = useCallback(async () => {
        const current = openRef.current.map((o) => o.proposal);
        if (current.length === 0) return;
        const id = loadId.current;
        const fresh = await loadTallies(current);
        if (id !== loadId.current) return;
        const byId = new Map(fresh.map((o) => [o.proposal.id, o.tally]));
        setData((prev) => prev && {
            ...prev,
            open: prev.open.map((o) => ({...o, tally: byId.get(o.proposal.id) ?? o.tally})),
        });
    }, []);

    useEffect(() => {
        // Initial load; `load` sets its state after the awaits.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        load();
    }, [load]);

    useEffect(() => {
        const timer = setInterval(() => {
            if (document.visibilityState === "visible") pollTallies();
        }, GOVERNANCE_POLL_MS);
        return () => clearInterval(timer);
    }, [pollTallies]);

    return {
        data,
        isLoading,
        error,
        reload: load,
        /** Re-read the open proposals' tallies (after a vote). */
        refreshTallies: pollTallies,
        loadOlder,
        hasOlder: nextKey !== null,
        isLoadingOlder,
        olderError,
    };
}
