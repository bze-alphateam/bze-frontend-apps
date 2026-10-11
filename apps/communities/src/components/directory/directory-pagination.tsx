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
        <Box as="nav" aria-label="Pagination" pt="2">
            <Flex hideBelow="md" wrap="wrap" justify="space-between" align="center" gap="3">
                <Text fontSize="sm" color="fg.muted">{label}</Text>
                <HStack gap="1.5">
                    <Button variant="outline" size="md" disabled={page <= 1} onClick={prev}>
                        <LuChevronLeft/>Previous
                    </Button>
                    {paginationItems(page, totalPages).map((item, i) => item === "gap" ? (
                        <Text key={`gap-${i}`} px="1" color="fg.muted" aria-hidden>…</Text>
                    ) : (
                        <Button
                            key={item}
                            size="md"
                            minW="10"
                            variant={item === page ? "subtle" : "ghost"}
                            colorPalette={item === page ? "green" : "gray"}
                            aria-current={item === page ? "page" : undefined}
                            aria-label={`Page ${item}`}
                            onClick={() => onChange(item)}
                        >
                            {item}
                        </Button>
                    ))}
                    <Button variant="outline" size="md" disabled={page >= totalPages} onClick={next}>
                        Next<LuChevronRight/>
                    </Button>
                </HStack>
            </Flex>

            <Flex hideFrom="md" justify="space-between" align="center" gap="2">
                <Button variant="outline" minH="11" aria-label="Previous page" disabled={page <= 1} onClick={prev}>
                    <LuChevronLeft/>Prev
                </Button>
                <Text fontSize="sm" fontWeight="semibold">{label}</Text>
                <Button variant="outline" minH="11" aria-label="Next page" disabled={page >= totalPages} onClick={next}>
                    Next<LuChevronRight/>
                </Button>
            </Flex>
        </Box>
    );
}
