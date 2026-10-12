'use client';

import React, {useState} from "react";
import BigNumber from "bignumber.js";
import {chakra, Flex} from "@chakra-ui/react";
import {useChain} from "@interchain-kit/react";
import {cosmos} from "@bze/bzejs";
import {
    type Asset,
    amountToUAmount,
    getChainName,
    sanitizeNumberInput,
    uAmountToBigNumberAmount,
    useBalance,
    useCanAffordTx,
    useMaxSpendable,
    useSDKTx,
    validateBZEBech32Address,
} from "@bze/bze-ui-kit";

import {TsButton, TsField, ts} from "../kit";

const {send} = cosmos.bank.v1beta1.MessageComposer.withTypeUrl;

/** Why `amount` (display units) can't be sent, or '' when it can as far as the balance goes. */
function amountProblem(amount: string, balance: BigNumber, decimals: number): string {
    const value = new BigNumber(amount);
    if (value.isNaN() || !value.gt(0)) return "Enter an amount above 0";
    if ((value.decimalPlaces() ?? 0) > decimals) return `Use at most ${decimals} decimals`;
    if (value.gt(balance)) return "Insufficient balance";

    return "";
}

function FieldError({id, children}: { id: string; children: React.ReactNode }) {
    return <chakra.span id={id} role="alert" fontSize="13px" color={ts.danger} px="4px">{children}</chakra.span>;
}

/**
 * Sends T only (Business Logic R4). Max holds back the network fee when the fee is paid in T,
 * and an amount that leaves no room for the fee is refused.
 */
export function SendForm({asset}: { asset: Asset }) {
    const {address} = useChain(getChainName());
    const {tx, progressTrack} = useSDKTx(getChainName());
    const {balance} = useBalance(asset.denom);
    const maxSpendable = useMaxSpendable(asset.denom, "send");
    const [recipient, setRecipient] = useState("");
    const [amount, setAmount] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const affordability = useCanAffordTx({
        spec: amount !== "" ? "send" : undefined,
        spend: amount !== "" ? {denom: asset.denom, amount: amountToUAmount(amount, asset.decimals)} : undefined,
    });

    const recipientError = recipient === "" ? "" : validateBZEBech32Address(recipient).message;
    const amountError = amount === ""
        ? ""
        : amountProblem(amount, uAmountToBigNumberAmount(balance.amount, asset.decimals), asset.decimals) || affordability.message;
    const canSend = Boolean(address) && recipient !== "" && amount !== "" && !recipientError && !amountError
        && !affordability.isLoading && !isSubmitting;

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!canSend || !address) return;

        setIsSubmitting(true);
        try {
            const msg = send({
                fromAddress: address,
                toAddress: recipient,
                amount: [{denom: asset.denom, amount: amountToUAmount(amount, asset.decimals)}],
            });
            if (await tx([msg])) {
                setRecipient("");
                setAmount("");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <chakra.form onSubmit={submit} display="flex" flexDirection="column" gap="12px" noValidate>
            <TsField
                label="Recipient"
                placeholder="bze1…"
                fontSize="16px"
                autoComplete="off"
                spellCheck={false}
                value={recipient}
                onChange={(event) => setRecipient(event.target.value.trim())}
                aria-invalid={recipientError !== ""}
                aria-describedby={recipientError ? "send-recipient-error" : undefined}
            />
            {recipientError && <FieldError id="send-recipient-error">{recipientError}</FieldError>}
            <TsField
                label="Amount"
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={(event) => setAmount(sanitizeNumberInput(event.target.value))}
                aria-invalid={amountError !== ""}
                aria-describedby={amountError ? "send-amount-error" : undefined}
                suffix={asset.ticker}
            />
            <Flex justify="space-between" align="center" gap="8px" px="4px">
                {amountError ? <FieldError id="send-amount-error">{amountError}</FieldError> : <span/>}
                <chakra.button
                    type="button"
                    onClick={() => setAmount(maxSpendable.inputValue)}
                    disabled={maxSpendable.isLoading || !maxSpendable.amount.gt(0)}
                    font="inherit"
                    fontSize="13px"
                    fontWeight={600}
                    bg="transparent"
                    border="0"
                    color={ts.fg}
                    cursor="pointer"
                    minH="32px"
                    textDecoration="underline"
                    _disabled={{opacity: 0.5, cursor: "not-allowed"}}
                >
                    Max
                </chakra.button>
            </Flex>
            <TsButton type="submit" variant="primary" w="100%" minH="52px" fontSize="16px" disabled={!canSend}>
                {isSubmitting ? (progressTrack || "Waiting for signature…") : `Send ${asset.ticker}`}
            </TsButton>
        </chakra.form>
    );
}
