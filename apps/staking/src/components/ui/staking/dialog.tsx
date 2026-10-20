'use client';

import {Box, Button, chakra, CloseButton, Dialog, Flex, Grid, Input, Portal} from '@chakra-ui/react';
import type {ReactNode, RefObject} from 'react';

interface StakingDialogProps {
    isOpen: boolean;
    onClose: () => void;
    title: ReactNode;
    /** Next to the title (the copy-stake-link icon). */
    titleAside?: ReactNode;
    children: ReactNode;
    /** While a transaction is in flight the dialog cannot be closed. */
    busy?: boolean;
    contentRef?: RefObject<HTMLDivElement | null>;
    initialFocusEl?: () => HTMLElement | null;
    /** Content width on desktop; phones use almost the whole screen. */
    width?: string;
}

/**
 * The Staking dialog frame: card fill, hairline, 20 px radius, a 19 px title and the close
 * button. The dialogs stay mounted and follow `isOpen`.
 */
export const StakingDialog = ({isOpen, onClose, title, titleAside, children, busy, contentRef, initialFocusEl, width = '448px'}: StakingDialogProps) => (
    <Dialog.Root
        open={isOpen}
        onOpenChange={(e) => !busy && !e.open && onClose()}
        initialFocusEl={initialFocusEl}
        placement="center"
        scrollBehavior="inside"
    >
        <Portal>
            <Dialog.Backdrop />
            <Dialog.Positioner>
                <Dialog.Content
                    ref={contentRef}
                    maxW={{base: '92vw', md: width}}
                    bg="hg.card"
                    borderWidth="1px"
                    borderColor="hg.hairline"
                    borderRadius="20px"
                    boxShadow="hg.popover"
                >
                    <Dialog.Header pt="24px" px="24px" pb="0">
                        <Flex align="center" gap="4px" minW="0" pr="40px">
                            <Dialog.Title fontSize="19px" fontWeight="700">{title}</Dialog.Title>
                            {titleAside}
                        </Flex>
                    </Dialog.Header>
                    <Dialog.Body px="24px" pt="16px" pb="24px">
                        <Flex direction="column" gap="16px">{children}</Flex>
                    </Dialog.Body>
                    <Dialog.CloseTrigger asChild disabled={busy} top="20px" insetEnd="18px">
                        <CloseButton size="sm" aria-label="Close" />
                    </Dialog.CloseTrigger>
                </Dialog.Content>
            </Dialog.Positioner>
        </Portal>
    </Dialog.Root>
);

/** A label and value on the inset surface (Commission, Staked). */
export const InsetRow = ({label, children}: {label: ReactNode; children: ReactNode}) => (
    <Flex justify="space-between" align="center" gap="12px" px="14px" py="12px" borderRadius="hg.md" bg="hg.inset" fontSize="14px">
        <chakra.span color="hg.text.secondary">{label}</chakra.span>
        <chakra.strong>{children}</chakra.strong>
    </Flex>
);

interface AmountFieldProps {
    value: string;
    onChange: (value: string) => void;
    /** Right of the "Amount" label: "Available: …", "Staked: …". */
    aside?: ReactNode;
    ticker?: string;
    disabled?: boolean;
    /** Over the fee reserve or the balance: the edge turns amber. */
    warning?: boolean;
    inputRef?: RefObject<HTMLInputElement | null>;
    /** The quick amounts under the field. */
    children?: ReactNode;
}

/** The amount label, the 52 px field with the ticker inside, and the quick amounts. */
export const AmountField = ({value, onChange, aside, ticker, disabled, warning, inputRef, children}: AmountFieldProps) => (
    <Flex direction="column" gap="8px" opacity={disabled ? 0.55 : 1}>
        <Flex justify="space-between" align="baseline" gap="12px">
            <chakra.span fontSize="14px" fontWeight="600">Amount</chakra.span>
            {aside && <chakra.span fontSize="12px" color="hg.text.faint">{aside}</chakra.span>}
        </Flex>
        <Box position="relative">
            <Input
                ref={inputRef}
                aria-label="Amount"
                placeholder="0.00"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                type="text"
                inputMode="decimal"
                disabled={disabled}
                h="52px"
                pe="64px"
                borderRadius="hg.md"
                fontSize="18px"
                fontWeight="600"
                {...(warning ? {borderColor: 'hg.warning/55', _focusVisible: {borderColor: 'hg.warning/55', outlineColor: 'hg.warning/30'}} : {})}
            />
            {ticker && (
                <chakra.span position="absolute" insetEnd="14px" top="50%" transform="translateY(-50%)" fontSize="14px" color="hg.text.faint" pointerEvents="none">
                    {ticker}
                </chakra.span>
            )}
        </Box>
        {children}
    </Flex>
);

/** 25 % · 50 % · 75 % · Max, as fractions of what can be moved. */
export const QuickAmounts = ({onPick, disabled}: {onPick: (fraction: number) => void; disabled?: boolean}) => (
    <Grid templateColumns="repeat(4, minmax(0, 1fr))" gap="8px">
        {[0.25, 0.5, 0.75, 1].map(fraction => (
            <Button
                key={fraction}
                size="sm"
                variant="outline"
                borderRadius="10px"
                color="hg.text.secondary"
                borderColor="hg.lineStrong"
                bg="transparent"
                fontWeight="600"
                _hover={{bg: 'hg.hoverFill', color: 'fg'}}
                onClick={() => onPick(fraction)}
                disabled={disabled}
            >
                {fraction === 1 ? 'Max' : `${fraction * 100}%`}
            </Button>
        ))}
    </Grid>
);

/** The transaction's progress line, while it is in flight. */
export const ProgressLine = ({children}: {children?: ReactNode}) => (children
    ? <chakra.span fontSize="12px" color="hg.text.faint" textAlign="center">{children}</chakra.span>
    : null);
