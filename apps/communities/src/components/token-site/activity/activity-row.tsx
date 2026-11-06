'use client';

import React from "react";
import {Box, chakra, Flex, Skeleton} from "@chakra-ui/react";

import {
    type ActivityRow as Row,
    formatCoins,
    formatUnits,
    formatWhen,
    shortAddress,
    shortHash,
    tokenHolderPath,
    tokenTxPath,
} from "@/lib/token-activity";

import {TsTag, ts, tsMix} from "../kit";

// One Token Activity row (the token page's snippet and the Activity tab): tag, title, who did it,
// the token moved with the fee it paid, when, and the transaction. Desktop is one line; on a
// phone the tag and time head the row, the title and actor follow, then amount and tx.

/** Grid of a row: desktop columns, phone areas. */
export const activityRowLayout = {
    display: "grid",
    gridTemplateColumns: {base: "minmax(0, 1fr) auto", md: "130px minmax(0, 1fr) auto 140px 100px"},
    gridTemplateAreas: {base: `"tag when" "main main" "amt tx"`, md: `"tag main amt when tx"`},
    columnGap: {base: "12px", md: "16px"},
    rowGap: "10px",
    alignItems: "center",
    px: {base: "16px", md: "24px"},
    py: "16px",
} as const;

const mono = {fontFamily: "mono", fontSize: "13px", whiteSpace: "nowrap", textDecoration: "none"} as const;

/** An address as the canvas chips it: monospace on the inset, linking to the holder page. */
function AddressChip({denom, address, name}: { denom: string; address: string; name?: string }) {
    return (
        <chakra.a
            href={tokenHolderPath(denom, address)}
            title={address}
            {...mono}
            fontWeight={500}
            px="8px"
            py="3px"
            borderRadius="8px"
            bg={ts.inset}
            color={ts.fg}
            _hover={{bg: ts.hover}}
        >
            {name ?? shortAddress(address)}
        </chakra.a>
    );
}

interface ActivityRowProps {
    row: Row;
    /** The token the site is about: amounts are in it, links stay in its site. */
    token: { denom: string; symbol: string; exponent: number };
    /** Draws the line above every row but the first. */
    first?: boolean;
    /** The amount with "+" when the actor received it, "−" when they sent it (a holder's own rows). */
    signed?: boolean;
    /** Leaves out "by <address>" (the holder page, where every row is the holder's own). */
    hideActor?: boolean;
}

/** The sign of a row's amount from the actor's side; none when they only moved others' tokens. */
const signOf = (direction: Row["direction"]) => (direction === "in" ? "+" : direction === "out" ? "−" : "");

export function ActivityRow({row, token, first, signed, hideActor}: ActivityRowProps) {
    const moreTitle = `${row.more} more ${row.more === 1 ? "message" : "messages"} in this transaction`;

    return (
        <Box
            role="listitem"
            data-testid="activity-row"
            {...activityRowLayout}
            borderTopWidth={first ? "0" : "1px"}
            borderTopStyle="solid"
            borderTopColor={ts.border}
        >
            <Flex gridArea="tag" align="center" gap="6px">
                <TsTag whiteSpace="nowrap">{row.tag}</TsTag>
                {row.more > 0 && (
                    <chakra.span title={moreTitle} aria-label={moreTitle} fontSize="12px" fontWeight={700} px="7px" py="3px" borderRadius="999px" bg={ts.inset} color={ts.muted}>
                        +{row.more}
                    </chakra.span>
                )}
            </Flex>

            <Flex gridArea="main" direction="column" gap="6px" minW="0">
                <chakra.span fontSize="16px" fontWeight={600}>{row.title}</chakra.span>
                {row.actor && !hideActor && (
                    <Flex align="center" gap="6px" wrap="wrap" fontSize="14px" color={ts.muted}>
                        by<AddressChip denom={token.denom} address={row.actor} name={row.actorLabel?.name}/>
                    </Flex>
                )}
            </Flex>

            <Flex gridArea="amt" direction="column" gap="4px" textAlign={{base: "left", md: "right"}} fontVariantNumeric="tabular-nums">
                <chakra.span fontSize="17px" fontWeight={700} whiteSpace="nowrap">
                    {`${signed ? signOf(row.direction) : ""}${formatUnits(row.amount, token.exponent)} ${token.symbol}`}
                </chakra.span>
                {row.fee ? (
                    <chakra.span fontSize="13px" color={ts.muted} whiteSpace="nowrap">Fee {formatCoins(row.fee)}</chakra.span>
                ) : (
                    <Skeleton aria-label="Loading the fee" h="13px" w="96px" ml={{md: "auto"}} borderRadius="6px" bg={tsMix(ts.fg, 8)}/>
                )}
            </Flex>

            <chakra.time gridArea="when" dateTime={row.time} fontSize="14px" color={ts.muted} fontVariantNumeric="tabular-nums" textAlign="right" whiteSpace="nowrap">
                {formatWhen(row.time)}
            </chakra.time>

            <chakra.a gridArea="tx" href={tokenTxPath(token.denom, row.txHash)} title={row.txHash} {...mono} color={ts.muted} textAlign="right" _hover={{color: ts.fg}}>
                {shortHash(row.txHash)}
            </chakra.a>
        </Box>
    );
}

/** A row's place while the activity loads (five of them in the snippet). */
export function ActivityRowSkeleton({first}: { first?: boolean }) {
    const bone = {bg: tsMix(ts.fg, 8), borderRadius: "6px"} as const;

    return (
        <Box
            data-testid="activity-row-skeleton"
            {...activityRowLayout}
            borderTopWidth={first ? "0" : "1px"}
            borderTopStyle="solid"
            borderTopColor={ts.border}
        >
            <Skeleton gridArea="tag" h="22px" w="90px" {...bone} borderRadius="999px"/>
            <Flex gridArea="main" direction="column" gap="8px">
                <Skeleton h="14px" w="60%" {...bone}/>
                <Skeleton h="12px" w="40%" {...bone}/>
            </Flex>
            <Skeleton gridArea="amt" h="16px" w="80px" ml={{md: "auto"}} {...bone}/>
            <Skeleton gridArea="when" h="12px" w="70px" ml="auto" {...bone}/>
            <Skeleton gridArea="tx" h="12px" w="70px" ml="auto" {...bone}/>
        </Box>
    );
}
