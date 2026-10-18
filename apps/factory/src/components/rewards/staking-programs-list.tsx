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
import { LuChevronDown, LuChevronRight, LuGift, LuPlus, LuRefreshCw, LuTrash2 } from 'react-icons/lu'
import { bze } from '@bze/bzejs'
import {
    AppButton,
    TokenLogo,
    getChainName,
    getStakingApp,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
    useAssets,
    useBalance,
    useLiquidityPools,
} from '@bze/bze-ui-kit'
import type { StakingRewardSDKType } from '@bze/bzejs/bze/rewards/store'
import { useChain } from '@interchain-kit/react'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import { useNavigation } from '@/hooks/useNavigation'
import { StakingRewardsState, useStakingRewards } from '@/hooks/useStakingRewards'
import { ReturnTo, withReturn } from '@/components/guided/return-to'
import { InfoBox } from '@/components/ui/info-box'
import { filterMyTokens } from '@/lib/my-tokens'
import { ProgramStatus } from '@/lib/rewards-directory'
import { programInvolves, splitStakingRewards, stakingRewardDeletion } from '@/lib/staking-rewards'

const { updateStakingReward, deleteStakingReward } = bze.rewards.MessageComposer.withTypeUrl

// Same chain limit as creation: total duration can never exceed 36,500 days.
const MAX_DURATION_DAYS = 36500

const STATUSES: { value: ProgramStatus; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'running', label: 'Running' },
    { value: 'finished', label: 'Finished' },
]

const formatDays = (days: number) => `${days.toLocaleString('en-US')} day${days === 1 ? '' : 's'}`

function Fact({ children }: { children: React.ReactNode }) {
    return <Text as="span" fontSize="sm" color="fg.muted">{children}</Text>
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

    const display = (amount: string | number | BigNumber) => prettyAmount(uAmountToBigNumberAmount(amount, prizeAsset.decimals))

    return (
        <VStack align="stretch" gap={3} pt={3} data-testid="staking-program-extend-panel">
            <Separator />
            <Field.Root invalid={extraDays !== '' && error !== ''}>
                <Field.Label>How many more days?</Field.Label>
                <Input
                    placeholder="e.g. 30"
                    inputMode="numeric"
                    value={extraDays}
                    onChange={(e) => setExtraDays(e.target.value)}
                    maxW="40"
                />
                <Field.HelperText>
                    Anyone can add days to a program, not only the one who started it. No fee.
                </Field.HelperText>
                <Field.ErrorText>{error}</Field.ErrorText>
            </Field.Root>

            {topUpUAmount && (
                <Text fontSize="sm">
                    {`${display(topUpUAmount)} ${prizeAsset.ticker} leaves your wallet now — you have ${display(balance.amount)} ${prizeAsset.ticker}.`}
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
                This removes the finished program from the chain. Nothing is paid out and nothing is lost.
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

function ProgramRow({
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

    const stakeTicker = stakingAsset?.ticker ?? reward.staking_denom
    const prizeTicker = prizeAsset?.ticker ?? reward.prize_denom
    const staked = (amount: string | number | BigNumber) => stakingAsset
        ? `${prettyAmount(uAmountToBigNumberAmount(amount, stakingAsset.decimals))} ${stakeTicker}`
        : `${amount.toString()} ${stakeTicker}`

    const deletion = stakingRewardDeletion(reward)
    const stakedLeft = deletion.kind === 'staked' ? staked(deletion.stakedAmount) : ''

    const daysRemaining = Math.max(0, reward.duration - reward.payouts)
    const minStake = new BigNumber(reward.min_stake.toString())
    const prizePerDay = prizeAsset
        ? `${prettyAmount(uAmountToBigNumberAmount(reward.prize_amount, prizeAsset.decimals))} ${prizeTicker}`
        : `${reward.prize_amount} ${prizeTicker}`

    return (
        <Card.Root
            variant="outline"
            p="4"
            bgGradient="to-br"
            gradientFrom="yellow.500/8"
            gradientTo="yellow.600/8"
            borderColor="yellow.500/20"
            data-testid="staking-program-row"
        >
            {/* A token without metadata shows its full denom (factory/bze1…/name): let it wrap anywhere on phones. */}
            <VStack align="stretch" gap={3} overflowWrap="anywhere">
                <HStack justify="space-between" align="center" gap={4} flexWrap="wrap">
                    <HStack gap="3" minW="0">
                        <HStack gap="0" flexShrink={0}>
                            <TokenLogo src={stakingAsset?.logo ?? ''} symbol={stakingAsset?.ticker ?? '?'} size="10" circular={true} />
                            <Box ml="-3">
                                <TokenLogo src={prizeAsset?.logo ?? ''} symbol={prizeAsset?.ticker ?? '?'} size="10" circular={true} />
                            </Box>
                        </HStack>
                        <VStack align="start" gap="0.5" minW="0">
                            <Text fontWeight="semibold" wordBreak="break-word">
                                {`Stake ${stakeTicker}, earn ${prizeTicker}`}
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
                            aria-expanded={openPanel === 'extend'}
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
                                aria-expanded={openPanel === 'delete'}
                            >
                                <LuTrash2 />
                                Delete
                            </Button>
                        )}
                        <AppButton app="staking" href={getStakingApp().href} size="sm">View on Staking</AppButton>
                    </HStack>
                </HStack>

                <HStack gap={2} columnGap={4} flexWrap="wrap" data-testid="staking-program-facts">
                    <Fact>{`${prizePerDay} a day`}</Fact>
                    <Fact>{`${daysRemaining.toLocaleString('en-US')} of ${formatDays(reward.duration)} left`}</Fact>
                    <Fact>{reward.lock > 0 ? `lock ${formatDays(reward.lock)}` : 'no lock'}</Fact>
                    {minStake.gt(0) && stakingAsset && <Fact>{`minimum ${staked(minStake)}`}</Fact>}
                    <Fact>{`${staked(reward.staked_amount || 0)} staked`}</Fact>
                </HStack>

                {stakedLeft && (
                    <Text fontSize="xs" color="fg.muted" data-testid="staking-reward-delete-blocker">
                        {`${stakedLeft} still staked — stakers must exit first before it can be deleted.`}
                    </Text>
                )}

                {openPanel === 'extend' && <ExtendPanel reward={reward} onExtended={onChanged} />}
                {openPanel === 'delete' && deletion.kind === 'deletable' && <DeletePanel reward={reward} onDeleted={onChanged} />}
            </VStack>
        </Card.Root>
    )
}

/** Finished programs, collapsed by default so they stop cluttering the running ones. */
function FinishedPrograms({ rewards, onChanged }: { rewards: StakingRewardSDKType[]; onChanged: () => void }) {
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
                <ProgramRow key={reward.reward_id} reward={reward} onChanged={onChanged} />
            ))}
        </VStack>
    )
}

