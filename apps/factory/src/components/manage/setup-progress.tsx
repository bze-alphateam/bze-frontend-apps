"use client"

import React from 'react'
import { HStack, Skeleton, Text } from '@chakra-ui/react'
import { useTokenSetup } from '@/hooks/useTokenSetup'
import { setupHint } from '@/lib/token-setup'

interface SetupProgressProps {
    denom: string;
    /** From useMyTokens: an address, '' when renounced, undefined when unknown. */
    admin?: string;
    /** "3/6 set up" or the hint alone, for the home strip; "3 of 6 set up · no pool yet" otherwise. */
    compact?: boolean;
}

/**
 * How far a token's setup is, read from the chain by useTokenSetup. Mount it only for the tokens
 * on screen: every instance runs that token's queries.
 */
export function SetupProgress({ denom, admin, compact = false }: SetupProgressProps) {
    const setup = useTokenSetup(denom, { admin })

    if (setup.isLoading) return <Skeleton height="4" width="28" data-testid="setup-progress-loading" />

    const hint = setupHint(setup)
    const count = compact ? `${setup.doneCount}/${setup.totalCount} set up` : `${setup.doneCount} of ${setup.totalCount} set up`

    if (compact) {
        return (
            <Text fontSize="xs" color="fg.muted" data-testid="setup-progress">
                {hint ?? count}
            </Text>
        )
    }

    return (
        <HStack gap={1.5} fontSize="sm" flexWrap="wrap" data-testid="setup-progress">
            <Text fontWeight="medium">{count}</Text>
            {hint && <Text color="orange.fg">{`· ${hint}`}</Text>}
        </HStack>
    )
}
