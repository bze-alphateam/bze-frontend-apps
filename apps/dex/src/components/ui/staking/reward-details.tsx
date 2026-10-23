import {Box, Button, chakra, Field, Flex, Grid, IconButton, Input} from "@chakra-ui/react";
import {LuGift, LuLink, LuLock, LuLockOpen} from "react-icons/lu";
import {type ReactNode, useCallback, useMemo, useState} from "react";
import BigNumber from "bignumber.js";
import {
    amountToBigNumberUAmount, FeaturedCard, formatUnlockCountdown, formatUsdAmount, HgCard, hgVariant, MaxInputGroup,
    prettyAmount, sanitizeNumberInput, shortNumberFormat, StatusPill, uAmountToBigNumberAmount, useAssets,
    useAssetsValue, useEpochs, useMaxSpendable, useToast,
} from "@bze/bze-ui-kit";
import type {DenomRewardCoin} from "@bze/bze-ui-kit";
import {leaveButtonStyle, softButtonStyle} from "@/components/ui/staking/rewards-staking-buttons";
import {VerifiedPill} from "@/components/ui/staking/staking-card-parts";
import {formatApr, RewardKindTag, RewardLogo, statusText, useCoinText} from "@/components/ui/staking/staking-table";
import type {RowDialogView} from "@/components/ui/staking/row-dialog";
import {rewardPagePath} from "@/hooks/useNavigation";
import {estimateRewardIncome, type RewardIncomeEstimate} from "@/lib/reward-estimate";
import {formatLockPeriod, type StakingRow, type StakingRowStatus} from "@/lib/staking-list";

// The reward details page (Details 2 on the design canvas): the reward's facts and prizes on the
// left, and a rail with the viewer's position, the income estimate and the actions on the right.
// A simple reward pays one prize for a set number of days; a compounded one pays any number of
// prizes for as long as they are scheduled, so every part reads the row and says only what it has.

const PENDING_SHOWN = 5;
const ESTIMATE_TOKENS_SHOWN = 4;

const bn = (v: BigNumber.Value | undefined) => new BigNumber(v ?? 0);

/** "$0.033", "$12.40", "$418K". */
export const formatUsd = (v: BigNumber) => `$${v.gte(1_000) ? shortNumberFormat(v) : formatUsdAmount(v.decimalPlaces(6, BigNumber.ROUND_DOWN))}`;

const formatPct = (pct: number) => pct > 0 && pct < 0.01 ? '<0.01%' : `${pct.toFixed(2)}%`;

const STATUS_TONE: Record<StakingRowStatus, 'success' | 'warning' | 'info' | 'neutral'> = {
    running: 'success', paying: 'success', waiting: 'warning', airdrops: 'info', finished: 'neutral', unknown: 'neutral',
};

const SectionTitle = ({children}: { children: ReactNode }) => (
    <chakra.h2 m="0" fontSize="11px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase" color="hg.text.faint">{children}</chakra.h2>
);

const Faint = ({children}: { children: ReactNode }) => (
    <chakra.span fontSize="12px" color="hg.text.faint">{children}</chakra.span>
);

/** The USD value of each coin, and their total; coins with no price add nothing. */
const useCoinsUsd = (coins: DenomRewardCoin[] | undefined) => {
    const {denomUsdValue} = useAssetsValue();
    return useMemo(() => {
        const values = (coins ?? []).map(c => denomUsdValue(c.denom, bn(c.amount)));
        return {
            values,
            total: values.reduce((s, v) => s.plus(v), bn(0)),
            priced: values.filter(v => v.gt(0)).length,
        };
    }, [coins, denomUsdValue]);
};

const rewardSummary = (row: StakingRow, ticker: (d: string) => string, pretty: (c: DenomRewardCoin) => string) => {
    const staking = ticker(row.stakingDenom);
    if (row.kind === 'simple') {
        const prize = row.daily?.[0];
        const days = row.progress?.duration ?? 0;
        const base = `Stake ${staking} and earn ${prize ? ticker(prize.denom) : 'a prize'}. Every day ${prize ? pretty(prize) : 'the prize'} is split between everyone staking, by stake, for ${days} day${days === 1 ? '' : 's'}.`;
        return row.status === 'finished' ? `${base} It has paid all of them and pays nothing more.` : base;
    }
    return `Anyone can add prizes to the ${staking} pool. Every day it pays its scheduled prizes to everyone staking ${staking}, split by stake. Airdrops land the same way.`;
};

