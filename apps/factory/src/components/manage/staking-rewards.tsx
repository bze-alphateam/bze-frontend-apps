"use client"

import React, { useMemo, useState } from 'react'
import {
    Badge,
    Box,
    Button,
    Card,
    Field,
    HStack,
    Input,
    Separator,
    Skeleton,
    Text,
    VStack,
} from '@chakra-ui/react'
import BigNumber from 'bignumber.js'
import { LuArrowUpRight, LuChevronDown, LuChevronRight, LuGift, LuPlus, LuTrash2 } from 'react-icons/lu'
import { bze } from '@bze/bzejs'
import {
    TokenLogo,
    getChainName,
    getStakingApp,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
    useBalance,
} from '@bze/bze-ui-kit'
import type { StakingRewardSDKType } from '@bze/bzejs/bze/rewards/store'
import { useChain } from '@interchain-kit/react'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import { useNavigation } from '@/hooks/useNavigation'
import { useStakingRewards } from '@/hooks/useStakingRewards'
import { splitStakingRewards, stakingRewardDeletion } from '@/lib/staking-rewards'

const { updateStakingReward, deleteStakingReward } = bze.rewards.MessageComposer.withTypeUrl

const openExternal = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')

// Same chain limit as creation: total duration can never exceed 36,500 days.
const MAX_DURATION_DAYS = 36500

function StatPair({ label, value }: { label: string; value: string }) {
    return (
        <VStack align="start" gap="0">
            <Text fontSize="xs" color="fg.muted">{label}</Text>
            <Text fontSize="sm" fontWeight="medium">{value}</Text>
        </VStack>
    )
}

