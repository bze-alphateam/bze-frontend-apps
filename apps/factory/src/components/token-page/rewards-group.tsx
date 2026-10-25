"use client"

import React, { useMemo, useState } from 'react'
import { Box, Button, VStack } from '@chakra-ui/react'
import { LuRefreshCw } from 'react-icons/lu'
import { Shimmer, useLiquidityPools } from '@bze/bze-ui-kit'
import { withReturn } from '@/components/guided/return-to'
import { MakeStakableDialog } from '@/components/rewards/make-stakable-dialog'
import { CompoundedRewardItem, SimpleRewardItem } from '@/components/rewards/reward-items'
import { softButton } from '@/components/ui/soft-button'
import { useDenomReward } from '@/hooks/useDenomReward'
import { useStakingRewards } from '@/hooks/useStakingRewards'
import { compoundedNewHref } from '@/lib/denom-reward'
import { stakesToken } from '@/lib/token-page'
import { ActionGroup, ActionItem, ItemButton, ItemLink, type GroupProps } from './action-group'

/** The compounded reward of the token, or the way to make it stakable. */
function Compounded({ asset, back }: Pick<GroupProps, 'asset' | 'back'>) {
    const ticker = asset.ticker
    const { denomReward, schedules, isLoading, hasError, refresh } = useDenomReward(asset.denom)
    const [isExplaining, setExplaining] = useState(false)

    if (isLoading) {
        return (
            <Box data-testid="compounded-loading">
                <Shimmer h="16px" w="160px" />
                <Shimmer h="12px" w="224px" mt="8px" />
            </Box>
        )
    }
    if (hasError) {
        return (
            <ActionItem
                testId="compounded-item"
                title="Compounded reward"
                line={`Couldn't check whether ${ticker} has a compounded reward.`}
                action={(
                    <Button {...softButton} size="sm" h="36px" onClick={() => void refresh()}>
                        <LuRefreshCw /> Retry
                    </Button>
                )}
            />
        )
    }
    if (!denomReward) {
        return (
            <>
                <ActionItem
                    testId="compounded-item"
                    title={`Make ${ticker} stakable`}
                    action={<ItemButton onClick={() => setExplaining(true)} primary>Create</ItemButton>}
                />
                <MakeStakableDialog
                    open={isExplaining}
                    onClose={() => setExplaining(false)}
                    ticker={ticker}
                    href={withReturn(compoundedNewHref(asset.denom), back)}
                />
            </>
        )
    }
    // The token page leaves Airdrop out: its Grow actions have one.
    return <CompoundedRewardItem dr={denomReward} schedules={schedules} airdrop={false} link={href => withReturn(href, back)} />
}

/**
 * Rewards on the token: everything paying its stakers, all permissionless (anyone can add). The
 * same items as a token's row on /rewards: the compounded reward with its daily prizes, then the
 * simple rewards that stake the token or its LP shares.
 */
export function RewardsGroup({ asset, back }: GroupProps) {
    const { rewards, isLoading, hasError, refresh } = useStakingRewards()
    const { pools } = useLiquidityPools()
    const simple = useMemo(() => rewards.filter(r => stakesToken(r, asset.denom, pools)), [rewards, asset.denom, pools])

    return (
        <ActionGroup id="rewards" title={`Rewards on ${asset.ticker}`}>
            <VStack align="stretch" gap="8px" pt="4px" pb="14px">
                <Compounded asset={asset} back={back} />
                {isLoading ? (
                    <Box data-testid="simple-rewards-loading">
                        <Shimmer h="16px" w="160px" />
                    </Box>
                ) : hasError ? (
                    <ActionItem
                        title="Simple rewards"
                        line="Couldn't load the simple rewards."
                        action={(
                            <Button {...softButton} size="sm" h="36px" onClick={refresh}>
                                <LuRefreshCw /> Retry
                            </Button>
                        )}
                    />
                ) : (
                    simple.map(r => (
                        <SimpleRewardItem
                            key={r.reward_id}
                            reward={r}
                            link={href => withReturn(href, back)}
                            showStaked={r.staking_denom !== asset.denom}
                        />
                    ))
                )}
            </VStack>
        </ActionGroup>
    )
}
