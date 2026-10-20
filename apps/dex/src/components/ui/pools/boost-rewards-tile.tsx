import React from "react";
import {HighlightText, PrettyBalance} from "@bze/bze-ui-kit";
import {TYPE_REWARDS} from "@/components/ui/staking/rewards-staking-alerts";
import {RewardsStakingButton} from "@/components/ui/staking/rewards-staking-buttons";
import {InsetTile} from "@/components/ui/pools/pool-parts";

interface BoostRewardsTileProps {
    rewards: PrettyBalance[];
    usdValue: string;
    onClaim: () => void;
}

// Claim shows only when a pending reward is above zero: the USD value can read $0 for an unpriced token.
export const BoostRewardsTile = ({rewards, usdValue, onClaim}: BoostRewardsTileProps) => {
    const hasPendingRewards = rewards.some(reward => reward.amount.gt(0));

    return (
        <InsetTile label="Boost Rewards" align="start">
            <HighlightText fontSize="18px" fontWeight="700" color="hg.link">${usdValue}</HighlightText>
            {hasPendingRewards && (
                <RewardsStakingButton buttonType={TYPE_REWARDS} flex={0} onClick={onClaim}>
                    Claim
                </RewardsStakingButton>
            )}
        </InsetTile>
    );
};
