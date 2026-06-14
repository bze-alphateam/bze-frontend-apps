import { VStack, HStack, Text, Box, Grid } from "@chakra-ui/react";

export const RaffleInfo = () => {
    return (
        <VStack gap="4" align="stretch">
            <VStack gap="3" align="stretch">
                <Text fontSize="sm" color="fg.emphasized">
                    Burning Raffles let you <strong>contribute to reducing token supply</strong> by permanently burning tokens. As a thank you for your contribution, <strong>you get a chance to win rewards</strong> from the raffle pot!
                </Text>
                <Box
                    p="4"
                    bg="blue.100"
                    _dark={{ bg: "blue.900/50" }}
                    borderRadius="lg"
                    borderLeftWidth="4px"
                    borderLeftColor="blue.500"
                >
                    <Text fontSize="sm" fontWeight="semibold" color="blue.800" _dark={{ color: "blue.200" }}>
                        💡 This is a contribution mechanism, not gambling. Every contribution burns tokens to help the ecosystem. Winners receive a portion of the pot as a reward, while all tokens eventually get burned.
                    </Text>
                </Box>
            </VStack>

            {/* How It Works */}
            <VStack gap="2" align="stretch">
                <Text fontSize="md" fontWeight="bold" color="purple.700" _dark={{ color: "purple.300" }}>
                    ⚙️ How It Works
                </Text>
                <VStack gap="2" align="stretch" pl="2">
                    <HStack gap="2" align="start">
                        <Text fontSize="sm" fontWeight="bold" color="purple.600" _dark={{ color: "purple.400" }}>1.</Text>
                        <Text fontSize="sm">
                            <strong>Make a contribution</strong> by burning tokens - your tokens are permanently removed from circulation
                        </Text>
                    </HStack>
                    <HStack gap="2" align="start">
                        <Text fontSize="sm" fontWeight="bold" color="purple.600" _dark={{ color: "purple.400" }}>2.</Text>
                        <Text fontSize="sm">
                            <strong>Each contribution gives you a chance to win</strong> - the blockchain automatically determines winners after 2 blocks
                        </Text>
                    </HStack>
                    <HStack gap="2" align="start">
                        <Text fontSize="sm" fontWeight="bold" color="purple.600" _dark={{ color: "purple.400" }}>3.</Text>
                        <Text fontSize="sm">
                            <strong>Multiple contributions = more chances</strong> - each one gives you another opportunity to win in consecutive blocks
                        </Text>
                    </HStack>
                    <HStack gap="2" align="start">
                        <Text fontSize="sm" fontWeight="bold" color="purple.600" _dark={{ color: "purple.400" }}>4.</Text>
                        <Text fontSize="sm">
                            <strong>Winners receive rewards</strong> - win a percentage of the raffle pot as a thank you for contributing
                        </Text>
                    </HStack>
                    <HStack gap="2" align="start">
                        <Text fontSize="sm" fontWeight="bold" color="purple.600" _dark={{ color: "purple.400" }}>5.</Text>
                        <Text fontSize="sm">
                            <strong>Remaining pot gets burned</strong> - when the raffle ends, all unclaimed tokens are permanently destroyed
                        </Text>
                    </HStack>
                </VStack>
                <Box
                    p="3"
                    bg="purple.50"
                    _dark={{ bg: "purple.900/30" }}
                    borderRadius="md"
                    mt="1"
                >
                    <Text fontSize="xs" color="fg.muted" fontStyle="italic">
                        Example: 5 contributions = 5 separate chances to win, each checked in consecutive blocks after the 2-block delay
                    </Text>
                </Box>
            </VStack>

            {/* Key Benefits Grid */}
            <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap="3">
                <VStack gap="2" align="center">
                    <Text fontSize="2xl">🔥</Text>
                    <VStack gap="0" align="center">
                        <Text fontSize="sm" fontWeight="bold">Support the Ecosystem</Text>
                        <Text fontSize="xs" color="fg.muted" textAlign="center">Help reduce token supply</Text>
                    </VStack>
                </VStack>
                <VStack gap="2" align="center">
                    <Text fontSize="2xl">🎲</Text>
                    <VStack gap="0" align="center">
                        <Text fontSize="sm" fontWeight="bold">Chance to Win</Text>
                        <Text fontSize="xs" color="fg.muted" textAlign="center">Each contribution is an opportunity</Text>
                    </VStack>
                </VStack>
                <VStack gap="2" align="center">
                    <Text fontSize="2xl">💰</Text>
                    <VStack gap="0" align="center">
                        <Text fontSize="sm" fontWeight="bold">Reward Potential</Text>
                        <Text fontSize="xs" color="fg.muted" textAlign="center">Win from the raffle pot</Text>
                    </VStack>
                </VStack>
            </Grid>
        </VStack>
    );
};
