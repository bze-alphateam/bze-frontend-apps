'use client';

import type {ReactNode} from 'react';
import {chakra, Flex} from '@chakra-ui/react';
import {getExplorerTxURL, Notice} from '@bze/bze-ui-kit';
import type {ActionKind, FlowState} from '@/hooks/useActionFlow';

/** A transaction's hash, linked to the explorer. */
export const TxLink = ({hash}: {hash: string}) => hash
    ? <chakra.a href={getExplorerTxURL(hash)} target="_blank" rel="noreferrer" color="hg.link" fontWeight="600" overflowWrap="anywhere" data-testid="tx-hash">{hash}</chakra.a>
    : null;

/** A button that reads as a link. */
export const Link = ({onClick, children, testId}: {onClick: () => void; children: ReactNode; testId?: string}) => (
    <chakra.button type="button" color="hg.link" fontWeight="600" cursor="pointer" onClick={onClick} data-testid={testId}>{children}</chakra.button>
);

interface Props {
    state: FlowState;
    progress: string;
    onRecheck: () => void;
    /** The title of the success notice, from what was sent. */
    sentTitle: (kind: ActionKind, batches: number) => string;
    /** What the page re-reads after a transaction, in a sentence ("the proposal", "the DAO"). */
    subject?: string;
}

/** The message of a flow that is not idle: progress, failure, a transaction that may still land, success. */
export const FlowMessage = ({state, progress, onRecheck, sentTitle, subject = 'proposal'}: Props) => {
    switch (state.phase) {
        case 'idle':
            return null;
        case 'signing':
            return (
                <Notice status="info" title={state.kind === 'cleanup' ? `Cleaning up${state.batches ? `: ${state.batches} ${state.batches === 1 ? 'batch' : 'batches'} done${state.processed ? `, ${state.processed} ballots deleted` : ''}` : ''}` : 'Approve in your wallet'}>
                    <span data-testid="action-progress">{progress || 'Waiting for the wallet…'}</span>
                </Notice>
            );
        case 'failed':
            return (
                <div data-testid="action-error">
                    <Notice status="danger" title={state.kind === 'cleanup' && state.batches ? `The clean-up stopped after ${state.batches} ${state.batches === 1 ? 'batch' : 'batches'}` : 'Nothing was sent'}>{state.error}</Notice>
                </div>
            );
        case 'unconfirmed':
            return (
                <div data-testid="action-unconfirmed">
                    <Notice status="warning" title="Not confirmed yet: it may still land">
                        <Flex direction="column" gap="6px">
                            <span>{state.error}</span>
                            {state.txHash && <span>{'Transaction: '}<TxLink hash={state.txHash} /></span>}
                            <span>The actions stay locked so the same transaction is not sent twice. Check again to see whether it landed.</span>
                            {state.note && <span data-testid="recheck-note">{state.note}</span>}
                            <span><Link onClick={onRecheck} testId="action-recheck">Check again</Link></span>
                        </Flex>
                    </Notice>
                </div>
            );
        case 'sent':
            return (
                <div data-testid="action-sent">
                    <Notice status="success" title={sentTitle(state.kind, state.batches)}>
                        <Flex direction="column" gap="6px">
                            {state.txHash && <span>{'Transaction: '}<TxLink hash={state.txHash} /></span>}
                            {state.reread === 'failed' && (
                                <>
                                    <span>{`It is on chain, but ${subject.startsWith('the ') ? subject : `the ${subject}`} could not be read again, so the page may be out of date.`}</span>
                                    <span><Link onClick={onRecheck} testId="action-recheck">Read it again</Link></span>
                                </>
                            )}
                        </Flex>
                    </Notice>
                </div>
            );
        case 'rechecked':
            return (
                <div data-testid="action-rechecked">
                    <Notice status="info" title={`The ${subject} was read again`}>
                        What you see now is the chain&apos;s answer. If the transaction landed it shows below; if it did not, you can send it again.
                        {state.txHash && <> {'Transaction: '}<TxLink hash={state.txHash} /></>}
                    </Notice>
                </div>
            );
    }
};
