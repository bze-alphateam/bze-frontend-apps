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

/** Segmented control (Buy/Sell, wallet tabs) as a tablist. */
export function TsSegmented<T extends string>({label, options, value, onChange}: TsSegmentedProps<T>) {
    return (
        <Flex role="tablist" aria-label={label} gap="4px" p="4px" borderRadius="999px" bg={tsMix(ts.fg, 8)}>
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
                        fontWeight={600}
                        minH="40px"
                        border="0"
                        borderRadius="999px"
                        cursor="pointer"
                        color={ts.fg}
                        bg={selected ? ts.bg : "transparent"}
                        boxShadow={selected ? `0 1px 3px color-mix(in oklab, ${ts.fg} 20%, transparent)` : undefined}
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

/** Amount field: label, borderless input and a suffix (the token ticker). */
export function TsField({label, suffix, id, ...props}: TsFieldProps) {
    const generated = useId();
    const inputId = id ?? generated;

    return (
        <Flex direction="column" gap="8px" borderRadius="14px" px="16px" py="14px" bg={ts.bg} borderWidth="1px" borderStyle="solid" borderColor={ts.border}>
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

/** Table that scrolls sideways on narrow screens instead of squeezing its columns. */
export function TsTable({children, ...props}: BoxProps) {
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
                        padding: "12px 16px",
                    },
                    "& td": {
                        padding: "16px",
                        borderTop: `1px solid ${ts.border}`,
                        fontVariantNumeric: "tabular-nums",
                    },
                }}
            >
                {children}
            </chakra.table>
        </Box>
    );
}
