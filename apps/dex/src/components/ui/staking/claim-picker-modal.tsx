import {Box, Button, chakra, Flex} from "@chakra-ui/react";
import {LuCheck, LuGift, LuMinus} from "react-icons/lu";
import {type ReactNode, useMemo, useState} from "react";
import BigNumber from "bignumber.js";
import {
    getChainName, prettyAmount, uAmountToBigNumberAmount, useAssets, useAssetsValue, useBZETx, useCanAffordTx, useToast,
    hgVariant, type TxKindSpec,
} from "@bze/bze-ui-kit";
import {bze, cosmos} from "@bze/bzejs";
import {useChain} from "@interchain-kit/react";
import type {EncodeObject} from "interchainjs/types";
import {DexDialog} from "@/components/ui/dialog";
import {RewardKindTag} from "@/components/ui/staking/staking-table";
import {StakingRow, sumCoins} from "@/lib/staking-list";

const {claimStakingRewards, claimDenomRewards} = bze.rewards.MessageComposer.withTypeUrl;
const {withdrawDelegatorReward} = cosmos.distribution.v1beta1.MessageComposer.withTypeUrl;

/** The messages that claim one row: one per validator for native staking, one otherwise. */
export function claimMessages(row: StakingRow, address: string): EncodeObject[] {
    switch (row.source.kind) {
        case 'native':
            return (row.source.data.currentStaking?.pendingRewards.validators ?? [])
                .map(validatorAddress => withdrawDelegatorReward({delegatorAddress: address, validatorAddress}));
        case 'simple':
            return [claimStakingRewards({creator: address, rewardId: row.source.reward.reward_id})];
        case 'compounded':
            return [claimDenomRewards({creator: address, denom: row.source.item.denomReward.staking_denom})];
    }
}

/** The gas shape of claiming these rows together. */
export function claimSpec(rows: StakingRow[]): TxKindSpec[] {
    const count = (kind: StakingRow['kind']) => rows.filter(r => r.kind === kind);
    const validators = count('native').reduce((n, r) => n + (r.source.kind === 'native' ? r.source.data.currentStaking?.pendingRewards.validators.length ?? 0 : 0), 0);
    const spec: TxKindSpec[] = [];
    if (validators > 0) spec.push({kind: 'withdraw-delegator-reward', count: validators});
    if (count('simple').length > 0) spec.push({kind: 'claim-staking-reward', count: count('simple').length});
    if (count('compounded').length > 0) spec.push({kind: 'claim-denom-rewards', count: count('compounded').length});
    return spec;
}

interface ClaimPickerModalProps {
    /** The viewer's rows with something worth claiming. */
    rows: StakingRow[];
    onClose: () => void;
    onDone: () => void;
}

