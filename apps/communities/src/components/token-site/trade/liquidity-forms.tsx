'use client';

import React, {useState} from "react";
import BigNumber from "bignumber.js";
import {chakra, Flex} from "@chakra-ui/react";
import {useChain} from "@interchain-kit/react";
import {
    amountToBigNumberUAmount,
    type Asset,
    getChainName,
    sanitizeNumberInput,
    uAmountToBigNumberAmount,
    useAssets,
    useAssetsContext,
    useBZETx,
    useCanAffordTx,
    useLiquidityPools,
    useMaxSpendable,
} from "@bze/bze-ui-kit";

import {formatShare} from "@/lib/token-site/holders-pool";
import {
    addLiquidityMessage,
    depositAmountProblem,
    depositShares,
    matchedAmount,
    REMOVE_PERCENTAGES,
    removeEstimate,
    removeLiquidityMessage,
    shareAfterDeposit,
    type TokenPoolRow,
} from "@/lib/token-site/liquidity";
import {DEFAULT_SLIPPAGE, SLIPPAGE_OPTIONS} from "@/lib/token-site/swap";
import {walletAmount} from "@/lib/token-site/wallet";

import {TsButton, TsChip, TsField, ts, tsMix} from "../kit";

interface LiquidityFormProps {
    asset: Asset;
    row: TokenPoolRow;
    /** The pool's LP supply (base units). */
    totalShares: BigNumber;
    /** Called once the chain accepted the transaction. */
    onDone: () => void;
}

function Row({label, children}: { label: string; children: React.ReactNode }) {
    return (
        <Flex justify="space-between" gap="12px" fontSize="13px">
            <chakra.span color={ts.muted}>{label}</chakra.span>
            <chakra.span fontWeight={600} fontVariantNumeric="tabular-nums" textAlign="right" overflowWrap="anywhere">{children}</chakra.span>
        </Flex>
    );
}

function Slippage({id, value, onChange}: { id: string; value: number; onChange: (value: number) => void }) {
    return (
        <Flex align="center" justify="space-between" gap="8px" wrap="wrap">
            <chakra.span id={id} fontSize="13px" color={ts.muted}>Max slippage</chakra.span>
            <Flex role="group" aria-labelledby={id} gap="6px">
                {SLIPPAGE_OPTIONS.map((option) => (
                    <TsChip key={option} selected={value === option} onClick={() => onChange(option)}>{option}%</TsChip>
                ))}
            </Flex>
        </Flex>
    );
}

/** After a liquidity tx: the wallet's balances (LP shares included) and the pools' reserves. */
function useRefresh() {
    const {updateBalances} = useAssetsContext();
    const {updateLiquidityPools} = useLiquidityPools();

    return () => {
        updateBalances();
        void updateLiquidityPools();
    };
}

interface SideFieldProps {
    id: string;
    ticker: string;
    decimals: number;
    value: string;
    balance: BigNumber;
    maxValue: string;
    canMax: boolean;
    invalid: boolean;
    errorId?: string;
    onChange: (value: string) => void;
}

/** One side of the deposit: its amount, the wallet balance and Max. */
function SideField({id, ticker, decimals, value, balance, maxValue, canMax, invalid, errorId, onChange}: SideFieldProps) {
    return (
        <Flex direction="column" gap="6px" flex="1 1 220px" minW="0">
            <TsField
                id={id}
                label={ticker}
                inputMode="decimal"
                placeholder="0"
                value={value}
                onChange={(event) => onChange(sanitizeNumberInput(event.target.value))}
                aria-invalid={invalid}
                aria-describedby={errorId}
                suffix={ticker}
            />
            <Flex justify="space-between" align="center" gap="8px" px="4px" fontSize="13px">
                <chakra.span color={ts.muted}>Balance {walletAmount(uAmountToBigNumberAmount(balance, decimals))} {ticker}</chakra.span>
                <chakra.button
                    type="button"
                    aria-label={`Max ${ticker}`}
                    onClick={() => onChange(maxValue)}
                    disabled={!canMax}
                    font="inherit"
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
        </Flex>
    );
}

/**
 * Add T and the pool's other token at the pool's ratio (Business Logic R9): editing either side
 * fills the other, the expected LP shares minus the slippage are the least the chain may mint.
 */
