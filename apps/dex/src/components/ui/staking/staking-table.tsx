import {Box, Button, chakra, Flex, Input, InputGroup} from "@chakra-ui/react";
import {LuCheck, LuChevronLeft, LuChevronRight, LuGift, LuSearch} from "react-icons/lu";
import {type ReactNode, useMemo, useState} from "react";
import BigNumber from "bignumber.js";
import {
    formatUnlockCountdown, getStakingApp, hgVariant, HgCard, LPTokenLogo, prettyAmount, Shimmer, shortNumberFormat,
    TokenLogo, uAmountToBigNumberAmount, useAsset, useAssets, useAssetsValue, useEpochs, useLiquidityPools,
} from "@bze/bze-ui-kit";
import type {DenomRewardCoin} from "@bze/bze-ui-kit";
import {softButtonStyle} from "@/components/ui/staking/rewards-staking-buttons";
import {VerifiedPill} from "@/components/ui/staking/staking-card-parts";
import {
    pageButtons, type RewardKind, type StakingFilters, type StakingKindFilter, type StakingPage, type StakingRow, sumCoins,
} from "@/lib/staking-list";

// The compact /staking tables: the viewer's positions and the explore list. One row per reward,
// its facts compacted under the name; on phones each row folds into a small two-column card.

const POSITIONS_COLUMNS = 'minmax(0, 2.4fr) minmax(0, 0.7fr) minmax(0, 1.3fr) minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1fr) 110px';
const EXPLORE_COLUMNS = 'minmax(0, 2.4fr) minmax(0, 1fr) minmax(0, 0.7fr) minmax(0, 1.1fr) minmax(0, 1fr) minmax(0, 1fr) 110px';

const KIND_LABEL: Record<RewardKind, string> = {native: 'Native', simple: 'Simple', compounded: 'Compounded'};

/** Native = the DEX gradient, Simple = a neutral outline, Compounded = an info-blue tint. */
export const RewardKindTag = ({kind}: { kind: RewardKind }) => (
    <chakra.span
        flex="none"
        fontFamily="mono"
        fontSize="11px"
        lineHeight="16px"
        px="6px"
        borderRadius="6px"
        borderWidth="1px"
        data-kind={kind}
        {...(kind === 'native'
            ? {bgImage: 'app', color: 'fg.inverted', borderColor: 'transparent', fontWeight: '700'}
            : kind === 'simple'
                ? {color: 'hg.text.secondary', bg: 'hg.secondaryFill', borderColor: 'hg.lineStrong'}
                : {color: 'hg.info.text', bg: 'hg.info/10', borderColor: 'hg.info/35'})}
    >
        {KIND_LABEL[kind]}
    </chakra.span>
);

/** A token's logo, or both of an LP token's. */
export const RewardLogo = ({denom, size = '7'}: { denom: string; size?: string }) => {
    const {asset} = useAsset(denom);
    const {getPoolByLpDenom} = useLiquidityPools();
    const pool = getPoolByLpDenom(denom);
    const {asset: base} = useAsset(pool?.base ?? '');
    const {asset: quote} = useAsset(pool?.quote ?? '');

    if (pool && base && quote) {
        return <LPTokenLogo baseAssetLogo={base.logo} quoteAssetLogo={quote.logo} baseAssetSymbol={base.ticker} quoteAssetSymbol={quote.ticker} size={size}/>;
    }
    return <TokenLogo src={asset?.logo} symbol={asset?.ticker ?? ''} size={size}/>;
};

const useCoinText = () => {
    const {denomTicker, denomDecimals} = useAssets();
    return {
        pretty: (c: DenomRewardCoin) => `${prettyAmount(uAmountToBigNumberAmount(c.amount, denomDecimals(c.denom)))} ${denomTicker(c.denom)}`,
        short: (c: DenomRewardCoin) => `${shortNumberFormat(uAmountToBigNumberAmount(c.amount, denomDecimals(c.denom)))} ${denomTicker(c.denom)}`,
        ticker: denomTicker,
    };
};

export const formatApr = (apr?: number) => {
    if (apr === undefined) return '—';
    if (apr >= 10_000) return `≈${shortNumberFormat(new BigNumber(apr))}%`;
    return `≈${apr < 1 ? apr.toFixed(4) : apr.toFixed(2)}%`;
};

