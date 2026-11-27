'use client';

import React, {useCallback, useEffect, useState} from "react";
import {chakra, Flex, type FlexProps, type HTMLChakraProps} from "@chakra-ui/react";
import {
    type Asset,
    formatRatioPercent,
    getAddressDenomBalance,
    getFactoryDenomAuthority,
    prettyAmount,
    truncateAddress,
    uAmountToAmount,
    useDenomConfig,
} from "@bze/bze-ui-kit";

import {TsCard, TsChip, TsSection, TsStat, ts, tsLabel} from "./kit";

interface AdminState {
    denom: string;
    /** '' = renounced; undefined = the query failed. */
    admin?: string;
    /** Whether minting is still on. */
    mintable?: boolean;
}

/** The tokenfactory admin of `denom`: undefined until known or when the query failed. */
function useDenomAdmin(denom: string): AdminState | undefined {
    const [state, setState] = useState<AdminState | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;
        getFactoryDenomAuthority(denom).then((authority) => {
            if (!cancelled) setState({denom, admin: authority?.admin, mintable: authority?.mintable});
        });

        return () => { cancelled = true; };
    }, [denom]);

    return state?.denom === denom ? state : undefined;
}

/** The micro-unit balance of `address` in `denom`: undefined until known or when the query failed. */
function usePoolBalance(address: string, denom: string): string | undefined {
    const [state, setState] = useState<{ key: string; amount?: string } | undefined>(undefined);
    const key = `${address}|${denom}`;

    useEffect(() => {
        if (!address) return;
        let cancelled = false;
        getAddressDenomBalance(address, denom).then((amount) => {
            if (!cancelled) setState({key, amount});
        });

        return () => { cancelled = true; };
    }, [address, denom, key]);

    return address && state?.key === key ? state.amount : undefined;
}

function CopyText({text, label}: { text: string; label: string }) {
    const [copied, setCopied] = useState(false);

    const onCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            /* clipboard unavailable: ignore */
        }
    }, [text]);

    return <TsChip onClick={onCopy} aria-label={label}>{copied ? "Copied" : "Copy"}</TsChip>;
}

/**
 * The token's v8.3.0 fee settings (community pool, transfer fee, network fee surcharge). Renders
 * nothing when every setting is zero/empty or the node is a v8.2.0 one.
 */
function FeeSettings({asset, cell, small}: { asset: Asset; cell: FlexProps; small: HTMLChakraProps<"span"> }) {
    const config = useDenomConfig(asset.denom);
    const pool = config?.status === "ok" ? config.communityPool : "";
    const poolBalance = usePoolBalance(pool, asset.denom);

    if (!config || config.status !== "ok") return null;
    // a ratio that rounds to "0%" is no setting
    const hasTransfer = formatRatioPercent(config.transferFee) !== "0";
    const hasSurcharge = formatRatioPercent(config.gasSurcharge) !== "0";
    if (!pool && !hasTransfer && !hasSurcharge) return null;

    const ticker = asset.ticker;
    return (
        <Flex direction="column" gap="16px" gridColumn="1 / -1" borderTopWidth="1px" borderStyle="solid" borderColor={ts.border} data-testid="fee-settings" {...cell}>
            <chakra.span {...tsLabel}>Fees</chakra.span>
            <Flex wrap="wrap" gap="24px">
                <Flex direction="column" gap="6px">
                    <chakra.span {...tsLabel}>Community pool</chakra.span>
                    {pool ? (
                        <>
                            <Flex align="center" gap="12px">
                                <chakra.span fontFamily="mono" fontSize="14px" fontWeight={500} data-testid="community-pool">{truncateAddress(pool)}</chakra.span>
                                <CopyText text={pool} label="Copy community pool address"/>
                            </Flex>
                            {poolBalance !== undefined && (
                                <chakra.span fontSize="14px" data-testid="pool-balance">
                                    holds {prettyAmount(uAmountToAmount(poolBalance, asset.decimals))} {ticker}
                                </chakra.span>
                            )}
                        </>
                    ) : (
                        <chakra.span {...small} fontSize="14px" data-testid="community-pool">None: fees in {ticker} are burned</chakra.span>
                    )}
                </Flex>
                {hasTransfer && (
                    <Flex direction="column" gap="6px">
                        <chakra.span {...tsLabel}>Transfer fee</chakra.span>
                        <chakra.span fontSize="14px" data-testid="transfer-fee">
                            {formatRatioPercent(config.transferFee)}% extra on app fees paid in {ticker}
                        </chakra.span>
                    </Flex>
                )}
                {hasSurcharge && (
                    <Flex direction="column" gap="6px">
                        <chakra.span {...tsLabel}>Network fee surcharge</chakra.span>
                        <chakra.span fontSize="14px" data-testid="gas-surcharge">
                            +{formatRatioPercent(config.gasSurcharge)}% when {ticker} pays the network fee
                        </chakra.span>
                    </Flex>
                )}
            </Flex>
            <chakra.span fontSize="13px" opacity={0.8} data-testid="fee-explanation">
                Trading fees, network fee surcharges and transfer fees paid in {ticker} {pool ? "go to its community pool." : "are burned."}
            </chakra.span>
        </Flex>
    );
}

/** Token details (Business Logic R3): ticker, decimals, supply control, creator and denom. */
export function TokenDetails({asset}: { asset: Asset }) {
    const adminState = useDenomAdmin(asset.denom);
    // factory/<creator>/<subdenom>
    const creator = asset.denom.split("/")[1] ?? "";

    let supplyControl: string | undefined;
    if (adminState && adminState.admin !== undefined) {
        supplyControl = adminState.admin === ""
            ? "Admin renounced"
            : adminState.mintable === false
                ? `Minting off, admin ${truncateAddress(adminState.admin)}`
                : `Admin ${truncateAddress(adminState.admin)}`;
    }

    const cell = {px: {base: "18px", md: "24px"}, py: {base: "18px", md: "22px"}} as const;
    const small = {fontSize: "18px", fontWeight: 700} as const;

    return (
        <TsSection id="details" eyebrow="Token" title="Token details">
            <TsCard display="grid" gridTemplateColumns="repeat(auto-fit, minmax(min(260px, 100%), 1fr))">
                <TsStat label="Ticker" value={<chakra.span {...small}>{asset.ticker}</chakra.span>} {...cell}/>
                <TsStat label="Decimals" value={<chakra.span {...small}>{asset.decimals}</chakra.span>} {...cell}/>
                {supplyControl && (
                    <TsStat label="Supply control" value={<chakra.span {...small} data-testid="supply-control">{supplyControl}</chakra.span>} {...cell}/>
                )}
                {creator && <TsStat label="Creator" value={<chakra.span fontFamily="mono" fontSize="14px" fontWeight={500}>{truncateAddress(creator)}</chakra.span>} {...cell}/>}
                <FeeSettings asset={asset} cell={cell} small={small}/>
                <Flex direction="column" gap="8px" gridColumn="1 / -1" borderTopWidth="1px" borderStyle="solid" borderColor={ts.border} {...cell}>
                    <chakra.span {...tsLabel}>Denom</chakra.span>
                    <Flex wrap="wrap" align="center" gap="12px">
                        <chakra.code fontFamily="mono" fontSize="13px" wordBreak="break-all" bg={ts.inset} color={ts.fg} px="12px" py="8px" borderRadius="10px">
                            {asset.denom}
                        </chakra.code>
                        <CopyText text={asset.denom} label="Copy denom"/>
                    </Flex>
                </Flex>
            </TsCard>
        </TsSection>
    );
}
