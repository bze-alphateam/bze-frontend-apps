'use client';

import {
    Box,
    Button,
    createListCollection,
    Field,
    HStack,
    Input,
    Portal,
    Select,
    Text,
    VStack,
    Dialog,
} from "@chakra-ui/react";
import {useState, useEffect, useMemo, useCallback} from "react";
import {LuWallet} from "react-icons/lu";
import { useAsset, useAssets, useBalances, useBalance, amountToUAmount, prettyAmount, toBigNumber, uAmountToAmount, uAmountToBigNumberAmount, isLpDenom, Asset, getChainName, useToast, useBZETx, sanitizeNumberInput } from "@bze/bze-ui-kit";
import BigNumber from "bignumber.js";
import {useChain} from "@interchain-kit/react";
import {bze} from '@bze/bzejs'
import {AssetLogo} from "@/components/ui/asset_logo";

interface BurnModalProps {
    isOpen: boolean;
    onClose: () => void;
    preselectedCoin?: string; // denom of preselected coin
}

// Component to render select item with logo
const SelectItemContent = ({ asset, label }: { asset: Asset; label: string }) => {
    const isLP = useMemo(() => isLpDenom(asset.denom), [asset]);

    return (
        <HStack gap="2">
            <Box
                display="flex"
                justifyContent="center"
                alignItems="center"
                width={isLP ? "28px" : "auto"}
            >
                <AssetLogo asset={asset} size="28px" />
            </Box>
            <Text>{label}</Text>
        </HStack>
    );
};

// Component to display token info with LP support
const TokenInfoBox = ({ denom, name, ticker, balance }: {
    denom: string;
    name: string;
    ticker: string;
    balance: string;
}) => {
    const {asset} = useAsset(denom)
    const isLP = isLpDenom(denom);

    return (
        <VStack gap="3" align="stretch">
            {/* Token Info */}
            <Box
                p="4"
                bg="bg.muted"
                borderRadius="lg"
            >
                <HStack gap="3">
                    <Box
                        width={isLP ? "56px" : "auto"}
                        display="flex"
                        justifyContent="center"
                        alignItems="center"
                    >
                        {asset && <AssetLogo asset={asset} size="48px" /> }
                    </Box>
                    <VStack gap="0" align="start" flex="1" ml={3}>
                        <Text fontSize="lg" fontWeight="bold">{name}</Text>
                        <Text fontSize="sm" color="fg.muted" fontWeight="medium">
                            {ticker}
                        </Text>
                    </VStack>
                </HStack>
            </Box>

            {/* Available Balance - same style as non-preselected */}
            <Box
                p="3"
                bg="orange.50"
                _dark={{
                    bg: "gray.800",
                }}
                borderRadius="lg"
            >
                <HStack justify="space-between">
                    <Text fontSize="sm" fontWeight="medium">
                        Available Balance:
                    </Text>
                    <Text fontSize="sm" fontWeight="bold" color="orange.500" _dark={{ color: "orange.300" }}>
                        {balance} {ticker}
                    </Text>
                </HStack>
            </Box>
        </VStack>
    );
};

