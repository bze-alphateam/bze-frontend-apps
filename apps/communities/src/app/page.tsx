'use client';

import React, {useMemo, useState} from "react";
import {Box, Button, Container, HStack, Skeleton, Stack, Text, VStack} from "@chakra-ui/react";
import {LuChevronLeft, LuChevronRight, LuInbox} from "react-icons/lu";

import {useCommunitiesContext} from "@/hooks/useCommunitiesContext";
import {TokenCard} from "@/components/ui/tokens/token-card";
import {filterAndSortFactoryTokens, getTotalPages, pageSlice} from "@/lib/token-directory";

export default function Home() {
    const {assetsMap, isLoading} = useCommunitiesContext();
    const [page, setPage] = useState(1);

    // Every factory token, alphabetical by ticker (see token-directory helper).
    const tokens = useMemo(
        () => filterAndSortFactoryTokens(Array.from(assetsMap.values())),
        [assetsMap],
    );

    const totalPages = getTotalPages(tokens.length);

    // Keep the current page in range when the token list shrinks (state-during-render
    // pattern — React re-renders immediately, no cascading-effect warning).
    if (page > totalPages) {
        setPage(totalPages);
    }

    const pageTokens = useMemo(() => pageSlice(tokens, page), [tokens, page]);

    return (
        <Box minH="100vh" bg="bg.subtle">
            <Container maxW="4xl" py={{base: 8, md: 12}}>
                <VStack align="stretch" gap="8">
                    <VStack gap={3} align="center" textAlign="center">
                        <Text fontSize="3xl" fontWeight="bold" letterSpacing="tight">
                            Token directory
                        </Text>
                        <Text fontSize="md" color="fg.muted" maxW="2xl">
                            Every token created on BeeZee&apos;s Token Factory. Pick one to open its
                            dedicated page — supply, staking rewards, burns, and a built-in way to get it.
                        </Text>
                    </VStack>

                    {isLoading ? (
                        <VStack align="stretch" gap={3}>
                            {Array.from({length: 6}).map((_, i) => (
                                <Skeleton key={i} height="72px" borderRadius="lg"/>
                            ))}
                        </VStack>
                    ) : tokens.length === 0 ? (
                        <VStack gap={3} align="center" py={16} color="fg.muted">
                            <LuInbox size={40}/>
                            <Text fontSize="lg" fontWeight="medium">No tokens yet</Text>
                            <Text fontSize="sm" maxW="md" textAlign="center">
                                No tokens have been created on the Token Factory yet. Check back soon.
                            </Text>
                        </VStack>
                    ) : (
                        <>
                            <VStack align="stretch" gap={3}>
                                {pageTokens.map((asset) => (
                                    <TokenCard key={asset.denom} asset={asset}/>
                                ))}
                            </VStack>

                            {totalPages > 1 && (
                                <Stack
                                    direction={{base: "column", sm: "row"}}
                                    justify="space-between"
                                    align="center"
                                    gap={3}
                                >
                                    <Text fontSize="sm" color="fg.muted">
                                        Page {page} of {totalPages} · {tokens.length} tokens
                                    </Text>
                                    <HStack gap={2}>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            colorPalette="green"
                                            disabled={page <= 1}
                                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        >
                                            <LuChevronLeft/> Previous
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            colorPalette="green"
                                            disabled={page >= totalPages}
                                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                        >
                                            Next <LuChevronRight/>
                                        </Button>
                                    </HStack>
                                </Stack>
                            )}
                        </>
                    )}
                </VStack>
            </Container>
        </Box>
    );
}