const statusText = (row: StakingRow) => {
    switch (row.status) {
        case 'running': return row.kind === 'native' ? 'From the Staking app' : 'Running';
        case 'waiting': return 'Waiting for stakers';
        case 'finished': return 'Finished';
        case 'paying': return 'Paying daily';
        case 'airdrops': return 'Airdrops only';
        default: return '';
    }
};

/** "Unlock 7 days · Min 100 BZE · Running" — the same facts for every reward, under its name. */
const SpecLine = ({row, staked}: { row: StakingRow; staked?: boolean }) => {
    const {short} = useCoinText();
    const parts = [
        row.lockDays > 0 ? `Unlock ${row.lockDays} day${row.lockDays === 1 ? '' : 's'}` : 'Unlock instant',
        new BigNumber(row.minStake).gt(0) ? `Min ${short({denom: row.stakingDenom, amount: row.minStake})}` : 'No minimum',
        statusText(row),
    ].filter(Boolean);

    return (
        <chakra.span fontSize="12px" color="hg.text.faint" truncate data-testid="reward-spec">
            {parts.join(' · ')}
            {staked && <chakra.span color="hg.link" fontWeight="600"> · staked</chakra.span>}
        </chakra.span>
    );
};

const RewardCell = ({row, staked}: { row: StakingRow; staked?: boolean }) => (
    <Flex align="center" gap="12px" minW="0" gridColumn={{base: '1 / -1', lg: 'auto'}}>
        {row.kind === 'native'
            ? <TokenLogo src="/images/bze_alternative_512x512.png" symbol="BZE" size="7"/>
            : <RewardLogo denom={row.stakingDenom}/>}
        <Flex direction="column" gap="2px" minW="0">
            <Flex align="center" gap="6px" minW="0" wrap="wrap">
                <chakra.strong fontSize="15px" truncate>{row.name}</chakra.strong>
                <RewardKindTag kind={row.kind}/>
                {row.verified && row.kind !== 'native' && <VerifiedPill/>}
            </Flex>
            <SpecLine row={row} staked={staked}/>
        </Flex>
    </Flex>
);

/** A table cell; on phones it carries its own small label. */
const Cell = ({label, children, align = 'left'}: { label: string; children: ReactNode; align?: 'left' | 'right' }) => (
    <Flex direction="column" gap="2px" minW="0" textAlign={{base: 'left', lg: align}} align={{base: 'flex-start', lg: align === 'right' ? 'flex-end' : 'flex-start'}}>
        <chakra.span display={{base: 'block', lg: 'none'}} fontSize="10px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase" color="hg.text.faint">{label}</chakra.span>
        {children}
    </Flex>
);

const Sub = ({children, tone}: { children: ReactNode; tone?: 'success' }) => (
    <chakra.span fontSize="12px" color={tone === 'success' ? 'hg.success.text' : 'hg.text.faint'} truncate>{children}</chakra.span>
);

/** The first coin, and "+ N tokens" for the others. */
const CoinStack = ({coins, more = 'tokens', strong = true}: { coins?: DenomRewardCoin[]; more?: 'tokens' | 'more'; strong?: boolean }) => {
    const {short} = useCoinText();
    if (!coins || coins.length === 0) return <chakra.span color="hg.text.faint">—</chakra.span>;
    return (
        <>
            <chakra.span fontSize="14px" fontWeight={strong ? '600' : '500'} truncate>{short(coins[0])}</chakra.span>
            {coins.length > 1 && <Sub>+ {coins.length - 1} {more === 'tokens' ? `token${coins.length === 2 ? '' : 's'}` : 'more'}</Sub>}
        </>
    );
};

const EarnCell = ({row}: { row: StakingRow }) => {
    const {ticker} = useCoinText();
    if (row.earn.length === 0) return <chakra.span color="hg.text.faint">{row.status === 'airdrops' ? 'Airdrops' : '—'}</chakra.span>;
    return (
        <>
            <Flex align="center" gap="6px" minW="0">
                <RewardLogo denom={row.earn[0]} size="5"/>
                <chakra.span fontSize="14px" fontWeight="600" truncate>{ticker(row.earn[0])}</chakra.span>
            </Flex>
            {row.earn.length > 1 && <Sub>+ {row.earn.length - 1} token{row.earn.length === 2 ? '' : 's'}</Sub>}
        </>
    );
};

