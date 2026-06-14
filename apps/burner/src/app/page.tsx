'use client';

import {
    Box,
    Container,
    Grid,
    GridItem,
    HStack,
    VStack,
    Text,
    Card,
    Table,
    Badge,
    Separator,
    Button,
} from "@chakra-ui/react";
import {useState, useMemo, useEffect, useCallback} from "react";
import { useRouter } from "next/navigation";
import { useAssetsValue, prettyAmount, uAmountToBigNumberAmount, HighlightText, isLpDenom, useAssets, useAsset } from "@bze/bze-ui-kit";
import { useBurnerContext } from "@/hooks/useBurnerContext";
import { BurnModal } from "@/components/burn-modal";
import { useBurningHistory } from "@/hooks/useBurningHistory";
import { useNextBurning } from "@/hooks/useNextBurning";
import BigNumber from "bignumber.js";
import {AssetLogo} from "@/components/ui/asset_logo";

const MAX_BURN_HISTORY_ITEMS = 30;

// Countdown Timer Component with playful design
const CountdownTimer = ({ targetDate }: { targetDate: Date }) => {
    const [timeLeft, setTimeLeft] = useState(0);

    useEffect(() => {
        const calculateTimeLeft = () => {
            const now = new Date();
            const diff = Math.floor((targetDate.getTime() - now.getTime()) / 1000);
            setTimeLeft(Math.max(0, diff));
        };

        // Calculate immediately
        calculateTimeLeft();

        // Update every second
        const interval = setInterval(calculateTimeLeft, 1000);

        return () => clearInterval(interval);
    }, [targetDate]);

    const days = Math.floor(timeLeft / 86400);
    const hours = Math.floor((timeLeft % 86400) / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);
    const seconds = timeLeft % 60;

    return (
        <VStack gap="2">
            <HStack gap="2" fontFamily="mono" fontSize={{ base: "xl", md: "2xl" }} fontWeight="black" flexWrap="wrap" justify="center">
                {days > 0 && (
                    <>
                        <Box
                            px={{ base: "3", md: "4" }}
                            py={{ base: "2", md: "3" }}
                            bgGradient="to-br"
                            gradientFrom="orange.400"
                            gradientTo="red.500"
                            borderRadius="2xl"
                            color="white"
                            _light={{ color: "gray.900" }}
                            minW={{ base: "50px", md: "60px" }}
                            textAlign="center"
                            shadow="xl"
                            transform="rotate(-2deg)"
                            _hover={{ transform: "rotate(0deg) scale(1.05)" }}
                            transition="all 0.3s"
                        >
                            {String(days).padStart(2, '0')}
                        </Box>
                        <Text color="orange.500" fontSize={{ base: "2xl", md: "3xl" }}>🔥</Text>
                    </>
                )}
                <Box
                    px={{ base: "3", md: "4" }}
                    py={{ base: "2", md: "3" }}
                    bgGradient="to-br"
                    gradientFrom="orange.400"
                    gradientTo="red.500"
                    borderRadius="2xl"
                    color="white"
                    _light={{ color: "gray.900" }}
                    minW={{ base: "50px", md: "60px" }}
                    textAlign="center"
                    shadow="xl"
                    transform="rotate(-2deg)"
                    _hover={{ transform: "rotate(0deg) scale(1.05)" }}
                    transition="all 0.3s"
                >
                    {String(hours).padStart(2, '0')}
                </Box>
                <Text color="orange.500" fontSize={{ base: "2xl", md: "3xl" }}>🔥</Text>
                <Box
                    px={{ base: "3", md: "4" }}
                    py={{ base: "2", md: "3" }}
                    bgGradient="to-br"
                    gradientFrom="orange.400"
                    gradientTo="red.500"
                    borderRadius="2xl"
                    color="white"
                    _light={{ color: "gray.900" }}
                    minW={{ base: "50px", md: "60px" }}
                    textAlign="center"
                    shadow="xl"
                    transform="rotate(2deg)"
                    _hover={{ transform: "rotate(0deg) scale(1.05)" }}
                    transition="all 0.3s"
                >
                    {String(minutes).padStart(2, '0')}
                </Box>
                <Text color="orange.500" fontSize={{ base: "2xl", md: "3xl" }}>🔥</Text>
                <Box
                    px={{ base: "3", md: "4" }}
                    py={{ base: "2", md: "3" }}
                    bgGradient="to-br"
                    gradientFrom="orange.400"
                    gradientTo="red.500"
                    borderRadius="2xl"
                    color="white"
                    _light={{ color: "gray.900" }}
                    minW={{ base: "50px", md: "60px" }}
                    textAlign="center"
                    shadow="xl"
                    transform="rotate(-2deg)"
                    _hover={{ transform: "rotate(0deg) scale(1.05)" }}
                    transition="all 0.3s"
                >
                    {String(seconds).padStart(2, '0')}
                </Box>
            </HStack>
            <HStack gap={{ base: "4", md: "8" }} fontSize="xs" fontWeight="bold" color="fg.muted" textTransform="uppercase" flexWrap="wrap" justify="center">
                {days > 0 && <Text>Days</Text>}
                <Text>Hours</Text>
                <Text>Minutes</Text>
                <Text>Seconds</Text>
            </HStack>
        </VStack>
    );
};

