'use client';

import React from "react";
import {Box, type BoxProps, chakra, Flex, type FlexProps} from "@chakra-ui/react";
import {LuTriangleAlert} from "react-icons/lu";

import {ts, tsContainer, tsEyebrow, tsLabel, tsMix} from "./tokens";

/** Card on the page: a faint text tint over the background, hairline border, 16 px radius. */
export function TsCard(props: BoxProps) {
    return <Box bg={ts.card} borderWidth="1px" borderStyle="solid" borderColor={ts.border} borderRadius="16px" {...props}/>;
}

/**
 * The one featured card of the page (the holders pool, else the first Earn card; the balance card
 * in the wallet): a 1 px edge in the kit's gradient and a soft glow of the primary below it.
 */
export function TsFeaturedCard(props: BoxProps) {
    return (
        <Box
            data-featured=""
            bg={`linear-gradient(${ts.card}, ${ts.card}) padding-box, ${ts.gradient} border-box`}
            borderWidth="1px"
            borderStyle="solid"
            borderColor="transparent"
            borderRadius="16px"
            boxShadow={`0 30px 80px -50px ${ts.pri}`}
            {...props}
        />
    );
}

/** A recessed block inside a card: stat tiles, the "Your position" column, code. */
export function TsInset(props: BoxProps) {
    return <Box bg={ts.inset} borderRadius="12px" {...props}/>;
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
        <Box as="section" id={id} aria-labelledby={`${id}-title`} {...tsContainer} pt={{base: "72px", md: "112px"}} {...props}>
            <Flex direction="column" gap={{base: "20px", md: "28px"}}>
                <Flex direction="column" gap="12px" maxW="640px">
                    <chakra.span {...tsEyebrow}>{eyebrow}</chakra.span>
                    <chakra.h2
                        id={`${id}-title`}
                        m="0"
                        fontSize={{base: "34px", md: "44px"}}
                        lineHeight="1.05"
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

/**
 * Notice on a tint: `info` (default) on the secondary colour, e.g. the BZE network-fee notice;
 * `danger` on the kit's danger red with a warning icon, for what loses the user something.
 */
export function TsNotice({tone = "info", children, ...props}: FlexProps & { tone?: "info" | "danger" }) {
    const danger = tone === "danger";

    return (
        <Flex
            role="note"
            data-tone={tone}
            gap="10px"
            align="flex-start"
            borderRadius="14px"
            px="14px"
            py="12px"
            fontSize="14px"
            lineHeight="1.45"
            bg={danger ? tsMix(ts.danger, 12) : tsMix(ts.sec, 14)}
            borderWidth={danger ? "1px" : undefined}
            borderStyle={danger ? "solid" : undefined}
            borderColor={danger ? tsMix(ts.danger, 45) : undefined}
            color={ts.fg}
            {...props}
        >
            {danger && <Box as="span" color={ts.danger} flexShrink={0} pt="2px" aria-hidden><LuTriangleAlert size={16}/></Box>}
            <Box flex="1" minW="0">{children}</Box>
        </Flex>
    );
}