export function AddLiquidityForm({asset, row, totalShares, onDone}: LiquidityFormProps) {
    const {pool, other, tokenIsBase} = row;
    const {denomTicker, denomDecimals} = useAssets();
    const {address} = useChain(getChainName());
    const {tx, progressTrack} = useBZETx();
    const refresh = useRefresh();
    const [token, setToken] = useState("");
    const [paired, setPaired] = useState("");
    const [slippage, setSlippage] = useState<number>(DEFAULT_SLIPPAGE);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const otherTicker = denomTicker(other);
    const otherDecimals = denomDecimals(other);
    const tokenMax = useMaxSpendable(asset.denom, "add-liquidity");
    const otherMax = useMaxSpendable(other, "add-liquidity");

    const fill = (from: "token" | "paired", value: string) => {
        const fromToken = from === "token";
        const matched = matchedAmount(pool, value, fromToken === tokenIsBase, fromToken ? asset.decimals : otherDecimals, fromToken ? otherDecimals : asset.decimals);
        const counterpart = matched.gt(0) ? matched.toFixed() : "";
        setToken(fromToken ? value : counterpart);
        setPaired(fromToken ? counterpart : value);
    };

    const filled = token !== "" && paired !== "";
    const tokenProblem = token === "" ? "" : depositAmountProblem(token, uAmountToBigNumberAmount(tokenMax.balance, asset.decimals), asset.decimals, asset.ticker);
    const pairedProblem = paired === "" ? "" : depositAmountProblem(paired, uAmountToBigNumberAmount(otherMax.balance, otherDecimals), otherDecimals, otherTicker);
    const uToken = filled ? amountToBigNumberUAmount(token, asset.decimals) : new BigNumber(0);
    const uPaired = filled ? amountToBigNumberUAmount(paired, otherDecimals) : new BigNumber(0);
    const uBase = tokenIsBase ? uToken : uPaired;
    const uQuote = tokenIsBase ? uPaired : uToken;
    const shares = depositShares(pool, totalShares, uBase, uQuote);
    const sizeProblem = filled && !tokenProblem && !pairedProblem && !shares.gt(0) ? "These amounts are too small for a share of the pool" : "";

    const ready = filled && !tokenProblem && !pairedProblem && !sizeProblem;
    const afford = useCanAffordTx({
        spec: address && ready ? "add-liquidity" : undefined,
        spend: ready ? [{denom: asset.denom, amount: uToken}, {denom: other, amount: uPaired}] : undefined,
    });
    const error = tokenProblem || pairedProblem || sizeProblem || (ready && !afford.isLoading && !afford.canAfford ? afford.message : "");
    const canSubmit = Boolean(address) && ready && error === "" && !afford.isLoading && !isSubmitting;
    const errorId = `add-liquidity-error-${pool.id}`;

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!address || !canSubmit) return;

        setIsSubmitting(true);
        try {
            if (await tx([addLiquidityMessage(address, pool.id, uBase, uQuote, shares, slippage)])) {
                refresh();
                onDone();
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <chakra.form onSubmit={submit} display="flex" flexDirection="column" gap="14px" w="100%" noValidate data-testid="add-liquidity-form">
            <Flex wrap="wrap" gap="16px">
                <SideField
                    id={`add-liquidity-token-${pool.id}`}
                    ticker={asset.ticker}
                    decimals={asset.decimals}
                    value={token}
                    balance={tokenMax.balance}
                    maxValue={tokenMax.inputValue}
                    canMax={!tokenMax.isLoading && tokenMax.amount.gt(0)}
                    invalid={tokenProblem !== ""}
                    errorId={error ? errorId : undefined}
                    onChange={(value) => fill("token", value)}
                />
                <SideField
                    id={`add-liquidity-paired-${pool.id}`}
                    ticker={otherTicker}
                    decimals={otherDecimals}
                    value={paired}
                    balance={otherMax.balance}
                    maxValue={otherMax.inputValue}
                    canMax={!otherMax.isLoading && otherMax.amount.gt(0)}
                    invalid={pairedProblem !== ""}
                    errorId={error ? errorId : undefined}
                    onChange={(value) => fill("paired", value)}
                />
            </Flex>

            {error
                ? <chakra.span id={errorId} role="alert" fontSize="13px" color={ts.danger}>{error}</chakra.span>
                : (
                    <chakra.span fontSize="13px" color={ts.muted} data-testid="add-liquidity-share">
                        {shares.gt(0)
                            ? `Matched at the pool ratio · you'd own ≈${formatShare(shareAfterDeposit(shares, totalShares))} of the pool`
                            : "Matched at the pool ratio: enter either amount and the other follows."}
                    </chakra.span>
                )}
            <Slippage id={`add-liquidity-slippage-${pool.id}`} value={slippage} onChange={setSlippage}/>
            {ready && afford.gasFee.displayAmount.gt(0) && (
                <Row label="Network fee">≈ {walletAmount(afford.gasFee.displayAmount)} {afford.gasFee.ticker}</Row>
            )}

            <TsButton type="submit" variant="primary" w="100%" minH="52px" fontSize="16px" disabled={!canSubmit}>
                {isSubmitting ? (progressTrack || "Waiting for signature…") : "Add liquidity"}
            </TsButton>
        </chakra.form>
    );
}

