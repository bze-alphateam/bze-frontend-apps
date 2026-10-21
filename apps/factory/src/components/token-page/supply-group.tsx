"use client"

import React, { useState } from 'react'
import { Box, Button, Grid, Text, VStack } from '@chakra-ui/react'
import type BigNumber from 'bignumber.js'
import { LuRefreshCw } from 'react-icons/lu'
import { AppLink, Shimmer, formatTimeRemainingFromEpochs, getBurnerApp, isLpDenom, useEpochs } from '@bze/bze-ui-kit'
import { softButton } from '@/components/ui/soft-button'
import { useTokenRaffle } from '@/hooks/useTokenRaffle'
import { burnerCoinHref, displayAmount, oneInFromChances, percentFromRatio, raffleHref } from '@/lib/raffle-new'
import { ActionGroup, ActionItem, AdminItemShimmer, ItemButton, ItemLink, type GroupProps } from './action-group'
import { MintForm } from './mint-form'

/** One raffle figure on the inset. */
function RaffleFact({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <VStack align="stretch" gap="3px" bg="hg.inset" borderRadius="12px" px="12px" py="10px" minW={0}>
            <Text fontSize="11px" color="fg.muted">{label}</Text>
            <Box fontSize="13px" fontWeight="700" wordBreak="break-word">{value}</Box>
        </VStack>
    )
}

/**
 * "Run a burning raffle" (BFE-208), for everyone: the token's running raffle with a Burner link, or
 * the way to start one. A failed lookup says so and never reads as "none running".
 */
function RaffleItem({ asset, back, burnerHref }: Pick<GroupProps, 'asset' | 'back'> & { burnerHref: string }) {
    const { raffle, refresh } = useTokenRaffle(asset.denom)
    const { hourEpochInfo } = useEpochs()
    const amount = (base: string) => `${displayAmount(base, asset.decimals)} ${asset.ticker}`

    if (raffle.status === 'running') {
        return (
            <ActionItem
                testId="raffle-item"
                title="Burning raffle running"
                line="People buy tickets on Burner; what's left at the end is burned."
                action={<AppLink app="burner" href={burnerHref}>Burner</AppLink>}
            >
                <Grid templateColumns={{ base: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' }} gap="8px" data-testid="raffle-running">
                    <RaffleFact label="Pot" value={amount(raffle.raffle.pot)} />
                    <RaffleFact label="Ticket price" value={amount(raffle.raffle.ticket_price)} />
                    <RaffleFact label="Win chance" value={`1 in ${oneInFromChances(raffle.raffle.chances).toLocaleString('en-US')}`} />
                    <RaffleFact label="A winner gets" value={`${percentFromRatio(raffle.raffle.ratio)} % of the pot`} />
                    <RaffleFact
                        label="Time left"
                        value={hourEpochInfo
                            ? formatTimeRemainingFromEpochs(raffle.raffle.end_at, hourEpochInfo.current_epoch)
                            : <Shimmer h="14px" w="64px" />}
                    />
                </Grid>
            </ActionItem>
        )
    }

    return (
        <ActionItem
            testId="raffle-item"
            title="Run a burning raffle"
            line={raffle.status === 'error'
                ? `Couldn't load the raffle for ${asset.ticker}.`
                : `Tickets in ${asset.ticker}; what's left at the end is burned.`}
            action={
                raffle.status === 'loading' ? <Box data-testid="raffle-loading"><Shimmer h="36px" w="112px" borderRadius="10px" /></Box>
                    : raffle.status === 'error' ? (
                        <Button {...softButton} size="sm" h="36px" onClick={refresh}>
                            <LuRefreshCw /> Retry
                        </Button>
                    )
                        : <ItemLink href={raffleHref(asset.denom, back)}>Start raffle</ItemLink>
            }
        />
    )
}

/** Supply: mint for the admin, burning on Burner for everyone, the burning raffle. */
export function SupplyGroup({ asset, access, back, supplyDisplay, onMinted }: GroupProps & {
    /** Current total supply in display units. */
    supplyDisplay: BigNumber;
    onMinted: () => void;
}) {
    const [isMintOpen, setIsMintOpen] = useState(false)
    const ticker = asset.ticker
    const burnerHref = burnerCoinHref(getBurnerApp().href, asset.denom)

    return (
        <ActionGroup id="supply" title="Supply" description={`Mint new ${ticker}, or burn ${ticker} you hold on Burner.`}>
            {access === 'checking' && <AdminItemShimmer />}
            {access === 'admin' && (
                <ActionItem
                    testId="mint-item"
                    title="Mint tokens"
                    line={`New ${ticker} goes to your wallet. Only the admin can mint.`}
                    action={
                        <ItemButton onClick={() => setIsMintOpen(open => !open)} aria-expanded={isMintOpen}>
                            {isMintOpen ? 'Close' : 'Mint'}
                        </ItemButton>
                    }
                >
                    {isMintOpen && <MintForm asset={asset} currentSupply={supplyDisplay} onDone={onMinted} />}
                </ActionItem>
            )}
            {/* tokenfactory MsgBurn is admin-only, so burning lives on Burner for everyone (epic decision 13). */}
            <ActionItem
                testId="burn-item"
                title="Burn tokens"
                line={`Destroy ${ticker} you hold. Lowers the supply.`}
                action={<AppLink app="burner" href={burnerHref}>Burner</AppLink>}
            />
            {/* Halted tokens are worthless and LP shares can't be raffled. */}
            {!asset.halted && !isLpDenom(asset.denom) && <RaffleItem asset={asset} back={back} burnerHref={burnerHref} />}
        </ActionGroup>
    )
}
