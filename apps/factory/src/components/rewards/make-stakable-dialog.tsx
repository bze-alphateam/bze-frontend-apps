"use client"

import React from 'react'
import NextLink from 'next/link'
import { Button, Text } from '@chakra-ui/react'
import { hgVariant } from '@bze/bze-ui-kit'
import { FactoryDialog } from '@/components/ui/factory-dialog'

/** "Make X stakable": a token becomes stakable through a compounded reward, so say so, then go create one. */
export function MakeStakableDialog({ open, onClose, ticker, href }: { open: boolean; onClose: () => void; ticker: string; href: string }) {
    return (
        <FactoryDialog
            open={open}
            onClose={onClose}
            title={`Make ${ticker} stakable`}
            footer={(
                <Button asChild variant={hgVariant('primary')} size="lg" flex={{ base: '1 1 100%', md: '0 0 auto' }}>
                    <NextLink href={href}>Create compounded reward</NextLink>
                </Button>
            )}
        >
            <Text fontSize="14px" lineHeight="1.55" color="fg.muted">
                {`For ${ticker} to be stakable, it needs a staking reward. Create a compounded staking reward for it.`}
            </Text>
        </FactoryDialog>
    )
}
