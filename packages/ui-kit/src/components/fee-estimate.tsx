'use client'

import {Box, chakra, Dialog, HStack, Portal, Text, VStack} from '@chakra-ui/react';
import {useChain} from '@interchain-kit/react';
import {type ReactNode, useState} from 'react';
import {LuCircleAlert, LuCircleCheck, LuInfo, LuTriangleAlert} from 'react-icons/lu';
import {getChainName} from '../constants/chain';
import {useFeeEstimate, UseFeeEstimateResult} from '../hooks/useFeeEstimate';
import {useGasFeeEstimate} from '../hooks/useGasFeeEstimate';
import {FeeCoin} from '../types/fees';
import {prettyAmount} from '../utils/amount';
import {TxSpec} from '../utils/gas_fee';
import {TokenLogo} from './token-logo';
import {Tooltip} from './tooltip';
import {Shimmer} from './hive-glow/cards';

export interface FeeEstimateRowProps {
    /** The fee as defined on chain (native micro-denom). Undefined = unknown / still loading. */
    fee?: FeeCoin;
    /** Row label, e.g. "Taker Fee". */
    label: string;
    /** What this fee is for — shown in the tooltip and at the top of the details dialog. */
    description: ReactNode;
    /** Fee still being fetched (e.g. from useTradingFees). */
    isLoading?: boolean;
    /** Text size of the row; defaults to `sm`. */
    size?: 'xs' | 'sm';
    /**
     * The transaction this fee belongs to (`'swap'`, `'create-order'`, …). When set, the
     * transaction's gas fee is estimated too: the balance status accounts for it and the
     * details dialog names it. Omit when the gas fee is irrelevant or unknown.
     */
    txKind?: TxSpec;
}

/**
 * A "label / amount" row for a native-denominated fee that shows what the user will
 * really pay: the fee in the Settings fee token (an estimate from the liquidity pool)
 * with the native amount alongside, or the native amount when the preferred token
 * can't be used. Hovering the label explains the fee; clicking it opens a dialog that
 * spells out the estimate, the chain's fallback rules and the user's balance situation.
 *
 * Shared by every app; the math lives in `useFeeEstimate` / `utils/fee_conversion`.
 */
export const FeeEstimateRow = ({fee, label, description, isLoading, size = 'sm', txKind}: FeeEstimateRowProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const gasFee = useGasFeeEstimate(txKind);
    const estimate = useFeeEstimate(fee, {gasFee: txKind ? gasFee.estimate : undefined});
    const loading = Boolean(isLoading) || (Boolean(fee) && estimate.isLoading && !estimate.nativeAsset);
    const iconSize = size === 'xs' ? 12 : 14;

    return (
        <>
            <HStack justify="space-between" align="start" gap={2}>
                <Tooltip
                    content={
                        <VStack align="start" gap={1}>
                            <Text>{description}</Text>
                            <Text color="fg.muted">Click for details.</Text>
                        </VStack>
                    }
                    showArrow
                    openDelay={100}
                >
                    <chakra.button
                        type="button"
                        onClick={() => setIsOpen(true)}
                        display="inline-flex"
                        alignItems="center"
                        gap="1"
                        cursor="pointer"
                        bg="transparent"
                        border="none"
                        p="0"
                        className="group"
                        aria-label={`${label} details`}
                    >
                        <Text fontSize={size} color="fg.muted" fontWeight="medium" _groupHover={{color: 'fg'}}>{label}</Text>
                        <Box as="span" color="fg.muted" _groupHover={{color: 'fg'}}><LuInfo size={iconSize}/></Box>
                    </chakra.button>
                </Tooltip>

                <FeeAmount estimate={estimate} fee={fee} loading={loading} size={size}/>
            </HStack>

            <FeeDetailsDialog
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                label={label}
                description={description}
                fee={fee}
                estimate={estimate}
            />
        </>
    );
};

interface FeeAmountProps {
    estimate: UseFeeEstimateResult;
    fee?: FeeCoin;
    loading: boolean;
    size: 'xs' | 'sm';
}

const FeeAmount = ({estimate, fee, loading, size}: FeeAmountProps) => {
    if (loading) {
        return <Shimmer h={size === 'xs' ? '12px' : '14px'} w="64px" borderRadius="6px"/>;
    }

    if (!fee || !estimate.estimate) {
        return <Text fontSize={size} color="fg.subtle">Unavailable</Text>;
    }

    const nativeTicker = estimate.nativeAsset?.ticker ?? fee.denom;
    const nativeText = `${estimate.nativeDisplayAmount ? prettyAmount(estimate.nativeDisplayAmount) : fee.amount} ${nativeTicker}`;

    if (estimate.estimate.reason === 'estimated' && estimate.preferredDisplayAmount && estimate.preferredAsset) {
        return (
            <VStack align="end" gap={0}>
                <Text fontSize={size} fontWeight="600" fontFamily="mono">
                    ≈ {prettyAmount(estimate.preferredDisplayAmount)} {estimate.preferredAsset.ticker}
                </Text>
                <Text fontSize="xs" color="fg.subtle" fontFamily="mono">({nativeText})</Text>
            </VStack>
        );
    }

    return <Text fontSize={size} fontWeight="600" fontFamily="mono">{nativeText}</Text>;
};

