'use client';

import type {ReactNode} from 'react';
import {chakra, Flex} from '@chakra-ui/react';
import {LuCheck, LuClock, LuInfo, LuTriangleAlert, LuX} from 'react-icons/lu';
import {getExplorerTxURL, type DaoProposalStatus} from '@bze/bze-ui-kit';
import type {ActionKind, FlowState} from '@/hooks/useActionFlow';

const SETTLED_TEXT: Partial<Record<DaoProposalStatus, string>> = {
    EXECUTED: 'Settled: the proposal passed and its actions ran.',
    EXECUTION_FAILED: 'Settled: it passed, but its actions failed. They can be retried.',
    REJECTED: 'Settled: the proposal was rejected.',
    EXPIRED: 'Marked as expired.',
};

/** What a confirmed transaction did, from what was sent and the proposal's status after it. */
function sentText(kind: ActionKind, status: DaoProposalStatus, batches: number): string {
    switch (kind) {
        case 'vote': return 'Your vote is recorded.';
        case 'vote-settle': return `Vote recorded. ${SETTLED_TEXT[status] ?? 'Settled.'}`;
        case 'settle': return SETTLED_TEXT[status] ?? 'Settled.';
        case 'cancel': return 'The proposal is cancelled.';
        case 'cleanup': return `Cleaned up in ${batches} ${batches === 1 ? 'batch' : 'batches'}.`;
        default: return 'Sent.';
    }
}

type Tone = 'accent' | 'success' | 'neutral' | 'danger' | 'warning' | 'info';

const TONE: Record<Tone, {disc: string; icon: string; edge: string}> = {
    accent: {disc: 'hg.accent/14', icon: 'hg.link.hover', edge: 'hg.hairline'},
    success: {disc: 'hg.success/12', icon: 'hg.success.text', edge: 'hg.success/38'},
    neutral: {disc: 'hg.inset', icon: 'hg.text.secondary', edge: 'hg.hairline'},
    danger: {disc: 'hg.danger/12', icon: 'hg.danger.text', edge: 'hg.danger/38'},
    warning: {disc: 'hg.warning/12', icon: 'hg.warning.text', edge: 'hg.warning/38'},
    info: {disc: 'hg.info/12', icon: 'hg.info.text', edge: 'hg.hairline'},
};

const short = (hash: string) => (hash.length > 12 ? `${hash.slice(0, 4)}…${hash.slice(-4)}` : hash);

/** "Tx 9F3A…C21E · View on Explorer ↗" */
const TxLine = ({hash}: {hash: string}) => (
    <chakra.span fontFamily="mono" fontSize="12px" color="hg.text.faint">
        {`Tx ${short(hash)} · `}
        <chakra.a href={getExplorerTxURL(hash)} target="_blank" rel="noreferrer" color="hg.link" title={hash} data-testid="tx-hash" aria-label={`View transaction ${hash} on the explorer`}>
            <chakra.span srOnly>{hash}</chakra.span>
            View on Explorer ↗
        </chakra.a>
    </chakra.span>
);

const LinkButton = ({onClick, children, testId}: {onClick: () => void; children: ReactNode; testId: string}) => (
    <chakra.button type="button" alignSelf="flex-start" color="hg.link" fontSize="14px" fontWeight="600" cursor="pointer" onClick={onClick} data-testid={testId}>{children}</chakra.button>
);

const Panel = ({tone, icon, eyebrow, title, testId, children}: {tone: Tone; icon: ReactNode; eyebrow: string; title: string; testId: string; children: ReactNode}) => (
    <chakra.section bg="hg.card" borderWidth="1px" borderColor={TONE[tone].edge} borderRadius="16px" p="22px" display="flex" flexDirection="column" gap="12px" minW="0" data-testid={testId} aria-live="polite">
        <Flex gap="12px" align="center">
            <chakra.span boxSize="44px" flex="none" borderRadius="999px" bg={TONE[tone].disc} color={TONE[tone].icon} display="inline-flex" alignItems="center" justifyContent="center" aria-hidden>{icon}</chakra.span>
            <Flex direction="column" gap="2px" minW="0">
                <chakra.span fontSize="12px" fontWeight="700" letterSpacing="0.12em" textTransform="uppercase" color={TONE[tone].icon}>{eyebrow}</chakra.span>
                <chakra.strong fontSize="18px">{title}</chakra.strong>
            </Flex>
        </Flex>
        <Flex direction="column" gap="8px" fontSize="14px" lineHeight="1.55" color="hg.text.secondary">{children}</Flex>
    </chakra.section>
);

