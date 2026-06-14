'use client'

import {useState, useMemo, useCallback} from 'react'
import {
    Box,
    Container,
    Heading,
    Input,
    HStack,
    VStack,
    Text,
    Button,
    Badge,
    NativeSelectRoot,
    NativeSelectField, Spacer,
} from '@chakra-ui/react'
import { LuSearch, LuChevronUp, LuChevronDown, LuUser } from 'react-icons/lu'
import {useAsset, useAssets, toBigNumber, useBalances, calculateUserPoolData, shortNumberFormat, HighlightText, LiquidityPoolData, useLiquidityPools, LPTokenLogo} from "@bze/bze-ui-kit";
import {useNavigation} from "@/hooks/useNavigation";
import {LiquidityPoolSDKType} from "@bze/bzejs/bze/tradebin/store";


type SortField = 'volume24h' | 'totalLiquidity' | 'apr'
type SortOrder = 'asc' | 'desc'

interface LiquidityPoolCardProps {
    pool: LiquidityPoolSDKType;
    isUserPool?: boolean;
    poolData?: LiquidityPoolData;
}

const DesktopLiquidityPoolCard = ({ pool, isUserPool = false, poolData }: LiquidityPoolCardProps) => {
    const {asset: baseAsset} = useAsset(pool.base)
    const {asset: quoteAsset} = useAsset(pool.quote)
    const {asset: lpAsset} = useAsset(pool.lp_denom)
    const {toLpPage} = useNavigation()
    const {getBalanceByDenom} = useBalances()

    const balance = useMemo(() => getBalanceByDenom(pool.lp_denom), [getBalanceByDenom, pool.lp_denom])
    const userPoolData = useMemo(() => calculateUserPoolData(balance, lpAsset, poolData), [balance, lpAsset, poolData])

    const volume24h = useMemo(() => toBigNumber(poolData?.usdVolume || 0), [poolData])
    const totalLiquidity = useMemo(() => toBigNumber(poolData?.usdValue || 0), [poolData])
    const apr = useMemo(() => parseFloat(poolData?.apr || '0'), [poolData])

    return (
        <Box
            key={pool.id}
            as="tr"
            cursor="pointer"
            onClick={() => toLpPage(pool.id)}
            _hover={{ bg: "bg.muted" }}
            transition="all 0.2s"
            borderRadius="lg"
        >
            <Box as="td" p={3}>
                <HStack gap={3}>
                    <LPTokenLogo
                        baseAssetLogo={baseAsset?.logo || ''}
                        quoteAssetLogo={quoteAsset?.logo || ''}
                        baseAssetSymbol={baseAsset?.ticker || ''}
                        quoteAssetSymbol={quoteAsset?.ticker || ''}
                        size="10"
                    />
                    <VStack gap={0} align="start">
                        <Text fontWeight="700" fontSize="md">
                            {baseAsset?.ticker}/{quoteAsset?.ticker}
                        </Text>
                        <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                            {baseAsset?.ticker}-{quoteAsset?.ticker} LP
                        </Text>
                    </VStack>
                </HStack>
            </Box>
            {isUserPool && (
                <Box as="td" p={3}>
                    <Box
                        display="inline-block"
                        bgGradient="to-br"
                        gradientFrom="blue.500/15"
                        gradientTo="blue.600/15"
                        borderWidth="1px"
                        borderColor="blue.500/30"
                        borderRadius="md"
                        px="3"
                        py="1.5"
                    >
                        <HighlightText fontWeight="700" fontSize="sm" color="blue.600">
                            ${shortNumberFormat(userPoolData.userLiquidityUsd)}
                        </HighlightText>
                    </Box>
                </Box>
            )}
            <Box as="td" p={3}>
                <HighlightText fontWeight="600" fontSize="md">
                    ${shortNumberFormat(volume24h)}
                </HighlightText>
            </Box>
            <Box as="td" p={3}>
                <HighlightText fontWeight="600" fontSize="md">
                    ${shortNumberFormat(totalLiquidity)}
                </HighlightText>
            </Box>
            <Box as="td" p={3}>
                <Box
                    display="inline-block"
                    bgGradient="to-br"
                    gradientFrom={apr > 15 ? 'green.500/15' : apr > 10 ? 'yellow.500/15' : 'blue.500/15'}
                    gradientTo={apr > 15 ? 'green.600/15' : apr > 10 ? 'yellow.600/15' : 'blue.600/15'}
                    borderWidth="1px"
                    borderColor={apr > 15 ? 'green.500/30' : apr > 10 ? 'yellow.500/30' : 'blue.500/30'}
                    borderRadius="md"
                    px="3"
                    py="1.5"
                >
                    <Text
                        fontWeight="700"
                        fontSize="sm"
                        color={apr > 15 ? 'green.600' : apr > 10 ? 'yellow.700' : 'blue.600'}
                    >
                        {apr.toFixed(2)}%
                    </Text>
                </Box>
            </Box>
            <Box as="td" p={3}>
                <Button
                    size="sm"
                    variant={isUserPool ? "solid" : "outline"}
                    colorPalette={isUserPool ? "blue" : "gray"}
                    onClick={(e) => {
                        e.stopPropagation()
                        toLpPage(pool.id)
                    }}
                >
                    {isUserPool ? "Manage" : "View"}
                </Button>
            </Box>
        </Box>
    )
}

