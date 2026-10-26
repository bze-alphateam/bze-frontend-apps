'use client';

import React, {useState} from "react";
import BigNumber from "bignumber.js";
import {chakra, Flex} from "@chakra-ui/react";
import {useChain} from "@interchain-kit/react";
import {WalletState} from "@interchain-kit/core";
import type {RaffleSDKType, RaffleWinnerSDKType} from "@bze/bzejs/bze/burner/raffle";
import {
    type Asset,
    formatTimeRemainingFromEpochs,
    getChainName,
    sanitizeIntegerInput,
    truncateAddress,
    uAmountToBigNumberAmount,
    useCanAffordTx,
    useEpochs,
    useMaxSpendable,
} from "@bze/bze-ui-kit";

import {type TokenRaffle, useTokenRaffle} from "@/hooks/token-site/useTokenRaffle";
import {entrySummary, type RaffleEntry, raffleOdds, rafflePrize, raffleShare, ticketsProblem} from "@/lib/token-site/raffle";
import {walletAmount} from "@/lib/token-site/wallet";

import {TsButton, TsDialog, TsField, TsNotice, TsTag, ts, tsMix} from "../kit";

function Fact({label, value, testId}: { label: string; value: React.ReactNode; testId: string }) {
    return (
        <Flex direction="column" gap="4px" minW="0">
            <chakra.span color={ts.muted} fontSize="13px">{label}</chakra.span>
            <chakra.span fontWeight={600} fontVariantNumeric="tabular-nums" overflowWrap="anywhere" data-testid={testId}>{value}</chakra.span>
        </Flex>
    );
}

function Row({label, children}: { label: string; children: React.ReactNode }) {
    return (
        <Flex justify="space-between" gap="12px" fontSize="14px">
            <chakra.span color={ts.muted}>{label}</chakra.span>
            <chakra.span fontWeight={600} fontVariantNumeric="tabular-nums" textAlign="right">{children}</chakra.span>
        </Flex>
    );
}

const tAmount = (asset: Asset, uAmount: BigNumber.Value) =>
    `${walletAmount(uAmountToBigNumberAmount(new BigNumber(uAmount), asset.decimals))} ${asset.ticker}`;

/** The raffle's facts and "Buy tickets", under the next burn (Business Logic R11). */
function RaffleCard({asset, raffle, onBuy}: { asset: Asset; raffle: RaffleSDKType; onBuy: () => void }) {
    const {hourEpochInfo} = useEpochs();
    const odds = raffleOdds(raffle.chances);
    const ends = hourEpochInfo ? formatTimeRemainingFromEpochs(raffle.end_at, hourEpochInfo.current_epoch) : "—";

    return (
        <Flex direction="column" gap="12px" data-testid="raffle-card">
            <Flex justify="space-between" align="center" gap="12px">
                <chakra.h3 m="0" fontWeight={700} fontSize="18px">Burn raffle</chakra.h3>
                <TsTag>Live</TsTag>
            </Flex>
            <chakra.p m="0" color={ts.muted} fontSize="15px" lineHeight="1.5" data-testid="raffle-copy">
                {/* One string: the production build dropped the space after an inline expression here. */}
                {`Each ticket has a ${odds} chance to win ${raffleShare(raffle.ratio)} of the pot. Losing tickets grow the pot, `
                    + "and what's left when the raffle ends is burned."}
            </chakra.p>
            <chakra.div display="grid" gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap="12px" px="16px" py="14px" borderRadius="12px" bg={ts.inset}>
                <Fact label="Ticket" value={tAmount(asset, raffle.ticket_price)} testId="raffle-ticket"/>
                <Fact label="Current pot" value={tAmount(asset, raffle.pot)} testId="raffle-pot"/>
                <Fact label="Win chance" value={odds} testId="raffle-odds"/>
                <Fact
                    label="Prize now"
                    value={`${walletAmount(rafflePrize(raffle.pot, raffle.ratio, asset.decimals))} ${asset.ticker}`}
                    testId="raffle-prize"
                />
                <Fact label="Ends in" value={ends} testId="raffle-ends"/>
            </chakra.div>
            <TsButton variant="secondary" onClick={onBuy}>Buy tickets</TsButton>
        </Flex>
    );
}

