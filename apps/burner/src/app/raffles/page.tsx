'use client';

import {Box, chakra, Flex, Grid, VisuallyHidden} from "@chakra-ui/react";
import {useRouter} from "next/navigation";
import {useMemo, type ReactNode} from "react";
import {LuArrowRight, LuClock, LuFlame, LuInfo} from "react-icons/lu";
import {RaffleInfo} from "@/components/raffle-info";
import {useRaffles} from "@/hooks/useRaffles";
import {
    useAsset,
    uAmountToBigNumberAmount,
    prettyAmount,
    toBigNumber,
    formatTimeRemainingFromEpochs,
    useEpochs,
    HgCard,
    PageContainer,
    PageState,
    Shimmer,
} from "@bze/bze-ui-kit";
import {RaffleSDKType} from "@bze/bzejs/bze/burner/raffle";
import BigNumber from "bignumber.js";
import {AssetLogo} from "@/components/ui/asset_logo";
import {rafflePrize, raffleWinChance} from "@/lib/raffle";
import {InnerHero} from "@/components/ui/burner/inner-hero";
import {AppPill} from "@/components/ui/burner/parts";

interface RaffleCardProps {
    raffle: RaffleSDKType;
    currentEpoch: BigNumber;
    onClick: () => void;
}

/** A prize or contribution box on the inset. */
const RaffleFigure = ({label, value, ticker, ember}: { label: string; value: ReactNode; ticker: string; ember?: boolean }) => (
    <Flex direction="column" gap="2px" bg="hg.inset" borderRadius="hg.md" px="14px" py="12px" minW="0">
        <chakra.span fontSize="11px" letterSpacing="0.1em" textTransform="uppercase" fontWeight="700" color="hg.text.faint">{label}</chakra.span>
        <chakra.span fontSize="20px" fontWeight="800" color={ember ? 'hg.link' : 'fg'} overflowWrap="anywhere">{value}</chakra.span>
        <chakra.span fontSize="12px" color="hg.text.faint">{ticker}</chakra.span>
    </Flex>
);

function RaffleCard({raffle, currentEpoch, onClick}: RaffleCardProps) {
    const {asset} = useAsset(raffle.denom);

    const ticker = useMemo(() => asset?.ticker || raffle.denom, [asset?.ticker, raffle.denom]);
    const name = useMemo(() => asset?.name || raffle.denom, [asset?.name, raffle.denom]);
    const decimals = useMemo(() => asset?.decimals || 6, [asset?.decimals]);

    const formattedPrize = useMemo(
        () => rafflePrize(raffle.pot, raffle.ratio, decimals),
        [raffle.pot, raffle.ratio, decimals],
    );

    const formattedTicketPrice = useMemo(() => {
        const bnAmount = uAmountToBigNumberAmount(raffle.ticket_price, decimals);
        return prettyAmount(bnAmount);
    }, [raffle.ticket_price, decimals]);

    const winChance = useMemo(() => raffleWinChance(raffle.chances), [raffle.chances]);

    // end_at is an epoch number (each epoch = 1 hour)
    const timeRemaining = useMemo(() => formatTimeRemainingFromEpochs(raffle.end_at, currentEpoch), [raffle.end_at, currentEpoch]);

    return (
        <HgCard
            as="button"
            interactive
            onClick={onClick}
            textAlign="start"
            cursor="pointer"
            w="100%"
            p="20px"
            borderRadius="18px"
            display="flex"
            flexDirection="column"
            gap="16px"
            minW="0"
        >
            <Flex align="center" gap="12px" minW="0">
                {asset && <AssetLogo asset={asset} size="44px"/>}
                <Flex direction="column" gap="2px" minW="0">
                    <chakra.strong fontSize="17px" truncate>{ticker} Raffle</chakra.strong>
                    <chakra.span fontSize="13px" color="hg.text.faint" truncate>{ticker} · {name}</chakra.span>
                </Flex>
            </Flex>

            <Flex gap="8px" wrap="wrap">
                <AppPill><Flex as="span" align="center" gap="6px"><LuClock size={12} aria-hidden/>{timeRemaining}</Flex></AppPill>
                <chakra.span fontSize="12px" fontWeight="600" px="10px" py="3px" borderRadius="hg.pill" color="hg.text.secondary" bg="hg.secondaryFill" borderWidth="1px" borderColor="hg.hairline">
                    {winChance}
                </chakra.span>
            </Flex>

            <Grid templateColumns="repeat(2, minmax(0, 1fr))" gap="10px">
                <RaffleFigure label="Prize" value={formattedPrize} ticker={ticker} ember/>
                <RaffleFigure label="Contribution" value={formattedTicketPrice} ticker={ticker}/>
            </Grid>

            <Flex justify="space-between" align="center" pt="12px" borderTopWidth="1px" borderColor="hg.divider" fontSize="14px" fontWeight="600" color="hg.link">
                Click to contribute
                <LuArrowRight size={16} aria-hidden/>
            </Flex>
        </HgCard>
    );
}

