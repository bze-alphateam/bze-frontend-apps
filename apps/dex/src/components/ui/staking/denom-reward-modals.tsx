import {Box, Button, Card, Heading, HStack} from "@chakra-ui/react";
import React, {type ReactNode} from "react";
import {
    DenomRewardClaimAllPanel,
    DenomRewardClaimPanel,
    DenomRewardExitPanel,
    DenomRewardHolderItem,
    DenomRewardStakePanel,
    useAsset,
} from "@bze/bze-ui-kit";
import {DenomRewardAction} from "@/components/ui/staking/denom-reward-box";

const ModalShell = ({title, onClose, children}: { title: string; onClose: () => void; children: ReactNode }) => (
    <Box position="fixed" inset="0" bg="blackAlpha.600" display="flex" alignItems="center" justifyContent="center" zIndex="modal">
        <Card.Root maxW="md" w="full" mx="4" maxH="90vh" overflowY="auto">
            <Card.Header>
                <HStack justify="space-between" align="center">
                    <Heading size="lg">{title}</Heading>
                    <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">✕</Button>
                </HStack>
            </Card.Header>
            <Card.Body>{children}</Card.Body>
        </Card.Root>
    </Box>
);

interface DenomRewardActionModalProps {
    item: DenomRewardHolderItem;
    action: DenomRewardAction;
    onClose: () => void;
    onDone: () => void;
}

/** The dex chrome around the shared ui-kit action panels. */
export const DenomRewardActionModal = ({item, action, onClose, onDone}: DenomRewardActionModalProps) => {
    const {asset} = useAsset(item.denomReward.staking_denom);
    const ticker = asset?.ticker ?? item.denomReward.staking_denom;
    const title = action === 'stake'
        ? (item.position ? `Add to your ${ticker} stake` : `Stake ${ticker}`)
        : action === 'claim' ? `Claim your ${ticker} prizes` : `Exit the ${ticker} denom reward`;

    return (
        <ModalShell title={title} onClose={onClose}>
            {action === 'stake' && <DenomRewardStakePanel item={item} onDone={onDone}/>}
            {action === 'claim' && <DenomRewardClaimPanel item={item} onDone={onDone}/>}
            {action === 'exit' && <DenomRewardExitPanel item={item} onDone={onDone}/>}
        </ModalShell>
    );
};

export const DenomRewardClaimAllModal = ({items, onClose, onDone}: { items: DenomRewardHolderItem[]; onClose: () => void; onDone: () => void }) => (
    <ModalShell title="Claim all denom rewards" onClose={onClose}>
        <DenomRewardClaimAllPanel items={items} onDone={onDone}/>
    </ModalShell>
);
