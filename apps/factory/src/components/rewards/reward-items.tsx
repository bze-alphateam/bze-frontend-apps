"use client"

import React, { useState } from 'react'
import NextLink from 'next/link'
import { Box, Button, chakra, Flex, HStack, Separator, Text, VStack } from '@chakra-ui/react'
import BigNumber from 'bignumber.js'
import { LuTrash2 } from 'react-icons/lu'
import { bze } from '@bze/bzejs'
import {
    AppLink,
    DenomReward,
    DenomRewardSchedule,
    getChainName,
    getDexApp,
    hgVariant,
    Shimmer,
    prettyAmount,
    shortNumberFormat,
    uAmountToBigNumberAmount,
    useAsset,
} from '@bze/bze-ui-kit'
import type { StakingRewardSDKType } from '@bze/bzejs/bze/rewards/store'
import { useChain } from '@interchain-kit/react'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import { softButton } from '@/components/ui/soft-button'
import { stakersAirdropHref } from '@/lib/airdrop'
import { dexRewardHref } from '@/lib/create-routes'
import { scheduleFormHref } from '@/lib/denom-reward'
import { extendHref } from '@/lib/reward-extend'
import { CompoundedSchedules, airdropDisabledReason, compoundedStatus, hasStakers, perDayLine, simpleStatus, specLine } from '@/lib/rewards-directory'
import { stakingRewardDeletion } from '@/lib/staking-rewards'

// One reward as a compact item (canvas C-2), the same on /rewards (inside a token's row) and in
// the token page's "Rewards on X": a kind tag and the DEX spec line, what it pays a day, and the
// actions anyone can take. The words follow the DEX staking list so both apps read the same.

const { deleteStakingReward } = bze.rewards.MessageComposer.withTypeUrl

/** A Factory page a link leads to; the token page adds its way back. */
export type LinkTo = (href: string) => string

const sameHref: LinkTo = href => href

/** Small on desktop, a full tap target on phones. */
const smallButton = { size: 'xs' as const, h: { base: '36px', md: '28px' }, px: '10px', fontSize: { base: '13px', md: '12px' }, borderRadius: '8px' }
const tinyButton = { size: 'xs' as const, h: { base: '32px', md: '22px' }, px: '8px', fontSize: '11px', borderRadius: '7px' }

function RewardLink({ href, tiny, children }: { href: string; tiny?: boolean; children: React.ReactNode }) {
    return (
        <Button asChild {...softButton} {...(tiny ? tinyButton : smallButton)}>
            <NextLink href={href}>{children}</NextLink>
        </Button>
    )
}

/** Simple = a neutral outline, Compounded = an info-blue tint (the DEX's RewardKindTag). */
export function RewardKindTag({ kind }: { kind: 'simple' | 'compounded' }) {
    return (
        <chakra.span
            flex="none"
            fontFamily="mono"
            fontSize="11px"
            lineHeight="16px"
            px="6px"
            borderRadius="6px"
            borderWidth="1px"
            data-kind={kind}
            {...(kind === 'simple'
                ? { color: 'hg.text.secondary', bg: 'hg.secondaryFill', borderColor: 'hg.lineStrong' }
                : { color: 'hg.info.text', bg: 'hg.info/10', borderColor: 'hg.info/35' })}
        >
            {kind === 'simple' ? 'Simple' : 'Compounded'}
        </chakra.span>
    )
}

/** "Yours": the connected wallet created the staked token. */
export function YoursTag() {
    return (
        <chakra.span fontSize="11px" fontWeight="600" px="7px" lineHeight="16px" borderRadius="hg.pill" color="hg.link" bg="app.subtle" borderWidth="1px" borderColor="app.border" flexShrink={0}>
            Yours
        </chakra.span>
    )
}

/** The reward's page on the DEX (its facts, prizes and staking), in a new tab. */
function DexLink({ rowId }: { rowId: string }) {
    return <AppLink app="dex" href={dexRewardHref(getDexApp().href, rowId)}>DEX</AppLink>
}

/** "1K VDL" in the staked token, for the Min of the spec line; '' for no minimum. */
function useMinStake(denom: string, minStake: BigNumber.Value) {
    const { asset } = useAsset(denom)
    const min = new BigNumber(minStake.toString())
    if (!min.gt(0)) return ''
    return asset
        ? `${shortNumberFormat(uAmountToBigNumberAmount(min, asset.decimals))} ${asset.ticker}`
        : `${min.toFixed(0)} ${denom}`
}

