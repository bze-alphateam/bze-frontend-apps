'use client';

import {Box, chakra, Flex, Grid} from '@chakra-ui/react';
import {LuTrendingUp, LuClock, LuCoins, LuGift} from 'react-icons/lu';
import {
    useAssets,
    useAssetPrice,
    prettyAmount,
    uAmountToBigNumberAmount,
    formatUsdAmount,
    Eyebrow,
    GradientText,
    HgCard,
    HomeHero,
    Shimmer,
} from '@bze/bze-ui-kit';
import BigNumber from 'bignumber.js';
import type {ReactNode} from 'react';
import type {NativeStakingData} from '@bze/bze-ui-kit';

interface OverviewProps {
    stakingData?: NativeStakingData;
    isLoading: boolean;
    /** The open-proposal card, on the right of the hero (the governance banner). */
    callout?: ReactNode;
    /** The hero's buttons (Connect Wallet to Stake, Browse validators). */
    actions?: ReactNode;
}

interface StatTileData {
    icon: ReactNode;
    label: string;
    value: string;
    hint?: string;
    note?: string;
}

const SUBTITLE = 'Stake BZE and earn rewards. Delegate your BZE tokens to validators and earn staking rewards.';

function StatTile({icon, label, value, hint, note}: StatTileData) {
    return (
        <HgCard px={{base: '18px', md: '20px'}} py={{base: '16px', md: '18px'}} display="flex" flexDirection="column" gap="10px" minW="0" data-testid="stat-tile">
            <Flex align="center" gap="10px">
                <Flex
                    as="span"
                    aria-hidden
                    boxSize={{base: '28px', md: '32px'}}
                    flex="none"
                    align="center"
                    justify="center"
                    borderRadius="10px"
                    bg="app.subtle"
                    borderWidth="1px"
                    borderColor="app.border"
                    color="hg.accent"
                >
                    {icon}
                </Flex>
                <chakra.span fontSize="14px" color="hg.text.secondary">{label}</chakra.span>
            </Flex>
            <chakra.span fontSize={{base: '22px', md: '26px'}} fontWeight="700" letterSpacing="-0.01em" color="fg" overflowWrap="anywhere">
                {value}
            </chakra.span>
            {hint && <chakra.span fontSize="13px" color="hg.text.faint">{hint}</chakra.span>}
            {note && <chakra.span fontSize="13px" color="hg.text.faint">{note}</chakra.span>}
        </HgCard>
    );
}

function StatTileLoading() {
    return (
        <HgCard px="20px" py="18px" display="flex" flexDirection="column" gap="12px" aria-hidden data-testid="stat-tile-loading">
            <Flex align="center" gap="10px">
                <Shimmer boxSize="32px" borderRadius="10px" flex="none" />
                <Shimmer h="12px" w="45%" />
            </Flex>
            <Shimmer h="24px" w="60%" />
            <Shimmer h="10px" w="40%" />
        </HgCard>
    );
}

const statGrid = {templateColumns: {base: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))'}, gap: {base: '12px', md: '16px'}};