const AprText = ({apr}: { apr?: number }) => (
    <chakra.span fontSize="14px" fontWeight="700" color={apr === undefined ? 'hg.text.faint' : 'hg.success.text'}>{formatApr(apr)}</chakra.span>
);

/** "10 / 100 days" with a thin DEX bar; rewards with no end say "Ongoing". */
const ProgressText = ({row}: { row: StakingRow }) => {
    if (!row.progress) return <chakra.span fontSize="14px" color="hg.text.secondary">Ongoing</chakra.span>;
    const {done, duration} = row.progress;
    const pct = duration > 0 ? Math.min(100, (done / duration) * 100) : 0;
    return (
        <Flex direction="column" gap="5px" w="full" maxW="140px">
            <chakra.span fontSize="13px" fontWeight="600">{done} / {duration} days</chakra.span>
            <Box h="4px" borderRadius="2px" bg="hg.inset" overflow="hidden" role="progressbar" aria-label="Days paid out" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
                <Box h="full" w={`${pct}%`} bgImage="app"/>
            </Box>
        </Flex>
    );
};

const UnlockText = ({row}: { row: StakingRow }) => {
    const {short} = useCoinText();
    const {hourEpochInfo} = useEpochs();
    const [now] = useState(() => Date.now());
    const unlocks = row.position?.unlocks ?? [];
    if (unlocks.length === 0) return <chakra.span color="hg.text.faint">—</chakra.span>;

    const total = unlocks.reduce((s, u) => s.plus(u.amount), new BigNumber(0));
    const currentHour = hourEpochInfo ? Number(hourEpochInfo.current_epoch) : undefined;
    const when = unlocks
        .map(u => u.unlockEpoch !== undefined
            ? (currentHour !== undefined ? u.unlockEpoch - currentHour : undefined)
            : u.unlockTime ? Math.ceil((u.unlockTime.getTime() - now) / 3_600_000) : undefined)
        .filter((h): h is number => h !== undefined)
        .sort((a, b) => a - b)[0];

    return (
        <>
            <chakra.span fontSize="14px" fontWeight="600" color="hg.warning.text" truncate>{short({denom: row.stakingDenom, amount: total.toFixed(0)})}</chakra.span>
            <Sub>{unlocks.length > 1 ? `${unlocks.length} unlocks, next ` : ''}{when !== undefined ? formatUnlockCountdown(when, 0) : 'soon'}</Sub>
        </>
    );
};

const HeaderRow = ({columns, labels}: { columns: string; labels: string[] }) => (
    <Box display={{base: 'none', lg: 'grid'}} gridTemplateColumns={columns} gap="14px" px="20px" py="10px" bg="hg.cardHeader" borderBottomWidth="1px" borderColor="hg.divider">
        {labels.map((l, i) => (
            <chakra.span key={l || i} fontSize="11px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase" color="hg.text.faint" textAlign={i === labels.length - 1 ? 'right' : 'left'}>{l}</chakra.span>
        ))}
    </Box>
);

const RowFrame = ({columns, tinted, children, testId}: { columns: string; tinted?: boolean; children: ReactNode; testId: string }) => (
    <Box
        display="grid"
        gridTemplateColumns={{base: 'repeat(2, minmax(0, 1fr))', lg: columns}}
        gap={{base: '12px', lg: '14px'}}
        alignItems="center"
        px={{base: '16px', lg: '20px'}}
        py="12px"
        bg={tinted ? 'app.subtle' : undefined}
        borderTopWidth="1px"
        borderColor="hg.divider"
        _first={{borderTopWidth: 0}}
        data-testid={testId}
    >
        {children}
    </Box>
);

const RowActions = ({children}: { children: ReactNode }) => (
    <Flex gridColumn={{base: '1 / -1', lg: 'auto'}} justify="flex-end" gap="8px">{children}</Flex>
);

const LoadingRows = () => (
    <Flex direction="column" gap="10px" p="20px" aria-busy="true">
        <Shimmer h="44px"/>
        <Shimmer h="44px"/>
        <Shimmer h="44px"/>
    </Flex>
);

