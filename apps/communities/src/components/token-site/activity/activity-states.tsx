'use client';

import React from "react";
import {chakra, Flex} from "@chakra-ui/react";
import {LuActivity} from "react-icons/lu";

import {TsButton, TsCard, ts, tsMix} from "../kit";

// The Token Activity states (canvas "States"): empty and error + retry, inside the card where the
// rows go. The Activity tab shares them with the token page's snippet.

/** No row yet: Scan has indexed nothing that moved the token. */
export function ActivityEmpty({symbol}: { symbol: string }) {
    return (
        <TsCard px={{base: "20px", md: "32px"}} py="48px">
            <Flex direction="column" align="center" gap="10px" textAlign="center">
                <Flex aria-hidden="true" w="48px" h="48px" borderRadius="50%" bg={ts.inset} color={ts.muted} align="center" justify="center">
                    <LuActivity size={22}/>
                </Flex>
                <chakra.h3 m="0" fontSize="20px" fontWeight={700}>No activity indexed yet</chakra.h3>
                <chakra.p m="0" fontSize="15px" lineHeight="1.55" color={ts.muted} maxW="380px">
                    Trades, stakes, burns and transfers of {symbol} show up here as soon as they happen.
                </chakra.p>
            </Flex>
        </TsCard>
    );
}

/** Scan didn't answer: the reason and a retry. */
export function ActivityError({symbol, onRetry}: { symbol: string; onRetry: () => void }) {
    return (
        <TsCard p="20px">
            <Flex
                role="alert"
                align="center"
                justify="space-between"
                gap="12px"
                wrap="wrap"
                px="14px"
                py="12px"
                borderRadius="14px"
                bg={tsMix(ts.sec, 14)}
                fontSize="14px"
                lineHeight="1.45"
            >
                <chakra.span>Couldn&apos;t load {symbol} activity. BZE Scan didn&apos;t answer.</chakra.span>
                <TsButton variant="ghost" minH="40px" onClick={onRetry}>Retry</TsButton>
            </Flex>
        </TsCard>
    );
}
