"use client"

import React from 'react'
import { Text } from '@chakra-ui/react'

/** A centred line under the action: muted, or red for "can't pay" and similar. */
export function SubmitNote({ tone = 'muted', children }: { tone?: 'muted' | 'error'; children: React.ReactNode }) {
    return (
        <Text fontSize="14px" lineHeight="1.5" textAlign="center" color={tone === 'error' ? 'hg.danger.text' : 'fg.muted'}>
            {children}
        </Text>
    )
}
