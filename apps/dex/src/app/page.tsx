'use client';

import {
  Box,
  Button,
  chakra,
  Collapsible,
  Flex,
  Grid,
  GridItem,
  Input,
  Select,
  createListCollection,
} from '@chakra-ui/react';
import {
  LuArrowUpDown,
  LuChevronDown,
  LuChevronUp,
  LuArrowRight,
  LuSearch,
} from 'react-icons/lu';
import { useState, useMemo, memo, useEffect, useCallback, useId, type ComponentProps, type ReactNode } from 'react';
import NextLink from "next/link";
import {useAssets, useBalances, prettyAmount, uAmountToBigNumberAmount, amountToBigNumberUAmount, toBigNumber, uAmountToAmount, createAmmRouter, useToast, useBZETx, getChainName, useAssetsValue, HighlightText, sanitizeNumberInput, getAddressSwapHistory, SwapHistory, addDebounce, useLiquidityPools, TokenLogo, Tooltip, FeeEstimateRow, useTradingFees, useMaxSpendable, useGasFeeEstimate, useFeeEstimate, useCanAffordTx, useHaltedDenoms, useMarkets, useAssetPrice, getChainNativeAssetDenom, createMarketId, formatUsdAmount, shortNumberFormat, LPTokenLogo, PageContainer, HeroGlow, Eyebrow, GradientText, HgCard, StatCard, StatStrip, Notice, hgVariant} from "@bze/bze-ui-kit";
import {parseAmountInput, quoteSwap, SwapInput, SwapQuote} from "@/lib/swap-quote";
import {SLIPPAGE_PRESETS, isSlippagePreset, minimumSwapOutput, parseCustomSlippage} from "@/lib/slippage";
import {AMM_SLIPPAGE_KEY, createLocalSlippageStore} from "@/lib/slippage-store";
import {sortPools} from "@/lib/pool-list";
import {sortMarkets} from "@/lib/market-list";
import {useStoredSlippage} from "@/hooks/useStoredSlippage";
import {marketPagePath} from "@/hooks/useNavigation";
import {VenueTag, VenueTitle} from "@/components/ui/trading/venue";
import {PriceImpactBadge} from "@/components/ui/trading/badges";
import {SwapLayoutSwitcher} from "@/components/swap-layout/swap-layout-switcher";
import {createLocalSwapLayoutStore, inLayout, showOnlyIn} from "@/components/swap-layout/swap-layout";
import {ConnectForSwaps, RecentSwapsCard, StatFigures, type RecentSwapGroup} from "@/components/swap-layout/swap-top-parts";
import BigNumber from 'bignumber.js';
import {bze} from "@bze/bzejs";
import {useChain} from "@interchain-kit/react";

// Define the asset type for better type safety
type AssetWithBalance = {
  denom: string;
  ticker: string;
  name: string;
  logo: string;
  balance: BigNumber;
  balanceFormatted: string;
  verified: boolean;
  decimals: number;
  type: string;
  stable: boolean;
  supply: bigint;
};

