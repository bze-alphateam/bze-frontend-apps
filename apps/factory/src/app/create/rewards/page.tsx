"use client"

import React from 'react'
import { useCreationFees } from '@bze/bze-ui-kit'
import { CardGrid, ChooseFrame, ChoosePage, CreationFeeRow, OptionCard } from '@/components/create/choose-parts'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import { rewardTargets } from '@/lib/create-routes'

/** Choose staking rewards (canvas A4): a simple or a compounded reward, on any token. */
function ChooseRewards() {
    const { getQueryParam } = useNavigationWithParams()
    const { fees, denomRewardLimits, isLoading } = useCreationFees()
    const targets = rewardTargets({ get: getQueryParam })
    const maxPrizes = denomRewardLimits.maxPrizeDenomsPerDr
    const coins = maxPrizes ? `up to ${maxPrizes.toLocaleString('en-US')} coins` : 'several coins'

    return (
        <ChoosePage crumb="Staking rewards" title="Which kind of reward?">
            <CardGrid>
                <OptionCard
                    title="Simple reward"
                    line="Pays stakers a fixed amount in one coin every day, for as many days as you choose. You can extend it as often as you like."
                    action={{ label: 'Create simple reward', href: targets.simple }}
                >
                    <CreationFeeRow fee={fees.createStakingRewardFee} isLoading={isLoading} />
                </OptionCard>
                <OptionCard
                    title="Compounded reward"
                    line={`Pays stakers every day in ${coins}. Anyone can add more daily prizes or airdrop to its stakers.`}
                    action={{ label: 'Make a token stakable', href: targets.compounded }}
                >
                    <CreationFeeRow fee={fees.createDenomRewardFee} isLoading={isLoading} />
                </OptionCard>
            </CardGrid>
        </ChoosePage>
    )
}

export default function ChooseRewardsPage() {
    return <ChooseFrame><ChooseRewards /></ChooseFrame>
}