/** Pick the rewards to claim (all of them by default) and claim them in one transaction. */
export const ClaimPickerModal = ({rows, onClose, onDone}: ClaimPickerModalProps) => {
    const [selected, setSelected] = useState<Set<string>>(() => new Set(rows.map(r => r.id)));
    const [isSubmitting, setIsSubmitting] = useState(false);
    const {address} = useChain(getChainName());
    const {tx, progressTrack} = useBZETx();
    const {toast} = useToast();
    const {denomTicker, denomDecimals} = useAssets();
    const {denomUsdValue} = useAssetsValue();

    const picked = useMemo(() => rows.filter(r => selected.has(r.id)), [rows, selected]);
    const totals = useMemo(() => sumCoins(picked.flatMap(r => r.position?.pending ?? [])), [picked]);
    const usd = totals.reduce((sum, c) => sum.plus(denomUsdValue(c.denom, new BigNumber(c.amount))), new BigNumber(0));
    const msgCount = address ? picked.reduce((n, r) => n + claimMessages(r, address).length, 0) : 0;
    const feeCheck = useCanAffordTx({spec: address && picked.length > 0 ? claimSpec(picked) : undefined});

    const allSelected = picked.length === rows.length;
    const toggle = (id: string) => setSelected(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });
    const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map(r => r.id)));

    const submit = async () => {
        if (!address || picked.length === 0) return;
        if (!feeCheck.canAfford) {
            toast.error('Not enough for the network fee', feeCheck.message);
            return;
        }
        setIsSubmitting(true);
        try {
            const ok = await tx(picked.flatMap(r => claimMessages(r, address)));
            if (ok) onDone();
        } finally {
            setIsSubmitting(false);
        }
    };

    const coinText = (c: { denom: string; amount: string }) =>
        `${prettyAmount(uAmountToBigNumberAmount(c.amount, denomDecimals(c.denom)))} ${denomTicker(c.denom)}`;

    return (
        <DexDialog title="Claim rewards" onClose={onClose} width="520px">
            <Flex direction="column" gap="12px">
                <CheckRow
                    checked={allSelected ? true : picked.length === 0 ? false : 'mixed'}
                    onToggle={toggleAll}
                    aside={<chakra.span fontSize="12px" color="hg.text.faint">{picked.length} of {rows.length} selected</chakra.span>}
                >
                    <chakra.span fontSize="14px" fontWeight="600">Select all</chakra.span>
                </CheckRow>

                <Flex direction="column" gap="4px" maxH="320px" overflowY="auto" role="group" aria-label="Rewards to claim">
                    {rows.map(row => {
                        const pending = row.position?.pending ?? [];
                        return (
                            <CheckRow
                                key={row.id}
                                checked={selected.has(row.id)}
                                onToggle={() => toggle(row.id)}
                                aside={(
                                    <chakra.span fontSize="13px" fontWeight="600" color="hg.link" textAlign="right">
                                        {pending.length > 1 ? `${pending.length} tokens` : pending[0] ? coinText(pending[0]) : ''}
                                    </chakra.span>
                                )}
                            >
                                <Flex align="center" gap="8px" minW="0">
                                    <chakra.span fontSize="14px" fontWeight="600" truncate>{row.name}</chakra.span>
                                    <RewardKindTag kind={row.kind}/>
                                </Flex>
                            </CheckRow>
                        );
                    })}
                </Flex>

                <Flex direction="column" gap="4px" px="14px" py="12px" borderRadius="12px" bg="hg.inset">
                    <Flex justify="space-between" fontSize="14px">
                        <chakra.span color="fg.muted">You receive</chakra.span>
                        <chakra.strong>{usd.gt(0) ? `≈ $${prettyAmount(usd)}` : totals.length > 0 ? `${totals.length} token${totals.length === 1 ? '' : 's'}` : '—'}</chakra.strong>
                    </Flex>
                    {totals.length > 0 && totals.length <= 4 && (
                        <chakra.span fontSize="12px" color="hg.text.faint">{totals.map(coinText).join(' · ')}</chakra.span>
                    )}
                    <Flex justify="space-between" fontSize="12px" color="hg.text.faint">
                        <span>{msgCount} message{msgCount === 1 ? '' : 's'} in one transaction</span>
                        <chakra.span fontFamily="mono">
                            Fee {feeCheck.gasFee.isLoading ? '…' : `≈ ${prettyAmount(feeCheck.gasFee.displayAmount)} ${feeCheck.gasFee.ticker}`}
                        </chakra.span>
                    </Flex>
                </Flex>

                {!feeCheck.isLoading && feeCheck.message && (
                    <chakra.span role="alert" fontSize="13px" color="hg.danger.text">{feeCheck.message}</chakra.span>
                )}

                <Button
                    size="lg"
                    w="full"
                    variant={hgVariant('primary')}
                    gap="8px"
                    onClick={submit}
                    disabled={!address || picked.length === 0 || !feeCheck.canAfford}
                    loading={isSubmitting}
                    loadingText={progressTrack || 'Waiting for signature...'}
                >
                    <LuGift size={16} aria-hidden="true"/>
                    {picked.length === 0 ? 'Pick a reward' : `Claim ${picked.length} reward${picked.length === 1 ? '' : 's'}`}
                </Button>
            </Flex>
        </DexDialog>
    );
};

/** A selectable row with its check box; selected rows take the DEX tint. */
const CheckRow = ({checked, onToggle, aside, children}: {
    checked: boolean | 'mixed';
    onToggle: () => void;
    aside?: ReactNode;
    children: ReactNode;
}) => (
    <chakra.button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={onToggle}
        display="flex"
        alignItems="center"
        gap="12px"
        w="full"
        px="12px"
        py="10px"
        borderRadius="12px"
        borderWidth="1px"
        textAlign="left"
        cursor="pointer"
        bg={checked === true ? 'app.subtle' : 'transparent'}
        borderColor={checked === true ? 'app.border' : 'hg.hairline'}
        _hover={{bg: checked === true ? 'app.muted' : 'hg.hoverFill'}}
        _focusVisible={{outline: '2px solid', outlineColor: 'app.focusRing', outlineOffset: '2px'}}
    >
        <Box
            boxSize="18px"
            flex="none"
            display="flex"
            alignItems="center"
            justifyContent="center"
            borderRadius="5px"
            borderWidth="1.5px"
            borderColor={checked ? 'transparent' : 'hg.lineStrong'}
            bgImage={checked ? 'app' : undefined}
            color="fg.inverted"
            aria-hidden="true"
        >
            {checked === true && <LuCheck size={12} strokeWidth={3}/>}
            {checked === 'mixed' && <LuMinus size={12} strokeWidth={3}/>}
        </Box>
        <Box flex="1" minW="0">{children}</Box>
        {aside}
    </chakra.button>
);