interface PositionsCardProps {
    rows: StakingRow[];
    nativeDenom: string;
    isLoading: boolean;
    onManage: (row: StakingRow) => void;
    onClaim: () => void;
}

/** "Your positions": what the viewer holds, has to claim and is unlocking, with Claim for all of it. */
export const PositionsCard = ({rows, nativeDenom, isLoading, onManage, onClaim}: PositionsCardProps) => {
    const {pretty, short} = useCoinText();
    const {denomUsdValue} = useAssetsValue();

    const summary = useMemo(() => {
        const staked = rows.reduce((s, r) => s.plus(denomUsdValue(r.stakingDenom, new BigNumber(r.position?.stake ?? 0))), new BigNumber(0));
        const pending = sumCoins(rows.flatMap(r => r.position?.pending ?? []));
        const pendingUsd = pending.reduce((s, c) => s.plus(denomUsdValue(c.denom, new BigNumber(c.amount))), new BigNumber(0));
        // the native coin leads the unclaimed line when there is some, the other tokens are counted
        const first = pending.find(c => c.denom === nativeDenom) ?? pending[0];
        const unlocks = rows.reduce((n, r) => n + (r.position?.unlocks.length ?? 0), 0);
        const stakes = rows.filter(r => new BigNumber(r.position?.stake ?? 0).gt(0)).length;
        return {staked, pendingUsd, first, others: pending.length - (first ? 1 : 0), unlocks, stakes};
    }, [rows, nativeDenom, denomUsdValue]);
    const claimable = rows.filter(r => r.position?.claimable).length;

    return (
        <Box p="1px" borderRadius="20px" bgImage="featuredEdge" boxShadow="hg.featured" data-testid="positions-card">
            <Box bg="hg.card" borderRadius="19px" overflow="hidden">
                <Flex justify="space-between" align={{base: 'stretch', md: 'center'}} direction={{base: 'column', md: 'row'}} gap="16px" px={{base: '16px', md: '22px'}} py="18px">
                    <Flex direction="column" gap="6px" minW="0">
                        <chakra.h2 m="0" fontSize="20px" fontWeight="700">Your positions</chakra.h2>
                        <Flex gap={{base: '4px', md: '18px'}} direction={{base: 'column', md: 'row'}} wrap="wrap" fontSize="14px" color="fg.muted">
                            <span>Staked <chakra.strong color="fg">≈ ${shortNumberFormat(summary.staked)}</chakra.strong> in {summary.stakes} reward{summary.stakes === 1 ? '' : 's'}</span>
                            <span>
                                Unclaimed <chakra.strong color="fg">{summary.first ? pretty(summary.first) : '—'}</chakra.strong>
                                {summary.others > 0 && ` + ${summary.others} token${summary.others === 1 ? '' : 's'}`}
                                {summary.pendingUsd.gt(0) && ` ≈ $${prettyAmount(summary.pendingUsd)}`}
                            </span>
                            {summary.unlocks > 0 && (
                                <span>Unlocking <chakra.strong color="hg.warning.text">{summary.unlocks} unlock{summary.unlocks === 1 ? '' : 's'}</chakra.strong></span>
                            )}
                        </Flex>
                    </Flex>
                    <Button size="xl" px="28px" variant={hgVariant('primary')} gap="8px" disabled={claimable === 0} onClick={onClaim}>
                        <LuGift size={18} aria-hidden="true"/> Claim
                    </Button>
                </Flex>
                <Box borderTopWidth="1px" borderColor="hg.divider">
                    <HeaderRow columns={POSITIONS_COLUMNS} labels={['Reward', 'APR', 'Your stake', 'To claim', 'Unlocking', 'Elapsed / Duration', '']}/>
                    {isLoading ? <LoadingRows/> : rows.map(row => (
                        <RowFrame key={row.id} columns={POSITIONS_COLUMNS} testId="position-row">
                            <RewardCell row={row}/>
                            <Cell label="APR"><AprText apr={row.apr}/></Cell>
                            <Cell label="Your stake">
                                <chakra.span fontSize="14px" fontWeight="600" color="hg.link" truncate>{short({denom: row.stakingDenom, amount: row.position?.stake ?? '0'})}</chakra.span>
                                {row.position && row.position.sharePct > 0 && (
                                    <Sub tone="success">
                                        {row.position.sharePct < 0.01 ? '<0.01' : row.position.sharePct.toFixed(2)}%
                                        {row.position.daily[0] && ` · ≈ ${short(row.position.daily[0])} / day`}
                                    </Sub>
                                )}
                            </Cell>
                            <Cell label="To claim"><CoinStack coins={row.position?.pending} more="tokens"/></Cell>
                            <Cell label="Unlocking"><UnlockText row={row}/></Cell>
                            <Cell label="Elapsed / Duration"><ProgressText row={row}/></Cell>
                            <RowActions>
                                <Button size="sm" {...softButtonStyle} onClick={() => onManage(row)}>Manage</Button>
                            </RowActions>
                        </RowFrame>
                    ))}
                </Box>
            </Box>
        </Box>
    );
};

