"use client"

import React from 'react'
import { Box, chakra, HStack, Text, VStack } from '@chakra-ui/react'
import {
    DenomRewardPrize,
    DenomRewardSchedule,
    HgCard,
    Shimmer,
    TokenLogo,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
} from '@bze/bze-ui-kit'
import { ItemButton, ItemLink } from '@/components/token-page/action-group'
import type { DenomRewardDetails } from '@/hooks/useDenomRewardDetails'
import { airdropFormHref, formatLastPaid, scheduleDaysLeft, scheduleFormHref } from '@/lib/denom-reward'
import { HolderRow, airdropDisabledReason, dailyPrizeEnd } from '@/lib/rewards-directory'
import { workspaceHref } from '@/lib/workspace'
import { isFactoryToken } from '@/lib/tokens-directory'

const formatDays = (days: number) => `${days.toLocaleString('en-US')} day${days === 1 ? '' : 's'}`

/** The card's anchor, so `?denom=` can scroll to it. */
export const rewardCardId = (denom: string) => `reward-${denom}`

/** "Created by you": the staked token was made by the connected wallet. */
export function CreatedByYouTag() {
    return (
        <chakra.span fontSize="11px" fontWeight="600" px="8px" py="2px" borderRadius="hg.pill" color="hg.link" bg="app.subtle" borderWidth="1px" borderColor="app.border" flexShrink={0}>
            Created by you
        </chakra.span>
    )
}

/** Card actions: two columns on phones, one wrapping row from md up. */
export function CardActions({ children, testId }: { children: React.ReactNode; testId?: string }) {
    return (
        <Box
            display={{ base: 'grid', md: 'flex' }}
            gridTemplateColumns="repeat(2, minmax(0, 1fr))"
            flexWrap="wrap"
            gap="8px"
            css={{ '& > *': { minWidth: 0 } }}
            data-testid={testId}
        >
            {children}
        </Box>
    )
}

/** One running daily prize: "50 BZE a day · ends 26 Oct" and its Extend →. */
function DailyPrizeLine({ denom, schedule, now }: { denom: string; schedule: DenomRewardSchedule; now: Date }) {
    const { asset } = useAsset(schedule.prize_denom)
    const ticker = asset?.ticker ?? schedule.prize_denom
    const perDay = `${prettyAmount(uAmountToBigNumberAmount(schedule.daily_amount, asset?.decimals ?? 0))} ${ticker}`
    const left = scheduleDaysLeft(schedule)

    return (
        <HStack justify="space-between" gap="10px" flexWrap="wrap" data-testid="daily-prize-line">
            <Text fontSize="13px" minW={0} wordBreak="break-word">
                {left > 0 ? dailyPrizeEnd(perDay, left, now) : `${perDay} a day · finished`}
            </Text>
            <ItemLink href={scheduleFormHref(denom, schedule.schedule_id)}>Extend →</ItemLink>
        </HStack>
    )
}

/** A prize token the reward has paid, with when it last paid. */
function PrizeTokenLine({ prize, currentDayEpoch }: { prize: DenomRewardPrize; currentDayEpoch?: string }) {
    const { asset } = useAsset(prize.prize_denom)
    return (
        <HStack justify="space-between" gap="10px" fontSize="12px" data-testid="prize-token-line">
            <Text minW={0} truncate>{asset?.ticker ?? prize.prize_denom}</Text>
            <Text color="fg.muted" flexShrink={0}>{`Last paid ${formatLastPaid(prize.last_distribution_epoch, currentDayEpoch)}`}</Text>
        </HStack>
    )
}

function Prizes({ denom, details, currentDayEpoch, now }: {
    denom: string;
    details: DenomRewardDetails | null | undefined;
    currentDayEpoch?: string;
    now: Date;
}) {
    if (details === undefined) {
        return (
            <VStack align="stretch" gap="8px" data-testid="prizes-loading">
                <Shimmer h="14px" w="200px" />
                <Shimmer h="12px" w="140px" />
            </VStack>
        )
    }
    if (details === null) {
        return <Text fontSize="13px" color="fg.muted">{"Couldn't load its prizes. They show again on reload."}</Text>
    }

    return (
        <VStack align="stretch" gap="10px">
            {details.schedules.length === 0
                ? <Text fontSize="13px" color="fg.muted">No daily prize running.</Text>
                : details.schedules.map(s => <DailyPrizeLine key={s.schedule_id} denom={denom} schedule={s} now={now} />)}
            {details.prizes.length > 0 && (
                <VStack align="stretch" gap="4px" pt="2px">
                    <Text fontSize="11px" fontWeight="600" color="hg.text.faint" textTransform="uppercase" letterSpacing="0.06em">Prize tokens</Text>
                    {details.prizes.map(p => <PrizeTokenLine key={p.prize_denom} prize={p} currentDayEpoch={currentDayEpoch} />)}
                </VStack>
            )}
        </VStack>
    )
}

export interface CompoundedRewardCardProps {
    row: HolderRow & { logo?: string };
    details: DenomRewardDetails | null | undefined;
    mine: boolean;
    currentDayEpoch?: string;
    now: Date;
}

/**
 * One compounded reward (one per staked token): what it stakes and pays, and the permissionless
 * actions anyone can take on it. The chain stores no creator or funder, so none is shown.
 */
export function CompoundedRewardCard({ row, details, mine, currentDayEpoch, now }: CompoundedRewardCardProps) {
    const { dr, ticker } = row
    const denom = dr.staking_denom
    const reason = airdropDisabledReason(dr)
    const usd = row.usdPrice && row.usdPrice.gt(0) ? row.stakedDisplay.multipliedBy(row.usdPrice) : undefined
    const meta = [
        `${prettyAmount(row.stakedDisplay)} staked`,
        ...(usd ? [`≈$${prettyAmount(usd)}`] : []),
        `unstaking takes ${formatDays(dr.lock)}`,
    ].join(' · ')

    return (
        <HgCard as="article" id={rewardCardId(denom)} scrollMarginTop="96px" px={{ base: '16px', md: '20px' }} py="18px" data-testid="compounded-reward-card">
            <VStack align="stretch" gap="14px" overflowWrap="anywhere">
                <HStack gap="12px" align="start">
                    <TokenLogo src={row.logo} symbol={ticker} size="8" circular={true} />
                    <VStack align="start" gap="3px" minW={0} flex="1">
                        <HStack gap="8px" flexWrap="wrap">
                            <Text as="h3" fontSize="15px" fontWeight="700" title={denom}>{`Stake ${ticker}`}</Text>
                            {mine && <CreatedByYouTag />}
                        </HStack>
                        <Text fontSize="13px" color="fg.muted" data-testid="compounded-meta">{meta}</Text>
                    </VStack>
                </HStack>

                <Prizes denom={denom} details={details} currentDayEpoch={currentDayEpoch} now={now} />

                <CardActions testId="compounded-actions">
                    <ItemLink href={scheduleFormHref(denom)}>Add daily prize</ItemLink>
                    {reason
                        ? <ItemButton onClick={() => undefined} disabled>Airdrop once</ItemButton>
                        : <ItemLink href={airdropFormHref(denom)}>Airdrop once</ItemLink>}
                    {isFactoryToken({ denom }) &&<ItemLink href={workspaceHref(denom)}>Open token</ItemLink>}
                </CardActions>
                {reason && <Text fontSize="12px" color="hg.text.faint" data-testid="airdrop-disabled">{reason}</Text>}
            </VStack>
        </HgCard>
    )
}
