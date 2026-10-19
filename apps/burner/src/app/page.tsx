'use client';

import {Box, Button, chakra, Flex, Grid, Table} from "@chakra-ui/react";
import {useState, useMemo, useEffect, useCallback} from "react";
import {useRouter} from "next/navigation";
import NextLink from "next/link";
import {LuFlame} from "react-icons/lu";
import {
    useAssetsValue,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAssets,
    useAsset,
    Eyebrow,
    FeaturedCard,
    GradientText,
    HeroGlow,
    HgCard,
    HomeHero,
    PageContainer,
    PageState,
    hgVariant,
} from "@bze/bze-ui-kit";
import {useBurnerContext} from "@/hooks/useBurnerContext";
import {BurnModal} from "@/components/burn-modal";
import {useBurningHistory} from "@/hooks/useBurningHistory";
import {useNextBurning} from "@/hooks/useNextBurning";
import BigNumber from "bignumber.js";
import {AssetLogo} from "@/components/ui/asset_logo";
import {breakdownDuration} from "@/lib/burn-schedule";
import {sumBurnAmounts} from "@/lib/burn-history";
import {AppPill, BodyCell, BurnStat, emberAmount, HeaderCell, rowLink, SectionHeader, stackedRow, TableCard} from "@/components/ui/burner/parts";

const MAX_BURN_HISTORY_ITEMS = 30;
const HISTORY_ID = "history";

const pad = (n: number) => String(n).padStart(2, '0');

/** One countdown box: the number on the inset, the unit under it. */
const TimerBox = ({value, unit}: { value: number; unit: string }) => (
    <Flex direction="column" align="center" gap="8px">
        <Flex
            boxSize={{base: '68px', md: '96px'}}
            align="center"
            justify="center"
            borderRadius={{base: '14px', md: '18px'}}
            bg="hg.inset"
            borderWidth="1px"
            borderColor="app.border"
            fontFamily="mono"
            fontWeight="700"
            fontSize={{base: '28px', md: '40px'}}
            color="fg"
        >
            {pad(value)}
        </Flex>
        <chakra.span fontSize="12px" letterSpacing="0.1em" textTransform="uppercase" color="hg.text.faint">{unit}</chakra.span>
    </Flex>
);

/** Counts down to the next burn, one tick a second; a Days box comes first when more than a day is left. */
const CountdownTimer = ({targetDate}: { targetDate: Date }) => {
    const [timeLeft, setTimeLeft] = useState(0);

    useEffect(() => {
        const calculateTimeLeft = () => {
            const diff = Math.floor((targetDate.getTime() - Date.now()) / 1000);
            setTimeLeft(Math.max(0, diff));
        };

        calculateTimeLeft();
        const interval = setInterval(calculateTimeLeft, 1000);

        return () => clearInterval(interval);
    }, [targetDate]);

    const {days, hours, minutes, seconds} = breakdownDuration(timeLeft);

    return (
        <Flex role="timer" gap={{base: '10px', md: '14px'}} align="flex-start" wrap="wrap" justify="center">
            {days > 0 && <TimerBox value={days} unit="Days"/>}
            <TimerBox value={hours} unit="Hours"/>
            <TimerBox value={minutes} unit="Minutes"/>
            <TimerBox value={seconds} unit="Seconds"/>
        </Flex>
    );
};