/** Logo, name, tags and the copy-link button, with what the reward does under them. */
export const RewardHeader = ({row}: { row: StakingRow }) => {
    const {ticker, pretty} = useCoinText();
    const {toast} = useToast();

    const copyLink = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(`${window.location.origin}${rewardPagePath(row.id)}`);
            toast.success('Link copied', `Link to ${row.name} copied to clipboard`);
        } catch { /* clipboard unavailable: ignore */ }
    }, [row.id, row.name, toast]);

    return (
        <FeaturedCard as="section" aria-label={row.name} borderRadius="21px" px={{base: '18px', md: '24px'}} py="22px">
            <Flex direction="column" gap="12px">
                <Flex align="center" gap="16px">
                    <Box flex="none"><RewardLogo denom={row.stakingDenom} size="12"/></Box>
                    <Flex direction="column" gap="6px" flex="1" minW="0">
                        <chakra.h1 m="0" fontSize="26px" fontWeight="800" letterSpacing="-0.01em" truncate>{row.name}</chakra.h1>
                        <Flex align="center" gap="8px" wrap="wrap">
                            <RewardKindTag kind={row.kind}/>
                            {statusText(row) && <StatusPill tone={STATUS_TONE[row.status]}>{statusText(row)}</StatusPill>}
                            {row.verified && <VerifiedPill/>}
                        </Flex>
                    </Flex>
                    <IconButton aria-label="Copy link to this reward" size="lg" variant={hgVariant('secondary')} onClick={copyLink} flex="none">
                        <LuLink/>
                    </IconButton>
                </Flex>
                <chakra.p m="0" fontSize="14px" lineHeight="1.55" color="fg.muted" maxW="720px">{rewardSummary(row, ticker, pretty)}</chakra.p>
            </Flex>
        </FeaturedCard>
    );
};

const Fact = ({label, children, sub}: { label: string; children: ReactNode; sub?: ReactNode }) => (
    <Flex direction="column" gap="3px" px="18px" py="14px" borderTopWidth="1px" borderColor="hg.divider" minW="0">
        <Faint>{label}</Faint>
        <chakra.strong fontSize="16px" truncate>{children}</chakra.strong>
        {sub && <Faint>{sub}</Faint>}
    </Flex>
);

const aprNote = (row: StakingRow) => {
    if (row.apr !== undefined) return 'At today’s prices and pool size';
    if (row.status === 'finished') return 'The reward has finished';
    if (row.kind === 'compounded') return 'Needs every prize priced';
    if (bn(row.totalStaked).isZero()) return 'Nobody is staking yet';
    return 'Needs a price for both tokens';
};

