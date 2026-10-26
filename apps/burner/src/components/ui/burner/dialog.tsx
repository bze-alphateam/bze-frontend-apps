'use client';

import {chakra, CloseButton, Dialog, Flex, Portal} from '@chakra-ui/react';
import type {ReactNode} from 'react';

interface BurnerDialogProps {
    isOpen: boolean;
    onClose: () => void;
    title: ReactNode;
    children: ReactNode;
    /** The button row under the body (Cancel and the main action). */
    footer?: ReactNode;
    /** While a transaction is in flight the dialog cannot be closed. */
    busy?: boolean;
    /** Content width on desktop; phones use almost the whole screen. */
    width?: string;
}

/**
 * The Burner dialog frame: card fill, hairline, 20 px radius, a 19 px title and the close
 * button. The dialogs stay mounted and follow `isOpen`.
 */
export const BurnerDialog = ({isOpen, onClose, title, children, footer, busy, width = '480px'}: BurnerDialogProps) => (
    <Dialog.Root
        open={isOpen}
        onOpenChange={(e) => !busy && !e.open && onClose()}
        placement="center"
        scrollBehavior="inside"
    >
        <Portal>
            <Dialog.Backdrop/>
            <Dialog.Positioner>
                <Dialog.Content
                    maxW={{base: '92vw', md: width}}
                    bg="hg.card"
                    borderWidth="1px"
                    borderColor="hg.hairline"
                    borderRadius="20px"
                    boxShadow="hg.popover"
                >
                    <Dialog.Header pt="24px" px="24px" pb="0" pr="64px">
                        <Dialog.Title fontSize="19px" fontWeight="700">{title}</Dialog.Title>
                    </Dialog.Header>
                    <Dialog.Body px="24px" pt="16px" pb={footer ? '16px' : '24px'}>
                        <Flex direction="column" gap="16px">{children}</Flex>
                    </Dialog.Body>
                    {footer && (
                        <Dialog.Footer px="24px" pt="0" pb="24px">
                            <Flex gap="10px" w="100%">{footer}</Flex>
                        </Dialog.Footer>
                    )}
                    <Dialog.CloseTrigger asChild disabled={busy} top="20px" insetEnd="18px">
                        <CloseButton size="sm" aria-label="Close"/>
                    </Dialog.CloseTrigger>
                </Dialog.Content>
            </Dialog.Positioner>
        </Portal>
    </Dialog.Root>
);

/** A label and value on the inset surface (Available Balance, Your contribution). */
export const InsetRow = ({label, children}: { label: ReactNode; children: ReactNode }) => (
    <Flex justify="space-between" align="center" gap="12px" px="14px" py="12px" borderRadius="hg.md" bg="hg.inset" fontSize="14px">
        <chakra.span color="hg.text.secondary">{label}</chakra.span>
        <chakra.strong color="hg.link" textAlign="end" minW="0" overflowWrap="anywhere">{children}</chakra.strong>
    </Flex>
);

/** The coin a dialog acts on: logo, name and ticker on the inset. */
export const CoinRow = ({logo, name, ticker}: { logo?: ReactNode; name: ReactNode; ticker: ReactNode }) => (
    <Flex align="center" gap="12px" px="14px" py="12px" borderRadius="hg.md" bg="hg.inset" minW="0">
        {logo}
        <Flex direction="column" gap="2px" minW="0">
            <chakra.strong fontSize="16px" truncate>{name}</chakra.strong>
            <chakra.span fontSize="13px" color="hg.text.faint" fontFamily="mono">{ticker}</chakra.span>
        </Flex>
    </Flex>
);
