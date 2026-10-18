'use client'

import { Box, Icon, IconButton, Popover, Portal } from '@chakra-ui/react'
import {PropsWithChildren, useState} from 'react'
import { LuAlignRight, LuX } from 'react-icons/lu'
import {NavbarLinks} from "@/components/ui/navigation/navbar-links";
import {useOpenProposalsSummary} from "@/hooks/useOpenProposalsSummary";
import {badgeCount} from "@/lib/governance/summary";

export const MobileNavbarLinks = (props: PropsWithChildren) => {
    const [open, setOpen] = useState(false)
    // A dot on the closed menu button while proposals wait (the badge is inside the menu).
    const {summary} = useOpenProposalsSummary()
    const hasBadge = badgeCount(summary) > 0

    const closeNavbar = () => {
        setOpen(false)
    }

    return (
        <Popover.Root
            open={open}
            onOpenChange={(e) => setOpen(e.open)}
            positioning={{
                placement: 'bottom',
                overflowPadding: 0,
                offset: { mainAxis: 12 },
            }}
        >
            <Popover.Context>
                {(context) => (
                    <Popover.Trigger asChild>
                        <IconButton
                            aria-label="Open Menu"
                            variant="ghost"
                            size="sm"
                            colorPalette="gray"
                            hideFrom="md"
                            position="relative"
                        >
                            <Icon size="md">{context.open ? <LuX /> : <LuAlignRight />}</Icon>
                            {hasBadge && !context.open && (
                                <Box
                                    data-testid="menu-badge-dot"
                                    aria-hidden
                                    position="absolute"
                                    top="1"
                                    right="1"
                                    w="9px"
                                    h="9px"
                                    borderRadius="full"
                                    bg="purple.solid"
                                    boxShadow="0 0 0 2px var(--chakra-colors-bg-panel)"
                                />
                            )}
                        </IconButton>
                    </Popover.Trigger>
                )}
            </Popover.Context>
            <Portal>
                <Popover.Positioner>
                    <Popover.Content
                        textStyle="md"
                        boxShadow="none"
                        borderRadius="none"
                        maxW="unset"
                        px="4"
                        py="6"
                        width="var(--available-width)"
                        height="var(--available-height)"
                        {...props}
                    >
                        <NavbarLinks onLinkClick={closeNavbar} />
                    </Popover.Content>
                </Popover.Positioner>
            </Portal>
        </Popover.Root>
    )
}