/** The dashboard hero: eyebrow, "Stake BZE, earn N% APR", the actions, the open-proposal card on the right; then the stat tiles. */
export function StakingOverview({stakingData, isLoading, callout, actions}: OverviewProps) {
    const {nativeAsset} = useAssets();
    const {price: bzePrice} = useAssetPrice(nativeAsset?.denom ?? '');
    const decimals = nativeAsset?.decimals ?? 6;
    const loading = isLoading || !stakingData;

    const hero = (
        <Flex wrap="wrap" gap={{base: '28px', md: '56px'}} align="center">
            <Box flex="999 1 480px" minW="0">
                <HomeHero
                    eyebrow={<Eyebrow app="staking">BeeZee Staking</Eyebrow>}
                    title={
                        <>
                            Stake BZE, earn{' '}
                            {loading ? (
                                <Shimmer as="span" display="inline-block" verticalAlign="middle" h="40px" w="220px" borderRadius="10px" aria-hidden />
                            ) : (
                                <GradientText>{stakingData?.averageApr}% APR</GradientText>
                            )}
                        </>
                    }
                    subtitle={SUBTITLE}
                    primaryAction={actions}
                />
            </Box>
            {loading ? (
                <HgCard flex="1 1 380px" maxW={{base: 'none', md: '440px'}} display="flex" flexDirection="column" gap="18px" aria-hidden>
                    <Flex gap="14px">
                        <Shimmer boxSize="44px" borderRadius="12px" flex="none" />
                        <Flex direction="column" gap="8px" flex="1">
                            <Shimmer h="14px" w="70%" />
                            <Shimmer h="10px" w="90%" />
                        </Flex>
                    </Flex>
                    <Shimmer h="44px" borderRadius="12px" />
                </HgCard>
            ) : callout && (
                <Box flex="1 1 380px" maxW={{base: 'none', md: '460px'}} minW="0">{callout}</Box>
            )}
        </Flex>
    );

    if (loading || !stakingData) {
        return (
            <Flex direction="column" gap={{base: '28px', md: '40px'}}>
                {hero}
                <Grid {...statGrid} aria-hidden>
                    {[1, 2, 3, 4].map(i => <StatTileLoading key={i} />)}
                </Grid>
            </Flex>
        );
    }

    const ticker = nativeAsset?.ticker;
    const totalStakedHuman = uAmountToBigNumberAmount(stakingData.totalStaked.amount, decimals);
    const totalStakedUsd = bzePrice ? totalStakedHuman.multipliedBy(bzePrice) : new BigNumber(0);
    const dailyDistHuman = uAmountToBigNumberAmount(stakingData.averageDailyDistribution.amount, decimals);

    const userStaked = stakingData.currentStaking
        ? uAmountToBigNumberAmount(stakingData.currentStaking.staked.amount, decimals)
        : null;
    const userStakedUsd = userStaked && bzePrice ? userStaked.multipliedBy(bzePrice) : null;
    const userRewards = stakingData.currentStaking
        ? uAmountToBigNumberAmount(stakingData.currentStaking.pendingRewards.total.amount, decimals)
        : null;
    const userRewardsUsd = userRewards && bzePrice ? userRewards.multipliedBy(bzePrice) : null;
    const usd = (value: BigNumber | null) => (value && value.gt(0) ? `~${formatUsdAmount(value)}` : '');

    const common: StatTileData[] = [
        {
            icon: <LuTrendingUp size={16} />,
            label: 'Staking APR',
            value: `${stakingData.averageApr}%`,
            hint: `${prettyAmount(dailyDistHuman)} ${ticker}/day distributed`,
        },
        {
            icon: <LuCoins size={16} />,
            label: 'Network Staked',
            value: prettyAmount(totalStakedHuman),
            hint: usd(totalStakedUsd),
        },
    ];

    // With a wallet: its stake and pending rewards; without: the unbonding period and the daily distribution.
    const tiles: StatTileData[] = userStaked !== null
        ? [
            ...common,
            {
                icon: <LuGift size={16} />,
                label: 'Your Stake',
                value: `${prettyAmount(userStaked)} ${ticker}`,
                hint: usd(userStakedUsd),
                note: `Unbonding period: ${stakingData.unlockDuration} days`,
            },
            {
                icon: <LuGift size={16} />,
                label: 'Pending Rewards',
                value: `${prettyAmount(userRewards ?? new BigNumber(0))} ${ticker}`,
                hint: usd(userRewardsUsd),
            },
        ]
        : [
            ...common,
            {
                icon: <LuClock size={16} />,
                label: 'Unbonding Period',
                value: `${stakingData.unlockDuration} days`,
                hint: 'Time to unstake tokens',
            },
            {
                icon: <LuGift size={16} />,
                label: 'Daily Distribution',
                value: `${prettyAmount(dailyDistHuman)} ${ticker}`,
                hint: 'Distributed to stakers',
            },
        ];

    return (
        <Flex direction="column" gap={{base: '28px', md: '40px'}}>
            {hero}
            <Grid {...statGrid}>
                {tiles.map(tile => <StatTile key={tile.label} {...tile} />)}
            </Grid>
        </Flex>
    );
}
