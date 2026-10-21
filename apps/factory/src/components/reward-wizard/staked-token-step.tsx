"use client"

import React from 'react'
import NextLink from 'next/link'
import { Box, Button, Link, Text, VStack } from '@chakra-ui/react'
import { LuRefreshCw } from 'react-icons/lu'
import { prettyAmount, uAmountToBigNumberAmount, type Asset, type DenomReward } from '@bze/bze-ui-kit'
import { BlockerNote } from '@/components/guided'
import { StakedTokenPicker } from '@/components/pickers/staked-token-picker'
import { compoundedNewHref } from '@/lib/denom-reward'
import { type PrizeFlow, nothingStakedReason, stakedRowState, stakedTokenOk } from '@/lib/prize-wizard'

interface StakedTokenStepProps {
    flow: PrizeFlow;
    value: string;
    onChange: (asset: Asset) => void;
    /** The picked token's ticker ('' while unknown). */
    ticker: string;
    /** The picked token's compounded reward, read from the chain (useDenomReward). */
    denomReward?: DenomReward;
    isLoading: boolean;
    hasError: boolean;
    onRetry: () => void;
}

/**
 * Step 1 of the daily prize and airdrop wizards (canvas D4): whose stakers get it. Any token with
 * a compounded reward, yours or not. The picked token's own read decides: a load error is never
 * "no reward", and an airdrop needs something staked.
 */
export function StakedTokenStep({ flow, value, onChange, ticker, denomReward, isLoading, hasError, onRetry }: StakedTokenStepProps) {
    const name = ticker || 'This token'
    const stateOf = (asset: Asset, dr?: DenomReward) =>
        dr ? stakedRowState(uAmountToBigNumberAmount(dr.staked_amount, asset.decimals), flow, prettyAmount) : undefined

    return (
        <VStack align="stretch" gap="14px">
            <StakedTokenPicker mode="hasCompounded" value={value} onChange={onChange} stateOf={stateOf} />
            <Text fontSize="14px" color="fg.muted">
                {'Not in the list? '}
                <Link asChild color="hg.link" fontWeight="600"><NextLink href={compoundedNewHref()}>Make it stakable first</NextLink></Link>
            </Text>

            {value && hasError && (
                <BlockerNote
                    action={(
                        <Button size="xs" variant="ghost" color="hg.link" fontWeight="600" onClick={onRetry}>
                            <LuRefreshCw /> Retry
                        </Button>
                    )}
                >
                    {`Couldn't load ${ticker ? `${ticker}'s` : 'the'} compounded reward. The node may be down.`}
                </BlockerNote>
            )}
            {value && !isLoading && !hasError && !denomReward && (
                <BlockerNote
                    action={<Link asChild color="hg.link" fontSize="14px" fontWeight="600"><NextLink href={compoundedNewHref(value)}>Make it stakable</NextLink></Link>}
                >
                    <Box as="span" data-testid="no-compounded">{`${name} has no compounded reward yet. Make it stakable first, then add prizes.`}</Box>
                </BlockerNote>
            )}
            {flow === 'airdrop' && denomReward && !isLoading && !hasError && !stakedTokenOk(flow, { denomReward, isLoading, hasError }) && (
                <Box data-testid="airdrop-blocker">
                    <BlockerNote>{nothingStakedReason(ticker || 'this token')}</BlockerNote>
                </Box>
            )}
        </VStack>
    )
}