export const BurnModal = ({ isOpen, onClose, preselectedCoin }: BurnModalProps) => {
    const [selectedCoin, setSelectedCoin] = useState<string>(preselectedCoin || "");
    const [amount, setAmount] = useState("");
    const [amountError, setAmountError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Get assets and balances
    const { getAsset, denomDecimals } = useAssets();
    const { assetsBalances: assetsWithBalances } = useBalances();
    const { balance } = useBalance(selectedCoin);
    const { address } = useChain(getChainName());
    const { toast } = useToast()
    const { tx } = useBZETx()

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            if (preselectedCoin) {
                setSelectedCoin(preselectedCoin);
            } else {
                setSelectedCoin("");
            }
            setAmount("");
            setAmountError("");
        }
    }, [isOpen, preselectedCoin]);

    // Create collection for select
    const tokensCollection = createListCollection({
        items: assetsWithBalances.map(asset => {
            const decimals = denomDecimals(asset.denom);
            const prettyBalance = prettyAmount(uAmountToBigNumberAmount(asset.amount, decimals));

            return {
                label: `${asset.ticker} - ${prettyBalance}`,
                value: asset.denom,
                balance: asset.amount,
                prettyBalance,
                asset: asset,
            };
        })
    });

    const selectedAsset = useMemo(() => {
        return getAsset(selectedCoin);
    }, [selectedCoin, getAsset]);

    const selectedBalance = useMemo(() => {
        if (!selectedCoin) return BigNumber(0);
        return balance.amount;
    }, [selectedCoin, balance]);

    const prettyBalance = useMemo(() => {
        if (!selectedAsset) return "0";
        const decimals = denomDecimals(selectedAsset.denom);
        return uAmountToAmount(selectedBalance, decimals);
    }, [selectedAsset, selectedBalance, denomDecimals]);

    const handleAmountChange = (value: string) => {
        setAmount(value);
        setAmountError("");
    };

    const handleMaxClick = () => {
        if (selectedAsset && !selectedBalance.isZero()) {
            setAmount(prettyBalance);
        }
    };

    const handleBurn = useCallback(async () => {
        if (!address) {
            toast.error("Please connect your wallet to continue");

            return;
        }

        // Validation
        if (!selectedCoin) {
            setAmountError("Please select a token to burn");
            return;
        }

        const burnAmount = BigNumber(amount);
        if (!amount || burnAmount.isNaN() || burnAmount.isZero() || burnAmount.isNegative()) {
            setAmountError("Please enter a valid amount");
            return;
        }

        const decimals = denomDecimals(selectedCoin);
        const prettyBalanceBN = uAmountToBigNumberAmount(selectedBalance, decimals);

        if (burnAmount.gt(prettyBalanceBN)) {
            setAmountError("Not enough balance!");
            return;
        }
        const uAmount = amountToUAmount(amount, decimals);
        const {fundBurner} = bze.burner.MessageComposer.withTypeUrl;
        const msg = fundBurner({
            creator: address,
            amount: `${uAmount}${selectedCoin}`
        })

        setIsSubmitting(true);
        const success = await tx([msg]);

        setIsSubmitting(false);
        if (success) onClose();

    }, [address, selectedCoin, amount, denomDecimals, selectedBalance, onClose, tx, toast]);

    const isConnected = !!address;
    const hasBalance = useMemo(() => address && selectedCoin && !selectedBalance.isZero(), [address, selectedCoin, selectedBalance]);
    const isFormValid = useMemo(() => selectedCoin && amount && toBigNumber(amount).gt(0) && !amountError && hasBalance, [selectedCoin, amount, amountError, hasBalance]);

    const handleConnectWallet = useCallback(() => {
        onClose();
        // Open the wallet sidebar by clicking its trigger
        setTimeout(() => {
            const trigger = document.querySelector<HTMLElement>('[data-wallet-trigger]');
            trigger?.click();
        }, 150);
    }, [onClose]);

    return (
        <Dialog.Root open={isOpen} onOpenChange={(e) => !isSubmitting && !e.open && onClose()}>
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content
                        maxW={{ base: "90vw", md: "500px" }}
                        borderRadius="2xl"
                    >
                        <Dialog.Header>
                            <Dialog.Title fontSize="xl" fontWeight="black">
                                {preselectedCoin && selectedAsset
                                    ? `🔥 Burn ${selectedAsset.ticker} 🔥`
                                    : '🔥 Burn Your Tokens 🔥'
                                }
                            </Dialog.Title>
                        </Dialog.Header>

                        <Dialog.Body>
                            <VStack gap="5" align="stretch">
                                {/* Warning Box */}
                                <Box
                                    p="4"
                                    bg="red.50"
                                    _dark={{
                                        bg: "gray.800",
                                    }}
                                    borderRadius="xl"
                                >
                                    <VStack gap="2" align="center">
                                        <Text fontSize="3xl">⚠️</Text>
                                        <Text fontSize="sm" fontWeight="bold" textAlign="center" color="red.700" _dark={{ color: "orange.300" }}>
                                            Warning: No Take-Backs!
                                        </Text>
                                        <Text fontSize="xs" textAlign="center" color="red.800" _dark={{ color: "gray.200" }}>
                                            Once you burn your tokens, they&apos;re gone forever! Like throwing money into a volcano. Make sure you really want to do this!
                                        </Text>
                                    </VStack>
                                </Box>

                                {/* Coin Selection (if not preselected) */}
                                {!preselectedCoin && (
                                    <Box>
                                        <Field.Root>
                                            <Field.Label fontWeight="semibold">Select Token to Burn</Field.Label>
                                            <Select.Root
                                                collection={tokensCollection}
                                                size="md"
                                                value={selectedCoin ? [selectedCoin] : []}
                                                onValueChange={(details) => setSelectedCoin(details.value[0] || '')}
                                                disabled={!isConnected || tokensCollection.items.length === 0}
                                            >
                                                <Select.Control>
                                                    <Select.Trigger>
                                                        <Select.ValueText placeholder="Choose a token..." />
                                                    </Select.Trigger>
                                                </Select.Control>
                                                <Select.Positioner>
                                                    <Select.Content>
                                                        {tokensCollection.items.map((item) => (
                                                            <Select.Item key={item.value} item={item}>
                                                                <Select.ItemText>
                                                                    <SelectItemContent asset={item.asset} label={item.label} />
                                                                </Select.ItemText>
                                                                <Select.ItemIndicator />
                                                            </Select.Item>
                                                        ))}
                                                    </Select.Content>
                                                </Select.Positioner>
                                            </Select.Root>
                                        </Field.Root>
                                    </Box>
                                )}

                                {/* Show selected token info if preselected */}
                                {preselectedCoin && selectedAsset && (
                                    <TokenInfoBox
                                        denom={selectedAsset.denom}
                                        name={selectedAsset.name}
                                        ticker={selectedAsset.ticker}
                                        balance={prettyBalance}
                                    />
                                )}

                                {/* Available Balance (if token selected) */}
                                {selectedAsset && !preselectedCoin && (
                                    <Box
                                        p="3"
                                        bg="orange.50"
                                        _dark={{
                                            bg: "gray.800",
                                        }}
                                        borderRadius="lg"
                                    >
                                        <HStack justify="space-between">
                                            <Text fontSize="sm" fontWeight="medium">
                                                Available Balance:
                                            </Text>
                                            <Text fontSize="sm" fontWeight="bold" color="orange.500" _dark={{ color: "orange.300" }}>
                                                {prettyBalance} {selectedAsset.ticker}
                                            </Text>
                                        </HStack>
                                    </Box>
                                )}

                                {/* Amount Input */}
                                <Box>
                                    <Field.Root invalid={!!amountError}>
                                        <Field.Label fontWeight="semibold">
                                            {selectedAsset
                                                ? `Amount of ${selectedAsset.ticker} to Burn`
                                                : 'Amount to Burn'
                                            }
                                        </Field.Label>
                                        <HStack gap="2">
                                            <Input
                                                size="lg"
                                                placeholder={selectedAsset ? `0.00 ${selectedAsset.ticker}` : "0.00"}
                                                value={amount}
                                                onChange={(e) => handleAmountChange(sanitizeNumberInput(e.target.value))}
                                                disabled={!isConnected || !selectedCoin || isSubmitting || !hasBalance}
                                            />
                                            <Button
                                                size="lg"
                                                variant="outline"
                                                colorPalette="orange"
                                                onClick={handleMaxClick}
                                                disabled={!isConnected || !selectedCoin || isSubmitting || !hasBalance}
                                            >
                                                MAX
                                            </Button>
                                        </HStack>
                                        {amountError && <Field.ErrorText>{amountError}</Field.ErrorText>}
                                        {selectedCoin && !hasBalance && !amountError && (
                                            <Field.ErrorText>No balance available for this token</Field.ErrorText>
                                        )}
                                    </Field.Root>
                                </Box>

                                {/* Confirmation Preview */}
                                {isFormValid && selectedAsset && (
                                    <Box
                                        p="4"
                                        bg="bg.muted"
                                        borderRadius="lg"
                                    >
                                        <VStack gap="2" align="stretch">
                                            <Text fontSize="sm" fontWeight="bold" textAlign="center">
                                                You&apos;re about to burn:
                                            </Text>
                                            <HStack justify="center" gap="2">
                                                <Text fontSize="2xl" fontWeight="black" color="orange.500">
                                                    {amount}
                                                </Text>
                                                <Text fontSize="2xl" fontWeight="black">
                                                    {selectedAsset.ticker}
                                                </Text>
                                            </HStack>
                                            <Text fontSize="xs" textAlign="center" color="fg.muted" fontStyle="italic">
                                                Into the fire it goes! 🔥
                                            </Text>
                                        </VStack>
                                    </Box>
                                )}
                            </VStack>
                        </Dialog.Body>

                        <Dialog.Footer>
                            {!isConnected ? (
                                <HStack gap="3" width="full">
                                    <Button
                                        flex="1"
                                        variant="outline"
                                        onClick={onClose}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        flex="1"
                                        colorPalette="orange"
                                        onClick={handleConnectWallet}
                                    >
                                        <LuWallet /> Connect Wallet
                                    </Button>
                                </HStack>
                            ) : (
                                <HStack gap="3" width="full">
                                    <Button
                                        flex="1"
                                        variant="outline"
                                        onClick={onClose}
                                        disabled={isSubmitting}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        flex="1"
                                        colorPalette="orange"
                                        onClick={handleBurn}
                                        disabled={!isFormValid || isSubmitting}
                                        loading={isSubmitting}
                                        loadingText="Burning..."
                                    >
                                        🔥 Burn It!
                                    </Button>
                                </HStack>
                            )}
                        </Dialog.Footer>

                        <Dialog.CloseTrigger disabled={isSubmitting} />
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    );
};
