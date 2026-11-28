'use client';

import {useState, type ReactNode} from 'react';
import {Button, chakra, CloseButton, Dialog, Flex, Portal} from '@chakra-ui/react';
import {LuCheck, LuRotateCw} from 'react-icons/lu';
import {hgVariant, type DaoCoin} from '@bze/bze-ui-kit';
import type {AsyncValue} from '@/hooks/useAsync';
import {cancelNotice, VOTE_CHOICES, type VoteChoice} from '@/lib/proposal-actions';
import {optionLabel, type MyVote} from '@/lib/proposal-loader';
import type {ProposalModel} from '@/lib/proposal-model';
import {tallyView} from '@/lib/proposal-tally';
import {deadlineOf, dayOf, spaced, tallyWithYes} from '@/lib/proposal-view';
import type {ProposalActions, ProposalDialog} from './actions-slot';
import {SettleButton} from './state-card';
import {TxPanel} from './tx-panel';
import {Note, Pill, Rows, Small, Swatch} from './ui';

interface Props {
    actions: ProposalActions;
    model: ProposalModel;
    mine: AsyncValue<MyVote>;
    formatWeight: (amount: string) => string;
    formatCoin: (coin: DaoCoin) => string;
}

const P = ({children, testId}: {children: ReactNode; testId?: string}) => (
    <chakra.p m="0" fontSize="14px" lineHeight="1.55" color="hg.text.secondary" data-testid={testId}>{children}</chakra.p>
);

const actionsCount = (n: number) => `${n} ${n === 1 ? 'action' : 'actions'}`;

/** The accent box with the weight a vote carries. */
const WeightBox = ({weight}: {weight: string}) => (
    <Flex justify="space-between" gap="8px" px="12px" py="10px" borderRadius="12px" bg="hg.accent/6" borderWidth="1px" borderColor="hg.accent/30" fontSize="13px" data-testid="dialog-weight">
        <chakra.span color="fg.muted">Your vote counts for</chakra.span>
        <strong>{weight}</strong>
    </Flex>
);

/** E5 dialogs 1 and 2: the first vote, or a revote with the current option disabled (the chain refuses it, 1125). */
const VoteForm = ({actions, model, initial, formatWeight}: {actions: ProposalActions; model: ProposalModel; initial: VoteChoice | null; formatWeight: Props['formatWeight']}) => {
    const vote = actions.view.vote;
    const current = vote?.current ?? null;
    const first = initial ?? vote?.options.find((o) => !o.disabled)?.option ?? null;
    const [choice, setChoice] = useState<VoteChoice | null>(first);
    if (!vote) return null;
    const hasMsgs = model.msgs.length > 0;
    const describe: Record<VoteChoice, string> = {
        YES: hasMsgs ? 'Run the actions.' : 'Pass it.',
        NO: hasMsgs ? "Don't run them." : "Don't pass it.",
        ABSTAIN: 'Count my vote for the quorum only.',
    };
    const stake = model.daoType === 'DAO_TYPE_STAKE';
    const label = choice ? (current ? `Change to ${optionLabel(choice)}` : `Vote ${optionLabel(choice).toLowerCase()}`) : 'Pick an option';

    return (
        <Flex direction="column" gap="16px">
            {vote.weight && <WeightBox weight={formatWeight(vote.weight)} />}
            {current && (
                <chakra.span fontSize="13px" lineHeight="1.5" color="hg.text.secondary" data-testid="revote-note">
                    {`Your current vote is ${optionLabel(current)}. Voting again replaces it, at your current weight${stake ? ": stake you add now doesn't count on this proposal." : '.'}`}
                </chakra.span>
            )}
            <chakra.fieldset m="0" p="0" border="0" display="flex" flexDirection="column" gap="8px">
                <chakra.legend fontSize="14px" fontWeight="600" mb="8px" p="0">{current ? 'New vote' : 'How do you vote?'}</chakra.legend>
                {VOTE_CHOICES.map((option) => {
                    const o = vote.options.find((x) => x.option === option);
                    const disabled = !!o?.disabled;
                    const checked = choice === option;
                    return (
                        <chakra.label
                            key={option}
                            display="flex"
                            alignItems="flex-start"
                            gap="12px"
                            px="14px"
                            py={{base: '14px', md: '12px'}}
                            borderRadius="12px"
                            borderWidth="1px"
                            borderColor={checked ? 'hg.accent/60' : 'hg.hairline'}
                            bg={checked ? 'hg.accent/7' : 'transparent'}
                            opacity={disabled ? 0.5 : 1}
                            cursor={disabled ? 'not-allowed' : 'pointer'}
                            title={o?.reason || undefined}
                        >
                            <chakra.input
                                type="radio"
                                name="dao-vote"
                                value={option}
                                checked={checked}
                                disabled={disabled}
                                onChange={() => setChoice(option)}
                                m="3px 0 0"
                                boxSize="16px"
                                flex="none"
                                css={{accentColor: 'var(--chakra-colors-app-solid)'}}
                                data-testid={`dialog-option-${option.toLowerCase()}`}
                            />
                            <Flex as="span" direction="column" gap="2px">
                                <Flex as="span" align="center" gap="8px" fontSize="14px" fontWeight="700">
                                    <Swatch option={option} />
                                    {optionLabel(option)}
                                    {current === option && <Pill tone="neutral">Current</Pill>}
                                </Flex>
                                <chakra.span fontSize="13px" color="fg.muted">{describe[option]}</chakra.span>
                            </Flex>
                        </chakra.label>
                    );
                })}
            </chakra.fieldset>
            <Button variant={hgVariant('primary')} w="100%" h={{base: '48px', md: '44px'}} disabled={!choice || !vote.enabled} onClick={() => choice && actions.vote(choice)} data-testid="vote-confirm">{label}</Button>
            {vote.reason && <Small testId="vote-disabled-reason">{vote.reason}</Small>}
            {!current && <Small>You can change your vote until voting ends.</Small>}
        </Flex>
    );
};

