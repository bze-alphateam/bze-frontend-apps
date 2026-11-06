'use client';

import React from "react";
import {Box, chakra, Grid} from "@chakra-ui/react";
import {shortAddress} from "@/lib/token-activity";
import {formatShare} from "@/lib/token-activity/supply-split";

import {ts, tsLabel, tsMix} from "../kit";
import {ListCard} from "./parts";

/** A holder as the snapshot lists it. */
export interface HolderRow {
    rank: number;
    address: string;
    label: { name: string; kind: string } | null;
    /** Display units, already formatted. */
    balance: string;
    /** Percent of the supply; null without a supply. */
    share: number | null;
}

/** The tag beside a holder: Creator first, then what its label says it is. */
export function holderTag(row: Pick<HolderRow, "address" | "label">, creator?: string | null): { text: string; creator: boolean } | undefined {
    if (creator && row.address === creator) return {text: "Creator", creator: true};
    if (row.label?.kind === "module") return {text: "Module", creator: false};
    if (row.label?.kind === "ibc_escrow") return {text: "IBC escrow", creator: false};

    return undefined;
}

const COLUMNS = {base: "28px minmax(0, 1fr) auto", md: "48px minmax(0, 1fr) 200px 260px"};

/** The ranked holders list (Holders tab): label, address, Creator / Module tag, balance and share. */
export function HoldersTable({rows, creator, holderHref}: { rows: HolderRow[]; creator?: string | null; holderHref: (address: string) => string }) {
    const maxShare = rows.reduce((max, row) => Math.max(max, row.share ?? 0), 0) || 1;

    return (
        <ListCard data-testid="holders-table">
            <Grid templateColumns={COLUMNS} gap="12px" px={{base: "16px", md: "24px"}} py="14px" aria-hidden="true">
                <chakra.span {...tsLabel}>#</chakra.span>
                <chakra.span {...tsLabel}>Holder</chakra.span>
                <chakra.span {...tsLabel} textAlign="right">Balance</chakra.span>
                <chakra.span {...tsLabel} display={{base: "none", md: "block"}}>Share of supply</chakra.span>
            </Grid>
            {rows.map((row) => {
                const tag = holderTag(row, creator);
                const share = row.share === null ? "" : formatShare(row.share);
                return (
                    <Grid key={row.address} templateColumns={COLUMNS} gap="12px" alignItems="center" px={{base: "16px", md: "24px"}} py="14px" data-testid="holder-row">
                        <chakra.span fontSize="15px" fontWeight={700} color={ts.muted} fontVariantNumeric="tabular-nums">{row.rank}</chakra.span>
                        <chakra.span display="flex" alignItems="center" gap="8px" flexWrap="wrap" minW="0">
                            {row.label?.name && (
                                <chakra.a href={holderHref(row.address)} fontSize="15px" fontWeight={600} textDecoration="none" color={ts.fg}>{row.label.name}</chakra.a>
                            )}
                            <AddressChip address={row.address} href={holderHref(row.address)}/>
                            {tag && <TagPill creator={tag.creator}>{tag.text}</TagPill>}
                        </chakra.span>
                        <chakra.span textAlign="right" display="flex" flexDirection="column" gap="2px">
                            <chakra.span fontSize="16px" fontWeight={700} fontVariantNumeric="tabular-nums" overflowWrap="anywhere">{row.balance}</chakra.span>
                            <chakra.span display={{base: "block", md: "none"}} fontSize="13px" color={ts.muted}>{share}</chakra.span>
                        </chakra.span>
                        <chakra.span display={{base: "none", md: "flex"}} alignItems="center" gap="10px">
                            <Box flex="1" h="6px" borderRadius="999px" bg={ts.inset} overflow="hidden">
                                <Box h="100%" borderRadius="999px" bg={ts.sec} w={`${Math.max(2, ((row.share ?? 0) / maxShare) * 100)}%`}/>
                            </Box>
                            <chakra.span w="84px" textAlign="right" fontSize="14px" fontVariantNumeric="tabular-nums" color={ts.muted}>{share}</chakra.span>
                        </chakra.span>
                    </Grid>
                );
            })}
        </ListCard>
    );
}

/** An address as a mono chip that opens its holder page inside the token site. */
export function AddressChip({address, href}: { address: string; href: string }) {
    return (
        <chakra.a
            href={href}
            title={address}
            fontFamily="'JetBrains Mono', monospace"
            fontSize="13px"
            fontWeight={500}
            px="8px"
            py="3px"
            borderRadius="8px"
            bg={ts.inset}
            color={ts.fg}
            textDecoration="none"
            whiteSpace="nowrap"
        >
            {shortAddress(address)}
        </chakra.a>
    );
}

/** The Creator (primary tint) or Module (secondary tint) pill. */
export function TagPill({creator, children}: { creator?: boolean; children: React.ReactNode }) {
    return (
        <chakra.span
            display="inline-flex"
            alignItems="center"
            fontSize="12px"
            fontWeight={600}
            px="10px"
            py="4px"
            borderRadius="999px"
            whiteSpace="nowrap"
            bg={creator ? tsMix(ts.pri, 18) : tsMix(ts.sec, 16)}
            color={creator ? ts.fg : tsMix(ts.sec, 70, ts.fg)}
        >
            {children}
        </chakra.span>
    );
}
