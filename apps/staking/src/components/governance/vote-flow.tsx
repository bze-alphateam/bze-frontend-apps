'use client';

import {useState, type ReactNode} from 'react';
import {Box, Button, chakra, CloseButton, Dialog, Drawer, Flex, Grid, Portal, Spinner} from '@chakra-ui/react';
import {LuCircleX} from 'react-icons/lu';
import {useChain} from '@interchain-kit/react';
import BigNumber from 'bignumber.js';
import {cosmos} from '@bze/bzejs';
import {
    getChainName, hgVariant, Notice, useGasFeeEstimate, useSDKTx, useToast,
    type GovParams, type GovProposal, type GovVote,
} from '@bze/bze-ui-kit';
import {useIsPhone} from '@/hooks/useIsPhone';
import {invalidateOpenProposalsSummary} from '@/hooks/useOpenProposalsSummary';
import {proposalTitle} from '@/lib/governance/proposal';
import {formatDateTimeUtc} from '@/lib/governance/format';
import {wholeBze, type DenomResolver} from '@/lib/governance/details';
import type {TallyOption} from '@/lib/governance/tally';
import {
    VOTE_CHOICES, choiceByKey, isInactiveProposal, isSplit, isWalletRejection, singleChoice, vetoWarning, voteSummary,
} from '@/lib/governance/voter';
import {TALLY_COLORS} from './tally-bar';

// Voting on one proposal: choose → confirm → signing, then a toast on success
// or an inline error with Try again. A dialog from `md` up, a bottom sheet
// below. Mounted only while open; the parent unmounts it on close.

type Step = 'choose' | 'confirm' | 'signing' | 'failed';

const TITLES: Record<Step, string> = {
    choose: 'Vote on this proposal',
    confirm: 'Confirm your vote',
    failed: 'Confirm your vote',
    signing: 'Sending your vote',
};

// The chosen option's text and tint follow its tally colour; No with veto is amber.
const TONE: Record<TallyOption, {fg: string; tint: string}> = {
    yes: {fg: 'hg.success.text', tint: 'hg.up/8'},
    no: {fg: 'hg.danger.text', tint: 'hg.down/8'},
    no_with_veto: {fg: 'hg.warning.text', tint: 'hg.warning/8'},
    abstain: {fg: 'fg', tint: 'hg.flat/10'},
};

const REJECTED = 'The request was rejected in your wallet. Nothing changed, so you can try again.';

export interface VoteFlowProps {
    proposal: GovProposal;
    params: GovParams;
    /** Voting power in ubze. */
    power: BigNumber;
    currentVote: GovVote | null;
    /** A choice picked on the page: the flow opens on the confirm step. */
    initialChoice?: TallyOption;
    resolve?: DenomResolver;
    onClose: () => void;
    /** The chain accepted the vote: re-read the vote and the tally. */
    onVoted: () => void;
    /** Voting ended while the flow was open: reload the proposal. */
    onEnded?: () => void;
}

function Row({label, children}: {label: string; children: ReactNode}) {
    return (
        <>
            <Box as="dt" color="hg.text.secondary">{label}</Box>
            <Box as="dd" textAlign="right">{children}</Box>
        </>
    );
}