// Pending Burn Token Box Component with playful design
const PendingBurnBox = ({ denom, amount, onClick }: {
    denom: string;
    amount: string;
    onClick: () => void;
}) => {
    const { totalUsdValue } = useAssetsValue();
    const { denomDecimals } = useAssets();
    const { asset } = useAsset(denom);

    const isLP = isLpDenom(denom);

    const ticker = asset?.ticker || denom;
    const name = asset?.name || denom;

    const decimals = denomDecimals(denom);
    const prettyAmountValue = useMemo(() => {
        const bnAmount = uAmountToBigNumberAmount(amount, decimals);
        return prettyAmount(bnAmount);
    }, [amount, decimals]);

    const prettyUsdValue = useMemo(() => {
        const bnAmount = uAmountToBigNumberAmount(amount, decimals);
        const usd = totalUsdValue([{ denom, amount: bnAmount }]);
        return prettyAmount(usd);
    }, [amount, decimals, denom, totalUsdValue]);

    return (
        <Box
            p="5"
            bg="bg.panel"
            borderRadius="3xl"
            shadow="lg"
            cursor="pointer"
            onClick={onClick}
            _hover={{
                shadow: "2xl",
                transform: "translateY(-4px) rotate(1deg)",
            }}
            transition="all 0.3s"
            position="relative"
            overflow="hidden"
        >
            <VStack gap="3" align="center">
                <Box
                    p="2"
                    borderRadius="full"
                    width={isLP ? "80px" : "auto"}
                    display="flex"
                    justifyContent="center"
                    alignItems="center"
                >
                    {asset && (<AssetLogo asset={asset} size="56px"/>)}
                </Box>
                <VStack gap="1" align="center">
                    <Text fontSize="sm" color="fg.muted" fontWeight="medium">
                        {name}
                    </Text>
                    <Badge colorPalette="orange" size="md" variant="solid" borderRadius="full">
                        {ticker}
                    </Badge>
                </VStack>
                <VStack gap="0" align="center" mt="2">
                    <Text fontSize="xs" color="fg.muted" textTransform="uppercase" fontWeight="bold">
                        Ready to Burn
                    </Text>
                    <HighlightText fontSize="2xl" fontWeight="black" color="orange.500" highlightColor="orange.500" highlightIntensity="evident">
                        {prettyAmountValue}
                    </HighlightText>
                    {prettyUsdValue && (
                        <Text fontSize="sm" color="fg.muted" fontWeight="medium">
                            ≈ ${prettyUsdValue}
                        </Text>
                    )}
                </VStack>
            </VStack>
        </Box>
    );
};

