'use client';

import React, {type ReactNode, useEffect, useState} from "react";
import {Badge, Box, Button, Card, Heading, HStack, Link, SimpleGrid, Skeleton, Stack, Text, VStack} from "@chakra-ui/react";
import {LuClock, LuCoins, LuExternalLink, LuGift, LuLock, LuRefreshCw, LuTrendingUp} from "react-icons/lu";
import {useChain} from "@interchain-kit/react";
import {
    Asset,
    claimableCoins,
    DenomRewardAction,
    denomRewardActionBlockers,
    DenomRewardClaimPanel,
    DenomRewardCoinLine,
    DenomRewardExitPanel,
    DenomRewardHolderItem,
    DenomRewardStakePanel,
    estimateDailyShare,
    formatUnlockCountdown,
    getChainName,
    getEcosystemApps,
    prettyAmount,
    shortNumberFormat,
    uAmountToBigNumberAmount,
    useAssets,
    useBalance,
    useEpochs,
    useTokenDenomReward,
} from "@bze/bze-ui-kit";

import {factoryDenomRewardLink} from "@/lib/denom-reward";
import {RewardStakingAlert, TYPE_UNLOCK} from "@/components/ui/staking/rewards-staking-alerts";
import {RewardsStakingButton} from "@/components/ui/staking/rewards-staking-buttons";

// Same cadence as the staking-reward programs next to it.
const DENOM_REWARD_RELOAD_INTERVAL = 150_000;

const Stat = ({icon, label, children}: { icon: ReactNode; label: string; children: ReactNode }) => (
    <Box p="2.5" bg="bg.muted" borderRadius="md" borderWidth="1px">
        <VStack align="start" gap="0.5">
            <HStack gap="1" color="fg.muted">
                {icon}
                <Text fontSize="2xs" textTransform="uppercase" fontWeight="semibold">{label}</Text>
            </HStack>
            <Box fontWeight="bold" fontSize="sm" w="full">{children}</Box>
        </VStack>
    </Box>
);

const ModalShell = ({title, onClose, children}: { title: string; onClose: () => void; children: ReactNode }) => (
    <Box position="fixed" inset="0" bg="blackAlpha.600" display="flex" alignItems="center" justifyContent="center" zIndex="modal">
        <Card.Root maxW="md" w="full" mx="4" maxH="90vh" overflowY="auto">
            <Card.Header>
                <HStack justify="space-between" align="center">
                    <Heading size="lg">{title}</Heading>
                    <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">✕</Button>
                </HStack>
            </Card.Header>
            <Card.Body>{children}</Card.Body>
        </Card.Root>
    </Box>
);

const actionTitle = (action: DenomRewardAction, ticker: string, hasPosition: boolean) => {
    if (action === 'stake') return hasPosition ? `Add to your ${ticker} stake` : `Stake ${ticker}`;
    return action === 'claim' ? `Claim your ${ticker} prizes` : `Exit the ${ticker} denom reward`;
};

interface DenomRewardCardProps {
    asset: Asset;
    item: DenomRewardHolderItem;
    prizeDenoms: string[];
    hasWallet: boolean;
    onAction: (action: DenomRewardAction) => void;
}

