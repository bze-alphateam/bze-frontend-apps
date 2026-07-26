'use client';

import {useCallback, useEffect, useMemo, useState} from "react";
import {Badge, Box, Button, Field, Group, HStack, Input, Separator, Text, VStack} from "@chakra-ui/react";
import {LuArrowDown, LuChevronDown, LuChevronUp, LuWallet} from "react-icons/lu";
import {
    ammRouter,
    amountToBigNumberUAmount,
    BuyForm,
    getChainName,
    getChainNativeAssetDenom,
    isSkipEnabled,
    prettyAmount,
    sanitizeNumberInput,
    SwapRouteResult,
    toBigNumber,
    TokenLogo,
    uAmountToBigNumberAmount,
    useAsset,
    useAssets,
    useBalance,
    useBZETx,
    useFeeTokens,
    useLiquidityPools,
    useSkipTxTracker,
    useToast,
} from "@bze/bze-ui-kit";
import {bze} from "@bze/bzejs";
import {useChain} from "@interchain-kit/react";
import {WalletState} from "@interchain-kit/core";
import type {Asset} from "@bze/bze-ui-kit";

const SLIPPAGE_PRESETS = [0.5, 1, 2];
const DEFAULT_SLIPPAGE = 1;

interface GetTokenSectionProps {
    denom: string;
    accentColor?: string;
}

/**
 * "Get the token" wallet-sidebar section (Features & Usage §6, Business Logic §4, §8).
 * Only rendered when the page token is fee-eligible — i.e. it has an AMM pool paired
 * with BZE whose BZE-side reserve exceeds the tradebin min-liquidity param. When it is
 * not eligible the whole section is hidden (not disabled).
 *
 * This gate wrapper keeps the eligibility hooks stable; the actual buy/swap UI (with its
 * own state) mounts only once we know the token is eligible.
 */
export const GetTokenSection = ({denom, accentColor = "green"}: GetTokenSectionProps) => {
    const {isValidFeeDenom, nativeDenom, isLoading} = useFeeTokens();
    const {asset} = useAsset(denom);

    // Never feature BZE itself, and hide until the token proves fee-eligible.
    if (isLoading || !asset || denom === nativeDenom || !isValidFeeDenom(denom)) {
        return null;
    }

    return <GetTokenSectionInner asset={asset} accentColor={accentColor}/>;
};

