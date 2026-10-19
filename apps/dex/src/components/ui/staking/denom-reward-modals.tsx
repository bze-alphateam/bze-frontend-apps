import {
    DenomRewardClaimAllPanel,
    DenomRewardAction,
    DenomRewardClaimPanel,
    DenomRewardExitPanel,
    DenomRewardHolderItem,
    DenomRewardStakePanel,
    useAsset,
} from "@bze/bze-ui-kit";
import {DexDialog} from "@/components/ui/dialog";

interface DenomRewardActionModalProps {
    item: DenomRewardHolderItem;
    action: DenomRewardAction;
    onClose: () => void;
    onDone: () => void;
}

/** The DEX dialog around the shared ui-kit action panels (a compounded reward is the chain's denom reward). */
export const DenomRewardActionModal = ({item, action, onClose, onDone}: DenomRewardActionModalProps) => {
    const {asset} = useAsset(item.denomReward.staking_denom);
    const ticker = asset?.ticker ?? item.denomReward.staking_denom;
    const title = action === 'stake'
        ? (item.position ? `Add to your ${ticker} stake` : `Stake ${ticker}`)
        : action === 'claim' ? `Claim your ${ticker} prizes` : `Exit the ${ticker} compounded reward`;

    return (
        <DexDialog title={title} onClose={onClose}>
            {action === 'stake' && <DenomRewardStakePanel item={item} onDone={onDone}/>}
            {action === 'claim' && <DenomRewardClaimPanel item={item} onDone={onDone}/>}
            {action === 'exit' && <DenomRewardExitPanel item={item} onDone={onDone}/>}
        </DexDialog>
    );
};

export const DenomRewardClaimAllModal = ({items, onClose, onDone}: { items: DenomRewardHolderItem[]; onClose: () => void; onDone: () => void }) => (
    <DexDialog title="Claim all compounded rewards" onClose={onClose}>
        <DenomRewardClaimAllPanel items={items} onDone={onDone}/>
    </DexDialog>
);
