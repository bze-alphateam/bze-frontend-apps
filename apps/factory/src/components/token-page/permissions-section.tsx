"use client"

import React, { useState } from 'react'
import { Box, Button, HStack, Text, VStack } from '@chakra-ui/react'
import type BigNumber from 'bignumber.js'
import { LuRefreshCw, LuTriangleAlert } from 'react-icons/lu'
import { Asset, HgCard, Shimmer, hgVariant } from '@bze/bze-ui-kit'
import { softButton } from '@/components/ui/soft-button'
import { permissionsStatus } from '@/lib/permissions'
import type { AdminState } from '@/lib/workspace'
import { ActionItem, ItemButton } from './action-group'
import { RenounceDialog } from './renounce-dialog'
import { TransferAdminDialog } from './transfer-admin-dialog'

/** The admin query failed (canvas D2): admin actions stay hidden, and it never reads as "not admin". */
export function AdminUnknownNotice({ onRetry }: { onRetry: () => void }) {
    return (
        <HStack
            gap="12px"
            align="start"
            justify="space-between"
            flexWrap="wrap"
            px="18px"
            py="14px"
            borderRadius="14px"
            bg="hg.warning/6"
            borderWidth="1px"
            borderColor="hg.warning/30"
            data-testid="admin-unknown"
        >
            <HStack gap="10px" align="start" flex="1 1 320px" minW={0}>
                <Box color="hg.warning" mt="2px" flexShrink={0} aria-hidden><LuTriangleAlert size={16} /></Box>
                <Text fontSize="14px" lineHeight="1.5">
                    <Text as="strong">Unable to verify admin permissions.</Text>
                    {' Actions that need admin stay hidden until we know.'}
                </Text>
            </HStack>
            <Button {...softButton} size="sm" h="34px" onClick={onRetry}>
                <LuRefreshCw /> Retry
            </Button>
        </HStack>
    )
}

export interface PermissionsSectionProps {
    asset: Asset;
    /** The live admin query is running. */
    isChecking: boolean;
    /** From useDenomAdmin: an address, '' when renounced, undefined when the lookup failed. */
    admin: string | undefined;
    adminState: AdminState;
    /** Total supply in display units (live, falling back to the asset's snapshot). */
    supplyDisplay: BigNumber;
    /** Live total supply in base units, undefined until loaded. */
    supply?: string;
    refreshAdmins: () => Promise<void>;
}

/**
 * Permissions, the last section of the token page (canvas D2): who the admin is and, for the admin
 * only (live `DenomAuthority`), Transfer admin and Renounce admin. Renouncing lives only here, behind
 * its own review dialog; nothing else links to it.
 */
export function PermissionsSection({ asset, isChecking, admin, adminState, supplyDisplay, supply, refreshAdmins }: PermissionsSectionProps) {
    const ticker = asset.ticker
    const [dialog, setDialog] = useState<'transfer' | 'renounce' | undefined>(undefined)
    const close = () => setDialog(undefined)
    const refresh = () => void refreshAdmins()

    let status: React.ReactNode
    if (isChecking) {
        status = (
            <VStack align="stretch" gap="8px" aria-busy="true" data-testid="admin-item-loading">
                <Shimmer h="14px" w="288px" maxW="full" />
            </VStack>
        )
    } else if (adminState === 'unknown') {
        status = (
            <HStack justify="space-between" gap="12px" flexWrap="wrap" data-testid="permissions-unknown">
                <Text fontSize="14px" color="fg.muted" flex="1 1 240px">
                    Unable to verify admin permissions. Actions stay hidden until we know.
                </Text>
                <Button {...softButton} size="sm" h="34px" onClick={refresh}>
                    <LuRefreshCw /> Retry
                </Button>
            </HStack>
        )
    } else {
        status = (
            <Text fontSize="14px" color="fg.muted" overflowWrap="anywhere" title={admin || undefined} data-testid="permissions-status">
                {permissionsStatus(adminState, admin, ticker)}
            </Text>
        )
    }

    return (
        <Box as="section" id="permissions" aria-label="Permissions" scrollMarginTop="96px" data-testid="permissions-section">
            <HgCard px={{ base: '18px', md: '22px' }} pt="20px" pb={adminState === 'admin' && !isChecking ? '8px' : '20px'}>
                <Text as="h2" fontSize="18px" fontWeight="700">Permissions</Text>
                <Box mt="6px" mb={adminState === 'admin' && !isChecking ? '8px' : '0'}>{status}</Box>

                {adminState === 'admin' && !isChecking && (
                    <VStack align="stretch" gap="0">
                        <ActionItem
                            testId="transfer-admin-item"
                            title="Transfer admin"
                            action={<ItemButton onClick={() => setDialog('transfer')}>Transfer admin</ItemButton>}
                        />
                        <ActionItem
                            testId="renounce-admin-item"
                            title="Renounce admin"
                            line={`Nobody, you included, can ever mint or edit ${ticker} again.`}
                            action={(
                                <Button
                                    variant={hgVariant('danger')}
                                    size="sm"
                                    h="36px"
                                    px="14px"
                                    fontSize="13px"
                                    onClick={() => setDialog('renounce')}
                                >
                                    Renounce…
                                </Button>
                            )}
                        />
                    </VStack>
                )}
            </HgCard>

            <TransferAdminDialog asset={asset} open={dialog === 'transfer'} onClose={close} onTransferred={refresh} />
            <RenounceDialog
                asset={asset}
                admin={admin}
                supply={supply}
                supplyDisplay={supplyDisplay}
                open={dialog === 'renounce'}
                onClose={close}
                onRenounced={refresh}
            />
        </Box>
    )
}
