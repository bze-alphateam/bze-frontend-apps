"use client"

import React from 'react'
import { chakra } from '@chakra-ui/react'
import { LuCircleHelp, LuLock, LuTriangleAlert } from 'react-icons/lu'
import { StatusPill } from '@bze/bze-ui-kit'

// Same trust semantics as the dex assets page: an active admin can mint more,
// only a renounced admin makes the supply provably fixed. A failed lookup
// (undefined) gets a neutral badge — it must never read as "fixed supply".
export function TrustBadge({ admin }: { admin: string | undefined }) {
    const [tone, icon, label] = admin === undefined
        ? ['neutral', <LuCircleHelp key="i" />, 'Admin unknown'] as const
        : admin === ''
            ? ['success', <LuLock key="i" />, 'Fixed supply'] as const
            : ['warning', <LuTriangleAlert key="i" />, 'Mintable'] as const

    return (
        <StatusPill tone={tone}>
            <chakra.span display="inline-flex" aria-hidden css={{ '& svg': { width: '12px', height: '12px' } }}>{icon}</chakra.span>
            {label}
        </StatusPill>
    )
}
