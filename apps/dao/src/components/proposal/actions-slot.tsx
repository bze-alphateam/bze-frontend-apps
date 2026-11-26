'use client';

import {useState, type ReactNode} from 'react';
import {Button, chakra, Flex} from '@chakra-ui/react';
import {
    buildCancelDaoProposalMsg, buildCleanupDaoProposalMsg, buildDaoVoteMsg, buildSettleDaoProposalMsg,
    getChainNativeAssetDenom, getTxLanding, hgVariant, HgCard, useBalance, useSDKTx, useSettings,
    type DaoCoin, type DaoProposalStatus, type TxLanding,
} from '@bze/bze-ui-kit';
import type {EncodeObject} from '@bze/bzejs/types';
import {useActionFlow, type ActionKind} from '@/hooks/useActionFlow';
import {FlowMessage, Link} from '@/components/flow-message';
import type {AsyncValue} from '@/hooks/useAsync';
import {sendDaoTx} from '@/lib/dao-tx';
import {
    blockedReason, cancelNotice, gasState, proposalActions, type MyVoteState, type VoteChoice,
} from '@/lib/proposal-actions';
import type {MyVote, ProposalDeps, ProposalPageData} from '@/lib/proposal-loader';
import {optionLabel} from '@/lib/proposal-loader';

