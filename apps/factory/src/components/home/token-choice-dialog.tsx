"use client"

import React from 'react'
import { Box, Button, chakra, Flex, VStack } from '@chakra-ui/react'
import { Shimmer, TokenLogo, hgVariant } from '@bze/bze-ui-kit'
import { AssetPicker } from '@/components/ui/asset-picker'
import { FactoryDialog } from '@/components/ui/factory-dialog'
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
    const excludeHalted = goal?.excludeHalted ?? false
    const shown = excludeHalted ? tokens.filter(({ asset }) => !asset.halted) : tokens

    return (
        <FactoryDialog open={Boolean(goal)} onClose={onClose} title="Which token?" description={goal?.title}>
            <VStack align="stretch" gap="18px">
                {isLoading ? (
                    <Shimmer h="48px" borderRadius="12px" />
                ) : shown.length > 0 ? (
                    <VStack align="stretch" gap="8px" role="group" aria-label="Your tokens">
                        <chakra.span fontSize="13px" fontWeight="600" color="hg.text.muted">Your tokens</chakra.span>
                        {shown.map(({ asset }) => (
                            <Button
                                key={asset.denom}
                                variant="outline"
                                justifyContent="start"
                                h="auto"
                                px="12px"
                                py="10px"
                                borderRadius="12px"
                                borderColor="hg.lineStrong"
                                color="fg"
                                _hover={{ borderColor: 'app.border', bg: 'app.subtle' }}
                                onClick={() => onPick(asset.denom)}
                            >
                                <Flex align="center" gap="12px" minW={0}>
                                    <TokenLogo src={asset.logo} symbol={asset.ticker} size="7" circular={true} />
                                    <chakra.span fontSize="15px" fontWeight="600">{asset.ticker}</chakra.span>
                                    <chakra.span fontSize="13px" fontWeight="400" color="hg.text.muted" truncate>{asset.name}</chakra.span>
                                </Flex>
                            </Button>
                        ))}
                    </VStack>
                ) : !anyToken && (
                    <VStack gap="14px" py="8px">
                        <chakra.span fontSize="14px" color="hg.text.muted">{"You don't have a token yet."}</chakra.span>
                        <Button variant={hgVariant('primary')} size="lg" onClick={() => navigate('/token/new')}>Create my token</Button>
                    </VStack>
                )}

                {anyToken && (
                    <Box>
                        <AssetPicker
                            label={shown.length > 0 ? 'Or any token' : 'Any token'}
                            includeLP={goal?.includeLP ?? false}
                            excludeHalted={excludeHalted}
                            onSelect={(asset) => onPick(asset.denom)}
                        />
                    </Box>
                )}
            </VStack>
        </FactoryDialog>
    )
}