interface RemoveLiquidityFormProps extends LiquidityFormProps {
    /** The viewer's LP shares (base units). */
    userShares: BigNumber;
}

/**
 * Withdraw a part of the viewer's LP shares (Business Logic R9): the reserves they return, and the
 * least of each the chain may pay after the slippage.
 */
export function RemoveLiquidityForm({asset, row, totalShares, userShares, onDone}: RemoveLiquidityFormProps) {
    const {pool, other, tokenIsBase} = row;
    const {denomTicker, denomDecimals} = useAssets();
    const {address} = useChain(getChainName());
    const {tx, progressTrack} = useBZETx();
    const refresh = useRefresh();
    const [percent, setPercent] = useState<number>();
    const [slippage, setSlippage] = useState<number>(DEFAULT_SLIPPAGE);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const estimate = percent ? removeEstimate(pool, userShares, totalShares, percent) : undefined;
    const ready = Boolean(estimate?.lpTokens.gt(0));
    const afford = useCanAffordTx({spec: address && ready ? "remove-liquidity" : undefined});
    const error = percent && !ready
        ? "Your shares are too few to remove this part"
        : ready && !afford.isLoading && !afford.canAfford ? afford.message : "";
    const canSubmit = Boolean(address) && ready && error === "" && !afford.isLoading && !isSubmitting;
    const percentId = `remove-liquidity-percent-${pool.id}`;

    const out = (uAmount: BigNumber, decimals: number) => walletAmount(uAmountToBigNumberAmount(uAmount, decimals));
    const tokenOut = estimate ? (tokenIsBase ? estimate.base : estimate.quote) : new BigNumber(0);
    const otherOut = estimate ? (tokenIsBase ? estimate.quote : estimate.base) : new BigNumber(0);

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!address || !canSubmit || !estimate) return;

        setIsSubmitting(true);
        try {
            if (await tx([removeLiquidityMessage(address, pool.id, estimate, slippage)])) {
                refresh();
                onDone();
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <chakra.form onSubmit={submit} display="flex" flexDirection="column" gap="14px" w="100%" noValidate data-testid="remove-liquidity-form">
            <Flex align="center" justify="space-between" gap="8px" wrap="wrap">
                <chakra.span id={percentId} fontSize="13px" color={ts.muted}>How much of your liquidity</chakra.span>
                <Flex role="group" aria-labelledby={percentId} gap="6px" wrap="wrap">
                    {REMOVE_PERCENTAGES.map((option) => (
                        <TsChip key={option} selected={percent === option} onClick={() => setPercent(option)}>{option}%</TsChip>
                    ))}
                </Flex>
            </Flex>

            <Flex direction="column" gap="8px" borderRadius="14px" px="16px" py="14px" bg={tsMix(ts.fg, 4)} data-testid="remove-liquidity-estimate">
                <chakra.span color={ts.muted} fontSize="13px">You receive about</chakra.span>
                <Row label={asset.ticker}>{out(tokenOut, asset.decimals)}</Row>
                <Row label={denomTicker(other)}>{out(otherOut, denomDecimals(other))}</Row>
            </Flex>

            {error && <chakra.span role="alert" fontSize="13px" color={ts.danger}>{error}</chakra.span>}
            <Slippage id={`remove-liquidity-slippage-${pool.id}`} value={slippage} onChange={setSlippage}/>
            {ready && afford.gasFee.displayAmount.gt(0) && (
                <Row label="Network fee">≈ {walletAmount(afford.gasFee.displayAmount)} {afford.gasFee.ticker}</Row>
            )}

            <TsButton type="submit" variant="danger" w="100%" minH="52px" fontSize="16px" disabled={!canSubmit}>
                {isSubmitting ? (progressTrack || "Waiting for signature…") : "Remove liquidity"}
            </TsButton>
        </chakra.form>
    );
}