interface Props {
    deps: ProposalDeps;
    data: ProposalPageData;
    wallet: string | null;
    nowMs: number;
    /** The wallet's ballot and eligible weight, read once by the page. */
    mine: AsyncValue<MyVote>;
    formatWeight: (amount: string) => string;
    formatCoin: (coin: DaoCoin) => string;
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

const SETTLED_TEXT: Partial<Record<DaoProposalStatus, string>> = {
    EXECUTED: 'Settled: the proposal passed and its actions ran.',
    EXECUTION_FAILED: 'Settled: it passed, but its actions failed. They can be retried.',
    REJECTED: 'Settled: the proposal was rejected.',
    EXPIRED: 'Marked as expired.',
};

const Section = ({title, testId, children}: {title: string; testId: string; children: ReactNode}) => (
    <Flex direction="column" gap="8px" pt="12px" borderTopWidth="1px" borderColor="app.border" data-testid={testId}>
        <chakra.h3 m="0" fontSize="14px" fontWeight="700">{title}</chakra.h3>
        {children}
    </Flex>
);

const Muted = ({children, testId}: {children: ReactNode; testId?: string}) => (
    <chakra.p m="0" fontSize="13px" color="fg.muted" data-testid={testId}>{children}</chakra.p>
);

function sentTitle(kind: ActionKind, status: DaoProposalStatus, batches: number): string {
    switch (kind) {
        case 'vote': return 'Your vote is recorded.';
        case 'vote-settle': return `Vote recorded. ${SETTLED_TEXT[status] ?? 'Settled.'}`;
        case 'settle': return SETTLED_TEXT[status] ?? 'Settled.';
        case 'cancel': return 'The proposal is cancelled.';
        case 'cleanup': return `Cleaned up in ${batches} ${batches === 1 ? 'batch' : 'batches'}.`;
        default: return 'Sent.';
    }
}

/**
 * The actions on a proposal: vote and revote, vote and settle in one transaction, settle, retry or mark
 * expired, cancel (the proposer) and clean up. What is offered comes from `proposalActions`; every
 * transaction uses `daoTxOptions` (direct signing, nothing signed when the simulation fails).
 */
export const ProposalActionsSlot = ({deps, data, wallet, nowMs, mine, formatWeight, formatCoin, refresh, fingerprint, lookupTx = getTxLanding}: Props) => {
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
    const [choice, setChoice] = useState<VoteChoice | null>(null);
    const [confirmCancel, setConfirmCancel] = useState(false);

    const gas = gasState({loading: native.isLoading || feeToken.isLoading, nativeEmpty: native.balance.amount.isZero(), feeTokenEmpty: feeToken.balance.amount.isZero()});
    const params = data.params.ok ? data.params.value : null;
    const view = proposalActions({model, wallet, myVote: myVoteState(wallet, mine), params, gas, nowMs});
    const blocked = blockedReason(wallet, gas);
    const locked = flow.locked;
    const retryError = model.status === 'EXECUTION_FAILED' ? model.outcome?.executionError : null;

    const sendMsgs = (kind: ActionKind, msgs: EncodeObject[]) => { setConfirmCancel(false); setChoice(null); void flow.run(kind, msgs); };
    const voteMsg = (option: VoteChoice): EncodeObject => buildDaoVoteMsg({voter: wallet ?? '', proposalId: model.id, option});
    const settleMsg = (): EncodeObject => buildSettleDaoProposalMsg({sender: wallet ?? '', proposalId: model.id});

    if (!view.vote && !view.settle && !view.cancel && !view.cleanup) return <div data-testid="proposal-actions" data-empty />;

    return (
        <HgCard data-testid="proposal-actions">
            <Flex direction="column" gap="12px" p={{base: '16px', md: '20px'}}>
                <chakra.h2 m="0" fontSize="18px" fontWeight="700">What you can do</chakra.h2>
                {blocked && <Muted testId="actions-blocked">{blocked}</Muted>}
                <FlowMessage state={flow.state} progress={progressTrack} onRecheck={() => void flow.recheck()} sentTitle={(kind, batches) => sentTitle(kind, model.status, batches)} />

                {!locked && view.vote && (
                    <Section title="Vote" testId="action-vote">
                        {view.vote.weight && <Muted testId="vote-weight-note">{`Your vote counts ${formatWeight(view.vote.weight)}, your weight on this proposal now. If you vote again it replaces your ballot at that weight.${model.daoType === 'DAO_TYPE_STAKE' ? ' Stake added after the proposal started does not count.' : ''}`}</Muted>}
                        {view.vote.reason && <Muted testId="vote-disabled-reason">{view.vote.reason}</Muted>}
                        <Flex gap="8px" wrap="wrap">
                            {view.vote.options.map((o) => (
                                <Button
                                    key={o.option}
                                    variant={hgVariant(choice === o.option ? 'primary' : 'secondary')}
                                    disabled={o.disabled}
                                    title={o.reason || undefined}
                                    aria-pressed={choice === o.option}
                                    onClick={() => setChoice(o.option)}
                                    data-testid={`vote-option-${o.option.toLowerCase()}`}
                                    data-current={view.vote?.current === o.option ? 'true' : undefined}
                                >
                                    {optionLabel(o.option)}{view.vote?.current === o.option ? ' (your vote)' : ''}
                                </Button>
                            ))}
                        </Flex>
                        {choice && view.vote.enabled && (
                            <Flex gap="10px" align="center" wrap="wrap">
                                <Button variant={hgVariant('primary')} onClick={() => sendMsgs('vote', [voteMsg(choice)])} data-testid="vote-confirm">
                                    {`${view.vote.current ? 'Change vote to' : 'Vote'} ${optionLabel(choice)}`}
                                </Button>
                                <Muted>{view.vote.current ? `Replaces your ${optionLabel(view.vote.current)} vote.` : 'You can change it until voting ends.'}</Muted>
                            </Flex>
                        )}
                        {view.voteAndSettle && (
                            <Flex direction="column" gap="6px" data-testid="vote-and-settle">
                                <Muted>One transaction with two messages: your vote (YES) carrying your weight of {formatWeight(view.voteAndSettle.weight)}, then the settle. Your yes takes this expedited proposal over its bars, so it passes in that same transaction and its actions run there.</Muted>
                                <div>
                                    <Button
                                        variant={hgVariant('primary')}
                                        disabled={!view.voteAndSettle.enabled}
                                        onClick={() => sendMsgs('vote-settle', [voteMsg('YES'), settleMsg()])}
                                        data-testid="vote-and-settle-button"
                                    >
                                        Vote yes and settle now
                                    </Button>
                                </div>
                            </Flex>
                        )}
                    </Section>
                )}

                {!locked && view.settle && (
                    <Section title={view.settle.kind === 'retry' ? 'Retry the actions' : view.settle.kind === 'expire' ? 'Retry window over' : 'Settle'} testId="action-settle">
                        <Muted testId="settle-note">{view.settle.note}</Muted>
                        {view.settle.kind === 'settle' && view.settle.outcome && <chakra.span fontSize="13px" fontWeight="600" data-testid="settle-outcome" data-outcome={view.settle.outcome}>{view.settle.outcome === 'pass' ? 'Outcome: passes' : 'Outcome: rejected'}</chakra.span>}
                        {retryError && <Muted testId="execution-error">{`Last failure: ${retryError}`}</Muted>}
                        {view.settle.reason && <Muted>{view.settle.reason}</Muted>}
                        <div>
                            <Button variant={hgVariant('primary')} disabled={!view.settle.enabled} onClick={() => sendMsgs('settle', [settleMsg()])} data-testid="settle-button">
                                {view.settle.label}
                            </Button>
                        </div>
                    </Section>
                )}

                {!locked && view.cancel && (
                    <Section title="Cancel your proposal" testId="action-cancel">
                        {!confirmCancel ? (
                            <div>
                                <Button variant={hgVariant('secondary')} disabled={!view.cancel.enabled} onClick={() => setConfirmCancel(true)} data-testid="cancel-button">Cancel proposal</Button>
                            </div>
                        ) : (
                            <Flex direction="column" gap="8px" data-testid="cancel-confirm">
                                <Muted testId="cancel-notice">{cancelNotice(model.config, model.deposit, formatCoin)}</Muted>
                                <Flex gap="10px" wrap="wrap">
                                    <Button variant={hgVariant('primary')} onClick={() => sendMsgs('cancel', [buildCancelDaoProposalMsg({proposer: wallet ?? '', proposalId: model.id})])} data-testid="cancel-confirm-button">Yes, cancel it</Button>
                                    <Button variant={hgVariant('secondary')} onClick={() => setConfirmCancel(false)}>Keep it</Button>
                                </Flex>
                            </Flex>
                        )}
                    </Section>
                )}

                {!locked && view.cleanup && (
                    <Flex direction="column" gap="4px" pt="12px" borderTopWidth="1px" borderColor="app.border" data-testid="action-cleanup">
                        <Muted>
                            {'This proposal is finished. Anyone can delete its stored ballots from the chain; the history stays on BZE Scan. It can take a few transactions. '}
                            {view.cleanup.enabled
                                ? <Link onClick={() => void flow.runCleanup(buildCleanupDaoProposalMsg({sender: wallet ?? '', proposalId: model.id, limit: 0}))} testId="cleanup-button">Clean up on-chain data</Link>
                                : <span data-testid="cleanup-disabled">Clean-up is not available: {view.cleanup.reason}</span>}
                        </Muted>
                    </Flex>
                )}

                {wallet && <chakra.p m="0" fontSize="12px" color="hg.text.faint" data-testid="ledger-note">DAO transactions are signed in direct mode, which a Ledger cannot approve yet. Use a software wallet for these.</chakra.p>}
            </Flex>
        </HgCard>
    );
};
