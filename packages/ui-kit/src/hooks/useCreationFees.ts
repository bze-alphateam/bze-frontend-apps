import { useEffect, useState } from 'react';
import { getTokenFactoryParams } from '../query/tokenfactory_params';
import { getTradebinParams } from '../query/tradebin_params';
import { getRewardsParams } from '../query/rewards_params';
import { FeeCoin } from '../types/fees';

export interface CreationFees {
    // MsgCreateDenom (tokenfactory params)
    createDenomFee?: FeeCoin;
    // MsgCreateMarket AND MsgCreateLiquidityPool (tradebin params — chain charges the same fee)
    createMarketFee?: FeeCoin;
    // MsgCreateStakingReward (rewards params)
    createStakingRewardFee?: FeeCoin;
    // MsgCreateTradingReward (rewards params)
    createTradingRewardFee?: FeeCoin;
}

/**
 * Runtime creation fees read from chain module params (never hardcoded — all four
 * are governance params and can change). Each undefined field means its params
 * query failed; consumers should treat that as "fee unknown", not "free".
 */
export function useCreationFees() {
    const [fees, setFees] = useState<CreationFees>({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        Promise.all([getTokenFactoryParams(), getTradebinParams(), getRewardsParams()])
            .then(([tokenFactory, tradebin, rewards]) => {
                if (cancelled) return;
                setFees({
                    createDenomFee: tokenFactory?.createDenomFee,
                    createMarketFee: tradebin?.createMarketFee,
                    createStakingRewardFee: rewards?.createStakingRewardFee,
                    createTradingRewardFee: rewards?.createTradingRewardFee,
                });
                setIsLoading(false);
            });

        return () => { cancelled = true; };
    }, []);

    return { fees, isLoading };
}
