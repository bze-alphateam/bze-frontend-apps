"use client"

import React, { useState } from 'react'
import { Box, Button, Text, VStack } from '@chakra-ui/react'
import { type Asset, truncateAddress } from '@bze/bze-ui-kit'
import { softButton } from '@/components/ui/soft-button'
import { useDenomConfig } from '@/hooks/useDenomConfig'
import { settingsFromConfig } from '@/lib/denom-config'
import { ActionItem, AdminItemShimmer, ItemButton, type AdminAccess } from './action-group'
import { FeeSettingsForm } from './fee-settings-form'

const TITLE = 'Fees and community pool'

function Setting({ label, value, title, text, testId }: { label: string; value: string; title?: string; text: string; testId: string }) {
    return (
        <VStack align="stretch" gap="2px" data-testid={testId}>
            <Text fontSize="13px" fontWeight="700" title={title}>{`${label}: ${value}`}</Text>
            <Text fontSize="13px" color="fg.muted">{text}</Text>
        </VStack>
    )
}

/**
 * "Fees and community pool" (BFE-385, chain v8.3.0), in the Trading group for everyone: the token's
 * transfer fee, gas surcharge and community pool, and for the admin the form that changes them. Hidden
 * on v8.2.0 nodes, where the config route answers 501 and "0%" would not be true later.
 */
export function FeeSettingsItem({ asset, access }: { asset: Asset; access: AdminAccess }) {
    const { config, refresh } = useDenomConfig(asset.denom)
    const [isOpen, setIsOpen] = useState(false)
    const [isOpening, setIsOpening] = useState(false)

    if (!config) return <AdminItemShimmer testId="fee-settings-loading" />
    if (config.status === 'unsupported') return null

    if (config.status === 'error') {
        return (
            <ActionItem
                testId="fee-settings-item"
                title={TITLE}
                line={`Couldn't load the fee settings of ${asset.ticker}.`}
                action={<Button {...softButton} size="sm" h="36px" onClick={() => void refresh()}>Retry</Button>}
            />
        )
    }

    // The form prefills and diffs against the live config, so opening it reads past the cache.
    const toggle = async () => {
        if (isOpen) return setIsOpen(false)
        setIsOpening(true)
        try {
            await refresh()
            setIsOpen(true)
        } finally {
            setIsOpening(false)
        }
    }

    const current = settingsFromConfig(config)
    const hasPool = current.communityPool !== ''
    return (
        <ActionItem
            testId="fee-settings-item"
            title={TITLE}
            line={access === 'renounced' ? 'Frozen: nobody can change these settings.' : undefined}
            action={access === 'admin' && (
                <ItemButton onClick={() => void toggle()} disabled={isOpening} aria-expanded={isOpen}>
                    {isOpen ? 'Close' : 'Edit'}
                </ItemButton>
            )}
        >
            <VStack align="stretch" gap="10px">
                <Setting
                    testId="fee-setting-transfer"
                    label="Transfer fee"
                    value={`${current.transferFeePct}%`}
                    text={`Charged on top of protocol fees paid in ${asset.ticker} (not on sends). Up to 5%.`}
                />
                <Setting
                    testId="fee-setting-surcharge"
                    label="Gas surcharge"
                    value={`${current.gasSurchargePct}%`}
                    text={`Added to the gas price when ${asset.ticker} pays the network fee. Up to 200%.`}
                />
                <Setting
                    testId="fee-setting-pool"
                    label="Community pool"
                    value={hasPool ? truncateAddress(current.communityPool) : 'None: these fees are burned'}
                    title={hasPool ? current.communityPool : undefined}
                    text={`The address that receives these fees. Without one they are burned.`}
                />
                {access === 'admin' && isOpen && (
                    <Box>
                        <FeeSettingsForm
                            asset={asset}
                            current={current}
                            onDone={() => { setIsOpen(false); void refresh() }}
                        />
                    </Box>
                )}
            </VStack>
        </ActionItem>
    )
}