// A coin in the pot: its logo, name and ticker, and the amount that burns next.
const PendingBurnBox = ({denom, amount, onClick}: {
    denom: string;
    amount: string;
    onClick: () => void;
}) => {
    const {totalUsdValue} = useAssetsValue();
    const {denomDecimals} = useAssets();
    const {asset} = useAsset(denom);

    const ticker = asset?.ticker || denom;
    const name = asset?.name || denom;

    const decimals = denomDecimals(denom);
    const prettyAmountValue = useMemo(() => {
        const bnAmount = uAmountToBigNumberAmount(amount, decimals);
        return prettyAmount(bnAmount);
    }, [amount, decimals]);

    const usdValue = useMemo(() => {
        const bnAmount = uAmountToBigNumberAmount(amount, decimals);
        return totalUsdValue([{denom, amount: bnAmount}]);
    }, [amount, decimals, denom, totalUsdValue]);

    return (
        <HgCard
            as="button"
            interactive
            onClick={onClick}
            textAlign="start"
            cursor="pointer"
            px="20px"
            py="18px"
            display="flex"
            flexDirection="column"
            gap="16px"
            minW="0"
            w="100%"
        >
            <Flex align="center" gap="12px" minW="0">
                {asset && <AssetLogo asset={asset} size="44px"/>}
                <Flex direction="column" gap="2px" minW="0">
                    <chakra.strong fontSize="15px" truncate>{name}</chakra.strong>
                    <chakra.span fontFamily="mono" fontSize="12px" color="hg.text.faint" truncate>{ticker}</chakra.span>
                </Flex>
            </Flex>
            <Flex direction="column" gap="2px">
                <chakra.span fontSize="11px" letterSpacing="0.1em" textTransform="uppercase" fontWeight="700" color="hg.text.faint">Ready to burn</chakra.span>
                <chakra.span fontSize="22px" fontWeight="800" color="hg.link" overflowWrap="anywhere">{prettyAmountValue}</chakra.span>
                {usdValue.gt(0) && <chakra.span fontSize="13px" color="hg.text.faint">≈ ${prettyAmount(usdValue)}</chakra.span>}
            </Flex>
        </HgCard>
    );
};

/** The coin cell of a table: its logo and ticker. */
const CoinCell = ({denom, ticker, size = '28px'}: { denom: string; ticker: string; size?: string }) => {
    const {getAsset} = useAssets();
    const asset = getAsset(denom);

    return (
        <Flex align="center" gap="12px" fontWeight="600">
            {asset && <AssetLogo asset={asset} size={size}/>}
            <span>{ticker}</span>
        </Flex>
    );
};

