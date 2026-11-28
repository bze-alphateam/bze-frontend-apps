'use client';

import type {ReactNode} from 'react';
import NextLink from 'next/link';
import {Button, chakra, Flex} from '@chakra-ui/react';
import {LuExternalLink} from 'react-icons/lu';
import {getExplorerTxURL, hgVariant, Notice} from '@bze/bze-ui-kit';
import type {Dao, DaoCoin} from '@bze/bze-ui-kit';
import {daoTabHref} from '@/lib/dao-tabs';
import type {CostRow, Requirement} from '@/lib/propose/cost';
import type {ProposerStatus} from '@/lib/propose/eligibility';
import type {SubmitState} from '@/hooks/useProposalSubmit';
import {NeutralNote} from './neutral-note';

interface Props {
    dao: Pick<Dao, 'id' | 'name' | 'type' | 'config'>;
    wallet: string | null;
    status: ProposerStatus | null;
    ready: boolean;
    short: boolean;
    /** What still keeps the proposal from being sent, in one sentence (the first problem of the form). */
    problem: string | undefined;
    state: SubmitState;
    /** Deposit, Back to you and Cost (`costRows`). */
    rows: CostRow[];
    /** What the wallet needs of each token, with its balance (`summarizeCost`). */
    requirements: Requirement[];
    /** Whether the wallet's balances are known (the "You hold" rows). */
    balancesKnown: boolean;
    formatCoin: (coin: DaoCoin) => string;
    /** "n of N proposal slots are in use.", when the open proposals were read. */
    slots: string | null;
    /** Where a wallet without stake goes to stake (a stakers' DAO), when known. */
    stakeHref: string | null;
    onSubmit: () => void;
    onCheck: () => void;
    onAllowResubmit: () => void;
}

const HashLink = ({hash}: {hash: string}) => (
    <chakra.a href={getExplorerTxURL(hash)} target="_blank" rel="noopener noreferrer" color="hg.link" textDecoration="underline" overflowWrap="anywhere" data-testid="tx-hash">
        {hash}
    </chakra.a>
);

const NOT_A_VOTER_TITLE = {'not-member': 'Not a member', 'no-stake': 'No stake'} as const;
const BLOCKED_TITLE = {'no-voters': 'No voters', full: 'Full'} as const;

const Row = ({label, first, testId, children}: {label: string; first: boolean; testId?: string; children: ReactNode}) => (
    <chakra.div display="grid" gridTemplateColumns={{base: '1fr auto', md: '110px 1fr'}} gap="16px" py="7px" borderTopWidth={first ? '0' : '1px'} borderColor="hg.divider" data-testid={testId}>
        <chakra.dt fontSize="13px" color="fg.muted">{label}</chakra.dt>
        <chakra.dd m="0" fontSize="13px" lineHeight="1.5" color="fg" minW="0" overflowWrap="anywhere" textAlign={{base: 'end', md: 'start'}}>{children}</chakra.dd>
    </chakra.div>
);

/**
 * "Before you submit" (board F1's aside): who may propose, what it costs and what comes back, the wallet's
 * balance, the proposal slots and the send button; then where the last attempt stands.
 */
