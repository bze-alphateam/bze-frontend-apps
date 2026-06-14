'use client';

import {
    Box,
    Container,
    VStack,
    HStack,
    Text,
    Card,
    Badge,
    Table,
    Button,
    Grid,
} from "@chakra-ui/react";
import { useRouter, useSearchParams } from "next/navigation";
import {useCallback, useEffect, useMemo, useState, Suspense} from "react";
import { useChain } from "@interchain-kit/react";
import { getChainName, prettyAmount, uAmountToBigNumberAmount, toBigNumber, truncateDenom, isLpDenom, isIbcDenom, formatTimeRemainingFromEpochs, truncateAddress, useAssetsValue, useEpochs, HighlightText, useAssets } from "@bze/bze-ui-kit";
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

const WINNERS_LIST_MAX_LEN = 20;

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

    // Show loading state
    if (isLoadingAssets) {
        return (
            <Container py="10">
                <VStack gap="4" align="center" py="20">
                    <Text fontSize="xl" color="fg.muted">
                        Loading...
                    </Text>
                </VStack>
            </Container>
        );
    }

    // Show 404 if coin not found
    if (!asset) {
        return (
            <Container py="10">
                <VStack gap="4" align="center" py="20">
                    <Text fontSize="4xl">🤷</Text>
                    <Text fontSize="xl" fontWeight="bold">
                        Coin not found
                    </Text>
                    <Text fontSize="sm" color="fg.muted">
                        The coin &quot;{denom}&quot; does not exist.
                    </Text>
                    <Button onClick={() => router.push('/')} colorPalette="orange">
                        Go Home
                    </Button>
                </VStack>
            </Container>
        );
    }

    return (
        <Box minH="100vh" pb="12">
            <Container py={{ base: '6', md: '10' }}>
                <VStack gap="8" align="stretch" transition="opacity 0.2s ease-in-out">
                    {/* Back Button */}
                    <Box>
                        <Button
                            variant="ghost"
                            onClick={() => router.back()}
                            size="sm"
                        >
                            ← Back
                        </Button>
                    </Box>

                    {/* Coin Header */}
                    <Card.Root
                        bgGradient="to-br"
                        gradientFrom="orange.50"
                        gradientTo="orange.100"
                        _dark={{
                            gradientFrom: "orange.950",
                            gradientTo: "orange.900",
                        }}
                        borderRadius="3xl"
                        shadow="lg"
                    >
                        <Card.Body>
                            <VStack gap="6" align="stretch">
                                {/* Coin Info */}
                                <HStack justify="space-between" flexWrap="wrap" gap="4">
                                    <HStack gap="4">
                                        <Box
                                            p="3"
                                            borderRadius="full"
                                        >
                                            <AssetLogo asset={asset} size="64px" />
                                        </Box>
                                        <VStack gap="1" align="start">
                                            <HStack gap="2">
                                                <Text fontSize="2xl" fontWeight="black">
                                                    {asset.ticker}
                                                </Text>
                                                {asset.verified && (
                                                    <Badge colorPalette="green" size="sm" variant="solid">
                                                        ✓ Verified
                                                    </Badge>
                                                )}
                                            </HStack>
                                            <Text fontSize="md" color="fg.muted" fontWeight="medium">
                                                {asset.name}
                                            </Text>
                                            <Badge colorPalette="gray" size="sm" variant="subtle" maxW="full" overflow="hidden" textOverflow="ellipsis">
                                                {truncateDenom(asset.denom)}
                                            </Badge>
                                        </VStack>
                                    </HStack>

                                    {!raffleData && (
                                        <Button
                                            size="lg"
                                            colorPalette={"orange"}
                                            onClick={() => setIsBurnModalOpen(true)}
                                            fontWeight="bold"
                                        >
                                            {isLP ? '🔒' : '🔥'} {isLP ? 'Lock' : 'Burn'} {asset.ticker}
                                        </Button>
                                    )}
                                </HStack>
                            </VStack>
                        </Card.Body>
                    </Card.Root>

                    {/* LP Coin Explanation */}
                    {isLP && (
                        <Card.Root
                            bgGradient="to-br"
                            gradientFrom="blue.50"
                            gradientTo="blue.100"
                            _dark={{
                                gradientFrom: "blue.950",
                                gradientTo: "blue.900",
                            }}
                            borderRadius="3xl"
                            shadow="lg"
                        >
                            <Card.Body>
                                <VStack gap="4" align="stretch">
                                    <HStack gap="3">
                                        <Text fontSize="3xl">ℹ️</Text>
                                        <Text fontSize="xl" fontWeight="black" color="blue.700" _dark={{ color: "blue.300" }}>
                                            About Locking LP Coins
                                        </Text>
                                    </HStack>
                                    <Text fontSize="sm" color="fg.muted" lineHeight="1.6">
                                        LP (Liquidity Pool) Coins are not literally burned. Instead, they are locked forever in a secure address, permanently removing them from circulation. Once locked, these coins can never be retrieved or used again.
                                    </Text>
                                </VStack>
                            </Card.Body>
                        </Card.Root>
                    )}

                    {/* IBC Coin Explanation */}
                    {isIBC && (
                        <Card.Root
                            bgGradient="to-br"
                            gradientFrom="blue.50"
                            gradientTo="blue.100"
                            _dark={{
                                gradientFrom: "blue.950",
                                gradientTo: "blue.900",
                            }}
                            borderRadius="3xl"
                            shadow="lg"
                        >
                            <Card.Body>
                                <VStack gap="4" align="stretch">
                                    <HStack gap="3">
                                        <Text fontSize="3xl">ℹ️</Text>
                                        <Text fontSize="xl" fontWeight="black" color="blue.700" _dark={{ color: "blue.300" }}>
                                            About Burning IBC Coins
                                        </Text>
                                    </HStack>
                                    <Text fontSize="sm" color="fg.muted" lineHeight="1.6">
                                        IBC coins cannot be directly burned since their origin is from another blockchain. Instead, the BeeZee blockchain will exchange these coins to BZE and burn the resulting BZE, but only if the IBC coin has enough liquidity paired directly with BZE.
                                    </Text>
                                </VStack>
                            </Card.Body>
                        </Card.Root>
                    )}

                    {/* Burning Raffle Section */}
                    {!isLoadingRaffles && raffleData && (
                        <Box>
                            <HStack justify="space-between" mb="4" flexWrap="wrap" gap="2">
                                <Text fontSize={{ base: "xl", md: "2xl" }} fontWeight="black">
                                    🔥 Burning Raffle
                                </Text>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    colorPalette="blue"
                                    onClick={() => setIsRaffleInfoModalOpen(true)}
                                >
                                    ℹ️ Info
                                </Button>
                            </HStack>
                            <VStack gap="4" align="stretch">
                                <Card.Root
                                    bgGradient="to-br"
                                    gradientFrom="purple.50"
                                    gradientVia="pink.50"
                                    gradientTo="orange.50"
                                    _dark={{
                                        gradientFrom: "purple.950",
                                        gradientVia: "pink.950",
                                        gradientTo: "orange.950",
                                    }}
                                    borderRadius="3xl"
                                    shadow="xl"
                                >
                                    <Card.Body>
                                        <VStack gap="4" align="stretch">
                                            {/* Raffle Header */}
                                            <HStack justify="space-between" flexWrap="wrap" gap="2">
                                                <VStack gap="1" align="start">
                                                    <Text fontSize="xl" fontWeight="black" color="purple.600" _dark={{ color: "purple.300" }}>
                                                        {raffleData.name}
                                                    </Text>
                                                    <HStack gap="2">
                                                        <Badge colorPalette="purple" size="sm">
                                                            ⏰ {raffleData.timeRemaining} left
                                                        </Badge>
                                                        <Badge colorPalette="pink" size="sm">
                                                            {raffleData.winChance} chance
                                                        </Badge>
                                                    </HStack>
                                                </VStack>
                                                <Button
                                                    colorPalette="purple"
                                                    size={{ base: "md", md: "lg" }}
                                                    fontWeight="bold"
                                                    onClick={handleRaffleClick}
                                                    loading={isRaffleInProgress}
                                                    loadingText="Joined..."
                                                >
                                                    🎫 Join Raffle
                                                </Button>
                                            </HStack>

                                            {/* Prize and Stats Grid */}
                                            <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap="3">
                                                {/* Current Prize */}
                                                <Box
                                                    p="4"
                                                    bg="white"
                                                    _dark={{ bg: "gray.800" }}
                                                    borderRadius="lg"
                                                    textAlign="center"
                                                >
                                                    <VStack gap="1">
                                                        <Text fontSize="xs" color="fg.muted" fontWeight="bold">
                                                            🏆 Prize
                                                        </Text>
                                                        <HighlightText fontSize="2xl" fontWeight="black" color="orange.500" highlightColor="orange.500" highlightIntensity="evident">
                                                            {raffleData.currentPrize}
                                                        </HighlightText>
                                                        <Text fontSize="xs" color="fg.muted">
                                                            {asset.ticker}
                                                        </Text>
                                                    </VStack>
                                                </Box>

                                                {/* Contribution Price */}
                                                <Box
                                                    p="4"
                                                    bg="white"
                                                    _dark={{ bg: "gray.800" }}
                                                    borderRadius="lg"
                                                    textAlign="center"
                                                >
                                                    <VStack gap="1">
                                                        <Text fontSize="xs" color="fg.muted" fontWeight="bold">
                                                            💰 CONTRIBUTION
                                                        </Text>
                                                        <Text fontSize="2xl" fontWeight="black" color="purple.500">
                                                            {raffleData.contributionPrice}
                                                        </Text>
                                                        <Text fontSize="xs" color="fg.muted">
                                                            {asset.ticker}
                                                        </Text>
                                                    </VStack>
                                                </Box>

                                                {/* Total Won */}
                                                <Box
                                                    p="4"
                                                    bg="white"
                                                    _dark={{ bg: "gray.800" }}
                                                    borderRadius="lg"
                                                    textAlign="center"
                                                >
                                                    <VStack gap="1">
                                                        <Text fontSize="xs" color="fg.muted" fontWeight="bold">
                                                            💰 TOTAL WON
                                                        </Text>
                                                        <HighlightText fontSize="2xl" fontWeight="black" color="green.500" highlightColor="green.500" highlightIntensity="evident">
                                                            {raffleData.totalWon}
                                                        </HighlightText>
                                                        <Text fontSize="xs" color="fg.muted">
                                                            by {raffleData.numWinners} winners
                                                        </Text>
                                                    </VStack>
                                                </Box>
                                            </Grid>

                                            {/* Winners List */}
                                            {raffleData.winners.length > 0 && (
                                                <Box>
                                                    <Text fontSize="sm" fontWeight="bold" mb="2" color="purple.600" _dark={{ color: "purple.400" }}>
                                                        🎉 Last {WINNERS_LIST_MAX_LEN} Winners
                                                    </Text>
                                                    <VStack gap="2" align="stretch">
                                                        {raffleData.winners.map((winner: {fullAddress: string; address: string; amount: string}, idx: number) => {
                                                            const isCurrentUser = address && winner.fullAddress === address;
                                                            return (
                                                                <HStack
                                                                    key={idx}
                                                                    justify="space-between"
                                                                    p="3"
                                                                    bg="white"
                                                                    _dark={{ bg: "gray.800" }}
                                                                    borderRadius="md"
                                                                >
                                                                    <HStack gap="2">
                                                                        <Text fontSize="sm" fontFamily="mono" color="fg.muted" fontWeight={isCurrentUser ? "semibold" : "normal"}>
                                                                            {idx + 1}. {winner.address}
                                                                        </Text>
                                                                        {isCurrentUser && (
                                                                            <Badge colorPalette="green" size="xs" variant="subtle">
                                                                                YOU
                                                                            </Badge>
                                                                        )}
                                                                    </HStack>
                                                                    <Text fontSize="sm" fontWeight="bold" color="green.500">
                                                                        +{winner.amount} {asset.ticker}
                                                                    </Text>
                                                                </HStack>
                                                            );
                                                        })}
                                                    </VStack>
                                                </Box>
                                            )}
                                        </VStack>
                                    </Card.Body>
                                </Card.Root>
                            </VStack>
                        </Box>
                    )}

                    {/* Forever Locked Section - Show for LP coins (even if 0) or non-burnable coins with raffles, but never for IBC */}
                    {!isIBC && (isLP || (raffleData && lockedAmount && lockedAmount.amount.gt(0))) && (
                        <Card.Root
                            bgGradient="to-br"
                            gradientFrom="orange.50"
                            gradientTo="orange.100"
                            _dark={{
                                gradientFrom: "orange.950",
                                gradientTo: "orange.900",
                            }}
                            borderRadius="2xl"
                            shadow="lg"
                            transition="all 0.3s ease-in-out"
                        >
                            <Card.Body>
                                <VStack gap="2" align="center" py="4">
                                    <Text fontSize={{ base: "sm", md: "md" }} fontWeight="semibold" color="orange.600" _dark={{ color: "orange.400" }} textTransform="uppercase">
                                        🔒 Forever Locked
                                    </Text>
                                    {lockedAmount ? (
                                        <VStack gap="1" align="center">
                                            <HighlightText fontSize={{ base: "3xl", md: "4xl" }} fontWeight="black" color="orange.500" highlightColor="orange.500" highlightIntensity="evident">
                                                {prettyAmount(lockedAmount.amount)}
                                            </HighlightText>
                                            {lockedAmount.usdValue.gt(0) && (
                                                <Text fontSize={{ base: "md", md: "lg" }} color="fg.muted" fontWeight="semibold">
                                                    ≈ ${prettyAmount(lockedAmount.usdValue)}
                                                </Text>
                                            )}
                                        </VStack>
                                    ) : (
                                        <VStack gap="1" align="center">
                                            <HighlightText fontSize={{ base: "3xl", md: "4xl" }} fontWeight="black" color="orange.500" highlightColor="orange.500" highlightIntensity="evident">
                                                0
                                            </HighlightText>
                                        </VStack>
                                    )}
                                    <Badge colorPalette="orange" variant="subtle" size="md" borderRadius="full">
                                        Never Coming Back
                                    </Badge>
                                </VStack>
                            </Card.Body>
                        </Card.Root>
                    )}

                    {/* Total Burned Statistics - Only show for burnable coins (not LP, not IBC) */}
                    {!isLP && !isIBC && (
                        <Card.Root
                            bgGradient="to-br"
                            gradientFrom="orange.50"
                            gradientTo="orange.100"
                            _dark={{
                                gradientFrom: "orange.950",
                                gradientTo: "orange.900",
                            }}
                            borderRadius="2xl"
                            shadow="lg"
                            transition="all 0.3s ease-in-out"
                        >
                            <Card.Body>
                                <VStack gap="2" align="center" py="4">
                                    <Text fontSize={{ base: "sm", md: "md" }} fontWeight="semibold" color="orange.600" _dark={{ color: "orange.400" }} textTransform="uppercase">
                                        💰 Total {asset.ticker} Burned
                                    </Text>
                                    {isLoadingHistory ? (
                                        <Text fontSize="md" color="fg.muted">
                                            Loading...
                                        </Text>
                                    ) : (
                                        <VStack gap="1" align="center">
                                            <HighlightText fontSize={{ base: "3xl", md: "4xl" }} fontWeight="black" color="orange.500" highlightColor="orange.500" highlightIntensity="evident">
                                                {prettyAmount(totalBurned)}
                                            </HighlightText>
                                            {totalBurnedUsdValue.gt(0) && (
                                                <Text fontSize={{ base: "md", md: "lg" }} color="fg.muted" fontWeight="semibold">
                                                    ≈ ${prettyAmount(totalBurnedUsdValue)}
                                                </Text>
                                            )}
                                        </VStack>
                                    )}
                                    <Badge colorPalette="orange" variant="subtle" size="md" borderRadius="full">
                                        All Time
                                    </Badge>
                                </VStack>
                            </Card.Body>
                        </Card.Root>
                    )}

                    {/* Next Burning Section - Show if there's something in the burner address */}
                    {!isLoadingNextBurn && nextCoinBurn && (
                        <Card.Root
                            bgGradient="to-br"
                            gradientFrom="orange.50"
                            gradientTo="orange.100"
                            _dark={{
                                gradientFrom: "orange.950",
                                gradientTo: "orange.900",
                            }}
                            borderRadius="2xl"
                            shadow="lg"
                            transition="all 0.3s ease-in-out"
                        >
                            <Card.Body>
                                <VStack gap="2" align="center" py="4">
                                    <Text fontSize={{ base: "sm", md: "md" }} fontWeight="semibold" color="orange.600" _dark={{ color: "orange.400" }} textTransform="uppercase">
                                        {isLP ? '🔒 Next Locking' : '🔥 Next Burning'}
                                    </Text>
                                    <VStack gap="1" align="center">
                                        <HighlightText fontSize={{ base: "3xl", md: "4xl" }} fontWeight="black" color="orange.500" highlightColor="orange.500" highlightIntensity="evident">
                                            {prettyAmount(nextCoinBurn.amount)}
                                        </HighlightText>
                                        {nextCoinBurn.usdValue.gt(0) && (
                                            <Text fontSize={{ base: "md", md: "lg" }} color="fg.muted" fontWeight="semibold">
                                                ≈ ${prettyAmount(nextCoinBurn.usdValue)}
                                            </Text>
                                        )}
                                    </VStack>
                                    <Badge colorPalette="orange" variant="subtle" size="md" borderRadius="full">
                                        {nextCoinBurn.date.toLocaleString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </Badge>
                                </VStack>
                            </Card.Body>
                        </Card.Root>
                    )}

                    {/* Burn History - Only show for burnable coins (not LP, not IBC) */}
                    {!isLP && !isIBC && (
                        <Box>
                            <Text fontSize={{ base: "xl", md: "2xl" }} fontWeight="black" mb="4">
                                🔥 Recent Burns
                            </Text>
                        {isLoadingHistory ? (
                            <Card.Root>
                                <Card.Body>
                                    <Text textAlign="center" py="8" color="fg.muted">
                                        Loading burn history...
                                    </Text>
                                </Card.Body>
                            </Card.Root>
                        ) : burnHistory.length > 0 ? (
                            <Box
                                borderRadius="3xl"
                                overflow="hidden"
                                bg="bg.panel"
                                shadow="xl"
                            >
                                {/* Desktop Table View */}
                                <Box display={{ base: "none", md: "block" }} overflowX="auto">
                                    <Table.Root size="md" variant="outline">
                                        <Table.Header>
                                            <Table.Row bg="orange.100" _dark={{ bg: "orange.900" }}>
                                                <Table.ColumnHeader fontWeight="black">Amount Burned</Table.ColumnHeader>
                                                <Table.ColumnHeader fontWeight="black">USD Value</Table.ColumnHeader>
                                                <Table.ColumnHeader fontWeight="black">Block Height</Table.ColumnHeader>
                                                <Table.ColumnHeader fontWeight="black">Time</Table.ColumnHeader>
                                            </Table.Row>
                                        </Table.Header>
                                        <Table.Body>
                                            {burnHistory.map((burn, idx) => {
                                                const assetData = getAsset(burn.denom);
                                                const ticker = assetData?.ticker || burn.denom;
                                                const formattedAmount = prettyAmount(burn.amount);
                                                const formattedUsdValue = prettyAmount(burn.usdValue);

                                                return (
                                                    <Table.Row
                                                        key={idx}
                                                        _hover={{
                                                            bg: "orange.50",
                                                            _dark: { bg: "orange.950" }
                                                        }}
                                                        transition="all 0.2s"
                                                    >
                                                        <Table.Cell>
                                                            <Text fontWeight="black" fontSize="md" color="orange.500">
                                                                {formattedAmount} {ticker}
                                                            </Text>
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                            <Text fontSize="sm" color="fg.muted">
                                                                {burn.usdValue.gt(0) ? `$${formattedUsdValue}` : '-'}
                                                            </Text>
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                            <Badge colorPalette="gray" variant="subtle" size="md" borderRadius="full">
                                                                #{burn.blockHeight}
                                                            </Badge>
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                            <Text fontSize="sm" color="fg.muted">
                                                                {burn.timestamp}
                                                            </Text>
                                                        </Table.Cell>
                                                    </Table.Row>
                                                );
                                            })}
                                        </Table.Body>
                                    </Table.Root>
                                </Box>

                                {/* Mobile Card View */}
                                <Box display={{ base: "block", md: "none" }}>
                                    <VStack gap="0" align="stretch">
                                        {burnHistory.map((burn, idx) => {
                                            const assetData = getAsset(burn.denom);
                                            const ticker = assetData?.ticker || burn.denom;
                                            const formattedAmount = prettyAmount(burn.amount);
                                            const formattedUsdValue = prettyAmount(burn.usdValue);

                                            return (
                                                <Box
                                                    key={idx}
                                                    p="4"
                                                    borderBottomWidth={idx < burnHistory.length - 1 ? "2px" : "0"}
                                                    borderColor="orange.200"
                                                    _dark={{ borderColor: "orange.800" }}
                                                >
                                                    <VStack gap="2" align="stretch">
                                                        <HStack justify="space-between">
                                                            <Text fontWeight="black" color="orange.500" fontSize="md">
                                                                {formattedAmount} {ticker}
                                                            </Text>
                                                            <Text fontSize="sm" color="fg.muted">
                                                                {burn.usdValue.gt(0) ? `$${formattedUsdValue}` : '-'}
                                                            </Text>
                                                        </HStack>
                                                        <HStack justify="space-between">
                                                            <Badge colorPalette="gray" variant="subtle" size="sm" borderRadius="full">
                                                                #{burn.blockHeight}
                                                            </Badge>
                                                            <Text fontSize="xs" color="fg.muted">
                                                                {burn.timestamp}
                                                            </Text>
                                                        </HStack>
                                                    </VStack>
                                                </Box>
                                            );
                                        })}
                                    </VStack>
                                </Box>
                            </Box>
                        ) : (
                            <Card.Root>
                                <Card.Body>
                                    <VStack gap="3" align="center" py="8">
                                        <Text fontSize="4xl">🔍</Text>
                                        <Text fontSize="xl" fontWeight="bold">
                                            No Burns Yet
                                        </Text>
                                        <Text fontSize="sm" color="fg.muted" textAlign="center">
                                            This coins hasn&apos;t been burned yet. Be the first to toss it into the fire!
                                        </Text>
                                        <Button
                                            colorPalette={"orange"}
                                            onClick={() => setIsBurnModalOpen(true)}
                                            mt="2"
                                        >
                                            {isLP ? '🔒' : '🔥'} {isLP ? 'Lock' : 'Burn'} Some Now
                                        </Button>
                                    </VStack>
                                </Card.Body>
                            </Card.Root>
                        )}
                        </Box>
                    )}
                </VStack>
            </Container>

            {/* Burn Modal with preselected coin */}
            <BurnModal
                isOpen={isBurnModalOpen}
                onClose={onModalClose}
                preselectedCoin={denom}
            />

            {/* Raffle Modal */}
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

            {/* Raffle Info Modal */}
            <RaffleInfoModal
                isOpen={isRaffleInfoModalOpen}
                onClose={() => setIsRaffleInfoModalOpen(false)}
            />

            {/* Raffle Result Animation */}
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
        </Box>
    );
}

export default function CoinDetailPage() {
    return (
        <Suspense fallback={
            <Container py="10">
                <VStack gap="4" align="center" py="20">
                    <Text fontSize="xl" color="fg.muted">
                        Loading...
                    </Text>
                </VStack>
            </Container>
        }>
            <CoinDetailContent />
        </Suspense>
    );
}
