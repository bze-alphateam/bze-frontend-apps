"use client"

import React from 'react'
import { Button, chakra, Flex, Text } from '@chakra-ui/react'
import { hgVariant } from '@bze/bze-ui-kit'

/** A quick answer under a field ("1 million", "0.3%", "30 days"): the app tint when picked. */
export function AnswerChip({ selected, onClick, disabled, children }: {
    selected: boolean;
    onClick: () => void;
    disabled?: boolean;
    children: React.ReactNode;
}) {
    return (
        <Button
            variant="outline"
            size="xs"
            h="30px"
            px="12px"
            borderRadius="hg.pill"
            fontSize="12px"
            fontWeight="600"
            aria-pressed={selected}
            disabled={disabled}
            onClick={onClick}
            {...(selected
                ? { borderColor: 'app.border', bg: 'app.subtle', color: 'hg.link', _hover: { bg: 'app.muted' } }
                : { borderColor: 'hg.lineStrong', bg: 'transparent', color: 'hg.text.secondary', _hover: { borderColor: 'app.border' } })}
        >
            {children}
        </Button>
    )
}

/** A row of answer chips. */
export function AnswerChips({ children }: { children: React.ReactNode }) {
    return <Flex gap="6px" wrap="wrap" align="center">{children}</Flex>
}

/** The way out of an active question: Continue. */
export function ContinueRow({ onContinue, disabled, label = 'Continue' }: {
    onContinue: () => void;
    disabled?: boolean;
    label?: string;
}) {
    return (
        <Flex gap="8px" align="center" wrap="wrap">
            <Button variant={hgVariant('primary')} size="sm" px="16px" disabled={disabled} onClick={onContinue}>
                {label}
            </Button>
        </Flex>
    )
}

/** A quiet line under a field or inside a question. */
export function Hint({ mono, children }: { mono?: boolean; children: React.ReactNode }) {
    return (
        <Text
            fontSize={mono ? '12px' : '13px'}
            lineHeight="1.5"
            color="hg.text.faint"
            fontFamily={mono ? 'mono' : undefined}
            wordBreak={mono ? 'break-all' : undefined}
        >
            {children}
        </Text>
    )
}

/** "(optional)" after a field label. */
export function Optional() {
    return <chakra.span color="hg.text.faint" fontWeight="400">(optional)</chakra.span>
}

/** A two-way switch inside a question ("Same amount for everyone" / "Amount per wallet"). */
export function Segmented<T extends string>({ options, value, onChange, label }: {
    options: { value: T; label: string }[];
    value: T;
    onChange: (value: T) => void;
    label: string;
}) {
    return (
        <Flex
            role="group"
            aria-label={label}
            display="inline-flex"
            alignSelf="flex-start"
            p="3px"
            borderRadius="hg.md"
            bg="hg.inset"
            borderWidth="1px"
            borderColor="hg.hairline"
            maxW="full"
            wrap="wrap"
        >
            {options.map(o => {
                const on = o.value === value
                return (
                    <chakra.button
                        key={o.value}
                        type="button"
                        h="32px"
                        px="14px"
                        borderRadius="9px"
                        fontSize="13px"
                        fontWeight="600"
                        cursor="pointer"
                        aria-pressed={on}
                        onClick={() => onChange(o.value)}
                        focusVisibleRing="inside"
                        {...(on
                            ? { bg: 'app.subtle', color: 'hg.link', boxShadow: 'inset 0 0 0 1px {colors.app.border}' }
                            : { bg: 'transparent', color: 'fg.muted', _hover: { color: 'fg' } })}
                    >
                        {o.label}
                    </chakra.button>
                )
            })}
        </Flex>
    )
}
