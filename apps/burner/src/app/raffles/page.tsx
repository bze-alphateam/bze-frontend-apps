'use client';

import {
    Box,
    Container,
    VStack,
    HStack,
    Text,
    Card,
    Badge,
    Grid,
} from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { RaffleInfo } from "@/components/raffle-info";
import { useRaffles } from "@/hooks/useRaffles";
import { useAsset, HighlightText, uAmountToBigNumberAmount, prettyAmount, toBigNumber, formatTimeRemainingFromEpochs, useEpochs } from "@bze/bze-ui-kit";
import { RaffleSDKType } from "@bze/bzejs/bze/burner/raffle";
import BigNumber from "bignumber.js";
import {AssetLogo} from "@/components/ui/asset_logo";

interface RaffleCardProps {
    raffle: RaffleSDKType;
    currentEpoch: BigNumber;
    onClick: () => void;
}

function RaffleCard({ raffle, currentEpoch, onClick }: RaffleCardProps) {
    const { asset } = useAsset(raffle.denom);

    const ticker = useMemo(() => asset?.ticker || raffle.denom, [asset?.ticker, raffle.denom]);
    const name = useMemo(() => asset?.name || raffle.denom, [asset?.name, raffle.denom]);
    const decimals = useMemo(() => asset?.decimals || 6, [asset?.decimals]);

    const formattedPrize = useMemo(() => {
        const potAmount = uAmountToBigNumberAmount(raffle.pot, decimals);
        const ratio = toBigNumber(raffle.ratio);
        const prizeAmount = potAmount.multipliedBy(ratio);
        return prettyAmount(prizeAmount);
    }, [raffle.pot, raffle.ratio, decimals]);

    const formattedTicketPrice = useMemo(() => {
        const bnAmount = uAmountToBigNumberAmount(raffle.ticket_price, decimals);
        return prettyAmount(bnAmount);
    }, [raffle.ticket_price, decimals]);

    const winChance = useMemo(() => {
        const chances = toBigNumber(raffle.chances);
        if (chances.isNaN() || !chances.isPositive()) {
            return "N/A";
        }
        // chances represents the number of chances out of 1 million
        const oneMillion = toBigNumber(1000000);
        const odds = oneMillion.dividedBy(chances);
        return `1 in ${prettyAmount(odds)}`;
    }, [raffle.chances]);

    const timeRemaining = useMemo(() => {
        // end_at is an epoch number (each epoch = 1 hour)
        return formatTimeRemainingFromEpochs(raffle.end_at, currentEpoch);
    }, [raffle.end_at, currentEpoch]);

    const raffleName = useMemo(() => {
        return `${ticker} Raffle`;
    }, [ticker]);

    return (
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
            shadow="lg"
            cursor="pointer"
            onClick={onClick}
            transition="all 0.3s"
            _hover={{
                transform: "translateY(-4px) rotate(1deg)",
                shadow: "2xl",
            }}
        >
            <Card.Body>
                <VStack gap="4" align="stretch">
                    {/* Coin Info Header */}
                    <HStack gap="3">
                        <Box
                            p="2"
                            borderRadius="full"
                        >
                            {asset && <AssetLogo asset={asset} size="40px" /> }
                        </Box>
                        <VStack gap="0" align="start" flex="1">
                            <Text fontSize="lg" fontWeight="black" color="purple.600" _dark={{ color: "purple.300" }}>
                                {raffleName}
                            </Text>
                            <HStack gap="1">
                                <Text fontSize="sm" fontWeight="bold">
                                    {ticker}
                                </Text>
                                <Text fontSize="xs" color="fg.muted">
                                    • {name}
                                </Text>
                            </HStack>
                        </VStack>
                    </HStack>

                    {/* Time and Chance Badges */}
                    <HStack gap="2" flexWrap="wrap">
                        <Badge colorPalette="purple" size="sm">
                            ⏰ {timeRemaining}
                        </Badge>
                        <Badge colorPalette="pink" size="sm">
                            {winChance}
                        </Badge>
                    </HStack>

                    {/* Prize and Contribution Info */}
                    <Grid templateColumns="1fr 1fr" gap="3">
                        {/* Current Prize */}
                        <Box
                            p="3"
                            bg="white"
                            _dark={{ bg: "gray.800" }}
                            borderRadius="lg"
                            textAlign="center"
                        >
                            <VStack gap="1">
                                <Text fontSize="xs" color="fg.muted" fontWeight="bold">
                                    🏆 PRIZE
                                </Text>
                                <HighlightText fontSize="xl" fontWeight="black" color="orange.500" highlightColor="orange.500" highlightIntensity="evident">
                                    {formattedPrize}
                                </HighlightText>
                                <Text fontSize="xs" color="fg.muted">
                                    {ticker}
                                </Text>
                            </VStack>
                        </Box>

                        {/* Contribution Price */}
                        <Box
                            p="3"
                            bg="white"
                            _dark={{ bg: "gray.800" }}
                            borderRadius="lg"
                            textAlign="center"
                        >
                            <VStack gap="1">
                                <Text fontSize="xs" color="fg.muted" fontWeight="bold">
                                    💰 CONTRIBUTION
                                </Text>
                                <Text fontSize="xl" fontWeight="black" color="purple.500">
                                    {formattedTicketPrice}
                                </Text>
                                <Text fontSize="xs" color="fg.muted">
                                    {ticker}
                                </Text>
                            </VStack>
                        </Box>
                    </Grid>

                    {/* Click to view CTA */}
                    <Box
                        p="2"
                        bg="purple.100"
                        _dark={{ bg: "purple.900/30" }}
                        borderRadius="md"
                        textAlign="center"
                    >
                        <Text fontSize="xs" fontWeight="bold" color="purple.700" _dark={{ color: "purple.300" }}>
                            Click to contribute →
                        </Text>
                    </Box>
                </VStack>
            </Card.Body>
        </Card.Root>
    );
}

