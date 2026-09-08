'use client'

import {Box, chakra, Dialog, HStack, Portal, Skeleton, Text, VStack} from '@chakra-ui/react';
import {useChain} from '@interchain-kit/react';
import {type ReactNode, useState} from 'react';
import {LuCircleAlert, LuCircleCheck, LuInfo, LuTriangleAlert} from 'react-icons/lu';
import {getChainName} from '../constants/chain';
import {useFeeEstimate, UseFeeEstimateResult} from '../hooks/useFeeEstimate';
import {FeeCoin} from '../types/fees';
import {prettyAmount} from '../utils/amount';
import {TokenLogo} from './token-logo';
import {Tooltip} from './tooltip';

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
export const FeeEstimateRow = ({fee, label, description, isLoading, size = 'sm'}: FeeEstimateRowProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const estimate = useFeeEstimate(fee);
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
                        aria-label={`${label} details`}
                    >
                        <Text fontSize={size} color="fg.muted" fontWeight="medium">{label}</Text>
                        <LuInfo size={iconSize} color="var(--chakra-colors-fg-muted)"/>
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
        return <Skeleton height={size === 'xs' ? '3' : '4'} width="16"/>;
    }

    if (!fee || !estimate.estimate) {
        return <Text fontSize={size} color="fg.muted">Unavailable</Text>;
    }

    const nativeTicker = estimate.nativeAsset?.ticker ?? fee.denom;
    const nativeText = `${estimate.nativeDisplayAmount ? prettyAmount(estimate.nativeDisplayAmount) : fee.amount} ${nativeTicker}`;

    if (estimate.estimate.reason === 'estimated' && estimate.preferredDisplayAmount && estimate.preferredAsset) {
        return (
            <VStack align="end" gap={0}>
                <Text fontSize={size} fontWeight="medium">
                    ≈ {prettyAmount(estimate.preferredDisplayAmount)} {estimate.preferredAsset.ticker}
                </Text>
                <Text fontSize="xs" color="fg.muted">({nativeText})</Text>
            </VStack>
        );
    }

    return <Text fontSize={size} fontWeight="medium">{nativeText}</Text>;
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

    return (
        <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="md">
            <Portal>
                <Dialog.Backdrop/>
                <Dialog.Positioner>
                    <Dialog.Content maxW={{base: '92vw', md: '520px'}} borderRadius="xl">
                        <Dialog.Header>
                            <Dialog.Title fontSize="lg" fontWeight="bold">{label}</Dialog.Title>
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
                                        <Box p={3} borderWidth="1px" borderColor="border.muted" borderRadius="md">
                                            <Text fontSize="xs" color="fg.muted" mb={1}>Fee set by the network</Text>
                                            <HStack gap={2}>
                                                <TokenLogo src={nativeAsset?.logo} symbol={nativeTicker} size="5"/>
                                                <Text fontWeight="bold">{nativeText}</Text>
                                            </HStack>
                                        </Box>

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
            <HStack gap={2} align="start" color="orange.500">
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
            <Box p={3} borderWidth="1px" borderColor="blue.500/25" bg="blue.500/5" borderRadius="md">
                <Text fontSize="xs" color="fg.muted" mb={1}>Estimated cost in your fee token ({preferredTicker})</Text>
                <Text fontWeight="bold">{preferredText}</Text>
                <Text fontSize="xs" color="fg.muted" mt={1}>
                    This is an estimate, not the final amount. The network converts {nativeText} into {preferredTicker} through
                    the {poolName} liquidity pool when your transaction executes, and the pool&apos;s reserves move with every
                    trade — so the exact amount is only known at that moment. The estimate uses the pool&apos;s current price
                    and includes the liquidity pool&apos;s own fee (not a trading fee). The transaction&apos;s gas fee is charged
                    on top, in {preferredTicker} as well.
                </Text>
            </Box>

            <VStack align="stretch" gap={1}>
                <Text fontSize="sm" fontWeight="semibold">How the network charges it</Text>
                <Text fontSize="sm">
                    1. If you hold enough {preferredTicker}, the fee taken is {preferredText}.
                </Text>
                <Text fontSize="sm">
                    2. If your {preferredTicker} balance is short, the fee taken is {nativeText} from your {nativeTicker} balance
                    instead.
                </Text>
                <Text fontSize="sm">
                    3. If the {poolName} pool&apos;s {nativeTicker} liquidity drops below the network minimum, the fee is
                    charged in {nativeTicker}.
                </Text>
                <Text fontSize="xs" color="fg.muted">
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
}

const BalanceStatus = ({
    method,
    nativeText,
    preferredText,
    nativeTicker,
    preferredTicker,
    nativeBalance,
    preferredBalance,
}: BalanceStatusProps) => {
    if (method === 'preferred') {
        return (
            <HStack gap={2} align="start" color="green.500">
                <Box mt="0.5"><LuCircleCheck size={16}/></Box>
                <Text fontSize="sm">
                    You have enough {preferredTicker} for this fee — you will pay {preferredText} (plus the transaction&apos;s gas fee).
                </Text>
            </HStack>
        );
    }

    if (method === 'fallback') {
        return (
            <HStack gap={2} align="start" color="orange.500">
                <Box mt="0.5"><LuTriangleAlert size={16}/></Box>
                <Text fontSize="sm">
                    Not enough {preferredTicker} (you have {preferredBalance}) — the network will charge {nativeText} instead.
                    You have enough {nativeTicker}.
                </Text>
            </HStack>
        );
    }

    if (method === 'native') {
        return (
            <HStack gap={2} align="start" color="green.500">
                <Box mt="0.5"><LuCircleCheck size={16}/></Box>
                <Text fontSize="sm">You have enough {nativeTicker} to pay this fee.</Text>
            </HStack>
        );
    }

    return (
        <HStack gap={2} align="start" color="red.500">
            <Box mt="0.5"><LuCircleAlert size={16}/></Box>
            <Text fontSize="sm">
                {preferredText
                    ? `Not enough ${preferredTicker} or ${nativeTicker} to pay this fee — you have ${preferredBalance} ${preferredTicker} and ${nativeBalance} ${nativeTicker}.`
                    : `Not enough ${nativeTicker} to pay this fee — you have ${nativeBalance} ${nativeTicker}.`}
            </Text>
        </HStack>
    );
};