export const SubmitArea = ({dao, wallet, status, ready, short, problem, state, rows, requirements, balancesKnown, formatCoin, slots, stakeHref, onSubmit, onCheck, onAllowResubmit}: Props) => {
    const working = state.phase === 'working';
    const locked = state.phase === 'unconfirmed' || state.phase === 'done';

    let gate: ReactNode = null;
    if (!wallet) {
        gate = <NeutralNote testId="gate-wallet">Connect your wallet to submit this proposal.</NeutralNote>;
    } else if (status?.kind === 'blocked') {
        gate = <div data-testid="gate-blocked" data-cause={status.cause}><Notice status="warning" title={BLOCKED_TITLE[status.cause]}>{status.message}</Notice></div>;
    } else if (status?.kind === 'not-a-voter') {
        gate = (
            <NeutralNote
                testId="gate-not-a-voter"
                title={NOT_A_VOTER_TITLE[status.cause]}
                aside={status.cause === 'no-stake' && stakeHref ? (
                    <chakra.a href={stakeHref} target="_blank" rel="noopener noreferrer" display="inline-flex" alignItems="center" gap="6px" fontSize="14px" fontWeight="500" color="hg.link" whiteSpace="nowrap" data-testid="stake-on-dex">
                        Stake on DEX<LuExternalLink size={14} aria-hidden />
                    </chakra.a>
                ) : undefined}
            >
                {status.message}
            </NeutralNote>
        );
    }
    const held = balancesKnown && wallet ? requirements.filter((r) => r.balance !== null) : [];

    return (
        <chakra.section
            aria-labelledby="submit-title"
            bg="hg.card"
            bgImage="linear-gradient(160deg, var(--chakra-colors-app-subtle), var(--chakra-colors-hg-card) 55%)"
            borderWidth="1px"
            borderColor="app.border"
            borderRadius="20px"
            boxShadow="hg.featured"
            p={{base: '16px', md: '24px'}}
            display="flex"
            flexDirection="column"
            gap={{base: '10px', md: '14px'}}
            minW="0"
            data-testid="submit-panel"
        >
            <chakra.h2 id="submit-title" m="0" fontSize="17px" fontWeight="700">Before you submit</chakra.h2>
            {status?.kind === 'allowed' && <Notice status="success"><span data-testid="proposer-note">{status.reason}</span></Notice>}
            {status?.kind === 'maybe' && <NeutralNote testId="proposer-note">{status.reason}</NeutralNote>}
            {gate}
            <chakra.dl m="0" display="flex" flexDirection="column" data-testid="cost-list">
                {rows.map((row, i) => (
                    <Row key={row.label} label={row.label} first={i === 0} testId={{Deposit: 'cost-deposit', 'Back to you': 'cost-back', Cost: 'cost-cost'}[row.label]}>{row.text}</Row>
                ))}
                {held.map((r) => (
                    <Row key={r.denom} label="You hold" first={false} testId="cost-balance">
                        {formatCoin({denom: r.denom, amount: r.balance ?? '0'})}
                        {r.short
                            ? <chakra.span color="hg.danger.text">{` · not enough, you need ${formatCoin({denom: r.denom, amount: r.needed})}`}</chakra.span>
                            : <chakra.span color="hg.success.text" aria-label="enough">{' ✓'}</chakra.span>}
                    </Row>
                ))}
            </chakra.dl>
            {rows.some((r) => r.text !== 'None') && <chakra.span fontSize="12px" lineHeight="1.5" color="hg.text.faint">Paid in their own token, never swapped. The network fee is paid on top.</chakra.span>}
            {slots && <chakra.span fontSize="12px" lineHeight="1.5" color="hg.text.faint" data-testid="proposal-slots">{slots}</chakra.span>}
            {!gate && (
                <Flex direction="column" gap="8px">
                    <Button
                        variant={hgVariant('primary')}
                        w="100%"
                        h={{base: '44px', md: '48px'}}
                        fontSize="15px"
                        disabled={!ready || short || working || locked}
                        loading={working}
                        loadingText="Confirm in your wallet"
                        onClick={onSubmit}
                        whiteSpace="normal"
                        data-testid="submit-proposal"
                    >
                        Submit proposal
                    </Button>
                    {!ready && problem && <chakra.p m="0" fontSize="13px" color="fg.muted" data-testid="submit-problem">{problem}</chakra.p>}
                    {ready && short && <chakra.p m="0" fontSize="13px" color="hg.danger.text">Your balance does not cover the cost and the deposit.</chakra.p>}
                    <chakra.p m="0" fontSize="12px" color="hg.text.faint">
                        Before anything is signed, the chain checks the proposal: if it would be refused, you see why and nothing is sent. This wallet signs with the direct mode, which Ledger devices do not support for these transactions.
                    </chakra.p>
                </Flex>
            )}

            {state.phase === 'failed' && (
                <Notice status="danger">
                    <span data-testid="submit-failed">{state.message}</span>
                    {state.hash && <> Transaction <HashLink hash={state.hash} /></>}
                </Notice>
            )}
            {state.phase === 'unconfirmed' && (
                <Flex direction="column" gap="8px" data-testid="submit-unconfirmed">
                    <Notice status="warning">
                        <span>{state.message}</span>
                        {' '}The proposal may still be created: look for it in the DAO&apos;s proposals or in the explorer before submitting again.
                        {state.hash ? <> Transaction <HashLink hash={state.hash} /></> : ' The transaction hash was not available.'}
                    </Notice>
                    {state.note && <chakra.p m="0" fontSize="13px" color="fg.muted" data-testid="submit-note">{state.note}</chakra.p>}
                    <Flex gap="16px" wrap="wrap" align="center">
                        {state.hash && <chakra.button type="button" color="hg.link" fontWeight="600" cursor="pointer" onClick={onCheck} data-testid="submit-check">Ask the node about it</chakra.button>}
                        <chakra.a asChild color="hg.link" fontWeight="600"><NextLink href={daoTabHref(dao.id, 'proposals')}>Check the DAO&apos;s proposals</NextLink></chakra.a>
                    </Flex>
                    <chakra.button type="button" alignSelf="flex-start" color="fg.muted" fontSize="13px" textDecoration="underline" cursor="pointer" onClick={onAllowResubmit} data-testid="submit-again">
                        I checked: it did not land, let me submit again
                    </chakra.button>
                </Flex>
            )}
            {state.phase === 'done' && (
                <Notice status="success">
                    <span data-testid="submit-done">
                        {state.proposalId ? `Proposal #${state.proposalId} was created. Opening it…` : 'The proposal was created.'}
                    </span>
                    {!state.proposalId && <> <chakra.a asChild color="hg.link" fontWeight="600"><NextLink href={daoTabHref(dao.id, 'proposals')}>Find it in the DAO&apos;s proposals</NextLink></chakra.a></>}
                </Notice>
            )}
        </chakra.section>
    );
};