const MobileLiquidityPoolCard = ({ pool, isUserPool = false, poolData }: LiquidityPoolCardProps) => {
    const {asset: baseAsset} = useAsset(pool.base)
    const {asset: quoteAsset} = useAsset(pool.quote)
    const {asset: lpAsset} = useAsset(pool.lp_denom)
    const {toLpPage} = useNavigation()
    const {getBalanceByDenom} = useBalances()

    const balance = useMemo(() => getBalanceByDenom(pool.lp_denom), [getBalanceByDenom, pool.lp_denom])
    const userPoolData = useMemo(() => calculateUserPoolData(balance, lpAsset, poolData), [balance, lpAsset, poolData])

    const volume24h = useMemo(() => toBigNumber(poolData?.usdVolume || 0), [poolData])
    const totalLiquidity = useMemo(() => toBigNumber(poolData?.usdValue || 0), [poolData])
    const apr = useMemo(() => parseFloat(poolData?.apr || '0'), [poolData])

    return (
        <Box
            bgGradient="to-br"
            gradientFrom={isUserPool ? "blue.500/8" : "blue.500/5"}
            gradientTo={isUserPool ? "blue.600/8" : "blue.600/5"}
            p={4}
            borderRadius="lg"
            borderWidth="1px"
            borderColor={isUserPool ? "blue.500/25" : "blue.500/15"}
            cursor="pointer"
            onClick={() => toLpPage(pool.id)}
            _hover={{
                gradientFrom: isUserPool ? "blue.500/12" : "blue.500/8",
                gradientTo: isUserPool ? "blue.600/12" : "blue.600/8",
                transform: "translateY(-2px)",
                shadow: "md"
            }}
            transition="all 0.2s"
            w="full"
            shadow="sm"
        >
            <VStack gap={3} align="stretch">
                {/* Header */}
                <HStack justify="space-between" align="start">
                    <HStack gap={3} flex="1" minW="0">
                        <LPTokenLogo
                            baseAssetLogo={baseAsset?.logo || ''}
                            quoteAssetLogo={quoteAsset?.logo || ''}
                            baseAssetSymbol={baseAsset?.ticker || ''}
                            quoteAssetSymbol={quoteAsset?.ticker || ''}
                            size="10"
                        />
                        <VStack gap={0.5} align="start" minW="0">
                            <Text fontWeight="700" fontSize="md">
                                {baseAsset?.ticker}/{quoteAsset?.ticker}
                            </Text>
                            <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                                {baseAsset?.ticker}-{quoteAsset?.ticker} LP
                            </Text>
                        </VStack>
                    </HStack>

                    {/* APR Badge */}
                    <Box
                        flexShrink="0"
                        bgGradient="to-br"
                        gradientFrom={apr > 15 ? 'green.500/15' : apr > 10 ? 'yellow.500/15' : 'blue.500/15'}
                        gradientTo={apr > 15 ? 'green.600/15' : apr > 10 ? 'yellow.600/15' : 'blue.600/15'}
                        borderWidth="1px"
                        borderColor={apr > 15 ? 'green.500/30' : apr > 10 ? 'yellow.500/30' : 'blue.500/30'}
                        borderRadius="md"
                        px="3"
                        py="1.5"
                    >
                        <VStack gap="0" align="center">
                            <Text fontSize="xs" color="fg.muted" fontWeight="semibold" textTransform="uppercase">APR</Text>
                            <Text
                                fontWeight="700"
                                fontSize="md"
                                color={apr > 15 ? 'green.600' : apr > 10 ? 'yellow.700' : 'blue.600'}
                                lineHeight="1"
                            >
                                {apr.toFixed(2)}%
                            </Text>
                        </VStack>
                    </Box>
                </HStack>

                {/* User Liquidity */}
                {isUserPool && (
                    <Box
                        bgGradient="to-br"
                        gradientFrom="blue.500/15"
                        gradientTo="blue.600/15"
                        borderWidth="1px"
                        borderColor="blue.500/30"
                        p={3}
                        borderRadius="md"
                    >
                        <HStack justify="space-between">
                            <Text fontSize="xs" color="fg.muted" fontWeight="semibold" textTransform="uppercase">
                                My Liquidity
                            </Text>
                            <HighlightText fontWeight="700" fontSize="md" color="blue.600">
                                ${shortNumberFormat(userPoolData.userLiquidityUsd)}
                            </HighlightText>
                        </HStack>
                    </Box>
                )}

                {/* Metrics */}
                <HStack gap={2}>
                    <Box
                        flex="1"
                        bgGradient="to-br"
                        gradientFrom="blue.500/5"
                        gradientTo="cyan.500/5"
                        p={2.5}
                        borderRadius="md"
                        borderWidth="1px"
                        borderColor="blue.500/15"
                    >
                        <VStack gap={0.5} align="start">
                            <Text fontSize="xs" color="fg.muted" fontWeight="semibold" textTransform="uppercase">
                                24h Volume
                            </Text>
                            <HighlightText fontWeight="700" fontSize="sm">
                                ${shortNumberFormat(volume24h)}
                            </HighlightText>
                        </VStack>
                    </Box>
                    <Box
                        flex="1"
                        bgGradient="to-br"
                        gradientFrom="blue.500/5"
                        gradientTo="cyan.500/5"
                        p={2.5}
                        borderRadius="md"
                        borderWidth="1px"
                        borderColor="blue.500/15"
                    >
                        <VStack gap={0.5} align="start">
                            <Text fontSize="xs" color="fg.muted" fontWeight="semibold" textTransform="uppercase">
                                Total Liquidity
                            </Text>
                            <HighlightText fontWeight="700" fontSize="sm">
                                ${shortNumberFormat(totalLiquidity)}
                            </HighlightText>
                        </VStack>
                    </Box>
                </HStack>

                {/* Action Button */}
                <Button
                    size="sm"
                    variant={isUserPool ? "solid" : "outline"}
                    colorPalette={isUserPool ? "blue" : "gray"}
                    w="full"
                    onClick={(e) => {
                        e.stopPropagation()
                        toLpPage(pool.id)
                    }}
                >
                    {isUserPool ? "Manage Pool" : "View Pool"}
                </Button>
            </VStack>
        </Box>
    )
}

