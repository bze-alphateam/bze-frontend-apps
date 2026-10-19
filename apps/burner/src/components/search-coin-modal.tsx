'use client';

import {
    Box,
    chakra,
    Flex,
    Input,
    InputGroup,
    VisuallyHidden,
} from "@chakra-ui/react";
import { useState, useMemo } from "react";
import { LuBadgeCheck, LuSearch } from "react-icons/lu";
import { useRouter } from "next/navigation";
import { useAssets, truncateDenom, PageState } from "@bze/bze-ui-kit";
import {AssetLogo} from "@/components/ui/asset_logo";
import {BurnerDialog} from "@/components/ui/burner/dialog";

interface SearchCoinModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCoinSelect?: (denom: string) => void;
}

export const SearchCoinModal = ({ isOpen, onClose, onCoinSelect }: SearchCoinModalProps) => {
    const [searchQuery, setSearchQuery] = useState("");
    const router = useRouter();
    const { assets, isLoading } = useAssets();

    // Filter and sort coins based on search query
    const filteredCoins = useMemo(() => {
        if (!assets) return [];

        let coins = assets;

        // Filter by search query if provided
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            coins = assets.filter(
                (coin) =>
                    coin.name.toLowerCase().includes(query) ||
                    coin.ticker.toLowerCase().includes(query) ||
                    coin.denom.toLowerCase().includes(query)
            );
        }

        // Sort: verified coins first, then the rest
        return coins.sort((a, b) => {
            if (a.verified && !b.verified) return -1;
            if (!a.verified && b.verified) return 1;
            return 0;
        });
    }, [searchQuery, assets]);

    const handleCoinClick = (denom: string) => {
        if (onCoinSelect) {
            onCoinSelect(denom);
        } else {
            // Navigate to coin detail page with query param
            router.push(`/coin?coin=${encodeURIComponent(denom)}`);
        }
        onClose();
    };

    const handleClose = () => {
        setSearchQuery("");
        onClose();
    };

    return (
        <BurnerDialog isOpen={isOpen} onClose={handleClose} title="Search Coins">
            <InputGroup startElement={<LuSearch size={18} aria-hidden />}>
                <Input
                    size="lg"
                    type="search"
                    aria-label="Search coins"
                    borderRadius="hg.md"
                    placeholder="Search by name or ticker..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </InputGroup>

            <Box maxH="400px" overflowY="auto" mx="-8px">
                {isLoading ? (
                    <Box aria-busy="true" px="8px">
                        <VisuallyHidden>Loading coins...</VisuallyHidden>
                        <PageState kind="loading" rows={3} />
                    </Box>
                ) : filteredCoins.length > 0 ? (
                    <chakra.ul m="0" p="0" listStyleType="none" display="flex" flexDirection="column" gap="2px">
                        {filteredCoins.map((coin) => (
                            <li key={coin.denom}>
                                <chakra.button
                                    type="button"
                                    onClick={() => handleCoinClick(coin.denom)}
                                    w="100%"
                                    display="flex"
                                    alignItems="center"
                                    gap="12px"
                                    px="10px"
                                    py="10px"
                                    borderRadius="hg.md"
                                    textAlign="start"
                                    bg="transparent"
                                    cursor="pointer"
                                    _hover={{bg: 'hg.hoverFill'}}
                                    focusVisibleRing="inside"
                                >
                                    <AssetLogo asset={coin} size="40px" />
                                    <Flex direction="column" gap="2px" minW="0" flex="1">
                                        <Flex align="center" gap="6px">
                                            <chakra.strong fontSize="15px">{coin.ticker}</chakra.strong>
                                            {coin.verified && (
                                                <chakra.span role="img" aria-label="Verified" color="hg.success" display="inline-flex">
                                                    <LuBadgeCheck size={14} aria-hidden />
                                                </chakra.span>
                                            )}
                                        </Flex>
                                        <chakra.span fontSize="13px" color="hg.text.secondary" truncate>{coin.name}</chakra.span>
                                        <chakra.span fontSize="12px" fontFamily="mono" color="hg.text.faint" truncate>{truncateDenom(coin.denom)}</chakra.span>
                                    </Flex>
                                </chakra.button>
                            </li>
                        ))}
                    </chakra.ul>
                ) : (
                    <PageState kind="not-found" title="No coins found" description="Try a different search term" />
                )}
            </Box>

            {searchQuery && (
                <chakra.span fontSize="13px" color="hg.text.faint" textAlign="center">
                    Found {filteredCoins.length} coin{filteredCoins.length !== 1 ? 's' : ''}
                </chakra.span>
            )}
        </BurnerDialog>
    );
};
