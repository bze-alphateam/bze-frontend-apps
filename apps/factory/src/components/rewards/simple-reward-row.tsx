"use client"

import React, { useState } from 'react'
import { Box, Button, chakra, HStack, Separator, Text, VStack } from '@chakra-ui/react'
import BigNumber from 'bignumber.js'
import { LuTrash2 } from 'react-icons/lu'
import { bze } from '@bze/bzejs'
import {
    AppLink,
    HgCard,
    TokenLogo,
    getChainName,
    getStakingApp,
    hgVariant,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
} from '@bze/bze-ui-kit'
import type { StakingRewardSDKType } from '@bze/bzejs/bze/rewards/store'
import { useChain } from '@interchain-kit/react'
import { useFactoryTx } from '@/hooks/useFactoryTx'
import { ItemLink } from '@/components/token-page/action-group'
import { CardActions, CreatedByYouTag } from '@/components/rewards/compounded-reward-card'
import { endDate, extendHref, formatDay } from '@/lib/reward-extend'
import { distributeHref, hasStakers } from '@/lib/reward-distribute'
import { stakingRewardDeletion } from '@/lib/staking-rewards'

const { deleteStakingReward } = bze.rewards.MessageComposer.withTypeUrl

function Fact({ children }: { children: React.ReactNode }) {
    return <Text as="span" fontSize="12px" fontFamily="mono" color="fg.muted">{children}</Text>
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
        <VStack align="stretch" gap="10px" pt="4px" data-testid="staking-reward-delete-panel">
            <Separator borderColor="hg.divider" />
            <Text fontSize="14px">
                This removes the finished reward from the chain. Nothing is paid out and nothing is lost.
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
                    Delete reward #{reward.reward_id}
                </Button>
            </Box>
        </VStack>
    )
}

export interface SimpleRewardRowProps {
    reward: StakingRewardSDKType;
    mine: boolean;
    now: Date;
    /** After a delete (or a failed one): reload the list. */
    onChanged: () => void;
}

/** One simple reward: what it stakes and pays, until when, and Extend / Delete. Anyone may do either. */
export function SimpleRewardRow({ reward, mine, now, onChanged }: SimpleRewardRowProps) {
    const { asset: stakingAsset } = useAsset(reward.staking_denom)
    const { asset: prizeAsset } = useAsset(reward.prize_denom)
    const [isDeleteOpen, setIsDeleteOpen] = useState(false)

    const stakeTicker = stakingAsset?.ticker ?? reward.staking_denom
    const prizeTicker = prizeAsset?.ticker ?? reward.prize_denom
    const staked = (amount: string | number | BigNumber) => stakingAsset
        ? `${prettyAmount(uAmountToBigNumberAmount(amount, stakingAsset.decimals))} ${stakeTicker}`
        : `${amount.toString()} ${stakeTicker}`

    const deletion = stakingRewardDeletion(reward)
    const finished = deletion.kind !== 'running'
    const minStake = new BigNumber(reward.min_stake.toString())
    const prizePerDay = prizeAsset
        ? `${prettyAmount(uAmountToBigNumberAmount(reward.prize_amount, prizeAsset.decimals))} ${prizeTicker}`
        : `${reward.prize_amount} ${prizeTicker}`

    return (
        <HgCard as="article" px={{ base: '16px', md: '20px' }} py="18px" data-testid="simple-reward-row">
            {/* A token without metadata shows its full denom (factory/bze1…/name): let it wrap anywhere on phones. */}
            <VStack align="stretch" gap="12px" overflowWrap="anywhere">
                <HStack gap="12px" align="start">
                    <HStack gap="0" flexShrink={0}>
                        <TokenLogo src={stakingAsset?.logo ?? ''} symbol={stakingAsset?.ticker ?? '?'} size="8" circular={true} />
                        <Box ml="-2.5">
                            <TokenLogo src={prizeAsset?.logo ?? ''} symbol={prizeAsset?.ticker ?? '?'} size="8" circular={true} />
                        </Box>
                    </HStack>
                    <VStack align="start" gap="4px" minW="0" flex="1">
                        <Text as="h3" fontSize="15px" fontWeight="700" wordBreak="break-word">
                            {`Stake ${stakeTicker} · earn ${prizeTicker}`}
                        </Text>
                        <HStack gap="6px" flexWrap="wrap">
                            <chakra.span fontFamily="mono" fontSize="11px" px="7px" py="2px" borderRadius="hg.pill" color="hg.link" bg="app.subtle" borderWidth="1px" borderColor="app.border">
                                #{reward.reward_id}
                            </chakra.span>
                            {mine && <CreatedByYouTag />}
                        </HStack>
                    </VStack>
                </HStack>

                <HStack gap="8px" columnGap="18px" flexWrap="wrap" data-testid="simple-reward-facts">
                    <Fact>{`${prizePerDay} a day`}</Fact>
                    <Fact>{finished ? 'finished' : `ends ${formatDay(endDate(reward, now), now)}`}</Fact>
                    <Fact>{`${staked(reward.staked_amount || 0)} staked`}</Fact>
                    {minStake.gt(0) && stakingAsset && <Fact>{`minimum ${staked(minStake)}`}</Fact>}
                </HStack>

                <CardActions testId="simple-reward-actions">
                    {/* Extending is permissionless: anyone can pay for more days, in its own wizard (BFE-264). */}
                    <ItemLink href={extendHref(reward.reward_id)}>Extend</ItemLink>
                    {/* So is a one-time distribution, once someone stakes. */}
                    {hasStakers(reward) && <ItemLink href={distributeHref(reward.reward_id)}>Distribute</ItemLink>}
                    {finished && (
                        <Button
                            size="sm"
                            h="36px"
                            fontSize="13px"
                            variant={hgVariant('danger')}
                            {...(isDeleteOpen ? { bg: 'hg.danger.solid', color: 'white' } : {})}
                            disabled={deletion.kind !== 'deletable'}
                            onClick={() => setIsDeleteOpen(open => !open)}
                            aria-expanded={isDeleteOpen}
                        >
                            <LuTrash2 />
                            Delete
                        </Button>
                    )}
                    <AppLink app="staking" href={getStakingApp().href}>Staking</AppLink>
                </CardActions>

                {deletion.kind === 'staked' && (
                    <Text fontSize="12px" color="hg.text.faint" data-testid="staking-reward-delete-blocker">
                        {`${staked(deletion.stakedAmount)} still staked — stakers must exit first before it can be deleted.`}
                    </Text>
                )}

                {isDeleteOpen && deletion.kind === 'deletable' && <DeletePanel reward={reward} onDeleted={onChanged} />}
            </VStack>
        </HgCard>
    )
}
