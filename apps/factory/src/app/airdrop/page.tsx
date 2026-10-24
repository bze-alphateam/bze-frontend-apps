"use client"

import React from 'react'
import { AirdropForm, TargetQuestion } from '@/components/airdrop/airdrop-form'
import { ListAirdrop } from '@/components/airdrop/list-flow'
import { StakersAirdrop } from '@/components/airdrop/stakers-flow'
import { FormPage } from '@/components/guided'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import { type AirdropTarget, airdropHref, readAirdropLink } from '@/lib/airdrop'

/**
 * Airdrop coins: step 1 asks who gets them, then the flow of that target takes over. The target
 * lives in the URL (`?to=`), so a reload, a pending transaction and the browser's Back keep it.
 */
function AirdropContent() {
    const { getQueryParam, replace } = useNavigationWithParams()
    const link = readAirdropLink({ get: getQueryParam })

    // Switching targets keeps only the coin to send: a staked token or reward means nothing to a list.
    const pick = (to: AirdropTarget) => replace(airdropHref({ to, prize: link.prize || (link.to === 'list' ? link.denom : undefined) }))

    if (link.to === 'list') {
        return <ListAirdrop key="list" initialDenom={link.denom || link.prize} onTarget={pick} />
    }
    if (link.to === 'stakers' || link.to === 'lp') {
        return (
            <StakersAirdrop
                key={link.to}
                target={link.to}
                initialDenom={link.denom}
                initialRewardId={link.id || undefined}
                initialPrize={link.prize}
                onTarget={pick}
            />
        )
    }
    return (
        <AirdropForm>
            <TargetQuestion onPick={pick} />
        </AirdropForm>
    )
}

export default function AirdropPage() {
    return (
        <FormPage>
            <AirdropContent />
        </FormPage>
    )
}
