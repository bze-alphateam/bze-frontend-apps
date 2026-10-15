"use client"

import React, { Suspense, useEffect, useState } from 'react'
import { Badge, Box, Button, Circle, Container, HStack, Link, Skeleton, Text, VStack } from '@chakra-ui/react'
import { LuArrowLeft, LuCheck } from 'react-icons/lu'
import { useSearchParams } from 'next/navigation'
import { TokenLogo, useAssets } from '@bze/bze-ui-kit'
import { PlaybookCards } from '@/components/home/playbooks-section'
import { useMyTokens } from '@/hooks/useMyTokens'
import { useNavigation } from '@/hooks/useNavigation'
import { usePlaybookFacts } from '@/hooks/usePlaybookFacts'
import {
    type Playbook,
    type PlaybookFacts,
    type PlaybookProgress,
    type StepStatus,
    chooseToken,
    loadPlaybookProgress,
    markDone,
    playbookById,
    playbookHref,
    progressOnLoad,
    savePlaybookProgress,
    stepHref,
    stepStatuses,
} from '@/lib/playbooks'

const NO_FACTS: PlaybookFacts = { items: [], lpCampaign: false }

function StepCard({ playbook, status, index, facts, onMarkDone }: {
    playbook: Playbook;
    status: StepStatus;
    index: number;
    facts: PlaybookFacts;
    onMarkDone: () => void;
}) {
    const { navigate } = useNavigation()
    const { step, state, manual } = status
    const waiting = step.needsToken !== false && !facts.denom
    const current = state === 'current'

    return (
        <Box
            as="li"
            listStyleType="none"
            p={4}
            borderRadius="xl"
            borderWidth="1px"
            borderColor={current ? 'yellow.500/50' : 'border.muted'}
            bg={state === 'done' ? 'bg.subtle' : 'bg.panel'}
            data-testid={`playbook-step-${step.goalId}`}
            data-state={state}
        >
            <HStack align="start" gap={3}>
                <Circle size="7" flexShrink={0} bg={state === 'done' ? 'green.500' : current ? 'yellow.500' : 'bg.muted'} color={state === 'later' ? 'fg.muted' : 'white'} fontSize="sm" fontWeight="bold">
                    {state === 'done' ? <LuCheck size={14} /> : index + 1}
                </Circle>
                {state === 'done' ? (
                    <Text fontSize="sm" color="fg.muted" pt={1}>{step.doneText}</Text>
                ) : (
                    <VStack align="stretch" gap={2} flex="1" minW={0}>
                        <HStack gap={2} flexWrap="wrap">
                            <Text fontWeight="semibold">{step.title}</Text>
                            {current && <Badge colorPalette="yellow" size="sm">Current</Badge>}
                        </HStack>
                        <Text fontSize="sm" color="fg.muted">{step.why}</Text>
                        <HStack gap={3} flexWrap="wrap">
                            <Button
                                size="sm"
                                colorPalette="yellow"
                                variant={current ? 'solid' : 'outline'}
                                disabled={waiting}
                                onClick={() => navigate(stepHref(playbook, step, facts))}
                            >
                                {step.action}
                            </Button>
                            {manual && (
                                <Link as="button" fontSize="sm" color="yellow.fg" onClick={onMarkDone}>Mark as done</Link>
                            )}
                            {waiting && <Text fontSize="xs" color="fg.muted">Choose the token first.</Text>}
                        </HStack>
                    </VStack>
                )}
            </HStack>
        </Box>
    )
}

function TokenChoice({ denom, onChoose }: { denom?: string; onChoose: (denom: string) => void }) {
    const { tokens, isLoading } = useMyTokens()
    return (
        <VStack as="section" aria-label="Which token is this for?" align="stretch" gap={2}>
            <Text fontWeight="semibold">Which token is this for?</Text>
            {isLoading ? (
                <Skeleton height="10" borderRadius="lg" />
            ) : tokens.length === 0 ? (
                <Text fontSize="sm" color="fg.muted">Connect the wallet that created your token to pick it.</Text>
            ) : (
                <HStack gap={2} flexWrap="wrap">
                    {tokens.map(({ asset }) => (
                        <Button
                            key={asset.denom}
                            size="sm"
                            variant={asset.denom === denom ? 'solid' : 'outline'}
                            colorPalette="yellow"
                            aria-pressed={asset.denom === denom}
                            onClick={() => onChoose(asset.denom)}
                        >
                            <TokenLogo src={asset.logo} symbol={asset.ticker} size="5" circular={true} />
                            {asset.ticker}
                        </Button>
                    ))}
                </HStack>
            )}
        </VStack>
    )
}

