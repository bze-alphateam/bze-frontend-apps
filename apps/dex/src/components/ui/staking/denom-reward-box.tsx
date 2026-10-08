import {Badge, Box, Card, Heading, HStack, SimpleGrid, Stack, Text, VStack} from "@chakra-ui/react";
import {LuClock, LuCoins, LuGift, LuLock, LuTrendingUp} from "react-icons/lu";
import React, {type ReactNode} from "react";
import BigNumber from "bignumber.js";
import {
    claimableCoins,
    DenomRewardCoinLine,
    DenomRewardHolderItem,
    estimateDailyShare,
    formatUnlockCountdown,
    prettyAmount,
    shortNumberFormat,
    TokenLogo,
    uAmountToBigNumberAmount,
    useAsset,
    useBalance,
    useEpochs,
} from "@bze/bze-ui-kit";
import {RewardStakingAlert, TYPE_UNLOCK} from "@/components/ui/staking/rewards-staking-alerts";
import {RewardsStakingButton} from "@/components/ui/staking/rewards-staking-buttons";

export type DenomRewardAction = 'stake' | 'claim' | 'exit';

/** Why each action is unavailable, or '' when it can be opened. */
export function denomRewardActionBlockers({item, hasWallet, balance}: {
    item: DenomRewardHolderItem;
    hasWallet: boolean;
    /** Wallet balance of the staking denom, base units. */
    balance: BigNumber;
}): Record<DenomRewardAction, string> {
    if (!hasWallet) {
        const reason = 'Connect your wallet first.';
        return {stake: reason, claim: reason, exit: reason};
    }

    const {position, denomReward} = item;
    let stake = '';
    if (!balance.gt(0)) {
        stake = 'You hold none of this token.';
    } else if (!position && balance.lt(denomReward.min_stake)) {
        stake = 'Your balance is below the minimum stake.';
    }

    return {
        stake,
        claim: !position ? 'You have no stake here.' : claimableCoins(position).length === 0 ? 'Nothing to claim yet.' : '',
        exit: !position ? 'You have no stake here.' : '',
    };
}

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

interface DenomRewardBoxProps {
    item: DenomRewardHolderItem;
    hasWallet: boolean;
    onAction: (action: DenomRewardAction) => void;
}

/** One denom reward on the staking page: what it pays, my position, and the holder actions. */
export const DenomRewardBox = ({item, hasWallet, onAction}: DenomRewardBoxProps) => {
    const {denomReward, position, dailyPrizes, unlocks} = item;
    const denom = denomReward.staking_denom;
    const {asset} = useAsset(denom);
    const {balance} = useBalance(denom);
    const {hourEpochInfo} = useEpochs();
    const decimals = asset?.decimals ?? 0;
    const ticker = asset?.ticker ?? denom;
    const fmt = (amount: string) => `${shortNumberFormat(uAmountToBigNumberAmount(amount, decimals))} ${ticker}`;

    const blockers = denomRewardActionBlockers({item, hasWallet, balance: balance.amount});
    const pending = claimableCoins(position);
    const isPaying = (dailyPrizes?.length ?? 0) > 0;
    const currentHour = hourEpochInfo ? Number(hourEpochInfo.current_epoch) : undefined;
    // "no stake here" is obvious without a position, so only the stake reason (and, with a
    // position, the claim reason) is spelled out under the buttons
    const reasons = Array.from(new Set([blockers.stake, position ? blockers.claim : ''].filter(Boolean)));

    return (
        <Card.Root
            borderWidth={position ? "2px" : "1px"}
            borderColor={position ? "blue.500" : (unlocks.length > 0 ? "orange.500" : "border")}
            bgGradient="to-br"
            gradientFrom={position ? "blue.500/5" : "blue.400/5"}
            gradientTo={position ? "blue.600/5" : "cyan.500/5"}
            shadow="sm"
            data-testid="denom-reward-box"
        >
            <Card.Header pb="0">
                <HStack gap="3" flexWrap="wrap">
                    <Box p="2" bg="bg.subtle" borderRadius="lg" borderWidth="1px" borderColor="border" flexShrink="0">
                        <TokenLogo src={asset?.logo} symbol={ticker} size="8"/>
                    </Box>
                    <VStack align="start" gap="0.5" minW="0">
                        <Heading size="md" lineHeight="1.2">Stake {ticker}, earn prizes</Heading>
                        <HStack flexWrap="wrap" gap="1.5">
                            <Badge colorPalette="purple" variant="subtle" size="sm">Denom reward</Badge>
                            {dailyPrizes === undefined ? null : isPaying
                                ? <Badge colorPalette="green" variant="subtle" size="sm">Paying daily</Badge>
                                : <Badge colorPalette="gray" variant="subtle" size="sm">No daily schedule — airdrops only</Badge>}
                            {asset?.verified && <Badge colorPalette="green" variant="outline" size="sm">Verified</Badge>}
                        </HStack>
                    </VStack>
                </HStack>
            </Card.Header>

            <Card.Body>
                <VStack align="stretch" gap="2">
                    {position && (
                        <SimpleGrid columns={{base: 1, md: 2}} gap="2">
                            <Box p="3" borderRadius="md" borderWidth="1px" borderColor="blue.500/30" bg="blue.500/10">
                                <Text fontSize="sm" fontWeight="semibold" color="blue.600" textTransform="uppercase">Your stake</Text>
                                <Text fontWeight="bold" fontSize="lg" data-testid="denom-reward-my-stake">
                                    {prettyAmount(uAmountToBigNumberAmount(position.participant.amount, decimals))} {ticker}
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
                                {pending.length > 0
                                    ? pending.map(c => <DenomRewardCoinLine key={c.denom} coin={c}/>)
                                    : <Text color="fg.muted" fontSize="sm">Nothing to claim yet.</Text>}
                            </Box>
                        </SimpleGrid>
                    )}

                    {unlocks.map(u => (
                        <RewardStakingAlert
                            key={u.unlockEpoch}
                            type={TYPE_UNLOCK}
                            text={`${prettyAmount(uAmountToBigNumberAmount(u.amount, decimals))} ${ticker} unlocking ${currentHour !== undefined ? formatUnlockCountdown(u.unlockEpoch, currentHour) : 'soon'}`}
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

                    <Stack direction={{base: 'column', sm: 'row'}} gap="2" pt="1">
                        <RewardsStakingButton buttonType="staking" disabled={blockers.stake !== ''} onClick={() => onAction('stake')}>
                            <Text>{position ? 'Add' : 'Stake'}</Text>
                        </RewardsStakingButton>
                        <RewardsStakingButton buttonType="rewards" disabled={blockers.claim !== ''} onClick={() => onAction('claim')}>
                            <Text>Claim</Text>
                        </RewardsStakingButton>
                        <RewardsStakingButton buttonType="unlock" disabled={blockers.exit !== ''} onClick={() => onAction('exit')}>
                            <Text>Exit</Text>
                        </RewardsStakingButton>
                    </Stack>
                    {reasons.length > 0 && (
                        <Text fontSize="xs" color="fg.muted" data-testid="denom-reward-blockers">{reasons.join(' ')}</Text>
                    )}
                </VStack>
            </Card.Body>
        </Card.Root>
    );
};