/** An item: what it is (kind, spec line) | what it pays | its actions. One column on phones. */
function Item({ testId, head, pays, actions, footer }: {
    testId: string;
    head: React.ReactNode;
    pays: React.ReactNode;
    actions: React.ReactNode;
    footer?: React.ReactNode;
}) {
    return (
        <Box bg="hg.inset" borderRadius="12px" px={{ base: '12px', md: '14px' }} py="12px" data-testid={testId} overflowWrap="anywhere">
            <Box
                display="grid"
                gridTemplateColumns={{ base: 'minmax(0, 1fr)', md: 'minmax(0, 1.1fr) minmax(0, 2fr) auto' }}
                alignItems="center"
                columnGap="16px"
                rowGap="10px"
            >
                <VStack align="start" gap="3px" minW={0}>{head}</VStack>
                <Box minW={0}>{pays}</Box>
                {actions}
            </Box>
            {footer}
        </Box>
    )
}

function Actions({ testId, children }: { testId: string; children: React.ReactNode }) {
    return (
        <Flex gap="6px" flexWrap="wrap" align="center" justify={{ base: 'flex-start', md: 'flex-end' }} data-testid={testId}>
            {children}
        </Flex>
    )
}

function Spec({ children }: { children: React.ReactNode }) {
    return <Text fontSize="12px" lineHeight="1.4" color="hg.text.faint" data-testid="reward-spec">{children}</Text>
}

/** One daily prize: "500 VDL / day · 16 / 30 days" and its Extend. */
function DailyPrizeLine({ schedule, href }: { schedule: DenomRewardSchedule; href: string }) {
    const { asset } = useAsset(schedule.prize_denom)
    const perDay = `${prettyAmount(uAmountToBigNumberAmount(schedule.daily_amount, asset?.decimals ?? 0))} ${asset?.ticker ?? schedule.prize_denom}`

    return (
        <HStack gap="10px" justify="space-between" data-testid="daily-prize-line">
            <Text fontSize="13px" color="hg.text.secondary" minW={0} wordBreak="break-word">
                {perDayLine(perDay, schedule.payouts, schedule.duration)}
            </Text>
            <RewardLink href={href} tiny>Extend</RewardLink>
        </HStack>
    )
}

export interface CompoundedRewardItemProps {
    dr: DenomReward;
    schedules: CompoundedSchedules;
    /** The token page leaves Airdrop out (it has its own Grow actions). */
    airdrop?: boolean;
    link?: LinkTo;
}

/** The compounded reward of a token: its daily prizes, each with Extend, and Add daily prize / Airdrop / DEX. */
export function CompoundedRewardItem({ dr, schedules, airdrop = true, link = sameHref }: CompoundedRewardItemProps) {
    const denom = dr.staking_denom
    const min = useMinStake(denom, dr.min_stake || 0)
    const reason = airdropDisabledReason(dr)

    let pays: React.ReactNode
    if (schedules === undefined) {
        pays = <Shimmer h="14px" w="200px" data-testid="prizes-loading" />
    } else if (schedules === null) {
        pays = <Text fontSize="13px" color="fg.muted">{"Couldn't load its daily prizes."}</Text>
    } else if (schedules.length === 0) {
        pays = <Text fontSize="13px" color="hg.text.faint">Nothing scheduled</Text>
    } else {
        pays = (
            <VStack align="stretch" gap="6px">
                {schedules.map(s => <DailyPrizeLine key={s.schedule_id} schedule={s} href={link(scheduleFormHref(denom, s.schedule_id))} />)}
            </VStack>
        )
    }

    return (
        <Item
            testId="compounded-item"
            head={(
                <>
                    <RewardKindTag kind="compounded" />
                    <Spec>{specLine(dr.lock, min, compoundedStatus(schedules))}</Spec>
                </>
            )}
            pays={pays}
            actions={(
                <Actions testId="compounded-actions">
                    <RewardLink href={link(scheduleFormHref(denom))}>Add daily prize</RewardLink>
                    {airdrop && (reason
                        ? <Button {...softButton} {...smallButton} disabled title={reason}>Airdrop</Button>
                        : <RewardLink href={link(stakersAirdropHref(denom))}>Airdrop</RewardLink>)}
                    <DexLink rowId={`compounded:${denom}`} />
                </Actions>
            )}
        />
    )
}

