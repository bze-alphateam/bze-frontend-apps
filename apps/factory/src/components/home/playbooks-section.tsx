"use client"

import React, { useSyncExternalStore } from 'react'
import { Box, Flex, Grid, Text, VStack } from '@chakra-ui/react'
import { HgCard, getFromLocalStorage } from '@bze/bze-ui-kit'
import { useNavigation } from '@/hooks/useNavigation'
import { usePlaybookFacts } from '@/hooks/usePlaybookFacts'
import {
    PLAYBOOKS,
    type Playbook,
    type PlaybookProgress,
    parsePlaybookProgress,
    playbookHref,
    playbookProgressKey,
    stepStatuses,
} from '@/lib/playbooks'

const subscribeToStorage = (onChange: () => void) => {
    window.addEventListener('storage', onChange)
    return () => window.removeEventListener('storage', onChange)
}

/** The playbook's stored progress; nothing on the server, so the prerendered page matches. */
function useStoredProgress(playbook: Playbook): PlaybookProgress | undefined {
    const raw = useSyncExternalStore(
        subscribeToStorage,
        () => getFromLocalStorage(playbookProgressKey(playbook.id)),
        () => null,
    )
    return parsePlaybookProgress(raw)
}

/** "2 of 5" with the same number drawn as a bar. */
function ProgressLine({ done, total }: { done: number; total: number }) {
    return (
        <Flex align="center" gap="10px" mt="4px">
            <Box flex="1" h="6px" borderRadius="hg.pill" bg="hg.inset" overflow="hidden" aria-hidden>
                <Box h="100%" w={`${Math.round((done / total) * 100)}%`} bgImage="app" />
            </Box>
            <Text fontSize="12px" fontWeight="700" color="hg.link" data-testid="playbook-progress">{`${done} of ${total}`}</Text>
        </Flex>
    )
}

function DetectedProgress({ playbook, progress, denom }: { playbook: Playbook; progress: PlaybookProgress; denom: string }) {
    const { isLoading, ...facts } = usePlaybookFacts(playbook, denom)
    if (isLoading) return null
    const done = stepStatuses(playbook, facts, progress.manualDone).filter(s => s.state === 'done').length
    return <ProgressLine done={done} total={playbook.steps.length} />
}

function Progress({ playbook, progress }: { playbook: Playbook; progress: PlaybookProgress }) {
    if (progress.denom) return <DetectedProgress playbook={playbook} progress={progress} denom={progress.denom} />
    const done = stepStatuses(playbook, { items: [], lpCampaign: false }, progress.manualDone).filter(s => s.state === 'done').length
    return <ProgressLine done={done} total={playbook.steps.length} />
}

function PlaybookCard({ playbook }: { playbook: Playbook }) {
    const { navigate } = useNavigation()
    const progress = useStoredProgress(playbook)

    return (
        <HgCard
            as="button"
            interactive
            textAlign="start"
            p="20px"
            cursor="pointer"
            color="fg"
            focusVisibleRing="outside"
            onClick={() => navigate(playbookHref(playbook.id))}
            data-testid={`playbook-${playbook.id}`}
        >
            <VStack align="stretch" gap="10px">
                <Text as="strong" fontSize="16px" fontWeight="700">{playbook.title}</Text>
                <Text fontSize="14px" lineHeight="1.5" color="fg.muted">{playbook.pitch}</Text>
                <Text fontSize="12px" fontFamily="mono" color="hg.text.faint">{playbook.steps.map(s => s.short).join(' → ')}</Text>
                <Text fontSize="13px" color="fg.muted">{playbook.time}</Text>
                {progress && <Progress playbook={playbook} progress={progress} />}
            </VStack>
        </HgCard>
    )
}

/** The three playbook cards, each opening `/playbooks?id=`. */
export function PlaybookCards() {
    return (
        <Grid templateColumns={{ base: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' }} gap="16px">
            {PLAYBOOKS.map(p => <PlaybookCard key={p.id} playbook={p} />)}
        </Grid>
    )
}

/** "New here? Follow a playbook" on the home page (BFE-169). */
export function PlaybooksSection() {
    return (
        <VStack as="section" aria-label="New here? Follow a playbook" align="stretch" gap="14px">
            <VStack align="start" gap="4px">
                <Text as="h2" fontSize="20px" fontWeight="700">New here? Follow a playbook</Text>
                <Text fontSize="14px" color="fg.muted">Proven recipes, step by step. Leave any time, your progress stays.</Text>
            </VStack>
            <PlaybookCards />
        </VStack>
    )
}
