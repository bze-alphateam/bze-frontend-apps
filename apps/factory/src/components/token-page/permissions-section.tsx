"use client"

import React from 'react'
import { Box, Button, HStack, Text, VStack } from '@chakra-ui/react'
import { LuRefreshCw, LuTriangleAlert } from 'react-icons/lu'
import { HgCard, Shimmer } from '@bze/bze-ui-kit'
import { softButton } from '@/components/ui/soft-button'
import { ControlTab } from '@/components/workspace/control-tab'
import type { WorkspaceTabProps } from '@/components/workspace/types'

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

/**
 * Permissions, the last section of the token page. BFE-273 redesigns it (Transfer admin + Renounce
 * admin with its own review dialog); until then it holds the workspace's Control content as is.
 */
export function PermissionsSection({ isChecking, ...props }: WorkspaceTabProps & { isChecking: boolean }) {
    return (
        <Box as="section" id="permissions" aria-label="Permissions" scrollMarginTop="96px" data-testid="permissions-section">
            <HgCard px={{ base: '18px', md: '22px' }} py="20px">
                {isChecking ? (
                    <VStack align="stretch" gap="8px" aria-busy="true" data-testid="admin-item-loading">
                        <Shimmer h="20px" w="192px" />
                        <Shimmer h="14px" w="288px" />
                    </VStack>
                ) : (
                    <ControlTab {...props} />
                )}
            </HgCard>
        </Box>
    )
}