/** E5 dialog 3: vote yes and settle in one transaction, the expedite bars as they will be with this yes. */
const VoteSettleForm = ({actions, model, mine, formatWeight}: Omit<Props, 'formatCoin'>) => {
    const vs = actions.view.voteAndSettle;
    if (!vs) return null;
    const memberList = model.daoType === 'DAO_TYPE_STATIC_LIST';
    const after = tallyWithYes(model.tally, mine.data?.ballot ?? null, vs.weight);
    const bars = tallyView(model.config, after, true)?.bars ?? [];
    const yes = bars.find((b) => b.id === 'expedite-yes');
    const turnout = bars.find((b) => b.id === 'expedite-quorum');
    const tick = (met: boolean) => (met ? ' ✓' : '');

    return (
        <Flex direction="column" gap="16px" data-testid="vote-and-settle-dialog">
            {after && yes && turnout && (
                <Flex direction="column" gap="10px" p="16px" borderRadius="14px" bgImage="linear-gradient(180deg, color-mix(in srgb, var(--chakra-colors-hg-success) 10%, transparent), color-mix(in srgb, var(--chakra-colors-hg-success) 2%, transparent))" borderWidth="1px" borderColor="hg.success/35">
                    <chakra.strong fontSize="15px">{memberList ? `With your yes: ${after.yes} of ${after.denominator} members` : `With your yes: ${spaced(yes.achieved)} of all voting power`}</chakra.strong>
                    <Rows
                        labelWidth="1fr"
                        size="13px"
                        py="6px"
                        rows={[
                            {label: memberList ? 'Yes of all members' : 'Yes of all voting power', value: <>{spaced(yes.achieved)} <chakra.span color="hg.success.text">{`· needs more than ${spaced(yes.required)}${tick(yes.met)}`}</chakra.span></>},
                            {label: 'Turnout', value: <>{spaced(turnout.achieved)} <chakra.span color="hg.success.text">{`· needs ${spaced(turnout.required)}${tick(turnout.met)}`}</chakra.span></>},
                        ]}
                    />
                </Flex>
            )}
            <P testId="vote-and-settle-note">
                {`One transaction does both: your vote (YES, counted at ${formatWeight(vs.weight)}), then the settle. The proposal passes`}
                {model.msgs.length > 0 ? ` and its ${actionsCount(model.msgs.length)} run there.` : '.'}
            </P>
            <Button variant={hgVariant('primary')} w="100%" h="44px" disabled={!vs.enabled} onClick={actions.voteAndSettle} data-testid="vote-and-settle-confirm">
                <LuCheck aria-hidden /> Vote yes and settle
            </Button>
            <Button variant={hgVariant('secondary')} w="100%" h="40px" disabled={!actions.view.vote?.enabled} onClick={() => actions.vote('YES')} data-testid="vote-only-yes">Only vote yes</Button>
            <Small>If someone settles it first, the simulation catches it and nothing is sent.</Small>
        </Flex>
    );
};

