import {Box, Button, Flex, HStack, Text} from "@chakra-ui/react";
import {LuChevronLeft, LuChevronRight} from "react-icons/lu";

import {paginationItems} from "@/lib/token-directory";

interface DirectoryPaginationProps {
    page: number;
    totalPages: number;
    onChange: (page: number) => void;
}

/**
 * Desktop: "Page X of Y" plus Previous, numbered pages and Next. Phone: Previous · "Page X of Y"
 * · Next. Hidden when everything fits on one page.
 */
export function DirectoryPagination({page, totalPages, onChange}: DirectoryPaginationProps) {
    if (totalPages <= 1) return null;

    const label = `Page ${page} of ${totalPages}`;
    const prev = () => onChange(Math.max(1, page - 1));
    const next = () => onChange(Math.min(totalPages, page + 1));

    return (
        <Box as="nav" aria-label="Pagination" pt="8px">
            <Flex hideBelow="md" wrap="wrap" justify="space-between" align="center" gap="3">
                <Text fontSize="13px" color="hg.text.faint">{label}</Text>
                <HStack gap="6px">
                    <Button variant="secondary" size="md" disabled={page <= 1} onClick={prev}>
                        <LuChevronLeft/>Previous
                    </Button>
                    {paginationItems(page, totalPages).map((item, i) => item === "gap" ? (
                        <Text key={`gap-${i}`} px="4px" color="hg.text.faint" aria-hidden>…</Text>
                    ) : (
                        <Button
                            key={item}
                            size="md"
                            minW="40px"
                            borderRadius="hg.md"
                            variant="ghost"
                            fontWeight={item === page ? "700" : "500"}
                            color={item === page ? "fg" : "fg.muted"}
                            bg={item === page ? "app.subtle" : undefined}
                            borderWidth="1px"
                            borderColor={item === page ? "app.border" : "transparent"}
                            aria-current={item === page ? "page" : undefined}
                            aria-label={`Page ${item}`}
                            onClick={() => onChange(item)}
                        >
                            {item}
                        </Button>
                    ))}
                    <Button variant="secondary" size="md" disabled={page >= totalPages} onClick={next}>
                        Next<LuChevronRight/>
                    </Button>
                </HStack>
            </Flex>

            <Flex hideFrom="md" justify="space-between" align="center" gap="8px">
                <Button variant="secondary" minH="44px" aria-label="Previous page" disabled={page <= 1} onClick={prev}>
                    <LuChevronLeft/>Prev
                </Button>
                <Text fontSize="14px" fontWeight="600">{label}</Text>
                <Button variant="secondary" minH="44px" aria-label="Next page" disabled={page >= totalPages} onClick={next}>
                    Next<LuChevronRight/>
                </Button>
            </Flex>
        </Box>
    );
}