/** A raffle card's skeleton while the list loads. */
const RaffleCardLoading = () => (
    <HgCard p="20px" borderRadius="18px" display="flex" flexDirection="column" gap="14px" aria-hidden data-testid="raffle-card-loading">
        <Flex gap="12px" align="center">
            <Shimmer boxSize="44px" borderRadius="full" flex="none"/>
            <Flex direction="column" gap="6px" flex="1">
                <Shimmer h="14px" w="60%"/>
                <Shimmer h="10px" w="40%"/>
            </Flex>
        </Flex>
        <Grid templateColumns="repeat(2, minmax(0, 1fr))" gap="10px">
            <Shimmer h="72px" borderRadius="hg.md"/>
            <Shimmer h="72px" borderRadius="hg.md"/>
        </Grid>
    </HgCard>
);

const rafflesGrid = {templateColumns: {base: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))'}, gap: '16px'};

export default function RafflesPage() {
    const router = useRouter();
    const {raffles, isLoading} = useRaffles();
    const {hourEpochInfo} = useEpochs()

    const currentEpoch = useMemo(() => toBigNumber(hourEpochInfo?.current_epoch ?? 0), [hourEpochInfo])

    const handleRaffleClick = (denom: string) => {
        router.push(`/coin?coin=${denom}`);
    };

    return (
        <Box minH="100vh" pb="80px">
            <InnerHero title="Burning raffles" subtitle="Join active raffles and win rewards by burning tokens!"/>

            <PageContainer as="main" pt={{base: '28px', md: '36px'}}>
                <Flex direction="column" gap="32px">
                    <HgCard as="section" aria-labelledby="what-are-raffles" p={{base: '20px', md: '28px'}} borderRadius="20px" display="flex" flexDirection="column" gap="20px">
                        <Flex align="center" gap="12px">
                            <Flex
                                as="span"
                                aria-hidden
                                boxSize="40px"
                                flex="none"
                                align="center"
                                justify="center"
                                borderRadius="hg.md"
                                bg="hg.info/8"
                                borderWidth="1px"
                                borderColor="hg.info/30"
                                color="hg.info"
                            >
                                <LuInfo size={20}/>
                            </Flex>
                            <chakra.h2 id="what-are-raffles" m="0" fontSize="20px" fontWeight="700">What are burning raffles?</chakra.h2>
                        </Flex>
                        <RaffleInfo/>
                    </HgCard>

                    <Flex as="section" direction="column" gap="16px">
                        <chakra.h2 m="0" fontSize={{base: '20px', md: '22px'}} fontWeight="700">Active raffles</chakra.h2>
                        {isLoading ? (
                            <Box aria-busy="true">
                                <VisuallyHidden>Loading raffles...</VisuallyHidden>
                                <Grid {...rafflesGrid}>
                                    {[1, 2, 3].map(i => <RaffleCardLoading key={i}/>)}
                                </Grid>
                            </Box>
                        ) : raffles.length > 0 ? (
                            <Grid {...rafflesGrid}>
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
                            <HgCard>
                                <PageState
                                    kind="empty"
                                    icon={<LuFlame/>}
                                    title="No Active Raffles"
                                    description="There are no active raffles at the moment. Check back later!"
                                />
                            </HgCard>
                        )}
                    </Flex>
                </Flex>
            </PageContainer>
        </Box>
    );
}