/** E6 settle, retry and mark expired: the outcome first, then what the transaction does. */
const SettleForm = ({actions, model}: {actions: ProposalActions; model: ProposalModel}) => {
    const s = actions.view.settle;
    if (!s) return null;
    const n = model.msgs.length;
    const view = tallyView(model.config, model.tally, model.expedited);
    const quorum = view?.bars.find((b) => b.id === 'quorum');
    const threshold = view?.bars.find((b) => b.id === 'threshold');
    const numbers = quorum && threshold
        ? `${spaced(quorum.achieved)} turnout (needs ${spaced(quorum.required)}), ${spaced(threshold.achieved)} yes (needs more than ${spaced(threshold.required)}).`
        : '';
    const reason = s.reason ? <Small testId="settle-reason">{s.reason}</Small> : null;

    if (s.kind === 'retry') {
        const error = model.outcome?.executionError;
        return (
            <Flex direction="column" gap="16px">
                {error && <Note tone="accent" testId="execution-error">Last time: <strong>{error}</strong>.</Note>}
                <P testId="settle-note">{`Same transaction as settling: it runs the actions again.${model.retryDeadline ? ` Retry is open until ${deadlineOf(model.retryDeadline)}.` : ''} If they fail again it stays failed; a payment that failed on an empty treasury succeeds once the funds are there.`}</P>
                <Button variant={hgVariant('primary')} w="100%" h="44px" disabled={!s.enabled} onClick={actions.settle} data-testid="settle-confirm"><LuRotateCw aria-hidden /> Retry now</Button>
                {reason}
            </Flex>
        );
    }
    if (s.kind === 'expire') {
        const closed = dayOf(model.retryDeadline);
        return (
            <Flex direction="column" gap="16px">
                <P testId="settle-note">{`The retry window closed${closed ? ` on ${closed}` : ''}. This settles it as expired: nothing runs. The deposit was already settled when it passed. The network decides by block time, so a transaction sent just before the deadline may still retry instead.`}</P>
                <Button variant={hgVariant('secondary')} w="100%" h="44px" disabled={!s.enabled} onClick={actions.settle} data-testid="settle-confirm">Mark expired</Button>
                {reason}
            </Flex>
        );
    }

    const passes = s.outcome === 'pass';
    const text = s.kind === 'early'
        ? s.note
        : s.outcome === 'pass'
            ? n > 0 ? `Settling counts the votes for good and, because it passes, runs its ${actionsCount(n)} in this same transaction. Anyone can do it.` : 'Settling counts the votes for good. It passes; it has no actions to run. Anyone can do it.'
            : s.outcome === 'reject' ? 'Settling counts the votes for good. It is rejected, so nothing runs. Anyone can do it.' : s.note;
    return (
        <Flex direction="column" gap="16px">
            {s.outcome && (
                <div data-testid="settle-outcome" data-outcome={s.outcome}>
                    <Note tone={passes ? 'success' : 'neutral'}>
                        {passes ? <>It <strong>passes</strong></> : <>It is <strong>rejected</strong></>}
                        {s.kind === 'early' ? ': it meets the expedite bars.' : numbers ? `: ${numbers}` : '.'}
                    </Note>
                </div>
            )}
            <P testId="settle-note">{text}</P>
            <SettleButton size="lg" w="100%" disabled={!s.enabled} onClick={actions.settle} data-testid="settle-confirm">{passes && n > 0 ? 'Settle and run' : 'Settle'}</SettleButton>
            {reason}
        </Flex>
    );
};

const CancelForm = ({actions, model, formatCoin}: {actions: ProposalActions; model: ProposalModel; formatCoin: Props['formatCoin']}) => (
    <Flex direction="column" gap="16px">
        <Note tone="warning"><span data-testid="cancel-notice">{`${cancelNotice(model.config, model.deposit, formatCoin)} Cancelling can't be undone.`}</span></Note>
        <P>Only you, the proposer, can cancel, and only while voting is open.</P>
        <Flex gap="10px" justify="flex-end" wrap="wrap">
            <Button variant={hgVariant('secondary')} h="40px" onClick={actions.close} data-testid="cancel-keep">Keep it</Button>
            <Button variant={hgVariant('danger')} h="40px" disabled={!actions.view.cancel?.enabled} onClick={actions.cancel} data-testid="cancel-confirm-button">Cancel proposal</Button>
        </Flex>
    </Flex>
);

