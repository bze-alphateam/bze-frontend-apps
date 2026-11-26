import {
    DaoModuleNotSupportedError,
    getAddressBalances, getDao, getDaoByAddress, getDaoController, getDaoParams, getDaoProposals, getDaoVotingPower,
    getDaos, getDaosByAdmin, getDenomReward, getDenomRewardParticipations, getRestClient,
    getStakingRewardParticipantByAddress, isDaoModuleSupported,
} from '@bze/bze-ui-kit';
import {createDaoScanClient, browserScanGetter} from './dao-scan';
import {createDaoPageScan} from './dao-page-scan';
import type {DaoChain, DaoDeps} from './dao-loader';
import {DaoModuleUnsupported, type DaoViewChain, type DaoViewDeps} from './dao-view-loader';
import type {StakeSource} from './dao-voters';

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

const OPEN_PROPOSALS_LIMIT = 50;

/** The chain side of the DAO page. */
export const liveDaoViewChain: DaoViewChain = {
    async getDao(id) {
        try {
            return await getDao(id);
        } catch (e) {
            if (e instanceof DaoModuleNotSupportedError) throw new DaoModuleUnsupported();
            throw e;
        }
    },
    getParams: getDaoParams,
    getController: getDaoController,
    getDaoByAddress,
    getBalances: async (address) => (await getAddressBalances(address)).map((c) => ({denom: c.denom, amount: c.amount})),
    getOpenProposals: async (id) => (await getDaoProposals(id, ['VOTING'], {limit: OPEN_PROPOSALS_LIMIT})).items,
    async getStakeSources(electorate) {
        const client = await getRestClient();
        const sources: StakeSource[] = await Promise.all(electorate.sr_ids.map(async (rewardId): Promise<StakeSource> => {
            // The by-id read is made here (not through ui-kit's list helper) so a failure is thrown, not an empty list.
            const {staking_reward: reward} = await client.bze.rewards.stakingReward({rewardId});
            return {kind: 'sr', id: rewardId, stakingDenom: reward.staking_denom, lockDays: Number(reward.lock), staked: String(reward.staked_amount)};
        }));
        if (electorate.dr_denom) {
            const reward = await getDenomReward(electorate.dr_denom);
            if (!reward) throw new Error(`the Denom Reward of ${electorate.dr_denom} was not found`);
            sources.push({kind: 'dr', stakingDenom: reward.staking_denom, lockDays: Number(reward.lock), staked: String(reward.staked_amount)});
        }
        return sources;
    },
    getVotingPower: getDaoVotingPower,
};

/** The app's real collaborators for the DAO page. */
export const liveDaoViewDeps: DaoViewDeps = {
    chain: liveDaoViewChain,
    scan: createDaoPageScan(browserScanGetter),
};
