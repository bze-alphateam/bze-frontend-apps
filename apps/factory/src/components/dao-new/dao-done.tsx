"use client"

import React, { useState } from 'react'
import { Box, Button, Text, VStack } from '@chakra-ui/react'
import { type Asset, type DaoCreated, getChainName, getDaoApp, getExplorerTxURL } from '@bze/bze-ui-kit'
import { useChain } from '@interchain-kit/react'
import { DoneScreen } from '@/components/done'
import { useReturnTo } from '@/components/guided'
import { softButton } from '@/components/ui/soft-button'
import { TransferAdminDialog } from '@/components/token-page/transfer-admin-dialog'
import { useDenomAdmin } from '@/hooks/useDenomAdmin'
import { daoPageHref } from '@/lib/dao-admin'
import { adminState } from '@/lib/workspace'

/**
 * The Done screen of a new stake DAO (canvas G5): open it in the DAO app, and, for the token's admin
 * only, hand the token to it (BFE-387's transfer dialog with the new DAO's address filled in).
 */
export function DaoDone({ asset, created }: { asset: Asset; created: DaoCreated }) {
    const returnTo = useReturnTo()
    const { address } = useChain(getChainName())
    const { admin, refresh } = useDenomAdmin(asset.denom)
    const [handing, setHanding] = useState(false)
    const isAdmin = adminState(admin, address) === 'admin'

    return (
        <>
            <DoneScreen
                avatar={{ ticker: asset.ticker, logo: asset.logo }}
                title={`A DAO for ${asset.ticker} stakers is **live**.`}
                text={(
                    <VStack align="center" gap="10px">
                        <Text>{`Its voters are the people who stake ${asset.ticker}. The DAO is number ${created.id}.`}</Text>
                        {isAdmin && (
                            <Box>
                                <Button {...softButton} size="sm" onClick={() => setHanding(true)}>{`Hand ${asset.ticker} to this DAO`}</Button>
                            </Box>
                        )}
                    </VStack>
                )}
                links={[
                    { label: 'Open the DAO', href: daoPageHref(getDaoApp().href, created.id), app: 'dao' },
                    { label: 'Explorer', href: getExplorerTxURL(created.txHash), app: 'explorer' },
                ]}
                subject={asset.ticker}
                back={returnTo}
            />
            {handing && (
                <TransferAdminDialog
                    asset={asset}
                    open
                    onClose={() => setHanding(false)}
                    onTransferred={() => void refresh()}
                    initialAddress={created.address}
                />
            )}
        </>
    )
}
