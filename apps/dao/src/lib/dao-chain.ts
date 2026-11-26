import {
    getDaos, getDaosByAdmin, getDenomRewardParticipations, getStakingRewardParticipantByAddress, isDaoModuleSupported,
} from '@bze/bze-ui-kit';
import {createDaoScanClient, browserScanGetter} from './dao-scan';
import type {DaoChain, DaoDeps} from './dao-loader';

/** The chain side of the loaders: ui-kit's x/dao and x/rewards queries. */
export const liveDaoChain: DaoChain = {
    isSupported: isDaoModuleSupported,
    getDaos,
    getDaosByAdmin,
    stakingRewardParticipations: async (address) => (await getStakingRewardParticipantByAddress(address)).list,
    denomRewardParticipations: getDenomRewardParticipations,
};

/** The app's real collaborators, built once (the composition root of the home page). */
export const liveDaoDeps: DaoDeps = {
    scan: createDaoScanClient(browserScanGetter),
    chain: liveDaoChain,
};