// Memoized AssetSelector component to prevent unnecessary re-renders
const AssetSelector = memo(({
  asset,
  onSelect,
  assetsWithBalanceInfo,
  isLoading,
}: {
  asset: AssetWithBalance | null;
  onSelect: (asset: AssetWithBalance) => void;
  assetsWithBalanceInfo: AssetWithBalance[];
  isLoading: boolean;
}) => {
  // Local search state to avoid parent re-renders
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Memoize filtered assets to prevent unnecessary recalculations
  const filteredAssets = useMemo(() => {
    if (!searchTerm) {
      // Show only first 10 by default (already sorted)
      return assetsWithBalanceInfo.slice(0, 10);
    }

    // When searching, filter and show up to 20 results
    const filtered = assetsWithBalanceInfo.filter((a) =>
        a.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return filtered.slice(0, 20);
  }, [searchTerm, assetsWithBalanceInfo]);

  // Memoize collection to prevent flickering on search
  const collection = useMemo(() => {
    return createListCollection({
      items: filteredAssets.map((a) => ({
        label: a.ticker,
        value: a.denom
      }))
    });
  }, [filteredAssets]);

  if (isLoading) {
    return <chakra.span fontSize="14px" color="hg.text.muted">Loading...</chakra.span>;
  }

  if (!asset) {
    return <chakra.span fontSize="14px" color="hg.text.muted">No asset available</chakra.span>
  }

  return (
      <Select.Root
          collection={collection}
          value={[asset.denom]}
          open={isOpen}
          positioning={{sameWidth: false, placement: 'bottom-start'}}
          onOpenChange={(details) => {
            setIsOpen(details.open);
            if (!details.open) {
              setSearchTerm('');
            }
          }}
          onValueChange={(details) => {
            const selectedDenom = details.value[0];
            const selectedAsset = assetsWithBalanceInfo.find((a) => a.denom === selectedDenom);
            if (selectedAsset) {
              onSelect(selectedAsset);
              setIsOpen(false);
              setSearchTerm('');
            }
          }}
      >
        <Select.Trigger asChild>
          <chakra.button
            type="button"
            display="inline-flex"
            alignItems="center"
            gap="8px"
            h="40px"
            minW="0"
            maxW="100%"
            pl="6px"
            pr="12px"
            borderRadius="full"
            borderWidth="1px"
            borderColor="hg.lineStrong"
            bg="hg.card"
            color="fg"
            fontSize="15px"
            fontWeight="600"
            cursor="pointer"
            transitionProperty="border-color"
            transitionDuration="moderate"
            _hover={{borderColor: 'app.border'}}
            _expanded={{borderColor: 'app.solid'}}
            focusVisibleRing="outside"
          >
            <TokenLogo
                src={asset.logo}
                symbol={asset.ticker}
                size="7"
                circular={true}
            />
            <chakra.span flex="none">{asset.ticker}</chakra.span>
            <chakra.span color="hg.text.faint" fontWeight="500" truncate hideBelow="sm">{asset.name}</chakra.span>
            <Box as="span" flex="none" color="hg.text.muted"><LuChevronDown size={16} /></Box>
          </chakra.button>
        </Select.Trigger>
        <Select.Positioner>
          <Select.Content
            w="360px"
            maxW="calc(100vw - 32px)"
            p="10px"
            bg="hg.card"
            borderWidth="1px"
            borderColor="hg.lineStrong"
            borderRadius="16px"
            boxShadow="hg.popover"
            aria-label="Choose an asset"
          >
            <Box position="relative" mb="6px">
              <Box position="absolute" left="12px" top="50%" transform="translateY(-50%)" color="hg.text.faint" pointerEvents="none" zIndex="1">
                <LuSearch size={15} />
              </Box>
              <Input
                  aria-label="Search assets"
                  placeholder="Search assets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  h="40px"
                  pl="34px"
                  borderRadius="10px"
                  bg="hg.inset"
                  borderColor="app.border"
                  fontSize="14px"
                  autoFocus
              />
            </Box>
            <Box maxH="336px" overflowY="auto">
              {filteredAssets.length > 0 ? (
                  filteredAssets.map((assetOption) => (
                      <Select.Item
                          key={assetOption.denom}
                          item={assetOption.denom}
                          minH="48px"
                          px="10px"
                          borderRadius="10px"
                          cursor="pointer"
                          _hover={{ bg: "hg.hoverFill" }}
                          _highlighted={{ bg: "hg.hoverFill" }}
                          _checked={{ bg: "app.subtle" }}
                      >
                        <Select.ItemText flex="1" minW="0">
                          <Flex align="center" gap="10px">
                            <TokenLogo
                                src={assetOption.logo}
                                symbol={assetOption.ticker}
                                size="8"
                                circular={true}
                            />
                            <Flex direction="column" minW="0">
                              <chakra.span truncate>
                                <chakra.strong fontSize="14px" fontWeight="700">{assetOption.ticker}</chakra.strong>{' '}
                                <chakra.span fontSize="13px" color="hg.text.faint">{assetOption.name}</chakra.span>
                              </chakra.span>
                              <HighlightText fontSize="12px" color="hg.text.faint">
                                Balance: {assetOption.balanceFormatted}
                              </HighlightText>
                            </Flex>
                          </Flex>
                        </Select.ItemText>
                        <Select.ItemIndicator color="hg.link" />
                      </Select.Item>
                  ))
              ) : (
                  <chakra.p m="0" py="24px" px="10px" textAlign="center" fontSize="14px" color="hg.text.muted">
                    No assets found
                  </chakra.p>
              )}
            </Box>
            {!searchTerm && assetsWithBalanceInfo.length > 10 && (
                <chakra.p m="0" pt="8px" px="10px" pb="4px" fontSize="12px" color="hg.text.faint">
                  Showing first 10 assets. Search to find more.
                </chakra.p>
            )}
          </Select.Content>
        </Select.Positioner>
      </Select.Root>
  );
});

AssetSelector.displayName = 'AssetSelector';

/** One side of the swap: label and balance, the token pill and the amount, and what sits under them. */
const SwapSide = ({label, balance, selector, input, children}: {
  label: string;
  balance: ReactNode;
  selector: ReactNode;
  input: (id: string) => ReactNode;
  children?: ReactNode;
}) => {
  const id = useId();

  return (
      <Flex direction="column" gap="10px" bg="hg.inset" borderRadius="16px" p="16px">
        <Flex justify="space-between" gap="12px" fontSize="13px" color="hg.text.faint">
          <chakra.label htmlFor={id}>{label}</chakra.label>
          {balance}
        </Flex>
        <Flex justify="space-between" align="center" gap="12px">
          <Box minW="0" flexShrink={1}>{selector}</Box>
          {input(id)}
        </Flex>
        {children}
      </Flex>
  );
};

/** The big amount field of a swap side. */
const AmountInput = (props: ComponentProps<typeof chakra.input>) => (
    <chakra.input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.0"
        flex="1"
        minW="0"
        w="160px"
        textAlign="right"
        bg="transparent"
        border="0"
        outline="none"
        color="fg"
        fontSize="28px"
        fontWeight="700"
        _placeholder={{color: 'hg.text.faint'}}
        {...props}
    />
);

/** A label on the left and its value on the right, in the quote summary. */
const SummaryRow = ({label, children}: { label: ReactNode; children: ReactNode }) => (
    <Flex justify="space-between" align="center" gap="12px" fontSize="14px">
      <chakra.span color="hg.text.muted">{label}</chakra.span>
      <chakra.span textAlign="right" color="fg">{children}</chakra.span>
    </Flex>
);

/** The small text button of the summary ("Change", "Done"). */
const TextButton = (props: ComponentProps<typeof chakra.button>) => (
    <chakra.button
        type="button"
        p="0"
        border="0"
        bg="transparent"
        fontSize="12px"
        fontWeight="600"
        cursor="pointer"
        focusVisibleRing="outside"
        {...props}
    />
);

/** One of the "Two ways to trade" bullets: a dot for Swap, an outlined square for Exchange. */
const WayBullet = ({square, children}: { square?: boolean; children: ReactNode }) => (
    <Flex as="li" gap="10px" align="center">
      <Box
          as="span"
          flex="none"
          boxSize="6px"
          borderRadius={square ? '2px' : 'full'}
          {...(square ? {borderWidth: '1.5px', borderColor: 'app.solid'} : {bg: 'app.solid'})}
      />
      {children}
    </Flex>
);

/** A row of the "Top pools" and "Order-book markets" lists. */
const ListRow = ({lead, title, meta, action}: { lead: ReactNode; title: string; meta: ReactNode; action: ReactNode }) => (
    <Flex align="center" justify="space-between" gap="12px" p="12px" borderRadius="12px" bg="hg.inset">
      <Flex align="center" gap="10px" minW="0">
        {lead}
        <chakra.strong fontSize="15px" fontWeight="700" truncate>{title}</chakra.strong>
      </Flex>
      <Flex align="center" gap="14px" flex="none">
        <chakra.span fontSize="13px" color="hg.text.faint" hideBelow="sm">{meta}</chakra.span>
        {action}
      </Flex>
    </Flex>
);

/** The heading row of a home list card. */
const ListHeader = ({title, venue, href, linkText}: { title: string; venue: string; href: string; linkText: string }) => (
    <Flex justify="space-between" align="baseline" gap="12px" px="4px" pb="10px">
      <chakra.h3 m="0" fontSize="17px" fontWeight="700">
        {title} <chakra.span fontWeight="500" color="hg.text.faint">· {venue}</chakra.span>
      </chakra.h3>
      <chakra.a asChild fontSize="14px" color="hg.link" _hover={{color: 'hg.accent'}} flex="none">
        <NextLink href={href}>{linkText}</NextLink>
      </chakra.a>
    </Flex>
);

// Composition root for the swap form's slippage persistence (one entry per chain, see ui-kit storage).
const ammSlippageStore = createLocalSlippageStore(AMM_SLIPPAGE_KEY);
// ...and of the top layout the desktop switcher picks (a raw value the pre-paint script reads).
const swapLayoutStore = createLocalSwapLayoutStore();

// C-3's swap card glow: about a third of the app accent.
const SPLIT_CARD_GLOW = '0 18px 50px -24px color-mix(in srgb, var(--chakra-colors-app-solid) 35%, transparent)';

export default function SwapPage() {
  const { denomTicker, getAsset, isVerifiedAsset } = useAssets();
  const { getBalanceByDenom } = useBalances();
  const { pools, poolsData, liquidAssets, isLoading } = useLiquidityPools();
  const {toast} = useToast()
  const {tx, progressTrack} = useBZETx()
  const {fees: tradingFees, isLoading: tradingFeesLoading} = useTradingFees()
  const {address} = useChain(getChainName())
  const {denomUsdValue, compareValues} = useAssetsValue()

  const {isDenomHalted, isPoolHalted, isMarketHalted} = useHaltedDenoms()

  // The chain refuses any swap whose route crosses a pool holding a governance-halted denom, so
  // those pools never reach the router and halted denoms never reach the pickers.
  const tradeablePools = useMemo(() => pools.filter(pool => !isPoolHalted(pool)), [pools, isPoolHalted]);
  const tradeableAssets = useMemo(() => liquidAssets.filter(asset => !isDenomHalted(asset.denom)), [liquidAssets, isDenomHalted]);

  // Get assets with balance information for display
  const assetsWithBalanceInfo = useMemo(() => {
    const assetsWithBalance = tradeableAssets.map(asset => {
      const balance = getBalanceByDenom(asset.denom);
      const balanceAmount = uAmountToBigNumberAmount(balance.amount, asset.decimals);
      return {
        ...asset,
        balance: balanceAmount,
        balanceFormatted: prettyAmount(balanceAmount)
      };
    });

    // Sort assets by:
    // 1. Positive balance first (alphabetically)
    // 2. Then verified assets
    // 3. Then assets without "..." in name
    // 4. Finally assets with "..." in name
    return assetsWithBalance.sort((a, b) => {
      const aHasBalance = a.balance.gt(0);
      const bHasBalance = b.balance.gt(0);

      // First priority: assets with balance
      if (aHasBalance && !bHasBalance) return -1;
      if (!aHasBalance && bHasBalance) return 1;

      // If both have balance or both don't, sort alphabetically within this group
      if (aHasBalance === bHasBalance) {
        // Second priority: verified flag
        if (a.verified && !b.verified) return -1;
        if (!a.verified && b.verified) return 1;

        // Third priority: assets without "..." in name
        const aHasDots = a.name.includes('...');
        const bHasDots = b.name.includes('...');
        if (!aHasDots && bHasDots) return -1;
        if (aHasDots && !bHasDots) return 1;

        // Finally, sort alphabetically by ticker
        return a.ticker.localeCompare(b.ticker);
      }

      return 0;
    });
  }, [tradeableAssets, getBalanceByDenom]);

  // Only the picked denoms are state; the asset objects (with live balances) are derived below.
  const [fromDenom, setFromDenom] = useState<string | null>(null);
  const [toDenom, setToDenom] = useState<string | null>(null);
  // The one amount the user typed (or picked via MAX / presets / flip) and which field it
  // belongs to. The other field, the route and the submit payload are all derived from the
  // quote, so there is no second copy of the amount that could drift out of sync.
  const [input, setInput] = useState<SwapInput>({side: 'from', value: ''});
  // The slippage editor sits inside the summary, so it is visible where the user reads the
  // minimum output (a panel at the top of the form would open out of view once scrolled).
  const [showSlippageEditor, setShowSlippageEditor] = useState(false);
  const [showRoutes, setShowRoutes] = useState(false);
  // Max slippage is remembered on this device (30 days from the last change), so it survives
  // navigation and reloads.
  const [slippage, updateSwapSlippage] = useStoredSlippage(ammSlippageStore);
  // The custom field's text while the user edits it; null shows the stored value (if it is
  // not a preset) so a remembered custom slippage comes back into the field.
  const [customSlippageText, setCustomSlippageText] = useState<string | null>(null);
  const customSlippage = customSlippageText ?? (isSlippagePreset(slippage) ? '' : String(slippage));
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Swap history is keyed by the address it was loaded for, so "loading" and "empty"
  // derive from state instead of being set from an effect.
  const [historyState, setHistoryState] = useState<{ address: string; history: SwapHistory[] } | null>(null);
  const swapHistory = useMemo(
    () => (address && historyState?.address === address ? historyState.history : []),
    [address, historyState]
  );
  const isLoadingHistory = Boolean(address) && historyState?.address !== address;

  // A pick that left the list (its denom got halted after it was chosen) is dropped, so the
  // defaults below pick a tradeable asset instead of quoting through a halted pool.
  if (fromDenom !== null && assetsWithBalanceInfo.length > 0 && !assetsWithBalanceInfo.some(a => a.denom === fromDenom)) {
    setFromDenom(null);
  }
  if (toDenom !== null && assetsWithBalanceInfo.length > 1 && !assetsWithBalanceInfo.some(a => a.denom === toDenom)) {
    setToDenom(null);
  }

  // Pick the default assets once the list is loaded (React's "adjust state while
  // rendering" pattern — guarded so it runs once, not on every render).
  if (fromDenom === null && assetsWithBalanceInfo.length > 0) {
    setFromDenom(assetsWithBalanceInfo[0].denom);
  }
  if (toDenom === null && assetsWithBalanceInfo.length > 1) {
    setToDenom(assetsWithBalanceInfo[1].denom);
  }

  // Selected assets always carry the latest balance info.
  const fromAsset = useMemo(
    () => assetsWithBalanceInfo.find(a => a.denom === fromDenom) ?? null,
    [assetsWithBalanceInfo, fromDenom]
  );
  const toAsset = useMemo(
    () => assetsWithBalanceInfo.find(a => a.denom === toDenom) ?? null,
    [assetsWithBalanceInfo, toDenom]
  );

  // A router over the current pools, rebuilt when they change so quotes follow the chain.
  const router = useMemo(() => createAmmRouter(tradeablePools), [tradeablePools]);

  // The quote is a pure function of (pools, pair, typed amount) and cheap enough to compute
  // during render: no timers, so no stale or out-of-order results can reach the form.
  const quote = useMemo((): SwapQuote | null => {
    const amount = parseAmountInput(input.value);
    if (!amount || !fromAsset || !toAsset) {
      return null;
    }
    const typedAsset = input.side === 'from' ? fromAsset : toAsset;
    try {
      return quoteSwap(router, {
        fromDenom: fromAsset.denom,
        toDenom: toAsset.denom,
        side: input.side,
        amount: amountToBigNumberUAmount(amount, typedAsset.decimals),
      });
    } catch (error) {
      console.error('Error calculating swap route:', error);
      return null;
    }
  }, [router, fromAsset, toAsset, input]);

  const routeResult = quote?.route ?? null;
  const hasAmount = parseAmountInput(input.value) !== null;
  const fromAmount = input.side === 'from'
    ? input.value
    : quote && fromAsset ? uAmountToBigNumberAmount(quote.amountIn, fromAsset.decimals).toFixed(fromAsset.decimals) : '';
  const toAmount = input.side === 'to'
    ? input.value
    : quote && toAsset ? uAmountToBigNumberAmount(quote.amountOut, toAsset.decimals).toFixed(toAsset.decimals) : '';

  const handleFromAmountChange = (value: string) => setInput({side: 'from', value});
  const handleToAmountChange = (value: string) => setInput({side: 'to', value});

  // Check if user has sufficient balance
  const hasInsufficientBalance = useMemo(() => {
    if (!fromAsset || !fromAmount) return false;
    const amount = new BigNumber(fromAmount);
    if (amount.isNaN() || amount.lte(0)) return false;
    return amount.gt(fromAsset.balance);
  }, [fromAsset, fromAmount]);

  // Shared gas engine: MAX / 100 % keep the gas fee back when the sold asset is the fee coin
  // (sized for the worst case, a 3-hop route, since the route is only known after the amount),
  // and the submit check covers amount + gas + taker fee in the chain's charging order.
  const maxSpendable = useMaxSpendable(fromAsset?.denom ?? '', {kind: 'swap', count: 3});
  const swapSpec = useMemo(
    () => ({kind: 'swap' as const, count: Math.max(1, routeResult?.route.length ?? 1)}),
    [routeResult]
  );
  const swapGasFee = useGasFeeEstimate(swapSpec);
  const takerFeeEstimate = useFeeEstimate(tradingFees.takerFee, {gasFee: swapGasFee.estimate});
  const affordability = useCanAffordTx({
    spec: fromAsset && fromAmount ? swapSpec : undefined,
    spend: fromAsset && fromAmount
      ? {denom: fromAsset.denom, amount: amountToBigNumberUAmount(fromAmount, fromAsset.decimals)}
      : undefined,
    moduleFee: takerFeeEstimate.resolvedFee,
  });
  const hasFeeShortfall = !hasInsufficientBalance && Boolean(fromAmount) && !affordability.canAfford;

  // Determine if swap can be submitted
  const canSubmit = useMemo(() => {
    // Must have a valid route (which implies a valid amount and two different assets)
    if (!quote) return false;

    // Must have sufficient balance, gas and taker fee included
    if (hasInsufficientBalance || hasFeeShortfall) return false;

    return true;
  }, [quote, hasInsufficientBalance, hasFeeShortfall]);

  // Flip the pair. The typed amount stays with its asset and keeps being the typed side:
  // "sell 1000 BZE -> 0.197 USDC" becomes "buy 1000 BZE for ~0.197 USDC", quoted afresh.
  const handleSwapAssets = () => {
    setFromDenom(toDenom);
    setToDenom(fromDenom);
    setInput({side: input.side === 'from' ? 'to' : 'from', value: input.value});
  };

  const handleSlippagePreset = (value: number) => {
    updateSwapSlippage(value);
    setCustomSlippageText('');
    setShowSlippageEditor(false);
  };

  const handleCustomSlippage = (value: string) => {
    setCustomSlippageText(value);
    const parsed = parseCustomSlippage(value);
    if (parsed !== null) {
      updateSwapSlippage(parsed);
    }
  };

  const fetchSwapHistory = useCallback(async (forAddress: string): Promise<SwapHistory[]> => {
    try {
      return (await getAddressSwapHistory(forAddress)) ?? [];
    } catch (error) {
      console.error('Error fetching swap history:', error);
      return [];
    }
  }, []);

  // Fetch swap history when address changes
  useEffect(() => {
    if (!address) {
      return;
    }

    let cancelled = false;
    const load = async () => {
      const history = await fetchSwapHistory(address);
      if (!cancelled) {
        setHistoryState({ address, history });
      }
    };

    load();
    return () => { cancelled = true; };
  }, [address, fetchSwapHistory]);

  // Manual refresh (after a swap lands)
  const refreshSwapHistory = useCallback(async () => {
    if (!address) {
      return;
    }
    const history = await fetchSwapHistory(address);
    setHistoryState({ address, history });
  }, [address, fetchSwapHistory]);

  const handleSwapSubmit = async () => {
    if (!address) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!fromAsset || !toAsset || !quote) {
      toast.error('Missing required data for swap');
      return;
    }

    try {
      // 1. The quote already holds the exact micro input the route was priced with
      const amountIn = quote.amountIn;

      // 2. The least output accepted: the quote minus the slippage (percent), rounded down to
      // whole micro units like the chain's own output, and at least 1 (the chain rejects 0)
      const minAmountOut = minimumSwapOutput(quote.amountOut, slippage);
      if (!minAmountOut) {
        toast.error(`Amount too small: it would not buy a single unit of ${toAsset.ticker}`);
        return;
      }

      // 3. Create multiSwap message
      const {multiSwap} = bze.tradebin.MessageComposer.withTypeUrl;
      setIsSubmitting(true)
      const msg = multiSwap({
        creator: address,
        routes: quote.route.route,
        input: {
          denom: fromAsset.denom,
          amount: amountIn.toFixed(0),
        },
        minOutput: {
          denom: toAsset.denom,
          amount: minAmountOut.toFixed(0),
        },
      });

      // 4. Sign and broadcast transaction
      await tx([msg], {
        onSuccess: () => {
          // Reset form on success
          setInput({side: 'from', value: ''});
          // Refresh swap history after 1 second
          addDebounce('refresh-swap-history', 1000, refreshSwapHistory);
        },
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      toast.error('Failed to prepare swap transaction');
    }
    setIsSubmitting(false)
  };

  const calculateUSDValue = (amount: string, asset: typeof assetsWithBalanceInfo[0] | null) => {
    if (!asset || !amount) return null;

    // The fields hold display amounts; denomUsdValue takes base (micro) units.
    const usdValue = denomUsdValue(asset.denom, amountToBigNumberUAmount(amount, asset.decimals));

    if (!usdValue || usdValue.lte(0)) return null;

    return prettyAmount(usdValue);
  };

  // Group swap history by exact timestamp (for multi-hop swaps in same transaction)
  const groupedSwapHistory = useMemo(() => {
    const timestampGroups = new Map<string, SwapHistory[]>();
    if (!swapHistory) return [];

    // Group by exact timestamp
    swapHistory.forEach((swap) => {
      const timestampKey = swap.executed_at;
      if (!timestampGroups.has(timestampKey)) {
        timestampGroups.set(timestampKey, []);
      }
      timestampGroups.get(timestampKey)?.push(swap);
    });

    // Convert to array (endpoint already returns sorted data)
    return Array.from(timestampGroups.entries());
  }, [swapHistory]);

  // The history as display rows, shared by the three layouts' renderers.
  const recentSwaps: RecentSwapGroup[] = groupedSwapHistory.map(([timestamp, swaps]) => {
    const date = new Date(parseInt(timestamp));
    return {
      key: timestamp,
      day: date.toLocaleDateString('en-US', {year: 'numeric', month: 'short', day: 'numeric'}),
      shortDay: date.toLocaleDateString('en-US', {month: 'short', day: 'numeric'}),
      time: date.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'}),
      swaps: swaps.map((swap, idx) => {
        const isSell = swap.order_type === 'sell';
        const paidDenom = isSell ? swap.base : swap.quote;
        const gotDenom = isSell ? swap.quote : swap.base;
        return {
          key: `${swap.order_id}-${idx}`,
          paidAmount: prettyAmount((isSell ? swap.base_volume : swap.quote_volume).toString()),
          paidTicker: denomTicker(paidDenom),
          paidLogo: getAsset(paidDenom)?.logo,
          gotAmount: prettyAmount((isSell ? swap.quote_volume : swap.base_volume).toString()),
          gotTicker: denomTicker(gotDenom),
          gotLogo: getAsset(gotDenom)?.logo,
          pool: `${denomTicker(swap.base)} / ${denomTicker(swap.quote)}`,
        };
      }),
    };
  });


  // Home page data: the stat strip and the two short lists under the swap card.
  const {markets, getMarketData} = useMarkets();
  const {price: bzePrice, hasPrice: hasBzePrice, isLoading: bzePriceLoading} = useAssetPrice(getChainNativeAssetDenom());

  const poolsVolume = useMemo(
    () => tradeablePools.reduce((sum, pool) => sum.plus(poolsData?.get(pool.id)?.usdVolume ?? 0), toBigNumber(0)),
    [tradeablePools, poolsData]
  );
  const topPools = useMemo(
    () => sortPools(tradeablePools, poolsData ?? new Map(), 'totalLiquidity', 'desc').slice(0, 3),
    [tradeablePools, poolsData]
  );
  const topMarkets = useMemo(
    () => sortMarkets(markets.filter(market => !isMarketHalted(market)), {
      isHalted: isMarketHalted,
      getMarketData: (market) => getMarketData(createMarketId(market.base, market.quote)),
      isVerified: (market) => isVerifiedAsset(market.base) && isVerifiedAsset(market.quote),
      compareValues,
    }).slice(0, 3),
    [markets, isMarketHalted, getMarketData, isVerifiedAsset, compareValues]
  );

  // "Swap" on a top pool loads its pair into the swap card.
  const handlePickPool = (base: string, quote: string) => {
    setFromDenom(base);
    setToDenom(quote);
    setInput({side: 'from', value: ''});
    window.scrollTo({top: 0, behavior: 'smooth'});
  };

  // The stats, shared by the stat cards (A, C-3) and B's figure box.
  const bzePriceValue = hasBzePrice ? (
    // Three stats share a phone row: the price keeps 4 significant digits there.
    <>
      <chakra.span hideBelow="md">${formatUsdAmount(bzePrice)}</chakra.span>
      <chakra.span hideFrom="md">${formatUsdAmount(bzePrice.precision(4))}</chakra.span>
    </>
  ) : '—';
  const volumeValue = `$${shortNumberFormat(poolsVolume)}`;
  const poolsLabel = <><chakra.span hideBelow="md">Liquidity pools</chakra.span><chakra.span hideFrom="md">Pools</chakra.span></>;

  const usdLine = (amount: string, asset: AssetWithBalance | null) => {
    const usd = amount ? calculateUSDValue(amount, asset) : null;
    return usd ? (
        <chakra.span alignSelf="flex-end" fontSize="13px" color="hg.text.faint">≈ ${usd} USD</chakra.span>
    ) : null;
  };

  return (
      <Box position="relative" overflow="hidden">
        <HeroGlow />
        <PageContainer position="relative" zIndex="1" pt={{ base: '32px', md: '72px' }} pb="80px">
          {/* Desktop only, in the top padding: it never pushes the page down. */}
          <SwapLayoutSwitcher store={swapLayoutStore} position="absolute" top="14px" right={{ base: '16px', md: '24px' }} zIndex="2" />
          <Flex direction="column" gap={{ base: '40px', md: '56px' }}>
            {/*
              The top block in three layouts. B (centre stage) is the default and the only layout
              below lg; A and C-3 come from the switcher's attribute on <html>, read by CSS inside
              the lg media query only. The swap card is rendered once in every layout.
            */}
            <Grid
              data-testid="swap-top"
              templateColumns="minmax(0, 1fr)"
              templateAreas={`"hero" "card" "stats" "history"`}
              rowGap={{ base: '24px', lg: '28px' }}
              justifyItems="center"
              alignItems="start"
              css={{
                [inLayout('aligned')]: {
                  gridTemplateColumns: { lg: 'minmax(0, 1fr) 460px' },
                  gridTemplateRows: { lg: 'auto 1fr auto' },
                  gridTemplateAreas: { lg: `"hero card" "stats card" "history history"` },
                  columnGap: { lg: '56px' },
                  rowGap: { lg: '18px' },
                  justifyItems: { lg: 'stretch' },
                  alignItems: { lg: 'stretch' },
                },
                [inLayout('split')]: {
                  gridTemplateColumns: { lg: '460px minmax(0, 1fr)' },
                  gridTemplateRows: { lg: 'auto auto 1fr' },
                  gridTemplateAreas: { lg: `"hero hero" "card stats" "card history"` },
                  columnGap: { lg: '24px' },
                  rowGap: { lg: '16px' },
                  justifyItems: { lg: 'stretch' },
                  alignItems: { lg: 'stretch' },
                },
              }}
            >
              {/* B: centred stack. A: the left column's top. C-3: a title row, subtitle on the right. */}
              <GridItem
                area="hero"
                display="grid"
                gridTemplateAreas={`"eyebrow" "title" "subtitle"`}
                rowGap={{ base: '14px', md: '18px' }}
                justifyItems="center"
                alignContent="start"
                textAlign="center"
                w="100%"
                maxW="640px"
                css={{
                  [inLayout('aligned')]: { justifyItems: { lg: 'start' }, textAlign: { lg: 'start' }, maxW: { lg: 'none' } },
                  [inLayout('split')]: {
                    gridTemplateColumns: { lg: 'minmax(0, 1fr) auto' },
                    gridTemplateAreas: { lg: `"eyebrow subtitle" "title subtitle"` },
                    columnGap: { lg: '40px' },
                    rowGap: { lg: '12px' },
                    alignItems: { lg: 'end' },
                    justifyItems: { lg: 'start' },
                    textAlign: { lg: 'start' },
                    maxW: { lg: 'none' },
                    mb: { lg: '16px' },
                  },
                }}
              >
                <Box gridArea="eyebrow"><Eyebrow app="dex">BeeZee DEX</Eyebrow></Box>
                <chakra.h1
                  gridArea="title"
                  m="0"
                  textStyle="hero"
                  fontSize={{ base: '38px', md: '52px' }}
                  css={{
                    [inLayout('aligned')]: { fontSize: { lg: '60px' } },
                    [inLayout('split')]: { fontSize: { lg: '40px' } },
                  }}
                >
                  Swap tokens <GradientText>instantly</GradientText>
                </chakra.h1>
                <chakra.p
                  gridArea="subtitle"
                  m="0"
                  textStyle="subtitle"
                  color="fg.muted"
                  css={{
                    [inLayout('split')]: { justifySelf: { lg: 'end' }, textAlign: { lg: 'end' }, maxW: { lg: '440px' } },
                  }}
                >
                  {/* A keeps the long subtitle; B and C-3 use the short one. */}
                  <chakra.span css={showOnlyIn(['aligned'], 'inline')}>Swap, trade and earn on BeeZee. </chakra.span>
                  A swap fills right away from a liquidity pool, and the fees are shown before you sign.
                </chakra.p>
              </GridItem>

              <GridItem
                area="stats"
                w="100%"
                css={{ [inLayout('aligned')]: { alignSelf: { lg: 'end' } } }}
              >
                <StatStrip columns={3} css={showOnlyIn(['aligned', 'split'], 'grid')}>
                  <StatCard label="BZE price" value={bzePriceValue} loading={bzePriceLoading} />
                  <StatCard label="24h volume" value={volumeValue} loading={isLoading} />
                  <StatCard label={poolsLabel} value={tradeablePools.length} loading={isLoading} />
                </StatStrip>
                <StatFigures
                  figures={[
                    { label: 'BZE price', value: bzePriceValue, loading: bzePriceLoading },
                    { label: '24h volume', value: volumeValue, loading: isLoading },
                    { label: poolsLabel, value: tradeablePools.length, loading: isLoading },
                  ]}
                />
              </GridItem>

              {/* Your Recent Swaps; in C-3 it fills the column under the stats and scrolls inside. */}
              <GridItem
                area="history"
                w="100%"
                maxW="720px"
                display="flex"
                flexDirection="column"
                css={{
                  [inLayout('aligned')]: { maxW: { lg: 'none' } },
                  // The swap card alone sets the row height: the history sizes as if empty.
                  [inLayout('split')]: { maxW: { lg: 'none' }, contain: { lg: 'size' } },
                }}
              >
                {address ? (
                  <RecentSwapsCard groups={recentSwaps} isLoading={isLoadingHistory} />
                ) : (
                  <ConnectForSwaps />
                )}
              </GridItem>

              <GridItem
                area="card"
                position="relative"
                display="flex"
                flexDirection="column"
                gap="16px"
                w="100%"
                maxW="480px"
                css={{
                  [inLayout('aligned')]: { maxW: { lg: 'none' } },
                  [inLayout('split')]: { maxW: { lg: 'none' } },
                }}
              >
                {/* C-3: a faint accent halo behind the card. */}
                <Box
                  aria-hidden
                  position="absolute"
                  left="-40px"
                  top="-20px"
                  w="540px"
                  h="600px"
                  pointerEvents="none"
                  bgImage="radial-gradient(closest-side, var(--chakra-colors-app-subtle), transparent)"
                  css={showOnlyIn(['split'])}
                />

                {/* No Liquidity Pools Message */}
                {!isLoading && liquidAssets.length === 0 && (
                  <Notice status="info" title="No Liquidity Pools Available">
                    Liquidity pools will be created soon. Please check back later to start trading.
                  </Notice>
                )}

                {/* Swap Form: the featured card's 1 px gradient edge, a calmer 1.5 px edge and glow in C-3 */}
                <Box
                  data-testid="swap-card-edge"
                  position="relative"
                  p="1px"
                  borderRadius="17px"
                  bgImage="featuredEdge"
                  boxShadow="hg.featured"
                  css={{
                    [inLayout('split')]: {
                      p: { lg: '1.5px' },
                      borderRadius: { lg: '22px' },
                      boxShadow: { lg: SPLIT_CARD_GLOW },
                    },
                  }}
                >
                  <Box
                    h="100%"
                    bg="hg.card"
                    borderRadius="hg.lg"
                    p={{ base: '18px', md: '22px' }}
                    display="flex"
                    flexDirection="column"
                    gap="10px"
                    css={{ [inLayout('split')]: { borderRadius: { lg: '20.5px' } } }}
                  >
                    <Flex justify="space-between" align="center" mb="4px">
                      <Flex align="center" gap="8px">
                        <chakra.strong fontSize="17px" fontWeight="700">Swap</chakra.strong>
                        <VenueTag venue="amm" />
                      </Flex>
                      <chakra.span fontFamily="mono" fontSize="12px" color="hg.text.faint">Slippage {slippage}%</chakra.span>
                    </Flex>

                    {/* From Asset */}
                    <SwapSide
                      label="From"
                      balance={<HighlightText color="hg.text.faint">Balance: {fromAsset?.balanceFormatted ?? '0'}</HighlightText>}
                      selector={
                        <AssetSelector
                          asset={fromAsset}
                          onSelect={(asset) => setFromDenom(asset.denom)}
                          assetsWithBalanceInfo={assetsWithBalanceInfo}
                          isLoading={isLoading && assetsWithBalanceInfo.length === 0}
                        />
                      }
                      input={(id) => (
                        <AmountInput
                          id={id}
                          value={fromAmount}
                          onChange={(e) => handleFromAmountChange(sanitizeNumberInput(e.target.value))}
                        />
                      )}
                    >
                      <Flex gap="6px">
                        {[25, 50, 75].map((percentage) => (
                          <Button
                            key={percentage}
                            size="xs"
                            h="30px"
                            flex="1"
                            variant="outline"
                            borderColor="hg.hairline"
                            color="hg.text.muted"
                            fontWeight="500"
                            borderRadius="8px"
                            onClick={() => {
                              if (fromAsset) {
                                // Percentages of the spendable balance, so they match Max.
                                const amount = maxSpendable.displayAmount.multipliedBy(percentage).dividedBy(100);
                                handleFromAmountChange(amount.toFixed());
                              }
                            }}
                            disabled={!fromAsset || fromAsset.balance.lte(0)}
                          >
                            {percentage}%
                          </Button>
                        ))}
                        <Button
                          size="xs"
                          h="30px"
                          flex="1"
                          variant="outline"
                          borderColor="hg.hairline"
                          color="hg.text.muted"
                          fontWeight="500"
                          borderRadius="8px"
                          onClick={() => handleFromAmountChange(maxSpendable.inputValue)}
                          disabled={!fromAsset || fromAsset.balance.lte(0)}
                        >
                          Max
                        </Button>
                      </Flex>
                      {usdLine(fromAmount, fromAsset)}
                    </SwapSide>

                    {/* Swap Button */}
                    <Flex justify="center" position="relative" my="-18px" zIndex="1">
                      <chakra.button
                        type="button"
                        onClick={handleSwapAssets}
                        aria-label="Switch assets"
                        display="inline-flex"
                        alignItems="center"
                        justifyContent="center"
                        boxSize="40px"
                        borderRadius="12px"
                        borderWidth="4px"
                        borderColor="hg.card"
                        bgImage="app"
                        color="hg.buttonText"
                        cursor="pointer"
                        transition="transform 0.3s ease"
                        _hover={{ transform: "rotate(180deg)" }}
                        focusVisibleRing="outside"
                      >
                        <LuArrowUpDown size={16} />
                      </chakra.button>
                    </Flex>

                    {/* To Asset */}
                    <SwapSide
                      label="To"
                      balance={<HighlightText color="hg.text.faint">Balance: {toAsset?.balanceFormatted ?? '0'}</HighlightText>}
                      selector={
                        <AssetSelector
                          asset={toAsset}
                          onSelect={(asset) => setToDenom(asset.denom)}
                          assetsWithBalanceInfo={assetsWithBalanceInfo}
                          isLoading={isLoading && assetsWithBalanceInfo.length === 0}
                        />
                      }
                      input={(id) => (
                        <AmountInput
                          id={id}
                          value={toAmount}
                          onChange={(e) => handleToAmountChange(sanitizeNumberInput(e.target.value))}
                        />
                      )}
                    >
                      {usdLine(toAmount, toAsset)}
                    </SwapSide>

                    {/* Minimum Output & Price Impact */}
                    {fromAmount && routeResult && (
                      <Flex direction="column" gap="11px" mt="6px" px="16px" py="14px" borderRadius="14px" borderWidth="1px" borderColor="hg.hairline">
                        <Flex justify="space-between" align="flex-start" gap="12px" fontSize="14px">
                          <Flex direction="column" gap="2px">
                            <chakra.span color="hg.text.muted">Minimum Output</chakra.span>
                            <chakra.span fontSize="12px" color="hg.text.faint">
                              {slippage}% max slippage ·{' '}
                              <TextButton
                                color="hg.link"
                                aria-expanded={showSlippageEditor}
                                onClick={() => setShowSlippageEditor(!showSlippageEditor)}
                              >
                                {showSlippageEditor ? 'Close' : 'Change'}
                              </TextButton>
                            </chakra.span>
                          </Flex>
                          <chakra.strong textAlign="right">
                            {prettyAmount(uAmountToBigNumberAmount(
                              minimumSwapOutput(routeResult.expectedOutput, slippage) ?? toBigNumber(0),
                              toAsset?.decimals ?? 6
                            ).toFixed(toAsset?.decimals ?? 6))} {toAsset?.ticker || ''}
                          </chakra.strong>
                        </Flex>
                        {showSlippageEditor && (
                          <Flex
                            role="group"
                            aria-label="Max slippage"
                            direction="column"
                            gap="8px"
                            bg="hg.inset"
                            borderRadius="12px"
                            px="12px"
                            py="10px"
                          >
                            <Flex justify="space-between" fontSize="12px">
                              <chakra.span fontWeight="600" color="hg.text.faint">Max slippage</chakra.span>
                              <TextButton color="hg.text.muted" onClick={() => setShowSlippageEditor(false)}>
                                Done
                              </TextButton>
                            </Flex>
                            <Flex gap="6px" wrap="wrap">
                              {SLIPPAGE_PRESETS.map((preset) => {
                                const active = slippage === preset && !customSlippage;
                                return (
                                  <Button
                                    key={preset}
                                    size="xs"
                                    h="30px"
                                    px="10px"
                                    borderRadius="8px"
                                    fontSize="12px"
                                    {...(active
                                      ? { variant: hgVariant('primary'), boxShadow: 'none' }
                                      : { variant: 'outline' as const, borderColor: 'hg.lineStrong', color: 'hg.text.secondary' })}
                                    onClick={() => handleSlippagePreset(preset)}
                                    aria-pressed={active}
                                  >
                                    {preset}%
                                  </Button>
                                );
                              })}
                              <Input
                                placeholder="Custom %"
                                aria-label="Custom slippage percent"
                                value={customSlippage}
                                onChange={(e) => handleCustomSlippage(sanitizeNumberInput(e.target.value))}
                                size="xs"
                                h="30px"
                                w="90px"
                                borderRadius="8px"
                                bg="hg.card"
                                type="text"
                                inputMode="decimal"
                              />
                            </Flex>
                          </Flex>
                        )}
                        <SummaryRow label="Price Impact">
                          <PriceImpactBadge percent={routeResult.priceImpact} />
                        </SummaryRow>
                        <SummaryRow label="Swap Fee">
                          {routeResult.feesPerHop.length > 0 && uAmountToAmount(routeResult.feesPerHop[0], fromAsset?.decimals ?? 6)} {fromAsset?.ticker || ''}
                        </SummaryRow>
                        <FeeEstimateRow
                          size="sm"
                          label="Taker Fee"
                          fee={tradingFees.takerFee}
                          isLoading={tradingFeesLoading}
                          description="Fee paid to the network for executing the swap."
                          txKind={swapSpec}
                        />
                        <SummaryRow label="Rate">
                          1 {fromAsset?.ticker || ''} ≈ {
                            uAmountToBigNumberAmount(routeResult.expectedOutput, toAsset?.decimals ?? 6)
                              .dividedBy(toBigNumber(fromAmount))
                              .toFixed(toAsset?.decimals ?? 6)
                          } {toAsset?.ticker || ''}
                        </SummaryRow>
                      </Flex>
                    )}
                    {hasAmount && !routeResult && (
                      <Notice status="warning" title="No Route Found" />
                    )}

                    {/* Routes Section */}
                    {fromAmount && routeResult && (
                      <Box>
                        <chakra.button
                          type="button"
                          onClick={() => setShowRoutes(!showRoutes)}
                          aria-expanded={showRoutes}
                          display="flex"
                          w="full"
                          h="40px"
                          px="12px"
                          justifyContent="space-between"
                          alignItems="center"
                          border="0"
                          borderRadius="10px"
                          bg="transparent"
                          color="hg.text.secondary"
                          fontSize="13px"
                          fontWeight="600"
                          cursor="pointer"
                          _hover={{ bg: 'hg.hoverFill' }}
                          focusVisibleRing="inside"
                        >
                          Trade Route ({routeResult.pools.length} hop{routeResult.pools.length > 1 ? 's' : ''})
                          {showRoutes ? <LuChevronUp size={16} /> : <LuChevronDown size={16} />}
                        </chakra.button>

                        <Collapsible.Root open={showRoutes}>
                          <Collapsible.Content>
                            {/* Route Path */}
                            <Flex mt="6px" wrap="wrap" gap="8px" align="center" justify="center" bg="hg.inset" borderRadius="12px" p="14px">
                              {routeResult.path.map((denom, index) => {
                                const asset = getAsset(denom);
                                const isLast = index === routeResult.path.length - 1;
                                const pool = !isLast ? routeResult.pools[index] : null;

                                return (
                                  <Flex key={index} align="center" gap="8px">
                                    {/* Asset */}
                                    <Tooltip
                                      content={`${asset?.name || denomTicker(denom)}${pool ? ` → Pool ${denomTicker(pool.base)}/${denomTicker(pool.quote)}` : ''}`}
                                      showArrow
                                    >
                                      <Flex
                                        align="center"
                                        gap="6px"
                                        h="30px"
                                        pl="4px"
                                        pr="10px"
                                        borderRadius="full"
                                        borderWidth="1px"
                                        borderColor="hg.lineStrong"
                                        bg="hg.card"
                                        fontSize="13px"
                                        fontWeight="600"
                                      >
                                        <TokenLogo
                                          src={asset?.logo || ''}
                                          symbol={denomTicker(denom)}
                                          size="5"
                                          circular={true}
                                        />
                                        {denomTicker(denom)}
                                      </Flex>
                                    </Tooltip>

                                    {/* Arrow with pool info */}
                                    {!isLast && pool && (
                                      <Flex direction="column" align="center" gap="1px" color="hg.text.faint">
                                        <LuArrowRight size={14} aria-hidden="true" />
                                        <chakra.span fontSize="11px">
                                          {toBigNumber(pool.fee).multipliedBy(100).toFixed(2)}%
                                        </chakra.span>
                                      </Flex>
                                    )}
                                  </Flex>
                                );
                              })}
                            </Flex>
                          </Collapsible.Content>
                        </Collapsible.Root>
                      </Box>
                    )}

                    {/* Insufficient Balance Warning */}
                    {hasInsufficientBalance && (
                      <Notice status="danger" title="Insufficient Balance">
                        You have {fromAsset?.balanceFormatted || '0'} {fromAsset?.ticker || ''}
                      </Notice>
                    )}

                    {/* Balance covers the amount but not the fees on top of it */}
                    {hasFeeShortfall && (
                      <Notice status="danger" title="Not enough left for fees">
                        {affordability.message || 'Your balance does not cover the swap plus its fees.'}
                      </Notice>
                    )}

                    {/* Swap Button */}
                    <Button
                      variant={hgVariant('primary')}
                      size="xl"
                      w="full"
                      h="52px"
                      mt="6px"
                      borderRadius="14px"
                      fontSize="16px"
                      fontWeight="700"
                      disabled={!canSubmit}
                      loading={isSubmitting}
                      loadingText={progressTrack || 'Submitting...'}
                      onClick={handleSwapSubmit}
                    >
                      {!hasAmount
                        ? 'Enter Amount'
                        : !routeResult
                          ? 'No Route Available'
                          : 'Swap'}
                    </Button>
                  </Box>
                </Box>
              </GridItem>
            </Grid>

            {/* The two ways to trade on the DEX */}
            <Flex as="section" direction="column" gap="16px" aria-labelledby="two-ways">
              <chakra.h2 id="two-ways" m="0" fontSize="22px" fontWeight="700">Two ways to trade</chakra.h2>
              <Grid templateColumns={{ base: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }} gap="16px">
                <Box p="1px" borderRadius="hg.lg" bgImage="featuredEdge">
                  <Flex direction="column" gap="16px" h="100%" bg="hg.card" borderRadius="hg.lg" p={{ base: '20px', md: '24px' }}>
                    <Flex align="center" justify="space-between" gap="12px">
                      <VenueTitle venue="amm" title="Swap" />
                      <chakra.span flex="none" fontSize="12px" fontWeight="600" px="10px" py="4px" borderRadius="full" bgImage="app" color="hg.buttonText">
                        You&apos;re here
                      </chakra.span>
                    </Flex>
                    <chakra.p m="0" fontSize="15px" lineHeight="1.55" color="hg.text.secondary">
                      Trade against a liquidity pool. Pick two tokens, the pool sets the price and the swap fills at once.
                    </chakra.p>
                    <Flex as="ul" direction="column" gap="8px" m="0" p="0" listStyleType="none" fontSize="14px" color="hg.text.muted">
                      <WayBullet>Fills instantly, no waiting for a match</WayBullet>
                      <WayBullet>Price set by the pool, slippage shown upfront</WayBullet>
                      <WayBullet>Best for quick, everyday trades</WayBullet>
                    </Flex>
                  </Flex>
                </Box>
                <HgCard display="flex" flexDirection="column" gap="16px">
                  <VenueTitle venue="orderbook" title="Exchange" />
                  <chakra.p m="0" fontSize="15px" lineHeight="1.55" color="hg.text.secondary">
                    Trade on a market&apos;s order book. Place a limit order at your own price, or fill orders already on the book.
                  </chakra.p>
                  <Flex as="ul" direction="column" gap="8px" m="0" p="0" listStyleType="none" fontSize="14px" color="hg.text.muted">
                    <WayBullet square>Name your price, wait for a match</WayBullet>
                    <WayBullet square>See buy and sell depth before you trade</WayBullet>
                    <WayBullet square>Best for larger or patient trades</WayBullet>
                  </Flex>
                  <Button asChild variant={hgVariant('secondary')} size="lg" alignSelf="flex-start">
                    <NextLink href="/exchange">Open the exchange →</NextLink>
                  </Button>
                </HgCard>
              </Grid>
            </Flex>

            {/* Top pools and order-book markets */}
            <Grid templateColumns={{ base: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }} gap="16px">
              <HgCard p="20px" display="flex" flexDirection="column" gap="6px">
                <ListHeader title="Top pools" venue="Swap" href="/pools" linkText="All pools →" />
                {topPools.length === 0 && (
                  <chakra.span px="4px" fontSize="14px" color="hg.text.muted">No liquidity pools yet</chakra.span>
                )}
                {topPools.map(pool => {
                  const pair = `${denomTicker(pool.base)} / ${denomTicker(pool.quote)}`;
                  const liquidity = poolsData?.get(pool.id)?.usdValue;
                  return (
                    <ListRow
                      key={pool.id}
                      lead={
                        <LPTokenLogo
                          baseAssetLogo={getAsset(pool.base)?.logo || ''}
                          quoteAssetLogo={getAsset(pool.quote)?.logo || ''}
                          baseAssetSymbol={denomTicker(pool.base)}
                          quoteAssetSymbol={denomTicker(pool.quote)}
                          size="6"
                        />
                      }
                      title={pair}
                      meta={liquidity ? `Liquidity $${shortNumberFormat(liquidity)}` : null}
                      action={
                        <Button
                          size="sm"
                          h="32px"
                          px="12px"
                          borderRadius="8px"
                          bg="app.subtle"
                          color="hg.link"
                          _hover={{ bg: 'app.muted' }}
                          aria-label={`Swap ${pair}`}
                          onClick={() => handlePickPool(pool.base, pool.quote)}
                        >
                          Swap
                        </Button>
                      }
                    />
                  );
                })}
              </HgCard>
              <HgCard p="20px" display="flex" flexDirection="column" gap="6px">
                <ListHeader title="Order-book markets" venue="Exchange" href="/exchange" linkText="All markets →" />
                {topMarkets.length === 0 && (
                  <chakra.span px="4px" fontSize="14px" color="hg.text.muted">No markets yet</chakra.span>
                )}
                {topMarkets.map(market => {
                  const pair = `${denomTicker(market.base)} / ${denomTicker(market.quote)}`;
                  const lastPrice = getMarketData(createMarketId(market.base, market.quote))?.last_price;
                  return (
                    <ListRow
                      key={market.base + market.quote}
                      lead={
                        <LPTokenLogo
                          data-testid="market-pair-logo"
                          baseAssetLogo={getAsset(market.base)?.logo || ''}
                          quoteAssetLogo={getAsset(market.quote)?.logo || ''}
                          baseAssetSymbol={denomTicker(market.base)}
                          quoteAssetSymbol={denomTicker(market.quote)}
                          size="6"
                        />
                      }
                      title={pair}
                      meta={lastPrice ? `Last ${lastPrice} ${denomTicker(market.quote)}` : null}
                      action={
                        <Button asChild variant={hgVariant('secondary')} size="sm" h="32px" px="12px" borderRadius="8px">
                          <NextLink href={marketPagePath(market.base, market.quote)} aria-label={`Trade ${pair}`}>Trade</NextLink>
                        </Button>
                      }
                    />
                  );
                })}
              </HgCard>
            </Grid>
          </Flex>
        </PageContainer>
      </Box>
  );
}