// Extending is permissionless on-chain: anyone willing to escrow the extra
// prize can add days to any program — not just its original creator.
function ExtendPanel({
    reward,
    onExtended,
}: {
    reward: StakingRewardSDKType;
    onExtended: () => void;
}) {
    const { address } = useChain(getChainName())
    const { asset: prizeAsset } = useAsset(reward.prize_denom)
    const { balance } = useBalance(reward.prize_denom)
    const { tx } = useFactoryTx()

    const [extraDays, setExtraDays] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const error = useMemo(() => {
        const trimmed = extraDays.trim()
        if (!trimmed) return 'Required.'
        if (!/^[1-9]\d*$/.test(trimmed)) return 'Enter a whole number of days.'
        if (reward.duration + Number(trimmed) > MAX_DURATION_DAYS) {
            return `Total duration cannot exceed ${MAX_DURATION_DAYS.toLocaleString()} days.`
        }
        return ''
    }, [extraDays, reward.duration])

    // The top-up escrow: the program's fixed daily prize × the extra days.
    const topUpUAmount = useMemo(() => {
        if (error !== '') return undefined
        return new BigNumber(reward.prize_amount).multipliedBy(extraDays.trim())
    }, [error, reward.prize_amount, extraDays])

    const hasEnough = useMemo(() => {
        if (!topUpUAmount) return false
        return balance.amount.gte(topUpUAmount)
    }, [topUpUAmount, balance])

    const canConfirm = Boolean(address) && error === '' && hasEnough

    const submit = async () => {
        if (!address || !canConfirm) return

        const msg = updateStakingReward({
            creator: address,
            rewardId: reward.reward_id,
            duration: extraDays.trim(),
        })

        setIsSubmitting(true)
        try {
            await tx([msg], {
                onSuccess: () => {
                    setExtraDays('')
                    onExtended()
                },
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!prizeAsset) return null

    return (
        <VStack align="stretch" gap={3} pt={3}>
            <Separator />
            <Field.Root invalid={extraDays !== '' && error !== ''}>
                <Field.Label>Extra days</Field.Label>
                <Input
                    placeholder="e.g. 30"
                    inputMode="numeric"
                    value={extraDays}
                    onChange={(e) => setExtraDays(e.target.value)}
                    maxW="40"
                />
                <Field.HelperText>
                    The extra prize is escrowed from your wallet right away — anyone can
                    fund an extension, not just the program&apos;s creator.
                </Field.HelperText>
                <Field.ErrorText>{error}</Field.ErrorText>
            </Field.Root>

            {topUpUAmount && (
                <Text fontSize="sm">
                    Top-up escrow:{' '}
                    <Text as="span" fontWeight="semibold">
                        {prettyAmount(uAmountToBigNumberAmount(topUpUAmount, prizeAsset.decimals))} {prizeAsset.ticker}
                    </Text>
                    {' '}— you have {prettyAmount(uAmountToBigNumberAmount(balance.amount, prizeAsset.decimals))} {prizeAsset.ticker}.
                </Text>
            )}
            {topUpUAmount && address && !hasEnough && (
                <Text fontSize="sm" color="fg.error">
                    Not enough {prizeAsset.ticker} to escrow this extension.
                </Text>
            )}

            <Box>
                <Button
                    size="sm"
                    colorPalette="yellow"
                    onClick={submit}
                    disabled={!canConfirm}
                    loading={isSubmitting}
                    loadingText="Waiting for signature..."
                >
                    Extend program
                </Button>
            </Box>
        </VStack>
    )
}

// MsgDeleteStakingReward (chain v8.2.0) is permissionless too: once a program has paid every day
// and every staker has exited, anyone may remove the record. The chain re-checks both, so a race
// (someone staked in between) comes back as its mapped error and the list is refreshed either way.
function DeletePanel({
    reward,
    onDeleted,
}: {
    reward: StakingRewardSDKType;
    onDeleted: () => void;
}) {
    const { address } = useChain(getChainName())
    const { tx } = useFactoryTx()
    const [isSubmitting, setIsSubmitting] = useState(false)

    const submit = async () => {
        if (!address) return

        const msg = deleteStakingReward({ creator: address, rewardId: reward.reward_id })

        setIsSubmitting(true)
        try {
            await tx([msg], { onSuccess: onDeleted, onFailure: onDeleted })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <VStack align="stretch" gap={3} pt={3} data-testid="staking-reward-delete-panel">
            <Separator />
            <Text fontSize="sm">
                This removes the finished program from the chain. It paid everything it had and
                holds no stake, so nothing is paid out and nothing is lost.
            </Text>
            <Box>
                <Button
                    size="sm"
                    colorPalette="red"
                    onClick={submit}
                    disabled={!address}
                    loading={isSubmitting}
                    loadingText="Waiting for signature..."
                >
                    Delete program #{reward.reward_id}
                </Button>
            </Box>
        </VStack>
    )
}

function RewardRow({
    reward,
    onChanged,
}: {
    reward: StakingRewardSDKType;
    onChanged: () => void;
}) {
    const { asset: stakingAsset } = useAsset(reward.staking_denom)
    const { asset: prizeAsset } = useAsset(reward.prize_denom)
    const [openPanel, setOpenPanel] = useState<'extend' | 'delete' | undefined>()
    const togglePanel = (panel: 'extend' | 'delete') => setOpenPanel(open => (open === panel ? undefined : panel))

    const deletion = stakingRewardDeletion(reward)
    const stakedLeft = deletion.kind === 'staked'
        ? `${stakingAsset ? prettyAmount(uAmountToBigNumberAmount(deletion.stakedAmount, stakingAsset.decimals)) : deletion.stakedAmount} ${stakingAsset?.ticker ?? reward.staking_denom}`
        : ''

    const stakingUrl = getStakingApp().href

    const daysRemaining = reward.duration - reward.payouts
    const minStake = new BigNumber(reward.min_stake.toString())

    return (
        <Card.Root
            variant="outline"
            p="4"
            bgGradient="to-br"
            gradientFrom="yellow.500/8"
            gradientTo="yellow.600/8"
            borderColor="yellow.500/20"
        >
            <VStack align="stretch" gap={3}>
                <HStack justify="space-between" align="center" gap={4} flexWrap="wrap">
                    <HStack gap="3" minW="0">
                        <HStack gap="0">
                            <TokenLogo src={stakingAsset?.logo ?? ''} symbol={stakingAsset?.ticker ?? '?'} size="10" circular={true} />
                            <Box ml="-3">
                                <TokenLogo src={prizeAsset?.logo ?? ''} symbol={prizeAsset?.ticker ?? '?'} size="10" circular={true} />
                            </Box>
                        </HStack>
                        <VStack align="start" gap="0.5" minW="0">
                            <Text fontWeight="semibold">
                                Stake {stakingAsset?.ticker ?? reward.staking_denom}, earn {prizeAsset?.ticker ?? reward.prize_denom}
                            </Text>
                            <HStack gap="1.5">
                                <Badge colorPalette="yellow" variant="surface" size="sm" fontFamily="mono">
                                    #{reward.reward_id}
                                </Badge>
                                {deletion.kind !== 'running' && (
                                    <Badge colorPalette="gray" variant="subtle" size="sm">Finished</Badge>
                                )}
                            </HStack>
                        </VStack>
                    </HStack>

                    <HStack gap={2} flexWrap="wrap">
                        <Button
                            size="sm"
                            variant={openPanel === 'extend' ? 'solid' : 'outline'}
                            colorPalette="yellow"
                            onClick={() => togglePanel('extend')}
                        >
                            <LuPlus />
                            Extend
                        </Button>
                        {deletion.kind !== 'running' && (
                            <Button
                                size="sm"
                                variant={openPanel === 'delete' ? 'solid' : 'outline'}
                                colorPalette="red"
                                disabled={deletion.kind !== 'deletable'}
                                onClick={() => togglePanel('delete')}
                            >
                                <LuTrash2 />
                                Delete
                            </Button>
                        )}
                        <Button size="sm" variant="outline" colorPalette="yellow" onClick={() => openExternal(stakingUrl)}>
                            View on Staking app <LuArrowUpRight />
                        </Button>
                    </HStack>
                </HStack>

                <HStack gap={6} flexWrap="wrap">
                    <StatPair
                        label="Prize per day"
                        value={prizeAsset
                            ? `${prettyAmount(uAmountToBigNumberAmount(reward.prize_amount, prizeAsset.decimals))} ${prizeAsset.ticker}`
                            : reward.prize_amount}
                    />
                    <StatPair label="Days left" value={`${daysRemaining} of ${reward.duration}`} />
                    <StatPair label="Lock" value={reward.lock > 0 ? `${reward.lock} days` : 'None'} />
                    {minStake.gt(0) && stakingAsset && (
                        <StatPair
                            label="Min stake"
                            value={`${prettyAmount(uAmountToBigNumberAmount(minStake, stakingAsset.decimals))} ${stakingAsset.ticker}`}
                        />
                    )}
                    <StatPair
                        label="Currently staked"
                        value={stakingAsset
                            ? `${prettyAmount(uAmountToBigNumberAmount(reward.staked_amount, stakingAsset.decimals))} ${stakingAsset.ticker}`
                            : reward.staked_amount}
                    />
                </HStack>

                {stakedLeft && (
                    <Text fontSize="xs" color="fg.muted" data-testid="staking-reward-delete-blocker">
                        {stakedLeft} still staked — stakers must exit first before it can be deleted.
                    </Text>
                )}

                {openPanel === 'extend' && <ExtendPanel reward={reward} onExtended={onChanged} />}
                {openPanel === 'delete' && deletion.kind === 'deletable' && <DeletePanel reward={reward} onDeleted={onChanged} />}
            </VStack>
        </Card.Root>
    )
}

function RewardRowSkeleton() {
    return (
        <Card.Root variant="outline" p="4">
            <HStack justify="space-between" align="center" gap={4}>
                <HStack gap="3">
                    <Skeleton borderRadius="full" boxSize="10" />
                    <VStack align="start" gap="2">
                        <Skeleton height="4" width="40" />
                        <Skeleton height="3" width="24" />
                    </VStack>
                </HStack>
                <Skeleton height="6" width="24" />
            </HStack>
        </Card.Root>
    )
}

/** Finished programs, collapsed by default so they stop cluttering the running ones. */
function FinishedRewards({ rewards, onChanged }: { rewards: StakingRewardSDKType[]; onChanged: () => void }) {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <VStack align="stretch" gap={3} data-testid="finished-staking-rewards">
            <Box>
                <Button size="sm" variant="ghost" onClick={() => setIsOpen(open => !open)} aria-expanded={isOpen}>
                    {isOpen ? <LuChevronDown /> : <LuChevronRight />}
                    Finished ({rewards.length})
                </Button>
            </Box>
            {isOpen && rewards.map(reward => (
                <RewardRow key={reward.reward_id} reward={reward} onChanged={onChanged} />
            ))}
        </VStack>
    )
}

/**
 * All staking reward programs on the chain, running ones first and finished ones in a collapsed
 * group (where an emptied one can be deleted). The chain stores no creator on a reward,
 * so this is the full list rather than "mine" — and extensions are open to
 * anyone willing to escrow the extra prize.
 */
export function StakingRewards() {
    const { rewards, isLoading, refresh } = useStakingRewards()
    const { navigate } = useNavigation()
    const { active, finished } = useMemo(() => splitStakingRewards(rewards), [rewards])

    return (
        <VStack align="stretch" gap={4}>
            <HStack justify="space-between" align="start" flexWrap="wrap" gap={3}>
                <VStack align="start" gap={1}>
                    <Text fontSize="xl" fontWeight="bold" letterSpacing="tight">
                        Staking Rewards
                    </Text>
                    <Text fontSize="sm" color="fg.muted">
                        Reward programs on the chain — extend any of them with extra days, or delete a finished, emptied one.
                    </Text>
                </VStack>
                <Button size="sm" colorPalette="yellow" variant="outline" onClick={() => navigate('/reward/new')}>
                    <LuPlus />
                    New reward
                </Button>
            </HStack>

            {isLoading ? (
                <VStack align="stretch" gap={3}>
                    <RewardRowSkeleton />
                </VStack>
            ) : rewards.length === 0 ? (
                <Card.Root variant="outline" p="8">
                    <VStack gap={4}>
                        <Box p={3} borderRadius="lg" bg="yellow.500/15" color="yellow.600">
                            <LuGift size={24} />
                        </Box>
                        <VStack gap={1}>
                            <Text fontWeight="semibold">No reward programs yet</Text>
                            <Text fontSize="sm" color="fg.muted" textAlign="center">
                                Fund a staking program — your community stakes a token and earns
                                your prize, day by day.
                            </Text>
                        </VStack>
                        <Button colorPalette="yellow" variant="outline" onClick={() => navigate('/reward/new')}>
                            <LuPlus />
                            Create a staking reward
                        </Button>
                    </VStack>
                </Card.Root>
            ) : (
                <VStack align="stretch" gap={3}>
                    {active.map(reward => (
                        <RewardRow key={reward.reward_id} reward={reward} onChanged={refresh} />
                    ))}
                    {active.length === 0 && (
                        <Text fontSize="sm" color="fg.muted">No running programs — every program below has paid all its days.</Text>
                    )}
                    {finished.length > 0 && <FinishedRewards rewards={finished} onChanged={refresh} />}
                </VStack>
            )}
        </VStack>
    )
}
