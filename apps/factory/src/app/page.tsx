"use client"

import React from 'react'
import {
    Badge,
    Box,
    Container,
    Grid,
    HStack,
    Text,
    VStack,
} from '@chakra-ui/react'
import type { IconType } from 'react-icons'
import {
    LuArrowUpRight,
    LuChartCandlestick,
    LuCoins,
    LuDroplets,
    LuFlame,
    LuGift,
    LuPlus,
} from 'react-icons/lu'
import {useNavigation} from "@/hooks/useNavigation";

interface CreationCard {
    key: string;
    title: string;
    description: string;
    icon: IconType;
    /** Internal route — flips the card live once its milestone ships. */
    href?: string;
    /** External link (opens in a new tab), e.g. the Burner. */
    externalHref?: string;
}

// Cards flip live per milestone: give them an `href` when the flow ships.
const CREATION_CARDS: CreationCard[] = [
    {
        key: 'token',
        title: 'Create Token',
        description: 'Launch your own token on BeeZee — supply, metadata, and admin strategy in one guided flow.',
        icon: LuCoins,
    },
    {
        key: 'market',
        title: 'Create Market',
        description: 'Open an order-book market on the DEX for any pair of assets.',
        icon: LuChartCandlestick,
    },
    {
        key: 'pool',
        title: 'Create Liquidity Pool',
        description: 'Seed an AMM pool, set its swap fee, and decide where the fees go.',
        icon: LuDroplets,
    },
    {
        key: 'add-liquidity',
        title: 'Add Liquidity',
        description: 'Provide liquidity to an existing pool and receive LP tokens.',
        icon: LuPlus,
    },
    {
        key: 'reward',
        title: 'Create Staking Reward',
        description: 'Fund a staking program — your community stakes a token and earns your prize.',
        icon: LuGift,
    },
    {
        key: 'burn',
        title: 'Burn Tokens',
        description: 'Permanently burn coins or LP tokens in the Burner dApp.',
        icon: LuFlame,
        externalHref: 'https://burner.getbze.com',
    },
]

function CreationCardItem({ card }: { card: CreationCard }) {
    const {navigate} = useNavigation()
    const Icon = card.icon
    const isLive = Boolean(card.href || card.externalHref)

    const onClick = () => {
        if (card.externalHref) {
            window.open(card.externalHref, '_blank', 'noopener,noreferrer')
            return
        }
        if (card.href) {
            navigate(card.href)
        }
    }

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
            cursor={isLive ? 'pointer' : 'not-allowed'}
            opacity={isLive ? 1 : 0.65}
            transition="all 0.2s"
            onClick={onClick}
            _hover={isLive ? {
                gradientFrom: "yellow.500/15",
                gradientTo: "yellow.600/15",
                borderColor: "yellow.500/35",
                transform: "translateY(-2px)",
                shadow: "md",
            } : {}}
        >
            <VStack align="start" gap={3}>
                <HStack justify="space-between" w="full">
                    <Box
                        p={2.5}
                        borderRadius="lg"
                        bg="yellow.500/15"
                        color="yellow.600"
                    >
                        <Icon size={22} />
                    </Box>
                    {card.externalHref ? (
                        <Badge colorPalette="yellow" size="sm" variant="surface">
                            Burner <LuArrowUpRight size={12} />
                        </Badge>
                    ) : !isLive && (
                        <Badge colorPalette="gray" size="sm" variant="surface">
                            Coming soon
                        </Badge>
                    )}
                </HStack>
                <Text fontWeight="bold" fontSize="lg">
                    {card.title}
                </Text>
                <Text fontSize="sm" color="fg.muted">
                    {card.description}
                </Text>
            </VStack>
        </Box>
    )
}

export default function FactoryHubPage() {
    return (
        <Box minH="100vh" bg="bg.subtle">
            <Container maxW="7xl" py={12}>
                <VStack align="stretch" gap={8}>
                    {/* Page Header */}
                    <VStack gap={3} align="center" mb={4}>
                        <Text fontSize="3xl" fontWeight="bold" letterSpacing="tight">
                            What do you want to create?
                        </Text>
                        <Text fontSize="md" color="fg.muted" textAlign="center" maxW="2xl">
                            The BeeZee creation workshop — tokens, markets, liquidity pools, and staking
                            rewards, each in a short guided flow with fees disclosed upfront.
                        </Text>
                    </VStack>

                    {/* Creation Cards */}
                    <Grid templateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }} gap={4}>
                        {CREATION_CARDS.map(card => (
                            <CreationCardItem key={card.key} card={card} />
                        ))}
                    </Grid>
                </VStack>
            </Container>
        </Box>
    )
}