/** Total staked, paid per day, APR, unlock, minimum and how long it runs. */
export const RewardFacts = ({row}: { row: StakingRow }) => {
    const {short, pretty} = useCoinText();
    const {denomUsdValue} = useAssetsValue();
    const daily = useCoinsUsd(row.daily);
    const prizes = row.daily?.length ?? 0;

    let paid: ReactNode;
    let paidSub: ReactNode;
    if (row.daily === undefined) {
        paid = '—';
    } else if (prizes === 0) {
        paid = 'Nothing scheduled';
        paidSub = 'Airdrops still land here';
    } else if (row.kind === 'simple') {
        paid = pretty(row.daily[0]);
        paidSub = daily.total.gt(0) ? `≈ ${formatUsd(daily.total)}` : 'No price yet';
    } else {
        paid = daily.total.gt(0) ? `≈ ${formatUsd(daily.total)}` : `${prizes} token${prizes === 1 ? '' : 's'}`;
        paidSub = daily.priced === prizes ? `${prizes} prize token${prizes === 1 ? '' : 's'}` : `${daily.priced} of ${prizes} prizes priced`;
    }

    const staked = denomUsdValue(row.stakingDenom, bn(row.totalStaked));
    const left = row.progress ? Math.max(0, row.progress.duration - row.progress.done) : 0;
    const pct = row.progress && row.progress.duration > 0 ? Math.min(100, (row.progress.done / row.progress.duration) * 100) : 0;

    return (
        <HgCard as="section" aria-label="Reward" p="0" overflow="hidden">
            <Box px="18px" pt="16px" pb="12px"><SectionTitle>Reward</SectionTitle></Box>
            <Grid templateColumns={{base: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))'}} data-testid="reward-facts">
                <Fact label="Total staked" sub={staked.gt(0) ? `≈ ${formatUsd(staked)}` : undefined}>{short({denom: row.stakingDenom, amount: row.totalStaked})}</Fact>
                <Fact label="Paid per day" sub={paidSub}>{paid}</Fact>
                <Fact label="APR" sub={aprNote(row)}>
                    <chakra.span color={row.apr === undefined ? 'hg.text.faint' : 'hg.success.text'}>{formatApr(row.apr)}</chakra.span>
                </Fact>
                <Fact label="Unlock" sub={row.lockDays > 0 ? `After you ${row.kind === 'simple' ? 'unstake' : 'exit'}` : 'Exit any time'}>
                    {formatLockPeriod(row.lockDays) ?? 'Instant'}
                </Fact>
                <Fact label="Minimum" sub={row.kind === 'compounded' && bn(row.minStake).gt(0) ? 'For your whole position' : undefined}>
                    {bn(row.minStake).gt(0) ? short({denom: row.stakingDenom, amount: row.minStake}) : 'None'}
                </Fact>
                {row.progress ? (
                    <Fact label="Runs" sub={
                        <Flex direction="column" gap="6px" as="span">
                            <Box as="span" display="block" h="4px" borderRadius="2px" bg="hg.inset" overflow="hidden" role="progressbar" aria-label="Days paid out" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
                                <Box as="span" display="block" h="full" w={`${pct}%`} bgImage="app"/>
                            </Box>
                            {row.status === 'finished' ? 'Finished' : `${left} day${left === 1 ? '' : 's'} left`}
                        </Flex>
                    }>
                        Day {row.progress.done} of {row.progress.duration}
                    </Fact>
                ) : (
                    <Fact label="Runs" sub="While prizes are scheduled">Ongoing</Fact>
                )}
            </Grid>
        </HgCard>
    );
};

const CoinLine = ({coin, usd, suffix}: { coin: DenomRewardCoin; usd?: BigNumber; suffix?: string }) => {
    const {denomTicker, denomDecimals} = useAssets();
    return (
        <Flex align="center" gap="10px" minW="0" data-testid="reward-coin">
            <Box flex="none"><RewardLogo denom={coin.denom} size="6"/></Box>
            <chakra.span fontSize="14px" fontWeight="600" minW="0" truncate>{denomTicker(coin.denom)}</chakra.span>
            <chakra.span ml="auto" fontSize="13px" fontFamily="mono" whiteSpace="nowrap">{shortNumberFormat(uAmountToBigNumberAmount(coin.amount, denomDecimals(coin.denom)))}{suffix}</chakra.span>
            <chakra.span w="64px" flex="none" textAlign="right" fontSize="12px" color="hg.text.faint">{usd && usd.gt(0) ? formatUsd(usd) : '—'}</chakra.span>
        </Flex>
    );
};

/** What the pool pays every day: one prize for a simple reward, any number for a compounded one. */
export const RewardPrizes = ({row}: { row: StakingRow }) => {
    const {values} = useCoinsUsd(row.daily);
    const sorted = useMemo(() => (row.daily ?? [])
        .map((coin, i) => ({coin, usd: values[i]}))
        .sort((a, b) => (b.usd.comparedTo(a.usd) ?? 0)), [row.daily, values]);
    const count = sorted.length;

    return (
        <HgCard as="section" aria-label="Prizes" p="0" overflow="hidden">
            <Box px="18px" pt="16px" pb="12px">
                <SectionTitle>{row.kind === 'simple' ? 'Prize' : `Prizes · ${count} token${count === 1 ? '' : 's'}`}</SectionTitle>
            </Box>
            {row.daily === undefined ? (
                <chakra.p m="0" px="18px" pb="16px" fontSize="14px" color="fg.muted">Couldn&apos;t load the prizes. Try again in a moment.</chakra.p>
            ) : count === 0 ? (
                <chakra.p m="0" px="18px" pb="16px" fontSize="14px" color="fg.muted">
                    No prizes are scheduled right now. Anyone can add some, and airdrops still land here.
                </chakra.p>
            ) : (
                <Grid templateColumns={{base: '1fr', md: count > 1 ? 'repeat(2, minmax(0, 1fr))' : '1fr'}} columnGap="24px" borderTopWidth="1px" borderColor="hg.divider" px="18px" py="6px">
                    {sorted.map(({coin, usd}) => (
                        <Box key={coin.denom} py="8px"><CoinLine coin={coin} usd={usd} suffix=" / day"/></Box>
                    ))}
                </Grid>
            )}
        </HgCard>
    );
};

