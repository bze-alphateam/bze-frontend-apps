'use client';

import React, {useId} from "react";
import {Box, type BoxProps, chakra, Flex, type HTMLChakraProps} from "@chakra-ui/react";

import {ts, tsMix} from "./tokens";

/** Selectable pill (chart ranges, pool chips); `selected` fills it with the text colour. */
export function TsChip({selected, ...props}: HTMLChakraProps<"button"> & { selected?: boolean }) {
    return (
        <chakra.button
            type="button"
            aria-pressed={selected === undefined ? undefined : selected}
            font="inherit"
            fontSize="13px"
            fontWeight={600}
            minH="36px"
            px="14px"
            borderRadius="999px"
            borderWidth="1px"
            borderStyle="solid"
            cursor="pointer"
            bg={selected ? ts.fg : "transparent"}
            color={selected ? ts.bg : ts.fg}
            borderColor={selected ? ts.fg : tsMix(ts.fg, 18)}
            _focusVisible={{outline: `2px solid ${ts.fg}`, outlineOffset: "2px"}}
            {...props}
        />
    );
}

interface TsSegmentedProps<T extends string> {
    label: string;
    options: { value: T; label: string }[];
    value: T;
    onChange: (value: T) => void;
}

/** Segmented control (Buy/Sell, wallet tabs) as a tablist: an inset track, the active tab raised. */
export function TsSegmented<T extends string>({label, options, value, onChange}: TsSegmentedProps<T>) {
    return (
        <Flex role="tablist" aria-label={label} gap="4px" p="4px" borderRadius="14px" bg={ts.inset}>
            {options.map((option) => {
                const selected = option.value === value;
                return (
                    <chakra.button
                        key={option.value}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => onChange(option.value)}
                        flex="1"
                        font="inherit"
                        fontSize="14px"
                        fontWeight={selected ? 700 : 600}
                        minH="40px"
                        border="0"
                        borderRadius="10px"
                        cursor="pointer"
                        color={selected ? ts.fg : ts.muted}
                        bg={selected ? ts.card : "transparent"}
                        boxShadow={selected ? `0 0 0 1px ${ts.border}` : undefined}
                    >
                        {option.label}
                    </chakra.button>
                );
            })}
        </Flex>
    );
}

interface TsFieldProps extends Omit<HTMLChakraProps<"input">, "size"> {
    label: string;
    suffix?: React.ReactNode;
}

/** Amount field: label, borderless input and a suffix (the token ticker); a primary ring while focused. */
export function TsField({label, suffix, id, ...props}: TsFieldProps) {
    const generated = useId();
    const inputId = id ?? generated;

    return (
        <Flex
            direction="column"
            gap="6px"
            borderRadius="14px"
            px="16px"
            py="12px"
            bg={ts.bg}
            borderWidth="1px"
            borderStyle="solid"
            borderColor={ts.border}
            _focusWithin={{borderColor: tsMix(ts.pri, 55), boxShadow: `0 0 0 3px ${tsMix(ts.pri, 18, "transparent")}`}}
        >
            <chakra.label htmlFor={inputId} color={ts.muted} fontSize="13px">{label}</chakra.label>
            <Flex align="center" gap="10px">
                <chakra.input
                    id={inputId}
                    font="inherit"
                    fontSize="22px"
                    fontWeight={600}
                    w="100%"
                    minW="0"
                    border="0"
                    bg="transparent"
                    color={ts.fg}
                    outline="none"
                    {...props}
                />
                {suffix && <chakra.span fontWeight={700}>{suffix}</chakra.span>}
            </Flex>
        </Flex>
    );
}

// Below the md breakpoint a stacked table drops its header and shows each row as a card: one
// cell per line, labelled from the cell's `data-label`.
const STACKED_ON_PHONE = {
    "@media screen and (max-width: 47.99rem)": {
        "& thead": {display: "none"},
        "& tr, & td": {display: "block"},
        "& tbody > tr": {borderTop: `1px solid ${ts.border}`, padding: "10px 0"},
        "& td": {borderTop: "0", padding: "6px 16px"},
        "& td[data-label]": {display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px"},
        "& td[data-label]::before": {content: "attr(data-label)", color: ts.muted, fontSize: "13px"},
    },
} as const;

/**
 * Table that scrolls sideways on narrow screens instead of squeezing its columns, or with
 * `stackOnPhone` turns each row into a card there.
 */
export function TsTable({children, stackOnPhone, ...props}: BoxProps & { stackOnPhone?: boolean }) {
    return (
        <Box overflowX="auto" {...props}>
            <chakra.table
                w="100%"
                borderCollapse="collapse"
                css={{
                    "& th": {
                        textAlign: "left",
                        fontSize: "12px",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        fontWeight: 600,
                        color: ts.muted,
                        padding: "12px 20px",
                    },
                    "& td": {
                        padding: "16px 20px",
                        borderTop: `1px solid ${ts.border}`,
                        fontVariantNumeric: "tabular-nums",
                    },
                    ...(stackOnPhone ? STACKED_ON_PHONE : {}),
                }}
            >
                {children}
            </chakra.table>
        </Box>
    );
}
