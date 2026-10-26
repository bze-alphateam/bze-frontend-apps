import {chakra, Flex} from "@chakra-ui/react";
import {IconTile} from "@bze/bze-ui-kit";
import type {ReactNode} from "react";

// The DEX has two ways to trade and keeps them apart on every surface: Swap trades against a
// liquidity pool (the AMM, filled gradient tile) and Exchange trades on a market's order book
// (outlined tile).
export type Venue = 'amm' | 'orderbook';

/** A drop: liquidity pools. */
export const AmmIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3c3.5 4 6 7 6 10a6 6 0 0 1-12 0c0-3 2.5-6 6-10z"/>
        <path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>
    </svg>
);

/** Book depth lines: an order book. */
export const OrderBookIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M4 6h10M4 10h14M4 14h8M4 18h12"/>
        <path d="M20 4v16"/>
    </svg>
);

export const VENUE_LABEL: Record<Venue, string> = {
    amm: 'AMM',
    orderbook: 'ORDER BOOK',
};

/** "Liquidity pools · AMM" / "Order book · limit orders". */
export const VENUE_SUBTITLE: Record<Venue, string> = {
    amm: 'Liquidity pools · AMM',
    orderbook: 'Order book · limit orders',
};

interface VenueTagProps {
    venue: Venue;
    /** `sm` for the market header next to the pair name. */
    size?: 'sm' | 'md';
}

/** The AMM tag (soft app tint) or the ORDER BOOK tag (app outline with the book icon). */
export const VenueTag = ({venue, size = 'md'}: VenueTagProps) => {
    const amm = venue === 'amm';

    return (
        <chakra.span
            display="inline-flex"
            alignItems="center"
            gap="6px"
            flex="none"
            fontSize={size === 'sm' ? '10px' : '11px'}
            fontWeight="700"
            letterSpacing="0.08em"
            lineHeight="1"
            px={size === 'sm' ? '6px' : '8px'}
            py={size === 'sm' ? '4px' : '5px'}
            borderRadius="6px"
            color="hg.link"
            data-testid="venue-tag"
            data-venue={venue}
            {...(amm
                ? {bg: 'app.subtle'}
                : {borderWidth: '1px', borderColor: 'app.border'})}
            css={{'& svg': {width: '12px', height: '12px'}}}
        >
            {!amm && size === 'md' && <OrderBookIcon/>}
            {VENUE_LABEL[venue]}
        </chakra.span>
    );
};

/** The venue's icon tile: filled gradient for Swap, outlined for Exchange. */
export const VenueTile = ({venue, size = 44}: { venue: Venue; size?: number }) => (
    <IconTile icon={venue === 'amm' ? <AmmIcon/> : <OrderBookIcon/>} variant={venue === 'amm' ? 'filled' : 'outline'} size={size}/>
);

interface VenueTitleProps {
    venue: Venue;
    title: ReactNode;
    size?: number;
}

/** The tile, the venue's name and its "Liquidity pools · AMM" line. */
export const VenueTitle = ({venue, title, size = 44}: VenueTitleProps) => (
    <Flex align="center" gap="12px" minW="0">
        <VenueTile venue={venue} size={size}/>
        <Flex direction="column" gap="2px" minW="0">
            <chakra.strong fontSize="19px" fontWeight="700" color="fg">{title}</chakra.strong>
            <chakra.span fontSize="13px" color="hg.text.faint">{VENUE_SUBTITLE[venue]}</chakra.span>
        </Flex>
    </Flex>
);
