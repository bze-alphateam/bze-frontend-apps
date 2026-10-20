'use client'

import {useState, useMemo, type ReactNode} from 'react'
import {
    Box,
    Button,
    chakra,
    Flex,
    Grid,
    Input,
    InputGroup,
    NativeSelectRoot,
    NativeSelectField,
    NativeSelectIndicator,
} from '@chakra-ui/react'
import {LuSearch, LuChevronUp, LuChevronDown, LuArrowUpDown, LuUser} from 'react-icons/lu'
import {
    useAsset, useAssets, toBigNumber, useBalances, calculateUserPoolData, shortNumberFormat, HighlightText,
    LiquidityPoolData, useLiquidityPools, LPTokenLogo, HaltedBadge, hgVariant,
    PageContainer, HgCard, FeaturedCard,
} from "@bze/bze-ui-kit";
import {useNavigation} from "@/hooks/useNavigation";
import {LiquidityPoolSDKType} from "@bze/bzejs/bze/tradebin/store";
import {sortPools, filterPoolsBySearch, partitionUserPools} from "@/lib/pool-list";
import {InnerHero, CountPill} from "@/components/ui/layout/inner-hero";
import {AprChip} from "@/components/ui/pools/apr-chip";
import {VenueTag} from "@/components/ui/trading/venue";


type SortField = 'volume24h' | 'totalLiquidity' | 'apr'
type SortOrder = 'asc' | 'desc'

interface LiquidityPoolCardProps {
    pool: LiquidityPoolSDKType;
    isUserPool?: boolean;
    poolData?: LiquidityPoolData;
}

/** The figures both pool views show, from the pool's data and the wallet's LP balance. */
const usePoolFigures = (pool: LiquidityPoolSDKType, poolData?: LiquidityPoolData) => {
    const {asset: baseAsset} = useAsset(pool.base)
    const {asset: quoteAsset} = useAsset(pool.quote)
    const {asset: lpAsset} = useAsset(pool.lp_denom)
    const {getBalanceByDenom} = useBalances()

    const balance = useMemo(() => getBalanceByDenom(pool.lp_denom), [getBalanceByDenom, pool.lp_denom])
    const userPoolData = useMemo(() => calculateUserPoolData(balance, lpAsset, poolData), [balance, lpAsset, poolData])

    return {
        baseAsset,
        quoteAsset,
        isHalted: !!baseAsset?.halted || !!quoteAsset?.halted,
        userPoolData,
        volume24h: toBigNumber(poolData?.usdVolume || 0),
        totalLiquidity: toBigNumber(poolData?.usdValue || 0),
        apr: parseFloat(poolData?.apr || '0'),
    }
}

const PoolName = ({baseTicker, quoteTicker, baseLogo, quoteLogo, isHalted}: {
    baseTicker?: string;
    quoteTicker?: string;
    baseLogo?: string;
    quoteLogo?: string;
    isHalted: boolean;
}) => (
    <Flex align="center" gap="12px" minW="0">
        <LPTokenLogo
            baseAssetLogo={baseLogo || ''}
            quoteAssetLogo={quoteLogo || ''}
            baseAssetSymbol={baseTicker || ''}
            quoteAssetSymbol={quoteTicker || ''}
            size="8"
        />
        <Flex direction="column" gap="2px" minW="0">
            <Flex align="center" gap="8px" wrap="wrap">
                <chakra.strong fontSize="15px" fontWeight="700">{baseTicker}/{quoteTicker}</chakra.strong>
                {isHalted && <HaltedBadge/>}
            </Flex>
            <chakra.span fontSize="12px" color="hg.text.faint">{baseTicker}-{quoteTicker} LP</chakra.span>
        </Flex>
    </Flex>
)

/** The connected user's share of a pool: plain text in the DEX link colour, no chip around it. */
const MyLiquidity = ({children}: { children: ReactNode }) => (
    <HighlightText as="span" data-testid="my-liquidity" fontSize="14px" fontWeight="600" color="hg.link">
        {children}
    </HighlightText>
)