interface Props {
    state: FlowState;
    progress: string;
    /** The proposal's status now: what a settle did. */
    status: DaoProposalStatus;
    onRecheck: () => void;
}

/** E7 Transaction states: the panel that takes the dialog's place once something is sent (and stays on the page while it is locked). */
export const TxPanel = ({state, progress, status, onRecheck}: Props) => {
    switch (state.phase) {
        case 'idle':
            return null;
        case 'signing':
            if (state.kind === 'cleanup' && state.batches > 0) {
                return (
                    <Panel tone="accent" icon={<LuClock size={22} />} eyebrow={`Batch ${state.batches + 1}`} title="Cleaning up" testId="action-progress-panel">
                        <span data-testid="action-progress">{`${state.batches} ${state.batches === 1 ? 'batch' : 'batches'} done${state.processed ? `, ${state.processed} ballots deleted` : ''}. Confirm each batch in your wallet.`}</span>
                    </Panel>
                );
            }
            return (
                <Panel tone="accent" icon={<LuClock size={22} />} eyebrow="Step 1" title="Confirm in your wallet" testId="action-progress-panel">
                    <span>Your wallet shows the same message you just reviewed. Nothing happens until you approve there.</span>
                    <chakra.span fontSize="13px" color="hg.text.faint" data-testid="action-progress">{progress || 'Waiting for the wallet…'}</chakra.span>
                </Panel>
            );
        case 'failed':
            return (
                <Panel tone="danger" icon={<LuTriangleAlert size={22} />} eyebrow="Not sent" title={state.kind === 'cleanup' && state.batches ? `The clean-up stopped after ${state.batches} ${state.batches === 1 ? 'batch' : 'batches'}` : 'Nothing was sent'} testId="action-error">
                    <span>{state.error}</span>
                    <chakra.span fontSize="13px" color="hg.text.faint">Your choices are still here.</chakra.span>
                </Panel>
            );
        case 'unconfirmed':
            return (
                <Panel tone="warning" icon={<LuInfo size={22} />} eyebrow="Unknown" title="Taking longer than usual" testId="action-unconfirmed">
                    <span>{state.error}</span>
                    <span>{"That doesn't mean it failed, so don't send it again yet. The actions stay locked until it is clear."}</span>
                    {state.txHash && <TxLine hash={state.txHash} />}
                    {state.note && <span data-testid="recheck-note">{state.note}</span>}
                    <LinkButton onClick={onRecheck} testId="action-recheck">Check again</LinkButton>
                </Panel>
            );
        case 'sent':
            return (
                <Panel tone="success" icon={<LuCheck size={22} />} eyebrow="Done" title="Confirmed" testId="action-sent">
                    <span>{sentText(state.kind, status, state.batches)}</span>
                    {state.reread === 'failed'
                        ? <><span>It is on chain, but the proposal could not be read again, so the page may be out of date.</span><LinkButton onClick={onRecheck} testId="action-recheck">Read it again</LinkButton></>
                        : <chakra.span fontSize="13px" color="hg.text.faint">The tally and your ballot are re-read from the chain.</chakra.span>}
                    {state.txHash && <TxLine hash={state.txHash} />}
                </Panel>
            );
        case 'rechecked':
            return (
                <Panel tone="neutral" icon={<LuX size={22} />} eyebrow="Read again" title="The proposal was read again" testId="action-rechecked">
                    <span>{"What you see now is the chain's answer. If the transaction landed it shows on the page; if it did not, you can send it again."}</span>
                    {state.txHash && <TxLine hash={state.txHash} />}
                </Panel>
            );
    }
};
