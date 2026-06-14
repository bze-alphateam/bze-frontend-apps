'use client'

import { Icon, IconButton, Popover, Portal } from '@chakra-ui/react'
import {PropsWithChildren, useState} from 'react'
import { LuAlignRight, LuX } from 'react-icons/lu'
import {NavbarLinks} from "@/components/ui/navigation/navbar-links";

export const MobileNavbarLinks = (props: PropsWithChildren) => {
    const [open, setOpen] = useState(false)

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
                        >
                            <Icon size="md">{context.open ? <LuX /> : <LuAlignRight />}</Icon>
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
