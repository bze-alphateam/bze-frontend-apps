import {daoExpediteTally, durationSeconds, type DaoBallot, type DaoCoin, type DaoParams, type DaoProposalStatus} from '@bze/bze-ui-kit';
import type {PinnedConfig, ProposalModel} from './proposal-model';
import {tallyView} from './proposal-tally';

// What a wallet can do on a proposal, as one pure function of what the page knows: the live proposal (the
// chain's flags, never the browser clock, say whether voting has ended), the wallet's ballot and eligible
// weight, the chain params, the wallet's gas and the clock (injected). Every "could not be read" input is
// its own state, so a failed read never turns into "no power" or "not allowed".

export type VoteChoice = 'YES' | 'NO' | 'ABSTAIN';
export const VOTE_CHOICES: readonly VoteChoice[] = ['YES', 'NO', 'ABSTAIN'];

export const FINISHED_STATUSES: readonly DaoProposalStatus[] = ['REJECTED', 'EXECUTED', 'EXPIRED', 'CANCELLED'];

/** The wallet's ballot and eligible weight, as `loadMyVote` read them. */
export type MyVoteState =
    | {state: 'loading'}
    | {state: 'failed'}
    | {state: 'ok'; ballot: DaoBallot | null; /** null: the voting power could not be read */ eligibleWeight: string | null};

export type GasState = {state: 'ok'} | {state: 'loading'} | {state: 'none'; reason: string};

export interface ActionInput {
    model: ProposalModel;
    /** The connected wallet; null when none is. */
    wallet: string | null;
    myVote: MyVoteState;
    /** null when the chain params could not be read. */
    params: Pick<DaoParams, 'min_expedite_delay'> | null;
    gas: GasState;
    nowMs: number;
}

export interface VoteOptionView {
    option: VoteChoice;
    disabled: boolean;
    /** Why it is disabled; empty otherwise. */
    reason: string;
}

export interface VoteView {
    enabled: boolean;
    reason: string;
    /** The weight the vote will carry; null when it is not known. */
    weight: string | null;
    /** The wallet's current option, marked in the list. */
    current: VoteChoice | null;
    options: VoteOptionView[];
}

export interface VoteAndSettleView {
    enabled: boolean;
    reason: string;
}

export type SettleKind = 'settle' | 'early' | 'retry' | 'expire';

export interface SettleView {
    kind: SettleKind;
    label: string;
    enabled: boolean;
    reason: string;
    /** What the chain will reach from the tally; null when it cannot be told (the chain decides). */
    outcome: 'pass' | 'reject' | null;
    /** What to tell the user before signing. */
    note: string;
}

export interface SimpleActionView {
    enabled: boolean;
    reason: string;
}

export interface ProposalActionsView {
    vote: VoteView | null;
    voteAndSettle: VoteAndSettleView | null;
    settle: SettleView | null;
    cancel: SimpleActionView | null;
    cleanup: SimpleActionView | null;
}

const ZERO = BigInt(0);
const isDigits = (v: string): boolean => /^\d+$/.test(v);
const sameAddress = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

/** Why nothing can be signed right now; empty when the wallet can sign. */
export function blockedReason(wallet: string | null, gas: GasState): string {
    if (!wallet) return 'Connect a wallet to act on this proposal.';
    if (gas.state === 'none') return gas.reason;
    if (gas.state === 'loading') return 'Reading your balance to pay the network fee.';
    return '';
}

/** Gas from the wallet's balances: only a wallet with nothing in its native or fee token is "none"; the simulation judges the rest. */
export function gasState(b: {loading: boolean; nativeEmpty: boolean; feeTokenEmpty: boolean}): GasState {
    if (b.loading) return {state: 'loading'};
    if (b.nativeEmpty && b.feeTokenEmpty) return {state: 'none', reason: 'Your wallet has no balance to pay the network fee.'};
    return {state: 'ok'};
}

