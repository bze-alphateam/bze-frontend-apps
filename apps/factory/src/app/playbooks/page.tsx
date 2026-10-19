"use client"

import React, { Suspense, useEffect, useState } from 'react'
import { Box, Button, chakra, Circle, Flex, Grid, HStack, Text, VStack } from '@chakra-ui/react'
import { LuCheck } from 'react-icons/lu'
import { useSearchParams } from 'next/navigation'
import { FeaturedCard, HgCard, PageContainer, Shimmer, TokenLogo, hgVariant, useAssets } from '@bze/bze-ui-kit'
import { InnerHero } from '@/components/ui/inner-hero'
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

/** The step's number disc: green check when done, the app gradient when current, quiet otherwise. */
function StepDisc({ state, n }: { state: StepStatus['state']; n: number }) {
    const look = state === 'done'
        ? { bg: 'hg.success/16', borderWidth: '1px', borderColor: 'hg.success/45', color: 'hg.success.text' }
        : state === 'current'
            ? { bgImage: 'app', color: 'hg.buttonText' }
            : { bg: 'hg.inset', color: 'fg.muted' }
    return (
        <Circle size="28px" flexShrink={0} fontSize="13px" fontWeight="800" aria-hidden {...look}>
            {state === 'done' ? <LuCheck size={14} strokeWidth={3} /> : n}
        </Circle>
    )
}

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

    if (state === 'done') {
        return (
            <Flex
                as="li"
                listStyleType="none"
                align="center"
                gap="14px"
                px="20px"
                py="14px"
                borderRadius="16px"
                bg="hg.inset"
                borderWidth="1px"
                borderColor="hg.divider"
                data-testid={`playbook-step-${step.goalId}`}
                data-state={state}
            >
                <StepDisc state={state} n={index + 1} />
                <Text fontSize="14px" color="fg.muted">{step.doneText}</Text>
            </Flex>
        )
    }

    const body = (
        <Flex align="start" gap="14px">
            <StepDisc state={state} n={index + 1} />
            <VStack align="stretch" gap="10px" flex="1" minW={0}>
                <HStack gap="8px" flexWrap="wrap">
                    <Text as="strong" fontSize="16px" fontWeight="700">{step.title}</Text>
                    {current && (
                        <chakra.span fontSize="11px" fontWeight="700" px="8px" py="3px" borderRadius="hg.pill" color="hg.link" bg="app.subtle" borderWidth="1px" borderColor="app.border">
                            Current
                        </chakra.span>
                    )}
                </HStack>
                <Text fontSize="14px" lineHeight="1.5" color="fg.muted">{step.why}</Text>
                <HStack gap="14px" flexWrap="wrap">
                    <Button
                        size={current ? 'lg' : 'md'}
                        variant={current ? hgVariant('primary') : hgVariant('secondary')}
                        disabled={waiting}
                        onClick={() => navigate(stepHref(playbook, step, facts))}
                    >
                        {step.action}
                    </Button>
                    {manual && (
                        <chakra.button
                            type="button"
                            bg="transparent"
                            border="0"
                            p="0"
                            fontSize="14px"
                            fontWeight="600"
                            color="hg.link"
                            cursor="pointer"
                            _hover={{ textDecoration: 'underline' }}
                            onClick={onMarkDone}
                        >
                            Mark as done
                        </chakra.button>
                    )}
                    {waiting && <Text fontSize="12px" color="hg.text.faint">Choose the token first.</Text>}
                </HStack>
            </VStack>
        </Flex>
    )

    return (
        <Box as="li" listStyleType="none" data-testid={`playbook-step-${step.goalId}`} data-state={state}>
            {current ? <FeaturedCard p="20px">{body}</FeaturedCard> : <HgCard p="20px">{body}</HgCard>}
        </Box>
    )
}

function TokenChoice({ denom, onChoose }: { denom?: string; onChoose: (denom: string) => void }) {
    const { tokens, isLoading } = useMyTokens()
    return (
        <HgCard as="section" aria-label="Which token is this for?" px="20px" py="18px" display="flex" flexDirection="column" gap="12px">
            <Text as="strong" fontSize="15px" fontWeight="700">Which token is this for?</Text>
            {isLoading ? (
                <Shimmer h="36px" borderRadius="10px" />
            ) : tokens.length === 0 ? (
                <Text fontSize="13px" lineHeight="1.5" color="fg.muted">Connect the wallet that created your token to pick it.</Text>
            ) : (
                <HStack gap="8px" flexWrap="wrap">
                    {tokens.map(({ asset }) => {
                        const chosen = asset.denom === denom
                        return (
                            <Button
                                key={asset.denom}
                                size="md"
                                ps="6px"
                                variant={chosen ? hgVariant('primary') : 'outline'}
                                {...(chosen ? {} : { borderColor: 'app.border', bg: 'app.subtle', color: 'fg', borderRadius: 'hg.md', _hover: { bg: 'app.muted' } })}
                                aria-pressed={chosen}
                                onClick={() => onChoose(asset.denom)}
                            >
                                <TokenLogo src={asset.logo} symbol={asset.ticker} size="5" circular={true} />
                                {asset.ticker}
                            </Button>
                        )
                    })}
                </HStack>
            )}
        </HgCard>
    )
}

