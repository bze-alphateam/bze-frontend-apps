"use client"

import React from 'react'
import { Box, Button, CloseButton, Dialog, HStack, Portal, Skeleton, Text, VStack } from '@chakra-ui/react'
import { TokenLogo } from '@bze/bze-ui-kit'
import { AssetPicker } from '@/components/ui/asset-picker'
import { useMyTokens } from '@/hooks/useMyTokens'
import { useNavigation } from '@/hooks/useNavigation'
import type { Goal } from '@/lib/goals'

interface TokenChoiceDialogProps {
    /** The goal that needs a token; the dialog is closed without one. */
    goal?: Goal;
    onClose: () => void;
    onPick: (denom: string) => void;
}

/** "Which token?" for the goals that act on a token: your tokens first, then any token when the goal allows it. */
export function TokenChoiceDialog({ goal, onClose, onPick }: TokenChoiceDialogProps) {
    const { tokens, isLoading } = useMyTokens()
    const { navigate } = useNavigation()
    const anyToken = goal?.needsToken === 'any'

    return (
        <Dialog.Root open={Boolean(goal)} onOpenChange={(e) => { if (!e.open) onClose() }} placement="center">
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW={{ base: 'calc(100vw - 32px)', md: 'md' }} borderRadius="2xl">
                        <Dialog.Header flexDirection="column" alignItems="start" gap={1}>
                            <Dialog.Title>Which token?</Dialog.Title>
                            {goal && <Dialog.Description color="fg.muted" fontSize="sm">{goal.title}</Dialog.Description>}
                            <Dialog.CloseTrigger asChild>
                                <CloseButton size="sm" />
                            </Dialog.CloseTrigger>
                        </Dialog.Header>
                        <Dialog.Body pb={6}>
                            <VStack align="stretch" gap={4}>
                                {isLoading ? (
                                    <Skeleton height="12" borderRadius="lg" />
                                ) : tokens.length > 0 ? (
                                    <VStack align="stretch" gap={2} role="group" aria-label="Your tokens">
                                        <Text fontSize="sm" fontWeight="semibold" color="fg.muted">Your tokens</Text>
                                        {tokens.map(({ asset }) => (
                                            <Button
                                                key={asset.denom}
                                                variant="outline"
                                                justifyContent="start"
                                                h="auto"
                                                py={2}
                                                onClick={() => onPick(asset.denom)}
                                            >
                                                <HStack gap={3} minW={0}>
                                                    <TokenLogo src={asset.logo} symbol={asset.ticker} size="7" circular={true} />
                                                    <Text fontWeight="semibold">{asset.ticker}</Text>
                                                    <Text fontSize="sm" color="fg.muted" truncate>{asset.name}</Text>
                                                </HStack>
                                            </Button>
                                        ))}
                                    </VStack>
                                ) : !anyToken && (
                                    <VStack gap={3} py={2}>
                                        <Text fontSize="sm" color="fg.muted">{"You don't have a token yet."}</Text>
                                        <Button colorPalette="yellow" onClick={() => navigate('/token/new')}>Create my token</Button>
                                    </VStack>
                                )}

                                {anyToken && (
                                    <Box>
                                        <AssetPicker
                                            label={tokens.length > 0 ? 'Or any token' : 'Any token'}
                                            includeLP={goal?.includeLP ?? false}
                                            onSelect={(asset) => onPick(asset.denom)}
                                        />
                                    </Box>
                                )}
                            </VStack>
                        </Dialog.Body>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    )
}
