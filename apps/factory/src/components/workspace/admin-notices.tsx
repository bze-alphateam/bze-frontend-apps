"use client"

import React from 'react'
import { Box, Button, VStack } from '@chakra-ui/react'
import { LuRefreshCw } from 'react-icons/lu'
import { InfoBox } from '@/components/ui/info-box'

// Today's admin-state notices from the manage page, shared by the tabs that branch on the admin.

export function AdminUnknownNotice({ onRetry }: { onRetry: () => void }) {
    return (
        <VStack align="stretch" gap={3}>
            <InfoBox title="Couldn't load the admin">
                The chain query for this token&apos;s admin failed, so the admin status
                is unknown. Mint, burn and the other admin actions stay hidden until it
                loads — this says nothing about whether the supply is fixed.
            </InfoBox>
            <Box>
                <Button size="sm" variant="outline" colorPalette="yellow" onClick={onRetry}>
                    <LuRefreshCw />
                    Retry
                </Button>
            </Box>
        </VStack>
    )
}

export function RenouncedNotice() {
    return (
        <InfoBox title="Supply provably fixed">
            The admin of this token was renounced — nobody, including you, can mint more
            tokens or change its metadata. That&apos;s the guarantee holders rely on.
        </InfoBox>
    )
}

export function NotAdminNotice({ admin }: { admin?: string }) {
    return (
        <InfoBox title="You are not the admin">
            You created this token, but its admin is now {admin}. Only the current
            admin can mint, burn, or update it.
        </InfoBox>
    )
}
