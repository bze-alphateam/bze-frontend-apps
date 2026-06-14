'use client';

import {
    Box,
    Button,
    Field,
    HStack,
    Input,
    Portal,
    Text,
    VStack,
    Dialog,
} from "@chakra-ui/react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useChain } from "@interchain-kit/react";
import { getChainName, useToast, useBZETx, useBalance, toBigNumber, uAmountToBigNumberAmount, sanitizeIntegerInput, useAsset } from "@bze/bze-ui-kit";
import { bze } from '@bze/bzejs';
import BigNumber from "bignumber.js";
import {useRaffleContributions} from "@/hooks/useRaffles";

interface RaffleModalProps {
    isOpen: boolean;
    onClose: () => void;
    raffleName: string;
    contributionPrice: string;
    currentPrize: string;
    winChance: string; // e.g., "1 in 10"
    ticker: string;
    denom: string;
}

export const RaffleModal = ({
    isOpen,
    onClose,
    raffleName,
    contributionPrice,
    currentPrize,
    winChance,
    ticker,
    denom,
}: RaffleModalProps) => {
    const [numContributions, setNumContributions] = useState("1");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [contributionsError, setContributionsError] = useState("");

    const { address } = useChain(getChainName());
    const { toast } = useToast();
    const { tx } = useBZETx();
    const { balance } = useBalance(denom);
    const { asset } = useAsset(denom);
    const {addPendingRaffleContribution} = useRaffleContributions()

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setNumContributions("1");
            setIsSubmitting(false);
            setContributionsError("");
        }
    }, [isOpen]);

    // Calculate total cost for tickets
    const totalCost = useMemo(() => {
        const tickets = toBigNumber(numContributions);
        const price = toBigNumber(contributionPrice);
        if (tickets.isNaN() || price.isNaN()) return BigNumber(0);
        return tickets.multipliedBy(price);
    }, [numContributions, contributionPrice]);

    // Check if user has enough balance
    const userBalance = useMemo(() => {
        if (!asset) return BigNumber(0);
        return uAmountToBigNumberAmount(balance.amount, asset.decimals || 6);
    }, [balance, asset]);

    const hasEnoughBalance = useMemo(() => {
        return userBalance.gte(totalCost);
    }, [userBalance, totalCost]);

    const handleContributionsChange = (value: string) => {
        setNumContributions(value);
        setContributionsError("");
    };

    const handleJoinRaffle = useCallback(async () => {
        if (!address) {
            toast.error("Please connect your wallet to continue");
            return;
        }

        // Validation
        const tickets = toBigNumber(numContributions);
        if (!numContributions || tickets.isNaN() || tickets.lte(0)) {
            setContributionsError("Please enter a valid number of contributions");
            return;
        }

        if (!hasEnoughBalance) {
            setContributionsError(`Not enough balance! You need ${totalCost.toFixed(2)} ${ticker}`);
            return;
        }

        const { joinRaffle } = bze.burner.MessageComposer.withTypeUrl;
        const msg = joinRaffle({
            creator: address,
            denom: denom,
            tickets: BigInt(numContributions)
        });

        setIsSubmitting(true);
        await tx([msg], {
            onSuccess: (submitResult) => {
                //add 2 to block height, that's when the blockchain checks if the user is a raffle winner.
                addPendingRaffleContribution(denom, submitResult.height, toBigNumber(numContributions).toNumber(), false)
            }
        });
        setIsSubmitting(false);
        onClose();

    }, [address, numContributions, hasEnoughBalance, totalCost, ticker, denom, tx, onClose, toast, addPendingRaffleContribution]);

    const handleClose = () => {
        if (!isSubmitting) {
            onClose();
        }
    };

    const isFormValid = useMemo(() => {
        const tickets = toBigNumber(numContributions);
        return address && !tickets.isNaN() && tickets.gt(0) && hasEnoughBalance && !contributionsError;
    }, [address, numContributions, hasEnoughBalance, contributionsError]);

    return (
        <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && handleClose()}>
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content
                        maxW={{ base: "90vw", md: "500px" }}
                        borderRadius="2xl"
                    >
                        <Dialog.Header>
                            <Dialog.Title fontSize="xl" fontWeight="black">
                                🔥 {raffleName}
                            </Dialog.Title>
                        </Dialog.Header>

                        <Dialog.Body>
                            <VStack gap="5" align="stretch">
                                {/* Prize Display */}
                                <Box
                                    p="5"
                                    bgGradient="to-br"
                                    gradientFrom="yellow.100"
                                    gradientTo="orange.100"
                                    _dark={{
                                        gradientFrom: "yellow.900/30",
                                        gradientTo: "orange.900/30",
                                    }}
                                    borderRadius="xl"
                                    textAlign="center"
                                >
                                    <VStack gap="2">
                                        <Text fontSize="sm" fontWeight="bold" color="orange.600" _dark={{ color: "orange.400" }}>
                                            🏆 Current Prize
                                        </Text>
                                        <Text fontSize="3xl" fontWeight="black" color="orange.500">
                                            {currentPrize} {ticker}
                                        </Text>
                                        <Text fontSize="xs" color="fg.muted">
                                            Your chance: {winChance}
                                        </Text>
                                    </VStack>
                                </Box>

                                {/* Available Balance */}
                                {address && asset && (
                                    <Box
                                        p="3"
                                        bg="orange.50"
                                        _dark={{
                                            bg: "gray.800",
                                        }}
                                        borderRadius="lg"
                                    >
                                        <HStack justify="space-between">
                                            <Text fontSize="sm" fontWeight="medium">
                                                Available Balance:
                                            </Text>
                                            <Text fontSize="sm" fontWeight="bold" color="orange.500" _dark={{ color: "orange.300" }}>
                                                {userBalance.toFixed(2)} {ticker}
                                            </Text>
                                        </HStack>
                                    </Box>
                                )}

                                {/* Number of Contributions */}
                                <Box>
                                    <Field.Root invalid={!!contributionsError}>
                                        <Field.Label fontWeight="semibold">Number of Contributions</Field.Label>
                                        <Input
                                            size="lg"
                                            type="text"
                                            min="1"
                                            value={numContributions}
                                            onChange={(e) => handleContributionsChange(sanitizeIntegerInput(e.target.value))}
                                            placeholder="1"
                                            disabled={isSubmitting || !address}
                                        />
                                        <Field.HelperText fontSize="xs" color="fg.muted">
                                            {contributionPrice} {ticker} per contribution
                                        </Field.HelperText>
                                        {contributionsError && <Field.ErrorText>{contributionsError}</Field.ErrorText>}
                                    </Field.Root>
                                </Box>

                                {/* Total Cost */}
                                <Box
                                    p="3"
                                    bg="orange.50"
                                    _dark={{ bg: "gray.800" }}
                                    borderRadius="lg"
                                >
                                    <HStack justify="space-between">
                                        <Text fontSize="sm" fontWeight="medium">
                                            Total Cost:
                                        </Text>
                                        <Text fontSize="lg" fontWeight="bold" color="orange.500">
                                            {totalCost.toFixed(2)} {ticker}
                                        </Text>
                                    </HStack>
                                </Box>

                                {/* Warning */}
                                <Box
                                    p="3"
                                    bg="yellow.50"
                                    _dark={{ bg: "gray.800" }}
                                    borderRadius="lg"
                                >
                                    <HStack gap="2">
                                        <Text fontSize="lg">⚠️</Text>
                                        <Text fontSize="xs" color="fg.muted">
                                            Remember: More contributions increase your chances, but don&apos;t guarantee you&apos;ll win!
                                        </Text>
                                    </HStack>
                                </Box>
                            </VStack>
                        </Dialog.Body>

                        <Dialog.Footer>
                            <HStack gap="3" width="full">
                                <Button
                                    flex="1"
                                    variant="outline"
                                    onClick={onClose}
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    flex="1"
                                    size="lg"
                                    colorPalette="purple"
                                    onClick={handleJoinRaffle}
                                    disabled={!isFormValid || isSubmitting}
                                    loading={isSubmitting}
                                    loadingText="Joining..."
                                    fontWeight="black"
                                >
                                    🎫 Join Raffle
                                </Button>
                            </HStack>
                        </Dialog.Footer>

                        <Dialog.CloseTrigger disabled={isSubmitting} />

                        {/* Add spinning animation */}
                        <style jsx global>{`
                            @keyframes spin {
                                from { transform: rotate(0deg); }
                                to { transform: rotate(360deg); }
                            }
                        `}</style>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    );
};
