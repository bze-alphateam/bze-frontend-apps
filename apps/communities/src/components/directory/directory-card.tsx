import {useMemo} from "react";
import {Badge, Box, Flex, HStack, Link, SimpleGrid, Text} from "@chakra-ui/react";
import {LuArrowUpRight, LuBadgeCheck} from "react-icons/lu";
import BigNumber from "bignumber.js";
import {
    type Asset,
    type DenomBranding,
    TokenLogo,
    formatUsdAmount,
    shortNumberFormat,
    uAmountToBigNumberAmount,
} from "@bze/bze-ui-kit";

import {BrandedTokenLogo} from "@/components/branded-token-logo";
import {useColorMode} from "@/components/ui/color-mode";
import {cardBrandColor, contrastText} from "@/lib/brand-kit";
import {tokenPagePath} from "@/lib/token-directory";

export interface DirectoryCardProps {
    asset: Asset;
    /** The token's brand kit; `null`/`undefined` draws the neutral strip. */
    kit?: DenomBranding | null;
    /** USD price, 0 when unknown. */
    price: BigNumber;
    /** 24h change in percent, `undefined` without a market. */
    change?: number;
    holdersPool: boolean;
    rewardPrograms: boolean;
    tradable: boolean;
}

const formatChange = (change: number) => `${change > 0 ? "+" : ""}${change.toFixed(1)}%`;

function Stat({label, value, color}: { label: string; value: string; color?: string }) {
    return (
        <Box minW={0}>
            <Text fontSize="xs" color="fg.muted" textTransform="uppercase" letterSpacing="wider">{label}</Text>
            <Text fontWeight="semibold" fontVariantNumeric="tabular-nums" color={color} truncate>{value}</Text>
        </Box>
    );
}

/**
 * A token in the directory, coloured with its brand kit (the kit's primary for the current colour
 * mode): strip, logo ring and, for a token without a logo, the coin placeholder. Without a kit the
 * card stays neutral and shows ui-kit's default logo. The whole card links to the token page in a new tab (Business Logic §3).
 */
export function DirectoryCard({asset, kit, price, change, holdersPool, rewardPrograms, tradable}: DirectoryCardProps) {
    const {colorMode} = useColorMode();
    const brand = cardBrandColor(kit, colorMode === "dark" ? "dark" : "light");

    const supply = useMemo(
        () => shortNumberFormat(uAmountToBigNumberAmount(asset.supply, asset.decimals)),
        [asset.supply, asset.decimals],
    );
    const hasPrice = price.gt(0);

    return (
        <Link
            href={tokenPagePath(asset.denom)}
            target="_blank"
            rel="noopener noreferrer"
            display="flex"
            flexDirection="column"
            bg="bg.panel"
            borderWidth="1px"
            borderColor="border"
            borderRadius="xl"
            overflow="hidden"
            shadow="xs"
            transition="box-shadow 0.2s, border-color 0.2s"
            _hover={{textDecoration: "none", borderColor: "green.500/35", shadow: "md"}}
            data-testid="directory-card"
        >
            <Box
                h="6px"
                bg={brand ? undefined : "border"}
                style={brand ? {background: brand} : undefined}
                data-testid="directory-card-strip"
            />
            <Flex direction="column" gap={{base: "3.5", md: "4.5"}} p={{base: "4", md: "5"}}>
                <Flex align="center" justify="space-between" gap="3">
                    <HStack gap="3" minW={0}>
                        <Box
                            w="44px"
                            h="44px"
                            p="2px"
                            borderRadius="full"
                            borderWidth="2px"
                            borderColor={brand ? undefined : "border.subtle"}
                            style={brand ? {borderColor: brand} : undefined}
                            flexShrink={0}
                            data-testid="directory-card-logo"
                        >
                            {brand ? (
                                <BrandedTokenLogo src={asset.logo} ticker={asset.ticker} size={36} fill={brand} ink={contrastText(brand)}/>
                            ) : (
                                <TokenLogo src={asset.logo} symbol={asset.ticker} size="36px" circular={true}/>
                            )}
                        </Box>
                        <Box minW={0}>
                            <HStack gap="1.5" minW={0}>
                                <Text fontWeight="semibold" truncate>{asset.name}</Text>
                                {asset.verified && (
                                    <Box color="green.fg" flexShrink={0} role="img" aria-label="Verified">
                                        <LuBadgeCheck size={16}/>
                                    </Box>
                                )}
                            </HStack>
                            <Text fontSize="sm" color="fg.muted">{asset.ticker}</Text>
                        </Box>
                    </HStack>
                    <Box color="green.fg" flexShrink={0}><LuArrowUpRight size={18}/></Box>
                </Flex>

                <SimpleGrid columns={3} gap="3">
                    <Stat label="Price" value={hasPrice ? `$${formatUsdAmount(price)}` : "—"}/>
                    <Stat
                        label="24h"
                        value={change === undefined ? "—" : formatChange(change)}
                        color={change === undefined || change === 0 ? undefined : change > 0 ? "green.fg" : "red.fg"}
                    />
                    <Stat label="Supply" value={supply}/>
                </SimpleGrid>

                <HStack gap="1.5" wrap="wrap" minH="22px">
                    {holdersPool && <Badge colorPalette="green" variant="subtle" borderRadius="full">Holders pool</Badge>}
                    {rewardPrograms && <Badge colorPalette="green" variant="subtle" borderRadius="full">Reward programs</Badge>}
                    {!tradable && <Badge colorPalette="gray" variant="subtle" borderRadius="full">Not traded yet</Badge>}
                </HStack>
            </Flex>
        </Link>
    );
}
