"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {
    getGovParams, getProposalTally, getStakingPool,
    type GovParams, type GovProposal, type GovTally,
} from "@bze/bze-ui-kit";
import {loadProposal} from "@/query/proposals";
import {GOVERNANCE_POLL_MS} from "./useGovernance";

// One proposal for its page (from BZE Scan, else the chain; see
// query/proposals): the proposal, the gov params, the bonded tokens
// (for turnout) and its tally — live (re-read every minute while the tab is
// visible) during voting, the final one after. Deposit-period proposals are
// reported as not found, so the page never reveals them.

export interface ProposalData {
    proposal: GovProposal;
    params: GovParams;
    /** Bonded tokens in ubze; "0" when the staking pool didn't answer. */
    bondedTokens: string;
    /** Null when the live tally didn't answer. */
    tally: GovTally | null;
}

const isVoting = (p: GovProposal) => p.status === "PROPOSAL_STATUS_VOTING_PERIOD";

export function useProposal(id: string) {
    const [data, setData] = useState<ProposalData | undefined>();
    const [isLoading, setIsLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [error, setError] = useState<unknown>();
    // Ignore answers from a load that a newer one replaced.
    const loadId = useRef(0);

    const load = useCallback(async () => {
        const current = ++loadId.current;
        setIsLoading(true);
        setError(undefined);
        setNotFound(false);
        try {
            if (!/^\d+$/.test(id)) {
                setData(undefined);
                setNotFound(true);
                return;
            }
            const [proposal, params, pool] = await Promise.all([loadProposal(id), getGovParams(), getStakingPool()]);
            if (current !== loadId.current) return;
            if (!proposal || proposal.status === "PROPOSAL_STATUS_DEPOSIT_PERIOD") {
                setData(undefined);
                setNotFound(true);
                return;
            }
            const tally = isVoting(proposal)
                ? await getProposalTally(proposal.id).catch(() => proposal.final_tally_result ?? null)
                : (proposal.final_tally_result ?? null);
            if (current !== loadId.current) return;
            setData({proposal, params, bondedTokens: pool?.bonded_tokens ?? "0", tally});
        } catch (e) {
            if (current !== loadId.current) return;
            console.error("failed to load proposal", e);
            setError(e);
        } finally {
            if (current === loadId.current) setIsLoading(false);
        }
    }, [id]);

    useEffect(() => {
        // Initial load; `load` sets its state after the awaits.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        load();
    }, [load]);

    const voting = !!data && isVoting(data.proposal);
    const proposalId = data?.proposal.id;

    /** Re-read the live tally (the poll, and after a vote); a failed read keeps the last one. */
    const refreshTally = useCallback(async () => {
        if (!proposalId) return;
        const current = loadId.current;
        const tally = await getProposalTally(proposalId).catch(() => null);
        if (!tally || current !== loadId.current) return;
        setData((prev) => prev && prev.proposal.id === proposalId && isVoting(prev.proposal) ? {...prev, tally} : prev);
    }, [proposalId]);

    useEffect(() => {
        if (!voting) return;
        const timer = setInterval(() => {
            if (document.visibilityState === "visible") refreshTally();
        }, GOVERNANCE_POLL_MS);
        return () => clearInterval(timer);
    }, [voting, refreshTally]);

    return {data, isLoading, notFound, error, reload: load, refreshTally};
}
