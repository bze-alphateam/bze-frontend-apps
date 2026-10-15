"use client"

import React, { useSyncExternalStore } from 'react'
import { Box, Grid, Text, VStack } from '@chakra-ui/react'
import { getFromLocalStorage } from '@bze/bze-ui-kit'
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

const progressText = (done: number, total: number) => `${done} of ${total}`

function DetectedProgress({ playbook, progress, denom }: { playbook: Playbook; progress: PlaybookProgress; denom: string }) {
    const { isLoading, ...facts } = usePlaybookFacts(playbook, denom)
    if (isLoading) return null
    const done = stepStatuses(playbook, facts, progress.manualDone).filter(s => s.state === 'done').length
    return <>{progressText(done, playbook.steps.length)}</>
}

function Progress({ playbook, progress }: { playbook: Playbook; progress: PlaybookProgress }) {
    const content = progress.denom
        ? <DetectedProgress playbook={playbook} progress={progress} denom={progress.denom} />
        : progressText(
            stepStatuses(playbook, { items: [], lpCampaign: false }, progress.manualDone).filter(s => s.state === 'done').length,
            playbook.steps.length,
        )
    return <Text fontSize="xs" fontWeight="semibold" color="yellow.fg" data-testid="playbook-progress">{content}</Text>
}

function PlaybookCard({ playbook }: { playbook: Playbook }) {
    const { navigate } = useNavigation()
    const progress = useStoredProgress(playbook)

    return (
        <Box
            as="button"
            textAlign="start"
            p={4}
            borderRadius="xl"
            borderWidth="1px"
            borderColor="yellow.500/20"
            bg="bg.panel"
            _hover={{ borderColor: 'yellow.500/50' }}
            onClick={() => navigate(playbookHref(playbook.id))}
            data-testid={`playbook-${playbook.id}`}
        >
            <VStack align="stretch" gap={2}>
                <Text fontWeight="semibold">{playbook.title}</Text>
                <Text fontSize="sm" color="fg.muted">{playbook.pitch}</Text>
                <Text fontSize="xs" fontFamily="mono" color="fg.subtle">{playbook.steps.map(s => s.short).join(' → ')}</Text>
                <Text fontSize="xs" color="fg.muted">{playbook.time}</Text>
                {progress && <Progress playbook={playbook} progress={progress} />}
            </VStack>
        </Box>
    )
}

/** The three playbook cards, each opening `/playbooks?id=`. */
export function PlaybookCards() {
    return (
        <Grid templateColumns={{ base: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' }} gap={3}>
            {PLAYBOOKS.map(p => <PlaybookCard key={p.id} playbook={p} />)}
        </Grid>
    )
}

/** "New here? Follow a playbook" on the home page (BFE-169). */
export function PlaybooksSection() {
    return (
        <VStack as="section" aria-label="New here? Follow a playbook" align="stretch" gap={3}>
            <VStack align="start" gap={0}>
                <Text as="h2" fontSize="lg" fontWeight="bold">New here? Follow a playbook</Text>
                <Text fontSize="sm" color="fg.muted">Proven recipes, step by step. Leave any time, your progress stays.</Text>
            </VStack>
            <PlaybookCards />
        </VStack>
    )
}
