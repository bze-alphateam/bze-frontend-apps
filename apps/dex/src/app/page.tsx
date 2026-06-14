'use client';

import {
  Box,
  Button,
  Card,
  Container,
  HStack,
  VStack,
  Text,
  Input,
  Collapsible,
  Badge,
  Flex,
  Select,
  createListCollection,
  Alert,
} from '@chakra-ui/react';
import {
  LuArrowUpDown,
  LuSettings,
  LuChevronDown,
  LuChevronUp,
  LuArrowRight,
  LuInfo,
} from 'react-icons/lu';
import { useState, useMemo, memo, useEffect } from 'react';
import {useAssets, useBalances, prettyAmount, uAmountToBigNumberAmount, amountToBigNumberUAmount, toBigNumber, uAmountToAmount, ammRouter, SwapRouteResult, useToast, useBZETx, getChainName, useAssetsValue, HighlightText, sanitizeNumberInput, getAddressSwapHistory, SwapHistory, addDebounce, useLiquidityPools, TokenLogo, Tooltip} from "@bze/bze-ui-kit";
import BigNumber from 'bignumber.js';
import {bze} from "@bze/bzejs";
import {useChain} from "@interchain-kit/react";

const slippagePresets = [0.5, 1, 2];

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
  placeholder,
  assetsWithBalanceInfo,
  isLoading,
}: {
  asset: AssetWithBalance | null;
  onSelect: (asset: AssetWithBalance) => void;
  placeholder: string;
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
    return <Box>Loading...</Box>;
  }

  if (!asset) {
    return <Box>No asset available</Box>
  }

  return (
      <Select.Root
          collection={collection}
          value={[asset.denom]}
          open={isOpen}
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
          <Card.Root
            variant="outline"
            p="4"
            cursor="pointer"
            bgGradient="to-br"
            gradientFrom="blue.500/8"
            gradientTo="blue.600/8"
            borderColor="blue.500/20"
            _hover={{
              gradientFrom: "blue.500/12",
              gradientTo: "blue.600/12",
              borderColor: "blue.500/30"
            }}
            transition="all 0.2s"
          >
            <VStack align="start" gap="3" w="full">
              <Text fontSize="sm" color="fg.muted">
                {placeholder}
              </Text>
              <HStack justify="space-between" w="full">
                <HStack gap="3">
                  <TokenLogo
                      src={asset.logo}
                      symbol={asset.ticker}
                      size="8"
                      circular={true}
                  />
                  <VStack align="start" gap="1">
                    <HStack gap="2">
                      <Text fontWeight="bold" fontSize="lg">
                        {asset.ticker}
                      </Text>
                      <Text fontSize="md" color="fg.muted">
                        {asset.name}
                      </Text>
                    </HStack>
                    <Text fontSize="sm" color="fg.muted">
                      Balance: {asset.balanceFormatted}
                    </Text>
                  </VStack>
                </HStack>
                <LuChevronDown />
              </HStack>
            </VStack>
          </Card.Root>
        </Select.Trigger>
        <Select.Positioner>
          <Select.Content maxH="400px" overflowY="auto" background={"bg.muted"}>
            <Box p="3" borderBottomWidth="1px">
              <Input
                  placeholder="Search assets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  size="sm"
                  autoFocus
              />
            </Box>
            <Box maxH="300px" overflowY="auto">
              {filteredAssets.length > 0 ? (
                  filteredAssets.map((assetOption) => (
                      <Select.Item
                          key={assetOption.denom}
                          item={assetOption.denom}
                          cursor="pointer"
                          _hover={{ bg: "bg.panel" }}
                      >
                        <Select.ItemText>
                          <HStack gap="3" py="2">
                            <TokenLogo
                                src={assetOption.logo}
                                symbol={assetOption.ticker}
                                size="8"
                                circular={true}
                            />
                            <VStack align="start" gap="0" flex="1">
                              <HStack gap={2} w="full">
                                <Text fontWeight="medium" fontSize="md">
                                  {assetOption.ticker}
                                </Text>
                                <Text fontSize="sm" color="fg.muted">
                                  {assetOption.name}
                                </Text>
                              </HStack>
                              <HighlightText fontSize="sm" color="fg.muted">
                                Balance: {assetOption.balanceFormatted}
                              </HighlightText>
                            </VStack>
                          </HStack>
                        </Select.ItemText>
                        <Select.ItemIndicator />
                      </Select.Item>
                  ))
              ) : (
                  <Box p="4" textAlign="center">
                    <Text fontSize="sm" color="fg.muted">
                      No assets found
                    </Text>
                  </Box>
              )}
            </Box>
            {!searchTerm && assetsWithBalanceInfo.length > 10 && (
                <Box p="2" borderTopWidth="1px" textAlign="center">
                  <Text fontSize="xs" color="fg.muted">
                    Showing first 10 assets. Search to find more.
                  </Text>
                </Box>
            )}
          </Select.Content>
        </Select.Positioner>
      </Select.Root>
  );
});

