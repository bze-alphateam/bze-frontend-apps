'use client';

import {useState} from 'react';
import {
    buildCancelDaoProposalMsg, buildCleanupDaoProposalMsg, buildDaoVoteMsg, buildSettleDaoProposalMsg,
    getChainNativeAssetDenom, getTxLanding, useBalance, useSDKTx, useSettings,
    type TxLanding,
} from '@bze/bze-ui-kit';
import type {EncodeObject} from '@bze/bzejs/types';
import {useActionFlow, type ActionFlow, type ActionKind, type FlowState} from '@/hooks/useActionFlow';
import type {AsyncValue} from '@/hooks/useAsync';
import {sendDaoTx} from '@/lib/dao-tx';
import {blockedReason, gasState, proposalActions, type GasState, type MyVoteState, type ProposalActionsView, type VoteChoice} from '@/lib/proposal-actions';
import type {MyVote, ProposalDeps, ProposalPageData} from '@/lib/proposal-loader';

/** The dialog that is open: the vote (with the option picked on the page), vote and settle, settle / retry / mark expired, cancel, clean up. */
export type ProposalDialog =
    | {kind: 'vote'; option: VoteChoice | null}
    | {kind: 'vote-settle'}
    | {kind: 'settle'}
    | {kind: 'cancel'}
    | {kind: 'cleanup'};

/** Everything the page's action parts (Your vote, the state card, the dialogs) draw from: one flow, one dialog. */
export interface ProposalActions {
    view: ProposalActionsView;
    /** Why nothing can be signed now; empty when the wallet can sign. */
    blocked: string;
    gas: GasState;
    wallet: string | null;
    flow: ActionFlow;
    /** The wallet's progress text while a transaction is signed and sent. */
    progress: string;
    dialog: ProposalDialog | null;
    /** The flow's state when the dialog opened: the dialog shows its form until the flow moves on from it. */
    stateAtOpen: FlowState | null;
    open: (dialog: ProposalDialog) => void;
    close: () => void;
    vote: (option: VoteChoice) => void;
    voteAndSettle: () => void;
    settle: () => void;
    cancel: () => void;
    cleanup: () => void;
}

export interface ProposalActionsInput {
    deps: ProposalDeps;
    data: ProposalPageData;
    wallet: string | null;
    nowMs: number;
    /** The wallet's ballot and eligible weight, read once by the page. */
    mine: AsyncValue<MyVote>;
    /** Re-reads the proposal in place after a transaction. */
    refresh: () => Promise<'ok' | 'gone' | 'failed'>;
    /** What the proposal shows now (status and tally), read fresh after a re-read. */
    fingerprint: () => string;
    /** Where a broadcast transaction stands on the node (ui-kit's `getTxLanding` by default). */
    lookupTx?: (hash: string) => Promise<TxLanding>;
}

const myVoteState = (wallet: string | null, mine: AsyncValue<MyVote>): MyVoteState => {
    if (!wallet) return {state: 'ok', ballot: null, eligibleWeight: null};
    if (mine.loading) return {state: 'loading'};
    if (mine.error || !mine.data) return {state: 'failed'};
    return {state: 'ok', ballot: mine.data.ballot, eligibleWeight: mine.data.eligibleWeight};
};

/**
 * The actions on a proposal: vote and revote, vote and settle in one transaction, settle, retry or mark expired,
 * cancel (the proposer) and clean up. What is offered comes from `proposalActions`; every transaction goes through
 * one `useActionFlow` (its lock is what keeps a transaction from being sent twice) with `daoTxOptions`.
 */
export function useProposalActions({deps, data, wallet, nowMs, mine, refresh, fingerprint, lookupTx = getTxLanding}: ProposalActionsInput): ProposalActions {
    const {model} = data;
    const {tx, progressTrack} = useSDKTx();
    const {feeDenom} = useSettings();
    const native = useBalance(getChainNativeAssetDenom());
    const feeToken = useBalance(feeDenom || getChainNativeAssetDenom());
    const flow = useActionFlow({
        send: (msgs) => sendDaoTx(tx, msgs),
        refresh,
        fingerprint,
        lookupTx,
        isGone: async () => (await deps.chain.getProposal(model.id)) === null,
    });
    const [dialog, setDialog] = useState<{open: ProposalDialog; at: FlowState} | null>(null);

    const gas = gasState({loading: native.isLoading || feeToken.isLoading, nativeEmpty: native.balance.amount.isZero(), feeTokenEmpty: feeToken.balance.amount.isZero()});
    const params = data.params.ok ? data.params.value : null;
    const view = proposalActions({model, wallet, myVote: myVoteState(wallet, mine), params, gas, nowMs});

    const run = (kind: ActionKind, msgs: EncodeObject[]) => void flow.run(kind, msgs);
    const voteMsg = (option: VoteChoice): EncodeObject => buildDaoVoteMsg({voter: wallet ?? '', proposalId: model.id, option});
    const settleMsg = (): EncodeObject => buildSettleDaoProposalMsg({sender: wallet ?? '', proposalId: model.id});

    return {
        view,
        blocked: blockedReason(wallet, gas),
        gas,
        wallet,
        flow,
        progress: progressTrack,
        dialog: dialog?.open ?? null,
        stateAtOpen: dialog?.at ?? null,
        open: (next) => setDialog({open: next, at: flow.state}),
        close: () => setDialog(null),
        vote: (option) => run('vote', [voteMsg(option)]),
        voteAndSettle: () => run('vote-settle', [voteMsg('YES'), settleMsg()]),
        settle: () => run('settle', [settleMsg()]),
        cancel: () => run('cancel', [buildCancelDaoProposalMsg({proposer: wallet ?? '', proposalId: model.id})]),
        cleanup: () => void flow.runCleanup(buildCleanupDaoProposalMsg({sender: wallet ?? '', proposalId: model.id, limit: 0})),
    };
}
