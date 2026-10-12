'use client';

import React, {useState} from "react";
import BigNumber from "bignumber.js";
import {chakra, Flex} from "@chakra-ui/react";
import {
    type Asset,
    sanitizeNumberInput,
    type TxSpec,
    uAmountToBigNumberAmount,
    useBalances,
    useCanAffordTx,
    useGasFeeEstimate,
    useLiquidityPools,
    useMaxSpendable,
} from "@bze/bze-ui-kit";

import {useTokenSwap} from "@/hooks/token-site/useTokenSwap";
import {DEFAULT_SLIPPAGE, formatPriceImpact, isTradable, payableTokens, SLIPPAGE_OPTIONS} from "@/lib/token-site/swap";
import {walletAmount} from "@/lib/token-site/wallet";

import {TsButton, TsChip, TsField, TsNotice, ts, tsMix} from "../kit";

/** "Not tradable yet" when T sits in no pool (R8); nothing while it does or the pools are loading. */
export function NotTradableNotice({asset}: { asset: Asset }) {
    const {pools, isLoading} = useLiquidityPools();
    if (isLoading || isTradable(asset.denom, pools)) return null;

    return (
        <TsNotice data-testid="get-not-tradable">
            <chakra.strong display="block">Not tradable yet</chakra.strong>
            {asset.ticker} isn&apos;t in any liquidity pool, so it can&apos;t be swapped into for now.
        </TsNotice>
    );
}

/** Why `amount` (display units) can't be paid, or '' when it can as far as the balance goes. */
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

/**
 * Get T (Business Logic R8): an instant swap into T, paying with any held token that has a route
 * of at most 3 hops; the most valuable one (in USD) is preselected. Max keeps the network fee back
 * when paying with the fee token.
 */
export function GetTab({asset}: { asset: Asset }) {
    const {assetsBalances} = useBalances();
    const {pools, isLoading: poolsLoading} = useLiquidityPools();
    const [picked, setPicked] = useState<string>();
    const [amount, setAmount] = useState("");
    const [slippage, setSlippage] = useState<number>(DEFAULT_SLIPPAGE);

    const payable = payableTokens(assetsBalances, asset.denom, pools);
    const paying = payable.find((token) => token.denom === picked) ?? payable[0];

    const swap = useTokenSwap(asset.denom, {direction: "buy", other: paying?.denom, amountIn: amount, slippage});
    const spec: TxSpec = {kind: "swap", count: swap.route?.route.length ?? 1};
    const maxSpendable = useMaxSpendable(paying?.denom ?? "", spec);
    const gasFee = useGasFeeEstimate(spec);
    const affordability = useCanAffordTx({
        spec: amount !== "" ? spec : undefined,
        spend: amount !== "" && paying && swap.uAmountIn ? {denom: paying.denom, amount: swap.uAmountIn.toFixed(0)} : undefined,
    });

    if (!swap.isTradable) {
        return poolsLoading ? <chakra.p m="0" color={ts.muted}>Loading pools…</chakra.p> : <NotTradableNotice asset={asset}/>;
    }
    if (!paying) {
        return (
            <TsNotice data-testid="get-nothing-to-pay">
                Nothing in this wallet can be swapped into {asset.ticker} yet. Add funds to the wallet first.
            </TsNotice>
        );
    }

    const amountError = amount === ""
        ? ""
        : amountProblem(amount, uAmountToBigNumberAmount(paying.amount, paying.decimals), paying.decimals, paying.ticker)
        || swap.error
        || affordability.message;
    const canSwap = amount !== "" && !amountError && Boolean(swap.route) && !affordability.isLoading && !swap.isSubmitting;

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!canSwap) return;
        if (await swap.submit()) setAmount("");
    };

    return (
        <chakra.form onSubmit={submit} display="flex" flexDirection="column" gap="12px" noValidate data-testid="get-tab">
            <TsField
                label="You pay"
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={(event) => setAmount(sanitizeNumberInput(event.target.value))}
                aria-invalid={amountError !== ""}
                aria-describedby={amountError ? "get-amount-error" : undefined}
                suffix={(
                    <chakra.select
                        aria-label="Pay with"
                        value={paying.denom}
                        onChange={(event) => setPicked(event.target.value)}
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
                        {payable.map((token) => <option key={token.denom} value={token.denom}>{token.ticker}</option>)}
                    </chakra.select>
                )}
            />
            <Flex justify="space-between" align="center" gap="8px" px="4px">
                {amountError
                    ? <chakra.span id="get-amount-error" role="alert" fontSize="13px" color={ts.danger}>{amountError}</chakra.span>
                    : (
                        <chakra.span fontSize="13px" color={ts.muted}>
                            Balance {walletAmount(uAmountToBigNumberAmount(paying.amount, paying.decimals))} {paying.ticker}
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

            <Flex direction="column" gap="8px" borderRadius="14px" px="16px" py="14px" bg={tsMix(ts.fg, 4)} data-testid="get-quote">
                <chakra.span color={ts.muted} fontSize="13px">You get</chakra.span>
                <chakra.span fontSize="22px" fontWeight={600} fontVariantNumeric="tabular-nums">
                    {swap.expectedOut ? walletAmount(swap.expectedOut) : "0"} {asset.ticker}
                </chakra.span>
                {swap.priceImpact && <Row label="Price impact">{formatPriceImpact(swap.priceImpact)}</Row>}
                <Row label="Network fee">≈ {walletAmount(gasFee.displayAmount)} {gasFee.ticker}</Row>
            </Flex>

            <Flex align="center" justify="space-between" gap="8px" wrap="wrap">
                <chakra.span id="get-slippage" fontSize="13px" color={ts.muted}>Max slippage</chakra.span>
                <Flex role="group" aria-labelledby="get-slippage" gap="6px">
                    {SLIPPAGE_OPTIONS.map((option) => (
                        <TsChip key={option} selected={slippage === option} onClick={() => setSlippage(option)}>{option}%</TsChip>
                    ))}
                </Flex>
            </Flex>

            <TsButton type="submit" variant="primary" w="100%" minH="52px" fontSize="16px" disabled={!canSwap}>
                {swap.isSubmitting ? (swap.progressTrack || "Waiting for signature…") : `Get ${asset.ticker}`}
            </TsButton>
        </chakra.form>
    );
}
