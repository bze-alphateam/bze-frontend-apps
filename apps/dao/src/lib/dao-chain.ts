import {
    DaoModuleNotSupportedError,
    getAddressBalances, getDao, getDaoBallot, getDaoBallots, getDaoProposal, getDaoByAddress, getDaoController, getDaoParams, getDaoProposals, getDaoVotingPower,
    getDaos, getDaosByAdmin, getDenomReward, getDenomRewardParticipations, getRestClient,
    getStakingRewardParticipantByAddress, isDaoModuleSupported,
} from '@bze/bze-ui-kit';
import {createDaoScanClient, browserScanGetter} from './dao-scan';
import {createDaoPageScan} from './dao-page-scan';
import {createDaoProposalScan} from './dao-proposal-scan';
import type {ProposalChain, ProposalDeps} from './proposal-loader';
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
    async getStakeSources(electorate, daoAddress) {
        const client = await getRestClient();
        // What the DAO's own account stakes in its sources never votes, so it is read to be left out of the total.
        const [ownSr, ownDr] = await Promise.all([
            electorate.sr_ids.length > 0 ? getStakingRewardParticipantByAddress(daoAddress) : Promise.resolve({list: []}),
            electorate.dr_denom ? getDenomRewardParticipations(daoAddress) : Promise.resolve([]),
        ]);
        const sources: StakeSource[] = await Promise.all(electorate.sr_ids.map(async (rewardId): Promise<StakeSource> => {
            // The by-id read is made here (not through ui-kit's list helper) so a failure is thrown, not an empty list.
            const {staking_reward: reward} = await client.bze.rewards.stakingReward({rewardId});
            return {kind: 'sr', id: rewardId, stakingDenom: reward.staking_denom, lockDays: Number(reward.lock), staked: String(reward.staked_amount), own: String(ownSr.list.find((p) => p.reward_id === rewardId)?.amount ?? '0')};
        }));
        if (electorate.dr_denom) {
            const reward = await getDenomReward(electorate.dr_denom);
            if (!reward) throw new Error(`the Denom Reward of ${electorate.dr_denom} was not found`);
            sources.push({kind: 'dr', stakingDenom: reward.staking_denom, lockDays: Number(reward.lock), staked: String(reward.staked_amount), own: String(ownDr.find((p) => p.staking_denom === electorate.dr_denom)?.amount ?? '0')});
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

/** The chain side of the proposal pages. */
export const liveProposalChain: ProposalChain = {
    async getProposal(id) {
        try {
            return await getDaoProposal(id);
        } catch (e) {
            if (e instanceof DaoModuleNotSupportedError) throw new DaoModuleUnsupported();
            throw e;
        }
    },
    getDao,
    getParams: getDaoParams,
    getBallot: getDaoBallot,
    getBallots: getDaoBallots,
    getVotingPower: getDaoVotingPower,
    getDaoProposals,
    async getStakingDenom(electorate) {
        if (electorate.dr_denom) return electorate.dr_denom;
        const [rewardId] = electorate.sr_ids;
        if (!rewardId) return null;
        const client = await getRestClient();
        const {staking_reward: reward} = await client.bze.rewards.stakingReward({rewardId});
        return reward.staking_denom;
    },
};

/** The app's real collaborators for the proposal pages. */
export const liveProposalDeps: ProposalDeps = {
    chain: liveProposalChain,
    scan: createDaoProposalScan(browserScanGetter),
};
