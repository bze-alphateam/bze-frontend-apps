"use client"

import React, { useState } from 'react'
import NextLink from 'next/link'
import { Button, Text } from '@chakra-ui/react'
import { hgVariant, useCreationFees } from '@bze/bze-ui-kit'
import { CardGrid, ChooseFrame, ChoosePage, CreationFeeRow, OptionCard } from '@/components/create/choose-parts'
import { FactoryDialog } from '@/components/ui/factory-dialog'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import { rewardTargets } from '@/lib/create-routes'

/** Choose staking rewards (canvas A4): a simple or a compounded reward, on any token. */
function ChooseRewards() {
    const { getQueryParam } = useNavigationWithParams()
    const { fees, denomRewardLimits, isLoading } = useCreationFees()
    const targets = rewardTargets({ get: getQueryParam })
    const maxPrizes = denomRewardLimits.maxPrizeDenomsPerDr
    const [confirmSimple, setConfirmSimple] = useState(false)
    const tokens = maxPrizes ? `up to ${maxPrizes.toLocaleString('en-US')} tokens` : 'many tokens'

    return (
        <ChoosePage crumb="Staking rewards" title="Which kind of reward?">
            <CardGrid>
                <OptionCard
                    title="Compounded reward"
                    featuredTag="Recommended"
                    line={`Works like a simple reward, but stays open for more: extra prizes in ${tokens}, campaigns and airdrops. A simple reward can't become compounded later.`}
                    action={{ label: 'Create', href: targets.compounded }}
                >
                    <CreationFeeRow fee={fees.createDenomRewardFee} isLoading={isLoading} />
                </OptionCard>
                <OptionCard
                    title="Simple reward"
                    line="Pays stakers a fixed amount of one token every day. You can add days, but never change it."
                    action={{
                        label: 'Create',
                        href: targets.simple,
                        onClick: (e) => { e.preventDefault(); setConfirmSimple(true) },
                        muted: true,
                    }}
                >
                    <CreationFeeRow fee={fees.createStakingRewardFee} isLoading={isLoading} />
                </OptionCard>
            </CardGrid>
            <FactoryDialog
                open={confirmSimple}
                onClose={() => setConfirmSimple(false)}
                title="Compounded rewards are recommended"
                footer={(
                    <>
                        <Button asChild variant={hgVariant('secondary')} size="lg" flex={{ base: '1 1 100%', md: '0 0 auto' }}>
                            <NextLink href={targets.simple}>I understand, continue</NextLink>
                        </Button>
                        <Button asChild variant={hgVariant('primary')} size="lg" flex={{ base: '1 1 100%', md: '0 0 auto' }}>
                            <NextLink href={targets.compounded}>Create compounded reward</NextLink>
                        </Button>
                    </>
                )}
            >
                <Text fontSize="14px" lineHeight="1.55" color="fg.muted">
                    A simple reward pays a fixed amount of one token and can never change or become compounded. A compounded reward can do the same and more later.
                </Text>
            </FactoryDialog>
        </ChoosePage>
    )
}

export default function ChooseRewardsPage() {
    return <ChooseFrame><ChooseRewards /></ChooseFrame>
}
