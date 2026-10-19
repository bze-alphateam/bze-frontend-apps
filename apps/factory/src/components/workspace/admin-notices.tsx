"use client"

import React from 'react'
import { Box, Button, VStack } from '@chakra-ui/react'
import { LuRefreshCw } from 'react-icons/lu'
import { InfoBox } from '@/components/ui/info-box'
import { softButton } from '@/components/ui/soft-button'

// Today's admin-state notices from the manage page, shared by the tabs that branch on the admin.

export function AdminUnknownNotice({ onRetry }: { onRetry: () => void }) {
    return (
        <VStack align="stretch" gap="12px">
            <InfoBox title="Couldn't check who controls this token">
                The chain query for who controls this token failed. Mint, burn and the
                other actions that need control stay hidden until it loads — this says
                nothing about whether the supply is fixed.
            </InfoBox>
            <Box>
                <Button {...softButton} size="sm" onClick={onRetry}>
                    <LuRefreshCw />
                    Retry
                </Button>
            </Box>
        </VStack>
    )
}
