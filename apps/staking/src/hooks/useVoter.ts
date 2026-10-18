"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {
    getDelegatorDelegations, getProposalVote, getValidators, valoperToAccountAddress,
    type GovVote,
} from "@bze/bze-ui-kit";
import {votingPower, type ValidatorStake, type VotingPower} from "@/lib/governance/voter";

// The connected wallet's governance data, layered on top of useGovernance and
// useProposal (which stay wallet-free): its voting power, and for each open
// proposal its own vote and its validators' votes. A validator votes from its
// own account, the operator address re-encoded as `bze1…`. Nothing is fetched
// without an address; `refresh` re-reads one proposal's vote after voting.

export interface ProposalVoter {
    power: VotingPower;
    /** The wallet's vote; null when it hasn't voted (or the vote didn't load). */
    vote: GovVote | null;
    /** The bonded validators the wallet stakes with, each with its vote (undefined when it didn't load). */
    validators: (ValidatorStake & {moniker: string; vote: GovVote | null | undefined})[];
}

interface VoterState {
    address: string;
    power: VotingPower;
    votes: Record<string, GovVote | null>;
    validatorVotes: Record<string, Record<string, GovVote | null | undefined>>;
}

const voteOrUndefined = (id: string, voter: string) => getProposalVote(id, voter).catch((e) => {
    console.error("failed to load vote", e);
    return undefined;
});

async function loadVotes(id: string, address: string, power: VotingPower) {
    const [vote, ...validatorVotes] = await Promise.all([
        voteOrUndefined(id, address),
        ...power.validators.map((s) => voteOrUndefined(id, valoperToAccountAddress(s.validator.operator_address))),
    ]);
    return {
        vote: vote ?? null,
        validators: Object.fromEntries(power.validators.map((s, i) => [s.validator.operator_address, validatorVotes[i]])),
    };
}

export function useVoter(address: string | undefined, proposalIds: string[]) {
    const [state, setState] = useState<VoterState | undefined>();
    const [isLoading, setIsLoading] = useState(false);
    // The address whose load failed; state for another address is ignored.
    const [failedFor, setFailedFor] = useState<string | null>(null);
    const loadId = useRef(0);
    const idsKey = proposalIds.join(",");

    const load = useCallback(async (voter: string, ids: string[]) => {
        const current = ++loadId.current;
        setIsLoading(true);
        setFailedFor(null);
        try {
            const [delegations, bonded] = await Promise.all([getDelegatorDelegations(voter), getValidators()]);
            // Both queries answer [] on failure; a live chain always has bonded validators.
            if (bonded.length === 0 && delegations.length > 0) throw new Error("no bonded validators");
            const power = votingPower(delegations, bonded);
            const loaded = await Promise.all(ids.map((id) => loadVotes(id, voter, power)));
            if (current !== loadId.current) return;
            setState({
                address: voter,
                power,
                votes: Object.fromEntries(ids.map((id, i) => [id, loaded[i].vote])),
                validatorVotes: Object.fromEntries(ids.map((id, i) => [id, loaded[i].validators])),
            });
        } catch (e) {
            if (current !== loadId.current) return;
            console.error("failed to load voter data", e);
            setFailedFor(voter);
        } finally {
            if (current === loadId.current) setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!address) {
            ++loadId.current;
            return;
        }
        // Loads the wallet data; `load` sets its state after the awaits.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        load(address, idsKey ? idsKey.split(",") : []);
    }, [address, idsKey, load]);

    /** Re-read the wallet's vote on one proposal (after a vote). */
    const refresh = useCallback(async (id: string) => {
        if (!address) return;
        const vote = await voteOrUndefined(id, address);
        if (vote === undefined) return;
        setState((prev) => prev && prev.address === address ? {...prev, votes: {...prev.votes, [id]: vote}} : prev);
    }, [address]);

    const voterFor = useCallback((id: string): ProposalVoter | undefined => {
        if (!state || state.address !== address || !(id in state.votes)) return undefined;
        const votes = state.validatorVotes[id] ?? {};
        return {
            power: state.power,
            vote: state.votes[id],
            validators: state.power.validators.map((s) => ({
                ...s,
                moniker: s.validator.description?.moniker || s.validator.operator_address,
                vote: votes[s.validator.operator_address],
            })),
        };
    }, [state, address]);

    return {
        power: state && state.address === address ? state.power : undefined,
        voterFor,
        isLoading: !!address && failedFor !== address && (isLoading || state?.address !== address),
        failed: !!address && failedFor === address,
        refresh,
    };
}