const KIND_CHIPS: Array<{ value: StakingKindFilter; label: string }> = [
    {value: 'all', label: 'All'},
    {value: 'simple', label: 'Simple'},
    {value: 'compounded', label: 'Compounded'},
    {value: 'lp', label: 'LP'},
];

const Chip = ({pressed, onClick, children, check}: { pressed: boolean; onClick: () => void; children: ReactNode; check?: boolean }) => (
    <chakra.button
        type="button"
        aria-pressed={pressed}
        onClick={onClick}
        display="inline-flex"
        alignItems="center"
        gap="6px"
        h="34px"
        px="12px"
        borderRadius="full"
        borderWidth="1px"
        fontSize="13px"
        fontWeight="600"
        cursor="pointer"
        color={pressed ? 'hg.link' : 'hg.text.secondary'}
        bg={pressed ? 'app.subtle' : 'transparent'}
        borderColor={pressed ? 'app.border' : 'hg.hairline'}
        _hover={{bg: pressed ? 'app.muted' : 'hg.hoverFill'}}
        _focusVisible={{outline: '2px solid', outlineColor: 'app.focusRing', outlineOffset: '2px'}}
    >
        {check && (
            <Box boxSize="14px" display="flex" alignItems="center" justifyContent="center" borderRadius="4px" borderWidth="1.5px" borderColor={pressed ? 'transparent' : 'hg.lineStrong'} bgImage={pressed ? 'app' : undefined} color="fg.inverted" aria-hidden="true">
                {pressed && <LuCheck size={10} strokeWidth={3}/>}
            </Box>
        )}
        {children}
    </chakra.button>
);

export const ExploreToolbar = ({filters, onChange}: { filters: StakingFilters; onChange: (f: StakingFilters) => void }) => (
    <Flex gap="12px" align="center" wrap="wrap">
        <InputGroup startElement={<LuSearch size={16}/>} w="360px" maxW="100%">
            <Input
                aria-label="Search rewards"
                placeholder="Search by token..."
                value={filters.search}
                onChange={(e) => onChange({...filters, search: e.target.value})}
                h="40px"
                borderRadius="12px"
                bg="hg.inset"
                borderColor="hg.hairline"
                fontSize="14px"
            />
        </InputGroup>
        <Flex gap="6px" wrap="wrap" role="group" aria-label="Reward kind">
            {KIND_CHIPS.map(c => (
                <Chip key={c.value} pressed={filters.kind === c.value} onClick={() => onChange({...filters, kind: c.value})}>{c.label}</Chip>
            ))}
        </Flex>
        <Flex gap="6px" wrap="wrap" ml={{lg: 'auto'}}>
            <Chip check pressed={filters.verifiedOnly} onClick={() => onChange({...filters, verifiedOnly: !filters.verifiedOnly})}>Verified only</Chip>
            <Chip check pressed={filters.showFinished} onClick={() => onChange({...filters, showFinished: !filters.showFinished})}>Show finished</Chip>
        </Flex>
    </Flex>
);

interface ExploreTableProps {
    page: StakingPage<StakingRow>;
    isLoading: boolean;
    onStake: (row: StakingRow) => void;
    onPage: (page: number) => void;
}