export function VoteFlow({proposal, params, power, currentVote, initialChoice, resolve, onClose, onVoted, onEnded}: VoteFlowProps) {
    const isPhone = useIsPhone();
    const {address} = useChain(getChainName());
    const {tx, progressTrack} = useSDKTx();
    const {toast} = useToast();
    const fee = useGasFeeEstimate('vote');
    const [step, setStep] = useState<Step>(initialChoice ? 'confirm' : 'choose');
    const [choice, setChoice] = useState<TallyOption | null>(initialChoice ?? null);
    const [error, setError] = useState('');

    const current = singleChoice(currentVote);
    const chosen = choice ? choiceByKey(choice) : null;
    const powerText = `${wholeBze(power)} BZE`;
    const replaces = current
        ? `Your current vote: ${current.label}`
        : isSplit(currentVote) ? 'Your split vote' : 'Your validators’ votes for your stake';

    const sign = async () => {
        if (!chosen || !address) return;
        setStep('signing');
        setError('');
        let failure: string | null = null;
        let sent = false;
        try {
            const msg = cosmos.gov.v1.MessageComposer.withTypeUrl.vote({
                proposalId: BigInt(proposal.id),
                voter: address,
                option: chosen.option,
                metadata: '',
            });
            sent = await tx([msg], {onFailure: (e) => { failure = e; }});
        } catch (e) {
            console.error('vote failed', e);
            failure = e instanceof Error ? e.message : String(e);
        }
        if (sent) {
            const until = proposal.voting_end_time ? ` You can change it until ${formatDateTimeUtc(proposal.voting_end_time)}.` : '';
            toast.success('Vote recorded', `You voted ${chosen.label} on #${proposal.id}.${until}`);
            // The nav badge and the dashboard banner follow at once.
            invalidateOpenProposalsSummary();
            onVoted();
            onClose();
            return;
        }
        const message: string = failure ?? 'Unknown error';
        setError(message);
        setStep('failed');
        if (isInactiveProposal(message)) onEnded?.();
    };

    // The title component links the dialog's accessible name.
    const Title = isPhone ? Drawer.Title : Dialog.Title;
    const header = (
        <Flex direction="column" gap="2px" pr="40px">
            <Title fontSize={{base: '18px', md: '19px'}} fontWeight="700">{TITLES[step]}</Title>
            <chakra.span fontSize="13px" color="fg.muted">{`#${proposal.id} · ${proposalTitle(proposal)}`}</chakra.span>
        </Flex>
    );

    const choose = (
        <>
            <Flex justify="space-between" gap="8px" bg="app.subtle" borderWidth="1px" borderColor="app.border" borderRadius="hg.md" px="12px" py="10px" fontSize="13px">
                <chakra.span color="fg.muted">Your vote counts for</chakra.span>
                <chakra.strong>{powerText}</chakra.strong>
            </Flex>
            {current && (
                <chakra.span fontSize="13px" color="fg.muted">
                    {'Your current vote is '}<chakra.strong color="fg">{current.label}</chakra.strong>{'. Voting again replaces it.'}
                </chakra.span>
            )}
            {isSplit(currentVote) && currentVote && (
                <chakra.span fontSize="13px" color="fg.muted">
                    {`You split your vote: ${voteSummary(currentVote)}. Voting here replaces it with one choice.`}
                </chakra.span>
            )}
            <Box as="fieldset" display="flex" flexDirection="column" gap="8px" m="0" p="0" border="0">
                <Box as="legend" fontSize="14px" fontWeight="600" mb="8px" p="0">How do you vote?</Box>
                {VOTE_CHOICES.map((c) => {
                    const selected = choice === c.key;
                    return (
                        <Flex
                            key={c.key}
                            as="label"
                            align="flex-start"
                            gap="12px"
                            px="14px"
                            py="12px"
                            borderRadius="hg.md"
                            borderWidth={selected ? '2px' : '1px'}
                            borderColor={selected ? TALLY_COLORS[c.key] : 'hg.hairline'}
                            bg={selected ? TONE[c.key].tint : 'hg.inset'}
                            cursor="pointer"
                            _hover={selected ? undefined : {borderColor: 'hg.lineStrong'}}
                        >
                            <Box
                                as="input"
                                {...{type: 'radio', name: 'vote', value: c.key, checked: selected, onChange: () => setChoice(c.key)}}
                                mt="1"
                                w="4"
                                h="4"
                                flexShrink={0}
                                style={{accentColor: 'var(--chakra-colors-app-solid)'}}
                                data-accent="app.solid"
                            />
                            <Flex direction="column" gap="2px" flex="1">
                                <Flex align="center" gap="8px" fontSize="14px" fontWeight="700">
                                    <Box aria-hidden="true" boxSize="10px" borderRadius="3px" bg={TALLY_COLORS[c.key]} />
                                    <chakra.span>{c.label}</chakra.span>
                                    {current?.key === c.key && (
                                        <chakra.span fontSize="11px" fontWeight="600" px="6px" borderRadius="4px" bg="hg.raised" color="fg.muted">Current</chakra.span>
                                    )}
                                </Flex>
                                <chakra.span fontSize="13px" lineHeight="1.45" color="fg.muted">{c.description}</chakra.span>
                            </Flex>
                        </Flex>
                    );
                })}
            </Box>
            <chakra.span fontSize="12px" color="hg.text.faint">{"Your vote replaces your validators' votes for your stake. Single choice only."}</chakra.span>
            <Button variant={hgVariant('primary')} size={{base: 'xl', md: 'lg'}} disabled={!choice} onClick={() => choice && setStep('confirm')}>Continue</Button>
        </>
    );

    const confirm = chosen && (
        <>
            <Flex
                direction="column"
                align="center"
                gap="2px"
                textAlign="center"
                borderWidth="1px"
                borderColor={TALLY_COLORS[chosen.key]}
                bg={TONE[chosen.key].tint}
                borderRadius="14px"
                p="16px"
                data-testid="vote-choice"
                data-color={TALLY_COLORS[chosen.key]}
            >
                <chakra.span fontSize="12px" color="fg.muted">{"You're voting"}</chakra.span>
                <chakra.strong fontSize="24px" fontWeight="800" color={TONE[chosen.key].fg}>{chosen.label}</chakra.strong>
            </Flex>
            <Box as="dl" display="grid" gridTemplateColumns="auto minmax(0, 1fr)" gap="8px 16px" fontSize="13px" m="0" data-testid="vote-confirm">
                <Row label="Voting power"><chakra.span fontWeight="600">{powerText}</chakra.span></Row>
                <Row label="Replaces">{replaces}</Row>
                <Row label="Network fee">{`≈ ${fee.displayAmount.decimalPlaces(6, BigNumber.ROUND_UP).toFormat()} ${fee.ticker}`}</Row>
            </Box>
            {chosen.key === 'no_with_veto' && (
                <Box data-testid="veto-warning">
                    <Notice status="warning">{vetoWarning(params, proposal, resolve)}</Notice>
                </Box>
            )}
            {step === 'failed' && (
                <Flex role="alert" align="flex-start" gap="10px" bg="hg.danger/8" borderWidth="1px" borderColor="hg.danger/30" borderRadius="hg.md" px="14px" py="12px" fontSize="13px" lineHeight="1.5">
                    <Box color="hg.danger" mt="2px" flexShrink={0}><LuCircleX size={16} /></Box>
                    <chakra.span>
                        <chakra.strong color="hg.danger.text">{"Your vote wasn't sent."}</chakra.strong>{' '}
                        <chakra.span color="fg.muted">{isWalletRejection(error) ? REJECTED : error}</chakra.span>
                    </chakra.span>
                </Flex>
            )}
            <Grid templateColumns={{base: 'minmax(0, 1fr)', md: '1fr 2fr'}} gap="10px">
                <Button order={{base: 1, md: 0}} variant={hgVariant('secondary')} size={{base: 'xl', md: 'lg'}} onClick={() => { setStep('choose'); setError(''); }}>Back</Button>
                <Button variant={hgVariant('primary')} size={{base: 'xl', md: 'lg'}} onClick={sign}>
                    {step === 'failed' ? 'Try again' : 'Sign and vote'}
                </Button>
            </Grid>
        </>
    );

    const signing = chosen && (
        <>
            <Flex direction="column" align="center" aria-live="polite" gap="12px" py="24px" px="8px" textAlign="center">
                <Spinner size="xl" color="app.solid" borderWidth="3px" css={{'--spinner-track-color': 'colors.app.subtle'}} />
                <chakra.strong fontSize="17px">Approve in your wallet</chakra.strong>
                <chakra.span fontSize="13px" lineHeight="1.5" color="fg.muted" maxW="320px">
                    {isPhone
                        ? `Confirm the ${chosen.label} vote in your wallet app. Nothing is sent until you approve.`
                        : `Confirm the ${chosen.label} vote in Keplr, Leap or your WalletConnect app. Nothing is sent until you approve.`}
                </chakra.span>
                <chakra.span fontSize="12px" color="hg.text.faint">{progressTrack || 'Waiting for signature…'}</chakra.span>
            </Flex>
            <Button variant={hgVariant('primary')} size={{base: 'xl', md: 'lg'}} disabled aria-busy="true">Signing…</Button>
        </>
    );

    const body = (
        <Flex direction="column" gap={{base: '14px', md: '16px'}}>
            {step === 'choose' && choose}
            {(step === 'confirm' || step === 'failed') && confirm}
            {step === 'signing' && signing}
        </Flex>
    );

    const isSigning = step === 'signing';
    const onOpenChange = (e: {open: boolean}) => {
        if (!e.open && !isSigning) onClose();
    };
    const close = <CloseButton size="sm" aria-label="Close" disabled={isSigning} />;

    if (isPhone) {
        return (
            <Drawer.Root open placement="bottom" onOpenChange={onOpenChange}>
                <Portal>
                    <Drawer.Backdrop />
                    <Drawer.Positioner>
                        <Drawer.Content
                            bg="hg.card"
                            borderTopWidth="1px"
                            borderColor="hg.hairline"
                            roundedTop="20px"
                            maxH="92dvh"
                            overflowY="auto"
                            px="20px"
                            pt="12px"
                            pb="calc(28px + env(safe-area-inset-bottom))"
                            gap="14px"
                        >
                            <Box aria-hidden alignSelf="center" w="40px" h="4px" borderRadius="4px" bg="hg.lineStrong" flex="none" />
                            {header}
                            {body}
                            <Drawer.CloseTrigger asChild top="4" insetEnd="4">{close}</Drawer.CloseTrigger>
                        </Drawer.Content>
                    </Drawer.Positioner>
                </Portal>
            </Drawer.Root>
        );
    }

    return (
        <Dialog.Root open onOpenChange={onOpenChange}>
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW="448px" p="24px" gap="16px" bg="hg.card" borderWidth="1px" borderColor="hg.hairline" borderRadius="20px" boxShadow="hg.popover">
                        {header}
                        {body}
                        <Dialog.CloseTrigger asChild top="5" insetEnd="5">{close}</Dialog.CloseTrigger>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    );
}
