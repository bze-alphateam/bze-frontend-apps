"use client"

import React from 'react'
import { Button } from '@chakra-ui/react'
import { hgVariant } from '@bze/bze-ui-kit'

/** A filter chip: the app gradient when on, a quiet pill otherwise. */
export function FilterChip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <Button
            size="xs"
            h="32px"
            px="12px"
            borderRadius="hg.pill"
            fontSize="13px"
            aria-pressed={pressed}
            onClick={onClick}
            {...(pressed
                ? { variant: hgVariant('primary'), fontWeight: '700', boxShadow: 'none' }
                : { variant: 'outline' as const, fontWeight: '500', color: 'hg.text.secondary', borderColor: 'hg.lineStrong', bg: 'hg.secondaryFill', _hover: { borderColor: 'app.border' } })}
        >
            {children}
        </Button>
    )
}
