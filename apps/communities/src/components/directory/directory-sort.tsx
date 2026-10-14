import {NativeSelect} from "@chakra-ui/react";

import {DIRECTORY_SORTS, type DirectorySort as SortValue} from "@/lib/token-directory";

const SORT_LABELS: Record<SortValue, string> = {
    name: "Sort: Name A–Z",
    cap: "Sort: Market cap",
    vol: "Sort: 24h volume",
};

interface DirectorySortProps {
    value: SortValue;
    onChange: (sort: SortValue) => void;
}

export function DirectorySort({value, onChange}: DirectorySortProps) {
    return (
        <NativeSelect.Root size="lg" flex="1 1 200px">
            <NativeSelect.Field
                aria-label="Sort tokens"
                value={value}
                onChange={(e) => onChange(e.target.value as SortValue)}
                bg="bg.panel"
                fontSize="sm"
            >
                {DIRECTORY_SORTS.map((sort) => (
                    <option key={sort} value={sort}>{SORT_LABELS[sort]}</option>
                ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator/>
        </NativeSelect.Root>
    );
}
