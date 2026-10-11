import {Button, Input, InputGroup} from "@chakra-ui/react";
import {LuSearch} from "react-icons/lu";

interface DirectorySearchProps {
    value: string;
    onChange: (value: string) => void;
    onClear: () => void;
}

/** The search box over name, ticker and denom, with a Clear button while it holds text. */
export function DirectorySearch({value, onChange, onClear}: DirectorySearchProps) {
    return (
        <InputGroup
            flex="999 1 420px"
            startElement={<LuSearch size={18}/>}
            endElement={value !== "" ? (
                <Button size="xs" variant="subtle" onClick={onClear}>Clear</Button>
            ) : undefined}
            endElementProps={{pointerEvents: "auto"}}
        >
            <Input
                type="search"
                aria-label="Search tokens"
                placeholder="Search by name, ticker or denom"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                size="lg"
                bg="bg.panel"
                fontSize="md"
            />
        </InputGroup>
    );
}
