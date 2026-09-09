import { useEffect, useState } from 'react';
import { getTradebinParams } from '../query/tradebin_params';
import { FeeCoin } from '../types/fees';

export interface TradingFees {
    // Charged when an order rests in the order book and is filled later.
    makerFee?: FeeCoin;
    // Charged when an order executes immediately (market order, matching existing
    // orders) — and by every AMM swap.
    takerFee?: FeeCoin;
}

/**
 * Runtime trading fees read from the tradebin module params (governance params —
 * never hardcode them). An undefined field means the params query failed; consumers
 * should treat that as "fee unknown", not "free".
 */
export function useTradingFees() {
    const [fees, setFees] = useState<TradingFees>({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        getTradebinParams().then((params) => {
            if (cancelled) return;
            setFees({
                makerFee: params?.marketMakerFee,
                takerFee: params?.marketTakerFee,
            });
            setIsLoading(false);
        });

        return () => { cancelled = true; };
    }, []);

    return { fees, isLoading };
}