export default function LiquidityPoolsPage() {
    const [searchTerm, setSearchTerm] = useState('')
    const [sortField, setSortField] = useState<SortField>('totalLiquidity')
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

    const {pools, poolsData} = useLiquidityPools()
    const {denomTicker} = useAssets()
    const {getBalanceByDenom} = useBalances()

    const sortOptions = [
        { value: 'totalLiquidity-desc', label: 'Total Liquidity (High to Low)' },
        { value: 'totalLiquidity-asc', label: 'Total Liquidity (Low to High)' },
        { value: 'volume24h-desc', label: '24h Volume (High to Low)' },
        { value: 'volume24h-asc', label: '24h Volume (Low to High)' },
        { value: 'apr-desc', label: 'APR (High to Low)' },
        { value: 'apr-asc', label: 'APR (Low to High)' }
    ]

    const allPoolsCount = useMemo(() => pools.length, [pools])

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortOrder('desc')
        }
    }

    const handleMobileSort = (value: string) => {
        const [field, order] = value.split('-') as [SortField, SortOrder]
        setSortField(field)
        setSortOrder(order)
    }

    const sortedPools = useMemo(() => {
        return pools.sort((poolA, poolB) => {
            const poolAData = poolsData.get(poolA.id)
            const poolBData = poolsData.get(poolB.id)
            if (!poolAData && !poolBData) return 0;
            if (!poolAData) return 1;
            if (!poolBData) return -1;

            let valueA = poolAData.usdVolume
            let valueB = poolBData.usdVolume
            if (sortField === 'totalLiquidity') {
                valueA = poolAData.usdValue
                valueB = poolBData.usdValue
            } else if (sortField === 'apr') {
                valueA = toBigNumber(poolAData.apr)
                valueB = toBigNumber(poolBData.apr)
            }

            if (sortOrder === 'asc') {
                return valueA.minus(valueB).toNumber()
            }

            return valueB.minus(valueA).toNumber()
        })
    }, [sortField, sortOrder, pools, poolsData])

    const filteredAndSortedPools = useMemo(() => {
        const filtered = sortedPools.filter(pool => {
            const searchLower = searchTerm.toLowerCase()
            const baseTicker = denomTicker(pool.base).toLowerCase()
            const quoteTicker = denomTicker(pool.quote).toLowerCase()

            return (
                baseTicker.includes(searchLower) ||
                quoteTicker.includes(searchLower) ||
                `${baseTicker}-${quoteTicker}`.toLowerCase().includes(searchLower)
            )
        })

        // Separate user pools and other pools based on LP token balance
        const userPools = filtered.filter(pool => {
            const balance = getBalanceByDenom(pool.lp_denom)
            return balance && balance.amount.gt(0)
        })

        const otherPools = filtered.filter(pool => {
            const balance = getBalanceByDenom(pool.lp_denom)
            return !balance || balance.amount.isZero()
        })

        return { otherPools, userPools }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm, sortedPools, getBalanceByDenom])

    const SortIcon = useCallback(({ field }: { field: SortField }) => {
        if (sortField !== field) return null
        return sortOrder === 'asc' ? <LuChevronUp /> : <LuChevronDown />
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <Box minH="100vh" bg="bg.subtle">
            <Container maxW="7xl" py={12}>
                <VStack align="stretch" gap="8">
                    {/* Page Header */}
                    <VStack gap={3} align="center" mb={4}>
                        <Text fontSize="3xl" fontWeight="bold" letterSpacing="tight">
                            Liquidity Pools
                        </Text>
                        <Text fontSize="md" color="fg.muted">
                            Provide liquidity to earn fees and rewards
                        </Text>
                    </VStack>

                    {/* Search and Filter Section */}
                    <Box
                        p={6}
                        bgGradient="to-br"
                        gradientFrom="blue.500/8"
                        gradientTo="blue.600/8"
                        borderRadius="xl"
                        borderWidth="1px"
                        borderColor="blue.500/20"
                        shadow="sm"
                    >
                        <VStack gap={4} w="full">
                            <HStack gap={4} wrap="wrap" flex={1} w="full">
                                <Box position="relative" flex="1" minW="300px" maxW="500px">
                                    <Input
                                        placeholder="Search pools by token symbol..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        size="lg"
                                        pl="12"
                                        borderRadius="lg"
                                    />
                                    <Box position="absolute" left="4" top="50%" transform="translateY(-50%)" color="fg.muted">
                                        <LuSearch size={20} />
                                    </Box>
                                </Box>
                                <Spacer />
                                <Badge
                                    variant="outline"
                                    colorPalette="gray"
                                    fontSize="md"
                                    px={4}
                                    py={2}
                                    borderRadius="lg"
                                >
                                    {allPoolsCount} liquidity pools
                                </Badge>
                            </HStack>

                            {/* Mobile Sort Select */}
                            <Box display={{ base: 'block', md: 'none' }} w="full" maxW="500px">
                                <NativeSelectRoot w="full">
                                    <NativeSelectField
                                        value={`${sortField}-${sortOrder}`}
                                        onChange={(e) => handleMobileSort(e.target.value)}
                                        p={3}
                                        borderRadius="lg"
                                        borderWidth="1px"
                                        borderColor="blue.500/15"
                                        bgGradient="to-br"
                                        gradientFrom="blue.500/5"
                                        gradientTo="blue.600/5"
                                        fontSize="sm"
                                    >
                                        {sortOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </NativeSelectField>
                                </NativeSelectRoot>
                            </Box>
                        </VStack>
                    </Box>

                    <VStack gap={6} w="full">

                        {/* Desktop Table View */}
                        <Box overflowX="auto" w="full" display={{ base: 'none', md: 'block' }}>
                            {/* User Pools Section */}
                            {filteredAndSortedPools.userPools.length > 0 && (
                                <VStack gap={3} mb={6} align="stretch">
                                    <HStack gap={2} px={2}>
                                        <LuUser size={20} color="var(--chakra-colors-blue-600)" />
                                        <Heading size="lg" color="blue.600" _dark={{ color: "blue.300" }}>
                                            My Pools
                                        </Heading>
                                        <Badge colorPalette="blue" size="sm" ml={1}>
                                            {filteredAndSortedPools.userPools.length}
                                        </Badge>
                                    </HStack>
                                    <Box
                                        as="table"
                                        w="full"
                                        borderCollapse="separate"
                                        borderSpacing="0 4px"
                                        bgGradient="to-br"
                                        gradientFrom="blue.500/5"
                                        gradientTo="blue.600/5"
                                        borderRadius="lg"
                                        p={2}
                                        borderWidth="1px"
                                        borderColor="blue.500/15"
                                    >
                                        <Box as="thead">
                                            <Box as="tr">
                                                <Box as="th" textAlign="left" p={3} fontSize="xs" fontWeight="700" color="fg.muted" textTransform="uppercase">
                                                    Pool
                                                </Box>
                                                <Box as="th" textAlign="left" p={3} fontSize="xs" fontWeight="700" color="fg.muted" textTransform="uppercase">
                                                    My Liquidity
                                                </Box>
                                                <Box as="th" textAlign="left" p={3} fontSize="xs" fontWeight="700" color="fg.muted" textTransform="uppercase">
                                                    24h Volume
                                                </Box>
                                                <Box as="th" textAlign="left" p={3} fontSize="xs" fontWeight="700" color="fg.muted" textTransform="uppercase">
                                                    Total Liquidity
                                                </Box>
                                                <Box as="th" textAlign="left" p={3} fontSize="xs" fontWeight="700" color="fg.muted" textTransform="uppercase">
                                                    APR
                                                </Box>
                                                <Box as="th" textAlign="left" p={3} fontSize="xs" fontWeight="700" color="fg.muted" textTransform="uppercase">
                                                    Action
                                                </Box>
                                            </Box>
                                        </Box>
                                        <Box as="tbody">
                                            {filteredAndSortedPools.userPools.map((pool) => (
                                                <DesktopLiquidityPoolCard
                                                    pool={pool}
                                                    isUserPool={true}
                                                    key={pool.id}
                                                    poolData={poolsData.get(pool.id)}
                                                />
                                            ))}
                                        </Box>
                                    </Box>
                                </VStack>
                            )}

                            {/* All Pools Section */}
                            {filteredAndSortedPools.otherPools.length > 0 && (
                                <VStack gap={3} align="stretch">
                                    <HStack gap={2} px={2}>
                                        <Heading size="lg">
                                            All Pools
                                        </Heading>
                                        <Badge colorPalette="gray" size="sm" ml={1}>
                                            {filteredAndSortedPools.otherPools.length}
                                        </Badge>
                                    </HStack>
                                    <Box
                                        as="table"
                                        w="full"
                                        borderCollapse="separate"
                                        borderSpacing="0 4px"
                                        bgGradient="to-br"
                                        gradientFrom="blue.500/5"
                                        gradientTo="blue.600/5"
                                        borderRadius="lg"
                                        p={2}
                                        borderWidth="1px"
                                        borderColor="blue.500/15"
                                    >
                                        <Box as="thead">
                                            <Box as="tr">
                                                <Box as="th" textAlign="left" p={3} fontSize="xs" fontWeight="700" color="fg.muted" textTransform="uppercase">
                                                    Pool
                                                </Box>
                                                <Box
                                                    as="th"
                                                    textAlign="left"
                                                    p={3}
                                                    fontSize="xs"
                                                    fontWeight="700"
                                                    color="fg.muted"
                                                    textTransform="uppercase"
                                                    cursor="pointer"
                                                    onClick={() => handleSort('volume24h')}
                                                    _hover={{ bg: "bg.muted" }}
                                                    borderRadius="md"
                                                    transition="all 0.2s"
                                                >
                                                    <HStack gap={1}>
                                                        <Text>24h Volume</Text>
                                                        <SortIcon field="volume24h" />
                                                    </HStack>
                                                </Box>
                                                <Box
                                                    as="th"
                                                    textAlign="left"
                                                    p={3}
                                                    fontSize="xs"
                                                    fontWeight="700"
                                                    color="fg.muted"
                                                    textTransform="uppercase"
                                                    cursor="pointer"
                                                    onClick={() => handleSort('totalLiquidity')}
                                                    _hover={{ bg: "bg.muted" }}
                                                    borderRadius="md"
                                                    transition="all 0.2s"
                                                >
                                                    <HStack gap={1}>
                                                        <Text>Total Liquidity</Text>
                                                        <SortIcon field="totalLiquidity" />
                                                    </HStack>
                                                </Box>
                                                <Box
                                                    as="th"
                                                    textAlign="left"
                                                    p={3}
                                                    fontSize="xs"
                                                    fontWeight="700"
                                                    color="fg.muted"
                                                    textTransform="uppercase"
                                                    cursor="pointer"
                                                    onClick={() => handleSort('apr')}
                                                    _hover={{ bg: "bg.muted" }}
                                                    borderRadius="md"
                                                    transition="all 0.2s"
                                                >
                                                    <HStack gap={1}>
                                                        <Text>APR</Text>
                                                        <SortIcon field="apr" />
                                                    </HStack>
                                                </Box>
                                                <Box as="th" textAlign="left" p={3} fontSize="xs" fontWeight="700" color="fg.muted" textTransform="uppercase">
                                                    Action
                                                </Box>
                                            </Box>
                                        </Box>
                                        <Box as="tbody">
                                            {filteredAndSortedPools.otherPools.map((pool) => (
                                                <DesktopLiquidityPoolCard
                                                    key={pool.id}
                                                    pool={pool}
                                                    isUserPool={false}
                                                    poolData={poolsData.get(pool.id)}
                                                />
                                            ))}
                                        </Box>
                                    </Box>
                                </VStack>
                            )}
                        </Box>

                        {/* Mobile Card View */}
                        <Box w="full" display={{ base: 'block', md: 'none' }}>
                            {/* User Pools Section - Mobile */}
                            {filteredAndSortedPools.userPools.length > 0 && (
                                <VStack gap={3} mb={6} align="stretch">
                                    <HStack gap={2}>
                                        <LuUser size={20} color="var(--chakra-colors-blue-600)" />
                                        <Heading size="md" color="blue.600" _dark={{ color: "blue.300" }}>
                                            My Pools
                                        </Heading>
                                        <Badge colorPalette="blue" size="sm" ml={1}>
                                            {filteredAndSortedPools.userPools.length}
                                        </Badge>
                                    </HStack>
                                    <VStack gap={3} w="full">
                                        {filteredAndSortedPools.userPools.map((pool) => (
                                            <MobileLiquidityPoolCard
                                                key={pool.id}
                                                pool={pool}
                                                isUserPool={true}
                                                poolData={poolsData.get(pool.id)}
                                            />
                                        ))}
                                    </VStack>
                                </VStack>
                            )}

                            {/* All Pools Section - Mobile */}
                            {filteredAndSortedPools.otherPools.length > 0 && (
                                <VStack gap={3} align="stretch">
                                    <HStack gap={2}>
                                        <Heading size="md">
                                            All Pools
                                        </Heading>
                                        <Badge colorPalette="gray" size="sm" ml={1}>
                                            {filteredAndSortedPools.otherPools.length}
                                        </Badge>
                                    </HStack>
                                    <VStack gap={3} w="full">
                                        {filteredAndSortedPools.otherPools.map((pool) => (
                                            <MobileLiquidityPoolCard
                                                key={pool.id}
                                                pool={pool}
                                                isUserPool={false}
                                                poolData={poolsData.get(pool.id)}
                                            />
                                        ))}
                                    </VStack>
                                </VStack>
                            )}
                        </Box>

                        {(filteredAndSortedPools.userPools.length === 0 && filteredAndSortedPools.otherPools.length === 0 && sortedPools.length > 0) && (
                            <Box
                                bg="bg.panel"
                                p={12}
                                borderRadius="lg"
                                borderWidth="1px"
                                borderColor="border"
                                textAlign="center"
                                w="full"
                            >
                                <VStack gap={4}>
                                    <Text fontSize="lg" fontWeight="600" color="fg.muted">
                                        No pools found
                                    </Text>
                                    <Text fontSize="sm" color="fg.muted">
                                        Try adjusting your search criteria
                                    </Text>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setSearchTerm('')}
                                    >
                                        Clear Search
                                    </Button>
                                </VStack>
                            </Box>
                        )}
                        {sortedPools.length === 0 && (
                            <Box
                                bg="bg.panel"
                                p={12}
                                borderRadius="lg"
                                borderWidth="1px"
                                borderColor="border"
                                textAlign="center"
                                w="full"
                            >
                                <VStack gap={4}>
                                    <Text fontSize="lg" fontWeight="600" color="fg.muted">
                                        No pools created yet
                                    </Text>
                                </VStack>
                            </Box>
                        )}
                    </VStack>

                    {/* Footer Info */}
                    {(filteredAndSortedPools.userPools.length > 0 || filteredAndSortedPools.otherPools.length > 0) && (
                        <Box textAlign="center" py={2}>
                            <HStack justify="center" gap={2} flexWrap="wrap">
                                <Text fontSize="sm" color="fg.muted">
                                    Showing {filteredAndSortedPools.userPools.length + filteredAndSortedPools.otherPools.length} of {pools.length} pools
                                </Text>
                                {filteredAndSortedPools.userPools.length > 0 && (
                                    <>
                                        <Text fontSize="sm" color="fg.muted">•</Text>
                                        <Badge colorPalette="blue" size="sm">
                                            {filteredAndSortedPools.userPools.length} My Pools
                                        </Badge>
                                    </>
                                )}
                            </HStack>
                        </Box>
                    )}
                </VStack>
            </Container>
        </Box>
    )
}