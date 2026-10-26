import {useMemo} from "react";
import {Box, Flex, HStack, Link, SimpleGrid, Text} from "@chakra-ui/react";
import {LuArrowUpRight, LuBadgeCheck} from "react-icons/lu";
import BigNumber from "bignumber.js";
import {
    type Asset,
    type DenomBranding,
    StatusPill,
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

/** The 24h change direction: only the change takes a colour (up green, down red, grey without one). */
const changeDirection = (change?: number) => (change === undefined || change === 0 ? "none" : change > 0 ? "up" : "down");
const CHANGE_COLOR = {up: "hg.up", down: "hg.down", none: "hg.text.faint"} as const;

interface StatProps {
    label: string;
    value: string;
    color?: string;
    testId?: string;
    direction?: string;
}

function Stat({label, value, color, testId, direction}: StatProps) {
    return (
        <Flex direction="column" gap="4px" minW={0}>
            <Text fontSize="11px" color="hg.text.faint" textTransform="uppercase" letterSpacing="0.08em">{label}</Text>
            <Text fontSize="15px" fontWeight="600" fontVariantNumeric="tabular-nums" color={color ?? "fg"} truncate data-testid={testId} data-direction={direction}>{value}</Text>
        </Flex>
    );
}

/**
 * A token in the directory, coloured with its brand kit (the kit's primary for the current colour
 * mode): strip, logo ring and, for a token without a logo, the coin placeholder. Without a kit the
 * card stays neutral and shows ui-kit's default logo. Prices and supplies are neutral; only the 24h
 * change is coloured. The whole card links to the token page in a new tab (Business Logic §3).
 */
export function DirectoryCard({asset, kit, price, change, holdersPool, rewardPrograms, tradable}: DirectoryCardProps) {
    const {colorMode} = useColorMode();
    const brand = cardBrandColor(kit, colorMode === "dark" ? "dark" : "light");

    const supply = useMemo(
        () => shortNumberFormat(uAmountToBigNumberAmount(asset.supply, asset.decimals)),
        [asset.supply, asset.decimals],
    );
    const hasPrice = price.gt(0);
    const direction = changeDirection(change);

    return (
        <Link
            href={tokenPagePath(asset.denom)}
            target="_blank"
            rel="noopener noreferrer"
            display="flex"
            flexDirection="column"
            // Link centres its content by default; in a column that shrinks every row to its text.
            alignItems="stretch"
            bg="hg.card"
            borderWidth="1px"
            borderColor="hg.hairline"
            borderRadius="hg.lg"
            boxShadow="hg.card"
            overflow="hidden"
            color="fg"
            transitionProperty="border-color"
            transitionDuration="moderate"
            _hover={{textDecoration: "none", borderColor: "app.border"}}
            focusVisibleRing="outside"
            data-testid="directory-card"
        >
            <Box
                h="6px"
                bg={brand ? undefined : "hg.divider"}
                style={brand ? {background: brand} : undefined}
                data-testid="directory-card-strip"
            />
            <Flex direction="column" gap="16px" p="20px">
                <Flex align="center" justify="space-between" gap="12px">
                    <HStack gap="12px" minW={0}>
                        <Box
                            w="44px"
                            h="44px"
                            p="2px"
                            borderRadius="full"
                            borderWidth="2px"
                            borderColor={brand ? undefined : "hg.lineStrong"}
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
                        <Flex direction="column" gap="2px" minW={0}>
                            <HStack gap="6px" minW={0}>
                                <Text fontSize="16px" fontWeight="700" truncate>{asset.name}</Text>
                                {asset.verified && (
                                    <Box color="hg.accent" flexShrink={0} role="img" aria-label="Verified">
                                        <LuBadgeCheck size={16}/>
                                    </Box>
                                )}
                            </HStack>
                            <Text fontFamily="mono" fontSize="12px" color="hg.text.faint">{asset.ticker}</Text>
                        </Flex>
                    </HStack>
                    <Box color="hg.accent" flexShrink={0} aria-hidden="true"><LuArrowUpRight size={18}/></Box>
                </Flex>

                <SimpleGrid columns={3} gap="8px" px="14px" py="12px" borderRadius="12px" bg="hg.inset">
                    <Stat label="Price" value={hasPrice ? `$${formatUsdAmount(price)}` : "—"}/>
                    <Stat
                        label="24h"
                        value={change === undefined ? "—" : formatChange(change)}
                        color={CHANGE_COLOR[direction]}
                        testId="directory-card-change"
                        direction={direction}
                    />
                    <Stat label="Supply" value={supply}/>
                </SimpleGrid>

                <HStack gap="6px" wrap="wrap" minH="24px">
                    {holdersPool && <StatusPill tone="neutral">Holders pool</StatusPill>}
                    {rewardPrograms && <StatusPill tone="neutral">Reward programs</StatusPill>}
                    {!tradable && <StatusPill tone="neutral">Not traded yet</StatusPill>}
                </HStack>
            </Flex>
        </Link>
    );
}