/** How a settle of the proposal is labelled and whether the proposal can be settled at all. */
export function settleKind(m: Pick<ProposalModel, 'status' | 'votingEnded' | 'expediteSettleable' | 'retryDeadline' | 'archived'>, nowMs: number): SettleKind | null {
    if (m.archived) return null;
    if (m.status === 'VOTING') {
        if (m.votingEnded) return 'settle';
        return m.expediteSettleable ? 'early' : null;
    }
    if (m.status === 'EXECUTION_FAILED') {
        const deadline = m.retryDeadline ? new Date(m.retryDeadline).getTime() : NaN;
        return Number.isFinite(deadline) && nowMs >= deadline ? 'expire' : 'retry';
    }
    return null;
}

const SETTLE_LABEL: Record<SettleKind, string> = {settle: 'Settle', early: 'Settle now', retry: 'Retry', expire: 'Mark expired'};

function settleNote(kind: SettleKind, outcome: 'pass' | 'reject' | null, hasMsgs: boolean): string {
    switch (kind) {
        case 'settle':
            if (outcome === 'pass') return hasMsgs ? 'From its tally it passes. Its actions run in this transaction.' : 'From its tally it passes. It has no actions to run.';
            if (outcome === 'reject') return 'From its tally it is rejected. Nothing runs.';
            return 'The chain decides it from the tally when you send this; a passed proposal runs its actions in this transaction.';
        case 'early':
            return hasMsgs ? 'It meets the expedite bars, so it settles now as passed. Its actions run in this transaction.' : 'It meets the expedite bars, so it settles now as passed.';
        case 'retry':
            return 'Runs the actions again. If they fail again the proposal stays failed and can be retried until the deadline. A payment that failed on an empty treasury succeeds once the funds are there.';
        case 'expire':
            return 'The retry window is over. This marks the proposal expired without running its actions. The network decides by block time, so a transaction sent just before the deadline may still retry instead.';
    }
}

function settleView(input: ActionInput, blocked: string): SettleView | null {
    const {model, nowMs} = input;
    const kind = settleKind(model, nowMs);
    if (!kind) return null;
    let outcome: 'pass' | 'reject' | null = null;
    if (kind === 'early') outcome = 'pass';
    if (kind === 'settle') {
        const view = tallyView(model.config, model.tally, model.expedited);
        outcome = view ? (view.passesRegular ? 'pass' : 'reject') : null;
    }
    return {kind, label: SETTLE_LABEL[kind], enabled: !blocked, reason: blocked, outcome, note: settleNote(kind, outcome, model.msgs.length > 0)};
}

const oldBallotWeight = (ballot: DaoBallot | null, option: VoteChoice): bigint =>
    ballot && ballot.option === option && isDigits(ballot.weight) ? BigInt(ballot.weight) : ZERO;

/** A revote onto the same option is refused by the chain only while the ballot still has weight. */
const sameOptionRefused = (ballot: DaoBallot | null, option: VoteChoice): boolean =>
    !!ballot && ballot.option === option && isDigits(ballot.weight) && BigInt(ballot.weight) > ZERO;

function voteView(input: ActionInput, blocked: string): VoteView | null {
    const {model, myVote} = input;
    if (model.status !== 'VOTING' || model.votingEnded || model.archived) return null;

    const ballot = myVote.state === 'ok' ? myVote.ballot : null;
    const current = ballot && (VOTE_CHOICES as readonly string[]).includes(ballot.option) ? (ballot.option as VoteChoice) : null;
    const weight = myVote.state === 'ok' && myVote.eligibleWeight !== null && isDigits(myVote.eligibleWeight) ? myVote.eligibleWeight : null;

    let reason = blocked;
    if (!reason) {
        if (myVote.state === 'loading') reason = 'Reading your voting power.';
        else if (myVote.state === 'failed' || weight === null) reason = 'Your voting power could not be read from the chain, so a vote is not offered. Reload to try again.';
        else if (BigInt(weight) === ZERO) reason = model.daoType === 'DAO_TYPE_STAKE'
            ? 'Your vote would count 0: your stake joined after this proposal started, or it is not in one of the DAO\'s staking sources.'
            : 'Your vote would count 0: you were not a member of the DAO when this proposal started.';
    }
    const enabled = !reason;
    return {
        enabled,
        reason,
        weight,
        current,
        options: VOTE_CHOICES.map((option) => {
            const same = sameOptionRefused(ballot, option);
            return {option, disabled: !enabled || same, reason: same ? 'This is your current vote. Pick another option to change it.' : ''};
        }),
    };
}