/**
 * One group of programs under the status filter: "all" lists the running ones and folds the
 * finished ones away; "running" and "finished" list just those, open.
 */
function ProgramGroup({
    rewards,
    status,
    onChanged,
}: {
    rewards: StakingRewardSDKType[];
    status: ProgramStatus;
    onChanged: () => void;
}) {
    const { active, finished } = splitStakingRewards(rewards)
    const shown = status === 'finished' ? finished : active

    return (
        <VStack align="stretch" gap={3}>
            {shown.map(reward => (
                <ProgramRow key={reward.reward_id} reward={reward} onChanged={onChanged} />
            ))}
            {status === 'all' && active.length === 0 && finished.length > 0 && (
                <Text fontSize="sm" color="fg.muted">No running programs — every program below has paid all its days.</Text>
            )}
            {status === 'all' && finished.length > 0 && <FinishedPrograms rewards={finished} onChanged={onChanged} />}
        </VStack>
    )
}

const matchesStatus = (rewards: StakingRewardSDKType[], status: ProgramStatus) => {
    if (status === 'all') return rewards.length > 0
    const { active, finished } = splitStakingRewards(rewards)
    return (status === 'running' ? active : finished).length > 0
}

export interface StakingProgramsListProps {
    /** Only programs that concern this denom (see `programInvolves`). */
    involving?: string;
    /** Pin the programs that concern the wallet's own factory tokens. */
    pinMine?: boolean;
    /** Where "New program" and the empty state go; defaults to `/reward/new` (with `returnTo`). */
    newProgramHref?: string;
    /** Passed to the default `newProgramHref`, so the form can send the user back. */
    returnTo?: ReturnTo;
    /** Status filter; the chips show only when `onStatus` is given. */
    status?: ProgramStatus;
    onStatus?: (status: ProgramStatus) => void;
    /** The list, when the caller already loads it (e.g. to count running programs); else the list loads its own. */
    programs?: StakingRewardsState;
}

/**
 * Staking programs on the chain, running first and finished ones folded away (where an emptied
 * one can be deleted). The chain stores no creator on a program, so "yours" means "involves one
 * of your tokens", and extensions are open to anyone willing to escrow the extra prize.
 */
