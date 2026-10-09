import {Box, Button, HStack, Skeleton, Text, VStack} from "@chakra-ui/react";
import {LuGift, LuRefreshCw} from "react-icons/lu";
import React, {useState} from "react";
import {claimableCoins, DenomRewardAction, DenomRewardHolderItem, useAssets} from "@bze/bze-ui-kit";
import {DenomRewardBox} from "@/components/ui/staking/denom-reward-box";
import {DenomRewardActionModal, DenomRewardClaimAllModal} from "@/components/ui/staking/denom-reward-modals";

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

/** "Denom rewards" on the staking page: every DR, my positions first, with the holder actions. */
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
        <VStack gap={3} align="stretch" data-testid="denom-rewards-section">
            <HStack justify="space-between" flexWrap="wrap" gap={3} pt={4}>
                <HStack gap={3}>
                    <Box p={2} borderRadius="lg" bg="purple.500/15" color="purple.600"><LuGift size={20}/></Box>
                    <VStack align="start" gap={0}>
                        <Text fontSize="xl" fontWeight="bold">Denom rewards</Text>
                        <Text fontSize="sm" color="fg.muted">
                            Stake a token into its pool and earn the prizes anyone funds for it — daily or as airdrops.
                        </Text>
                    </VStack>
                </HStack>
                {claimableCount > 0 && (
                    <Button size="sm" colorPalette="purple" variant="outline" onClick={() => setClaimAllOpen(true)}>
                        <LuGift/> Claim all denom rewards ({claimableCount})
                    </Button>
                )}
            </HStack>

            {isLoading ? (
                <Skeleton height="40"/>
            ) : hasError ? (
                <HStack gap={3} p={4} borderRadius="lg" borderWidth="1px" bg="bg.panel">
                    <Text fontSize="sm" color="fg.muted" flex="1">
                        Couldn&apos;t load the denom rewards — the node may be down, or not run chain v8.2.0 yet.
                    </Text>
                    <Button size="sm" variant="outline" onClick={onReload}><LuRefreshCw/> Retry</Button>
                </HStack>
            ) : visible.length === 0 ? (
                <Text fontSize="sm" color="fg.muted" data-testid="denom-rewards-empty">
                    {items.length === 0 ? 'No token has a denom reward yet.' : 'No denom reward matches your search.'}
                </Text>
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

            {open && openItem && (
                <DenomRewardActionModal item={openItem} action={open.action} onClose={() => setOpen(undefined)} onDone={done}/>
            )}
            {claimAllOpen && (
                <DenomRewardClaimAllModal items={items} onClose={() => setClaimAllOpen(false)} onDone={done}/>
            )}
        </VStack>
    );
};
