"use client"

import React, { useMemo, useState } from 'react'
import NextLink from 'next/link'
import { Button, Link, Text, VStack } from '@chakra-ui/react'
import { LuRefreshCw, LuSearchX } from 'react-icons/lu'
import {
    CreateDaoFlow,
    GradientText,
    HgCard,
    PageState,
    Shimmer,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAssets,
    type Asset,
    type DaoCreated,
    type DenomReward,
} from '@bze/bze-ui-kit'
import { DaoDone } from '@/components/dao-new/dao-done'
import { BlockerNote, FormFrame, FormPage, GuidedForm, Question, useGuidedSteps, useReturnTo, withReturn } from '@/components/guided'
import { StakedTokenPicker } from '@/components/pickers/staked-token-picker'
import { useDaoParams } from '@/hooks/useDaoParams'
import { useDenomReward } from '@/hooks/useDenomReward'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import { useStakingRewards } from '@/hooks/useStakingRewards'
import { compoundedNewHref } from '@/lib/denom-reward'
import { simpleRewardHref } from '@/lib/create-routes'
import { leftOutLine, pickTokenElectorate, tokenRowState, votersLine } from '@/lib/token-dao'
import { isFactoryToken } from '@/lib/tokens-directory'

function Frame({ children }: { children: React.ReactNode }) {
    return <FormFrame narrow><HgCard p="16px" data-testid="dao-new-state">{children}</HgCard></FormFrame>
}

function DaoNewContent() {
    const { denomParam, navigate } = useNavigationWithParams()
    const returnTo = useReturnTo()
    const daoParams = useDaoParams()
    const { getAsset, isLoading: isAssetsLoading } = useAssets()
    const staking = useStakingRewards()

    const [denom, setDenom] = useState(denomParam ?? '')
    const [done, setDone] = useState<DaoCreated | undefined>(undefined)

    const asset: Asset | undefined = denom ? getAsset(denom) : undefined
    const dr = useDenomReward(denom)
    const params = daoParams.status === 'ready' ? daoParams.params : undefined

    const electorate = useMemo(
        () => params && denom && !staking.isLoading && !staking.hasError && !dr.isLoading && !dr.hasError
            ? pickTokenElectorate({ denom, rewards: staking.rewards, denomReward: dr.denomReward, params })
            : undefined,
        [params, denom, staking.rewards, staking.isLoading, staking.hasError, dr.denomReward, dr.isLoading, dr.hasError],
    )
    const preset = useMemo(
        () => electorate ? { type: 'DAO_TYPE_STAKE' as const, electorate: electorate.electorate } : undefined,
        [electorate],
    )
    const locked = useMemo(() => ({ type: true, stakingDenom: denom }), [denom])

    const steps = useGuidedSteps(['token'] as const, { token: Boolean(denom) })

    if (daoParams.status === 'loading' || (denomParam && isAssetsLoading)) {
        return <FormFrame><Shimmer h="256px" borderRadius="hg.lg" aria-busy="true" /></FormFrame>
    }
    if (daoParams.status === 'unsupported') {
        return (
            <Frame>
                <PageState kind="empty" title="DAOs are not available on this network yet" description="They arrive with the v8.3.0 upgrade of the BZE chain." />
            </Frame>
        )
    }
    if (daoParams.status === 'error') {
        return (
            <Frame>
                <PageState
                    kind="error"
                    title="Couldn't check whether this network supports DAOs"
                    description="The node may be down."
                    action={<Button variant="outline" onClick={daoParams.retry}><LuRefreshCw /> Retry</Button>}
                />
            </Frame>
        )
    }
    if (denomParam && (!asset || !isFactoryToken(asset))) {
        return (
            <Frame>
                <PageState
                    kind="not-found"
                    icon={<LuSearchX />}
                    title="We couldn't find this token."
                    description="Check the link, or pick a token from the list."
                    action={<Button variant="outline" onClick={() => navigate('/dao/new')}>Pick a token</Button>}
                />
            </Frame>
        )
    }

    if (done && asset) return <DaoDone asset={asset} created={done} />

    const stateOf = (a: Asset, row?: DenomReward) => {
        if (staking.isLoading || staking.hasError) return undefined
        const e = pickTokenElectorate({ denom: a.denom, rewards: staking.rewards, denomReward: row, params: daoParams.params })
        return tokenRowState(e, `${prettyAmount(uAmountToBigNumberAmount(e.totalStaked.toFixed(0), a.decimals))} ${a.ticker} staked`)
    }

    const pick = (a: Asset) => {
        setDenom(a.denom)
        steps.close()
    }

    const ticker = asset?.ticker ?? ''
    const back = returnTo

    let flow: React.ReactNode = null
    if (denom && steps.state.token === 'done') {
        if (staking.hasError || dr.hasError) {
            flow = (
                <BlockerNote action={<Button size="xs" variant="ghost" color="hg.link" fontWeight="600" onClick={() => { staking.refresh(); void dr.refresh() }}><LuRefreshCw /> Retry</Button>}>
                    {`Couldn't load the rewards of ${ticker || 'this token'}. The node may be down.`}
                </BlockerNote>
            )
        } else if (!electorate || !preset) {
            flow = <Shimmer h="256px" borderRadius="hg.lg" aria-busy="true" data-testid="dao-new-loading" />
        } else if (!electorate.hasSources) {
            flow = (
                <BlockerNote>
                    <VStack align="start" gap="4px" data-testid="dao-new-no-source">
                        <Text>{`No reward of ${ticker} can vote yet: a DAO needs rewards with at least ${electorate.minLock} days of lock.`}</Text>
                        <Link asChild color="hg.link" fontWeight="600"><NextLink href={withReturn(compoundedNewHref(denom), back)}>{`Make ${ticker} stakable`}</NextLink></Link>
                        <Link asChild color="hg.link" fontWeight="600"><NextLink href={withReturn(simpleRewardHref({ staking: denom }), back)}>{`Create a simple reward with at least ${electorate.minLock} days of lock`}</NextLink></Link>
                    </VStack>
                </BlockerNote>
            )
        } else {
            flow = (
                <>
                    <Text fontSize="14px" color="fg.muted" data-testid="dao-new-voters">
                        {[votersLine(electorate), leftOutLine(electorate)].filter(Boolean).join('. ')}
                    </Text>
                    <CreateDaoFlow key={denom} preset={preset} locked={locked} lockedBy="Factory" onCreated={setDone} />
                </>
            )
        }
    }

    return (
        <GuidedForm
            parent={returnTo ?? { href: '/', label: 'Create' }}
            crumb="DAO"
            title={<>Create a <GradientText>DAO</GradientText></>}
            subtitle="A DAO voted by the people who stake a token."
        >
            <Question
                title="Token"
                question="Whose stakers will vote?"
                {...steps.step('token')}
                summary={ticker && `${ticker} stakers`}
            >
                <StakedTokenPicker mode="anyToken" includeLP={false} factoryOnly value={denom} onChange={pick} stateOf={stateOf} />
            </Question>
            {flow}
        </GuidedForm>
    )
}

export default function DaoNewPage() {
    return (
        <FormPage>
            <DaoNewContent />
        </FormPage>
    )
}
