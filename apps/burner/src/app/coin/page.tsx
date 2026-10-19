'use client';

import {
    Box,
    Button,
    chakra,
    Flex,
    Grid,
    Table,
} from "@chakra-ui/react";
import {LuArrowLeft, LuBadgeCheck, LuClock, LuFlame, LuInfo, LuLock, LuTicket} from "react-icons/lu";
import { useRouter, useSearchParams } from "next/navigation";
import {useCallback, useEffect, useMemo, useState, Suspense, type ReactNode} from "react";
import { useChain } from "@interchain-kit/react";
import { getChainName, prettyAmount, uAmountToBigNumberAmount, toBigNumber, truncateDenom, isLpDenom, isIbcDenom, formatTimeRemainingFromEpochs, truncateAddress, useAssetsValue, useEpochs, useAssets, FeaturedCard, HeroGlow, Notice, PageContainer, PageState, Shimmer, hgVariant } from "@bze/bze-ui-kit";
import { useBurnerContext } from "@/hooks/useBurnerContext";
import { BurnModal } from "@/components/burn-modal";
import { RaffleModal } from "@/components/raffle-modal";
import { RaffleInfoModal } from "@/components/raffle-info-modal";
import { RaffleResultAnimation } from "@/components/raffle-result-animation";
import { useBurningHistory } from "@/hooks/useBurningHistory";
import { useNextBurning } from "@/hooks/useNextBurning";
import {useRaffle, useRaffleContributions} from "@/hooks/useRaffles";
import BigNumber from "bignumber.js";
import {AssetLogo} from "@/components/ui/asset_logo";
import {AppPill, BodyCell, BurnStat, emberAmount, HeaderCell, SectionHeader, TableCard} from "@/components/ui/burner/parts";

const WINNERS_LIST_MAX_LEN = 20;

/** A raffle figure on the inset: label, number, a muted line. */
const RaffleFigure = ({label, value, foot, tone}: { label: string; value: string; foot: string; tone?: 'ember' | 'success' }) => (
    <Flex direction="column" gap="2px" bg="hg.inset" borderRadius="hg.md" px="16px" py="14px" minW="0">
        <chakra.span fontSize="11px" letterSpacing="0.1em" textTransform="uppercase" fontWeight="700" color="hg.text.faint">{label}</chakra.span>
        <chakra.span fontSize="24px" fontWeight="800" overflowWrap="anywhere" color={tone === 'ember' ? 'hg.link' : tone === 'success' ? 'hg.success.text' : 'fg'}>{value}</chakra.span>
        <chakra.span fontSize="12px" color="hg.text.faint">{foot}</chakra.span>
    </Flex>
);

/** The page frame: the half-strength glow behind a 1200 px column. */
const CoinFrame = ({children}: { children: ReactNode }) => (
    <Box position="relative" minH="100vh" pb="80px">
        <HeroGlow strength="inner"/>
        <PageContainer as="main" position="relative" pt={{base: '24px', md: '36px'}}>
            <Flex direction="column" gap={{base: '24px', md: '32px'}}>{children}</Flex>
        </PageContainer>
    </Box>
);

/** The coin page's skeleton while the assets load. */
const CoinLoading = () => (
    <CoinFrame>
        <Flex gap="16px" align="center" aria-busy="true" data-testid="coin-loading">
            <Shimmer boxSize="64px" borderRadius="full" flex="none"/>
            <Flex direction="column" gap="8px" flex="1">
                <Shimmer h="24px" w="160px"/>
                <Shimmer h="14px" w="120px"/>
            </Flex>
        </Flex>
        <Grid templateColumns={{base: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))'}} gap="16px" aria-hidden>
            <Shimmer h="120px" borderRadius="hg.lg"/>
            <Shimmer h="120px" borderRadius="hg.lg"/>
        </Grid>
    </CoinFrame>
);

function CoinDetailContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const denom = searchParams.get('coin') || '';
    const { address } = useChain(getChainName());

    const [isBurnModalOpen, setIsBurnModalOpen] = useState(false);
    const [isRaffleModalOpen, setIsRaffleModalOpen] = useState(false);
    const [isRaffleInfoModalOpen, setIsRaffleInfoModalOpen] = useState(false);
    const [showRaffleAnimation, setShowRaffleAnimation] = useState<'win' | 'lose' | 'waiting' | 'summary' | null>(null);
    const [currentResultIndex, setCurrentResultIndex] = useState(0); // Track which result we're displaying

    // Get asset from useAssets
    const { getAsset, denomDecimals, isLoading: isLoadingAssets } = useAssets();
    const { totalUsdValue } = useAssetsValue();
    const { lockBalance } = useBurnerContext();
    const asset = useMemo(() => getAsset(denom), [getAsset, denom]);
    const {hourEpochInfo} = useEpochs()

    const currentEpoch = useMemo(() => toBigNumber(hourEpochInfo?.current_epoch ?? 0), [hourEpochInfo])

    // Determine coin type
    const isLP = useMemo(() => isLpDenom(denom), [denom]);
    const isIBC = useMemo(() => isIbcDenom(denom), [denom]);

    // Fetch burn history for this specific coin
    const { burnHistory, isLoading: isLoadingHistory } = useBurningHistory(denom);

    // Fetch next burning data
    const { nextBurn, isLoading: isLoadingNextBurn } = useNextBurning();

    // Fetch raffle winners if there's a raffle for this coin
    const { winners, raffle: coinRaffle, isLoading: isLoadingRaffles } = useRaffle(denom || '');

    // Raffle contributions management
    const { getPendingContribution, removePendingContribution, markAsClosed } = useRaffleContributions();

    // Get next burning info for this specific coin
    const nextCoinBurn = useMemo(() => {
        if (!nextBurn?.coins) return null;

        const coin = nextBurn.coins.find((c: { denom: string; amount: string }) => c.denom === denom);
        if (!coin) return null;

        const decimals = denomDecimals(denom);
        const amount = uAmountToBigNumberAmount(coin.amount, decimals);
        const usdValue = totalUsdValue([{ denom, amount }]);

        return {
            amount,
            usdValue,
            date: nextBurn.date,
        };
        //eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nextBurn, denom]);

    // Calculate total burned for this coin
    const totalBurned = useMemo(() => {
        return burnHistory.reduce((total, burn) => {
            return total.plus(burn.amount);
        }, BigNumber(0));
    }, [burnHistory]);

    // Calculate USD value of total burned
    const totalBurnedUsdValue = useMemo(() => {
        if (!asset || totalBurned.isZero()) return BigNumber(0);
        return totalUsdValue([{ denom: asset.denom, amount: totalBurned }]);
        //eslint-disable-next-line react-hooks/exhaustive-deps
    }, [totalBurned, asset?.denom]);

    // Calculate locked balance for this coin
    const lockedAmount = useMemo(() => {
        const balance = lockBalance.get(denom);
        if (!balance || !asset) return null;

        const amount = uAmountToBigNumberAmount(balance.amount, asset.decimals);
        const usdValue = totalUsdValue([{ denom, amount }]);

        return {
            amount,
            usdValue,
        };
    }, [lockBalance, denom, asset, totalUsdValue]);

    // Format raffle data
    const raffleData = useMemo(() => {
        if (!coinRaffle || !asset) return null;

        const decimals = asset.decimals || 6;

        // Calculate prize (pot * ratio)
        const potAmount = uAmountToBigNumberAmount(coinRaffle.pot, decimals);
        const ratio = toBigNumber(coinRaffle.ratio);
        const prizeAmount = potAmount.multipliedBy(ratio);
        const formattedPrize = prettyAmount(prizeAmount);

        // Calculate ticket price
        const ticketPrice = uAmountToBigNumberAmount(coinRaffle.ticket_price, decimals);
        const formattedTicketPrice = prettyAmount(ticketPrice);

        // Calculate win chance (1 in X out of 1 million)
        const chances = toBigNumber(coinRaffle.chances);
        const winChance = chances.isNaN() || !chances.isPositive()
            ? "N/A"
            : `1 in ${prettyAmount(toBigNumber(1000000).dividedBy(chances))}`;

        // Calculate time remaining
        const timeRemaining = formatTimeRemainingFromEpochs(coinRaffle.end_at, currentEpoch);

        // Calculate total won
        const totalWon = uAmountToBigNumberAmount(coinRaffle.total_won, decimals);
        const formattedTotalWon = prettyAmount(totalWon);

        // Format winners
        const formattedWinners = winners.sort((a: {index: string}, b: {index: string}) => parseInt(b.index) - parseInt(a.index)).slice(0, WINNERS_LIST_MAX_LEN).map((w: {winner: string; amount: string}) => ({
            fullAddress: w.winner,
            address: truncateAddress(w.winner),
            amount: prettyAmount(uAmountToBigNumberAmount(w.amount, decimals))
        }));

        return {
            name: `${asset.ticker} Raffle`,
            currentPrize: formattedPrize,
            contributionPrice: formattedTicketPrice,
            winChance,
            timeRemaining,
            totalWon: formattedTotalWon,
            numWinners: Number(coinRaffle.winners),
            winners: formattedWinners,
        };
    }, [coinRaffle, asset, currentEpoch, winners]);

    // Check for pending raffle contribution and manage animation state
    useEffect(() => {
        if (!denom || !asset) return;

        const pendingContribution = getPendingContribution(denom);

        // If no pending contribution or it was closed, hide animation
        if (!pendingContribution || pendingContribution.wasClosed) {
            setShowRaffleAnimation(null);
            setCurrentResultIndex(0);
            return;
        }

        // If there are results to display
        if (pendingContribution.results.length > 0) {
            // Check if all results have been displayed
            if (currentResultIndex >= pendingContribution.results.length && pendingContribution.isComplete) {
                // Show summary
                setShowRaffleAnimation('summary');
                return;
            }

            // Check if we have a result to display at current index
            if (currentResultIndex < pendingContribution.results.length) {
                const result = pendingContribution.results[currentResultIndex];
                setShowRaffleAnimation(result.hasWon ? 'win' : 'lose');
            } else {
                // Waiting for more results
                setShowRaffleAnimation('waiting');
            }
        } else {
            // No results yet, show waiting
            setShowRaffleAnimation('waiting');
        }
    }, [denom, asset, getPendingContribution, currentResultIndex]);

    const handleRaffleClick = useCallback(() => {
        if (raffleData) {
            setIsRaffleModalOpen(true);
        }
    }, [raffleData]);

    const onModalClose = useCallback(() => {
        setIsBurnModalOpen(false);
    }, [])

    const handleRaffleAnimationClose = useCallback(() => {
        if (denom) {
            const contribution = getPendingContribution(denom);
            if (contribution && !contribution.isComplete) {
                // Mark as closed so background processing can show toasts
                markAsClosed(denom);
            } else {
                // If already complete, just remove it
                removePendingContribution(denom);
            }
        }
        setShowRaffleAnimation(null);
        setCurrentResultIndex(0);
    }, [denom, getPendingContribution, markAsClosed, removePendingContribution]);

    const handleNextTicket = useCallback(() => {
        // Move to the next result
        setCurrentResultIndex(prev => prev + 1);
    }, []);

    // Get current raffle contribution data for animation
    const currentRaffleContribution = useMemo(() => {
        if (!denom) return null;
        return getPendingContribution(denom);
    }, [denom, getPendingContribution]);

    // Check if raffle contribution is in progress (not complete)
    const isRaffleInProgress = useMemo(() => {
        if (!currentRaffleContribution) return false;
        return !currentRaffleContribution.isComplete;
    }, [currentRaffleContribution]);

    // Get current result amount (if any)
    const currentResultAmount = useMemo(() => {
        if (!currentRaffleContribution || !asset) return undefined;

        const results = currentRaffleContribution.results;
        if (currentResultIndex >= results.length) return undefined;

        const result = results[currentResultIndex];
        if (!result.hasWon) return undefined;

        // Convert amount to display format
        const decimals = asset.decimals || 6;
        const bnAmount = uAmountToBigNumberAmount(result.amount, decimals);
        return prettyAmount(bnAmount);
    }, [currentRaffleContribution, currentResultIndex, asset]);

    // Calculate summary data
    const summaryData = useMemo(() => {
        if (!currentRaffleContribution || !asset) return null;

        const results = currentRaffleContribution.results;
        let totalWonAmount = BigNumber(0);
        let winnersCount = 0;
        let losersCount = 0;

        results.forEach((result: {hasWon: boolean; amount: string}) => {
            if (result.hasWon) {
                winnersCount++;
                const decimals = asset.decimals || 6;
                const amount = uAmountToBigNumberAmount(result.amount, decimals);
                totalWonAmount = totalWonAmount.plus(amount);
            } else {
                losersCount++;
            }
        });

        return {
            totalWon: totalWonAmount.gt(0) ? prettyAmount(totalWonAmount) : undefined,
            winnersCount,
            losersCount,
        };
    }, [currentRaffleContribution, asset]);

    if (isLoadingAssets) {
        return <CoinLoading/>;
    }

    if (!asset) {
        return (
            <CoinFrame>
                <Box bg="hg.card" borderWidth="1px" borderColor="hg.hairline" borderRadius="hg.lg">
                    <PageState
                        kind="not-found"
                        title="Coin not found"
                        description={`The coin "${denom}" does not exist.`}
                        action={<Button variant={hgVariant('primary')} onClick={() => router.push('/')}>Go Home</Button>}
                    />
                </Box>
            </CoinFrame>
        );
    }

    const actionVerb = isLP ? 'Lock' : 'Burn';
    const ActionIcon = isLP ? LuLock : LuFlame;
    const nextBurnDate = nextCoinBurn?.date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
    const showLocked = !isIBC && (isLP || (raffleData && lockedAmount && lockedAmount.amount.gt(0)));
    const showBurned = !isLP && !isIBC;
    const showNext = !isLoadingNextBurn && !!nextCoinBurn;

    return (
        <CoinFrame>
            <Box>
                <Button variant="ghost" size="sm" color="hg.link" px="8px" ml="-8px" onClick={() => router.back()}>
                    <LuArrowLeft/> Back
                </Button>
            </Box>

            <Flex as="section" justify="space-between" align="center" gap="20px" wrap="wrap">
                <Flex align="center" gap="16px" minW="0">
                    <AssetLogo asset={asset} size="64px"/>
                    <Flex direction="column" gap="4px" minW="0">
                        <Flex align="center" gap="10px" wrap="wrap">
                            <chakra.h1 m="0" textStyle="pageTitle" fontSize={{base: '28px', md: '36px'}} overflowWrap="anywhere">{asset.ticker}</chakra.h1>
                            {asset.verified && (
                                <chakra.span display="inline-flex" alignItems="center" gap="4px" fontSize="12px" fontWeight="600" px="10px" py="3px" borderRadius="hg.pill" color="hg.success.text" bg="hg.success/12" borderWidth="1px" borderColor="hg.success/30">
                                    <LuBadgeCheck size={12} aria-hidden/> Verified
                                </chakra.span>
                            )}
                        </Flex>
                        <chakra.span fontSize="15px" color="hg.text.secondary">{asset.name}</chakra.span>
                        <chakra.span fontSize="12px" fontFamily="mono" color="hg.text.faint" truncate>{truncateDenom(asset.denom)}</chakra.span>
                    </Flex>
                </Flex>

                {!raffleData && (
                    <Button variant={hgVariant('primary')} size="lg" onClick={() => setIsBurnModalOpen(true)}>
                        <ActionIcon/> {actionVerb} {asset.ticker}
                    </Button>
                )}
            </Flex>

            {isLP && (
                <Notice status="info" title="About locking LP coins">
                    LP (Liquidity Pool) Coins are not literally burned. Instead, they are locked forever in a secure address, permanently removing them from circulation. Once locked, these coins can never be retrieved or used again.
                </Notice>
            )}

            {isIBC && (
                <Notice status="info" title="About burning IBC coins">
                    IBC coins cannot be directly burned since their origin is from another blockchain. Instead, the BeeZee blockchain will exchange these coins to BZE and burn the resulting BZE, but only if the IBC coin has enough liquidity paired directly with BZE.
                </Notice>
            )}

            {!isLoadingRaffles && raffleData && (
                <Flex as="section" direction="column" gap="16px">
                    <SectionHeader
                        title="Burning raffle"
                        actions={
                            <Button size="sm" variant={hgVariant('secondary')} onClick={() => setIsRaffleInfoModalOpen(true)}>
                                <LuInfo/> Info
                            </Button>
                        }
                    />
                    <FeaturedCard display="flex" flexDirection="column" gap="20px">
                        <Flex justify="space-between" align="center" gap="16px" wrap="wrap">
                            <Flex direction="column" gap="8px" minW="0">
                                <chakra.h3 m="0" fontSize="20px" fontWeight="700">{raffleData.name}</chakra.h3>
                                <Flex gap="8px" wrap="wrap">
                                    <AppPill><Flex as="span" align="center" gap="6px"><LuClock size={12} aria-hidden/>{raffleData.timeRemaining} left</Flex></AppPill>
                                    <chakra.span fontSize="12px" fontWeight="600" px="10px" py="3px" borderRadius="hg.pill" color="hg.text.secondary" bg="hg.secondaryFill" borderWidth="1px" borderColor="hg.hairline">
                                        {raffleData.winChance} chance
                                    </chakra.span>
                                </Flex>
                            </Flex>
                            <Button
                                variant={hgVariant('primary')}
                                size={{base: 'md', md: 'lg'}}
                                onClick={handleRaffleClick}
                                loading={isRaffleInProgress}
                                loadingText="Joined..."
                            >
                                <LuTicket/> Join raffle
                            </Button>
                        </Flex>

                        <Grid templateColumns={{base: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))'}} gap="12px">
                            <RaffleFigure label="Prize" value={raffleData.currentPrize} foot={asset.ticker} tone="ember"/>
                            <RaffleFigure label="Contribution" value={raffleData.contributionPrice} foot={asset.ticker}/>
                            <RaffleFigure label="Total won" value={raffleData.totalWon} foot={`by ${raffleData.numWinners} winners`} tone="success"/>
                        </Grid>

                        {raffleData.winners.length > 0 && (
                            <Flex direction="column" gap="10px">
                                <chakra.h4 m="0" fontSize="14px" fontWeight="700" color="hg.text.secondary">Last {WINNERS_LIST_MAX_LEN} winners</chakra.h4>
                                <chakra.ol m="0" p="0" listStyleType="none" display="flex" flexDirection="column" gap="6px">
                                    {raffleData.winners.map((winner: {fullAddress: string; address: string; amount: string}, idx: number) => {
                                        const isCurrentUser = address && winner.fullAddress === address;
                                        return (
                                            <chakra.li key={idx} display="flex" justifyContent="space-between" alignItems="center" gap="12px" px="14px" py="10px" borderRadius="hg.md" bg="hg.inset">
                                                <Flex align="center" gap="8px" minW="0">
                                                    <chakra.span fontSize="13px" fontFamily="mono" color={isCurrentUser ? 'fg' : 'hg.text.secondary'} fontWeight={isCurrentUser ? '600' : '400'} truncate>
                                                        {idx + 1}. {winner.address}
                                                    </chakra.span>
                                                    {isCurrentUser && <AppPill>YOU</AppPill>}
                                                </Flex>
                                                <chakra.span fontSize="14px" fontWeight="700" color="hg.success.text" whiteSpace="nowrap">
                                                    +{winner.amount} {asset.ticker}
                                                </chakra.span>
                                            </chakra.li>
                                        );
                                    })}
                                </chakra.ol>
                            </Flex>
                        )}
                    </FeaturedCard>
                </Flex>
            )}

            {(showLocked || showBurned || showNext) && (
                <Grid templateColumns={{base: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))'}} gap="16px">
                    {showLocked && (
                        <BurnStat
                            label="Forever locked"
                            value={lockedAmount ? prettyAmount(lockedAmount.amount) : '0'}
                            foot={lockedAmount && lockedAmount.usdValue.gt(0) ? `≈ $${prettyAmount(lockedAmount.usdValue)}` : undefined}
                            tag={<AppPill>Never coming back</AppPill>}
                        />
                    )}
                    {showBurned && (
                        <BurnStat
                            label={`Total ${asset.ticker} burned`}
                            value={isLoadingHistory ? 'Loading...' : prettyAmount(totalBurned)}
                            foot={!isLoadingHistory && totalBurnedUsdValue.gt(0) ? `≈ $${prettyAmount(totalBurnedUsdValue)}` : undefined}
                            tag={<AppPill>All time</AppPill>}
                        />
                    )}
                    {showNext && nextCoinBurn && (
                        <BurnStat
                            label={isLP ? 'Next locking' : 'Next burning'}
                            value={prettyAmount(nextCoinBurn.amount)}
                            foot={nextCoinBurn.usdValue.gt(0) ? `≈ $${prettyAmount(nextCoinBurn.usdValue)}` : undefined}
                            tag={<AppPill>{nextBurnDate}</AppPill>}
                        />
                    )}
                </Grid>
            )}

            {showBurned && (
                <Flex as="section" direction="column" gap="16px">
                    <SectionHeader title="Recent burns"/>
                    <TableCard>
                        {isLoadingHistory ? (
                            <Box px={{base: '16px', md: '20px'}}><PageState kind="loading" rows={4}/></Box>
                        ) : burnHistory.length > 0 ? (
                            <>
                                <Box display={{base: 'none', md: 'block'}} overflowX="auto">
                                    <Table.Root size="md" bg="transparent">
                                        <Table.Header>
                                            <Table.Row>
                                                <HeaderCell>Amount burned</HeaderCell>
                                                <HeaderCell>USD value</HeaderCell>
                                                <HeaderCell>Block height</HeaderCell>
                                                <HeaderCell>Time</HeaderCell>
                                            </Table.Row>
                                        </Table.Header>
                                        <Table.Body>
                                            {burnHistory.map((burn, idx) => {
                                                const ticker = getAsset(burn.denom)?.ticker || burn.denom;
                                                return (
                                                    <Table.Row key={idx} bg="transparent" _hover={{bg: 'hg.hoverFill'}}>
                                                        <BodyCell><chakra.span {...emberAmount}>{prettyAmount(burn.amount)} {ticker}</chakra.span></BodyCell>
                                                        <BodyCell><chakra.span color="hg.text.secondary">{burn.usdValue.gt(0) ? `$${prettyAmount(burn.usdValue)}` : '-'}</chakra.span></BodyCell>
                                                        <BodyCell><chakra.span fontFamily="mono" fontSize="13px" color="hg.text.secondary">#{burn.blockHeight}</chakra.span></BodyCell>
                                                        <BodyCell><chakra.span fontSize="13px" color="hg.text.faint">{burn.timestamp}</chakra.span></BodyCell>
                                                    </Table.Row>
                                                );
                                            })}
                                        </Table.Body>
                                    </Table.Root>
                                </Box>
                                <Box display={{base: 'block', md: 'none'}}>
                                    {burnHistory.map((burn, idx) => {
                                        const ticker = getAsset(burn.denom)?.ticker || burn.denom;
                                        return (
                                            <Flex key={idx} direction="column" gap="6px" px="16px" py="14px" borderTopWidth={idx ? '1px' : '0'} borderColor="hg.divider">
                                                <Flex justify="space-between" gap="12px">
                                                    <chakra.span {...emberAmount}>{prettyAmount(burn.amount)} {ticker}</chakra.span>
                                                    <chakra.span fontSize="13px" color="hg.text.secondary">{burn.usdValue.gt(0) ? `$${prettyAmount(burn.usdValue)}` : '-'}</chakra.span>
                                                </Flex>
                                                <Flex justify="space-between" gap="12px">
                                                    <chakra.span fontFamily="mono" fontSize="12px" color="hg.text.secondary">#{burn.blockHeight}</chakra.span>
                                                    <chakra.span fontSize="12px" color="hg.text.faint">{burn.timestamp}</chakra.span>
                                                </Flex>
                                            </Flex>
                                        );
                                    })}
                                </Box>
                            </>
                        ) : (
                            <PageState
                                kind="empty"
                                icon={<LuFlame/>}
                                title="No Burns Yet"
                                description="This coin hasn't been burned yet. Be the first to toss it into the fire!"
                                action={
                                    <Button variant={hgVariant('primary')} onClick={() => setIsBurnModalOpen(true)}>
                                        <ActionIcon/> {actionVerb} some now
                                    </Button>
                                }
                            />
                        )}
                    </TableCard>
                </Flex>
            )}

            <BurnModal
                isOpen={isBurnModalOpen}
                onClose={onModalClose}
                preselectedCoin={denom}
            />

            {raffleData && asset && (
                <RaffleModal
                    isOpen={isRaffleModalOpen}
                    onClose={() => setIsRaffleModalOpen(false)}
                    raffleName={raffleData.name}
                    contributionPrice={raffleData.contributionPrice}
                    currentPrize={raffleData.currentPrize}
                    winChance={raffleData.winChance}
                    ticker={asset.ticker}
                    denom={denom}
                />
            )}

            <RaffleInfoModal
                isOpen={isRaffleInfoModalOpen}
                onClose={() => setIsRaffleInfoModalOpen(false)}
            />

            {showRaffleAnimation && asset && currentRaffleContribution && summaryData && raffleData && (
                <RaffleResultAnimation
                    result={showRaffleAnimation}
                    ticker={asset.ticker}
                    amount={currentResultAmount}
                    currentContribution={currentResultIndex + 1}
                    totalContributions={currentRaffleContribution.tickets}
                    onComplete={handleRaffleAnimationClose}
                    onNextContribution={handleNextTicket}
                    totalWon={summaryData.totalWon}
                    winnersCount={summaryData.winnersCount}
                    losersCount={summaryData.losersCount}
                    contributionPrice={raffleData.contributionPrice}
                />
            )}
        </CoinFrame>
    );
}

export default function CoinDetailPage() {
    return (
        <Suspense fallback={<CoinLoading/>}>
            <CoinDetailContent />
        </Suspense>
    );
}