const DesktopLiquidityPoolCard = ({ pool, isUserPool = false, poolData }: LiquidityPoolCardProps) => {
    const {toLpPage} = useNavigation()
    const {baseAsset, quoteAsset, isHalted, userPoolData, volume24h, totalLiquidity, apr} = usePoolFigures(pool, poolData)

    return (
        <chakra.tr
            cursor="pointer"
            onClick={() => toLpPage(pool.id)}
            borderTopWidth="1px"
            borderColor="hg.divider"
            transitionProperty="background"
            transitionDuration="moderate"
            _hover={{ bg: "hg.hoverFill" }}
        >
            <Td first>
                <PoolName
                    baseTicker={baseAsset?.ticker}
                    quoteTicker={quoteAsset?.ticker}
                    baseLogo={baseAsset?.logo}
                    quoteLogo={quoteAsset?.logo}
                    isHalted={isHalted}
                />
            </Td>
            {isUserPool && (
                <Td>
                    <MyLiquidity>${shortNumberFormat(userPoolData.userLiquidityUsd)}</MyLiquidity>
                </Td>
            )}
            <Td>
                <HighlightText fontWeight="600" fontSize="14px">${shortNumberFormat(volume24h)}</HighlightText>
            </Td>
            <Td>
                <HighlightText fontWeight="600" fontSize="14px">${shortNumberFormat(totalLiquidity)}</HighlightText>
            </Td>
            <Td>
                <AprChip apr={apr}/>
            </Td>
            <Td last>
                <Button
                    size="md"
                    variant={hgVariant(isUserPool ? 'primary' : 'secondary')}
                    borderRadius="10px"
                    px="16px"
                    onClick={(e) => {
                        e.stopPropagation()
                        toLpPage(pool.id)
                    }}
                >
                    {isUserPool ? "Manage" : "View"}
                </Button>
            </Td>
        </chakra.tr>
    )
}

const Td = ({first, last, children}: { first?: boolean; last?: boolean; children: ReactNode }) => (
    <chakra.td
        py="14px"
        pl={first ? '20px' : '12px'}
        pr={last ? '20px' : '12px'}
        textAlign={last ? 'right' : 'left'}
        verticalAlign="middle"
    >
        {children}
    </chakra.td>
)

const Th = ({first, last, sort, children}: { first?: boolean; last?: boolean; sort?: 'ascending' | 'descending' | 'none'; children: ReactNode }) => (
    <chakra.th
        py={sort ? '8px' : '14px'}
        pl={first ? '20px' : sort ? '6px' : '12px'}
        pr={last ? '20px' : sort ? '6px' : '12px'}
        textAlign={last ? 'right' : 'left'}
        fontSize="11px"
        fontWeight="700"
        letterSpacing="0.08em"
        textTransform="uppercase"
        color="hg.text.faint"
        aria-sort={sort}
    >
        {children}
    </chakra.th>
)

/** A sortable column header: the active column takes the DEX tint and its direction chevron. */
const SortButton = ({active, order, onClick, children}: { active: boolean; order: SortOrder; onClick: () => void; children: ReactNode }) => (
    <chakra.button
        type="button"
        onClick={onClick}
        display="inline-flex"
        alignItems="center"
        gap="4px"
        h="32px"
        px={active ? '8px' : '6px'}
        border="0"
        borderRadius="8px"
        bg={active ? 'app.subtle' : 'transparent'}
        color={active ? 'hg.link' : 'hg.text.faint'}
        fontSize="11px"
        fontWeight="700"
        letterSpacing="0.08em"
        textTransform="uppercase"
        cursor="pointer"
        focusVisibleRing="outside"
        _hover={active ? undefined : {color: 'fg'}}
    >
        {children}
        {active
            ? (order === 'asc' ? <LuChevronUp size={12} aria-hidden="true"/> : <LuChevronDown size={12} aria-hidden="true"/>)
            : <LuArrowUpDown size={11} aria-hidden="true"/>}
    </chakra.button>
)