// MsgDeleteStakingReward (chain v8.2.0) is permissionless too: once a reward has paid every day
// and every staker has exited, anyone may remove the record. The chain re-checks both, so a race
// (someone staked in between) comes back as its mapped error and the list is refreshed either way.
function DeletePanel({ reward, onDeleted }: { reward: StakingRewardSDKType; onDeleted: () => void }) {
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
        <VStack align="stretch" gap="10px" pt="12px" data-testid="staking-reward-delete-panel">
            <Separator borderColor="hg.divider" />
            <Text fontSize="14px">
                This removes the finished reward from the chain. Nothing is paid out and nothing is lost.
            </Text>
            <Box>
                <Button
                    variant={hgVariant('danger')}
                    size="sm"
                    onClick={submit}
                    disabled={!address}
                    loading={isSubmitting}
                    loadingText="Waiting for signature..."
                >
                    Delete reward #{reward.reward_id}
                </Button>
            </Box>
        </VStack>
    )
}

export interface SimpleRewardItemProps {
    reward: StakingRewardSDKType;
    link?: LinkTo;
    /** After a delete (or a failed one): reload the list. Without it, there is no Delete. */
    onChanged?: () => void;
    /** Name the staked token too, when the list mixes tokens (the token page's LP rewards). */
    showStaked?: boolean;
}

/** One simple reward: "#id", what it pays a day, and Extend / Airdrop / Delete / DEX. Anyone may do each. */
export function SimpleRewardItem({ reward, link = sameHref, onChanged, showStaked }: SimpleRewardItemProps) {
    const { asset: stakingAsset } = useAsset(reward.staking_denom)
    const { asset: prizeAsset } = useAsset(reward.prize_denom)
    const [isDeleteOpen, setIsDeleteOpen] = useState(false)
    const min = useMinStake(reward.staking_denom, reward.min_stake ?? 0)

    const perDay = `${prettyAmount(uAmountToBigNumberAmount(reward.prize_amount, prizeAsset?.decimals ?? 0))} ${prizeAsset?.ticker ?? reward.prize_denom}`
    const deletable = onChanged !== undefined && stakingRewardDeletion(reward).kind === 'deletable'
    const spec = specLine(reward.lock, min, simpleStatus(reward))

    return (
        <Item
            testId="simple-reward-row"
            head={(
                <>
                    <HStack gap="6px">
                        <RewardKindTag kind="simple" />
                        <Text as="span" fontSize="12px" fontFamily="mono" color="hg.text.secondary">#{reward.reward_id}</Text>
                    </HStack>
                    <Spec>{showStaked ? `Stake ${stakingAsset?.ticker ?? reward.staking_denom} · ${spec}` : spec}</Spec>
                </>
            )}
            pays={(
                <Text fontSize="13px" color="hg.text.secondary" data-testid="simple-reward-facts">
                    {perDayLine(perDay, reward.payouts, reward.duration)}
                </Text>
            )}
            actions={(
                <Actions testId="simple-reward-actions">
                    {/* Extending is permissionless: anyone can pay for more days, in its own wizard (BFE-264). */}
                    <RewardLink href={link(extendHref(reward.reward_id))}>Extend</RewardLink>
                    {/* So is an airdrop to its stakers, once someone stakes. */}
                    {hasStakers(reward) && <RewardLink href={link(stakersAirdropHref(reward.staking_denom, reward.reward_id))}>Airdrop</RewardLink>}
                    {deletable && (
                        <Button
                            variant={hgVariant('danger')}
                            {...smallButton}
                            {...(isDeleteOpen ? { bg: 'hg.danger.solid', color: 'white' } : {})}
                            onClick={() => setIsDeleteOpen(open => !open)}
                            aria-expanded={isDeleteOpen}
                        >
                            <LuTrash2 />
                            Delete
                        </Button>
                    )}
                    <DexLink rowId={`simple:${reward.reward_id}`} />
                </Actions>
            )}
            footer={isDeleteOpen && deletable && onChanged ? <DeletePanel reward={reward} onDeleted={onChanged} /> : undefined}
        />
    )
}

/** A token with no compounded reward yet: the way to make it stakable. */
export function StakableOffer({ ticker, href }: { ticker: string; href: string }) {
    return (
        <Flex
            borderWidth="1px"
            borderStyle="dashed"
            borderColor="hg.lineStrong"
            borderRadius="12px"
            px={{ base: '12px', md: '14px' }}
            py="10px"
            gap="10px"
            align="center"
            justify="space-between"
            flexWrap="wrap"
            data-testid="stakable-offer"
        >
            <Text fontSize="13px" color="hg.text.faint">No compounded reward yet.</Text>
            <RewardLink href={href}>{`Make ${ticker} stakable`}</RewardLink>
        </Flex>
    )
}
