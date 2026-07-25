import React, {useMemo} from "react";
import {Box, Flex, HStack, Link, Text} from "@chakra-ui/react";
import {LuArrowUpRight} from "react-icons/lu";
import {Asset, TokenLogo, prettyAmount, uAmountToAmount} from "@bze/bze-ui-kit";

import {VerifiedBadge} from "@/components/ui/badge/verified";
import {tokenPagePath} from "@/hooks/useNavigation";

interface TokenCardProps {
    asset: Asset;
}

/**
 * A single entry in the token directory: logo, name/ticker, verified badge and
 * total supply. The whole card is a link to the token's page, opened in a new
 * tab (Business Logic §3 — directory links use target="_blank").
 */
export function TokenCard({asset}: TokenCardProps) {
    const formattedSupply = useMemo(
        () => prettyAmount(uAmountToAmount(asset.supply, asset.decimals)),
        [asset.supply, asset.decimals],
    );

    return (
        <Link
            href={tokenPagePath(asset.denom)}
            target="_blank"
            rel="noopener noreferrer"
            _hover={{textDecoration: "none"}}
            display="block"
        >
            <Box
                bgGradient="to-br"
                gradientFrom="green.500/5"
                gradientTo="green.600/5"
                borderWidth="1px"
                borderColor="green.500/15"
                borderRadius="lg"
                overflow="hidden"
                transition="all 0.2s"
                shadow="sm"
                _hover={{
                    gradientFrom: "green.500/10",
                    gradientTo: "green.600/10",
                    borderColor: "green.500/25",
                    shadow: "md",
                }}
            >
                <Flex p={4} align="center" justify="space-between" gap={3}>
                    <HStack gap={3} minW={0}>
                        <Box
                            position="relative"
                            width="40px"
                            height="40px"
                            borderRadius="full"
                            bg="bg.surface"
                            borderWidth="1px"
                            borderColor="border.subtle"
                            flexShrink={0}
                        >
                            <TokenLogo src={asset.logo} symbol={asset.ticker} circular={true}/>
                        </Box>
                        <Box minW={0}>
                            <HStack gap={2}>
                                <Text fontWeight="semibold" fontSize="md" truncate>
                                    {asset.name}
                                </Text>
                                {asset.verified && <VerifiedBadge/>}
                            </HStack>
                            <Text color="fg.muted" fontSize="sm">
                                {asset.ticker}
                            </Text>
                        </Box>
                    </HStack>

                    <HStack gap={3} flexShrink={0}>
                        <Box textAlign="right" display={{base: "none", sm: "block"}}>
                            <Text fontSize="xs" color="fg.muted" textTransform="uppercase">
                                Total supply
                            </Text>
                            <Text fontWeight="medium" fontSize="md">
                                {formattedSupply}
                            </Text>
                        </Box>
                        <Box color="green.500">
                            <LuArrowUpRight size={18}/>
                        </Box>
                    </HStack>
                </Flex>

                {/* Mobile supply row */}
                <Box display={{base: "block", sm: "none"}} px={4} pb={3}>
                    <HStack justify="space-between">
                        <Text fontSize="xs" color="fg.muted" textTransform="uppercase">
                            Total supply
                        </Text>
                        <Text fontWeight="medium">{formattedSupply}</Text>
                    </HStack>
                </Box>
            </Box>
        </Link>
    );
}
