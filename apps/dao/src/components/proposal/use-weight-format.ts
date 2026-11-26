import {useCallback} from 'react';
import {useCoinFormat} from '@/components/dao/page/use-coin-format';

/**
 * Voting weights for people. A stake DAO counts them in its staking denom ("1,200 BZE"); a static list
 * counts one vote per member, so they are plain numbers; a stake DAO whose denom is unknown shows the raw amount.
 */
export function useWeightFormat(weightDenom: string | null): (amount: string) => string {
    const coins = useCoinFormat();
    return useCallback((amount: string) => (weightDenom ? coins.format({denom: weightDenom, amount}) : amount), [coins, weightDenom]);
}