const MobileLiquidityPoolCard = ({ pool, isUserPool = false, poolData }: LiquidityPoolCardProps) => {
    const {toLpPage} = useNavigation()
    const {baseAsset, quoteAsset, isHalted, userPoolData, volume24h, totalLiquidity, apr} = usePoolFigures(pool, poolData)

    const content = (
        <Flex direction="column" gap="12px">
            <Flex justify="space-between" align="flex-start" gap="12px">
                <PoolName
                    baseTicker={baseAsset?.ticker}
                    quoteTicker={quoteAsset?.ticker}
                    baseLogo={baseAsset?.logo}
                    quoteLogo={quoteAsset?.logo}
                    isHalted={isHalted}
                />
                <AprChip apr={apr} size="lg"/>
            </Flex>

            {isUserPool && (
                <Flex justify="space-between" align="center" px="12px" py="10px" borderRadius="12px" bg="app.subtle" borderWidth="1px" borderColor="app.border">
                    <chakra.span fontSize="11px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase" color="hg.text.faint">
                        My Liquidity
                    </chakra.span>
                    <HighlightText fontWeight="700" fontSize="15px" color="hg.link">
                        ${shortNumberFormat(userPoolData.userLiquidityUsd)}
                    </HighlightText>
                </Flex>
            )}

            <Grid templateColumns="1fr 1fr" gap="10px">
                <MobileFigure label="24h Volume">${shortNumberFormat(volume24h)}</MobileFigure>
                <MobileFigure label="Total Liquidity">${shortNumberFormat(totalLiquidity)}</MobileFigure>
            </Grid>

            <Button
                size="lg"
                w="full"
                variant={hgVariant(isUserPool ? 'primary' : 'secondary')}
                onClick={(e) => {
                    e.stopPropagation()
                    toLpPage(pool.id)
                }}
            >
                {isUserPool ? "Manage Pool" : "View Pool"}
            </Button>
        </Flex>
    )

    return (
        <Box w="full" cursor="pointer" onClick={() => toLpPage(pool.id)}>
            {isUserPool
                ? <FeaturedCard p="16px">{content}</FeaturedCard>
                : <HgCard interactive p="16px">{content}</HgCard>}
        </Box>
    )
}

const MobileFigure = ({label, children}: { label: string; children: ReactNode }) => (
    <Flex direction="column" gap="4px" bg="hg.inset" borderRadius="12px" px="12px" py="10px">
        <chakra.span fontSize="11px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase" color="hg.text.faint">{label}</chakra.span>
        <HighlightText fontWeight="700" fontSize="14px">{children}</HighlightText>
    </Flex>
)

const SectionTitle = ({mine, count}: { mine?: boolean; count: number }) => (
    <chakra.h2 m="0" fontSize="19px" fontWeight="700" display="flex" alignItems="center" gap="10px">
        {mine && <Box as="span" color="hg.accent"><LuUser size={18} aria-hidden="true"/></Box>}
        {mine ? 'My Pools' : 'All Pools'}
        <chakra.span
            fontSize="12px"
            fontWeight="700"
            px="8px"
            py="2px"
            borderRadius="full"
            {...(mine
                ? {bgImage: 'app', color: 'hg.buttonText'}
                : {bg: 'hg.secondaryFill', color: 'hg.text.secondary'})}
        >
            {count}
        </chakra.span>
    </chakra.h2>
)

