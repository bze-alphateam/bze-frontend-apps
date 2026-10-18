"use client";

import {useCallback, useEffect, useSyncExternalStore} from "react";
import {useChain} from "@interchain-kit/react";
import {WalletState} from "@interchain-kit/core";
import {
    getChainName, getDelegatorDelegations, getOpenProposals, getProposalVote, getValidators,
} from "@bze/bze-ui-kit";
import {proposalTitle} from "@/lib/governance/proposal";
import {votingPower} from "@/lib/governance/voter";
import type {OpenProposalsSummary, SummaryProposal} from "@/lib/governance/summary";

// The open proposals at a glance, for the nav badge and the dashboard banner:
// each one's title and end, and for a connected wallet its own vote and its
// voting power. Several components read it at once, so it lives in one
// module-wide store: one load per wallet per minute, shared by every consumer,
// re-read only while the tab is visible. A vote calls
// `invalidateOpenProposalsSummary()` so the badge and the banner follow at once.

/** The chain is kept light: the summary is re-read at most once a minute. */
export const SUMMARY_TTL_MS = 60_000;

interface Entry {
    /** The wallet address; "" without a connected wallet. */
    key: string;
    summary?: OpenProposalsSummary;
    failed: boolean;
}

let entry: Entry | null = null;
let inflight: {key: string; promise: Promise<void>} | null = null;
let fetchedAt = 0;
// Bumped by every load and invalidation, so an older answer never lands.
let generation = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

const byEndAsc = (a: SummaryProposal, b: SummaryProposal) =>
    new Date(a.votingEndTime).getTime() - new Date(b.votingEndTime).getTime();

async function fetchSummary(address: string): Promise<OpenProposalsSummary> {
    const open = (await getOpenProposals()).filter((p) => p.status === "PROPOSAL_STATUS_VOTING_PERIOD");
    const proposals: SummaryProposal[] = open.map((p) => ({
        id: p.id,
        title: proposalTitle(p),
        votingEndTime: p.voting_end_time ?? "",
        vote: null,
    }));
    if (!address) return {connected: false, proposals: proposals.sort(byEndAsc), power: null};

    const [delegations, bonded, votes] = await Promise.all([
        getDelegatorDelegations(address),
        getValidators(),
        // Throws on a failed lookup: a vote we can't read must not count as "not voted".
        Promise.all(proposals.map((p) => getProposalVote(p.id, address))),
    ]);
    // Both queries answer [] on failure; a live chain always has bonded validators.
    if (bonded.length === 0 && delegations.length > 0) throw new Error("no bonded validators");

    return {
        connected: true,
        proposals: proposals.map((p, i) => ({...p, vote: votes[i]})).sort(byEndAsc),
        power: votingPower(delegations, bonded).power,
    };
}

const emit = () => listeners.forEach((l) => l());

const set = (next: Entry) => {
    entry = next;
    emit();
};

const isVisible = () => typeof document === "undefined" || document.visibilityState === "visible";

// After each load, the next one is due in a minute; a hidden tab waits for `onVisible`.
function schedule() {
    clearTimeout(timer);
    timer = listeners.size > 0 ? setTimeout(() => {
        timer = undefined;
        if (entry && isVisible()) load(entry.key);
    }, SUMMARY_TTL_MS) : undefined;
}

function load(key: string): void {
    if (inflight?.key === key) return;
    const id = ++generation;
    if (entry?.key !== key) set({key, failed: false});
    const promise = fetchSummary(key).then(
        (summary) => {
            if (id !== generation) return;
            fetchedAt = Date.now();
            set({key, summary, failed: false});
        },
        (e) => {
            if (id !== generation) return;
            console.error("failed to load the open proposals summary", e);
            fetchedAt = Date.now();
            set({key, failed: true});
        },
    ).finally(() => {
        if (inflight?.promise !== promise) return;
        inflight = null;
        schedule();
    });
    inflight = {key, promise};
}

/** Load the summary for `key` unless a fresh one (or a load of it) is already there. */
function ensureFresh(key: string): void {
    if (inflight?.key === key) return;
    if (entry?.key === key && (entry.summary || entry.failed) && Date.now() - fetchedAt < SUMMARY_TTL_MS) return;
    load(key);
}

const onVisible = () => {
    if (entry && isVisible()) ensureFresh(entry.key);
};

function subscribe(listener: () => void) {
    listeners.add(listener);
    if (listeners.size === 1) document.addEventListener("visibilitychange", onVisible);
    return () => {
        listeners.delete(listener);
        if (listeners.size > 0) return;
        document.removeEventListener("visibilitychange", onVisible);
        clearTimeout(timer);
        timer = undefined;
    };
}

/** Drop the cached summary (after a vote); mounted consumers re-read it at once. */
export function invalidateOpenProposalsSummary(): void {
    generation++;
    inflight = null;
    fetchedAt = 0;
    if (entry && listeners.size > 0) load(entry.key);
}

export function useOpenProposalsSummary() {
    const {address, status} = useChain(getChainName());
    const key = status === WalletState.Connected && address ? address : "";
    const current = useSyncExternalStore(subscribe, () => entry, () => null);

    useEffect(() => {
        if (isVisible()) ensureFresh(key);
    }, [key]);

    const invalidate = useCallback(() => invalidateOpenProposalsSummary(), []);
    const mine = current?.key === key ? current : null;

    return {
        /** Undefined until loaded, and when the load failed. */
        summary: mine?.summary,
        isLoading: !mine || (!mine.summary && !mine.failed),
        failed: !!mine?.failed,
        invalidate,
    };
}
