"use client"

import React from 'react'
import { Box, chakra, Flex, HStack, Text, VStack } from '@chakra-ui/react'
import { LuChevronDown } from 'react-icons/lu'
import {
    HgCard,
    LPTokenLogo,
    TokenLogo,
    prettyAmount,
    shortNumberFormat,
    useAsset,
    useLiquidityPools,
} from '@bze/bze-ui-kit'
import { CompoundedRewardItem, SimpleRewardItem, StakableOffer, YoursTag } from '@/components/rewards/reward-items'
import { compoundedNewHref } from '@/lib/denom-reward'
import { RewardGroup, rewardCount } from '@/lib/rewards-directory'

/** The row's anchor, so `?denom=` can scroll to it. */
export const rewardRowId = (denom: string) => `reward-${denom}`

/** A token's logo, or both of an LP token's. */
function StakedLogo({ denom, size = '8' }: { denom: string; size?: string }) {
    const { asset } = useAsset(denom)
    const { getPoolByLpDenom } = useLiquidityPools()
    const pool = getPoolByLpDenom(denom)
    const { asset: base } = useAsset(pool?.base ?? '')
    const { asset: quote } = useAsset(pool?.quote ?? '')

    if (pool && base && quote) {
        return <LPTokenLogo baseAssetLogo={base.logo} quoteAssetLogo={quote.logo} baseAssetSymbol={base.ticker} quoteAssetSymbol={quote.ticker} size={size} />
    }
    return <TokenLogo src={asset?.logo} symbol={asset?.ticker ?? ''} size={size} circular={true} />
}

function Label({ children }: { children: React.ReactNode }) {
    return <Text as="span" fontSize="10px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase" color="hg.text.faint">{children}</Text>
}

/** The DEX's Earn cell: the first prize token, and "+ N tokens" for the others. */
function Earn({ earn }: { earn: string[] }) {
    const { asset } = useAsset(earn[0] ?? '')
    if (earn.length === 0) return <Text as="span" fontSize="13px" color="hg.text.faint">—</Text>
    return (
        <HStack gap="6px" minW={0}>
            <TokenLogo src={asset?.logo} symbol={asset?.ticker ?? ''} size="5" circular={true} />
            <Text as="span" fontSize="13px" fontWeight="600" truncate>{asset?.ticker ?? earn[0]}</Text>
            {earn.length > 1 && (
                <Text as="span" fontSize="12px" color="hg.text.faint" flexShrink={0}>
                    {`+ ${earn.length - 1} token${earn.length === 2 ? '' : 's'}`}
                </Text>
            )}
        </HStack>
    )
}

export interface RewardGroupRowProps {
    group: RewardGroup;
    mine: boolean;
    open: boolean;
    onToggle: () => void;
    /** Offer "Make X stakable" when the token has no compounded reward. */
    offerStakable: boolean;
    /** After a simple reward is deleted (or a delete failed): reload the list. */
    onChanged: () => void;
}

/**
 * One staked token (canvas C-2): a collapsed line with what it earns, the total staked and how
 * many rewards stake it; open, its compounded reward and then its simple rewards.
 */
export function RewardGroupRow({ group, mine, open, onToggle, offerStakable, onChanged }: RewardGroupRowProps) {
    const { denom, ticker } = group
    const count = rewardCount(group)
    const usd = group.usdPrice && group.usdPrice.gt(0) ? group.stakedDisplay.multipliedBy(group.usdPrice) : undefined
    const bodyId = `${rewardRowId(denom)}-rewards`

    return (
        <HgCard as="article" id={rewardRowId(denom)} scrollMarginTop="96px" p="0" overflow="hidden" data-testid="reward-group" data-denom={denom}>
            <chakra.h3 m="0">
                <chakra.button
                    type="button"
                    w="full"
                    textAlign="left"
                    cursor="pointer"
                    px={{ base: '14px', md: '18px' }}
                    py="14px"
                    _hover={{ bg: 'hg.hoverFill' }}
                    _focusVisible={{ outline: '2px solid', outlineColor: 'app.border', outlineOffset: '-2px' }}
                    aria-expanded={open}
                    aria-controls={bodyId}
                    onClick={onToggle}
                    display="grid"
                    gridTemplateColumns={{ base: 'minmax(0, 1fr) auto', md: 'minmax(0, 2fr) minmax(0, 1.3fr) minmax(0, 1.1fr) auto' }}
                    gridTemplateAreas={{ base: '"token count" "facts facts"', md: '"token earn staked count"' }}
                    alignItems="center"
                    columnGap="16px"
                    rowGap="10px"
                >
                    <HStack gridArea="token" gap="12px" minW={0}>
                        <StakedLogo denom={denom} />
                        <VStack align="start" gap="1px" minW={0}>
                            <HStack gap="8px" minW={0}>
                                <Text as="span" fontSize="15px" fontWeight="700" title={denom} truncate data-testid="reward-group-ticker">{ticker}</Text>
                                {mine && <YoursTag />}
                            </HStack>
                            {group.name && group.name !== ticker && <Text as="span" fontSize="12px" color="hg.text.faint" truncate>{group.name}</Text>}
                        </VStack>
                    </HStack>
                    <Flex gridArea={{ base: 'facts', md: 'auto' }} display={{ base: 'flex', md: 'contents' }} gap="16px" minW={0}>
                        <VStack gridArea={{ md: 'earn' }} align="start" gap="2px" minW={0} flex="1">
                            <Label>Earn</Label>
                            <Earn earn={group.earn} />
                        </VStack>
                        <VStack gridArea={{ md: 'staked' }} align="start" gap="2px" minW={0} flex="1" data-testid="reward-group-staked">
                            <Label>Total staked</Label>
                            <Text as="span" fontSize="13px" fontWeight="600" truncate>{shortNumberFormat(group.stakedDisplay)}</Text>
                            {usd && <Text as="span" fontSize="12px" color="hg.text.faint">{`≈ $${prettyAmount(usd)}`}</Text>}
                        </VStack>
                    </Flex>
                    <HStack gridArea="count" gap="10px">
                        <Text as="span" fontSize="12px" fontWeight="600" px="8px" lineHeight="20px" borderRadius="hg.pill" bg="hg.secondaryFill" color="hg.text.secondary" whiteSpace="nowrap" data-testid="reward-group-count">
                            {`${count} reward${count === 1 ? '' : 's'}`}
                        </Text>
                        <Box as="span" color="hg.text.faint" transition="transform 0.15s" transform={open ? 'rotate(180deg)' : undefined} aria-hidden>
                            <LuChevronDown size={18} />
                        </Box>
                    </HStack>
                </chakra.button>
            </chakra.h3>
            {open && (
                <VStack id={bodyId} align="stretch" gap="8px" px={{ base: '10px', md: '14px' }} pb="14px" pt="2px" data-testid="reward-group-body">
                    {group.compounded
                        ? <CompoundedRewardItem dr={group.compounded} schedules={group.schedules} />
                        : offerStakable && <StakableOffer ticker={ticker} href={compoundedNewHref(denom)} />}
                    {group.simple.map(r => <SimpleRewardItem key={r.reward_id} reward={r} onChanged={onChanged} />)}
                </VStack>
            )}
        </HgCard>
    )
}
