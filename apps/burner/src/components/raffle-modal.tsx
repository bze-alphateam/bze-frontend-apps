'use client';

import {
    Button,
    chakra,
    Field,
    Flex,
    Input,
} from "@chakra-ui/react";
import {LuTicket} from "react-icons/lu";
import { useState, useMemo, useCallback } from "react";
import { useChain } from "@interchain-kit/react";
import { getChainName, useToast, useBZETx, useBalance, useCanAffordTx, toBigNumber, uAmountToBigNumberAmount, sanitizeIntegerInput, useAsset, FeaturedCard, Notice, hgVariant } from "@bze/bze-ui-kit";
import { bze } from '@bze/bzejs';
import BigNumber from "bignumber.js";
import {useRaffleContributions} from "@/hooks/useRaffles";
import {BurnerDialog, InsetRow} from "@/components/ui/burner/dialog";

interface RaffleModalProps {
    isOpen: boolean;
    onClose: () => void;
    raffleName: string;
    contributionPrice: string; // display only
    ticketPrice: string; // micro units per ticket, exactly as the chain stores it
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
    ticketPrice,
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

    // Reset the form each time the modal opens. Adjusted during render instead of in an
    // effect (React's "adjust state while rendering" pattern).
    const [wasOpen, setWasOpen] = useState(isOpen);
    if (isOpen !== wasOpen) {
        setWasOpen(isOpen);
        if (isOpen) {
            setNumContributions("1");
            setIsSubmitting(false);
            setContributionsError("");
        }
    }

    const decimals = asset?.decimals ?? 6;

    // Total cost in micro units: exactly what the chain charges (ticket_price x tickets).
    const totalCostMicro = useMemo(() => {
        const tickets = toBigNumber(numContributions);
        const price = toBigNumber(ticketPrice);
        if (tickets.isNaN() || price.isNaN() || !tickets.isInteger()) return BigNumber(0);
        return tickets.multipliedBy(price);
    }, [numContributions, ticketPrice]);

    const totalCost = useMemo(() => uAmountToBigNumberAmount(totalCostMicro, decimals), [totalCostMicro, decimals]);

    // Check if user has enough balance
    const userBalance = useMemo(() => {
        if (!asset) return BigNumber(0);
        return uAmountToBigNumberAmount(balance.amount, decimals);
    }, [balance, asset, decimals]);

    // Tickets plus the gas fee must fit the balance (gas matters when the raffle coin is the
    // fee coin, e.g. a BZE raffle).
    const affordability = useCanAffordTx({
        spec: totalCostMicro.gt(0) ? 'join-raffle' : undefined,
        spend: totalCostMicro.gt(0) ? { denom, amount: totalCostMicro.toFixed(0) } : undefined,
    });

    const hasEnoughBalance = useMemo(() => {
        return userBalance.gte(totalCost) && affordability.canAfford;
    }, [userBalance, totalCost, affordability.canAfford]);

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
            setContributionsError(affordability.shortOnFees
                ? affordability.message
                : `Not enough balance! You need ${totalCost.toFixed(2)} ${ticker}`);
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

    }, [address, numContributions, hasEnoughBalance, affordability.shortOnFees, affordability.message, totalCost, ticker, denom, tx, onClose, toast, addPendingRaffleContribution]);

    const isFormValid = useMemo(() => {
        const tickets = toBigNumber(numContributions);
        return address && !tickets.isNaN() && tickets.gt(0) && hasEnoughBalance && !contributionsError;
    }, [address, numContributions, hasEnoughBalance, contributionsError]);

    return (
        <BurnerDialog
            isOpen={isOpen}
            onClose={onClose}
            busy={isSubmitting}
            title={raffleName}
            footer={
                <>
                    <Button flex="1" variant={hgVariant('secondary')} onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button
                        flex="1"
                        variant={hgVariant('primary')}
                        onClick={handleJoinRaffle}
                        disabled={!isFormValid || isSubmitting}
                        loading={isSubmitting}
                        loadingText="Joining..."
                    >
                        <LuTicket /> Join raffle
                    </Button>
                </>
            }
        >
            <FeaturedCard textAlign="center" py="20px">
                <Flex direction="column" align="center" gap="4px">
                    <chakra.span textStyle="eyebrow" color="hg.eyebrow">Current prize</chakra.span>
                    <chakra.span fontSize="28px" fontWeight="800" color="hg.link" overflowWrap="anywhere">{currentPrize} {ticker}</chakra.span>
                    <chakra.span fontSize="13px" color="hg.text.faint">Your chance: {winChance}</chakra.span>
                </Flex>
            </FeaturedCard>

            {address && asset && (
                <InsetRow label="Available Balance:">{userBalance.toFixed(2)} {ticker}</InsetRow>
            )}

            <Field.Root invalid={!!contributionsError}>
                <Field.Label fontWeight="600">Number of Contributions</Field.Label>
                <Input
                    size="lg"
                    borderRadius="hg.md"
                    type="text"
                    inputMode="numeric"
                    min="1"
                    value={numContributions}
                    onChange={(e) => handleContributionsChange(sanitizeIntegerInput(e.target.value))}
                    placeholder="1"
                    disabled={isSubmitting || !address}
                />
                <Field.HelperText fontSize="12px" color="hg.text.faint">
                    {contributionPrice} {ticker} per contribution
                </Field.HelperText>
                {contributionsError && <Field.ErrorText>{contributionsError}</Field.ErrorText>}
            </Field.Root>

            <InsetRow label="Total Cost:">{totalCost.toFixed(2)} {ticker}</InsetRow>

            <Notice status="warning">
                {"Remember: More contributions increase your chances, but don't guarantee you'll win!"}
            </Notice>
        </BurnerDialog>
    );
};