/** Every reward, one compact row each, 25 to a page. */
export const ExploreTable = ({page, isLoading, onStake, onPage}: ExploreTableProps) => (
    <HgCard p="0" overflow="hidden" data-testid="explore-table">
        <HeaderRow columns={EXPLORE_COLUMNS} labels={['Reward', 'Earn', 'APR', 'Daily', 'Total staked', 'Elapsed / Duration', '']}/>
        {isLoading ? <LoadingRows/> : page.total === 0 ? (
            <chakra.p m="0" px="20px" py="24px" fontSize="14px" color="fg.muted" data-testid="explore-empty">No reward matches these filters.</chakra.p>
        ) : page.items.map(row => <ExploreRow key={row.id} row={row} onStake={onStake}/>)}
        {!isLoading && page.total > 0 && <Pager page={page} onPage={onPage}/>}
    </HgCard>
);

const ExploreRow = ({row, onStake}: { row: StakingRow; onStake: (row: StakingRow) => void }) => {
    const {short} = useCoinText();
    const mine = new BigNumber(row.position?.stake ?? 0).gt(0);

    return (
        <RowFrame columns={EXPLORE_COLUMNS} tinted={mine} testId="explore-row">
            <RewardCell row={row} staked={mine}/>
            <Cell label="Earn"><EarnCell row={row}/></Cell>
            <Cell label="APR"><AprText apr={row.apr}/></Cell>
            <Cell label="Daily">
                {row.daily === undefined
                    ? <chakra.span color="hg.text.faint">—</chakra.span>
                    : row.daily.length === 0
                        ? <chakra.span fontSize="14px" color="hg.text.faint">Nothing scheduled</chakra.span>
                        : <CoinStack coins={row.daily} more="more" strong={false}/>}
            </Cell>
            <Cell label="Total staked">
                <chakra.span fontSize="14px" truncate>{short({denom: row.stakingDenom, amount: row.totalStaked})}</chakra.span>
                {row.totalStakedUsd.gt(0) && <Sub>≈ ${shortNumberFormat(row.totalStakedUsd)}</Sub>}
            </Cell>
            <Cell label="Elapsed / Duration"><ProgressText row={row}/></Cell>
            <RowActions>
                {row.kind === 'native' ? (
                    <Button asChild size="sm" {...softButtonStyle}>
                        <a href={getStakingApp().href} target="_blank" rel="noopener noreferrer">Stake</a>
                    </Button>
                ) : (
                    <Button size="sm" {...softButtonStyle} disabled={row.status === 'finished'} onClick={() => onStake(row)}>
                        {mine ? 'Add' : 'Stake'}
                    </Button>
                )}
            </RowActions>
        </RowFrame>
    );
};

const Pager = ({page, onPage}: { page: StakingPage<StakingRow>; onPage: (p: number) => void }) => (
    <Flex justify="space-between" align="center" gap="12px" wrap="wrap" px="20px" py="12px" borderTopWidth="1px" borderColor="hg.divider">
        <chakra.span fontSize="13px" color="hg.text.faint">{page.from}–{page.to} of {page.total.toLocaleString()}</chakra.span>
        {page.pageCount > 1 && (
            <chakra.nav aria-label="Pages" display="flex" gap="4px" alignItems="center">
                <PageButton label="Previous page" disabled={page.page === 1} onClick={() => onPage(page.page - 1)}><LuChevronLeft size={16}/></PageButton>
                {pageButtons(page.page, page.pageCount).map((p, i) => p === '…'
                    ? <chakra.span key={`gap-${i}`} px="4px" color="hg.text.faint" aria-hidden="true">…</chakra.span>
                    : <PageButton key={p} label={`Page ${p}`} current={p === page.page} onClick={() => onPage(p)}>{p}</PageButton>)}
                <PageButton label="Next page" disabled={page.page === page.pageCount} onClick={() => onPage(page.page + 1)}><LuChevronRight size={16}/></PageButton>
            </chakra.nav>
        )}
    </Flex>
);

const PageButton = ({label, current, disabled, onClick, children}: { label: string; current?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) => (
    <Button
        size="sm"
        minW="32px"
        h="32px"
        px="8px"
        variant="ghost"
        borderRadius="8px"
        aria-label={label}
        aria-current={current ? 'page' : undefined}
        disabled={disabled}
        onClick={onClick}
        color={current ? 'hg.link' : 'hg.text.secondary'}
        bg={current ? 'app.subtle' : undefined}
        borderWidth="1px"
        borderColor={current ? 'app.border' : 'transparent'}
    >
        {children}
    </Button>
);
