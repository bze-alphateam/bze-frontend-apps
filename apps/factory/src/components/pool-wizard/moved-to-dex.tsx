"use client"

import React, { useEffect } from 'react'
import { Text, VStack } from '@chakra-ui/react'
import { AppLink, getDexApp } from '@bze/bze-ui-kit'
import { GuidedForm } from '@/components/guided'
import { useNavigationWithParams } from '@/hooks/useNavigation'
import { dexPoolHref } from '@/lib/create-routes'

/** How long the notice stays before the page moves on to the DEX. */
export const DEX_REDIRECT_MS = 1500

/** Opens a URL in place of this page, leaving no history entry (router.replace, but across apps). */
const replaceLocation = (url: string) => window.location.replace(url)

/**
 * What /pool/add shows now that adding and removing liquidity live on the DEX (BFE-257 decision 9):
 * a short notice, the DEX link, then the same pool there (`?pool=<id>`) or the DEX pool list.
 * Not a next.config redirect: the DEX host differs per flavour.
 */
export function MovedToDex({ go = replaceLocation }: { go?: (url: string) => void }) {
    const { getQueryParam } = useNavigationWithParams()
    const href = dexPoolHref(getDexApp().href, getQueryParam('pool'))

    useEffect(() => {
        const timer = setTimeout(() => go(href), DEX_REDIRECT_MS)
        return () => clearTimeout(timer)
    }, [go, href])

    return (
        <GuidedForm crumb="Add liquidity" title="Add liquidity on the DEX">
            <VStack align="start" gap="12px" role="status">
                <Text fontSize="16px">Adding and removing liquidity now lives on the DEX.</Text>
                <Text fontSize="14px" color="fg.muted">Taking you there…</Text>
                <AppLink app="dex" href={href} flush>Open on DEX</AppLink>
            </VStack>
        </GuidedForm>
    )
}
