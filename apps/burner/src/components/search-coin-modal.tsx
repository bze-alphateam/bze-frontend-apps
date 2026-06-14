'use client';

import {
    Box,
    HStack,
    Input,
    Portal,
    Text,
    VStack,
    Dialog,
    Badge,
} from "@chakra-ui/react";
import { useState, useMemo } from "react";
import { LuSearch } from "react-icons/lu";
import { useRouter } from "next/navigation";
import { useAssets, truncateDenom } from "@bze/bze-ui-kit";
import {AssetLogo} from "@/components/ui/asset_logo";

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
        <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && handleClose()}>
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content
                        maxW={{ base: "90vw", md: "500px" }}
                        borderRadius="2xl"
                    >
                        <Dialog.Header>
                            <Dialog.Title fontSize="xl" fontWeight="black">
                                🔍 Search Coins
                            </Dialog.Title>
                        </Dialog.Header>

                        <Dialog.Body>
                            <VStack gap="4" align="stretch">
                                {/* Search Input */}
                                <Box position="relative">
                                    <Input
                                        size="lg"
                                        placeholder="Search by name or ticker..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        pl="12"
                                    />
                                    <Box
                                        position="absolute"
                                        left="4"
                                        top="50%"
                                        transform="translateY(-50%)"
                                        color="fg.muted"
                                    >
                                        <LuSearch size="20" />
                                    </Box>
                                </Box>

                                {/* Coins List */}
                                <Box
                                    maxH="400px"
                                    overflowY="auto"
                                    borderRadius="lg"
                                >
                                    {isLoading ? (
                                        <Box p="8" textAlign="center">
                                            <Text fontSize="md" color="fg.muted">
                                                Loading coins...
                                            </Text>
                                        </Box>
                                    ) : filteredCoins.length > 0 ? (
                                        <VStack gap="0" align="stretch">
                                            {filteredCoins.map((coin, idx) => {
                                                return (
                                                    <Box
                                                        key={coin.denom}
                                                        p="4"
                                                        cursor="pointer"
                                                        borderBottomWidth={idx < filteredCoins.length - 1 ? "1px" : "0"}
                                                        borderColor="border"
                                                        _hover={{
                                                            bg: "orange.50",
                                                            _dark: { bg: "gray.800" }
                                                        }}
                                                        transition="all 0.2s"
                                                        onClick={() => handleCoinClick(coin.denom)}
                                                    >
                                                        <HStack gap="3">
                                                            <Box
                                                                p="1"
                                                                borderRadius="full"
                                                            >
                                                                <AssetLogo asset={coin} size="40px" />
                                                            </Box>
                                                            <VStack gap="0" align="start" flex="1">
                                                                <HStack gap="2">
                                                                    <Text fontWeight="bold" fontSize="md">
                                                                        {coin.ticker}
                                                                    </Text>
                                                                    {coin.verified && (
                                                                        <Badge colorPalette="green" size="xs" variant="solid">
                                                                            ✓
                                                                        </Badge>
                                                                    )}
                                                                </HStack>
                                                                <Text fontSize="sm" color="fg.muted">
                                                                    {coin.name}
                                                                </Text>
                                                                <Text fontSize="xs" color="fg.muted">
                                                                    {truncateDenom(coin.denom)}
                                                                </Text>
                                                            </VStack>
                                                        </HStack>
                                                    </Box>
                                                );
                                            })}
                                        </VStack>
                                    ) : (
                                        <Box p="8" textAlign="center">
                                            <Text fontSize="lg" fontWeight="bold" color="fg.muted" mb="2">
                                                🤷 No coins found
                                            </Text>
                                            <Text fontSize="sm" color="fg.muted">
                                                Try a different search term
                                            </Text>
                                        </Box>
                                    )}
                                </Box>

                                {/* Results count */}
                                {searchQuery && (
                                    <Text fontSize="sm" color="fg.muted" textAlign="center">
                                        Found {filteredCoins.length} coin{filteredCoins.length !== 1 ? 's' : ''}
                                    </Text>
                                )}
                            </VStack>
                        </Dialog.Body>

                        <Dialog.CloseTrigger />
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    );
};