const CleanupForm = ({actions}: {actions: ProposalActions}) => (
    <Flex direction="column" gap="16px">
        <P>{"Removes the proposal's votes and records from the chain to free storage. BZE Scan keeps the full history; this page then shows it from there."}</P>
        <Small>It can take a few transactions: confirm each batch in your wallet, or stop any time and continue later.</Small>
        <Button variant={hgVariant('secondary')} w="100%" h="40px" disabled={!actions.view.cleanup?.enabled} onClick={actions.cleanup} data-testid="cleanup-confirm">Clean up</Button>
    </Flex>
);

function headOf(dialog: ProposalDialog, actions: ProposalActions, model: ProposalModel): {title: string; sub: string} {
    const named = `#${model.id} · ${model.title}`;
    switch (dialog.kind) {
        case 'vote': return {title: actions.view.vote?.current ? 'Change your vote' : 'Vote on this proposal', sub: named};
        case 'vote-settle': return {title: 'Vote yes and settle now?', sub: named};
        case 'cancel': return {title: 'Cancel your proposal?', sub: named};
        case 'cleanup': return {title: `Clean up #${model.id}`, sub: `Finished · ${model.status === 'EXECUTED' ? 'executed' : model.status.toLowerCase()}`};
        case 'settle': {
            const kind = actions.view.settle?.kind;
            if (kind === 'retry') return {title: `Retry the actions of #${model.id}`, sub: model.title};
            if (kind === 'expire') return {title: `Mark #${model.id} expired`, sub: model.title};
            return {title: `Settle proposal #${model.id}`, sub: `${model.title} · ${kind === 'early' ? 'expedite bars met' : 'voting ended'}`};
        }
    }
}

/**
 * The one dialog of the page (E5, E6; a bottom sheet on a phone, I4). Once its transaction starts, the
 * transaction panel (E7) takes the form's place; answers are kept until it is confirmed.
 */
export const ProposalDialogs = ({actions, model, mine, formatWeight, formatCoin}: Props) => {
    const {dialog} = actions;
    if (!dialog) return null;
    const moved = actions.flow.state !== actions.stateAtOpen || actions.flow.locked;
    const head = headOf(dialog, actions, model);
    const body = moved
        ? <TxPanel state={actions.flow.state} progress={actions.progress} status={model.status} onRecheck={() => void actions.flow.recheck()} />
        : dialog.kind === 'vote' ? <VoteForm actions={actions} model={model} initial={dialog.option} formatWeight={formatWeight} />
            : dialog.kind === 'vote-settle' ? <VoteSettleForm actions={actions} model={model} mine={mine} formatWeight={formatWeight} />
                : dialog.kind === 'settle' ? <SettleForm actions={actions} model={model} />
                    : dialog.kind === 'cancel' ? <CancelForm actions={actions} model={model} formatCoin={formatCoin} />
                        : <CleanupForm actions={actions} />;

    return (
        <Dialog.Root open onOpenChange={(e) => { if (!e.open) actions.close(); }} placement={{base: 'bottom', md: 'center'}} scrollBehavior="inside" lazyMount unmountOnExit>
            <Portal>
                <Dialog.Backdrop bg="hg.backdrop" />
                <Dialog.Positioner>
                    <Dialog.Content
                        w="100%"
                        maxW={{base: '100%', md: dialog.kind === 'vote' || dialog.kind === 'vote-settle' ? '420px' : '400px'}}
                        css={{'@media (max-width: 47.99em)': {marginBottom: 0}}}
                        bg="hg.card"
                        borderWidth="1px"
                        borderColor="hg.hairline"
                        borderRadius={{base: '24px 24px 0 0', md: '20px'}}
                        boxShadow="0 40px 80px -30px rgba(0,0,0,0.9)"
                        data-testid={`dialog-${dialog.kind}`}
                    >
                        <Dialog.Header pt={{base: '16px', md: '24px'}} px={{base: '16px', md: '24px'}} pb="0" pe="56px">
                            <Flex direction="column" gap="2px">
                                <Dialog.Title fontSize="19px" fontWeight="700">{head.title}</Dialog.Title>
                                <chakra.span fontSize="13px" color="fg.muted" overflowWrap="anywhere">{head.sub}</chakra.span>
                            </Flex>
                        </Dialog.Header>
                        <Dialog.Body px={{base: '16px', md: '24px'}} pt="16px" pb={{base: '28px', md: '24px'}}>{body}</Dialog.Body>
                        <Dialog.CloseTrigger asChild top={{base: '12px', md: '20px'}} insetEnd={{base: '12px', md: '18px'}}>
                            <CloseButton size="sm" aria-label="Close" />
                        </Dialog.CloseTrigger>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    );
};
