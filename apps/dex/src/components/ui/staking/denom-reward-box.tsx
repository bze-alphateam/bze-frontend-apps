import {Badge, chakra, Flex, SimpleGrid, Stack} from "@chakra-ui/react";
import {LuGift} from "react-icons/lu";
import {
    claimableCoins,
    DenomRewardAction,
    denomRewardActionBlockers,
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
    hgVariant,
} from "@bze/bze-ui-kit";
import {RewardStakingAlert, TYPE_UNLOCK} from "@/components/ui/staking/rewards-staking-alerts";
import {RewardsStakingButton} from "@/components/ui/staking/rewards-staking-buttons";
import {KindTag, MiniStat, MiniStats, StakingCard, StakingCardHeader, VerifiedPill} from "@/components/ui/staking/staking-card-parts";

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
        <StakingCard
            state={position ? 'staked' : unlocks.length > 0 ? 'unlocking' : 'default'}
            data-testid="denom-reward-box"
        >
            <StakingCardHeader
                tile={<TokenLogo src={asset?.logo} symbol={ticker} size="8"/>}
                title={`Stake ${ticker}, earn prizes`}
                tags={(
                    <>
                        <KindTag>Compounded reward</KindTag>
                        {dailyPrizes === undefined ? null : isPaying
                            ? <Badge variant={hgVariant('success')} borderRadius="full" px="8px">Paying daily</Badge>
                            : <Badge variant={hgVariant('neutral')} borderRadius="full" px="8px">No daily schedule — airdrops only</Badge>}
                        {asset?.verified && <VerifiedPill/>}
                    </>
                )}
            />

            {position && (
                <SimpleGrid columns={{base: 1, md: 2}} gap="10px">
                    <Flex direction="column" gap="4px" px="12px" py="12px" borderRadius="12px" bg="app.subtle" borderWidth="1px" borderColor="app.border">
                        <chakra.span fontSize="11px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase" color="hg.link">Your stake</chakra.span>
                        <chakra.strong fontSize="17px" data-testid="denom-reward-my-stake">
                            {prettyAmount(uAmountToBigNumberAmount(position.participant.amount, decimals))} {ticker}
                        </chakra.strong>
                        {dailyPrizes?.map(prize => {
                            const share = estimateDailyShare(position.participant.amount, denomReward.staked_amount, prize.amount);
                            return share.gt(0) ? (
                                <DenomRewardCoinLine key={prize.denom} coin={{denom: prize.denom, amount: share.toFixed(0)}} suffix=" / day (est.)"/>
                            ) : null;
                        })}
                    </Flex>
                    <Flex direction="column" gap="4px" px="12px" py="12px" borderRadius="12px" bg="hg.inset" borderWidth="1px" borderColor="hg.hairline">
                        <Flex align="center" gap="6px" color="hg.text.secondary">
                            <LuGift size={14} aria-hidden="true"/>
                            <chakra.span fontSize="11px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase">Pending prizes</chakra.span>
                        </Flex>
                        {pending.length > 0
                            ? pending.map(c => <DenomRewardCoinLine key={c.denom} coin={c}/>)
                            : <chakra.span color="fg.muted" fontSize="14px">Nothing to claim yet.</chakra.span>}
                    </Flex>
                </SimpleGrid>
            )}

            {unlocks.map(u => (
                <RewardStakingAlert
                    key={u.unlockEpoch}
                    type={TYPE_UNLOCK}
                    text={`${prettyAmount(uAmountToBigNumberAmount(u.amount, decimals))} ${ticker} unlocking ${currentHour !== undefined ? formatUnlockCountdown(u.unlockEpoch, currentHour) : 'soon'}`}
                />
            ))}

            <MiniStats>
                <MiniStat label="Pays per day">
                    {dailyPrizes === undefined
                        ? '—'
                        : isPaying
                            ? dailyPrizes.map(p => <DenomRewardCoinLine key={p.denom} coin={p}/>)
                            : 'Nothing scheduled'}
                </MiniStat>
                <MiniStat label="Total staked">{fmt(denomReward.staked_amount)}</MiniStat>
                <MiniStat label="Unlock">
                    {denomReward.lock > 0 ? `${denomReward.lock} day${denomReward.lock === 1 ? '' : 's'}` : 'Instant'}
                </MiniStat>
                <MiniStat label="Minimum">{fmt(denomReward.min_stake)}</MiniStat>
            </MiniStats>

            <Stack direction={{base: 'column', sm: 'row'}} gap="10px">
                <RewardsStakingButton buttonType="staking" size="lg" disabled={blockers.stake !== ''} onClick={() => onAction('stake')}>
                    {position ? 'Add' : 'Stake'}
                </RewardsStakingButton>
                <RewardsStakingButton buttonType="rewards" size="lg" disabled={blockers.claim !== ''} onClick={() => onAction('claim')}>
                    Claim
                </RewardsStakingButton>
                <RewardsStakingButton buttonType="unlock" size="lg" disabled={blockers.exit !== ''} onClick={() => onAction('exit')}>
                    Exit
                </RewardsStakingButton>
            </Stack>
            {reasons.length > 0 && (
                <chakra.span fontSize="12px" color="hg.text.faint" data-testid="denom-reward-blockers">{reasons.join(' ')}</chakra.span>
            )}
        </StakingCard>
    );
};