interface FeeDetailsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    label: string;
    description: ReactNode;
    fee?: FeeCoin;
    estimate: UseFeeEstimateResult;
}

const FeeDetailsDialog = ({isOpen, onClose, label, description, fee, estimate}: FeeDetailsDialogProps) => {
    const {address} = useChain(getChainName());
    const {estimate: result, method, isPreferredSelected, nativeAsset, preferredAsset} = estimate;

    const nativeTicker = nativeAsset?.ticker ?? fee?.denom ?? '';
    const preferredTicker = preferredAsset?.ticker ?? result?.preferredDenom ?? '';
    const nativeText = estimate.nativeDisplayAmount
        ? `${prettyAmount(estimate.nativeDisplayAmount)} ${nativeTicker}`
        : fee ? `${fee.amount} ${fee.denom}` : '';
    const preferredText = estimate.preferredDisplayAmount
        ? `≈ ${prettyAmount(estimate.preferredDisplayAmount)} ${preferredTicker}`
        : '';
    const poolName = `${preferredTicker}/${nativeTicker}`;
    // "plus ≈ 0.0045 BZE gas" — only when the row knows which transaction it belongs to.
    const gasText = estimate.gasFee && estimate.gasFeeDisplayAmount
        ? `≈ ${prettyAmount(estimate.gasFeeDisplayAmount)} ${estimate.gasFeeTicker} gas`
        : '';

    return (
        <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="md">
            <Portal>
                <Dialog.Backdrop/>
                <Dialog.Positioner>
                    <Dialog.Content
                        maxW={{base: '92vw', md: '520px'}}
                        bg="hg.card"
                        borderWidth="1px"
                        borderColor="hg.hairline"
                        borderRadius="20px"
                        boxShadow="hg.popover"
                    >
                        <Dialog.Header>
                            <Dialog.Title fontSize="19px" fontWeight="700">{label}</Dialog.Title>
                            <Dialog.CloseTrigger/>
                        </Dialog.Header>

                        <Dialog.Body>
                            <VStack align="stretch" gap={4}>
                                <Text fontSize="sm" color="fg.muted">{description}</Text>

                                {!fee || !result ? (
                                    <HStack gap={2} color="fg.muted">
                                        <LuCircleAlert size={16}/>
                                        <Text fontSize="sm">
                                            Could not load the current fee from the network. Please refresh and try again.
                                        </Text>
                                    </HStack>
                                ) : (
                                    <>
                                        <Box px="14px" py="12px" bg="hg.inset" borderRadius="12px">
                                            <Text fontSize="xs" color="fg.subtle" mb="6px">Fee set by the network</Text>
                                            <HStack gap={2}>
                                                <TokenLogo src={nativeAsset?.logo} symbol={nativeTicker} size="5"/>
                                                <Text fontWeight="700" fontFamily="mono">{nativeText}</Text>
                                            </HStack>
                                        </Box>

                                        {gasText && (
                                            <Text fontSize="sm" color="fg.muted">
                                                The transaction also pays a network gas fee of {gasText.replace(' gas', '')} — it is
                                                taken before this fee, from the same balance.
                                            </Text>
                                        )}

                                        {isPreferredSelected ? (
                                            <PreferredTokenExplanation
                                                reason={result.reason}
                                                nativeText={nativeText}
                                                preferredText={preferredText}
                                                nativeTicker={nativeTicker}
                                                preferredTicker={preferredTicker}
                                                poolName={poolName}
                                            />
                                        ) : (
                                            <Text fontSize="sm">
                                                This fee is paid in {nativeTicker}. You can pick another token for
                                                fees in Settings.
                                            </Text>
                                        )}

                                        {address && method && (
                                            <BalanceStatus
                                                method={method}
                                                nativeText={nativeText}
                                                preferredText={preferredText}
                                                nativeTicker={nativeTicker}
                                                preferredTicker={preferredTicker}
                                                nativeBalance={prettyAmount(estimate.nativeBalanceDisplay)}
                                                preferredBalance={prettyAmount(estimate.preferredBalanceDisplay)}
                                                gasText={gasText}
                                            />
                                        )}
                                    </>
                                )}
                            </VStack>
                        </Dialog.Body>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    );
};

interface PreferredTokenExplanationProps {
    reason: NonNullable<UseFeeEstimateResult['estimate']>['reason'];
    nativeText: string;
    preferredText: string;
    nativeTicker: string;
    preferredTicker: string;
    poolName: string;
}