const RailCard = ({label, children, testId}: { label: string; children: ReactNode; testId?: string }) => (
    <HgCard as="section" aria-label={label} p="16px" data-testid={testId}>
        <Flex direction="column" gap="12px">{children}</Flex>
    </HgCard>
);

const EstimateRow = ({label, value}: { label: string; value: string }) => (
    <Flex justify="space-between" gap="12px" fontSize="14px">
        <chakra.span color="fg.muted">{label}</chakra.span>
        <chakra.strong color="hg.success.text">{value}</chakra.strong>
    </Flex>
);

/** The green box: what the typed amount would earn, in USD and by token. */
export const IncomeEstimate = ({row, estimate, amountLabel}: { row: StakingRow; estimate: RewardIncomeEstimate; amountLabel: string }) => {
    const shown = estimate.tokens.slice(0, ESTIMATE_TOKENS_SHOWN);
    const more = estimate.tokens.length - shown.length;
    const priced = estimate.usdPerDay.gt(0);
    const {daysLeft} = estimate;

    return (
        <Flex direction="column" gap="10px" px="14px" py="12px" borderRadius="12px" bg="hg.success/8" borderWidth="1px" borderColor="hg.success/30" data-testid="income-estimate">
            <chakra.span fontSize="11px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase" color="hg.success.text">
                Estimated income for +{amountLabel}
            </chakra.span>
            {priced ? (
                <Flex direction="column" gap="4px">
                    <EstimateRow label="Per day" value={`≈ ${formatUsd(estimate.usdPerDay)}`}/>
                    {(daysLeft === undefined || daysLeft >= 30) && <EstimateRow label="Per 30 days" value={`≈ ${formatUsd(estimate.usdPer30Days)}`}/>}
                    <EstimateRow
                        label={daysLeft !== undefined && daysLeft < 365 ? `Until it ends (${daysLeft} day${daysLeft === 1 ? '' : 's'})` : 'Per year'}
                        value={`≈ ${formatUsd(estimate.usdPerYear)}`}
                    />
                </Flex>
            ) : (
                <chakra.span fontSize="13px" color="fg.muted">No price for {row.kind === 'simple' ? 'the prize' : 'these prizes'} yet, so no USD figure.</chakra.span>
            )}
            {shown.length > 0 && (
                <Flex direction="column" gap="6px">
                    <Faint>Per day{row.kind === 'compounded' ? ', by token' : ''}</Faint>
                    {shown.map(t => <CoinLine key={t.denom} coin={t} usd={t.usd}/>)}
                    {more > 0 && <Faint>+ {more} more token{more === 1 ? '' : 's'}</Faint>}
                </Flex>
            )}
            <Flex direction="column" gap="2px" fontSize="13px" color="fg.muted">
                <span>Your share after: <chakra.strong color="fg">{formatPct(estimate.shareAfterPct)}</chakra.strong></span>
                {row.position && estimate.totalUsdPerDay.gt(0) && (
                    <span>Total with your stake: <chakra.strong color="fg">≈ {formatUsd(estimate.totalUsdPerDay)} / day</chakra.strong></span>
                )}
            </Flex>
            <Faint>
                Estimate = today&apos;s daily {row.kind === 'simple' ? 'prize' : 'prizes'} × your share of the pool after this stake. It falls as others stake
                {estimate.unpriced > 0 ? `, and leaves out the ${estimate.unpriced} prize${estimate.unpriced === 1 ? '' : 's'} with no price (they still pay you).` : '.'}
            </Faint>
        </Flex>
    );
};

