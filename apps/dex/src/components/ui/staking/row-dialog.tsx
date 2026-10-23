import {NativeStakingDialog} from "@/components/ui/staking/native-staking";
import {RewardsStakingActionModal} from "@/components/ui/staking/rewards-staking-modals";
import {DenomRewardActionModal} from "@/components/ui/staking/denom-reward-modals";
import type {StakingRow} from "@/lib/staking-list";

/** The step a reward's dialog opens on; `manage` is its overview with every action. */
export type RowDialogView = 'manage' | 'stake' | 'unstake' | 'claim';

interface RowDialogProps {
    row: StakingRow;
    view: RowDialogView;
    /** Prefills the stake step (the amount typed on the details page). */
    amount?: string;
    hasWallet: boolean;
    onClose: () => void;
    onDone: () => void;
}

/** Manage, Stake, Unstake / Exit or Claim on one reward: the reward kind's own dialog. */
export const RowDialog = ({row, view, amount, hasWallet, onClose, onDone}: RowDialogProps) => {
    switch (row.source.kind) {
        case 'native':
            return <NativeStakingDialog stakingData={row.source.data} onClose={onClose} onClaimSuccess={onDone}/>;
        case 'simple':
            return (
                <RewardsStakingActionModal
                    stakingReward={row.source.reward}
                    userStake={row.source.stake}
                    userUnlocking={row.source.unlocking}
                    initialView={view === 'manage' ? 'actions' : view}
                    initialAmount={amount}
                    onClose={onClose}
                    onActionPerformed={onDone}
                />
            );
        case 'compounded':
            return (
                <DenomRewardActionModal
                    item={row.source.item}
                    action={view === 'manage' ? undefined : view === 'unstake' ? 'exit' : view}
                    initialAmount={amount}
                    hasWallet={hasWallet}
                    onClose={onClose}
                    onDone={onDone}
                />
            );
    }
};
