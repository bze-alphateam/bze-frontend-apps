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
    // MsgCreateDenomReward (rewards params, chain v8.2.0)
    createDenomRewardFee?: FeeCoin;
    // Once per prize denom new to a denom reward (rewards params, chain v8.2.0)
    createDenomRewardPrizeFee?: FeeCoin;
    // MsgCreateDenomRewardSchedule, flat on top of the escrow (rewards params, chain v8.2.0)
    addDenomRewardScheduleFee?: FeeCoin;
}

/** The non-fee Denom Rewards params (chain v8.2.0); each field undefined when unknown. */
export interface DenomRewardLimits {
    /** Distinct prize denoms one denom reward may ever have. */
    maxPrizeDenomsPerDr?: number;
    /** Lock in days a denom reward created now will snapshot. */
    denomRewardLock?: number;
    /** Min stake (staking denom base units) a denom reward created now will snapshot. */
    denomRewardMinStake?: string;
    /** Extra gas the chain charges every MsgExitDenomReward. */
    extraGasForDenomExit?: string;
}

/**
 * Runtime creation fees read from chain module params (never hardcoded — all of them
 * are governance params and can change), plus the Denom Rewards limits that come from
 * the same rewards params query. Each undefined field means its params
 * query failed; consumers should treat that as "fee unknown", not "free".
 */
export function useCreationFees() {
    const [fees, setFees] = useState<CreationFees>({});
    const [denomRewardLimits, setDenomRewardLimits] = useState<DenomRewardLimits>({});
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
                    createDenomRewardFee: rewards?.createDenomRewardFee,
                    createDenomRewardPrizeFee: rewards?.createDenomRewardPrizeFee,
                    addDenomRewardScheduleFee: rewards?.addDenomRewardScheduleFee,
                });
                setDenomRewardLimits({
                    maxPrizeDenomsPerDr: rewards?.maxPrizeDenomsPerDr,
                    denomRewardLock: rewards?.denomRewardLock,
                    denomRewardMinStake: rewards?.denomRewardMinStake,
                    extraGasForDenomExit: rewards?.extraGasForDenomExit,
                });
                setIsLoading(false);
            });

        return () => { cancelled = true; };
    }, []);

    return { fees, denomRewardLimits, isLoading };
}