const GetTokenSectionInner = ({asset, accentColor}: { asset: Asset; accentColor: string }) => {
    const {toast} = useToast();
    const {nativeAsset} = useAssets();
    const {status, connect, address} = useChain(getChainName());
    const nativeDenom = getChainNativeAssetDenom();
    const {balance: bzeBalance} = useBalance(nativeDenom);
    const {pools} = useLiquidityPools();
    const {tx} = useBZETx();

    const skipEnabled = useMemo(() => isSkipEnabled(), []);
    const buyTracker = useSkipTxTracker();

    const [showBuy, setShowBuy] = useState(false);
    const [fromAmount, setFromAmount] = useState('');
    const [amountError, setAmountError] = useState('');
    const [routeResult, setRouteResult] = useState<SwapRouteResult | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [noRoute, setNoRoute] = useState(false);
    const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isConnected = status === WalletState.Connected;
    const bzeDecimals = nativeAsset?.decimals ?? 6;

    // Keep the shared AMM router fed with the latest pools so quoting is accurate.
    useEffect(() => {
        if (pools && pools.length > 0) {
            ammRouter.updatePools(pools);
        }
    }, [pools]);

    const bzeHumanBalance = useMemo(
        () => uAmountToBigNumberAmount(bzeBalance.amount, bzeDecimals),
        [bzeBalance.amount, bzeDecimals],
    );

    const quote = useCallback((value: string) => {
        setNoRoute(false);
        const amount = toBigNumber(value);
        if (!value || amount.isNaN() || amount.lte(0)) {
            setRouteResult(null);
            return;
        }

        const amountInMicro = amountToBigNumberUAmount(amount, bzeDecimals);
        setIsCalculating(true);
        // Defer so the input stays responsive while the route search runs.
        setTimeout(() => {
            try {
                const route = ammRouter.findOptimalRoute(nativeDenom, asset.denom, amountInMicro, 3, true);
                if (route) {
                    setRouteResult(route);
                    setNoRoute(false);
                } else {
                    setRouteResult(null);
                    setNoRoute(true);
                }
            } catch (error) {
                console.error('Failed to quote BZE -> token route:', error);
                setRouteResult(null);
                setNoRoute(true);
            } finally {
                setIsCalculating(false);
            }
        }, 0);
    }, [asset.denom, bzeDecimals, nativeDenom]);

    const validateAmount = useCallback((value: string) => {
        if (value === '') {
            setAmountError('');
            return;
        }
        const amount = toBigNumber(value);
        if (amount.isNaN() || amount.lte(0)) {
            setAmountError('Enter a valid amount');
            return;
        }
        if (amount.gt(bzeHumanBalance)) {
            setAmountError('Insufficient BZE balance');
            return;
        }
        setAmountError('');
    }, [bzeHumanBalance]);

    const onAmountChange = useCallback((value: string) => {
        const sanitized = sanitizeNumberInput(value);
        setFromAmount(sanitized);
        validateAmount(sanitized);
        quote(sanitized);
    }, [quote, validateAmount]);

    const onMaxClick = useCallback(() => {
        const max = bzeHumanBalance.toFixed(bzeDecimals);
        setFromAmount(max);
        validateAmount(max);
        quote(max);
    }, [bzeHumanBalance, bzeDecimals, quote, validateAmount]);

    const expectedOutput = useMemo(() => {
        if (!routeResult) return null;
        return uAmountToBigNumberAmount(routeResult.expectedOutput, asset.decimals);
    }, [routeResult, asset.decimals]);

    const priceImpact = useMemo(() => {
        if (!routeResult) return null;
        return routeResult.priceImpact;
    }, [routeResult]);

    const resetSwap = useCallback(() => {
        setFromAmount('');
        setRouteResult(null);
        setNoRoute(false);
        setAmountError('');
    }, []);

    const canSwap = isConnected
        && !!address
        && !!routeResult
        && !amountError
        && fromAmount !== ''
        && !isCalculating
        && !isSubmitting;

    const handleSwap = useCallback(async () => {
        if (!isConnected || !address) {
            toast.error('Wallet not connected', 'Please connect your wallet first.');
            return;
        }
        if (!routeResult || !fromAmount) {
            toast.error('Nothing to swap', 'Enter a BZE amount to convert.');
            return;
        }

        const amountInMicro = amountToBigNumberUAmount(toBigNumber(fromAmount), bzeDecimals);
        const slippageMultiplier = toBigNumber(1).minus(toBigNumber(slippage).dividedBy(100));
        const minOutputMicro = routeResult.expectedOutput.multipliedBy(slippageMultiplier);

        const {multiSwap} = bze.tradebin.MessageComposer.withTypeUrl;
        const msg = multiSwap({
            creator: address,
            routes: routeResult.route,
            input: {denom: nativeDenom, amount: amountInMicro.toFixed(0)},
            minOutput: {denom: asset.denom, amount: minOutputMicro.toFixed(0)},
        });

        setIsSubmitting(true);
        try {
            await tx([msg], {onSuccess: resetSwap});
        } catch (error) {
            console.error('Swap failed:', error);
            toast.error('Swap failed', 'Could not complete the swap. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    }, [isConnected, address, routeResult, fromAmount, bzeDecimals, slippage, nativeDenom, asset.denom, tx, resetSwap, toast]);

    return (
        <Box
            mb="6"
            p="4"
            bgGradient="to-br"
            gradientFrom={`${accentColor}.500/10`}
            gradientTo={`${accentColor}.600/10`}
            borderWidth="1px"
            borderColor={`${accentColor}.500/25`}
            borderRadius="lg"
        >
            <VStack align="stretch" gap="4">
                <HStack gap="2" align="center">
                    <Box width="24px" height="24px" flexShrink={0}>
                        <TokenLogo src={asset.logo} symbol={asset.ticker} circular={true}/>
                    </Box>
                    <Text fontSize="sm" fontWeight="semibold">Get {asset.ticker}</Text>
                </HStack>
                <Text fontSize="xs" color="fg.muted">
                    Buy BZE with anything you hold, then swap it for {asset.ticker} — without leaving this page.
                </Text>

                {!isConnected && (
                    <Button size="sm" variant="solid" colorPalette={accentColor} onClick={() => connect()}>
                        <LuWallet/> Connect wallet to get {asset.ticker}
                    </Button>
                )}

                {isConnected && (
                    <>
                        {/* Step 1 — Buy BZE (optional; skip if you already hold BZE) */}
                        {skipEnabled && (
                            <Box>
                                <Button
                                    size="xs"
                                    variant="outline"
                                    width="full"
                                    onClick={() => setShowBuy((v) => !v)}
                                >
                                    Step 1 · Buy BZE (cross-chain)
                                    {showBuy ? <LuChevronUp/> : <LuChevronDown/>}
                                </Button>
                                {showBuy && (
                                    <Box mt="3">
                                        <BuyForm
                                            accentColor={accentColor}
                                            addTransaction={buyTracker.addTransaction}
                                            onClose={() => setShowBuy(false)}
                                        />
                                    </Box>
                                )}
                            </Box>
                        )}

                        <Separator/>

                        {/* Step 2 — Swap BZE -> token */}
                        <VStack align="stretch" gap="3">
                            <Text fontSize="xs" fontWeight="medium" color="fg.muted">
                                Step 2 · Swap BZE for {asset.ticker}
                            </Text>

                            <Field.Root invalid={amountError !== ''}>
                                <Field.Label fontSize="xs">
                                    Pay
                                    <Badge size="xs" variant="surface" ml="1">
                                        Balance: {prettyAmount(bzeHumanBalance)} {nativeAsset?.ticker ?? 'BZE'}
                                    </Badge>
                                </Field.Label>
                                <Group attached w="full">
                                    <Input
                                        size="sm"
                                        placeholder="0.0"
                                        value={fromAmount}
                                        onChange={(e) => onAmountChange(e.target.value)}
                                    />
                                    <Button variant="outline" size="sm" onClick={onMaxClick}>Max</Button>
                                </Group>
                                <Field.ErrorText>{amountError}</Field.ErrorText>
                            </Field.Root>

                            <HStack justify="center">
                                <LuArrowDown size="16"/>
                            </HStack>

                            <Box
                                p="3"
                                borderWidth="1px"
                                borderColor="border.subtle"
                                borderRadius="md"
                                bg="bg.surface"
                            >
                                <HStack justify="space-between">
                                    <Text fontSize="xs" color="fg.muted">Receive (estimated)</Text>
                                    <HStack gap="1">
                                        <Text fontSize="sm" fontWeight="medium">
                                            {isCalculating ? '…' : expectedOutput ? prettyAmount(expectedOutput) : '0'}
                                        </Text>
                                        <Text fontSize="sm" color="fg.muted">{asset.ticker}</Text>
                                    </HStack>
                                </HStack>
                                {priceImpact && (
                                    <HStack justify="space-between" mt="1">
                                        <Text fontSize="2xs" color="fg.muted">Price impact</Text>
                                        <Text
                                            fontSize="2xs"
                                            color={priceImpact.gt(5) ? 'red.500' : 'fg.muted'}
                                        >
                                            {priceImpact.toFixed(2)}%
                                        </Text>
                                    </HStack>
                                )}
                            </Box>

                            {noRoute && (
                                <Text fontSize="xs" color="red.500">
                                    No swap route available for this amount.
                                </Text>
                            )}

                            <Box>
                                <Text fontSize="2xs" color="fg.muted" mb="1">Slippage tolerance</Text>
                                <HStack gap="2">
                                    {SLIPPAGE_PRESETS.map((preset) => (
                                        <Button
                                            key={preset}
                                            size="2xs"
                                            variant={slippage === preset ? 'solid' : 'outline'}
                                            colorPalette={accentColor}
                                            onClick={() => setSlippage(preset)}
                                        >
                                            {preset}%
                                        </Button>
                                    ))}
                                </HStack>
                            </Box>

                            <Button
                                size="sm"
                                colorPalette={accentColor}
                                onClick={handleSwap}
                                disabled={!canSwap}
                                loading={isSubmitting}
                                loadingText="Swapping..."
                            >
                                Swap for {asset.ticker}
                            </Button>
                        </VStack>
                    </>
                )}
            </VStack>
        </Box>
    );
};
