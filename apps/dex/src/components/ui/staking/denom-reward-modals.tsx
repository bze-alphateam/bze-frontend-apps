import {chakra, Flex, Stack} from "@chakra-ui/react";
import {LuGift} from "react-icons/lu";
import {useState} from "react";
import {
    claimableCoins,
    DenomRewardAction,
    DenomRewardClaimPanel,
    DenomRewardCoinLine,
    DenomRewardExitPanel,
    DenomRewardHolderItem,
    denomRewardActionBlockers,
    DenomRewardStakePanel,
    formatUnlockCountdown,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAsset,
    useBalance,
    useEpochs,
} from "@bze/bze-ui-kit";
import {DexDialog} from "@/components/ui/dialog";
import {RewardStakingAlert, TYPE_STAKING, TYPE_UNLOCK} from "@/components/ui/staking/rewards-staking-alerts";
import {RewardsStakingButton} from "@/components/ui/staking/rewards-staking-buttons";

interface DenomRewardActionModalProps {
    item: DenomRewardHolderItem;
    /** The step the dialog opens on; without one it opens on the overview with every action. */
    action?: DenomRewardAction;
    /** Prefills the stake amount (in display units). */
    initialAmount?: string;
    hasWallet?: boolean;
    onClose: () => void;
    onDone: () => void;
}

/**
 * The DEX dialog around the shared ui-kit action panels (a compounded reward is the chain's denom
 * reward): Manage opens the overview, Stake / Add opens the stake panel straight away.
 */
export const DenomRewardActionModal = ({item, action: initialAction, initialAmount, hasWallet = true, onClose, onDone}: DenomRewardActionModalProps) => {
    const [action, setAction] = useState<DenomRewardAction | undefined>(initialAction);
    const {asset} = useAsset(item.denomReward.staking_denom);
    const ticker = asset?.ticker ?? item.denomReward.staking_denom;
    const title = action === 'stake'
        ? (item.position ? `Add to your ${ticker} stake` : `Stake ${ticker}`)
        : action === 'claim' ? `Claim your ${ticker} prizes`
            : action === 'exit' ? `Exit the ${ticker} compounded reward` : ticker;

    return (
        <DexDialog title={title} onClose={onClose}>
            {action === undefined && <DenomRewardOverview item={item} hasWallet={hasWallet} onAction={setAction}/>}
            {action === 'stake' && <DenomRewardStakePanel item={item} initialAmount={initialAmount} onDone={onDone}/>}
            {action === 'claim' && <DenomRewardClaimPanel item={item} onDone={onDone}/>}
            {action === 'exit' && <DenomRewardExitPanel item={item} onDone={onDone}/>}
        </DexDialog>
    );
};

/** My stake, the pending prizes and the unlocks of one compounded reward, with Stake / Claim / Exit. */
const DenomRewardOverview = ({item, hasWallet, onAction}: { item: DenomRewardHolderItem; hasWallet: boolean; onAction: (a: DenomRewardAction) => void }) => {
    const {denomReward, position, unlocks} = item;
    const denom = denomReward.staking_denom;
    const {asset} = useAsset(denom);
    const {balance} = useBalance(denom);
    const {hourEpochInfo} = useEpochs();
    const decimals = asset?.decimals ?? 0;
    const ticker = asset?.ticker ?? denom;
    const blockers = denomRewardActionBlockers({item, hasWallet, balance: balance.amount});
    const pending = claimableCoins(position);
    const currentHour = hourEpochInfo ? Number(hourEpochInfo.current_epoch) : undefined;
    const reasons = Array.from(new Set([blockers.stake, position ? blockers.claim : ''].filter(Boolean)));

    return (
        <Flex direction="column" gap="10px">
            {position && (
                <RewardStakingAlert type={TYPE_STAKING} text={`${prettyAmount(uAmountToBigNumberAmount(position.participant.amount, decimals))} ${ticker}`}/>
            )}
            <Flex direction="column" gap="4px" px="12px" py="12px" borderRadius="12px" bg="hg.inset" borderWidth="1px" borderColor="hg.hairline">
                <Flex align="center" gap="6px" color="hg.text.secondary">
                    <LuGift size={14} aria-hidden="true"/>
                    <chakra.span fontSize="11px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase">Pending prizes</chakra.span>
                </Flex>
                {pending.length > 0
                    ? pending.map(c => <DenomRewardCoinLine key={c.denom} coin={c}/>)
                    : <chakra.span color="fg.muted" fontSize="14px">Nothing to claim yet.</chakra.span>}
            </Flex>
            {unlocks.map(u => (
                <RewardStakingAlert
                    key={u.unlockEpoch}
                    type={TYPE_UNLOCK}
                    text={`${prettyAmount(uAmountToBigNumberAmount(u.amount, decimals))} ${ticker} unlocking ${currentHour !== undefined ? formatUnlockCountdown(u.unlockEpoch, currentHour) : 'soon'}`}
                />
            ))}
            <Stack direction={{base: 'column', sm: 'row'}} gap="8px" mt="4px">
                <RewardsStakingButton buttonType="staking" disabled={blockers.stake !== ''} onClick={() => onAction('stake')}>
                    {position ? 'Add' : 'Stake'}
                </RewardsStakingButton>
                <RewardsStakingButton buttonType="unlock" disabled={blockers.exit !== ''} onClick={() => onAction('exit')}>
                    Exit
                </RewardsStakingButton>
                <RewardsStakingButton buttonType="rewards" disabled={blockers.claim !== ''} onClick={() => onAction('claim')}>
                    Claim
                </RewardsStakingButton>
            </Stack>
            {reasons.length > 0 && (
                <chakra.span fontSize="12px" color="hg.text.faint" data-testid="denom-reward-blockers">{reasons.join(' ')}</chakra.span>
            )}
        </Flex>
    );
};
