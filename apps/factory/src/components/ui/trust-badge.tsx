"use client"

import React from 'react'
import { chakra } from '@chakra-ui/react'
import { LuCircleHelp, LuLock, LuTriangleAlert } from 'react-icons/lu'
import { StatusPill } from '@bze/bze-ui-kit'

// Same trust semantics as the dex assets page: an admin of a mintable token can mint more; the
// supply is provably fixed once minting is off (renounced admin, or minting disabled while the
// admin stays). A failed lookup (undefined) gets a neutral badge — it must never read as "fixed supply".
export function TrustBadge({ admin, mintable }: { admin: string | undefined; mintable: boolean | undefined }) {
    const [tone, icon, label] = admin === undefined || mintable === undefined
        ? ['neutral', <LuCircleHelp key="i" />, 'Admin unknown'] as const
        : !mintable
            ? ['success', <LuLock key="i" />, 'Fixed supply'] as const
            : ['warning', <LuTriangleAlert key="i" />, 'Mintable'] as const

    return (
        <StatusPill tone={tone}>
            <chakra.span display="inline-flex" aria-hidden css={{ '& svg': { width: '12px', height: '12px' } }}>{icon}</chakra.span>
            {label}
        </StatusPill>
    )
}
