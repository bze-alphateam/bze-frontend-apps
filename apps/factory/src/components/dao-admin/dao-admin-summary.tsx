"use client"

import React from 'react'
import { Box, chakra, Text, VStack } from '@chakra-ui/react'
import { getDaoApp, useAssets, validateBZEBech32Address } from '@bze/bze-ui-kit'
import type { Dao } from '@bze/bze-ui-kit'
import { daoControllerLine, daoLabel, daoPageHref, daoTypeLine } from '@/lib/dao-admin'
import { useDaoAdmin, useDaoController } from '@/hooks/useDaoAdmin'

/** The staked token's ticker for a stake DAO's type line. */
function useTickerOf() {
    const { assets } = useAssets()
    return (denom: string) => assets?.find(a => a.denom === denom)?.ticker
}

/** "Open the DAO": the DAO's page in the DAO app. */
export function OpenDaoLink({ dao }: { dao: Pick<Dao, 'id'> }) {
    return (
        <chakra.a href={daoPageHref(getDaoApp().href, dao.id)} target="_blank" rel="noopener noreferrer" color="hg.link" fontWeight="600" fontSize="14px" data-testid="open-dao-link">
            Open the DAO
        </chakra.a>
    )
}

/**
 * What a DAO that is (or is about to become) a token's admin is: name and id, how it votes and, with
 * `showController`, who ultimately controls it. A failed controller lookup just omits that line.
 */
export function DaoAdminSummary({ dao, showController = false }: { dao: Dao; showController?: boolean }) {
    const tickerOf = useTickerOf()
    const controller = useDaoController(showController ? dao : undefined)
    return (
        <VStack align="stretch" gap="2px" data-testid="dao-admin-summary">
            <Text fontSize="14px" fontWeight="600" overflowWrap="anywhere">{daoLabel(dao)}</Text>
            <Text fontSize="13px" color="fg.muted" data-testid="dao-admin-type">{daoTypeLine(dao, tickerOf)}</Text>
            {controller && <Text fontSize="13px" color="fg.muted" data-testid="dao-admin-controller">{daoControllerLine(controller)}</Text>}
        </VStack>
    )
}

/** The Permissions section's DAO details under the status line: how it votes, and the way to its page. */
export function DaoAdminDetails({ dao }: { dao: Dao }) {
    const tickerOf = useTickerOf()
    return (
        <Box mt="4px" data-testid="dao-admin-details">
            <Text fontSize="13px" color="fg.muted" data-testid="dao-admin-type">{daoTypeLine(dao, tickerOf)}</Text>
            <OpenDaoLink dao={dao} />
        </Box>
    )
}

/** Under an address field: the DAO line when the (valid) address is a DAO's account; nothing otherwise. */
export function DaoAddressNote({ address }: { address: string }) {
    const trimmed = address.trim()
    const { dao } = useDaoAdmin(validateBZEBech32Address(trimmed).isValid ? trimmed : undefined)
    return dao ? <DaoAdminSummary dao={dao} showController /> : null
}
