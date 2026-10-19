"use client"

import React from 'react'
import { Box, Tabs } from '@chakra-ui/react'

/** The tab row along the bottom edge of a page's hero band (workspace, rewards). */
export function BandTabList({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <Tabs.List
            aria-label={label}
            gap="4px"
            mt="6px"
            overflowX="auto"
            flexWrap="nowrap"
            maxW="full"
            css={{ scrollbarWidth: 'none' }}
        >
            {children}
        </Tabs.List>
    )
}

/** One tab: muted until selected, then bold with the app-gradient rule under it. */
export function BandTab({ value, children }: { value: string; children: React.ReactNode }) {
    return (
        <Tabs.Trigger
            value={value}
            flexShrink={0}
            position="relative"
            h="auto"
            px="16px"
            pt="12px"
            pb="14px"
            gap="8px"
            fontSize="15px"
            fontWeight="500"
            color="fg.muted"
            bg="transparent"
            _hover={{ color: 'fg' }}
            _selected={{ color: 'fg', fontWeight: '700' }}
            css={{ '&[data-selected] .band-tab-rule': { display: 'block' } }}
        >
            {children}
            <Box
                className="band-tab-rule"
                aria-hidden
                display="none"
                position="absolute"
                insetX="12px"
                bottom="0"
                h="2px"
                borderRadius="2px"
                bgImage="app"
            />
        </Tabs.Trigger>
    )
}