function Steps({ playbook, facts, progress, onMarkDone }: {
    playbook: Playbook;
    facts: PlaybookFacts;
    progress?: PlaybookProgress;
    onMarkDone: (step: string) => void;
}) {
    const { navigate } = useNavigation()
    const { denomTicker } = useAssets()
    const statuses = stepStatuses(playbook, facts, progress?.manualDone ?? [])
    const allDone = statuses.every(s => s.state === 'done')

    return (
        <VStack align="stretch" gap={4}>
            <VStack as="ol" align="stretch" gap={3} ps={0} m={0} aria-label="Steps">
                {statuses.map((status, i) => (
                    <StepCard
                        key={status.step.goalId}
                        playbook={playbook}
                        status={status}
                        index={i}
                        facts={facts}
                        onMarkDone={() => onMarkDone(status.step.goalId)}
                    />
                ))}
            </VStack>
            {allDone && facts.denom && (
                <VStack gap={3} p={5} borderRadius="xl" borderWidth="1px" borderColor="green.500/30" bg="bg.panel" data-testid="playbook-done">
                    <Text fontWeight="bold" textAlign="center">{`Done. ${denomTicker(facts.denom)} now ${playbook.outcome}`}</Text>
                    <Button colorPalette="yellow" onClick={() => navigate('/')}>Back to the Factory</Button>
                </VStack>
            )}
        </VStack>
    )
}

/** Steps with the chosen token's chain state; mounted only once there is a token. */
function DetectedSteps(props: { playbook: Playbook; denom: string; progress?: PlaybookProgress; onMarkDone: (step: string) => void }) {
    const { isLoading, ...facts } = usePlaybookFacts(props.playbook, props.denom)
    if (isLoading) return <Skeleton height="64" borderRadius="xl" data-testid="playbook-loading" />
    return <Steps {...props} facts={facts} />
}

function PlaybookContent({ playbook }: { playbook: Playbook }) {
    const searchParams = useSearchParams()
    const { replace } = useNavigation()
    const step = searchParams.get('step')
    const completed = searchParams.get('completed')

    // The page renders on the client only (search params under a Suspense boundary), so the
    // stored progress and the URL seed the first render.
    const [progress, setProgress] = useState(() => progressOnLoad(
        loadPlaybookProgress(playbook.id),
        { denom: searchParams.get('denom'), step, completed },
        playbook,
    ))
    const denom = progress?.denom

    useEffect(() => {
        if (progress) savePlaybookProgress(playbook.id, progress)
    }, [playbook.id, progress])

    // The return markers did their job (or a back link brought them): keep the URL clean.
    useEffect(() => {
        if (step || completed) replace(playbookHref(playbook.id, denom))
    }, [step, completed, replace, playbook.id, denom])

    const update = (next: PlaybookProgress) => {
        setProgress(next)
        replace(playbookHref(playbook.id, next.denom))
    }
    const onMarkDone = (goalId: string) => setProgress(p => markDone(p, goalId))
    const showChoice = playbook.id !== 'launch' || Boolean(denom)

    return (
        <VStack align="stretch" gap={6}>
            <VStack align="start" gap={2}>
                <Text as="h1" fontSize={{ base: '2xl', md: '3xl' }} fontWeight="bold" letterSpacing="tight">{playbook.title}</Text>
                <Text color="fg.muted">{playbook.pitch}</Text>
                <HStack gap={3} fontSize="sm" color="fg.muted" flexWrap="wrap">
                    <Text>{playbook.time}</Text>
                    <Text>·</Text>
                    <Text>Leave any time, your progress stays.</Text>
                </HStack>
            </VStack>

            {showChoice && <TokenChoice denom={denom} onChoose={(d) => update(chooseToken(progress, d))} />}

            {denom ? (
                <DetectedSteps playbook={playbook} denom={denom} progress={progress} onMarkDone={onMarkDone} />
            ) : (
                <Steps playbook={playbook} facts={NO_FACTS} progress={progress} onMarkDone={onMarkDone} />
            )}
        </VStack>
    )
}

function PlaybooksPageContent() {
    const searchParams = useSearchParams()
    const { navigate } = useNavigation()
    const playbook = playbookById(searchParams.get('id'))

    return (
        <VStack align="stretch" gap={6}>
            <Link as="button" alignSelf="start" fontSize="sm" color="fg.muted" onClick={() => navigate('/')}>
                <LuArrowLeft /> What do you want to do?
            </Link>
            {playbook ? (
                <PlaybookContent key={playbook.id} playbook={playbook} />
            ) : (
                <VStack align="stretch" gap={4}>
                    <Text as="h1" fontSize="2xl" fontWeight="bold">Playbooks</Text>
                    <PlaybookCards />
                </VStack>
            )}
        </VStack>
    )
}

export default function PlaybooksPage() {
    return (
        <Box minH="100vh" bg="bg.subtle">
            <Container maxW="3xl" py={{ base: 6, md: 10 }}>
                <Suspense fallback={<Skeleton height="96" />}>
                    <PlaybooksPageContent />
                </Suspense>
            </Container>
        </Box>
    )
}