/** Amount, Max, the estimate and the button that opens the stake step with the amount filled in. */
const StakeCard = ({row, hasWallet, onAction}: { row: StakingRow; hasWallet: boolean; onAction: (view: RowDialogView, amount?: string) => void }) => {
    const [input, setInput] = useState('');
    const {denomDecimals, denomTicker} = useAssets();
    const {denomUsdValue} = useAssetsValue();
    const maxSpendable = useMaxSpendable(row.stakingDenom, row.kind === 'simple' ? 'join-staking' : 'join-denom-reward');
    const decimals = denomDecimals(row.stakingDenom);
    const ticker = denomTicker(row.stakingDenom);
    const isTopUp = bn(row.position?.stake).gt(0);

    const uAmount = useMemo(() => (input ? amountToBigNumberUAmount(input, decimals) : undefined), [input, decimals]);
    const estimate = useMemo(
        () => (uAmount ? estimateRewardIncome(row, uAmount, (d, a) => denomUsdValue(d, bn(a))) : undefined),
        [row, uAmount, denomUsdValue],
    );

    if (row.status === 'finished') {
        return (
            <RailCard label="Stake">
                <chakra.span fontSize="14px" color="fg.muted">This reward has finished and takes no new stakes.</chakra.span>
            </RailCard>
        );
    }

    const balance = `${prettyAmount(uAmountToBigNumberAmount(maxSpendable.balance, decimals))} ${ticker}`;
    const minimum = bn(row.minStake).gt(0) ? `${prettyAmount(uAmountToBigNumberAmount(row.minStake, decimals))} ${ticker}` : '';

    return (
        <RailCard label={isTopUp ? 'Add to your stake' : 'Stake'} testId="stake-card">
            <Field.Root>
                <Field.Label fontSize="13px" fontWeight="600" color="fg.muted">{isTopUp ? 'Amount to add' : 'Amount to stake'}</Field.Label>
                <MaxInputGroup w="full" onMax={() => setInput(maxSpendable.inputValue)} maxDisabled={!maxSpendable.amount.gt(0)}>
                    <Input
                        autoComplete="off"
                        inputMode="decimal"
                        placeholder={`0 ${ticker}`}
                        value={input}
                        onChange={(e) => setInput(sanitizeNumberInput(e.target.value))}
                        h="44px"
                        bg="hg.inset"
                        fontFamily="mono"
                        aria-label={isTopUp ? 'Amount to add' : 'Amount to stake'}
                    />
                </MaxInputGroup>
                <Field.HelperText fontSize="12px" color="hg.text.faint">
                    {hasWallet ? `Balance ${balance}` : 'Connect a wallet to see your balance'}{minimum && ` · minimum ${minimum}`}
                </Field.HelperText>
            </Field.Root>

            {estimate && uAmount && (
                <IncomeEstimate row={row} estimate={estimate} amountLabel={`${prettyAmount(uAmountToBigNumberAmount(uAmount, decimals))} ${ticker}`}/>
            )}
            {uAmount && !estimate && row.daily?.length === 0 && (
                <chakra.span fontSize="13px" color="fg.muted">No prizes are scheduled, so there is no income to estimate. Airdrops still pay stakers.</chakra.span>
            )}

            <Button size="lg" w="full" variant={hgVariant('primary')} gap="8px" disabled={!hasWallet} onClick={() => onAction('stake', input || undefined)}>
                <LuLock size={16} aria-hidden="true"/>{isTopUp ? 'Add stake' : 'Stake'}
            </Button>
            {!hasWallet && <chakra.span fontSize="13px" color="fg.muted" textAlign="center">Connect your wallet to stake.</chakra.span>}
        </RailCard>
    );
};