export default function BurnerHomePage() {
    const [isBurnModalOpen, setIsBurnModalOpen] = useState(false);
    const router = useRouter();

    const {burnHistory, isLoading: isLoadingHistory} = useBurningHistory();
    const {getAsset, nativeAsset} = useAssets();
    const {totalUsdValue} = useAssetsValue();
    const {nextBurn, isLoading: isLoadingNextBurn} = useNextBurning();
    const {lockBalance} = useBurnerContext();

    const lastBurnings = burnHistory.slice(0, MAX_BURN_HISTORY_ITEMS);
    const nativeTicker = nativeAsset?.ticker || 'BZE';

    const totalBzeBurned = useMemo(() => {
        if (!nativeAsset) return BigNumber(0);

        return sumBurnAmounts(burnHistory, nativeAsset.denom);
    }, [burnHistory, nativeAsset]);

    const totalBzeUsdValue = useMemo(() => {
        if (!nativeAsset || totalBzeBurned.isZero()) return BigNumber(0);

        return totalUsdValue([{denom: nativeAsset.denom, amount: totalBzeBurned}]);
    }, [totalBzeBurned, nativeAsset, totalUsdValue]);

    const pendingBurns = useMemo(() => nextBurn?.coins || [], [nextBurn]);

    // The forever locked coins with their USD values, highest value first, then the largest balance.
    const lockedTokens = useMemo(() => {
        const tokens = Array.from(lockBalance.entries()).map(([denom, balance]) => {
            const asset = getAsset(denom);
            const amount = uAmountToBigNumberAmount(balance.amount, asset?.decimals ?? 0)
            const usdValue = totalUsdValue([{denom, amount: amount}]);

            return {
                denom,
                balance: amount,
                usdValue,
                ticker: asset?.ticker || denom,
                name: asset?.name || denom,
            };
        });

        return tokens.sort((a, b) => {
            if (b.usdValue.gt(a.usdValue)) return 1;
            if (b.usdValue.lt(a.usdValue)) return -1;
            return b.balance.comparedTo(a.balance) ?? 0;
        });
    }, [lockBalance, getAsset, totalUsdValue]);

    const totalLockedUsdValue = useMemo(() => {
        return lockedTokens.reduce((total, token) => total.plus(token.usdValue), BigNumber(0));
    }, [lockedTokens]);

    const handleCoinClick = (denom: string) => {
        router.push(`/coin?coin=${encodeURIComponent(denom)}`);
    };

    const onBurnModalClose = useCallback(() => {
        setIsBurnModalOpen(false)
    }, [])

    const coinsLabel = (n: number) => `${n} ${n === 1 ? 'coin' : 'coins'}`;

    const historyRows = lastBurnings.map((burn) => {
        const asset = getAsset(burn.denom);
        return {
            burn,
            ticker: asset?.ticker || burn.denom,
            name: asset?.name || burn.denom,
        };
    });

    const historyState = isLoadingHistory
        ? <PageState kind="loading" rows={4}/>
        : lastBurnings.length === 0
            ? <PageState kind="empty" title="No Burns Yet" description="Be the first to burn some coins!"/>
            : null;

    return (
        <Box position="relative" minH="100vh" pb="80px">
            <HeroGlow/>
            <PageContainer as="main" position="relative" pt={{base: '40px', md: '72px'}}>
                <Flex direction="column" gap={{base: '28px', md: '40px'}}>
                    <HomeHero
                        align="center"
                        eyebrow={<Eyebrow app="burner">BeeZee Burner</Eyebrow>}
                        title={<>The <GradientText>Burning</GradientText> Pot</>}
                        subtitle="Burn coins and join the raffles. Toss your coins into the fire: everything in the pot burns together at the next cycle."
                        primaryAction={
                            <Button variant={hgVariant('primary')} size="lg" onClick={() => setIsBurnModalOpen(true)}>
                                <LuFlame/> Burn coins
                            </Button>
                        }
                        secondaryAction={
                            <Button variant={hgVariant('secondary')} size="lg" asChild>
                                <NextLink href="/raffles">Join a raffle</NextLink>
                            </Button>
                        }
                    />

                    <section aria-labelledby="next-burn">
                        <FeaturedCard px={{base: '20px', md: '32px'}} py={{base: '28px', md: '36px'}}>
                            <Flex direction="column" align="center" gap="22px" textAlign="center">
                                <Flex direction="column" align="center" gap="6px">
                                    <chakra.h2 id="next-burn" m="0" textStyle="eyebrow" color="hg.eyebrow">Next burn in</chakra.h2>
                                    <chakra.span fontSize="14px" color="hg.text.secondary">Coins in the pot are about to go</chakra.span>
                                </Flex>
                                {isLoadingNextBurn ? (
                                    <chakra.span fontSize="15px" color="hg.text.faint">Loading...</chakra.span>
                                ) : nextBurn?.date ? (
                                    <CountdownTimer targetDate={nextBurn.date}/>
                                ) : (
                                    <chakra.span fontSize="15px" color="hg.text.faint">No burning scheduled</chakra.span>
                                )}
                            </Flex>
                        </FeaturedCard>
                    </section>

                    <Grid templateColumns={{base: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))'}} gap={{base: '12px', md: '16px'}}>
                        <BurnStat
                            label={`Total ${nativeTicker} incinerated`}
                            value={isLoadingHistory ? 'Loading...' : <>{prettyAmount(totalBzeBurned)} <chakra.span fontSize="16px" fontWeight="600" color="hg.text.secondary">{nativeTicker}</chakra.span></>}
                            foot={!isLoadingHistory && totalBzeUsdValue.gt(0) ? `≈ $${prettyAmount(totalBzeUsdValue)}` : undefined}
                            tag={<AppPill>All time</AppPill>}
                        />
                        <BurnStat
                            label="Total value locked forever"
                            value={`$${prettyAmount(totalLockedUsdValue)}`}
                            foot={coinsLabel(lockedTokens.length)}
                            tag={<AppPill>Never coming back</AppPill>}
                        />
                        <BurnStat
                            label="Coins in the pot"
                            value={isLoadingNextBurn ? 'Loading...' : pendingBurns.length}
                            foot="Burn together at the next cycle"
                        />
                    </Grid>

                    {!isLoadingNextBurn && pendingBurns.length > 0 && (
                        <Flex as="section" direction="column" gap="16px">
                            <SectionHeader
                                title="Ready to Burn"
                                tag={<AppPill>{coinsLabel(pendingBurns.length)}</AppPill>}
                                actions={<chakra.a href={`#${HISTORY_ID}`} fontSize="14px" color="hg.link" _hover={{color: 'hg.link.hover'}}>Burn history →</chakra.a>}
                            />
                            <Grid templateColumns={{base: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))'}} gap={{base: '12px', md: '16px'}}>
                                {pendingBurns.map((coin: { denom: string; amount: string }) => (
                                    <PendingBurnBox
                                        key={coin.denom}
                                        denom={coin.denom}
                                        amount={coin.amount}
                                        onClick={() => handleCoinClick(coin.denom)}
                                    />
                                ))}
                            </Grid>
                        </Flex>
                    )}

                    {lockedTokens.length > 0 && (
                        <Flex as="section" direction="column" gap="16px">
                            <SectionHeader title="Forever Locked" tag={<AppPill>{coinsLabel(lockedTokens.length)}</AppPill>}/>
                            <TableCard>
                                <Box display={{base: 'none', md: 'block'}} overflowX="auto">
                                    <Table.Root size="md" bg="transparent">
                                        <Table.Header>
                                            <Table.Row>
                                                <HeaderCell>Coin</HeaderCell>
                                                <HeaderCell>Name</HeaderCell>
                                                <HeaderCell end>Amount locked</HeaderCell>
                                                <HeaderCell end>USD value</HeaderCell>
                                            </Table.Row>
                                        </Table.Header>
                                        <Table.Body>
                                            {lockedTokens.map((token) => (
                                                <Table.Row key={token.denom} {...rowLink} onClick={() => handleCoinClick(token.denom)}>
                                                    <BodyCell><CoinCell denom={token.denom} ticker={token.ticker}/></BodyCell>
                                                    <BodyCell><chakra.span color="hg.text.secondary">{token.name}</chakra.span></BodyCell>
                                                    <BodyCell end><chakra.span {...emberAmount}>{prettyAmount(token.balance)} {token.ticker}</chakra.span></BodyCell>
                                                    <BodyCell end>
                                                        {token.usdValue.gt(0) && <chakra.span color="hg.text.secondary">≈ ${prettyAmount(token.usdValue)}</chakra.span>}
                                                    </BodyCell>
                                                </Table.Row>
                                            ))}
                                        </Table.Body>
                                    </Table.Root>
                                </Box>
                                <Box display={{base: 'block', md: 'none'}}>
                                    {lockedTokens.map((token, idx) => (
                                        <Flex
                                            key={token.denom}
                                            {...stackedRow}
                                            borderTopWidth={idx ? '1px' : '0'}
                                            justify="space-between"
                                            align="center"
                                            gap="12px"
                                            onClick={() => handleCoinClick(token.denom)}
                                        >
                                            <Flex direction="column" gap="2px" minW="0">
                                                <CoinCell denom={token.denom} ticker={token.ticker} size="32px"/>
                                                <chakra.span fontSize="13px" color="hg.text.faint" truncate>{token.name}</chakra.span>
                                            </Flex>
                                            <Flex direction="column" align="flex-end" gap="2px">
                                                <chakra.span {...emberAmount}>{prettyAmount(token.balance)}</chakra.span>
                                                {token.usdValue.gt(0) && <chakra.span fontSize="12px" color="hg.text.faint">≈ ${prettyAmount(token.usdValue)}</chakra.span>}
                                            </Flex>
                                        </Flex>
                                    ))}
                                </Box>
                            </TableCard>
                        </Flex>
                    )}

                    <Flex as="section" id={HISTORY_ID} direction="column" gap="16px" scrollMarginTop="96px">
                        <SectionHeader title="Burn History Book" tag={<AppPill>Last {MAX_BURN_HISTORY_ITEMS} Victims</AppPill>}/>
                        <TableCard>
                            {historyState ? (
                                <Box px={{base: '16px', md: '20px'}}>{historyState}</Box>
                            ) : (
                                <>
                                    <Box display={{base: 'none', md: 'block'}} overflowX="auto">
                                        <Table.Root size="md" bg="transparent">
                                            <Table.Header>
                                                <Table.Row>
                                                    <HeaderCell>Coin</HeaderCell>
                                                    <HeaderCell>Name</HeaderCell>
                                                    <HeaderCell end>Amount burned</HeaderCell>
                                                    <HeaderCell end>Block height</HeaderCell>
                                                </Table.Row>
                                            </Table.Header>
                                            <Table.Body>
                                                {historyRows.map(({burn, ticker, name}, idx) => (
                                                    <Table.Row key={idx} {...rowLink} onClick={() => handleCoinClick(burn.denom)}>
                                                        <BodyCell><CoinCell denom={burn.denom} ticker={ticker}/></BodyCell>
                                                        <BodyCell><chakra.span color="hg.text.secondary">{name}</chakra.span></BodyCell>
                                                        <BodyCell end>
                                                            <Flex direction="column" align="flex-end" gap="2px">
                                                                <chakra.span {...emberAmount}>{prettyAmount(burn.amount)} {ticker}</chakra.span>
                                                                {burn.usdValue.gt(0) && <chakra.span fontSize="12px" color="hg.text.faint">≈ ${prettyAmount(burn.usdValue)}</chakra.span>}
                                                            </Flex>
                                                        </BodyCell>
                                                        <BodyCell end>
                                                            <Flex direction="column" align="flex-end" gap="2px">
                                                                <chakra.span fontFamily="mono" fontSize="13px" color="hg.text.secondary">#{burn.blockHeight}</chakra.span>
                                                                <chakra.span fontSize="12px" color="hg.text.faint">{burn.timestamp}</chakra.span>
                                                            </Flex>
                                                        </BodyCell>
                                                    </Table.Row>
                                                ))}
                                            </Table.Body>
                                        </Table.Root>
                                    </Box>
                                    <Box display={{base: 'block', md: 'none'}}>
                                        {historyRows.map(({burn, ticker, name}, idx) => (
                                            <Flex
                                                key={idx}
                                                {...stackedRow}
                                                borderTopWidth={idx ? '1px' : '0'}
                                                justify="space-between"
                                                align="center"
                                                gap="12px"
                                                onClick={() => handleCoinClick(burn.denom)}
                                            >
                                                <Flex direction="column" gap="2px" minW="0">
                                                    <CoinCell denom={burn.denom} ticker={ticker} size="32px"/>
                                                    <chakra.span fontSize="13px" color="hg.text.faint" truncate>{name}</chakra.span>
                                                </Flex>
                                                <Flex direction="column" align="flex-end" gap="2px">
                                                    <chakra.span {...emberAmount}>{prettyAmount(burn.amount)}</chakra.span>
                                                    {burn.usdValue.gt(0) && <chakra.span fontSize="12px" color="hg.text.faint">≈ ${prettyAmount(burn.usdValue)}</chakra.span>}
                                                    <chakra.span fontFamily="mono" fontSize="12px" color="hg.text.secondary">#{burn.blockHeight}</chakra.span>
                                                    <chakra.span fontSize="12px" color="hg.text.faint">{burn.timestamp}</chakra.span>
                                                </Flex>
                                            </Flex>
                                        ))}
                                    </Box>
                                </>
                            )}
                        </TableCard>
                    </Flex>

                    <chakra.p m="0" textAlign="center" fontSize="14px" color="hg.text.faint">
                        Remember: what burns in the pot, stays in the pot!
                    </chakra.p>
                </Flex>
            </PageContainer>

            <BurnModal
                isOpen={isBurnModalOpen}
                onClose={onBurnModalClose}
            />
        </Box>
    );
}