export default function BurnerHomePage() {
    // Burn modal state
    const [isBurnModalOpen, setIsBurnModalOpen] = useState(false);

    // Router for navigation
    const router = useRouter();

    // Fetch burn history
    const { burnHistory, isLoading: isLoadingHistory } = useBurningHistory();
    const { getAsset, nativeAsset } = useAssets();
    const { totalUsdValue } = useAssetsValue();
    const { nextBurn, isLoading: isLoadingNextBurn } = useNextBurning();
    const { lockBalance } = useBurnerContext();

    // Get last 10 burns
    const lastBurnings = burnHistory.slice(0, MAX_BURN_HISTORY_ITEMS);

    // Calculate total BZE burned
    const totalBzeBurned = useMemo(() => {
        if (!nativeAsset) return BigNumber(0);

        const nativeBurns = burnHistory.filter(burn => burn.denom === nativeAsset.denom);
        return nativeBurns.reduce((total, burn) => {
            return total.plus(burn.amount);
        }, BigNumber(0));
    }, [burnHistory, nativeAsset]);

    // Calculate USD value of total BZE burned
    const totalBzeUsdValue = useMemo(() => {
        if (!nativeAsset || totalBzeBurned.isZero()) return BigNumber(0);

        return totalUsdValue([{ denom: nativeAsset.denom, amount: totalBzeBurned }]);
    }, [totalBzeBurned, nativeAsset, totalUsdValue]);

    const pendingBurns = useMemo(() => nextBurn?.coins || [], [nextBurn]);

    // Calculate forever locked tokens with USD values
    const lockedTokens = useMemo(() => {
        const tokens = Array.from(lockBalance.entries()).map(([denom, balance]) => {
            const asset = getAsset(denom);
            const amount = uAmountToBigNumberAmount(balance.amount, asset?.decimals ?? 0)
            const usdValue = totalUsdValue([{ denom, amount: amount }]);

            return {
                denom,
                balance: amount,
                asset,
                usdValue,
                ticker: asset?.ticker || denom,
                name: asset?.name || denom,
                logo: asset?.logo || "/images/token.svg",
            };
        });

        // Sort by USD value (highest first), then by balance
        return tokens.sort((a, b) => {
            if (b.usdValue.gt(a.usdValue)) return 1;
            if (b.usdValue.lt(a.usdValue)) return -1;
            return b.balance.comparedTo(a.balance) ?? 0;
        });
    }, [lockBalance, getAsset, totalUsdValue]);

    // Calculate total USD value of locked tokens
    const totalLockedUsdValue = useMemo(() => {
        return lockedTokens.reduce((total, token) => total.plus(token.usdValue), BigNumber(0));
    }, [lockedTokens]);

    const handleCoinClick = (denom: string) => {
        router.push(`/coin?coin=${encodeURIComponent(denom)}`);
    };

    const onBurnModalClose = useCallback(() => {
        setIsBurnModalOpen(false)
    }, [])

    return (
        <Box minH="100vh" pb="12">
            {/* Add flicker animation */}
            <style jsx global>{`
                @keyframes flicker {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.8; transform: scale(1.1); }
                }

                @keyframes float {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-10px); }
                }
            `}</style>

            <Container py={{ base: '6', md: '10' }}>
                <VStack gap="10" align="stretch">
                    {/* Page Header with playful design */}
                    <Box textAlign="center" position="relative">
                        <Text
                            fontSize={{ base: "4xl", md: "5xl", lg: "6xl" }}
                            fontWeight="black"
                            bgGradient="to-r"
                            gradientFrom="orange.400"
                            gradientVia="red.500"
                            gradientTo="orange.400"
                            bgClip="text"
                            mb="3"
                            letterSpacing="tight"
                            style={{
                                animation: "float 3s ease-in-out infinite"
                            }}
                        >
                            🔥 The Burning Pot 🔥
                        </Text>
                        <Text fontSize={{ base: "md", md: "lg" }} color="fg.muted" fontWeight="semibold" mb="4">
                            Toss your coins into the fire and watch them vanish!
                        </Text>
                        <Button
                            size={{ base: "lg", md: "xl" }}
                            colorPalette="orange"
                            onClick={() => setIsBurnModalOpen(true)}
                            fontWeight="black"
                            fontSize={{ base: "md", md: "lg" }}
                            px="8"
                            py="6"
                            borderRadius="2xl"
                            shadow="xl"
                            _hover={{
                                transform: "scale(1.05)",
                                shadow: "2xl"
                            }}
                            transition="all 0.3s"
                        >
                            🔥 Burn Coins Now!
                        </Button>
                    </Box>

                    {/* Countdown Section with super playful design */}
                    <Card.Root
                        bgGradient="to-br"
                        gradientFrom="yellow.50"
                        gradientVia="orange.100"
                        gradientTo="red.100"
                        _dark={{
                            gradientFrom: "orange.950",
                            gradientVia: "orange.900",
                            gradientTo: "red.950",
                        }}
                        borderRadius="3xl"
                        shadow="2xl"
                    >
                        <Card.Body>
                            <VStack gap="5" align="center" py="6">
                                <VStack gap="1">
                                    <Text fontSize={{ base: "xl", md: "2xl" }} fontWeight="black" color="orange.600" _dark={{ color: "orange.400" }} textTransform="uppercase">
                                        🍲 Next Pot Cooking In 🍲
                                    </Text>
                                    <Text fontSize="sm" color="fg.muted" fontWeight="medium">
                                        Get ready... coins are about to sizzle!
                                    </Text>
                                </VStack>
                                {isLoadingNextBurn ? (
                                    <Text fontSize="md" color="fg.muted">
                                        Loading...
                                    </Text>
                                ) : nextBurn?.date ? (
                                    <CountdownTimer targetDate={nextBurn.date} />
                                ) : (
                                    <Text fontSize="md" color="fg.muted">
                                        No burning scheduled
                                    </Text>
                                )}
                            </VStack>
                        </Card.Body>
                    </Card.Root>

                    {/* Pending Burns Section */}
                    {isLoadingNextBurn ? (
                        <Box textAlign="center" py="8">
                            <Text fontSize="md" color="fg.muted">
                                Loading pending burns...
                            </Text>
                        </Box>
                    ) : pendingBurns.length > 0 ? (
                        <Box>
                            <HStack justify="space-between" align="center" mb="5">
                                <Text fontSize={{ base: "xl", md: "2xl" }} fontWeight="black">
                                    🎯 Ready to Burn
                                </Text>
                                <Badge colorPalette="orange" size="lg" variant="solid" borderRadius="full">
                                    {pendingBurns.length} coins
                                </Badge>
                            </HStack>
                            <Grid
                                templateColumns={{
                                    base: "repeat(2, 1fr)",
                                    md: "repeat(3, 1fr)",
                                    lg: "repeat(4, 1fr)",
                                }}
                                gap="5"
                            >
                                {pendingBurns.map((coin: {denom: string; amount: string}, idx: number) => (
                                    <GridItem key={idx}>
                                        <PendingBurnBox
                                            denom={coin.denom}
                                            amount={coin.amount}
                                            onClick={() => handleCoinClick(coin.denom)}
                                        />
                                    </GridItem>
                                ))}
                            </Grid>
                        </Box>
                    ) : null}

                    {/* Total BZE Burned with subtle design */}
                    <Card.Root
                        bgGradient="to-br"
                        gradientFrom="orange.50"
                        gradientTo="orange.100"
                        _dark={{
                            gradientFrom: "orange.950",
                            gradientTo: "orange.900",
                        }}
                        borderRadius="2xl"
                        shadow="md"
                    >
                        <Card.Body>
                            <VStack gap="2" align="center" py="6">
                                <Text fontSize={{ base: "sm", md: "md" }} fontWeight="semibold" color="orange.600" _dark={{ color: "orange.400" }} textTransform="uppercase">
                                    🔥 Total {nativeAsset?.ticker || 'BZE'} Incinerated
                                </Text>
                                {isLoadingHistory ? (
                                    <Text fontSize="md" color="fg.muted">
                                        Loading...
                                    </Text>
                                ) : (
                                    <VStack gap="1" align="center">
                                        <HighlightText fontSize={{ base: "3xl", md: "4xl", lg: "5xl" }} fontWeight="black" color="orange.500" highlightColor="orange.500" highlightIntensity="evident">
                                            {prettyAmount(totalBzeBurned)}
                                        </HighlightText>
                                        {totalBzeUsdValue.gt(0) && (
                                            <Text fontSize={{ base: "md", md: "lg" }} color="fg.muted" fontWeight="semibold">
                                                ≈ ${prettyAmount(totalBzeUsdValue)}
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

                    {/* Forever Locked Tokens Section */}
                    {lockedTokens.length > 0 && (
                        <Box>
                            <HStack justify="space-between" align="center" mb="5">
                                <Text fontSize={{ base: "xl", md: "2xl" }} fontWeight="black">
                                    🔒 Forever Locked
                                </Text>
                                <Badge colorPalette="orange" size="lg" variant="solid" borderRadius="full">
                                    {lockedTokens.length} {lockedTokens.length === 1 ? 'coin' : 'coins'}
                                </Badge>
                            </HStack>

                            {/* Total locked value card */}
                            {totalLockedUsdValue.gt(0) && (
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
                                    borderWidth="1px"
                                    borderColor="orange.200"
                                    mb="5"
                                >
                                    <Card.Body>
                                        <VStack gap="2" align="center" py="6">
                                            <Text fontSize={{ base: "sm", md: "md" }} fontWeight="semibold" color="orange.600" _dark={{ color: "orange.400" }} textTransform="uppercase">
                                                🔒 Total Value Locked Forever
                                            </Text>
                                            <VStack gap="1" align="center">
                                                <HighlightText fontSize={{ base: "3xl", md: "4xl" }} fontWeight="black" color="orange.500" highlightColor="orange.500" highlightIntensity="evident">
                                                    ${prettyAmount(totalLockedUsdValue)}
                                                </HighlightText>
                                            </VStack>
                                            <Badge colorPalette="orange" variant="subtle" size="md" borderRadius="full">
                                                Never Coming Back
                                            </Badge>
                                        </VStack>
                                    </Card.Body>
                                </Card.Root>
                            )}

                            {/* Locked tokens table */}
                            <Box
                                borderRadius="2xl"
                                overflow="hidden"
                                bg="bg.panel"
                                shadow="lg"
                            >
                                {/* Desktop Table View */}
                                <Box display={{ base: "none", md: "block" }} overflowX="auto">
                                    <Table.Root size="md" variant="outline">
                                        <Table.Header>
                                            <Table.Row bg="orange.100" _dark={{ bg: "orange.900" }}>
                                                <Table.ColumnHeader fontWeight="black">Coin</Table.ColumnHeader>
                                                <Table.ColumnHeader fontWeight="black">Name</Table.ColumnHeader>
                                                <Table.ColumnHeader fontWeight="black">Amount Locked</Table.ColumnHeader>
                                                <Table.ColumnHeader fontWeight="black">USD Value</Table.ColumnHeader>
                                            </Table.Row>
                                        </Table.Header>
                                        <Table.Body>
                                            {lockedTokens.map((token, idx) => {
                                                const asset = getAsset(token.denom);
                                                const isLP = isLpDenom(token.denom);
                                                const formattedAmount = prettyAmount(token.balance);
                                                const formattedUsdValue = prettyAmount(token.usdValue);

                                                return (
                                                    <Table.Row
                                                        key={idx}
                                                        cursor="pointer"
                                                        onClick={() => handleCoinClick(token.denom)}
                                                        _hover={{
                                                            bg: "orange.50",
                                                            _dark: { bg: "orange.950" }
                                                        }}
                                                        transition="all 0.2s"
                                                    >
                                                        <Table.Cell>
                                                            <HStack gap="3">
                                                                <Box
                                                                    p="1"
                                                                    borderRadius="full"
                                                                    width={isLP ? "52px" : "auto"}
                                                                    display="flex"
                                                                    justifyContent="center"
                                                                    alignItems="center"
                                                                >
                                                                    {asset && <AssetLogo asset={asset} size="32px" />}
                                                                </Box>
                                                                <Text fontWeight="bold" fontSize="md">{token.ticker}</Text>
                                                            </HStack>
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                            <Text fontSize="md" color="fg.muted" fontWeight="medium">
                                                                {token.name}
                                                            </Text>
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                            <Text fontWeight="black" fontSize="md" color="orange.500">
                                                                {formattedAmount} {token.ticker}
                                                            </Text>
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                            {token.usdValue.gt(0) && (
                                                                <Text fontSize="md" color="fg.muted" fontWeight="medium">
                                                                    ≈ ${formattedUsdValue}
                                                                </Text>
                                                            )}
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
                                        {lockedTokens.map((token, idx) => {
                                            const asset = getAsset(token.denom);
                                            const isLP = isLpDenom(token.denom);
                                            const formattedAmount = prettyAmount(token.balance);
                                            const formattedUsdValue = prettyAmount(token.usdValue);

                                            return (
                                                <Box
                                                    key={idx}
                                                    p="4"
                                                    cursor="pointer"
                                                    onClick={() => handleCoinClick(token.denom)}
                                                    borderBottomWidth={idx < lockedTokens.length - 1 ? "2px" : "0"}
                                                    borderColor="purple.200"
                                                    _dark={{ borderColor: "purple.800" }}
                                                    _hover={{
                                                        bg: "purple.50",
                                                        _dark: { bg: "purple.950" }
                                                    }}
                                                >
                                                    <HStack justify="space-between" mb="2">
                                                        <HStack gap="3">
                                                            <Box
                                                                p="1"
                                                                borderRadius="full"
                                                                width={isLP ? "56px" : "auto"}
                                                                display="flex"
                                                                justifyContent="center"
                                                                alignItems="center"
                                                            >
                                                                {asset && <AssetLogo asset={asset} size="40px" />}
                                                            </Box>
                                                            <VStack gap="0" align="start">
                                                                <Text fontWeight="bold" fontSize="md">
                                                                    {token.ticker}
                                                                </Text>
                                                                <Text fontSize="sm" color="fg.muted" fontWeight="medium">
                                                                    {token.name}
                                                                </Text>
                                                            </VStack>
                                                        </HStack>
                                                        <VStack gap="0" align="end">
                                                            <Text fontWeight="black" color="purple.500" fontSize="md">
                                                                {formattedAmount}
                                                            </Text>
                                                            {token.usdValue.gt(0) && (
                                                                <Text fontSize="xs" color="fg.muted">
                                                                    ≈ ${formattedUsdValue}
                                                                </Text>
                                                            )}
                                                        </VStack>
                                                    </HStack>
                                                </Box>
                                            );
                                        })}
                                    </VStack>
                                </Box>
                            </Box>
                        </Box>
                    )}

                    <Separator borderColor="orange.200" _dark={{ borderColor: "orange.800" }} />

                    {/* Last 10 Burnings with playful header */}
                    <Box>
                        <HStack justify="space-between" align="center" mb="5">
                            <Text fontSize={{ base: "xl", md: "2xl" }} fontWeight="black">
                                📜 Burn History Book
                            </Text>
                            <Badge colorPalette="red" size="lg" variant="subtle" borderRadius="full">
                                Last {MAX_BURN_HISTORY_ITEMS} Victims
                            </Badge>
                        </HStack>
                        <Box
                            borderRadius="2xl"
                            overflow="hidden"
                            bg="bg.panel"
                            shadow="lg"
                        >
                            {/* Desktop Table View */}
                            <Box display={{ base: "none", md: "block" }} overflowX="auto">
                                <Table.Root size="md" variant="outline">
                                    <Table.Header>
                                        <Table.Row bg="orange.100" _dark={{ bg: "orange.900" }}>
                                            <Table.ColumnHeader fontWeight="black">Coin</Table.ColumnHeader>
                                            <Table.ColumnHeader fontWeight="black">Name</Table.ColumnHeader>
                                            <Table.ColumnHeader fontWeight="black">Amount Burned</Table.ColumnHeader>
                                            <Table.ColumnHeader fontWeight="black">Block Height</Table.ColumnHeader>
                                        </Table.Row>
                                    </Table.Header>
                                    <Table.Body>
                                        {isLoadingHistory ? (
                                            <Table.Row>
                                                <Table.Cell colSpan={4}>
                                                    <Text textAlign="center" py="8" color="fg.muted">
                                                        Loading burn history...
                                                    </Text>
                                                </Table.Cell>
                                            </Table.Row>
                                        ) : lastBurnings.length === 0 ? (
                                            <Table.Row>
                                                <Table.Cell colSpan={4}>
                                                    <VStack gap="3" align="center" py="8">
                                                        <Text fontSize="4xl">🔍</Text>
                                                        <Text fontSize="lg" fontWeight="bold">
                                                            No Burns Yet
                                                        </Text>
                                                        <Text fontSize="sm" color="fg.muted">
                                                            Be the first to burn some coins!
                                                        </Text>
                                                    </VStack>
                                                </Table.Cell>
                                            </Table.Row>
                                        ) : (
                                            lastBurnings.map((burn, idx) => {
                                                const asset = getAsset(burn.denom);
                                                const ticker = asset?.ticker || burn.denom;
                                                const name = asset?.name || burn.denom;
                                                const isLP = isLpDenom(burn.denom);
                                                const formattedAmount = prettyAmount(burn.amount);
                                                const formattedUsdValue = prettyAmount(burn.usdValue);

                                                return (
                                                    <Table.Row
                                                        key={idx}
                                                        cursor="pointer"
                                                        onClick={() => handleCoinClick(burn.denom)}
                                                        _hover={{
                                                            bg: "orange.50",
                                                            _dark: { bg: "orange.950" }
                                                        }}
                                                        transition="all 0.2s"
                                                    >
                                                        <Table.Cell>
                                                            <HStack gap="3">
                                                                <Box
                                                                    p="1"
                                                                    borderRadius="full"
                                                                    width={isLP ? "52px" : "auto"}
                                                                    display="flex"
                                                                    justifyContent="center"
                                                                    alignItems="center"
                                                                >
                                                                    {asset && <AssetLogo asset={asset} size="32px" />}
                                                                </Box>
                                                                <Text fontWeight="bold" fontSize="md">{ticker}</Text>
                                                            </HStack>
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                            <Text fontSize="md" color="fg.muted" fontWeight="medium">
                                                                {name}
                                                            </Text>
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                            <VStack gap="0" align="start">
                                                                <Text fontWeight="black" fontSize="md" color="orange.500">
                                                                    {formattedAmount} {ticker}
                                                                </Text>
                                                                {burn.usdValue.gt(0) && (
                                                                    <Text fontSize="sm" color="fg.muted">
                                                                        ≈ ${formattedUsdValue}
                                                                    </Text>
                                                                )}
                                                            </VStack>
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                            <VStack gap="1" align="start">
                                                                <Badge colorPalette="gray" variant="subtle" size="md" borderRadius="full">
                                                                    #{burn.blockHeight}
                                                                </Badge>
                                                                <Text fontSize="xs" color="fg.muted">
                                                                    {burn.timestamp}
                                                                </Text>
                                                            </VStack>
                                                        </Table.Cell>
                                                    </Table.Row>
                                                );
                                            })
                                        )}
                                    </Table.Body>
                                </Table.Root>
                            </Box>

                            {/* Mobile Card View */}
                            <Box display={{ base: "block", md: "none" }}>
                                {isLoadingHistory ? (
                                    <Box p="8">
                                        <Text textAlign="center" color="fg.muted">
                                            Loading burn history...
                                        </Text>
                                    </Box>
                                ) : lastBurnings.length === 0 ? (
                                    <VStack gap="3" align="center" py="8">
                                        <Text fontSize="4xl">🔍</Text>
                                        <Text fontSize="lg" fontWeight="bold">
                                            No Burns Yet
                                        </Text>
                                        <Text fontSize="sm" color="fg.muted">
                                            Be the first to burn some coins!
                                        </Text>
                                    </VStack>
                                ) : (
                                    <VStack gap="0" align="stretch">
                                        {lastBurnings.map((burn, idx) => {
                                            const asset = getAsset(burn.denom);
                                            const ticker = asset?.ticker || burn.denom;
                                            const name = asset?.name || burn.denom;
                                            const isLP = isLpDenom(burn.denom);
                                            const formattedAmount = prettyAmount(burn.amount);
                                            const formattedUsdValue = prettyAmount(burn.usdValue);

                                            return (
                                                <Box
                                                    key={idx}
                                                    p="4"
                                                    cursor="pointer"
                                                    onClick={() => handleCoinClick(burn.denom)}
                                                    borderBottomWidth={idx < lastBurnings.length - 1 ? "2px" : "0"}
                                                    borderColor="orange.200"
                                                    _dark={{ borderColor: "orange.800" }}
                                                    _hover={{
                                                        bg: "orange.50",
                                                        _dark: { bg: "orange.950" }
                                                    }}
                                                >
                                                    <HStack justify="space-between" mb="2">
                                                        <HStack gap="3">
                                                            <Box
                                                                p="1"
                                                                borderRadius="full"
                                                                width={isLP ? "56px" : "auto"}
                                                                display="flex"
                                                                justifyContent="center"
                                                                alignItems="center"
                                                            >
                                                                {asset && <AssetLogo asset={asset} size="40px"/> }
                                                            </Box>
                                                            <VStack gap="0" align="start">
                                                                <Text fontWeight="bold" fontSize="md">
                                                                    {ticker}
                                                                </Text>
                                                                <Text fontSize="sm" color="fg.muted" fontWeight="medium">
                                                                    {name}
                                                                </Text>
                                                            </VStack>
                                                        </HStack>
                                                        <VStack gap="0" align="end">
                                                            <Text fontWeight="black" color="orange.500" fontSize="md">
                                                                {formattedAmount}
                                                            </Text>
                                                            {burn.usdValue.gt(0) && (
                                                                <Text fontSize="xs" color="fg.muted">
                                                                    ≈ ${formattedUsdValue}
                                                                </Text>
                                                            )}
                                                            <Badge colorPalette="gray" variant="subtle" size="sm" borderRadius="full" mt="1">
                                                                #{burn.blockHeight}
                                                            </Badge>
                                                            <Text fontSize="xs" color="fg.muted" mt="1">
                                                                {burn.timestamp}
                                                            </Text>
                                                        </VStack>
                                                    </HStack>
                                                </Box>
                                            );
                                        })}
                                    </VStack>
                                )}
                            </Box>
                        </Box>
                    </Box>

                    {/* Fun footer message */}
                    <Box textAlign="center" py="4">
                        <Text fontSize="sm" color="fg.muted" fontStyle="italic">
                            Remember: What burns in the pot, stays in the pot! 🔥✨
                        </Text>
                    </Box>
                </VStack>
            </Container>

            {/* Burn Modal */}
            <BurnModal
                isOpen={isBurnModalOpen}
                onClose={onBurnModalClose}
            />
        </Box>
    );
}
