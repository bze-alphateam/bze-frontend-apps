'use client';

import React from "react";
import {Box, type BoxProps, chakra, Flex, type FlexProps} from "@chakra-ui/react";

import {ts, tsContainer, tsLabel, tsMix} from "./tokens";

/** Card on the page: a faint text tint over the background, hairline border, 20 px radius. */
export function TsCard(props: BoxProps) {
    return <Box bg={ts.card} borderWidth="1px" borderStyle="solid" borderColor={ts.border} borderRadius="20px" {...props}/>;
}

/** Inverted block (burn total, wallet balance card): text colour as background and vice versa. */
export function TsInvertedCard(props: BoxProps) {
    return <Box bg={ts.fg} color={ts.bg} borderRadius="20px" {...props}/>;
}

interface TsSectionProps extends Omit<BoxProps, "title"> {
    id: string;
    eyebrow: string;
    title: React.ReactNode;
    description?: React.ReactNode;
}

/** A page section: the anchor target of a header link, with its label, heading and lead text. */
export function TsSection({id, eyebrow, title, description, children, ...props}: TsSectionProps) {
    return (
        <Box as="section" id={id} aria-labelledby={`${id}-title`} {...tsContainer} pt={{base: "72px", md: "120px"}} {...props}>
            <Flex direction="column" gap={{base: "20px", md: "32px"}}>
                <Flex direction="column" gap="12px" maxW="640px">
                    <chakra.span {...tsLabel}>{eyebrow}</chakra.span>
                    <chakra.h2
                        id={`${id}-title`}
                        m="0"
                        fontSize={{base: "34px", md: "48px"}}
                        lineHeight="1.02"
                        letterSpacing="-0.03em"
                        fontWeight={800}
                    >
                        {title}
                    </chakra.h2>
                    {description && (
                        <chakra.p m="0" color={ts.muted} fontSize={{base: "16px", md: "17px"}} lineHeight="1.55">{description}</chakra.p>
                    )}
                </Flex>
                {children}
            </Flex>
        </Box>
    );
}

/** A labelled number (key numbers, token details). */
export function TsStat({label, value, ...props}: Omit<FlexProps, "children"> & { label: string; value: React.ReactNode }) {
    return (
        <Flex direction="column" gap="8px" minW="0" {...props}>
            <chakra.span {...tsLabel}>{label}</chakra.span>
            <chakra.span fontVariantNumeric="tabular-nums" fontWeight={700} fontSize={{base: "20px", md: "26px"}} overflowWrap="anywhere">
                {value}
            </chakra.span>
        </Flex>
    );
}

/** Small pill tag in the secondary colour ("Verified", "Holders pool"). */
export function TsTag(props: BoxProps) {
    return (
        <Box
            as="span"
            display="inline-flex"
            alignItems="center"
            gap="6px"
            fontSize="12px"
            fontWeight={600}
            px="10px"
            py="4px"
            borderRadius="999px"
            bg={tsMix(ts.sec, 16)}
            color={tsMix(ts.sec, 70, ts.fg)}
            {...props}
        />
    );
}

/** Informational notice on a secondary tint (e.g. the BZE network-fee notice). */
export function TsNotice(props: BoxProps) {
    return (
        <Box
            role="note"
            borderRadius="14px"
            px="14px"
            py="12px"
            fontSize="14px"
            lineHeight="1.45"
            bg={tsMix(ts.sec, 14)}
            color={ts.fg}
            {...props}
        />
    );
}
