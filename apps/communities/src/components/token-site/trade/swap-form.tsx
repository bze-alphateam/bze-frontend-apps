'use client';

import React, {useState} from "react";
import BigNumber from "bignumber.js";
import {chakra, Flex} from "@chakra-ui/react";
import {
    type Asset,
    getChainNativeAssetDenom,
    sanitizeNumberInput,
    type TxSpec,
    uAmountToBigNumberAmount,
    useAssets,
    useBalances,
    useCanAffordTx,
    useGasFeeEstimate,
    useLiquidityPools,
    useMaxSpendable,
} from "@bze/bze-ui-kit";

import {type SwapDirection, useTokenSwap} from "@/hooks/token-site/useTokenSwap";
import {DEFAULT_SLIPPAGE, formatPriceImpact, payableTokens, receivableTokens, SLIPPAGE_OPTIONS} from "@/lib/token-site/swap";
import {walletAmount} from "@/lib/token-site/wallet";

import {TsButton, TsChip, TsField, TsNotice, ts, tsMix} from "../kit";

/** Why `amount` (display units) can't be swapped, or '' when it can as far as the balance goes. */
function amountProblem(amount: string, balance: BigNumber, decimals: number, ticker: string): string {
    const value = new BigNumber(amount);
    if (value.isNaN() || !value.gt(0)) return "Enter an amount above 0";
    if ((value.decimalPlaces() ?? 0) > decimals) return `Use at most ${decimals} decimals`;
    if (value.gt(balance)) return `Insufficient ${ticker} balance`;

    return "";
}

function Row({label, children}: { label: string; children: React.ReactNode }) {
    return (
        <Flex justify="space-between" gap="12px" fontSize="13px">
            <chakra.span color={ts.muted}>{label}</chakra.span>
            <chakra.span fontWeight={600} fontVariantNumeric="tabular-nums" textAlign="right">{children}</chakra.span>
        </Flex>
    );
}

interface TokenSelectProps {
    label: string;
    value: string;
    options: { denom: string; ticker: string }[];
    onChange: (denom: string) => void;
}

function TokenSelect({label, value, options, onChange}: TokenSelectProps) {
    return (
        <chakra.select
            aria-label={label}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            font="inherit"
            fontWeight={700}
            color={ts.fg}
            bg={tsMix(ts.fg, 6)}
            border="0"
            borderRadius="999px"
            px="10px"
            minH="36px"
            cursor="pointer"
        >
            {options.map((token) => <option key={token.denom} value={token.denom}>{token.ticker}</option>)}
        </chakra.select>
    );
}

interface SwapFormProps {
    asset: Asset;
    direction: SwapDirection;
    /** Prefix of the form's test ids and element ids ("get" in the wallet, "trade" on the page). */
    idPrefix: string;
    /** The submit button's label. */
    cta: string;
    /** Shown above the submit button (the low-liquidity BZE notice). */
    notice?: React.ReactNode;
}

/**
 * An instant swap of T for a connected wallet, assuming T is tradable (Business Logic R8).
 * Buying pays with any held token that has a route of at most 3 hops to T, the most valuable one
 * (in USD) preselected; selling receives any token T has such a route to, BZE preselected. Max
 * keeps the network fee back when the token paid is the fee token.
 */
