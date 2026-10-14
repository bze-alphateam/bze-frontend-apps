'use client';

import React, {useState} from "react";
import {chakra, Flex} from "@chakra-ui/react";
import {useChain} from "@interchain-kit/react";
import {WalletState} from "@interchain-kit/core";
import {type Asset, getChainName, useAssets, useLiquidityPool} from "@bze/bze-ui-kit";

import {useTokenPools} from "@/hooks/token-site/useTokenPools";
import {formatApr, formatShare} from "@/lib/token-site/holders-pool";
import {poolShareOf, type TokenPoolRow} from "@/lib/token-site/liquidity";
import {walletUsd} from "@/lib/token-site/wallet";

import {TsButton, TsCard, TsChip, TsTable, ts} from "../kit";
import {AddLiquidityForm, RemoveLiquidityForm} from "./liquidity-forms";

type FormMode = "add" | "remove";

const COLUMNS = 6;

interface PoolRowProps {
    asset: Asset;
    row: TokenPoolRow;
    connected: boolean;
    mode?: FormMode;
    onToggle: (mode: FormMode) => void;
    onClose: () => void;
}

/** One pool: its numbers, the viewer's share and the Add / Remove toggles, with the open form under it. */
function PoolRow({asset, row, connected, mode, onToggle, onClose}: PoolRowProps) {
    const {denomTicker} = useAssets();
    const {connect} = useChain(getChainName());
    const {userShares, totalShares} = useLiquidityPool(row.pool.id);
    const share = poolShareOf(userShares, totalShares);
    const pair = `${asset.ticker} / ${denomTicker(row.other)}`;
    const formId = `liquidity-form-${row.pool.id}`;

    return (
        <>
            <tr data-testid={`liquidity-pool-${row.pool.id}`}>
                <chakra.td fontWeight={600}>{pair}</chakra.td>
                <td data-label="Liquidity" data-testid="pool-liquidity">{row.liquidityUsd ? walletUsd(row.liquidityUsd) : "—"}</td>
                <td data-label="24h volume" data-testid="pool-volume">{row.volumeUsd ? walletUsd(row.volumeUsd) : "—"}</td>
                <td data-label="APR" data-testid="pool-apr">{row.apr ? formatApr(row.apr) : "—"}</td>
                <td data-label="Your share" data-testid="pool-share">{share ? formatShare(share) : "—"}</td>
                <td>
                    <Flex gap="8px" justify="flex-end" wrap="wrap">
                        <TsChip
                            selected={mode === "add"}
                            aria-expanded={mode === "add"}
                            aria-controls={mode === "add" ? formId : undefined}
                            aria-label={mode === "add" ? `Close adding to ${pair}` : `Add liquidity to ${pair}`}
                            onClick={() => onToggle("add")}
                        >
                            {mode === "add" ? "Close" : "Add liquidity"}
                        </TsChip>
                        {share && (
                            <TsChip
                                selected={mode === "remove"}
                                aria-expanded={mode === "remove"}
                                aria-controls={mode === "remove" ? formId : undefined}
                                aria-label={mode === "remove" ? `Close removing from ${pair}` : `Remove liquidity from ${pair}`}
                                onClick={() => onToggle("remove")}
                            >
                                {mode === "remove" ? "Close" : "Remove"}
                            </TsChip>
                        )}
                    </Flex>
                </td>
            </tr>
            {mode && (
                <tr>
                    <td colSpan={COLUMNS} id={formId}>
                        {!connected ? (
                            <Flex direction="column" gap="14px" data-testid="liquidity-connect-prompt">
                                <chakra.p m="0" color={ts.muted} lineHeight="1.55">
                                    Connect a wallet to add liquidity to the {pair} pool.
                                </chakra.p>
                                <TsButton variant="primary" minH="52px" onClick={() => connect()}>Connect wallet</TsButton>
                            </Flex>
                        ) : mode === "add" ? (
                            <AddLiquidityForm asset={asset} row={row} totalShares={totalShares} onDone={onClose}/>
                        ) : (
                            <RemoveLiquidityForm asset={asset} row={row} totalShares={totalShares} userShares={userShares} onDone={onClose}/>
                        )}
                    </td>
                </tr>
            )}
        </>
    );
}

/**
 * "Liquidity pools" in the Trade section (Business Logic R9): every pool containing T, the most
 * liquidity first, where anyone can add liquidity and providers can remove theirs. One form is
 * open at a time, under its pool's row; on a phone each row is a card.
 */
export function LiquidityPools({asset}: { asset: Asset }) {
    const {rows} = useTokenPools(asset.denom);
    const {status, address} = useChain(getChainName());
    const [open, setOpen] = useState<{ poolId: string; mode: FormMode }>();
    const connected = status === WalletState.Connected && Boolean(address);
    if (rows.length === 0) return null;

    const toggle = (poolId: string, mode: FormMode) =>
        setOpen((current) => (current?.poolId === poolId && current.mode === mode ? undefined : {poolId, mode}));

    return (
        <TsCard overflow="hidden" data-testid="liquidity-pools">
            <Flex direction="column" gap="4px" px="16px" pt="24px" pb="8px">
                <chakra.h3 m="0" fontSize="20px" fontWeight={700}>Liquidity pools</chakra.h3>
                <chakra.span color={ts.muted} fontSize="14px">Add both tokens to a pool and earn a share of every swap fee.</chakra.span>
            </Flex>
            <TsTable stackOnPhone>
                <thead>
                    <tr>
                        <th>Pool</th>
                        <th>Liquidity</th>
                        <th>24h volume</th>
                        <th>APR</th>
                        <th>Your share</th>
                        <th><chakra.span srOnly>Actions</chakra.span></th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <PoolRow
                            key={row.pool.id}
                            asset={asset}
                            row={row}
                            connected={connected}
                            mode={open?.poolId === row.pool.id ? open.mode : undefined}
                            onToggle={(mode) => toggle(row.pool.id, mode)}
                            onClose={() => setOpen(undefined)}
                        />
                    ))}
                </tbody>
            </TsTable>
        </TsCard>
    );
}