export default function RafflesPage() {
    const router = useRouter();
    const { raffles, isLoading } = useRaffles();
    const {hourEpochInfo} = useEpochs()

    const currentEpoch = useMemo(() => toBigNumber(hourEpochInfo?.current_epoch ?? 0), [hourEpochInfo])

    const handleRaffleClick = (denom: string) => {
        router.push(`/coin?coin=${denom}`);
    };

    return (
        <Box minH="100vh" pb="12">
            <Container py={{ base: '6', md: '10' }}>
                <VStack gap="8" align="stretch">
                    {/* Page Header */}
                    <VStack gap="2" align="start">
                        <Text fontSize={{ base: "3xl", md: "4xl" }} fontWeight="black">
                            🔥 Burning Raffles
                        </Text>
                        <Text fontSize={{ base: "md", md: "lg" }} color="fg.muted">
                            Join active raffles and win rewards by burning tokens!
                        </Text>
                    </VStack>

                    {/* Info Card - What are Burning Raffles */}
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
                                        What are Burning Raffles?
                                    </Text>
                                </HStack>
                                <RaffleInfo />
                            </VStack>
                        </Card.Body>
                    </Card.Root>

                    {/* Raffles Grid */}
                    {isLoading ? (
                        <Box textAlign="center" py="12">
                            <Text fontSize="md" color="fg.muted">
                                Loading raffles...
                            </Text>
                        </Box>
                    ) : raffles.length > 0 ? (
                        <Grid
                            templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }}
                            gap="6"
                        >
                            {raffles.map((raffle, idx) => (
                                <RaffleCard
                                    key={`${raffle.denom}-${idx}`}
                                    raffle={raffle}
                                    currentEpoch={currentEpoch}
                                    onClick={() => handleRaffleClick(raffle.denom)}
                                />
                            ))}
                        </Grid>
                    ) : (
                        <Card.Root>
                            <Card.Body>
                                <VStack gap="3" align="center" py="12">
                                    <Text fontSize="4xl">🔥</Text>
                                    <Text fontSize="xl" fontWeight="bold">
                                        No Active Raffles
                                    </Text>
                                    <Text fontSize="sm" color="fg.muted" textAlign="center">
                                        There are no active raffles at the moment. Check back later!
                                    </Text>
                                </VStack>
                            </Card.Body>
                        </Card.Root>
                    )}
                </VStack>
            </Container>
        </Box>
    );
}