const PreferredTokenExplanation = ({
    reason,
    nativeText,
    preferredText,
    nativeTicker,
    preferredTicker,
    poolName,
}: PreferredTokenExplanationProps) => {
    if (reason !== 'estimated') {
        const why = reason === 'no-pool'
            ? `there is no ${poolName} liquidity pool`
            : reason === 'low-liquidity'
                ? `the ${poolName} pool does not hold enough ${nativeTicker} liquidity for the network to accept ${preferredTicker} for fees right now`
                : `the ${poolName} pool is too small to cover this fee`;

        return (
            <HStack gap={2} align="start" color="hg.warning.text">
                <Box mt="0.5"><LuTriangleAlert size={16}/></Box>
                <Text fontSize="sm">
                    You picked {preferredTicker} as your fee token, but {why}. This fee will be charged
                    in {nativeTicker} ({nativeText}). You can change your fee token in Settings.
                </Text>
            </HStack>
        );
    }

    return (
        <VStack align="stretch" gap={3}>
            <Box px="14px" py="12px" borderWidth="1px" borderColor="app.500/30" bg="app.500/6" borderRadius="12px">
                <Text fontSize="xs" color="fg.subtle" mb={1}>Estimated cost in your fee token ({preferredTicker})</Text>
                <Text fontWeight="700" fontSize="16px" fontFamily="mono">{preferredText}</Text>
                <Text fontSize="xs" color="fg.subtle" mt={1}>
                    This is an estimate, and it represents the equivalent of {nativeText}. It can change depending on the
                    liquidity of {preferredTicker} and {nativeTicker}.
                </Text>
            </Box>

            <VStack align="stretch" gap={1}>
                <Text fontSize="sm" fontWeight="semibold">How the network charges it</Text>
                <Text fontSize="sm" color="hg.text.secondary">
                    1. If you hold enough {preferredTicker}, the fee taken is {preferredText}.
                </Text>
                <Text fontSize="sm" color="hg.text.secondary">
                    2. If your {preferredTicker} balance is short, the fee taken is {nativeText} from your {nativeTicker} balance
                    instead.
                </Text>
                <Text fontSize="sm" color="hg.text.secondary">
                    3. If the {poolName} pool&apos;s {nativeTicker} liquidity drops below the network minimum, the fee is
                    charged in {nativeTicker}.
                </Text>
                <Text fontSize="xs" color="fg.subtle">
                    You can change your fee token in Settings.
                </Text>
            </VStack>
        </VStack>
    );
};

interface BalanceStatusProps {
    method: NonNullable<UseFeeEstimateResult['method']>;
    nativeText: string;
    preferredText: string;
    nativeTicker: string;
    preferredTicker: string;
    nativeBalance: string;
    preferredBalance: string;
    /** "≈ 0.0045 BZE gas" when the gas fee is known, empty otherwise. */
    gasText: string;
}

const BalanceStatus = ({
    method,
    nativeText,
    preferredText,
    nativeTicker,
    preferredTicker,
    nativeBalance,
    preferredBalance,
    gasText,
}: BalanceStatusProps) => {
    const plusGas = gasText ? ` (plus ${gasText})` : " (plus the transaction's gas fee)";

    if (method === 'preferred') {
        return (
            <HStack gap={2} align="start" color="hg.success.text">
                <Box mt="0.5"><LuCircleCheck size={16}/></Box>
                <Text fontSize="sm">
                    You have enough {preferredTicker} for this fee — you will pay {preferredText}{plusGas}.
                </Text>
            </HStack>
        );
    }

    if (method === 'fallback') {
        return (
            <HStack gap={2} align="start" color="hg.warning.text">
                <Box mt="0.5"><LuTriangleAlert size={16}/></Box>
                <Text fontSize="sm">
                    Not enough {preferredTicker} (you have {preferredBalance}{gasText ? `, ${gasText} goes first` : ''}) — the
                    network will charge {nativeText} instead. You have enough {nativeTicker}.
                </Text>
            </HStack>
        );
    }

    if (method === 'native') {
        return (
            <HStack gap={2} align="start" color="hg.success.text">
                <Box mt="0.5"><LuCircleCheck size={16}/></Box>
                <Text fontSize="sm">You have enough {nativeTicker} to pay this fee{gasText ? ` plus ${gasText}` : ''}.</Text>
            </HStack>
        );
    }

    const withGas = gasText ? ` plus ${gasText}` : '';
    return (
        <HStack gap={2} align="start" color="hg.danger.text">
            <Box mt="0.5"><LuCircleAlert size={16}/></Box>
            <Text fontSize="sm">
                {preferredText
                    ? `Not enough ${preferredTicker} or ${nativeTicker} to pay this fee${withGas} — you have ${preferredBalance} ${preferredTicker} and ${nativeBalance} ${nativeTicker}.`
                    : `Not enough ${nativeTicker} to pay this fee${withGas} — you have ${nativeBalance} ${nativeTicker}.`}
            </Text>
        </HStack>
    );
};
