'use client';

import {useState, type ReactNode} from 'react';
import {Box, Button, CloseButton, Dialog, Drawer, HStack, Portal, Spinner, Stack, Text, VStack} from '@chakra-ui/react';
import {LuCircleX, LuTriangleAlert} from 'react-icons/lu';
import {useChain} from '@interchain-kit/react';
import BigNumber from 'bignumber.js';
import {cosmos} from '@bze/bzejs';
import {
    getChainName, useGasFeeEstimate, useSDKTx, useToast,
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

const TONE: Record<TallyOption, {fg: string; tint: string}> = {
    yes: {fg: 'green.fg', tint: 'green.500/8'},
    no: {fg: 'red.fg', tint: 'red.500/7'},
    no_with_veto: {fg: 'orange.fg', tint: 'orange.500/8'},
    abstain: {fg: 'fg', tint: 'gray.500/10'},
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
            <Box as="dt" color="fg.muted">{label}</Box>
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
        <VStack align="start" gap="0.5" pr="8">
            <Title fontSize="lg" fontWeight="bold">{TITLES[step]}</Title>
            <Text fontSize="13px" color="fg.muted">{`#${proposal.id} · ${proposalTitle(proposal)}`}</Text>
        </VStack>
    );

    const choose = (
        <>
            <HStack justify="space-between" gap="2" bg="purple.500/5" borderWidth="1px" borderColor="purple.500/25" borderRadius="md" px="3" py="2.5" fontSize="13px">
                <Text color="fg.muted">Your vote counts for</Text>
                <Text as="strong">{powerText}</Text>
            </HStack>
            {current && (
                <Text fontSize="13px" color="fg.muted">
                    {'Your current vote is '}<Text as="strong" color="fg">{current.label}</Text>{'. Voting again replaces it.'}
                </Text>
            )}
            {isSplit(currentVote) && currentVote && (
                <Text fontSize="13px" color="fg.muted">
                    {`You split your vote: ${voteSummary(currentVote)}. Voting here replaces it with one choice.`}
                </Text>
            )}
            <Box as="fieldset" display="flex" flexDirection="column" gap="2">
                <Box as="legend" fontSize="sm" fontWeight="semibold" mb="2">How do you vote?</Box>
                {VOTE_CHOICES.map((c) => {
                    const selected = choice === c.key;
                    return (
                        <HStack
                            key={c.key}
                            as="label"
                            align="flex-start"
                            gap="3"
                            px="3.5"
                            py="3"
                            borderRadius="md"
                            borderWidth={selected ? '2px' : '1px'}
                            borderColor={selected ? TALLY_COLORS[c.key] : 'border'}
                            bg={selected ? TONE[c.key].tint : 'bg.panel'}
                            cursor="pointer"
                        >
                            <Box
                                as="input"
                                {...{type: 'radio', name: 'vote', value: c.key, checked: selected, onChange: () => setChoice(c.key)}}
                                mt="1"
                                w="4"
                                h="4"
                                flexShrink={0}
                                style={{accentColor: 'var(--chakra-colors-purple-600)'}}
                            />
                            <VStack align="start" gap="0.5" flex="1">
                                <HStack gap="2" fontSize="sm" fontWeight="bold">
                                    <Box aria-hidden="true" w="2.5" h="2.5" borderRadius="xs" bg={TALLY_COLORS[c.key]} />
                                    <Text as="span">{c.label}</Text>
                                    {current?.key === c.key && (
                                        <Text as="span" fontSize="11px" fontWeight="semibold" px="1.5" borderRadius="sm" bg="bg.muted" color="fg.muted">Current</Text>
                                    )}
                                </HStack>
                                <Text fontSize="13px" color="fg.muted">{c.description}</Text>
                            </VStack>
                        </HStack>
                    );
                })}
            </Box>
            <Text fontSize="xs" color="fg.muted">{"Your vote replaces your validators' votes for your stake. Single choice only."}</Text>
            <Button colorPalette="purple" size={{base: 'lg', md: 'md'}} disabled={!choice} onClick={() => choice && setStep('confirm')}>Continue</Button>
        </>
    );

    const confirm = chosen && (
        <>
            <VStack gap="1" textAlign="center" borderWidth="1px" borderColor={TALLY_COLORS[chosen.key]} bg={TONE[chosen.key].tint} borderRadius="md" p="4">
                <Text fontSize="xs" color="fg.muted">{"You're voting"}</Text>
                <Text fontSize="22px" fontWeight="extrabold" color={TONE[chosen.key].fg}>{chosen.label}</Text>
            </VStack>
            <Box as="dl" display="grid" gridTemplateColumns="auto minmax(0, 1fr)" gap="2 4" fontSize="13px" data-testid="vote-confirm">
                <Row label="Voting power"><Text as="span" fontWeight="semibold">{powerText}</Text></Row>
                <Row label="Replaces">{replaces}</Row>
                <Row label="Network fee">{`≈ ${fee.displayAmount.decimalPlaces(6, BigNumber.ROUND_UP).toFormat()} ${fee.ticker}`}</Row>
            </Box>
            {chosen.key === 'no_with_veto' && (
                <HStack data-testid="veto-warning" align="flex-start" gap="2.5" bg="orange.500/8" borderWidth="1px" borderColor="orange.500/30" borderRadius="md" px="3" py="2.5" fontSize="xs" color="fg.muted">
                    <Box color="orange.fg" mt="0.5" flexShrink={0}><LuTriangleAlert size={15} /></Box>
                    <Text>{vetoWarning(params, proposal, resolve)}</Text>
                </HStack>
            )}
            {step === 'failed' && (
                <HStack role="alert" align="flex-start" gap="2.5" bg="red.subtle" borderWidth="1px" borderColor="red.500/30" borderRadius="md" px="3" py="2.5" fontSize="13px">
                    <Box color="red.fg" mt="0.5" flexShrink={0}><LuCircleX size={16} /></Box>
                    <Text>
                        <Text as="strong" color="red.fg">{"Your vote wasn't sent."}</Text>{' '}
                        <Text as="span" color="fg.muted">{isWalletRejection(error) ? REJECTED : error}</Text>
                    </Text>
                </HStack>
            )}
            <Stack direction={{base: 'column-reverse', md: 'row'}} gap="2">
                <Button variant="outline" flex="1" size={{base: 'lg', md: 'md'}} onClick={() => { setStep('choose'); setError(''); }}>Back</Button>
                <Button colorPalette="purple" flex="2" size={{base: 'lg', md: 'md'}} onClick={sign}>
                    {step === 'failed' ? 'Try again' : 'Sign and vote'}
                </Button>
            </Stack>
        </>
    );

    const signing = chosen && (
        <>
            <VStack aria-live="polite" gap="3" py="6" px="2" textAlign="center">
                <Spinner size="xl" color="purple.solid" borderWidth="3px" />
                <Text fontSize="md" fontWeight="bold">Approve in your wallet</Text>
                <Text fontSize="13px" color="fg.muted" maxW="320px">
                    {isPhone
                        ? `Confirm the ${chosen.label} vote in your wallet app. Nothing is sent until you approve.`
                        : `Confirm the ${chosen.label} vote in Keplr, Leap or your WalletConnect app. Nothing is sent until you approve.`}
                </Text>
                <Text fontSize="xs" color="fg.muted">{progressTrack || 'Waiting for signature…'}</Text>
            </VStack>
            <Button colorPalette="purple" size={{base: 'lg', md: 'md'}} disabled>Signing…</Button>
        </>
    );

    const body = (
        <VStack align="stretch" gap="4">
            {step === 'choose' && choose}
            {(step === 'confirm' || step === 'failed') && confirm}
            {step === 'signing' && signing}
        </VStack>
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
                        <Drawer.Content roundedTop="xl" maxH="92dvh" overflowY="auto" px="5" pt="5" pb="calc(20px + env(safe-area-inset-bottom))" gap="4">
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
                    <Dialog.Content maxW="md" p="6" gap="4">
                        {header}
                        {body}
                        <Dialog.CloseTrigger asChild top="5" insetEnd="5">{close}</Dialog.CloseTrigger>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    );
}
