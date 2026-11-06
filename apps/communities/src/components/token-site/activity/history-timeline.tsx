'use client';

import React from "react";
import {Box, chakra, Flex} from "@chakra-ui/react";

import {shortHash} from "@/lib/token-activity";
import {describeTokenEvent, eventWhen, type TokenEventContext, type TokenHistoryEvent} from "@/lib/token-activity/token-events";

import {TsCard, TsLink, ts, tsMix} from "../kit";

interface HistoryTimelineProps {
    events: TokenHistoryEvent[];
    denom: string;
    context: TokenEventContext;
    /** Where a transaction opens (the token site's tx page). */
    txHref: (hash: string) => string;
    /** Under the last event: "Load more", or the note that earlier history isn't indexed. */
    footer?: React.ReactNode;
}

/** The History tab: T's events as a timeline, newest first (created, admin, metadata, brand kit, pools, halts…). */
export function HistoryTimeline({events, denom, context, txHref, footer}: HistoryTimelineProps) {
    return (
        <TsCard p={{base: "18px", md: "24px 28px"}} display="flex" flexDirection="column" data-testid="history-timeline">
            <chakra.ol listStyleType="none" m="0" p="0">
                {events.map((event) => {
                    const text = describeTokenEvent(event, context, denom);
                    return (
                        <Flex as="li" key={`${event.height}-${event.tx_index}-${event.seq}`} gap="16px">
                            <Flex direction="column" align="center" w="14px" flex="none" pt="6px" aria-hidden="true">
                                <Box w="12px" h="12px" borderRadius="50%" flex="none" bg={text.primary ? ts.pri : ts.sec}/>
                                <Box flex="1" w="2px" mt="6px" bg={ts.border}/>
                            </Flex>
                            <Flex direction="column" gap="6px" pb="26px" minW="0">
                                <Flex align="center" gap="10px" wrap="wrap">
                                    <chakra.span fontSize="17px" fontWeight={700}>{text.title}</chakra.span>
                                    <chakra.span
                                        display="inline-flex"
                                        fontSize="12px"
                                        fontWeight={600}
                                        px="10px"
                                        py="3px"
                                        borderRadius="999px"
                                        borderWidth="1px"
                                        borderStyle="solid"
                                        borderColor={tsMix(ts.pri, 55)}
                                        whiteSpace="nowrap"
                                    >
                                        {text.tag}
                                    </chakra.span>
                                </Flex>
                                <chakra.span fontSize="15px" lineHeight="1.5" color={ts.muted}>{text.text}</chakra.span>
                                <Flex gap="6px 14px" wrap="wrap" fontSize="13px" color={ts.muted} fontVariantNumeric="tabular-nums">
                                    <span>{eventWhen(event)}</span>
                                    {event.tx_hash && (
                                        <TsLink href={txHref(event.tx_hash)} fontFamily="'JetBrains Mono', monospace" color={ts.muted} textDecoration="none" aria-label={`Transaction ${event.tx_hash}`}>
                                            {shortHash(event.tx_hash)}
                                        </TsLink>
                                    )}
                                </Flex>
                            </Flex>
                        </Flex>
                    );
                })}
            </chakra.ol>
            {footer}
        </TsCard>
    );
}
