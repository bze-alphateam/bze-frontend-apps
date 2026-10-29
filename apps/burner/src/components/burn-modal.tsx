'use client';

import {
    Button,
    chakra,
    createListCollection,
    Field,
    Flex,
    Input,
    Select,
} from "@chakra-ui/react";
import {useState, useMemo, useCallback} from "react";
import {LuFlame, LuWallet} from "react-icons/lu";
import { useAssets, useBalances, useBalance, useMaxSpendable, useCanAffordTx, amountToUAmount, prettyAmount, toBigNumber, uAmountToAmount, uAmountToBigNumberAmount, Asset, getChainName, useToast, useBZETx, sanitizeNumberInput, Notice, hgVariant } from "@bze/bze-ui-kit";
import BigNumber from "bignumber.js";
import {useChain} from "@interchain-kit/react";
import {bze} from '@bze/bzejs'
import {AssetLogo} from "@/components/ui/asset_logo";
import {BurnerDialog, CoinRow, InsetRow} from "@/components/ui/burner/dialog";

interface BurnModalProps {
    isOpen: boolean;
    onClose: () => void;
    preselectedCoin?: string; // denom of preselected coin
}

// A coin in the select list: its logo and "TICKER - balance".
const SelectItemContent = ({ asset, label }: { asset: Asset; label: string }) => (
    <Flex align="center" gap="10px">
        <AssetLogo asset={asset} size="24px" />
        <span>{label}</span>
    </Flex>
);

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
    // Shared gas engine: MAX keeps the gas fee back when burning the fee coin, and the form
    // refuses amounts that would leave no room for it.
    const maxSpendable = useMaxSpendable(selectedCoin, 'fund-burner');
    const affordability = useCanAffordTx({
        spec: selectedCoin && amount ? 'fund-burner' : undefined,
        spend: selectedCoin && amount ? { denom: selectedCoin, amount: amountToUAmount(amount, denomDecimals(selectedCoin)) } : undefined,
    });

    // Reset the form each time the modal opens (or opens for another coin). Adjusted during
    // render instead of in an effect (React's "adjust state while rendering" pattern).
    const openKey = isOpen ? `open:${preselectedCoin ?? ""}` : "closed";
    const [lastOpenKey, setLastOpenKey] = useState(openKey);
    if (openKey !== lastOpenKey) {
        setLastOpenKey(openKey);
        if (isOpen) {
            setSelectedCoin(preselectedCoin || "");
            setAmount("");
            setAmountError("");
        }
    }

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
            setAmount(maxSpendable.inputValue);
            setAmountError("");
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
        if (!affordability.canAfford) {
            setAmountError(affordability.message || "Not enough balance left for the network fee");
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

    }, [address, selectedCoin, amount, denomDecimals, selectedBalance, affordability.canAfford, affordability.message, onClose, tx, toast]);

    const isConnected = !!address;
    const hasBalance = useMemo(() => address && selectedCoin && !selectedBalance.isZero(), [address, selectedCoin, selectedBalance]);
    const isFormValid = useMemo(() => selectedCoin && amount && toBigNumber(amount).gt(0) && !amountError && hasBalance && affordability.canAfford, [selectedCoin, amount, amountError, hasBalance, affordability.canAfford]);

    const handleConnectWallet = useCallback(() => {
        onClose();
        // Open the wallet sidebar by clicking its trigger
        setTimeout(() => {
            const trigger = document.querySelector<HTMLElement>('[data-wallet-trigger]');
            trigger?.click();
        }, 150);
    }, [onClose]);

    const footer = !isConnected ? (
        <>
            <Button flex="1" variant={hgVariant('secondary')} onClick={onClose}>
                Cancel
            </Button>
            <Button flex="1" variant={hgVariant('primary')} onClick={handleConnectWallet}>
                <LuWallet /> Connect Wallet
            </Button>
        </>
    ) : (
        <>
            <Button flex="1" variant={hgVariant('secondary')} onClick={onClose} disabled={isSubmitting}>
                Cancel
            </Button>
            <Button
                flex="1"
                variant={hgVariant('primary')}
                onClick={handleBurn}
                disabled={!isFormValid || isSubmitting}
                loading={isSubmitting}
                loadingText="Burning..."
            >
                <LuFlame /> Burn it!
            </Button>
        </>
    );

    return (
        <BurnerDialog
            isOpen={isOpen}
            onClose={onClose}
            busy={isSubmitting}
            title={preselectedCoin && selectedAsset ? `Burn ${selectedAsset.ticker}` : 'Burn your tokens'}
            footer={footer}
        >
            <Notice status="warning" title="Warning: No Take-Backs!">
                {"Once you burn your tokens, they're gone forever! Like throwing money into a volcano. Make sure you really want to do this!"}
            </Notice>

            {/* Coin selection when no coin is preselected */}
            {!preselectedCoin && (
                <Field.Root>
                    <Field.Label fontWeight="600">Select Token to Burn</Field.Label>
                    <Select.Root
                        collection={tokensCollection}
                        size="lg"
                        value={selectedCoin ? [selectedCoin] : []}
                        onValueChange={(details) => setSelectedCoin(details.value[0] || '')}
                        disabled={!isConnected || tokensCollection.items.length === 0}
                    >
                        <Select.Control>
                            <Select.Trigger borderRadius="hg.md">
                                <Select.ValueText placeholder="Choose a token..." />
                            </Select.Trigger>
                            <Select.IndicatorGroup>
                                <Select.Indicator />
                            </Select.IndicatorGroup>
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
            )}

            {preselectedCoin && selectedAsset && (
                <CoinRow
                    logo={<AssetLogo asset={selectedAsset} size="40px" />}
                    name={selectedAsset.name}
                    ticker={selectedAsset.ticker}
                />
            )}

            {selectedAsset && (
                <InsetRow label="Available Balance:">{prettyBalance} {selectedAsset.ticker}</InsetRow>
            )}

            <Field.Root invalid={!!amountError}>
                <Field.Label fontWeight="600">
                    {selectedAsset ? `Amount of ${selectedAsset.ticker} to Burn` : 'Amount to Burn'}
                </Field.Label>
                <Flex gap="8px" w="100%">
                    <Input
                        size="lg"
                        flex="1"
                        borderRadius="hg.md"
                        inputMode="decimal"
                        placeholder={selectedAsset ? `0.00 ${selectedAsset.ticker}` : "0.00"}
                        value={amount}
                        onChange={(e) => handleAmountChange(sanitizeNumberInput(e.target.value, selectedCoin ? denomDecimals(selectedCoin) : undefined))}
                        disabled={!isConnected || !selectedCoin || isSubmitting || !hasBalance}
                    />
                    <Button
                        size="lg"
                        variant={hgVariant('secondary')}
                        onClick={handleMaxClick}
                        disabled={!isConnected || !selectedCoin || isSubmitting || !hasBalance}
                    >
                        MAX
                    </Button>
                </Flex>
                {amountError && <Field.ErrorText>{amountError}</Field.ErrorText>}
                {selectedCoin && !hasBalance && !amountError && (
                    <Field.ErrorText>No balance available for this token</Field.ErrorText>
                )}
            </Field.Root>

            {isFormValid && selectedAsset && (
                <Flex direction="column" align="center" gap="4px" px="16px" py="14px" borderRadius="hg.md" bg="app.subtle" borderWidth="1px" borderColor="app.border" textAlign="center">
                    <chakra.span fontSize="13px" fontWeight="600" color="hg.text.secondary">{"You're about to burn:"}</chakra.span>
                    <chakra.span fontSize="24px" fontWeight="800" overflowWrap="anywhere">
                        <chakra.span color="hg.link">{amount}</chakra.span> {selectedAsset.ticker}
                    </chakra.span>
                    <chakra.span fontSize="12px" color="hg.text.faint">Into the fire it goes!</chakra.span>
                </Flex>
            )}
        </BurnerDialog>
    );
};
