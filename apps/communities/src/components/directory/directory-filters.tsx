import {Button, Flex} from "@chakra-ui/react";

import type {DirectoryFilter} from "@/lib/token-directory";

const FILTER_LABELS: Record<DirectoryFilter, string> = {
    all: "All",
    verified: "Verified",
    rewards: "Staking rewards",
    tradable: "Tradable",
};

interface DirectoryFiltersProps {
    value: DirectoryFilter;
    onChange: (filter: DirectoryFilter) => void;
}

/** Single-choice filter pills; they wrap onto more rows on narrow screens, never scroll sideways. */
export function DirectoryFilters({value, onChange}: DirectoryFiltersProps) {
    return (
        <Flex role="group" aria-label="Filters" wrap="wrap" gap="2">
            {(Object.keys(FILTER_LABELS) as DirectoryFilter[]).map((filter) => {
                const on = filter === value;
                return (
                    <Button
                        key={filter}
                        size="sm"
                        borderRadius="full"
                        variant={on ? "subtle" : "outline"}
                        colorPalette={on ? "green" : "gray"}
                        bg={on ? undefined : "bg.panel"}
                        aria-pressed={on}
                        onClick={() => onChange(filter)}
                    >
                        {FILTER_LABELS[filter]}
                    </Button>
                );
            })}
        </Flex>
    );
}