const StateCard = ({title, children}: { title: string; children?: ReactNode }) => (
    <HgCard textAlign="center" py="48px" w="full">
        <Flex direction="column" align="center" gap="6px">
            <chakra.strong fontSize="16px">{title}</chakra.strong>
            {children}
        </Flex>
    </HgCard>
)

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

    const sortedPools = useMemo(
        () => sortPools(pools, poolsData, sortField, sortOrder),
        [sortField, sortOrder, pools, poolsData],
    )

    const filteredAndSortedPools = useMemo(() => {
        const filtered = filterPoolsBySearch(sortedPools, denomTicker, searchTerm)

        // Separate user pools and other pools based on LP token balance.
        return partitionUserPools(filtered, getBalanceByDenom)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm, sortedPools, getBalanceByDenom])

    const ariaSort = (field: SortField) =>
        sortField === field ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'

    return (
        <Box minH="100vh">
            <InnerHero
                section="Pools"
                title="Liquidity Pools"
                tag={<VenueTag venue="amm"/>}
                subtitle="Provide liquidity to earn fees and rewards"
                aside="The pools Swap trades against"
            />

            <PageContainer pt="32px" pb="80px">
                <Flex direction="column" gap="24px">
                    {/* Search and Filter Section */}
                    <Flex direction="column" gap="12px">
                        <Flex justify="space-between" align="center" gap="16px" wrap="wrap">
                            <InputGroup startElement={<LuSearch size={16}/>} w="420px" maxW="100%">
                                <Input
                                    aria-label="Search pools"
                                    placeholder="Search pools by token symbol..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    h="44px"
                                    borderRadius="12px"
                                    bg="hg.inset"
                                    borderColor="hg.hairline"
                                    fontSize="15px"
                                />
                            </InputGroup>
                            <CountPill>{allPoolsCount} liquidity pools</CountPill>
                        </Flex>

                        {/* Mobile Sort Select */}
                        <Box hideFrom="md" w="full">
                            <NativeSelectRoot w="full">
                                <NativeSelectField
                                    aria-label="Sort pools"
                                    value={`${sortField}-${sortOrder}`}
                                    onChange={(e) => handleMobileSort(e.target.value)}
                                    h="44px"
                                    borderRadius="12px"
                                    bg="hg.inset"
                                    borderColor="hg.hairline"
                                    fontSize="14px"
                                >
                                    {sortOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </NativeSelectField>
                                <NativeSelectIndicator/>
                            </NativeSelectRoot>
                        </Box>
                    </Flex>

                    {/* Desktop Table View */}
                    <Flex direction="column" gap="24px" hideBelow="md">
                        {filteredAndSortedPools.userPools.length > 0 && (
                            <chakra.section display="flex" flexDirection="column" gap="12px" aria-label="My Pools">
                                <SectionTitle mine count={filteredAndSortedPools.userPools.length}/>
                                <FeaturedCard p="0" overflowX="auto">
                                    <chakra.table w="100%" minW="860px" borderCollapse="collapse" fontSize="14px">
                                        <thead>
                                            <tr>
                                                <Th first>Pool</Th>
                                                <Th>My Liquidity</Th>
                                                <Th>24h Volume</Th>
                                                <Th>Total Liquidity</Th>
                                                <Th>APR</Th>
                                                <Th last>Action</Th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredAndSortedPools.userPools.map((pool) => (
                                                <DesktopLiquidityPoolCard
                                                    pool={pool}
                                                    isUserPool={true}
                                                    key={pool.id}
                                                    poolData={poolsData.get(pool.id)}
                                                />
                                            ))}
                                        </tbody>
                                    </chakra.table>
                                </FeaturedCard>
                            </chakra.section>
                        )}

                        {filteredAndSortedPools.otherPools.length > 0 && (
                            <chakra.section display="flex" flexDirection="column" gap="12px" aria-label="All Pools">
                                <SectionTitle count={filteredAndSortedPools.otherPools.length}/>
                                <HgCard p="0" overflowX="auto" borderRadius="20px">
                                    <chakra.table w="100%" minW="760px" borderCollapse="collapse" fontSize="14px">
                                        <thead>
                                            <tr>
                                                <Th first>Pool</Th>
                                                <Th sort={ariaSort('volume24h')}>
                                                    <SortButton active={sortField === 'volume24h'} order={sortOrder} onClick={() => handleSort('volume24h')}>24h Volume</SortButton>
                                                </Th>
                                                <Th sort={ariaSort('totalLiquidity')}>
                                                    <SortButton active={sortField === 'totalLiquidity'} order={sortOrder} onClick={() => handleSort('totalLiquidity')}>Total Liquidity</SortButton>
                                                </Th>
                                                <Th sort={ariaSort('apr')}>
                                                    <SortButton active={sortField === 'apr'} order={sortOrder} onClick={() => handleSort('apr')}>APR</SortButton>
                                                </Th>
                                                <Th last>Action</Th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredAndSortedPools.otherPools.map((pool) => (
                                                <DesktopLiquidityPoolCard
                                                    key={pool.id}
                                                    pool={pool}
                                                    isUserPool={false}
                                                    poolData={poolsData.get(pool.id)}
                                                />
                                            ))}
                                        </tbody>
                                    </chakra.table>
                                </HgCard>
                            </chakra.section>
                        )}
                    </Flex>

                    {/* Mobile Card View */}
                    <Flex direction="column" gap="24px" hideFrom="md">
                        {filteredAndSortedPools.userPools.length > 0 && (
                            <chakra.section display="flex" flexDirection="column" gap="12px" aria-label="My Pools">
                                <SectionTitle mine count={filteredAndSortedPools.userPools.length}/>
                                {filteredAndSortedPools.userPools.map((pool) => (
                                    <MobileLiquidityPoolCard
                                        key={pool.id}
                                        pool={pool}
                                        isUserPool={true}
                                        poolData={poolsData.get(pool.id)}
                                    />
                                ))}
                            </chakra.section>
                        )}

                        {filteredAndSortedPools.otherPools.length > 0 && (
                            <chakra.section display="flex" flexDirection="column" gap="12px" aria-label="All Pools">
                                <SectionTitle count={filteredAndSortedPools.otherPools.length}/>
                                {filteredAndSortedPools.otherPools.map((pool) => (
                                    <MobileLiquidityPoolCard
                                        key={pool.id}
                                        pool={pool}
                                        isUserPool={false}
                                        poolData={poolsData.get(pool.id)}
                                    />
                                ))}
                            </chakra.section>
                        )}
                    </Flex>

                    {(filteredAndSortedPools.userPools.length === 0 && filteredAndSortedPools.otherPools.length === 0 && sortedPools.length > 0) && (
                        <StateCard title="No pools found">
                            <chakra.span fontSize="14px" color="fg.muted">Try adjusting your search criteria</chakra.span>
                            <Button mt="6px" size="md" variant={hgVariant('secondary')} onClick={() => setSearchTerm('')}>
                                Clear Search
                            </Button>
                        </StateCard>
                    )}
                    {sortedPools.length === 0 && (
                        <StateCard title="No pools created yet"/>
                    )}

                    {/* Footer Info */}
                    {(filteredAndSortedPools.userPools.length > 0 || filteredAndSortedPools.otherPools.length > 0) && (
                        <Flex justify="center" align="center" gap="8px" wrap="wrap" fontSize="14px" color="hg.text.faint">
                            Showing {filteredAndSortedPools.userPools.length + filteredAndSortedPools.otherPools.length} of {pools.length} pools
                            {filteredAndSortedPools.userPools.length > 0 && (
                                <>
                                    <span aria-hidden="true">•</span>
                                    <chakra.span fontSize="12px" fontWeight="700" px="8px" py="2px" borderRadius="full" color="hg.link" bg="app.subtle">
                                        {filteredAndSortedPools.userPools.length} My Pools
                                    </chakra.span>
                                </>
                            )}
                        </Flex>
                    )}
                </Flex>
            </PageContainer>
        </Box>
    )
}
