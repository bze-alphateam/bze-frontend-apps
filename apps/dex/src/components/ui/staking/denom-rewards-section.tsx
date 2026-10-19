import {Box, Button, chakra, Flex} from "@chakra-ui/react";
import {LuGift, LuRefreshCw} from "react-icons/lu";
import {useState} from "react";
import {claimableCoins, DenomRewardAction, DenomRewardHolderItem, HgCard, hgVariant, Shimmer, useAssets} from "@bze/bze-ui-kit";
import {DenomRewardBox} from "@/components/ui/staking/denom-reward-box";
import {DenomRewardActionModal, DenomRewardClaimAllModal} from "@/components/ui/staking/denom-reward-modals";
import {softButtonStyle} from "@/components/ui/staking/rewards-staking-buttons";
import {StakingSection} from "@/components/ui/staking/staking-card-parts";

/** Matches a DR by the ticker of its staking denom or of any prize it pays / owes me. */
export function filterDenomRewardItems(
    items: DenomRewardHolderItem[],
    searchTerm: string,
    denomTicker: (denom: string) => string,
): DenomRewardHolderItem[] {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return items;

    return items.filter(item => {
        const denoms = [
            item.denomReward.staking_denom,
            ...(item.dailyPrizes ?? []).map(p => p.denom),
            ...(item.position?.pending ?? []).map(p => p.denom),
        ];
        return denoms.some(d => denomTicker(d).toLowerCase().includes(term));
    });
}

interface DenomRewardsSectionProps {
    items: DenomRewardHolderItem[];
    isLoading: boolean;
    hasError: boolean;
    hasWallet: boolean;
    searchTerm: string;
    /** Refresh after a successful transaction or on Retry. */
    onReload: () => void;
}

/** "Compounded rewards" (the chain's denom rewards) on the staking page: every DR, my positions first, with the holder actions. */
export const DenomRewardsSection = ({items, isLoading, hasError, hasWallet, searchTerm, onReload}: DenomRewardsSectionProps) => {
    const {denomTicker} = useAssets();
    const [open, setOpen] = useState<{ denom: string; action: DenomRewardAction } | undefined>();
    const [claimAllOpen, setClaimAllOpen] = useState(false);

    const visible = filterDenomRewardItems(items, searchTerm, denomTicker);
    const claimableCount = items.filter(i => claimableCoins(i.position).length > 0).length;
    // the modal reads the item from the latest data, so a refresh while it is open shows fresh pending
    const openItem = open ? items.find(i => i.denomReward.staking_denom === open.denom) : undefined;

    const done = () => {
        setOpen(undefined);
        setClaimAllOpen(false);
        onReload();
    };

    return (
        <Box data-testid="denom-rewards-section">
            <StakingSection
                title="Compounded rewards"
                description="Stake a token and share every prize anyone adds to it — several tokens, daily or as airdrops."
                icon={<LuGift size={18}/>}
                aside={claimableCount > 0 ? (
                    <Button size="md" {...softButtonStyle} gap="6px" onClick={() => setClaimAllOpen(true)}>
                        <LuGift aria-hidden="true"/> Claim all compounded rewards ({claimableCount})
                    </Button>
                ) : undefined}
            >
                {isLoading ? (
                    <Flex direction="column" gap="12px" aria-busy="true">
                        <Shimmer h="160px" borderRadius="20px"/>
                    </Flex>
                ) : hasError ? (
                    <HgCard>
                        <Flex align="center" gap="12px" wrap="wrap">
                            <chakra.span fontSize="14px" color="fg.muted" flex="1">
                                Couldn&apos;t load the compounded rewards — the node may be down, or not run chain v8.2.0 yet.
                            </chakra.span>
                            <Button size="md" variant={hgVariant('secondary')} gap="6px" onClick={onReload}><LuRefreshCw aria-hidden="true"/> Retry</Button>
                        </Flex>
                    </HgCard>
                ) : visible.length === 0 ? (
                    <chakra.span fontSize="14px" color="fg.muted" data-testid="denom-rewards-empty">
                        {items.length === 0 ? 'No token has a compounded reward yet.' : 'No compounded reward matches your search.'}
                    </chakra.span>
                ) : (
                    visible.map(item => (
                        <DenomRewardBox
                            key={item.denomReward.staking_denom}
                            item={item}
                            hasWallet={hasWallet}
                            onAction={(action) => setOpen({denom: item.denomReward.staking_denom, action})}
                        />
                    ))
                )}
            </StakingSection>

            {open && openItem && (
                <DenomRewardActionModal item={openItem} action={open.action} onClose={() => setOpen(undefined)} onDone={done}/>
            )}
            {claimAllOpen && (
                <DenomRewardClaimAllModal items={items} onClose={() => setClaimAllOpen(false)} onDone={done}/>
            )}
        </Box>
    );
};