function RecentWinners({asset, winners}: { asset: Asset; winners: RaffleWinnerSDKType[] }) {
    if (winners.length === 0) return null;

    return (
        <Flex direction="column" gap="8px" data-testid="raffle-winners">
            <chakra.h4 m="0" fontSize="14px" fontWeight={600} color={ts.muted}>Recent winners</chakra.h4>
            <chakra.ul m="0" p="0" listStyleType="none" display="flex" flexDirection="column" gap="6px">
                {winners.map((winner) => (
                    <chakra.li key={winner.index} display="flex" justifyContent="space-between" gap="12px" fontSize="14px">
                        <chakra.span fontVariantNumeric="tabular-nums">{truncateAddress(winner.winner)}</chakra.span>
                        <chakra.span fontWeight={600} fontVariantNumeric="tabular-nums">{tAmount(asset, winner.amount)}</chakra.span>
                    </chakra.li>
                ))}
            </chakra.ul>
        </Flex>
    );
}

interface TicketFormProps {
    asset: Asset;
    raffle: RaffleSDKType;
    join: TokenRaffle["join"];
    onJoined: (id: string) => void;
}

/** How many tickets: each costs the ticket price, and the total must leave the network fee. */
function TicketForm({asset, raffle, join, onJoined}: TicketFormProps) {
    const [input, setInput] = useState("1");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const maxSpendable = useMaxSpendable(asset.denom, "join-raffle");

    const price = new BigNumber(raffle.ticket_price);
    const tickets = new BigNumber(input);
    const cost = tickets.isInteger() && tickets.gt(0) ? tickets.multipliedBy(price) : undefined;
    const problem = maxSpendable.isLoading ? "" : ticketsProblem(input, price, maxSpendable.amount, asset.ticker);
    const afford = useCanAffordTx({
        spec: cost && !problem ? "join-raffle" : undefined,
        spend: cost && !problem ? {denom: asset.denom, amount: cost.toFixed(0)} : undefined,
    });
    const error = problem || (cost && !afford.isLoading && !afford.canAfford ? afford.message : "");
    const canJoin = Boolean(cost) && !error && !maxSpendable.isLoading && !afford.isLoading && !isSubmitting;

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!canJoin) return;

        setIsSubmitting(true);
        try {
            const id = await join(tickets.toNumber());
            if (id) onJoined(id);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <chakra.form onSubmit={submit} display="flex" flexDirection="column" gap="12px" noValidate data-testid="raffle-form">
            <TsField
                label="Tickets"
                inputMode="numeric"
                placeholder="1"
                value={input}
                onChange={(event) => setInput(sanitizeIntegerInput(event.target.value))}
                aria-invalid={error !== ""}
                aria-describedby={error ? "raffle-tickets-error" : undefined}
            />
            {error && <chakra.span id="raffle-tickets-error" role="alert" fontSize="13px" color={ts.danger} px="4px">{error}</chakra.span>}
            <Flex direction="column" gap="8px" borderRadius="14px" px="16px" py="14px" bg={ts.inset}>
                <Row label="Ticket price">{tAmount(asset, price)}</Row>
                <Row label="Total cost">{cost ? tAmount(asset, cost) : "—"}</Row>
                <Row label="Each ticket's chance">{raffleOdds(raffle.chances)}</Row>
                <Row label="Your balance">{tAmount(asset, maxSpendable.balance)}</Row>
            </Flex>
            <chakra.p m="0" color={ts.muted} fontSize="13px" lineHeight="1.5">
                Every ticket is drawn on its own, one per block, and most tickets lose. The price of a losing ticket goes
                to the pot, which is burned when the raffle ends.
            </chakra.p>
            <TsButton type="submit" variant="primary" w="100%" minH="52px" fontSize="16px" disabled={!canJoin}>
                {isSubmitting ? "Waiting for signature…" : `Buy ${cost && tickets.gt(1) ? `${tickets.toFormat()} tickets` : "a ticket"}`}
            </TsButton>
        </chakra.form>
    );
}