/** Whether the early-settle delay of a stake DAO has passed; a static-list DAO has none. null when it cannot be told. */
function earlyDelayPassed(model: ProposalModel, params: ActionInput['params'], nowMs: number): boolean | null {
    if (model.daoType !== 'DAO_TYPE_STAKE') return true;
    if (!params || !model.submitTime) return null;
    let delay: number;
    try {
        delay = durationSeconds(params.min_expedite_delay);
    } catch {
        return null;
    }
    return nowMs >= new Date(model.submitTime).getTime() + delay * 1000;
}

/**
 * Whether a YES vote of `weight` from this wallet would take an expedited proposal over its expedite bars,
 * with the wallet's old ballot taken out first. Uses ui-kit's tally rules, never a copy of them.
 */
export function yesVoteMeetsExpediteBars(model: Pick<ProposalModel, 'config' | 'tally'>, ballot: DaoBallot | null, weight: string): boolean {
    const {config, tally} = model;
    if (!config || !tally || !isDigits(weight)) return false;
    try {
        const sub = (option: VoteChoice, total: string): bigint => BigInt(total) - oldBallotWeight(ballot, option);
        return daoExpediteTally(
            {denominator: tally.denominator, yes: sub('YES', tally.yes) + BigInt(weight), no: sub('NO', tally.no), abstain: sub('ABSTAIN', tally.abstain)},
            config.expedite_quorum,
            config.expedite_threshold,
        ).passes;
    } catch {
        return false;
    }
}

function voteAndSettleView(input: ActionInput, vote: VoteView | null, blocked: string): VoteAndSettleView | null {
    const {model, myVote, params, nowMs} = input;
    if (!vote || !model.expedited || model.expediteSettleable) return null;
    if (!vote.weight || BigInt(vote.weight) === ZERO) return null;
    const ballot = myVote.state === 'ok' ? myVote.ballot : null;
    // a ballot that is already a weighted YES cannot be cast again, and adding nothing never changes the tally
    if (vote.options.find((o) => o.option === 'YES')?.reason) return null;
    if (earlyDelayPassed(model, params, nowMs) !== true) return null;
    if (!yesVoteMeetsExpediteBars(model, ballot, vote.weight)) return null;
    return {enabled: vote.enabled && !blocked, reason: vote.reason || blocked};
}

/** What happens to the proposer's deposit and cost if the proposal is cancelled, for the confirmation. */
export function cancelNotice(config: PinnedConfig | null, deposit: DaoCoin | null, formatCoin: (c: DaoCoin) => string): string {
    const cost = 'The proposal cost is never refunded.';
    const amount = deposit && deposit.amount !== '0' ? formatCoin(deposit) : null;
    if (!config || !config.deposit_refund_policy) return `The deposit rules of this proposal could not be read, so what happens to the deposit is unknown. ${cost}`;
    if (!amount) return `This proposal has no deposit. ${cost}`;
    if (config.deposit_refund_policy === 'ALWAYS') return `Your deposit of ${amount} is refunded. ${cost}`;
    const where = config.kept_deposit_destination === 'BURN' ? 'burned' : config.kept_deposit_destination === 'TREASURY' ? 'sent to the DAO\'s treasury' : 'kept by the DAO';
    return `Your deposit of ${amount} is not refunded when a proposal is cancelled: it is ${where}. ${cost}`;
}

/** Every action the wallet is offered on this proposal, with whether it is enabled and why not. */
export function proposalActions(input: ActionInput): ProposalActionsView {
    const {model, wallet} = input;
    const blocked = blockedReason(wallet, input.gas);
    const vote = voteView(input, blocked);
    const cancelable = model.status === 'VOTING' && !model.votingEnded && !model.archived && !!wallet && sameAddress(wallet, model.proposer);
    const cleanable = !model.archived && FINISHED_STATUSES.includes(model.status);
    return {
        vote,
        voteAndSettle: voteAndSettleView(input, vote, blocked),
        settle: settleView(input, blocked),
        cancel: cancelable ? {enabled: !blocked, reason: blocked} : null,
        cleanup: cleanable ? {enabled: !blocked, reason: blocked} : null,
    };
}
