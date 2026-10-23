'use client'

import {Box, Button, chakra, Field, HStack, Input, Text, VStack} from '@chakra-ui/react';
import {useChain} from '@interchain-kit/react';
import BigNumber from 'bignumber.js';
import {type ReactNode, useMemo, useState} from 'react';
import {LuInfo} from 'react-icons/lu';
import {bze} from '@bze/bzejs';
import {getChainName} from '../constants/chain';
import {useAsset} from '../hooks/useAssets';
import {useAssetPrice} from '../hooks/usePrices';
import {useBZETx} from '../hooks/useTx';
import {useCanAffordTx} from '../hooks/useCanAffordTx';
import {useMaxSpendable} from '../hooks/useMaxSpendable';
import {DenomRewardCoin} from '../types/denom_rewards';
import {amountToBigNumberUAmount, prettyAmount, uAmountToBigNumberAmount} from '../utils/amount';
import {sanitizeNumberInput} from '../utils/number';
import {hgVariant} from '../theme/variants';
import {Notice} from './hive-glow/status';
import {
    claimableCoins,
    DenomRewardHolderItem,
    denomRewardUnlockDate,
    estimateDailyShare,
    sumClaimableCoins,
    validateDenomRewardStake,
} from '../utils/denom_rewards';
import {MaxInputGroup} from './max-input-group';

/**
 * The bodies of the holder actions on a denom reward — stake / add, claim, claim all, exit. Each
 * one signs its own transaction and calls `onDone` after a successful one; the app wraps them in
 * its own modal chrome.
 */

const {joinDenomReward, claimDenomRewards, exitDenomReward} = bze.rewards.MessageComposer.withTypeUrl;

/** One coin as "amount TICKER (≈ $x)", resolving the asset itself. */
export const DenomRewardCoinLine = ({coin, suffix}: { coin: DenomRewardCoin; suffix?: string }) => {
    const {asset} = useAsset(coin.denom);
    const {uAmountUsdValue, hasPrice} = useAssetPrice(coin.denom);
    const decimals = asset?.decimals ?? 0;
    const usd = hasPrice ? uAmountUsdValue(new BigNumber(coin.amount), decimals) : undefined;

    return (
        <HStack gap={2} justify="space-between" w="full" data-testid="denom-reward-coin">
            <Text fontFamily="mono" fontWeight="600" fontSize="14px" color="fg">
                {prettyAmount(uAmountToBigNumberAmount(coin.amount, decimals))} {asset?.ticker ?? coin.denom}{suffix ?? ''}
            </Text>
            {usd && usd.gt(0) && <Text fontSize="13px" color="hg.text.faint">≈ ${prettyAmount(usd)}</Text>}
        </HStack>
    );
};

/** A neutral inset panel with a small-caps heading (SurfDenomReward board). */
const Panel = ({title, children}: { title: string; children: ReactNode }) => (
    <Box w="full" bg="hg.inset" borderRadius="14px" px="14px" py="12px" data-testid="denom-reward-panel">
        <VStack align="start" gap="8px">
            <chakra.span fontSize="12px" letterSpacing="0.12em" textTransform="uppercase" fontWeight="700" color="hg.text.faint">
                {title}
            </chakra.span>
            {children}
        </VStack>
    </Box>
);

const Note = ({children}: { children: ReactNode }) => (
    <HStack align="start" gap="8px" w="full" fontSize="13px" lineHeight="1.5" color="fg.muted">
        <Box mt="2px" flexShrink={0} color="hg.text.faint"><LuInfo size={14}/></Box>
        <Text>{children}</Text>
    </HStack>
);

const NetworkFee = ({fee}: { fee: { displayAmount: BigNumber; ticker: string; isLoading: boolean } }) => (
    <Text fontSize="12px" color="hg.text.faint" w="full">
        Network fee: {fee.isLoading ? '…' : <chakra.span fontFamily="mono">≈ {prettyAmount(fee.displayAmount)} {fee.ticker}</chakra.span>}
    </Text>
);

const FeeError = ({children}: { children: ReactNode }) => (
    <Text role="alert" fontSize="13px" color="hg.danger.text">{children}</Text>
);