const DenomRewardCard = ({asset, item, prizeDenoms, hasWallet, onAction}: DenomRewardCardProps) => {
    const {denomReward, position, dailyPrizes, unlocks} = item;
    const {denomTicker} = useAssets();
    const {balance} = useBalance(asset.denom);
    const {hourEpochInfo} = useEpochs();
    const fmt = (amount: string) => `${shortNumberFormat(uAmountToBigNumberAmount(amount, asset.decimals))} ${asset.ticker}`;

    const blockers = denomRewardActionBlockers({item, hasWallet, balance: balance.amount});
    const pending = claimableCoins(position);
    const isPaying = (dailyPrizes?.length ?? 0) > 0;
    const currentHour = hourEpochInfo ? Number(hourEpochInfo.current_epoch) : undefined;
    const reasons = Array.from(new Set([blockers.stake, position ? blockers.claim : ''].filter(Boolean)));

    return (
        <Card.Root
            borderWidth={position ? "2px" : "1px"}
            borderColor={position ? "green.500" : (unlocks.length > 0 ? "orange.500" : "border")}
            bg="bg.surface"
            shadow="sm"
            data-testid="token-denom-reward"
        >
            <Card.Body>
                <VStack align="stretch" gap="3">
                    <HStack justify="space-between" flexWrap="wrap" gap="2">
                        <Text fontWeight="bold">Stake {asset.ticker}, earn prizes</Text>
                        <HStack gap="1.5" flexWrap="wrap">
                            <Badge colorPalette="purple" variant="subtle" size="sm">Denom reward</Badge>
                            {dailyPrizes === undefined ? null : isPaying
                                ? <Badge colorPalette="green" variant="subtle" size="sm">Paying daily</Badge>
                                : <Badge colorPalette="gray" variant="subtle" size="sm">No daily schedule — airdrops only</Badge>}
                        </HStack>
                    </HStack>

                    {position && (
                        <SimpleGrid columns={{base: 1, md: 2}} gap="2">
                            <Box p="3" borderRadius="md" borderWidth="1px" borderColor="green.500/30" bg="green.500/10">
                                <Text fontSize="sm" fontWeight="semibold" color="green.600" textTransform="uppercase">Your stake</Text>
                                <Text fontWeight="bold" fontSize="lg" data-testid="token-denom-reward-my-stake">
                                    {prettyAmount(uAmountToBigNumberAmount(position.participant.amount, asset.decimals))} {asset.ticker}
                                </Text>
                                {dailyPrizes?.map(prize => {
                                    const share = estimateDailyShare(position.participant.amount, denomReward.staked_amount, prize.amount);
                                    return share.gt(0) ? (
                                        <DenomRewardCoinLine key={prize.denom} coin={{denom: prize.denom, amount: share.toFixed(0)}} suffix=" / day (est.)"/>
                                    ) : null;
                                })}
                            </Box>
                            <Box p="3" borderRadius="md" borderWidth="1px" borderColor="purple.500/30" bg="purple.500/10">
                                <HStack gap="1" color="purple.600">
                                    <LuGift size={14}/>
                                    <Text fontSize="sm" fontWeight="semibold" textTransform="uppercase">Pending prizes</Text>
                                </HStack>
                                <Box data-testid="token-denom-reward-pending">
                                    {pending.length > 0
                                        ? pending.map(c => <DenomRewardCoinLine key={c.denom} coin={c}/>)
                                        : <Text color="fg.muted" fontSize="sm">Nothing to claim yet.</Text>}
                                </Box>
                            </Box>
                        </SimpleGrid>
                    )}

                    {unlocks.map(u => (
                        <RewardStakingAlert
                            key={u.unlockEpoch}
                            type={TYPE_UNLOCK}
                            text={`${prettyAmount(uAmountToBigNumberAmount(u.amount, asset.decimals))} ${asset.ticker} unlocking ${currentHour !== undefined ? formatUnlockCountdown(u.unlockEpoch, currentHour) : 'soon'}`}
                        />
                    ))}

                    <SimpleGrid columns={{base: 2, md: 4}} gap="2">
                        <Stat icon={<LuCoins size={11}/>} label="Pays per day">
                            {dailyPrizes === undefined
                                ? '—'
                                : isPaying
                                    ? dailyPrizes.map(p => <DenomRewardCoinLine key={p.denom} coin={p}/>)
                                    : 'Nothing scheduled'}
                        </Stat>
                        <Stat icon={<LuLock size={11}/>} label="Total staked">{fmt(denomReward.staked_amount)}</Stat>
                        <Stat icon={<LuClock size={11}/>} label="Unlock">
                            {denomReward.lock > 0 ? `${denomReward.lock} day${denomReward.lock === 1 ? '' : 's'}` : 'Instant'}
                        </Stat>
                        <Stat icon={<LuTrendingUp size={11}/>} label="Minimum">{fmt(denomReward.min_stake)}</Stat>
                    </SimpleGrid>

                    {prizeDenoms.length > 0 && (
                        <HStack gap="1.5" flexWrap="wrap" data-testid="token-denom-reward-prizes">
                            <Text fontSize="xs" color="fg.muted">Prizes in play:</Text>
                            {prizeDenoms.map(d => <Badge key={d} variant="outline" size="sm">{denomTicker(d)}</Badge>)}
                        </HStack>
                    )}

                    <Stack direction={{base: 'column', sm: 'row'}} gap="2" pt="1">
                        <RewardsStakingButton buttonType="staking" disabled={blockers.stake !== ''} onClick={() => onAction('stake')}>
                            <Text>{position ? 'Add' : 'Stake'}</Text>
                        </RewardsStakingButton>
                        {position && (
                            <>
                                <RewardsStakingButton buttonType="rewards" disabled={blockers.claim !== ''} onClick={() => onAction('claim')}>
                                    <Text>Claim</Text>
                                </RewardsStakingButton>
                                <RewardsStakingButton buttonType="unlock" disabled={blockers.exit !== ''} onClick={() => onAction('exit')}>
                                    <Text>Exit</Text>
                                </RewardsStakingButton>
                            </>
                        )}
                    </Stack>
                    {reasons.length > 0 && (
                        <Text fontSize="xs" color="fg.muted" data-testid="token-denom-reward-blockers">{reasons.join(' ')}</Text>
                    )}
                </VStack>
            </Card.Body>
        </Card.Root>
    );
};