export function SwapForm({asset, direction, idPrefix, cta, notice}: SwapFormProps) {
    const {assetsBalances} = useBalances();
    const {pools} = useLiquidityPools();
    const {getAsset} = useAssets();
    const [picked, setPicked] = useState<string>();
    const [amount, setAmount] = useState("");
    const [slippage, setSlippage] = useState<number>(DEFAULT_SLIPPAGE);

    const buying = direction === "buy";
    const payable = buying ? payableTokens(assetsBalances, asset.denom, pools) : [];
    const receivable = buying ? [] : receivableTokens(asset.denom, pools, getAsset, getChainNativeAssetDenom());
    const options: Asset[] = buying ? payable : receivable;
    const other = options.find((token) => token.denom === picked) ?? options[0];

    // What goes in: the picked token when buying, T when selling.
    const held = buying ? payable.find((token) => token.denom === other?.denom) : assetsBalances.find((token) => token.denom === asset.denom);
    const spent = buying
        ? (other && held ? {denom: other.denom, ticker: other.ticker, decimals: other.decimals, amount: held.amount} : undefined)
        : {denom: asset.denom, ticker: asset.ticker, decimals: asset.decimals, amount: held?.amount ?? new BigNumber(0)};

    const swap = useTokenSwap(asset.denom, {direction, other: other?.denom, amountIn: amount, slippage});
    const spec: TxSpec = {kind: "swap", count: swap.route?.route.length ?? 1};
    const maxSpendable = useMaxSpendable(spent?.denom ?? "", spec);
    const gasFee = useGasFeeEstimate(spec);
    const affordability = useCanAffordTx({
        spec: amount !== "" ? spec : undefined,
        spend: amount !== "" && spent && swap.uAmountIn ? {denom: spent.denom, amount: swap.uAmountIn.toFixed(0)} : undefined,
    });

    if (!other || !spent) {
        return buying
            ? (
                <TsNotice data-testid={`${idPrefix}-nothing-to-pay`}>
                    Nothing in this wallet can be swapped into {asset.ticker} yet. Add funds to the wallet first.
                </TsNotice>
            )
            : <TsNotice data-testid={`${idPrefix}-nothing-to-receive`}>{asset.ticker} can&apos;t be swapped into any other token yet.</TsNotice>;
    }

    const amountError = amount === ""
        ? ""
        : amountProblem(amount, uAmountToBigNumberAmount(spent.amount, spent.decimals), spent.decimals, spent.ticker)
        || swap.error
        || affordability.message;
    const canSwap = amount !== "" && !amountError && Boolean(swap.route) && !affordability.isLoading && !swap.isSubmitting;
    const errorId = `${idPrefix}-amount-error`;
    const slippageId = `${idPrefix}-slippage`;
    const select = (
        <TokenSelect
            label={buying ? "Pay with" : "Receive"}
            value={other.denom}
            options={options}
            onChange={(denom) => setPicked(denom)}
        />
    );

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!canSwap) return;
        if (await swap.submit()) setAmount("");
    };

    return (
        <chakra.form onSubmit={submit} display="flex" flexDirection="column" gap="12px" noValidate data-testid={`${idPrefix}-form`}>
            <TsField
                label={buying ? "You pay" : "You sell"}
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={(event) => setAmount(sanitizeNumberInput(event.target.value))}
                aria-invalid={amountError !== ""}
                aria-describedby={amountError ? errorId : undefined}
                suffix={buying ? select : asset.ticker}
            />
            <Flex justify="space-between" align="center" gap="8px" px="4px">
                {amountError
                    ? <chakra.span id={errorId} role="alert" fontSize="13px" color={ts.danger}>{amountError}</chakra.span>
                    : (
                        <chakra.span fontSize="13px" color={ts.muted}>
                            Balance {walletAmount(uAmountToBigNumberAmount(spent.amount, spent.decimals))} {spent.ticker}
                        </chakra.span>
                    )}
                <chakra.button
                    type="button"
                    onClick={() => setAmount(maxSpendable.inputValue)}
                    disabled={maxSpendable.isLoading || !maxSpendable.amount.gt(0)}
                    font="inherit"
                    fontSize="13px"
                    fontWeight={600}
                    bg="transparent"
                    border="0"
                    color={ts.fg}
                    cursor="pointer"
                    minH="32px"
                    textDecoration="underline"
                    _disabled={{opacity: 0.5, cursor: "not-allowed"}}
                >
                    Max
                </chakra.button>
            </Flex>

            <Flex direction="column" gap="8px" borderRadius="14px" px="16px" py="14px" bg={tsMix(ts.fg, 4)} data-testid={`${idPrefix}-quote`}>
                <chakra.span color={ts.muted} fontSize="13px">{buying ? "You get" : "You receive"}</chakra.span>
                <Flex align="center" justify="space-between" gap="10px">
                    <chakra.span fontSize="22px" fontWeight={600} fontVariantNumeric="tabular-nums" overflowWrap="anywhere">
                        {swap.expectedOut ? walletAmount(swap.expectedOut) : "0"}{buying ? ` ${asset.ticker}` : ""}
                    </chakra.span>
                    {!buying && select}
                </Flex>
                {swap.priceImpact && <Row label="Price impact">{formatPriceImpact(swap.priceImpact)}</Row>}
                <Row label="Network fee">≈ {walletAmount(gasFee.displayAmount)} {gasFee.ticker}</Row>
            </Flex>

            <Flex align="center" justify="space-between" gap="8px" wrap="wrap">
                <chakra.span id={slippageId} fontSize="13px" color={ts.muted}>Max slippage</chakra.span>
                <Flex role="group" aria-labelledby={slippageId} gap="6px">
                    {SLIPPAGE_OPTIONS.map((option) => (
                        <TsChip key={option} selected={slippage === option} onClick={() => setSlippage(option)}>{option}%</TsChip>
                    ))}
                </Flex>
            </Flex>

            {notice}

            <TsButton type="submit" variant="primary" w="100%" minH="52px" fontSize="16px" disabled={!canSwap}>
                {swap.isSubmitting ? (swap.progressTrack || "Waiting for signature…") : cta}
            </TsButton>
        </chakra.form>
    );
}