const SubmitButton = (props: { onClick: () => void; disabled: boolean; loading: boolean; loadingText: string; children: ReactNode }) => (
    <Button size="lg" variant={hgVariant('primary')} {...props}/>
);

export interface DenomRewardPanelProps {
    item: DenomRewardHolderItem;
    /** Called after the transaction succeeded (refresh the data, close the modal). */
    onDone?: () => void;
}

export interface DenomRewardStakePanelProps extends DenomRewardPanelProps {
    /** Prefills the amount (in display units), e.g. one typed on a details page. */
    initialAmount?: string;
}

/** Stake into a DR, or add to an existing position (which pays out the pending prizes first). */
export const DenomRewardStakePanel = ({item, initialAmount, onDone}: DenomRewardStakePanelProps) => {
    const {denomReward, position} = item;
    const denom = denomReward.staking_denom;
    const [input, setInput] = useState(() => sanitizeNumberInput(initialAmount ?? ''));
    const [isSubmitting, setIsSubmitting] = useState(false);

    const {address} = useChain(getChainName());
    const {tx, progressTrack} = useBZETx();
    const {asset} = useAsset(denom);
    const maxSpendable = useMaxSpendable(denom, 'join-denom-reward');
    const decimals = asset?.decimals ?? 0;
    const ticker = asset?.ticker ?? denom;
    const isTopUp = Boolean(position);

    const uAmount = useMemo(
        () => (input ? amountToBigNumberUAmount(input, decimals) : undefined),
        [input, decimals],
    );
    const problem = validateDenomRewardStake({
        uAmount,
        currentStake: position?.participant.amount,
        minStake: denomReward.min_stake,
        balance: maxSpendable.balance,
    });
    const afford = useCanAffordTx({
        spec: address && problem === '' ? 'join-denom-reward' : undefined,
        spend: uAmount && problem === '' ? {denom, amount: uAmount} : undefined,
    });

    const minStake = `${prettyAmount(uAmountToBigNumberAmount(denomReward.min_stake, decimals))} ${ticker}`;
    const message = !input ? '' : problem === 'invalid'
        ? `Enter an amount greater than zero, with at most ${decimals} decimals.`
        : problem === 'balance'
            ? `You only have ${prettyAmount(uAmountToBigNumberAmount(maxSpendable.balance, decimals))} ${ticker}.`
            : problem === 'min-stake'
                ? (isTopUp ? `Your whole position must reach the minimum stake of ${minStake}.` : `The minimum stake is ${minStake}.`)
                : (!afford.isLoading && !afford.canAfford ? afford.message : '');

    const newStake = uAmount && problem === '' ? uAmount.plus(position?.participant.amount ?? 0) : undefined;
    const newTotal = uAmount && problem === '' ? uAmount.plus(denomReward.staked_amount) : undefined;
    const pendingFirst = claimableCoins(position);
    const canSubmit = Boolean(address) && problem === '' && !afford.isLoading && afford.canAfford && !isSubmitting;

    const submit = async () => {
        if (!address || !uAmount || !canSubmit) return;
        setIsSubmitting(true);
        try {
            const ok = await tx([joinDenomReward({creator: address, denom, amount: uAmount.toFixed(0)})]);
            if (ok) onDone?.();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <VStack gap={4} w="full" align="stretch">
            <Text fontSize="13px" color="fg.muted">
                Balance: {prettyAmount(uAmountToBigNumberAmount(maxSpendable.balance, decimals))} {ticker}
                {' · '}Minimum stake: {minStake}{isTopUp ? ' (for your whole position)' : ''}
            </Text>
            <Field.Root invalid={message !== ''}>
                <MaxInputGroup w="full" onMax={() => setInput(maxSpendable.inputValue)} maxDisabled={!maxSpendable.amount.gt(0) || isSubmitting}>
                    <Input
                        autoComplete="off"
                        placeholder={`Amount of ${ticker} to ${isTopUp ? 'add' : 'stake'}`}
                        value={input}
                        onChange={(e) => setInput(sanitizeNumberInput(e.target.value))}
                        disabled={isSubmitting}
                        size="sm"
                        fontFamily="mono"
                        data-testid="denom-reward-stake-input"
                    />
                </MaxInputGroup>
                <Field.ErrorText data-testid="denom-reward-stake-error">{message}</Field.ErrorText>
            </Field.Root>

            {newStake && newTotal && (item.dailyPrizes?.length ?? 0) > 0 && (
                <Panel title="Estimated daily share">
                    {item.dailyPrizes?.map(prize => (
                        <DenomRewardCoinLine
                            key={prize.denom}
                            coin={{denom: prize.denom, amount: estimateDailyShare(newStake, newTotal, prize.amount).toFixed(0)}}
                            suffix=" / day"
                        />
                    ))}
                    <Text fontSize="12px" lineHeight="1.45" color="hg.text.faint">
                        An estimate from today&apos;s stakes: each day&apos;s prize is split pro rata among
                        everyone staking when it is paid.
                    </Text>
                </Panel>
            )}

            {isTopUp && (
                <Note>
                    Adding pays out your pending prizes first, in the same transaction
                    {pendingFirst.length > 0 ? ':' : ' (you have none right now).'}
                </Note>
            )}
            {pendingFirst.length > 0 && isTopUp && (
                <VStack gap={1} w="full" pl={6}>
                    {pendingFirst.map(c => <DenomRewardCoinLine key={c.denom} coin={c}/>)}
                </VStack>
            )}
            <Note>
                {denomReward.lock > 0
                    ? `Exiting later returns your whole stake after a ${denomReward.lock}-day unlock period; there is no partial exit.`
                    : 'Exiting later returns your whole stake immediately; there is no partial exit.'}
            </Note>

            <NetworkFee fee={afford.gasFee}/>
            <SubmitButton onClick={submit} disabled={!canSubmit} loading={isSubmitting} loadingText={progressTrack || 'Waiting for signature...'}>
                {isTopUp ? 'Add to stake' : 'Stake'}
            </SubmitButton>
            {!address && <Text fontSize="13px" color="fg.muted" textAlign="center">Connect your wallet to stake.</Text>}
        </VStack>
    );
};

/** Claim every pending prize of one DR. */
export const DenomRewardClaimPanel = ({item, onDone}: DenomRewardPanelProps) => {
    const denom = item.denomReward.staking_denom;
    const coins = claimableCoins(item.position);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const {address} = useChain(getChainName());
    const {tx, progressTrack} = useBZETx();
    const afford = useCanAffordTx({spec: address && coins.length > 0 ? 'claim-denom-rewards' : undefined});
    const canSubmit = Boolean(address) && coins.length > 0 && !afford.isLoading && afford.canAfford && !isSubmitting;

    const submit = async () => {
        if (!address || !canSubmit) return;
        setIsSubmitting(true);
        try {
            const ok = await tx([claimDenomRewards({creator: address, denom})]);
            if (ok) onDone?.();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <VStack gap={4} w="full" align="stretch">
            <Panel title="You receive">
                {coins.length > 0
                    ? coins.map(c => <DenomRewardCoinLine key={c.denom} coin={c}/>)
                    : <Text fontSize="14px" color="fg.muted">Nothing to claim yet.</Text>}
            </Panel>
            <Note>
                Your stake stays in and keeps earning. Amounts smaller than one base unit stay behind
                and keep accruing.
            </Note>
            {!afford.isLoading && !afford.canAfford && afford.message && <FeeError>{afford.message}</FeeError>}
            <NetworkFee fee={afford.gasFee}/>
            <SubmitButton onClick={submit} disabled={!canSubmit} loading={isSubmitting} loadingText={progressTrack || 'Waiting for signature...'}>
                Claim
            </SubmitButton>
        </VStack>
    );
};

/** Claim the pending prizes of every DR the viewer has some in, in one transaction. */
export const DenomRewardClaimAllPanel = ({items, onDone}: { items: DenomRewardHolderItem[]; onDone?: () => void }) => {
    const claimable = items.filter(i => claimableCoins(i.position).length > 0);
    const totals = sumClaimableCoins(claimable);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const {address} = useChain(getChainName());
    const {tx, progressTrack} = useBZETx();
    const afford = useCanAffordTx({
        spec: address && claimable.length > 0 ? {kind: 'claim-denom-rewards', count: claimable.length} : undefined,
    });
    const canSubmit = Boolean(address) && claimable.length > 0 && !afford.isLoading && afford.canAfford && !isSubmitting;

    const submit = async () => {
        if (!address || !canSubmit) return;
        setIsSubmitting(true);
        try {
            const msgs = claimable.map(i => claimDenomRewards({creator: address, denom: i.denomReward.staking_denom}));
            const ok = await tx(msgs);
            if (ok) onDone?.();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <VStack gap={4} w="full" align="stretch">
            <Panel title={`You receive (from ${claimable.length} compounded reward${claimable.length === 1 ? '' : 's'})`}>
                {totals.length > 0
                    ? totals.map(c => <DenomRewardCoinLine key={c.denom} coin={c}/>)
                    : <Text fontSize="14px" color="fg.muted">Nothing to claim yet.</Text>}
            </Panel>
            <Note>Your stakes stay in and keep earning.</Note>
            {!afford.isLoading && !afford.canAfford && afford.message && <FeeError>{afford.message}</FeeError>}
            <NetworkFee fee={afford.gasFee}/>
            <SubmitButton onClick={submit} disabled={!canSubmit} loading={isSubmitting} loadingText={progressTrack || 'Waiting for signature...'}>
                Claim all
            </SubmitButton>
        </VStack>
    );
};

const formatUnlockDate = (date: Date) =>
    date.toLocaleString(undefined, {dateStyle: 'medium', timeStyle: 'short'});

/** Exit a DR: pays the pending prizes, then releases the whole stake (after the lock, if any). */
export const DenomRewardExitPanel = ({item, onDone}: DenomRewardPanelProps) => {
    const {denomReward, position} = item;
    const denom = denomReward.staking_denom;
    const coins = claimableCoins(position);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const {address} = useChain(getChainName());
    const {tx, progressTrack} = useBZETx();
    const {asset} = useAsset(denom);
    // the exit-denom-reward gas profile already carries the chain's extra_gas_for_denom_exit
    const afford = useCanAffordTx({spec: address && position ? 'exit-denom-reward' : undefined});
    const canSubmit = Boolean(address) && Boolean(position) && !afford.isLoading && afford.canAfford && !isSubmitting;
    const unlockDate = denomRewardUnlockDate(denomReward.lock);
    const stake = `${prettyAmount(uAmountToBigNumberAmount(position?.participant.amount ?? 0, asset?.decimals ?? 0))} ${asset?.ticker ?? denom}`;

    const submit = async () => {
        if (!address || !canSubmit) return;
        setIsSubmitting(true);
        try {
            const ok = await tx([exitDenomReward({creator: address, denom})]);
            if (ok) onDone?.();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <VStack gap={4} w="full" align="stretch">
            {coins.length > 0 && (
                <Panel title="Paid out first">
                    {coins.map(c => <DenomRewardCoinLine key={c.denom} coin={c}/>)}
                </Panel>
            )}
            <Panel title="Your stake">
                <Text fontFamily="mono" fontWeight="700" fontSize="18px" color="fg">{stake}</Text>
                {!unlockDate && (
                    <Text fontSize="13px" color="fg.muted" data-testid="denom-reward-exit-unlock">
                        Returns to your wallet immediately, in this transaction.
                    </Text>
                )}
            </Panel>
            {unlockDate && (
                // The lock-up is the one warning of the dialog: the amber notice.
                <Box data-testid="denom-reward-exit-unlock">
                    <Notice status="warning">
                        {`Unlocks around ${formatUnlockDate(unlockDate)} (${denomReward.lock} day${denomReward.lock === 1 ? '' : 's'} from now) — until then it shows under your pending unlocks and earns nothing.`}
                    </Notice>
                </Box>
            )}
            <Note>Exiting is all or nothing: your whole stake leaves this compounded reward.</Note>
            {!afford.isLoading && !afford.canAfford && afford.message && <FeeError>{afford.message}</FeeError>}
            <NetworkFee fee={afford.gasFee}/>
            <SubmitButton onClick={submit} disabled={!canSubmit} loading={isSubmitting} loadingText={progressTrack || 'Waiting for signature...'}>
                Exit
            </SubmitButton>
        </VStack>
    );
};
