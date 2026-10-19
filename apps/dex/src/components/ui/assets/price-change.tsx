import {Flex} from "@chakra-ui/react";
import {LuArrowDownRight, LuArrowUpRight} from "react-icons/lu";

/** A 24h price change: green up, red down, muted at 0 %. */
export const PriceChange = ({change, fontSize = '12px'}: { change: number; fontSize?: string }) => (
    <Flex
        as="span"
        align="center"
        justify="flex-end"
        gap="2px"
        fontSize={fontSize}
        color={change > 0 ? 'hg.up' : change < 0 ? 'hg.down' : 'hg.flat'}
        data-testid="price-change"
    >
        {change > 0 && <LuArrowUpRight size={13} aria-hidden="true"/>}
        {change < 0 && <LuArrowDownRight size={13} aria-hidden="true"/>}
        {change > 0 ? `+${change}` : change}%
    </Flex>
);
