'use client'

import { Box, chakra, Flex, IconButton, Portal } from '@chakra-ui/react'
import type { PropsWithChildren } from 'react'
import { LuX } from 'react-icons/lu'
import { useState } from 'react'

interface SidebarProps extends PropsWithChildren {
    trigger: React.ReactNode
    ariaLabel: string
    // Optional controlled mode: pass isOpen to open the sidebar from outside (e.g. a deep link).
    // onOpenChange fires on every open/close in both modes.
    isOpen?: boolean
    onOpenChange?: (open: boolean) => void
}

export const Sidebar = ({ children, trigger, ariaLabel, isOpen: controlledOpen, onOpenChange }: SidebarProps) => {
    const [internalOpen, setInternalOpen] = useState(false)
    const isOpen = controlledOpen ?? internalOpen

    const setOpen = (open: boolean) => {
        if (controlledOpen === undefined) {
            setInternalOpen(open)
        }
        onOpenChange?.(open)
    }

    const handleTriggerClick = () => {
        setOpen(true)
    }

    const handleClose = () => {
        setOpen(false)
    }

    return (
        <>
            {/* Trigger Button */}
            <div onClick={handleTriggerClick} style={{ cursor: 'pointer' }}>
                {trigger}
            </div>

            {/* Sidebar Overlay (CompOverlays): the backdrop, then the drawer docked right; full width on phones.
                Both sit above the sticky header and below popovers, so selects and dialogs opened inside still show. */}
            {isOpen && (
                <Portal>
                    <Box
                        position="fixed"
                        inset="0"
                        bg="hg.backdrop"
                        zIndex="overlay"
                        data-testid="sidebar-backdrop"
                        onClick={(e) => {
                            // Only close if clicking the backdrop itself, not child elements
                            if (e.target === e.currentTarget) {
                                handleClose()
                            }
                        }}
                    />

                    <Flex
                        as="aside"
                        id="sidebar-content"
                        aria-label={ariaLabel}
                        position="fixed"
                        top="0"
                        right="0"
                        bottom="0"
                        w={{ base: '100vw', md: '400px' }}
                        bg="hg.card"
                        borderLeftWidth={{ base: '0', md: '1px' }}
                        borderColor="hg.hairline"
                        boxShadow={{ base: 'none', md: 'hg.drawer' }}
                        zIndex="modal"
                        direction="column"
                        overflow="hidden"
                        color="fg"
                    >
                        <Flex
                            justify="space-between"
                            align="center"
                            flex="none"
                            minH={{ base: '64px', md: 'auto' }}
                            py="14px"
                            pl={{ base: '16px', md: '20px' }}
                            pr={{ base: '12px', md: '16px' }}
                            borderBottomWidth="1px"
                            borderColor="hg.divider"
                        >
                            <chakra.h3 m="0" fontSize="18px" fontWeight="700" color="fg">
                                {ariaLabel}
                            </chakra.h3>
                            <IconButton
                                aria-label="Close sidebar"
                                variant="ghost"
                                size={{ base: 'md', md: 'sm' }}
                                color="hg.text.muted"
                                onClick={handleClose}
                            >
                                <LuX />
                            </IconButton>
                        </Flex>

                        <Box flex="1" minH="0" overflowY="auto" p={{ base: '16px', md: '20px' }} position="relative">
                            {children}
                        </Box>
                    </Flex>
                </Portal>
            )}
        </>
    )
}
