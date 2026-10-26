import {Box, Button, chakra, Flex, type FlexProps} from "@chakra-ui/react";
import {HighlightText, sanitizeNumberInput} from "@bze/bze-ui-kit";
import {LuInfo} from "react-icons/lu";
import BigNumber from "bignumber.js";
import {type ComponentProps, type ReactNode, useId} from "react";

// The pieces of the order-book market page: its cards, the book rows, the order forms and
// the small tables. Trade sides use the data colours (buy green, sell red), never the app colour.

export type TradeSide = 'buy' | 'sell';

const sideColor = (side: TradeSide) => (side === 'buy' ? 'hg.up' : 'hg.down');

/** A card of the market page, named for screen readers. */
export const Panel = ({label, children, ...props}: FlexProps & { label: string }) => (
    <Flex
        as="section"
        aria-label={label}
        direction="column"
        bg="hg.card"
        borderWidth="1px"
        borderColor="hg.hairline"
        borderRadius="18px"
        minW="0"
        {...props}
    >
        {children}
    </Flex>
);

/** One of the 24h figures in the market header. */
export const MarketStat = ({label, color, usd, last, children}: {
    label: string;
    color?: string;
    usd?: string;
    last?: boolean;
    children: ReactNode;
}) => (
    <Flex
        direction="column"
        gap="4px"
        pl="22px"
        pr={last ? '0' : '22px'}
        borderRightWidth={last ? '0' : '1px'}
        borderColor="hg.hairline"
    >
        <chakra.span fontSize="12px" color="hg.text.faint">{label}</chakra.span>
        <HighlightText fontSize="16px" fontWeight="700" color={color}>{children}</HighlightText>
        {usd !== undefined && (
            <HighlightText fontSize="12px" color="hg.text.faint">${usd}</HighlightText>
        )}
    </Flex>
);

/** A row's share of the largest order on its side, for the depth bar. */
export const depthPercent = (amount: BigNumber.Value, max: BigNumber.Value): number => {
    const top = new BigNumber(max);
    if (!top.gt(0)) return 0;
    return Math.min(100, new BigNumber(amount).dividedBy(top).multipliedBy(100).toNumber());
};

/** A row of the order book; a click fills both forms with its price and the amount up to it. */
export const OrderBookRow = ({side, price, amount, depth, onClick}: {
    side: TradeSide;
    price: string;
    amount: string;
    depth: number;
    onClick: () => void;
}) => (
    <chakra.button
        type="button"
        position="relative"
        display="flex"
        justifyContent="space-between"
        gap="8px"
        px="8px"
        py="4px"
        border="0"
        borderRadius="6px"
        bg="transparent"
        fontFamily="mono"
        fontSize="12px"
        fontWeight="500"
        color="fg"
        cursor="pointer"
        overflow="hidden"
        _hover={{bg: 'hg.hoverFill'}}
        focusVisibleRing="inside"
        onClick={onClick}
        data-side={side}
    >
        <Box aria-hidden position="absolute" top="0" bottom="0" right="0" w={`${depth}%`} bg={`${sideColor(side)}/12`} pointerEvents="none"/>
        <chakra.span position="relative" color={sideColor(side)}>{price}</chakra.span>
        <HighlightText as="span" position="relative" fontSize="12px">{amount}</HighlightText>
    </chakra.button>
);

/** The centred grey line of an empty list. */
export const EmptyState = ({children}: { children: ReactNode }) => (
    <chakra.p m="0" py="18px" textAlign="center" fontSize="13px" color="hg.text.faint">{children}</chakra.p>
);

/** A compact table with small grey headers; the first column is left-aligned, the rest right. */
export const DataTable = ({headers, children}: { headers: ReactNode[]; children: ReactNode }) => (
    <chakra.table w="100%" borderCollapse="collapse" fontSize="12px">
        <chakra.thead position="sticky" top="0" bg="hg.card" zIndex="1">
            <chakra.tr color="hg.text.faint">
                {headers.map((header, i) => (
                    <chakra.th key={i} textAlign={i === 0 ? 'left' : 'right'} fontWeight="600" px="4px" py="6px">
                        {header}
                    </chakra.th>
                ))}
            </chakra.tr>
        </chakra.thead>
        <chakra.tbody>{children}</chakra.tbody>
    </chakra.table>
);

