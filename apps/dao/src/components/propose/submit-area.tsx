'use client';

import NextLink from 'next/link';
import {Button} from '@chakra-ui/react';
import {chakra, Flex} from '@chakra-ui/react';
import {getExplorerTxURL, hgVariant, Notice} from '@bze/bze-ui-kit';
import type {Dao} from '@bze/bze-ui-kit';
import {staticJoinText} from '@/lib/dao-actions';
import type {ProposerStatus} from '@/lib/propose/eligibility';
import type {SubmitState} from '@/hooks/useProposalSubmit';
import {Panel} from '@/components/dao/page/panel';

interface Props {
    dao: Pick<Dao, 'id' | 'name' | 'type' | 'config'>;
    wallet: string | null;
    status: ProposerStatus | null;
    ready: boolean;
    short: boolean;
    /** What still keeps the proposal from being sent, in one sentence (the first problem of the form). */
    problem: string | undefined;
    state: SubmitState;
    onSubmit: () => void;
    onAllowResubmit: () => void;
}

const HashLink = ({hash}: {hash: string}) => (
    <chakra.a href={getExplorerTxURL(hash)} target="_blank" rel="noopener noreferrer" color="hg.link" textDecoration="underline" overflowWrap="anywhere" data-testid="tx-hash">
        {hash}
    </chakra.a>
);

/** How to become a voter, when the wallet is not one. */
const HowToVote = ({dao}: {dao: Props['dao']}) => (
    <Flex direction="column" gap="6px" fontSize="14px" data-testid="how-to-vote">
        {dao.type === 'DAO_TYPE_STATIC_LIST'
            ? staticJoinText(dao, false).map((line) => <chakra.p key={line} m="0">{line}</chakra.p>)
            : <chakra.p m="0">Stake in one of the sources this DAO votes with, then come back in a block or two: stake counts once it has joined.</chakra.p>}
        <chakra.a asChild color="hg.link" fontWeight="600"><NextLink href={`/dao/${dao.id}#join`}>How to join this DAO</NextLink></chakra.a>
    </Flex>
);

/** The send button, or the reason there is none, and where the last attempt stands. */
export const SubmitArea = ({dao, wallet, status, ready, short, problem, state, onSubmit, onAllowResubmit}: Props) => {
    const working = state.phase === 'working';
    const locked = state.phase === 'unconfirmed' || state.phase === 'done';

    let gate: React.ReactNode = null;
    if (!wallet) {
        gate = <Notice status="info"><span data-testid="gate-wallet">Connect your wallet to submit this proposal.</span></Notice>;
    } else if (status?.kind === 'blocked') {
        gate = <Notice status="warning"><span data-testid="gate-blocked">{status.message}</span></Notice>;
    } else if (status?.kind === 'not-a-voter') {
        gate = (
            <Flex direction="column" gap="10px" data-testid="gate-not-a-voter">
                <Notice status="warning">{status.message}</Notice>
                <HowToVote dao={dao} />
            </Flex>
        );
    }

    return (
        <Panel id="submit" title="Submit" testId="submit-panel">
            {status && (status.kind === 'allowed' || status.kind === 'maybe') && <chakra.p m="0" fontSize="13px" color="fg.muted" data-testid="proposer-note">{status.reason}</chakra.p>}
            {gate}
            {!gate && (
                <Flex direction="column" gap="8px">
                    <Button
                        variant={hgVariant('primary')}
                        size="lg"
                        disabled={!ready || short || working || locked}
                        loading={working}
                        loadingText="Confirm in your wallet"
                        onClick={onSubmit}
                        whiteSpace="normal"
                        h="auto"
                        minH="46px"
                        py="8px"
                        data-testid="submit-proposal"
                    >
                        Submit proposal
                    </Button>
                    {!ready && problem && <chakra.p m="0" fontSize="13px" color="fg.muted" data-testid="submit-problem">{problem}</chakra.p>}
                    {ready && short && <chakra.p m="0" fontSize="13px" color="red.500">Your balance does not cover the cost and the deposit.</chakra.p>}
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
                    <chakra.a asChild color="hg.link" fontWeight="600"><NextLink href={`/dao/${dao.id}`}>Check the DAO&apos;s proposals</NextLink></chakra.a>
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
                    {!state.proposalId && <> <chakra.a asChild color="hg.link" fontWeight="600"><NextLink href={`/dao/${dao.id}`}>Find it in the DAO&apos;s proposals</NextLink></chakra.a></>}
                </Notice>
            )}
        </Panel>
    );
};
