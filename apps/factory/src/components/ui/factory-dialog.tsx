"use client"

import React from 'react'
import { chakra, CloseButton, Dialog, Flex, Portal } from '@chakra-ui/react'

interface FactoryDialogProps {
    open: boolean;
    onClose: () => void;
    title: React.ReactNode;
    /** A muted line under the title. */
    description?: React.ReactNode;
    /** Small capitals above the title ("Last step of your launch · optional"). */
    kicker?: React.ReactNode;
    children: React.ReactNode;
    /** The row under the body: a note on the left, the buttons on the right. */
    footer?: React.ReactNode;
    /** Content width from md up; phones use the screen minus 16 px gutters. */
    width?: string;
    /** 19 px title for small dialogs, 22 px for the large ones. */
    titleSize?: 'md' | 'lg';
    closeLabel?: string;
    /** Phones get a full-screen sheet instead of a floating card. */
    sheetOnPhones?: boolean;
    /** What gets focus when it opens (a safe default, e.g. "Keep admin"); the first focusable otherwise. */
    initialFocusEl?: () => HTMLElement | null;
    finalFocusEl?: () => HTMLElement | null;
}

/**
 * The Factory dialog frame: card fill, hairline, 20 px radius, the popover shadow and a close
 * button in the top corner. The body scrolls inside when it is taller than the screen.
 */
export function FactoryDialog({
    open,
    onClose,
    title,
    description,
    kicker,
    children,
    footer,
    width = '440px',
    titleSize = 'md',
    closeLabel = 'Close',
    sheetOnPhones = false,
    initialFocusEl,
    finalFocusEl,
}: FactoryDialogProps) {
    // Nothing renders while closed, and the body starts fresh on every open.
    return (
        <Dialog.Root
            open={open}
            onOpenChange={(e) => { if (!e.open) onClose() }}
            placement="center"
            scrollBehavior="inside"
            initialFocusEl={initialFocusEl}
            finalFocusEl={finalFocusEl}
            lazyMount
            unmountOnExit
        >
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content
                        maxW={{ base: sheetOnPhones ? '100vw' : 'calc(100vw - 32px)', md: width }}
                        {...(sheetOnPhones ? { w: { base: '100vw', md: '100%' }, minH: { base: '100dvh', md: 'auto' }, my: { base: '0', md: 'auto' } } : {})}
                        bg="hg.card"
                        borderWidth="1px"
                        borderColor="hg.hairline"
                        borderRadius={sheetOnPhones ? { base: '0', md: '20px' } : '20px'}
                        boxShadow="hg.popover"
                    >
                        <Dialog.Header flexDirection="column" alignItems="start" gap="6px" pt="24px" px="24px" pb="0" pe="64px">
                            {kicker && (
                                <chakra.span fontSize="11px" letterSpacing="0.12em" textTransform="uppercase" fontWeight="700" color="hg.text.faint">
                                    {kicker}
                                </chakra.span>
                            )}
                            <Dialog.Title
                                fontSize={titleSize === 'lg' ? '22px' : '19px'}
                                fontWeight={titleSize === 'lg' ? '800' : '700'}
                                letterSpacing={titleSize === 'lg' ? '-0.01em' : undefined}
                            >
                                {title}
                            </Dialog.Title>
                            {description && (
                                <Dialog.Description fontSize="14px" lineHeight="1.55" color="hg.text.muted">{description}</Dialog.Description>
                            )}
                        </Dialog.Header>
                        <Dialog.Body px="24px" pt="18px" pb={footer ? '18px' : '24px'}>
                            {children}
                        </Dialog.Body>
                        {footer && (
                            <Dialog.Footer px="24px" pt="16px" pb="24px" borderTopWidth="1px" borderColor="hg.divider">
                                <Flex w="100%" gap="12px" align="center" justify="flex-end" wrap="wrap">{footer}</Flex>
                            </Dialog.Footer>
                        )}
                        <Dialog.CloseTrigger asChild top="20px" insetEnd="18px">
                            <CloseButton size="sm" aria-label={closeLabel} color="hg.text.muted" />
                        </Dialog.CloseTrigger>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    )
}
