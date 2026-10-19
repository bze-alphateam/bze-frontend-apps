"use client"

import React from 'react'
import { Text } from '@chakra-ui/react'

/** The technical name next to a goal, for users who know the tool (e.g. `tradebin · create market`). */
export function TechTag({ children }: { children: React.ReactNode }) {
    return (
        <Text as="span" fontFamily="mono" fontSize="12px" color="hg.text.faint">
            {children}
        </Text>
    )
}