export const Cell = ({mono, right, color, children}: { mono?: boolean; right?: boolean; color?: string; children: ReactNode }) => (
    <chakra.td
        px="4px"
        py="7px"
        textAlign={right ? 'right' : 'left'}
        fontFamily={mono ? 'mono' : undefined}
        color={color}
    >
        {children}
    </chakra.td>
);

export const EmptyTableRow = ({colSpan, message}: { colSpan: number; message: string }) => (
    <chakra.tr>
        <chakra.td colSpan={colSpan}><EmptyState>{message}</EmptyState></chakra.td>
    </chakra.tr>
);

/** A Buy or Sell form: its title and button in the side colour, the fields, the multi-fill hint. */
export const OrderForm = ({side, title, fillMessage, disabled, onSubmit, children}: {
    side: TradeSide;
    title: string;
    fillMessage?: string;
    disabled?: boolean;
    onSubmit: () => void;
    children: ReactNode;
}) => {
    const color = sideColor(side);

    return (
        <Panel label={title} p="16px" gap="12px" role="group">
            <chakra.strong fontSize="15px" fontWeight="700" color={color}>{title}</chakra.strong>
            {children}
            {fillMessage && (
                <Flex gap="8px" align="flex-start" px="12px" py="10px" borderRadius="12px" bg="hg.inset" fontSize="12px" color="hg.text.muted">
                    <Box as="span" flex="none" mt="1px" color="hg.text.faint"><LuInfo size={14} aria-hidden="true"/></Box>
                    {fillMessage}
                </Flex>
            )}
            <Button
                variant="outline"
                h="44px"
                borderRadius="12px"
                fontSize="15px"
                fontWeight="700"
                color={color}
                borderColor={`${color}/45`}
                bg={`${color}/8`}
                _hover={{bg: `${color}/16`}}
                disabled={disabled}
                onClick={onSubmit}
            >
                {title}
            </Button>
        </Panel>
    );
};

/** A labelled number field of an order form, with its unit inside on the right. */
export const OrderField = ({label, unit, value, onChange, disabled, usd}: {
    label: string;
    unit?: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    usd?: string;
}) => {
    const id = useId();

    return (
        <Flex direction="column" gap="6px">
            <chakra.label htmlFor={id} fontSize="12px" color="hg.text.faint">{label}</chakra.label>
            <Flex
                align="center"
                h="42px"
                px="12px"
                gap="8px"
                borderRadius="10px"
                bg="hg.inset"
                borderWidth="1px"
                borderColor="hg.hairline"
                _focusWithin={{borderColor: 'app.focusRing'}}
                opacity={disabled ? 0.6 : 1}
            >
                <chakra.input
                    id={id}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0.00000"
                    flex="1"
                    minW="0"
                    bg="transparent"
                    border="0"
                    outline="none"
                    color="fg"
                    fontFamily="mono"
                    fontSize="14px"
                    fontWeight="500"
                    _placeholder={{color: 'hg.text.faint'}}
                    value={value}
                    onChange={(e) => onChange(sanitizeNumberInput(e.target.value))}
                    disabled={disabled}
                />
                <chakra.span flex="none" fontSize="12px" color="hg.text.faint">{unit}</chakra.span>
            </Flex>
            {usd !== undefined && (
                <chakra.span fontSize="12px" color="hg.text.faint">≈ ${usd}</chakra.span>
            )}
        </Flex>
    );
};

/** A balance line; a click puts the spendable balance into both forms. */
export const BalanceButton = ({ticker, children, ...props}: ComponentProps<typeof chakra.button> & { ticker?: string }) => (
    <chakra.button
        type="button"
        display="flex"
        justifyContent="space-between"
        gap="12px"
        px="10px"
        py="9px"
        border="0"
        borderRadius="10px"
        bg="transparent"
        color="fg"
        fontSize="13px"
        fontWeight="500"
        cursor="pointer"
        _hover={{bg: 'hg.inset'}}
        _disabled={{cursor: 'not-allowed', opacity: 0.6, bg: 'transparent'}}
        focusVisibleRing="inside"
        {...props}
    >
        <chakra.span color="hg.text.muted">{ticker}</chakra.span>
        <HighlightText as="span" fontFamily="mono" fontSize="13px">{children}</HighlightText>
    </chakra.button>
);