function Steps({ playbook, facts, progress, onMarkDone }: {
    playbook: Playbook;
    facts: PlaybookFacts;
    progress?: PlaybookProgress;
    onMarkDone: (step: string) => void;
}) {
    const statuses = stepStatuses(playbook, facts, progress?.manualDone ?? [])

    return (
        <VStack as="ol" align="stretch" gap="12px" ps={0} m={0} aria-label="Steps">
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
    )
}

/** "Done. TICKER now …": shown next to the steps once every step is done for the chosen token. */
function PlaybookDone({ playbook, facts, progress }: { playbook: Playbook; facts: PlaybookFacts; progress?: PlaybookProgress }) {
    const { navigate } = useNavigation()
    const { denomTicker } = useAssets()
    const allDone = stepStatuses(playbook, facts, progress?.manualDone ?? []).every(s => s.state === 'done')
    if (!allDone || !facts.denom) return null

    return (
        <HgCard gridArea="done" minW={0} borderColor="hg.success/30" display="flex" flexDirection="column" alignItems="center" gap="14px" textAlign="center" data-testid="playbook-done">
            <Text as="strong" fontSize="15px" lineHeight="1.45" fontWeight="700">{`Done. ${denomTicker(facts.denom)} now ${playbook.outcome}`}</Text>
            <Button variant={hgVariant('primary')} size="lg" onClick={() => navigate('/')}>Back to the Factory</Button>
        </HgCard>
    )
}

/** The steps and the outcome for the facts at hand; they fill the layout's `steps` and `done` areas. */
function PlaybookBody({ playbook, facts, progress, onMarkDone }: {
    playbook: Playbook;
    facts: PlaybookFacts;
    progress?: PlaybookProgress;
    onMarkDone: (step: string) => void;
}) {
    return (
        <>
            <Box gridArea="steps" minW={0}>
                <Steps playbook={playbook} facts={facts} progress={progress} onMarkDone={onMarkDone} />
            </Box>
            <PlaybookDone playbook={playbook} facts={facts} progress={progress} />
        </>
    )
}

/** Steps with the chosen token's chain state; mounted only once there is a token. */
function DetectedSteps(props: { playbook: Playbook; denom: string; progress?: PlaybookProgress; onMarkDone: (step: string) => void }) {
    const { isLoading, ...facts } = usePlaybookFacts(props.playbook, props.denom)
    if (isLoading) {
        return (
            <Box gridArea="steps" minW={0}>
                <Shimmer h="256px" borderRadius="16px" data-testid="playbook-loading" />
            </Box>
        )
    }
    return <PlaybookBody {...props} facts={facts} />
}

/**
 * The steps beside the token choice and the outcome; on narrow screens the choice comes first.
 * The choice sits outside the steps' subtree, so picking a token never remounts it.
 */
function PlaybookLayout({ side, children }: { side?: React.ReactNode; children: React.ReactNode }) {
    return (
        <Grid
            gap="24px"
            alignItems="start"
            templateColumns={side ? { base: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 380px' } : 'minmax(0, 1fr)'}
            templateRows={side ? { lg: 'auto 1fr' } : undefined}
            templateAreas={side
                ? { base: '"side" "steps" "done"', lg: '"steps side" "steps done"' }
                : '"steps" "done"'}
        >
            {side && <Box as="aside" gridArea="side" minW={0}>{side}</Box>}
            {children}
        </Grid>
    )
}

function PlaybookContent({ playbook }: { playbook: Playbook }) {
    const searchParams = useSearchParams()
    const { navigate, replace } = useNavigation()
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

    const choice = showChoice ? <TokenChoice denom={denom} onChoose={(d) => update(chooseToken(progress, d))} /> : undefined

    return (
        <>
            <InnerHero
                back={{ label: 'What do you want to do?', onClick: () => navigate('/') }}
                eyebrow="Playbook"
                title={playbook.title}
                subtitle={playbook.pitch}
                meta={(
                    <>
                        <Text as="span">{playbook.time}</Text>
                        <Text as="span" aria-hidden>·</Text>
                        <Text as="span">Leave any time, your progress stays.</Text>
                    </>
                )}
            />
            <PageContainer as="main" pt="32px" pb="64px">
                <PlaybookLayout side={choice}>
                    {denom ? (
                        <DetectedSteps playbook={playbook} denom={denom} progress={progress} onMarkDone={onMarkDone} />
                    ) : (
                        <PlaybookBody playbook={playbook} facts={NO_FACTS} progress={progress} onMarkDone={onMarkDone} />
                    )}
                </PlaybookLayout>
            </PageContainer>
        </>
    )
}

function PlaybooksPageContent() {
    const searchParams = useSearchParams()
    const { navigate } = useNavigation()
    const playbook = playbookById(searchParams.get('id'))

    if (playbook) return <PlaybookContent key={playbook.id} playbook={playbook} />

    return (
        <>
            <InnerHero
                back={{ label: 'What do you want to do?', onClick: () => navigate('/') }}
                title="Playbooks"
                subtitle="Proven recipes, step by step. Leave any time, your progress stays."
            />
            <PageContainer as="main" pt="32px" pb="64px">
                <PlaybookCards />
            </PageContainer>
        </>
    )
}

export default function PlaybooksPage() {
    return (
        <Box minH="100vh">
            <Suspense fallback={<PageContainer pt="32px"><Shimmer h="384px" borderRadius="16px" /></PageContainer>}>
                <PlaybooksPageContent />
            </Suspense>
        </Box>
    )
}
