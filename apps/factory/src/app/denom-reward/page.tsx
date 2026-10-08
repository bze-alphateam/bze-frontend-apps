"use client"

import React, { useEffect, useState } from 'react'
import { Box, Button, Card, Container, HStack, Skeleton, Text, VStack } from '@chakra-ui/react'
import { LuChevronRight, LuGift, LuRefreshCw } from 'react-icons/lu'
import {
    DenomReward,
    TokenLogo,
    getAllDenomRewards,
    getDenomRewardPrizes,
    getDenomRewardSchedules,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
} from '@bze/bze-ui-kit'
import { useNavigation } from '@/hooks/useNavigation'
import { AssetPicker } from '@/components/ui/asset-picker'
import { InfoBox } from '@/components/ui/info-box'
import { denomRewardHref } from '@/lib/denom-reward'

const formatDays = (days: number) => `${days.toLocaleString('en-US')} day${days === 1 ? '' : 's'}`

interface Counts {
    prizes: number;
    schedules: number;
}

/** Prize-denom and running-schedule counts of one DR; undefined while loading, null when the query failed. */
function useDenomRewardCounts(denom: string): Counts | null | undefined {
    const [counts, setCounts] = useState<{ denom: string; value: Counts | null } | undefined>(undefined)

    useEffect(() => {
        let cancelled = false
        Promise.all([getDenomRewardPrizes(denom), getDenomRewardSchedules(denom)])
            .then(([prizes, schedules]) => ({ prizes: prizes.length, schedules: schedules.length }))
            .catch(e => {
                console.error('failed to load the denom reward counts of', denom, e)
                return null
            })
            .then(value => {
                if (!cancelled) setCounts({ denom, value })
            })
        return () => { cancelled = true }
    }, [denom])

    return counts?.denom === denom ? counts.value : undefined
}

function Cell({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <VStack align={{ base: 'start', md: 'end' }} gap={0} minW="20">
            <Text fontSize="xs" color="fg.muted">{label}</Text>
            <Box fontSize="sm" fontWeight="semibold">{value}</Box>
        </VStack>
    )
}

function DirectoryRow({ dr, onOpen }: { dr: DenomReward; onOpen: () => void }) {
    const { asset } = useAsset(dr.staking_denom)
    const counts = useDenomRewardCounts(dr.staking_denom)
    const ticker = asset?.ticker ?? dr.staking_denom
    const staked = uAmountToBigNumberAmount(dr.staked_amount, asset?.decimals ?? 0)
    const count = (pick: (c: Counts) => number) =>
        counts === undefined ? <Skeleton height="4" width="6" /> : counts === null ? '—' : pick(counts)

    return (
        <Card.Root
            variant="outline"
            p="4"
            cursor="pointer"
            _hover={{ borderColor: 'yellow.500/50' }}
            onClick={onOpen}
            data-testid="denom-reward-row"
        >
            <HStack justify="space-between" gap={4} flexWrap="wrap">
                <HStack gap={3} minW={0} flex="1">
                    <TokenLogo src={asset?.logo} symbol={ticker} size="9" circular={true} />
                    <VStack align="start" gap={0} minW={0}>
                        <Text fontWeight="semibold" truncate>{ticker}</Text>
                        {asset?.name && <Text fontSize="xs" color="fg.muted" truncate>{asset.name}</Text>}
                    </VStack>
                </HStack>
                <HStack gap={5} flexWrap="wrap">
                    <Cell label="Total staked" value={`${prettyAmount(staked)} ${ticker}`} />
                    <Cell label="Prize tokens" value={count(c => c.prizes)} />
                    <Cell label="Running schedules" value={count(c => c.schedules)} />
                    <Cell label="Unstaking lock" value={formatDays(dr.lock)} />
                    <Box color="fg.muted"><LuChevronRight /></Box>
                </HStack>
            </HStack>
        </Card.Root>
    )
}

type DirectoryState =
    | { status: 'loading' }
    | { status: 'error' }
    | { status: 'ready'; list: DenomReward[] }

/** Every denom reward on the chain, so funders can find one to add prizes to. */
export default function DenomRewardDirectoryPage() {
    const { navigate } = useNavigation()
    const [state, setState] = useState<DirectoryState>({ status: 'loading' })
    const [reload, setReload] = useState(0)

    useEffect(() => {
        let cancelled = false
        getAllDenomRewards()
            .then((list): DirectoryState => ({ status: 'ready', list }))
            .catch((e): DirectoryState => {
                console.error('failed to load the denom rewards', e)
                return { status: 'error' }
            })
            .then(next => {
                if (!cancelled) setState(next)
            })
        return () => { cancelled = true }
    }, [reload])

    const retry = () => {
        setState({ status: 'loading' })
        setReload(n => n + 1)
    }

    return (
        <Box minH="100vh" bg="bg.subtle">
            <Container maxW="4xl" py={{ base: 6, md: 10 }}>
                <VStack align="stretch" gap={6}>
                    <HStack gap={3}>
                        <Box p={2.5} borderRadius="lg" bg="yellow.500/15" color="yellow.600">
                            <LuGift size={22} />
                        </Box>
                        <VStack align="start" gap={0}>
                            <Text fontSize="2xl" fontWeight="bold" letterSpacing="tight">Denom rewards</Text>
                            <Text fontSize="sm" color="fg.muted">
                                Staking pools where holders of a token earn prizes anyone can fund — with a
                                daily schedule or a one-off airdrop.
                            </Text>
                        </VStack>
                    </HStack>

                    <Card.Root variant="outline" p="4">
                        <AssetPicker
                            label="Open the denom reward of any token"
                            includeLP={true}
                            onSelect={(asset) => navigate(denomRewardHref(asset.denom))}
                        />
                    </Card.Root>

                    {state.status === 'loading' ? (
                        <VStack align="stretch" gap={3}>
                            <Skeleton height="16" />
                            <Skeleton height="16" />
                        </VStack>
                    ) : state.status === 'error' ? (
                        <VStack align="stretch" gap={3}>
                            <InfoBox title="Couldn't load the denom rewards">
                                The chain query failed. The node may be down, or not run chain v8.2.0 yet.
                            </InfoBox>
                            <Box>
                                <Button size="sm" variant="outline" colorPalette="yellow" onClick={retry}>
                                    <LuRefreshCw /> Retry
                                </Button>
                            </Box>
                        </VStack>
                    ) : state.list.length === 0 ? (
                        <Text fontSize="sm" color="fg.muted" data-testid="denom-reward-empty">
                            No token has a denom reward yet. Pick a token above to create the first one.
                        </Text>
                    ) : (
                        <VStack align="stretch" gap={3}>
                            {state.list.map(dr => (
                                <DirectoryRow
                                    key={dr.staking_denom}
                                    dr={dr}
                                    onOpen={() => navigate(denomRewardHref(dr.staking_denom))}
                                />
                            ))}
                        </VStack>
                    )}
                </VStack>
            </Container>
        </Box>
    )
}
