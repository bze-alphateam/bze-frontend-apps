import {Badge, chakra} from "@chakra-ui/react";
import {hgVariant, ORDER_TYPE_BUY} from "@bze/bze-ui-kit";
import BigNumber from "bignumber.js";

export type PriceImpactTone = 'success' | 'warning' | 'danger';

/** Green up to 0.5 %, amber above 0.5 %, red above 1 %. */
export const priceImpactTone = (percent: BigNumber.Value): PriceImpactTone => {
    const value = new BigNumber(percent);
    if (value.gt(1)) return 'danger';
    if (value.gt(0.5)) return 'warning';
    return 'success';
};

/** A swap's price impact in percent, in its tone. */
export const PriceImpactBadge = ({percent}: { percent: BigNumber.Value }) => {
    const tone = priceImpactTone(percent);

    return (
        <Badge variant={hgVariant(tone)} data-testid="price-impact" data-tone={tone}>
            {new BigNumber(percent).toFixed(2)}%
        </Badge>
    );
};

/** A 24h change in percent on a soft pill: green up, red down, grey flat. */
export const ChangePill = ({change}: { change?: number }) => {
    const value = change ?? 0;
    const direction = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
    const color = `hg.${direction}`;

    return (
        <chakra.span
            display="inline-block"
            fontSize="12px"
            fontWeight="600"
            lineHeight="1.4"
            px="7px"
            py="2px"
            borderRadius="6px"
            whiteSpace="nowrap"
            color={color}
            bg={`${color}/12`}
            data-testid="change-pill"
            data-direction={direction}
        >
            {value > 0 ? '+' : ''}{value.toFixed(2)}%
        </chakra.span>
    );
};

/** BUY or SELL in the trade-side colours: green for a buy, red for a sell. */
export const SideBadge = ({orderType}: { orderType: string }) => {
    const buy = orderType === ORDER_TYPE_BUY;
    const color = buy ? 'hg.up' : 'hg.down';

    return (
        <chakra.span
            display="inline-block"
            fontSize="10px"
            fontWeight="700"
            letterSpacing="0.06em"
            lineHeight="1.4"
            px="6px"
            py="2px"
            borderRadius="6px"
            color={color}
            bg={`${color}/12`}
            data-testid="side-badge"
            data-side={buy ? 'buy' : 'sell'}
        >
            {buy ? 'BUY' : 'SELL'}
        </chakra.span>
    );
};