/**
 * "Earn by staking <token>": the denom reward whose staking denom is this token, with the holder
 * actions (the ui-kit panels), or a quiet pointer to the Factory when the token has none.
 */
export const TokenDenomReward = ({asset}: { asset: Asset }) => {
    const {address} = useChain(getChainName());
    const {item, prizeDenoms, isLoading, hasError, reload} = useTokenDenomReward(asset.denom, address);
    const [action, setAction] = useState<DenomRewardAction | undefined>();

    useEffect(() => {
        const interval = setInterval(() => void reload(), DENOM_REWARD_RELOAD_INTERVAL);
        return () => clearInterval(interval);
    }, [reload]);

    const done = () => {
        setAction(undefined);
        void reload();
    };

    if (isLoading) return <Skeleton height="120px" borderRadius="xl"/>;

    if (hasError) {
        return (
            <HStack gap={3} p={4} borderRadius="lg" borderWidth="1px" bg="bg.surface">
                <Text fontSize="sm" color="fg.muted" flex="1">
                    Couldn&apos;t load the denom reward of {asset.ticker} — the node may be down, or not run chain v8.2.0 yet.
                </Text>
                <Button size="sm" variant="outline" colorPalette="green" onClick={() => void reload()}><LuRefreshCw/> Retry</Button>
            </HStack>
        );
    }

    if (!item) {
        const factoryLink = factoryDenomRewardLink(asset.denom, getEcosystemApps());
        return (
            <Text fontSize="sm" color="fg.muted" data-testid="token-denom-reward-empty">
                No denom reward for {asset.ticker} yet.
                {factoryLink && (
                    <>
                        {' '}Token teams can create one in the{' '}
                        <Link href={factoryLink} target="_blank" rel="noopener noreferrer" colorPalette="green" color="colorPalette.600">
                            Factory <LuExternalLink size={12}/>
                        </Link>
                    </>
                )}
            </Text>
        );
    }

    return (
        <>
            <DenomRewardCard asset={asset} item={item} prizeDenoms={prizeDenoms} hasWallet={Boolean(address)} onAction={setAction}/>
            {action && (
                <ModalShell title={actionTitle(action, asset.ticker, Boolean(item.position))} onClose={() => setAction(undefined)}>
                    {action === 'stake' && <DenomRewardStakePanel item={item} onDone={done}/>}
                    {action === 'claim' && <DenomRewardClaimPanel item={item} onDone={done}/>}
                    {action === 'exit' && <DenomRewardExitPanel item={item} onDone={done}/>}
                </ModalShell>
            )}
        </>
    );
};