AssetSelector.displayName = 'AssetSelector';

export default function SwapPage() {
  const { denomTicker, getAsset } = useAssets();
  const { getBalanceByDenom } = useBalances();
  const { pools, liquidAssets, isLoading } = useLiquidityPools();
  const {toast} = useToast()
  const {tx, progressTrack} = useBZETx()
  const {address} = useChain(getChainName())
  const {denomUsdValue} = useAssetsValue()

  // Update AMM router whenever pools change
  useEffect(() => {
    if (pools && pools.length > 0) {
      ammRouter.updatePools(pools);
    }
  }, [pools]);

  // Get assets with balance information for display
  const assetsWithBalanceInfo = useMemo(() => {
    const assetsWithBalance = liquidAssets.map(asset => {
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
  }, [liquidAssets, getBalanceByDenom]);

  const [fromAsset, setFromAsset] = useState<typeof assetsWithBalanceInfo[0] | null>(null);
  const [toAsset, setToAsset] = useState<typeof assetsWithBalanceInfo[0] | null>(null);
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showRoutes, setShowRoutes] = useState(false);
  const [slippage, setSlippage] = useState(0.5);
  const [customSlippage, setCustomSlippage] = useState('');
  const [routeResult, setRouteResult] = useState<SwapRouteResult | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [swapHistory, setSwapHistory] = useState<SwapHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Set default assets once they're loaded
  useMemo(() => {
    if (assetsWithBalanceInfo.length > 0 && !fromAsset) {
      setFromAsset(assetsWithBalanceInfo[0]);
    }
    if (assetsWithBalanceInfo.length > 1 && !toAsset) {
      setToAsset(assetsWithBalanceInfo[1]);
    }
  }, [assetsWithBalanceInfo, fromAsset, toAsset]);

  // Sync selected assets with updated balance info
  useEffect(() => {
    if (fromAsset) {
      const updatedFromAsset = assetsWithBalanceInfo.find(a => a.denom === fromAsset.denom);
      if (updatedFromAsset && updatedFromAsset.balance.toString() !== fromAsset.balance.toString()) {
        setFromAsset(updatedFromAsset);
      }
    }
    if (toAsset) {
      const updatedToAsset = assetsWithBalanceInfo.find(a => a.denom === toAsset.denom);
      if (updatedToAsset && updatedToAsset.balance.toString() !== toAsset.balance.toString()) {
        setToAsset(updatedToAsset);
      }
    }
  }, [assetsWithBalanceInfo, fromAsset, toAsset]);

  // Recalculate route when assets change
  useEffect(() => {
    // Only recalculate if we have a fromAmount and both assets are selected
    if (!fromAmount || !fromAsset || !toAsset) {
      return;
    }

    // Don't recalculate if same asset
    if (fromAsset.denom === toAsset.denom) {
      setRouteResult(null);
      setToAmount('');
      return;
    }

    // Recalculate the route with the current fromAmount
    const amount = toBigNumber(fromAmount);
    if (amount.isNaN() || amount.lte(0)) {
      return;
    }

    const amountInMicro = amountToBigNumberUAmount(amount, fromAsset.decimals);
    setIsCalculatingRoute(true);

    setTimeout(() => {
      try {
        const route = ammRouter.findOptimalRoute(
          fromAsset.denom,
          toAsset.denom,
          amountInMicro,
          3,
          true
        );

        if (route) {
          setRouteResult(route);
          const outputAmount = uAmountToBigNumberAmount(route.expectedOutput, toAsset.decimals);
          setToAmount(outputAmount.toFixed(toAsset.decimals));
        } else {
          setRouteResult(null);
          setToAmount('');
        }
      } catch (error) {
        console.error('Error recalculating route after asset change:', error);
        setRouteResult(null);
        setToAmount('');
      } finally {
        setIsCalculatingRoute(false);
      }
    }, 0);
  }, [fromAmount, fromAsset, toAsset]);

  // Handle fromAmount changes - calculate toAmount
  const handleFromAmountChange = (value: string) => {
    setFromAmount(value);

    // Reset if no valid input
    if (!fromAsset || !toAsset || !value) {
      setRouteResult(null);
      setToAmount('');
      return;
    }

    // Don't calculate if same asset
    if (fromAsset.denom === toAsset.denom) {
      setRouteResult(null);
      setToAmount('');
      return;
    }

    // Parse and validate amount
    const amount = toBigNumber(value);
    if (amount.isNaN() || amount.lte(0)) {
      setRouteResult(null);
      setToAmount('');
      return;
    }

    // Convert to micro amount and find route
    const amountInMicro = amountToBigNumberUAmount(amount, fromAsset.decimals);
    setIsCalculatingRoute(true);

    setTimeout(() => {
      try {
        const route = ammRouter.findOptimalRoute(
          fromAsset.denom,
          toAsset.denom,
          amountInMicro,
          3,
          true
        );

        if (route) {
          setRouteResult(route);
          const outputAmount = uAmountToBigNumberAmount(route.expectedOutput, toAsset.decimals);
          setToAmount(outputAmount.toFixed(toAsset.decimals));
        } else {
          setRouteResult(null);
          setToAmount('');
        }
      } catch (error) {
        console.error('Error calculating route:', error);
        setRouteResult(null);
        setToAmount('');
      } finally {
        setIsCalculatingRoute(false);
      }
    }, 0);
  };

  // Handle toAmount changes - calculate fromAmount (reverse)
  const handleToAmountChange = (value: string) => {
    setToAmount(value);

    // Reset if no valid input
    if (!fromAsset || !toAsset || !value) {
      setRouteResult(null);
      return;
    }

    // Don't calculate if same asset
    if (fromAsset.denom === toAsset.denom) {
      setRouteResult(null);
      return;
    }

    // Parse and validate amount
    const desiredOutput = toBigNumber(value);
    if (desiredOutput.isNaN() || desiredOutput.lte(0)) {
      setRouteResult(null);
      return;
    }

    setIsCalculatingRoute(true);

    // Binary search to find input amount that gives desired output
    setTimeout(() => {
      try {
        const desiredOutputMicro = amountToBigNumberUAmount(desiredOutput, toAsset.decimals);
        let low = toBigNumber(0);
        let high = desiredOutputMicro.multipliedBy(10);
        let iterations = 0;
        const maxIterations = 30;
        const tolerance = toBigNumber(0.0001);

        let bestInput = toBigNumber(0);
        let bestRoute: SwapRouteResult | null = null;

        while (iterations < maxIterations && high.minus(low).dividedBy(high).gt(tolerance)) {
          const mid = low.plus(high).dividedBy(2);
          const route = ammRouter.findOptimalRoute(fromAsset.denom, toAsset.denom, mid, 3, true);

          if (route) {
            const diff = route.expectedOutput.minus(desiredOutputMicro);

            if (diff.abs().dividedBy(desiredOutputMicro).lte(tolerance)) {
              bestInput = mid;
              bestRoute = route;
              break;
            } else if (diff.lt(0)) {
              low = mid;
            } else {
              high = mid;
              bestInput = mid;
              bestRoute = route;
            }
          } else {
            high = mid;
          }

          iterations++;
        }

        if (bestRoute) {
          setRouteResult(bestRoute);
          const inputAmount = uAmountToBigNumberAmount(bestInput, fromAsset.decimals);
          setFromAmount(inputAmount.toFixed(fromAsset.decimals));
        } else {
          setRouteResult(null);
          setFromAmount('');
        }
      } catch (error) {
        console.error('Error calculating reverse route:', error);
        setRouteResult(null);
        setFromAmount('');
      } finally {
        setIsCalculatingRoute(false);
      }
    }, 0);
  };

  // Check if user has sufficient balance
  const hasInsufficientBalance = useMemo(() => {
    if (!fromAsset || !fromAmount) return false;
    const amount = new BigNumber(fromAmount);
    if (amount.isNaN() || amount.lte(0)) return false;
    return amount.gt(fromAsset.balance);
  }, [fromAsset, fromAmount]);

  // Determine if swap can be submitted
  const canSubmit = useMemo(() => {
    // Must have valid amount
    if (!fromAmount) return false;
    const amount = parseFloat(fromAmount);
    if (isNaN(amount) || amount <= 0) return false;

    // Must have selected different assets
    if (!fromAsset || !toAsset) return false;
    if (fromAsset.denom === toAsset.denom) return false;

    // Must have sufficient balance
    if (hasInsufficientBalance) return false;

    // Must have a valid route
    if (!routeResult) return false;

    // Must not be calculating
    if (isCalculatingRoute) return false;

    return true;
  }, [fromAmount, fromAsset, toAsset, hasInsufficientBalance, routeResult, isCalculatingRoute]);

  const handleSwapAssets = () => {
    const tempAsset = fromAsset;
    const tempAmount = fromAmount;

    // Swap assets
    setFromAsset(toAsset);
    setToAsset(tempAsset);

    // Swap amounts
    setFromAmount(toAmount);
    setToAmount(tempAmount);

    // Recalculate route with swapped values
    // We need to trigger recalculation after state updates
    setTimeout(() => {
      if (toAmount) {
        handleFromAmountChange(toAmount);
      }
    }, 0);
  };

  const handleSlippagePreset = (value: number) => {
    setSlippage(value);
    setCustomSlippage('');
  };

  const handleCustomSlippage = (value: string) => {
    setCustomSlippage(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 50) {
      setSlippage(numValue);
    }
  };

  // Function to refresh swap history
  const refreshSwapHistory = async () => {
    if (!address) {
      setSwapHistory([]);
      return;
    }

    setIsLoadingHistory(true);
    try {
      const history = await getAddressSwapHistory(address);
      if (history) {
        setSwapHistory(history);
      }
    } catch (error) {
      console.error('Error fetching swap history:', error);
      setSwapHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Fetch swap history when address changes
  useEffect(() => {
    refreshSwapHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const handleSwapSubmit = async () => {
    if (!address) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!fromAsset || !toAsset || !routeResult || !fromAmount) {
      toast.error('Missing required data for swap');
      return;
    }

    try {
      // 1. Convert fromAmount to micro amount
      const amountIn = amountToBigNumberUAmount(fromAmount, fromAsset.decimals);

      // 2. Calculate minimum output based on slippage tolerance
      // slippage is in percentage (e.g., 2 for 2%)
      const slippageMultiplier = toBigNumber(1).minus(toBigNumber(slippage).dividedBy(100));
      const minAmountOut = routeResult.expectedOutput.multipliedBy(slippageMultiplier);

      // 3. Create multiSwap message
      const {multiSwap} = bze.tradebin.MessageComposer.withTypeUrl;
      setIsSubmitting(true)
      const msg = multiSwap({
        creator: address,
        routes: routeResult.route,
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
          setFromAmount('');
          setToAmount('');
          setRouteResult(null);
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

    const usdValue = denomUsdValue(asset.denom, toBigNumber(amount));

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

  return (
      <Box minH="100vh" bg="bg.subtle">
        <Container maxW="lg" py="12">
          <VStack gap="6" align="stretch">
            {/* Page Header */}
            <VStack gap="2" align="center" mb="4">
              <Text fontSize="3xl" fontWeight="bold" letterSpacing="tight">
                Swap Assets
              </Text>
              <Text fontSize="sm" color="fg.muted">
                Trade tokens instantly with the best rates
              </Text>
            </VStack>

            {/* No Liquidity Pools Message */}
            {!isLoading && liquidAssets.length === 0 && (
              <Alert.Root status="info">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>No Liquidity Pools Available</Alert.Title>
                  <Alert.Description>
                    Liquidity pools will be created soon. Please check back later to start trading.
                  </Alert.Description>
                </Alert.Content>
              </Alert.Root>
            )}

            {/* Swap Form */}
            <Card.Root
              maxW="480px"
              mx="auto"
              w="full"
              borderWidth="1px"
              shadow="lg"
              bgGradient="to-br"
              gradientFrom="blue.500/5"
              gradientTo="blue.600/5"
              borderColor="blue.500/20"
            >
              <VStack gap="1" align="stretch">
                {/* Header with Settings */}
                <HStack justify="space-between" align="center" px="6" pt="6" pb="4">
                  <Text fontSize="lg" fontWeight="semibold">
                    Swap
                  </Text>
                  <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSettings(!showSettings)}
                      colorPalette="gray"
                  >
                    <LuSettings />
                  </Button>
                </HStack>

                {/* Settings Panel */}
                <Collapsible.Root open={showSettings}>
                  <Collapsible.Content>
                    <Box px="6" pb="4">
                      <Card.Root
                        variant="subtle"
                        p="4"
                        bgGradient="to-br"
                        gradientFrom="blue.500/10"
                        gradientTo="teal.500/10"
                        borderWidth="1px"
                        borderColor="blue.500/20"
                      >
                        <VStack gap="4" align="stretch">
                          <Box>
                            <Text fontSize="sm" fontWeight="semibold" mb="3" color="fg.muted">
                              Max Slippage: <Text as="span" color="fg.default">{slippage}%</Text>
                            </Text>
                            <HStack gap="2" mb="3" flexWrap="wrap">
                              {slippagePresets.map((preset) => (
                                  <Button
                                      key={preset}
                                      size="sm"
                                      variant={slippage === preset && !customSlippage ? "solid" : "outline"}
                                      onClick={() => handleSlippagePreset(preset)}
                                      colorPalette={slippage === preset && !customSlippage ? "blue" : "gray"}
                                  >
                                    {preset}%
                                  </Button>
                              ))}
                            </HStack>
                            <Input
                                placeholder="Custom %"
                                value={customSlippage}
                                onChange={(e) => handleCustomSlippage(sanitizeNumberInput(e.target.value))}
                                size="sm"
                                type="text"
                                min="0"
                                max="50"
                                step="0.1"
                            />
                          </Box>

                          {/*TODO: integrate order book in swap AFTER we change tradebin create order message to drop the order if not executed immediately */}
                          {/*<HStack justify="space-between" align="center" pt="2">*/}
                          {/*  <Tooltip*/}
                          {/*      content="The app will try to match order book pairs for best prices"*/}
                          {/*      showArrow*/}
                          {/*  >*/}
                          {/*    <HStack gap="2">*/}
                          {/*      <LuInfo size={16} />*/}
                          {/*      <Text fontSize="sm" fontWeight="medium">Use Order Book</Text>*/}
                          {/*    </HStack>*/}
                          {/*  </Tooltip>*/}
                          {/*  <Switch.Root*/}
                          {/*      checked={useOrderBook}*/}
                          {/*      onCheckedChange={(details) => {*/}
                          {/*        console.log('Switch changed:', details);*/}
                          {/*        setUseOrderBook(details.checked);*/}
                          {/*      }}*/}
                          {/*      colorPalette="blue"*/}
                          {/*  >*/}
                          {/*    <Switch.Control>*/}
                          {/*      <Switch.Thumb />*/}
                          {/*    </Switch.Control>*/}
                          {/*    <Switch.HiddenInput />*/}
                          {/*  </Switch.Root>*/}
                          {/*</HStack>*/}
                        </VStack>
                      </Card.Root>
                    </Box>
                  </Collapsible.Content>
                </Collapsible.Root>

                {/* From Asset */}
                <Box px="6" py="2">
                  <VStack gap="3" align="stretch">
                    <AssetSelector
                        asset={fromAsset}
                        onSelect={setFromAsset}
                        placeholder="From"
                        assetsWithBalanceInfo={assetsWithBalanceInfo}
                        isLoading={isLoading && assetsWithBalanceInfo.length === 0}
                    />
                    <Box
                      bgGradient="to-br"
                      gradientFrom="blue.500/10"
                      gradientTo="blue.600/10"
                      borderRadius="lg"
                      p="4"
                      borderWidth="1px"
                      borderColor="blue.500/25"
                    >
                      <VStack gap="3" align="stretch">
                        <HStack gap="2">
                          <Input
                              placeholder="0.0"
                              value={fromAmount}
                              onChange={(e) => handleFromAmountChange(sanitizeNumberInput(e.target.value))}
                              fontSize="2xl"
                              fontWeight="semibold"
                              textAlign="right"
                              variant="flushed"
                              border="none"
                              px="0"
                              _focus={{ border: "none" }}
                              flex="1"
                          />
                          <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleFromAmountChange(fromAsset?.balance.toString() || '0')}
                              disabled={!fromAsset || fromAsset.balance.lte(0)}
                              colorPalette="blue"
                          >
                            MAX
                          </Button>
                        </HStack>
                        <HStack justify="space-between" gap="2">
                          {[25, 50, 75, 100].map((percentage) => (
                              <Button
                                  key={percentage}
                                  size="xs"
                                  variant="outline"
                                  onClick={() => {
                                    if (fromAsset) {
                                      const amount = fromAsset.balance.multipliedBy(percentage).dividedBy(100);
                                      handleFromAmountChange(amount.toString());
                                    }
                                  }}
                                  disabled={!fromAsset || fromAsset.balance.lte(0)}
                                  colorPalette="gray"
                                  flex="1"
                              >
                                {percentage}%
                              </Button>
                          ))}
                        </HStack>
                      </VStack>
                      {fromAmount && calculateUSDValue(fromAmount, fromAsset) && (
                          <Text fontSize="sm" color="fg.muted" textAlign="right" mt="2">
                            ≈ ${calculateUSDValue(fromAmount, fromAsset)} USD
                          </Text>
                      )}
                    </Box>
                  </VStack>
                </Box>

                {/* Swap Button */}
                <Flex justify="center" position="relative" my="-2">
                  <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSwapAssets}
                      borderRadius="full"
                      p="2"
                      h="10"
                      w="10"
                      bg="bg.panel"
                      borderWidth="4px"
                      borderColor="bg.panel"
                      shadow="sm"
                      _hover={{
                        transform: "rotate(180deg)",
                        transition: "transform 0.3s ease"
                      }}
                      transition="transform 0.3s ease"
                  >
                    <LuArrowUpDown />
                  </Button>
                </Flex>

                {/* To Asset */}
                <Box px="6" py="2">
                  <VStack gap="3" align="stretch">
                    <AssetSelector
                        asset={toAsset}
                        onSelect={setToAsset}
                        placeholder="To"
                        assetsWithBalanceInfo={assetsWithBalanceInfo}
                        isLoading={isLoading && assetsWithBalanceInfo.length === 0}
                    />
                    <Box
                      bgGradient="to-br"
                      gradientFrom="blue.500/10"
                      gradientTo="cyan.500/10"
                      borderRadius="lg"
                      p="4"
                      borderWidth="1px"
                      borderColor="blue.500/25"
                    >
                      <Input
                          placeholder="0.0"
                          value={toAmount}
                          onChange={(e) => handleToAmountChange(sanitizeNumberInput(e.target.value))}
                          fontSize="2xl"
                          fontWeight="semibold"
                          textAlign="right"
                          variant="flushed"
                          border="none"
                          px="0"
                          _focus={{ border: "none" }}
                      />
                      {toAmount && calculateUSDValue(toAmount, toAsset) && (
                          <Text fontSize="sm" color="fg.muted" textAlign="right" mt="1">
                            ≈ ${calculateUSDValue(toAmount, toAsset)} USD
                          </Text>
                      )}
                    </Box>
                  </VStack>
                </Box>

                {/* Minimum Output & Price Impact */}
                {fromAmount && routeResult && (
                    <Box px="6" pt="2">
                      <Card.Root
                        variant="subtle"
                        p="4"
                        borderRadius="lg"
                        bgGradient="to-br"
                        gradientFrom="green.500/8"
                        gradientTo="blue.500/8"
                        borderWidth="1px"
                        borderColor="green.500/20"
                      >
                        <VStack gap="3" align="stretch">
                          <HStack justify="space-between">
                            <Text fontSize="sm" color="fg.muted" fontWeight="medium">
                              Minimum Output
                            </Text>
                            <Text fontSize="sm" fontWeight="semibold">
                              {prettyAmount(uAmountToBigNumberAmount(
                                routeResult.expectedOutput.multipliedBy(
                                  toBigNumber(1).minus(toBigNumber(slippage).dividedBy(100))
                                ),
                                toAsset?.decimals ?? 6
                              ).toFixed(toAsset?.decimals ?? 6))} {toAsset?.ticker || ''}
                            </Text>
                          </HStack>
                          <HStack justify="space-between">
                            <Text fontSize="sm" color="fg.muted" fontWeight="medium">
                              Price Impact
                            </Text>
                            <Badge
                              colorPalette={routeResult.priceImpact.gt(1) ? 'red' : routeResult.priceImpact.gt(0.5) ? 'yellow' : 'green'}
                              variant="subtle"
                            >
                              {routeResult.priceImpact.toFixed(2)}%
                            </Badge>
                          </HStack>
                          <HStack justify="space-between">
                            <Text fontSize="sm" color="fg.muted" fontWeight="medium">
                              Swap Fee
                            </Text>
                            <Text fontSize="sm" fontWeight="medium">
                              {routeResult.feesPerHop.length > 0 && uAmountToAmount(routeResult.feesPerHop[0], fromAsset?.decimals ?? 6)} {fromAsset?.ticker || ''}
                            </Text>
                          </HStack>
                          <HStack justify="space-between">
                            <Tooltip
                              content="This fee is paid to the network. Starting with network upgrade 8.1.0, you will be able to pay it in your preferred token."
                              showArrow
                              openDelay={100}
                            >
                              <Box as="span" display="inline-flex" alignItems="center" gap="1" cursor="help">
                                <Text fontSize="sm" color="fg.muted" fontWeight="medium">
                                  Taker Fee
                                </Text>
                                <LuInfo size={14} color="var(--chakra-colors-fg-muted)" />
                              </Box>
                            </Tooltip>
                            <Text fontSize="sm" fontWeight="medium">
                              0.1 BZE
                            </Text>
                          </HStack>
                          <HStack justify="space-between">
                            <Text fontSize="sm" color="fg.muted" fontWeight="medium">
                              Rate
                            </Text>
                            <Text fontSize="sm" fontWeight="medium">
                              1 {fromAsset?.ticker || ''} ≈ {
                                uAmountToBigNumberAmount(routeResult.expectedOutput, toAsset?.decimals ?? 6)
                                  .dividedBy(toBigNumber(fromAmount))
                                  .toFixed(toAsset?.decimals ?? 6)
                              } {toAsset?.ticker || ''}
                            </Text>
                          </HStack>
                        </VStack>
                      </Card.Root>
                    </Box>
                )}
                {fromAmount && isCalculatingRoute && (
                    <Box px="6" pt="2">
                      <Card.Root
                        variant="subtle"
                        p="4"
                        borderRadius="lg"
                        bgGradient="to-br"
                        gradientFrom="blue.500/8"
                        gradientTo="blue.600/8"
                        borderWidth="1px"
                        borderColor="blue.500/20"
                      >
                        <Text fontSize="sm" color="fg.muted" textAlign="center">
                          Calculating best route...
                        </Text>
                      </Card.Root>
                    </Box>
                )}
                {fromAmount && !isCalculatingRoute && !routeResult && (
                    <Box px="6" pt="2">
                      <Alert.Root status="warning">
                        <Alert.Indicator />
                        <Alert.Content>
                          <Alert.Title>No Route Found</Alert.Title>
                        </Alert.Content>
                      </Alert.Root>
                    </Box>
                )}

                {/* Routes Section */}
                {fromAmount && routeResult && (
                    <Box px="6">
                      <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowRoutes(!showRoutes)}
                          w="full"
                          justifyContent="space-between"
                          colorPalette="gray"
                      >
                        <Text fontSize="sm" fontWeight="medium">Trade Route ({routeResult.pools.length} hop{routeResult.pools.length > 1 ? 's' : ''})</Text>
                        {showRoutes ? <LuChevronUp size={18} /> : <LuChevronDown size={18} />}
                      </Button>

                      <Collapsible.Root open={showRoutes}>
                        <Collapsible.Content>
                          <Box mt="3">
                            <Card.Root
                              variant="subtle"
                              p="3"
                              bgGradient="to-br"
                              gradientFrom="blue.500/8"
                              gradientTo="blue.600/8"
                              borderWidth="1px"
                              borderColor="blue.500/20"
                            >
                              {/* Route Path */}
                              <Flex wrap="wrap" gap="2" align="center" justify="center">
                                {routeResult.path.map((denom, index) => {
                                  const asset = getAsset(denom);
                                  const isLast = index === routeResult.path.length - 1;
                                  const pool = !isLast ? routeResult.pools[index] : null;

                                  return (
                                    <Flex key={index} align="center" gap="2">
                                      {/* Asset */}
                                      <Tooltip
                                        content={`${asset?.name || denomTicker(denom)}${pool ? ` → Pool ${denomTicker(pool.base)}/${denomTicker(pool.quote)}` : ''}`}
                                        showArrow
                                      >
                                        <HStack
                                          gap="1.5"
                                          px="2"
                                          py="1.5"
                                          borderRadius="md"
                                          borderWidth="1px"
                                          bg="bg.panel"
                                          _hover={{ bg: "bg.muted" }}
                                          transition="background 0.2s"
                                        >
                                          <TokenLogo
                                            src={asset?.logo || ''}
                                            symbol={denomTicker(denom)}
                                            size="6"
                                            circular={true}
                                          />
                                          <Text fontSize="sm" fontWeight="medium">
                                            {denomTicker(denom)}
                                          </Text>
                                        </HStack>
                                      </Tooltip>

                                      {/* Arrow with pool info */}
                                      {!isLast && pool && (
                                        <VStack gap="0" align="center">
                                          <Box color="fg.muted">
                                            <LuArrowRight size={16} />
                                          </Box>
                                          <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                                            {toBigNumber(pool.fee).multipliedBy(100).toFixed(2)}%
                                          </Text>
                                        </VStack>
                                      )}
                                    </Flex>
                                  );
                                })}
                              </Flex>
                            </Card.Root>
                          </Box>
                        </Collapsible.Content>
                      </Collapsible.Root>
                    </Box>
                )}

                {/* Insufficient Balance Warning */}
                {hasInsufficientBalance && (
                    <Box px="6" pt="2">
                      <Alert.Root status="error">
                        <Alert.Indicator />
                        <Alert.Content>
                          <Alert.Title>Insufficient Balance</Alert.Title>
                          <Alert.Description>
                            You have {fromAsset?.balanceFormatted || '0'} {fromAsset?.ticker || ''}
                          </Alert.Description>
                        </Alert.Content>
                      </Alert.Root>
                    </Box>
                )}

                {/* Swap Button */}
                <Box px="6" pt="4" pb="6">
                  <Button
                      size="xl"
                      w="full"
                      disabled={!canSubmit}
                      loading={isSubmitting}
                      loadingText={progressTrack || 'Submitting...'}
                      onClick={handleSwapSubmit}
                      colorPalette="blue"
                      fontSize="lg"
                      fontWeight="bold"
                      h="14"
                      borderRadius="xl"
                  >
                    {!fromAmount
                      ? 'Enter Amount'
                      : isCalculatingRoute
                        ? 'Finding Route...'
                        : !routeResult
                          ? 'No Route Available'
                          : 'Swap'}
                  </Button>
                </Box>
              </VStack>
            </Card.Root>

            {/* Swap History */}
            {address && (
              <Card.Root
                maxW="480px"
                mx="auto"
                w="full"
                borderWidth="1px"
                shadow="lg"
                bgGradient="to-br"
                gradientFrom="purple.500/5"
                gradientTo="purple.600/5"
                borderColor="purple.500/20"
              >
                <Box px="6" pt="6" pb="4">
                  <Text fontSize="lg" fontWeight="semibold">
                    Your Recent Swaps
                  </Text>
                </Box>

                <Box px="6" pb="6">
                  {swapHistory.length === 0 ? (
                    isLoadingHistory ? (
                      <VStack gap="3" py="4">
                        <Text fontSize="sm" color="fg.muted">Loading swap history...</Text>
                      </VStack>
                    ) : (
                      <VStack gap="3" py="8">
                        <Text fontSize="sm" color="fg.muted" textAlign="center">
                          No swap history yet
                        </Text>
                        <Text fontSize="xs" color="fg.muted" textAlign="center">
                          Your swaps will appear here
                        </Text>
                      </VStack>
                    )
                  ) : (
                    <Box maxH="400px" overflowY="auto" css={{
                      '&::-webkit-scrollbar': { width: '8px' },
                      '&::-webkit-scrollbar-track': { background: 'transparent' },
                      '&::-webkit-scrollbar-thumb': {
                        background: 'rgba(155, 155, 155, 0.3)',
                        borderRadius: '4px',
                      },
                      '&::-webkit-scrollbar-thumb:hover': {
                        background: 'rgba(155, 155, 155, 0.5)',
                      },
                    }}>
                      <VStack gap="3" align="stretch">
                        {groupedSwapHistory.map(([timestamp, swaps], groupIdx) => {
                          const date = new Date(parseInt(timestamp));
                          const dateKey = date.toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          });
                          const time = date.toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          });

                          // Check if we need to show date header (when date changes from previous group)
                          const prevDate = groupIdx > 0
                            ? new Date(parseInt(groupedSwapHistory[groupIdx - 1][0])).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })
                            : null;
                          const showDateHeader = prevDate !== dateKey;

                          return (
                            <Box key={timestamp}>
                              {showDateHeader && (
                                <Text fontSize="xs" fontWeight="semibold" color="fg.muted" mb="2" px="2">
                                  {dateKey}
                                </Text>
                              )}
                              <Box
                                p="3"
                                bgGradient="to-br"
                                gradientFrom="blue.500/8"
                                gradientTo="purple.500/8"
                                borderRadius="md"
                                borderWidth="1px"
                                borderColor="blue.500/20"
                                _hover={{
                                  gradientFrom: "blue.500/12",
                                  gradientTo: "purple.500/12",
                                }}
                                transition="all 0.2s"
                              >
                                <VStack gap="2" align="stretch">
                                  <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                                    {time}
                                  </Text>
                                  {swaps.map((swap, idx) => {
                                    const baseAsset = getAsset(swap.base);
                                    const quoteAsset = getAsset(swap.quote);
                                    const isSell = swap.order_type === 'sell';
                                    const fromAssetData = isSell ? baseAsset : quoteAsset;
                                    const toAssetData = isSell ? quoteAsset : baseAsset;
                                    const fromTicker = denomTicker(isSell ? swap.base : swap.quote);
                                    const toTicker = denomTicker(isSell ? swap.quote : swap.base);
                                    const fromAmount = isSell ? swap.base_volume : swap.quote_volume;
                                    const toAmount = isSell ? swap.quote_volume : swap.base_volume;

                                    return (
                                      <HStack key={`${swap.order_id}-${idx}`} justify="space-between" gap="3">
                                        <HStack gap="2">
                                          <TokenLogo
                                            src={fromAssetData?.logo}
                                            symbol={fromTicker}
                                            size="7"
                                            circular={true}
                                          />
                                          <Text fontSize="sm" fontWeight="semibold">
                                            {prettyAmount(fromAmount.toString())}
                                          </Text>
                                          <Text fontSize="sm" fontWeight="medium">
                                            {fromTicker}
                                          </Text>
                                        </HStack>
                                        <Text fontSize="xs" color="fg.muted">→</Text>
                                        <HStack gap="2">
                                          <Text fontSize="sm" fontWeight="semibold" color="purple.500">
                                            {prettyAmount(toAmount.toString())}
                                          </Text>
                                          <Text fontSize="sm" fontWeight="medium" color="purple.500">
                                            {toTicker}
                                          </Text>
                                          <TokenLogo
                                            src={toAssetData?.logo}
                                            symbol={toTicker}
                                            size="7"
                                            circular={true}
                                          />
                                        </HStack>
                                      </HStack>
                                    );
                                  })}
                                </VStack>
                              </Box>
                            </Box>
                          );
                        })}
                      </VStack>
                    </Box>
                  )}
                </Box>
              </Card.Root>
            )}
          </VStack>
        </Container>
      </Box>
  );
}