export function StakingProgramsList({
    involving,
    pinMine = false,
    newProgramHref,
    returnTo,
    status = 'all',
    onStatus,
    programs,
}: StakingProgramsListProps) {
    const own = useStakingRewards(!programs)
    const { rewards, isLoading, hasError, refresh } = programs ?? own
    const { navigate } = useNavigation()
    const { pools } = useLiquidityPools()
    const { assets } = useAssets()
    const { address } = useChain(getChainName())
    const { asset: involvedAsset } = useAsset(involving ?? '')

    const newHref = newProgramHref ?? withReturn('/reward/new', returnTo)

    const scoped = useMemo(
        () => (involving ? rewards.filter(r => programInvolves(r, involving, pools)) : rewards),
        [rewards, involving, pools],
    )

    const myDenoms = useMemo(
        () => (pinMine ? filterMyTokens(assets ?? [], address).map(a => a.denom) : []),
        [pinMine, assets, address],
    )
    const { mine, others } = useMemo(() => {
        if (myDenoms.length === 0) return { mine: [], others: scoped }
        const isMine = (r: StakingRewardSDKType) => myDenoms.some(d => programInvolves(r, d, pools))
        return { mine: scoped.filter(isMine), others: scoped.filter(r => !isMine(r)) }
    }, [scoped, myDenoms, pools])

    const emptyText = involving
        ? `No staking programs with ${involvedAsset?.ticker ?? involving} yet.`
        : 'No staking programs yet.'

    let body: React.ReactNode
    if (isLoading) {
        body = (
            <VStack align="stretch" gap={3} data-testid="staking-programs-loading">
                <Skeleton height="24" />
                <Skeleton height="24" />
            </VStack>
        )
    } else if (hasError) {
        body = (
            <VStack align="stretch" gap={3}>
                <InfoBox title="Couldn't load the staking programs">
                    The chain query failed. The node may be down; try again in a moment.
                </InfoBox>
                <Box>
                    <Button size="sm" variant="outline" colorPalette="yellow" onClick={refresh}>
                        <LuRefreshCw /> Retry
                    </Button>
                </Box>
            </VStack>
        )
    } else if (scoped.length === 0) {
        body = (
            <Card.Root variant="outline" p="8" data-testid="staking-programs-empty">
                <VStack gap={4}>
                    <Box p={3} borderRadius="lg" bg="yellow.500/15" color="yellow.600">
                        <LuGift size={24} />
                    </Box>
                    <VStack gap={1}>
                        <Text fontWeight="semibold">{emptyText}</Text>
                        <Text fontSize="sm" color="fg.muted" textAlign="center">
                            People stake a token and earn your prize, day by day.
                        </Text>
                    </VStack>
                    <Button colorPalette="yellow" variant="outline" onClick={() => navigate(newHref)}>
                        <LuPlus />
                        Run a campaign
                    </Button>
                </VStack>
            </Card.Root>
        )
    } else if (!matchesStatus(scoped, status)) {
        body = (
            <Text fontSize="sm" color="fg.muted" data-testid="staking-programs-filtered-empty">
                Nothing matches this filter.
            </Text>
        )
    } else if (mine.length > 0) {
        body = (
            <VStack align="stretch" gap={6}>
                <VStack as="section" aria-label="Programs with your tokens" align="stretch" gap={3}>
                    <Text fontWeight="semibold">Programs with your tokens</Text>
                    {matchesStatus(mine, status)
                        ? <ProgramGroup rewards={mine} status={status} onChanged={refresh} />
                        : <Text fontSize="sm" color="fg.muted">Nothing matches this filter.</Text>}
                </VStack>
                {others.length > 0 && (
                    <VStack as="section" aria-label="Every other program" align="stretch" gap={3}>
                        <Text fontWeight="semibold">Every other program</Text>
                        {matchesStatus(others, status)
                            ? <ProgramGroup rewards={others} status={status} onChanged={refresh} />
                            : <Text fontSize="sm" color="fg.muted">Nothing matches this filter.</Text>}
                    </VStack>
                )}
            </VStack>
        )
    } else {
        body = <ProgramGroup rewards={scoped} status={status} onChanged={refresh} />
    }

    return (
        <VStack align="stretch" gap={4}>
            <HStack justify={onStatus ? 'space-between' : 'end'} gap={3} wrap="wrap">
                {onStatus && (
                    <HStack gap={2} wrap="wrap" role="group" aria-label="Filter">
                        {STATUSES.map(s => (
                            <Button
                                key={s.value}
                                size="xs"
                                colorPalette="yellow"
                                variant={status === s.value ? 'solid' : 'outline'}
                                aria-pressed={status === s.value}
                                onClick={() => onStatus(s.value)}
                            >
                                {s.label}
                            </Button>
                        ))}
                    </HStack>
                )}
                <Button size="sm" colorPalette="yellow" variant="outline" onClick={() => navigate(newHref)}>
                    <LuPlus />
                    New program
                </Button>
            </HStack>
            {body}
        </VStack>
    )
}
