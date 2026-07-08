"use client"

import React from 'react'
import { Badge, Box, Grid, HStack, Text, VStack } from '@chakra-ui/react'
import type { IconType } from 'react-icons'
import { LuBuilding2, LuRocket } from 'react-icons/lu'
import { useCreationFees } from '@bze/bze-ui-kit'
import { FeeDisclosure } from '@/components/ui/fee-disclosure'
import { type TokenWizardLane, useTokenWizard } from '@/components/token-wizard/token-wizard-context'

interface LaneOption {
    lane: TokenWizardLane;
    title: string;
    description: string;
    bullets: string[];
    icon: IconType;
    recommended?: boolean;
}

const LANES: LaneOption[] = [
    {
        lane: 'fast',
        title: 'Fast Track',
        description: '3 quick steps with sensible defaults — perfect for most tokens.',
        bullets: ['Name, symbol & supply', 'Optional fixed supply', 'Done in a minute'],
        icon: LuRocket,
        recommended: true,
    },
    {
        lane: 'pro',
        title: 'Pro',
        description: 'Full control over every detail of your token.',
        bullets: ['Custom subdenom & denom units', 'Description, logo & links', 'Explicit admin strategy'],
        icon: LuBuilding2,
    },
]

function LaneCard({ option }: { option: LaneOption }) {
    const { setLane } = useTokenWizard()
    const Icon = option.icon

    return (
        <Box
            p={6}
            bgGradient="to-br"
            gradientFrom="yellow.500/8"
            gradientTo="yellow.600/8"
            borderWidth="1px"
            borderColor="yellow.500/20"
            borderRadius="xl"
            shadow="sm"
            cursor="pointer"
            transition="all 0.2s"
            onClick={() => setLane(option.lane)}
            _hover={{
                gradientFrom: 'yellow.500/15',
                gradientTo: 'yellow.600/15',
                borderColor: 'yellow.500/35',
                transform: 'translateY(-2px)',
                shadow: 'md',
            }}
        >
            <VStack align="start" gap={3} h="full">
                <HStack justify="space-between" w="full">
                    <Box p={2.5} borderRadius="lg" bg="yellow.500/15" color="yellow.600">
                        <Icon size={22} />
                    </Box>
                    {option.recommended && (
                        <Badge colorPalette="yellow" size="sm" variant="surface">
                            Recommended
                        </Badge>
                    )}
                </HStack>
                <Text fontWeight="bold" fontSize="lg">
                    {option.title}
                </Text>
                <Text fontSize="sm" color="fg.muted">
                    {option.description}
                </Text>
                <VStack align="start" gap={1}>
                    {option.bullets.map(bullet => (
                        <Text key={bullet} fontSize="sm" color="fg.muted">
                            • {bullet}
                        </Text>
                    ))}
                </VStack>
            </VStack>
        </Box>
    )
}

// Wizard entry screen: pick a lane. The creation fee is disclosed here, before
// the user invests any time in the form (spec: fees loud and clear everywhere).
export function LaneChooser() {
    const { fees, isLoading } = useCreationFees()

    return (
        <VStack align="stretch" gap={6}>
            <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={4}>
                {LANES.map(option => (
                    <LaneCard key={option.lane} option={option} />
                ))}
            </Grid>
            <FeeDisclosure fee={fees.createDenomFee} isLoading={isLoading} label="Token creation fee" />
        </VStack>
    )
}