/** The viewer's stake, share and daily income, with Unstake / Exit. */
const PositionCard = ({row, onAction}: { row: StakingRow; onAction: (view: RowDialogView) => void }) => {
    const {pretty, short} = useCoinText();
    const position = row.position!;
    const daily = useCoinsUsd(position.daily);
    const hasStake = bn(position.stake).gt(0);
    const income = daily.total.gt(0) ? `≈ ${formatUsd(daily.total)} / day` : position.daily[0] ? `≈ ${short(position.daily[0])} / day` : '';

    return (
        <RailCard label="Your stake" testId="position-card">
            <Flex justify="space-between" align="flex-start" gap="12px">
                <Flex direction="column" gap="2px" minW="0">
                    <Faint>Your stake</Faint>
                    <chakra.strong fontSize="20px" color="hg.link" truncate>{pretty({denom: row.stakingDenom, amount: position.stake})}</chakra.strong>
                    {hasStake && <chakra.span fontSize="13px" color="hg.success.text">{formatPct(position.sharePct)}{income && ` · ${income}`}</chakra.span>}
                </Flex>
                <Button size="sm" {...leaveButtonStyle} gap="6px" flex="none" disabled={!hasStake} onClick={() => onAction('unstake')}>
                    <Box as="span" color="hg.warning.text"><LuLockOpen size={14} aria-hidden="true"/></Box>
                    {row.kind === 'simple' ? 'Unstake' : 'Exit'}
                </Button>
            </Flex>
        </RailCard>
    );
};

/** What a claim pays now, with Claim. */
const PendingCard = ({row, onAction}: { row: StakingRow; onAction: (view: RowDialogView) => void }) => {
    const pending = row.position?.pending ?? [];
    const {values, total} = useCoinsUsd(pending);
    const shown = pending.slice(0, PENDING_SHOWN);
    const more = pending.length - shown.length;

    return (
        <RailCard label="Pending" testId="pending-card">
            <Flex justify="space-between" align="center" gap="12px">
                <SectionTitle>Pending{pending.length > 1 ? ` · ${pending.length} tokens` : ''}</SectionTitle>
                {total.gt(0) && <chakra.span fontSize="13px" fontWeight="600">≈ {formatUsd(total)}</chakra.span>}
            </Flex>
            {pending.length === 0
                ? <chakra.span fontSize="14px" color="fg.muted">Nothing to claim yet.</chakra.span>
                : shown.map((c, i) => <CoinLine key={c.denom} coin={c} usd={values[i]}/>)}
            {more > 0 && <Faint>+ {more} more</Faint>}
            <Button size="md" {...softButtonStyle} gap="6px" disabled={!row.position?.claimable} onClick={() => onAction('claim')}>
                <LuGift size={14} aria-hidden="true"/>{pending.length > 1 ? `Claim all ${pending.length}` : 'Claim'}
            </Button>
        </RailCard>
    );
};

const UnlockingCard = ({row}: { row: StakingRow }) => {
    const {pretty} = useCoinText();
    const {hourEpochInfo} = useEpochs();
    const unlocks = row.position?.unlocks ?? [];
    const currentHour = hourEpochInfo ? Number(hourEpochInfo.current_epoch) : undefined;

    return (
        <RailCard label="Unlocking" testId="unlocking-card">
            <SectionTitle>Unlocking</SectionTitle>
            {unlocks.length === 0 ? (
                <chakra.span fontSize="14px" color="fg.muted">
                    Nothing unlocking.{row.lockDays === 0 ? ` ${row.kind === 'simple' ? 'Unstaking' : 'Exiting'} here is instant.` : ''}
                </chakra.span>
            ) : unlocks.map((u, i) => (
                <Flex key={`${u.unlockEpoch ?? i}`} justify="space-between" gap="12px" fontSize="14px">
                    <chakra.span fontWeight="600" color="hg.warning.text">{pretty({denom: row.stakingDenom, amount: u.amount})}</chakra.span>
                    <chakra.span color="fg.muted">{u.unlockEpoch !== undefined && currentHour !== undefined ? formatUnlockCountdown(u.unlockEpoch, currentHour) : 'soon'}</chakra.span>
                </Flex>
            ))}
        </RailCard>
    );
};

/** The right-hand rail: the viewer's position, the stake form with its estimate, pending and unlocks. */
export const RewardRail = ({row, hasWallet, onAction}: { row: StakingRow; hasWallet: boolean; onAction: (view: RowDialogView, amount?: string) => void }) => (
    <Flex direction="column" gap="14px">
        {row.position && <PositionCard row={row} onAction={onAction}/>}
        <StakeCard row={row} hasWallet={hasWallet} onAction={onAction}/>
        {row.position && <PendingCard row={row} onAction={onAction}/>}
        {row.position && <UnlockingCard row={row}/>}
    </Flex>
);