/** Each ticket of a join, drawn block by block: won (amount), no win, or still drawing. */
function TicketResults({asset, entry, onMore, onClose}: { asset: Asset; entry: RaffleEntry; onMore: () => void; onClose: () => void }) {
    const summary = entrySummary(entry);

    return (
        <Flex direction="column" gap="16px" data-testid="raffle-results">
            <chakra.p m="0" fontWeight={600} aria-live="polite" data-testid="raffle-results-summary">
                {summary.pending > 0
                    ? `Drawing ${entry.tickets === 1 ? "your ticket" : `your ${entry.tickets} tickets`}, one per block…`
                    : summary.won > 0
                        ? `${summary.won} of ${entry.tickets} won · ${tAmount(asset, summary.amount)}`
                        : `No winning ticket this time. ${entry.tickets === 1 ? "Its price" : "Their price"} went to the pot.`}
            </chakra.p>
            <chakra.ol m="0" p="0" listStyleType="none" display="flex" flexDirection="column" gap="6px" maxH="280px" overflowY="auto">
                {Array.from({length: entry.tickets}, (_, index) => {
                    const result = entry.results[index];
                    const label = !result ? "Drawing…" : result.won ? `Won ${tAmount(asset, result.amount)}` : "No win";

                    return (
                        <chakra.li
                            key={index}
                            display="flex"
                            justifyContent="space-between"
                            gap="12px"
                            px="14px"
                            py="10px"
                            borderRadius="12px"
                            bg={result?.won ? tsMix(ts.pri, 14) : ts.inset}
                            borderWidth="1px"
                            borderStyle="solid"
                            borderColor={result?.won ? tsMix(ts.pri, 40) : "transparent"}
                            data-testid={`raffle-ticket-${index + 1}`}
                        >
                            <chakra.span>Ticket {index + 1}</chakra.span>
                            <chakra.span fontWeight={600} color={result ? ts.fg : ts.muted}>{label}</chakra.span>
                        </chakra.li>
                    );
                })}
            </chakra.ol>
            {summary.pending > 0 && (
                <TsNotice>You can close this window: the results that are still drawing will appear as notifications.</TsNotice>
            )}
            <Flex gap="12px" wrap="wrap">
                <TsButton variant="primary" flex="1" onClick={onMore}>Buy more tickets</TsButton>
                <TsButton variant="ghost" flex="1" onClick={onClose}>Done</TsButton>
            </Flex>
        </Flex>
    );
}

interface RaffleDialogProps {
    asset: Asset;
    raffle: RaffleSDKType;
    tokenRaffle: TokenRaffle;
    onClose: () => void;
}

/** "Buy tickets": the ticket form, then the result of that join; a connect prompt without a wallet. */
function RaffleDialog({asset, raffle, tokenRaffle, onClose}: RaffleDialogProps) {
    const {status, address, connect} = useChain(getChainName());
    const connected = status === WalletState.Connected && Boolean(address);
    const [entryId, setEntryId] = useState<string>();
    const entry = tokenRaffle.entries.find((candidate) => candidate.id === entryId);

    // Results of a join nobody is looking at any more come as notifications.
    const leave = () => {
        if (entryId) tokenRaffle.watch(entryId, false);
    };
    const close = () => {
        leave();
        onClose();
    };

    let body: React.ReactNode;
    if (!connected) {
        body = (
            <Flex direction="column" gap="16px" data-testid="raffle-connect-prompt">
                <chakra.p m="0" color={ts.muted} lineHeight="1.55">Connect a wallet to buy {asset.ticker} raffle tickets.</chakra.p>
                <TsButton
                    variant="primary"
                    minH="52px"
                    fontSize="16px"
                    onClick={() => {
                        // The connect modal would open under the dialog.
                        onClose();
                        connect();
                    }}
                >
                    Connect wallet
                </TsButton>
            </Flex>
        );
    } else if (entry) {
        body = (
            <TicketResults
                asset={asset}
                entry={entry}
                onMore={() => {
                    leave();
                    setEntryId(undefined);
                }}
                onClose={close}
            />
        );
    } else {
        body = <TicketForm asset={asset} raffle={raffle} join={tokenRaffle.join} onJoined={setEntryId}/>;
    }

    return (
        <TsDialog open onClose={close} title={entry ? "Your raffle tickets" : `${asset.ticker} burn raffle`}>
            {body}
        </TsDialog>
    );
}

/**
 * The Burn section's raffle slot (Business Logic R11): T's raffle card, its recent winners and the
 * ticket dialog, or nothing when the burner runs no raffle for T. Ticket results keep resolving
 * here while the dialog is closed.
 */
export function BurnRaffle({asset}: { asset: Asset }) {
    const tokenRaffle = useTokenRaffle(asset.denom);
    const [dialogOpen, setDialogOpen] = useState(false);
    const {raffle, winners} = tokenRaffle;

    if (!raffle) return null;

    return (
        <Flex direction="column" gap="18px" borderTopWidth="1px" borderStyle="solid" borderColor={ts.border} pt="18px">
            <RaffleCard asset={asset} raffle={raffle} onBuy={() => setDialogOpen(true)}/>
            <RecentWinners asset={asset} winners={winners}/>
            {dialogOpen && <RaffleDialog asset={asset} raffle={raffle} tokenRaffle={tokenRaffle} onClose={() => setDialogOpen(false)}/>}
        </Flex>
    );
}
