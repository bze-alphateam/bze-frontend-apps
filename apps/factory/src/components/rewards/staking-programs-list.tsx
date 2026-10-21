"use client"

import React, { useMemo, useState } from 'react'
import {
    Box,
    Button,
    chakra,
    Field,
    HStack,
    Input,
    Separator,
    Text,
    VStack,
} from '@chakra-ui/react'
import BigNumber from 'bignumber.js'
import { LuChevronDown, LuChevronRight, LuGift, LuPlus, LuRefreshCw, LuTrash2 } from 'react-icons/lu'
import { bze } from '@bze/bzejs'
import {
    AppLink,
    HgCard,
    IconTile,
    Shimmer,
    TokenLogo,
    getChainName,
    getStakingApp,
    hgVariant,
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
import { FilterChip } from '@/components/ui/filter-chip'
import { InfoBox } from '@/components/ui/info-box'
import { softButton } from '@/components/ui/soft-button'
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
    return <Text as="span" fontSize="12px" fontFamily="mono" color="fg.muted">{children}</Text>
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
        <VStack align="stretch" gap="10px" pt="4px" data-testid="staking-program-extend-panel">
            <Separator borderColor="hg.divider" mb="4px" />
            <Field.Root invalid={extraDays !== '' && error !== ''}>
                <Field.Label fontSize="14px" fontWeight="600">How many more days?</Field.Label>
                <Input
                    placeholder="e.g. 30"
                    inputMode="numeric"
                    value={extraDays}
                    onChange={(e) => setExtraDays(e.target.value)}
                    maxW="160px"
                    h="42px"
                    borderRadius="10px"
                />
                <Field.HelperText fontSize="12px" color="fg.muted">
                    Anyone can add days to a program, not only the one who started it. No fee.
                </Field.HelperText>
                <Field.ErrorText>{error}</Field.ErrorText>
            </Field.Root>

            {topUpUAmount && (
                <Text fontSize="14px">
                    {`${display(topUpUAmount)} ${prizeAsset.ticker} leaves your wallet now — you have ${display(balance.amount)} ${prizeAsset.ticker}.`}
                </Text>
            )}
            {topUpUAmount && address && !hasEnough && (
                <Text fontSize="14px" color="fg.error">
                    Not enough {prizeAsset.ticker} to escrow this extension.
                </Text>
            )}

            <Box>
                <Button
                    variant={hgVariant('primary')}
                    size="md"
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
        <VStack align="stretch" gap="10px" pt="4px" data-testid="staking-reward-delete-panel">
            <Separator borderColor="hg.divider" />
            <Text fontSize="14px">
                This removes the finished program from the chain. Nothing is paid out and nothing is lost.
            </Text>
            <Box>
                <Button
                    variant={hgVariant('danger')}
                    size="md"
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
        <HgCard as="article" px="20px" py="18px" data-testid="staking-program-row">
            {/* A token without metadata shows its full denom (factory/bze1…/name): let it wrap anywhere on phones. */}
            <VStack align="stretch" gap="12px" overflowWrap="anywhere">
                <HStack justify="space-between" align="start" gap="12px" flexWrap="wrap">
                    <HStack gap="12px" minW="0">
                        <HStack gap="0" flexShrink={0}>
                            <TokenLogo src={stakingAsset?.logo ?? ''} symbol={stakingAsset?.ticker ?? '?'} size="8" circular={true} />
                            <Box ml="-2.5">
                                <TokenLogo src={prizeAsset?.logo ?? ''} symbol={prizeAsset?.ticker ?? '?'} size="8" circular={true} />
                            </Box>
                        </HStack>
                        <VStack align="start" gap="4px" minW="0">
                            <Text as="strong" fontSize="15px" fontWeight="700" wordBreak="break-word">
                                {`Stake ${stakeTicker}, earn ${prizeTicker}`}
                            </Text>
                            <HStack gap="6px">
                                <chakra.span fontFamily="mono" fontSize="11px" px="7px" py="2px" borderRadius="hg.pill" color="hg.link" bg="app.subtle" borderWidth="1px" borderColor="app.border">
                                    #{reward.reward_id}
                                </chakra.span>
                                {deletion.kind !== 'running' && (
                                    <chakra.span fontSize="11px" px="7px" py="2px" borderRadius="hg.pill" color="hg.text.secondary" bg="hg.hoverFill">Finished</chakra.span>
                                )}
                            </HStack>
                        </VStack>
                    </HStack>

                    <HStack gap="8px" flexWrap="wrap">
                        <Button
                            {...(openPanel === 'extend' ? { variant: hgVariant('primary'), borderRadius: '10px' } : softButton)}
                            size="sm"
                            h="32px"
                            fontSize="13px"
                            onClick={() => togglePanel('extend')}
                            aria-expanded={openPanel === 'extend'}
                        >
                            <LuPlus />
                            Extend
                        </Button>
                        {deletion.kind !== 'running' && (
                            <Button
                                size="sm"
                                h="32px"
                                fontSize="13px"
                                variant={hgVariant('danger')}
                                {...(openPanel === 'delete' ? { bg: 'hg.danger.solid', color: 'white' } : {})}
                                disabled={deletion.kind !== 'deletable'}
                                onClick={() => togglePanel('delete')}
                                aria-expanded={openPanel === 'delete'}
                            >
                                <LuTrash2 />
                                Delete
                            </Button>
                        )}
                        <AppLink app="staking" href={getStakingApp().href}>Staking</AppLink>
                    </HStack>
                </HStack>

                <HStack gap="8px" columnGap="18px" flexWrap="wrap" data-testid="staking-program-facts">
                    <Fact>{`${prizePerDay} a day`}</Fact>
                    <Fact>{`${daysRemaining.toLocaleString('en-US')} of ${formatDays(reward.duration)} left`}</Fact>
                    <Fact>{reward.lock > 0 ? `lock ${formatDays(reward.lock)}` : 'no lock'}</Fact>
                    {minStake.gt(0) && stakingAsset && <Fact>{`minimum ${staked(minStake)}`}</Fact>}
                    <Fact>{`${staked(reward.staked_amount || 0)} staked`}</Fact>
                </HStack>

                {stakedLeft && (
                    <Text fontSize="12px" color="hg.text.faint" data-testid="staking-reward-delete-blocker">
                        {`${stakedLeft} still staked — stakers must exit first before it can be deleted.`}
                    </Text>
                )}

                {openPanel === 'extend' && <ExtendPanel reward={reward} onExtended={onChanged} />}
                {openPanel === 'delete' && deletion.kind === 'deletable' && <DeletePanel reward={reward} onDeleted={onChanged} />}
            </VStack>
        </HgCard>
    )
}

/** Finished programs, collapsed by default so they stop cluttering the running ones. */
function FinishedPrograms({ rewards, onChanged }: { rewards: StakingRewardSDKType[]; onChanged: () => void }) {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <VStack align="stretch" gap={3} data-testid="finished-staking-rewards">
            <Box>
                <Button size="sm" h="32px" px="10px" variant="ghost" bg="hg.secondaryFill" color="fg" fontWeight="600" onClick={() => setIsOpen(open => !open)} aria-expanded={isOpen}>
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
                <Text fontSize="14px" color="fg.muted">No running programs — every program below has paid all its days.</Text>
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
 * Simple rewards on the chain, running first and finished ones folded away (where an emptied
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
        ? `No simple rewards with ${involvedAsset?.ticker ?? involving} yet.`
        : 'No simple rewards yet.'

    let body: React.ReactNode
    if (isLoading) {
        body = (
            <VStack align="stretch" gap="12px" data-testid="staking-programs-loading">
                <Shimmer h="96px" borderRadius="16px" />
                <Shimmer h="96px" borderRadius="16px" />
            </VStack>
        )
    } else if (hasError) {
        body = (
            <VStack align="stretch" gap={3}>
                <InfoBox title="Couldn't load the simple rewards">
                    The chain query failed. The node may be down; try again in a moment.
                </InfoBox>
                <Box>
                    <Button {...softButton} size="sm" onClick={refresh}>
                        <LuRefreshCw /> Retry
                    </Button>
                </Box>
            </VStack>
        )
    } else if (scoped.length === 0) {
        body = (
            <HgCard p="32px" data-testid="staking-programs-empty">
                <VStack gap="12px" textAlign="center">
                    <IconTile icon={<LuGift />} size={48} />
                    <Text as="strong" fontSize="15px" fontWeight="700">{emptyText}</Text>
                    <Text fontSize="14px" color="fg.muted">
                        People stake a token and earn your prize, day by day.
                    </Text>
                    <Button {...softButton} onClick={() => navigate(newHref)}>
                        <LuPlus />
                        Run a campaign
                    </Button>
                </VStack>
            </HgCard>
        )
    } else if (!matchesStatus(scoped, status)) {
        body = (
            <Text fontSize="14px" color="fg.muted" data-testid="staking-programs-filtered-empty">
                Nothing matches this filter.
            </Text>
        )
    } else if (mine.length > 0) {
        body = (
            <VStack align="stretch" gap="28px">
                <VStack as="section" aria-label="Programs with your tokens" align="stretch" gap="12px">
                    <Text as="h2" fontSize="18px" fontWeight="700">Programs with your tokens</Text>
                    {matchesStatus(mine, status)
                        ? <ProgramGroup rewards={mine} status={status} onChanged={refresh} />
                        : <Text fontSize="14px" color="fg.muted">Nothing matches this filter.</Text>}
                </VStack>
                {others.length > 0 && (
                    <VStack as="section" aria-label="Every other program" align="stretch" gap="12px">
                        <Text as="h2" fontSize="18px" fontWeight="700">Every other program</Text>
                        {matchesStatus(others, status)
                            ? <ProgramGroup rewards={others} status={status} onChanged={refresh} />
                            : <Text fontSize="14px" color="fg.muted">Nothing matches this filter.</Text>}
                    </VStack>
                )}
            </VStack>
        )
    } else {
        body = <ProgramGroup rewards={scoped} status={status} onChanged={refresh} />
    }

    return (
        <VStack align="stretch" gap="22px">
            <HStack justify={onStatus ? 'space-between' : 'end'} gap="12px" wrap="wrap">
                {onStatus && (
                    <HStack gap="8px" wrap="wrap" role="group" aria-label="Filter">
                        {STATUSES.map(s => (
                            <FilterChip key={s.value} pressed={status === s.value} onClick={() => onStatus(s.value)}>
                                {s.label}
                            </FilterChip>
                        ))}
                    </HStack>
                )}
                <Button {...softButton} onClick={() => navigate(newHref)}>
                    <LuPlus />
                    New program
                </Button>
            </HStack>
            {body}
        </VStack>
    )
}
