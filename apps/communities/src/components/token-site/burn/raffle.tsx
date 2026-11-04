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
import {
    entrySummary,
    type RaffleEntry,
    raffleOdds,
    rafflePrize,
    raffleShare,
    ticketsProblem,
    ticketStrip,
    type UpcomingTicket,
} from "@/lib/token-site/raffle";
import {walletAmount} from "@/lib/token-site/wallet";

import {TsButton, TsCard, TsDialog, TsField, TsNotice, TsTag, ts, tsMix} from "../kit";

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

/** The raffle's title, rules, facts (one row on wide screens) and "Buy tickets" (Business Logic R11). */
function RaffleCard({asset, raffle, onBuy}: { asset: Asset; raffle: RaffleSDKType; onBuy: () => void }) {
    const {hourEpochInfo} = useEpochs();
    const odds = raffleOdds(raffle.chances);
    const ends = hourEpochInfo ? formatTimeRemainingFromEpochs(raffle.end_at, hourEpochInfo.current_epoch) : "—";

    return (
        <Flex direction="column" gap="16px" data-testid="raffle-card">
            <Flex align="center" gap="12px">
                <chakra.h3 m="0" fontWeight={700} fontSize="20px">Burn raffle</chakra.h3>
                <TsTag>Live</TsTag>
            </Flex>
            <chakra.p m="0" color={ts.muted} fontSize="15px" lineHeight="1.5" maxW="720px" data-testid="raffle-copy">
                {/* One string: the production build dropped the space after an inline expression here. */}
                {`Each ticket has a ${odds} chance to win ${raffleShare(raffle.ratio)} of the pot. Losing tickets grow the pot, `
                    + "and what's left when the raffle ends is burned."}
            </chakra.p>
            <chakra.div
                display="grid"
                gridTemplateColumns={{base: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))", lg: "repeat(5, minmax(0, 1fr))"}}
                gap="12px"
                px="16px"
                py="14px"
                borderRadius="12px"
                bg={ts.inset}
                data-testid="raffle-facts"
            >
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
            <TsButton variant="primary" alignSelf={{base: "stretch", sm: "flex-start"}} onClick={onBuy}>Buy tickets</TsButton>
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

/**
 * The drawing ticket pulses in the token's colour and a result flashes once as it lands; both stop
 * for people who ask for reduced motion. Plain CSS so the keyframes need no runtime injection.
 */
const RAFFLE_MOTION_CSS = `
@keyframes ts-raffle-pulse {
    0%, 100% { box-shadow: 0 0 0 0 color-mix(in oklab, var(--ts-pri) 55%, transparent); }
    50% { box-shadow: 0 0 0 6px color-mix(in oklab, var(--ts-pri) 0%, transparent); }
}
@keyframes ts-raffle-flash-won {
    from { background-color: color-mix(in oklab, var(--ts-pri) 55%, var(--ts-bg)); }
}
@keyframes ts-raffle-flash-lost {
    from { background-color: color-mix(in oklab, var(--ts-muted) 35%, var(--ts-bg)); }
}
.ts-raffle-drawing { animation: ts-raffle-pulse 1.6s ease-in-out infinite; }
.ts-raffle-flash-won { animation: ts-raffle-flash-won 1.2s ease-out 1; }
.ts-raffle-flash-lost { animation: ts-raffle-flash-lost 1.2s ease-out 1; }
@media (prefers-reduced-motion: reduce) {
    .ts-raffle-drawing, .ts-raffle-flash-won, .ts-raffle-flash-lost { animation: none; }
}
`;

const ticketStatus = ({blocksAway}: UpcomingTicket) =>
    (blocksAway === 0 ? "Drawing…" : `in ${blocksAway} ${blocksAway === 1 ? "block" : "blocks"}`);

/**
 * The connected wallet's tickets in the raffle slot: the next five to be drawn with how many blocks
 * away each is (the drawing one pulses), how far the draw is, and each drawn ticket won or lost
 * with a summary. Fully drawn joins stay for an hour.
 */
function YourTickets({asset, entries, height, readFailing}: { asset: Asset; entries: RaffleEntry[]; height?: number; readFailing: boolean }) {
    // Results that land while the page is open flash once; those restored from storage don't.
    const [shownAt] = useState(() => Date.now());
    const strip = ticketStrip(entries, height);
    if (strip.total === 0) return null;

    const finished = strip.upcoming.length === 0;
    const summary = strip.won > 0
        ? `${strip.won} ${strip.won === 1 ? "ticket" : "tickets"} won · ${tAmount(asset, strip.amount)}`
        : finished ? "No winning ticket this time" : "No win yet";

    return (
        <Flex direction="column" gap="10px" data-testid="raffle-tickets">
            <style>{RAFFLE_MOTION_CSS}</style>
            <Flex justify="space-between" align="baseline" gap="12px">
                <chakra.h4 m="0" fontSize="14px" fontWeight={600} color={ts.muted}>Your tickets</chakra.h4>
                <chakra.span fontSize="13px" fontVariantNumeric="tabular-nums" color={ts.muted} aria-live="polite" data-testid="raffle-tickets-progress">
                    {strip.drawn} of {strip.total} drawn
                </chakra.span>
            </Flex>
            {!finished && readFailing && (
                <chakra.span role="status" fontSize="13px" color={ts.danger} data-testid="raffle-read-failing">
                    {"Can't read the chain right now, retrying…"}
                </chakra.span>
            )}
            {!finished && (
                <chakra.ol m="0" p="0" listStyleType="none" display="flex" flexWrap="wrap" gap="8px" data-testid="raffle-strip">
                    {strip.upcoming.map((ticket) => {
                        const drawing = ticket.blocksAway === 0;

                        return (
                            <chakra.li
                                key={ticket.number}
                                className={drawing ? "ts-raffle-drawing" : undefined}
                                display="flex"
                                flexDirection="column"
                                gap="2px"
                                minW="92px"
                                px="12px"
                                py="8px"
                                borderRadius="12px"
                                bg={drawing ? tsMix(ts.pri, 14) : ts.inset}
                                borderWidth="1px"
                                borderStyle="solid"
                                borderColor={drawing ? tsMix(ts.pri, 60) : "transparent"}
                                aria-current={drawing ? "step" : undefined}
                                data-testid={`raffle-strip-ticket-${ticket.number}`}
                            >
                                <chakra.span fontSize="12px" color={ts.muted}>Ticket {ticket.number}</chakra.span>
                                <chakra.span fontSize="13px" fontWeight={600} color={drawing ? ts.fg : ts.muted} data-testid="raffle-strip-status">
                                    {ticketStatus(ticket)}
                                </chakra.span>
                            </chakra.li>
                        );
                    })}
                    {strip.more > 0 && (
                        <chakra.li alignSelf="center" px="4px" fontSize="13px" color={ts.muted} data-testid="raffle-strip-more">+{strip.more} more</chakra.li>
                    )}
                </chakra.ol>
            )}
            {strip.results.length > 0 && (
                <chakra.ul m="0" p="0" listStyleType="none" display="flex" flexWrap="wrap" gap="6px" maxH="132px" overflowY="auto" data-testid="raffle-drawn">
                    {strip.results.map(({number, result}) => (
                        <chakra.li
                            key={number}
                            className={result.at !== undefined && result.at >= shownAt ? (result.won ? "ts-raffle-flash-won" : "ts-raffle-flash-lost") : undefined}
                            px="10px"
                            py="4px"
                            borderRadius="999px"
                            fontSize="12px"
                            fontWeight={600}
                            fontVariantNumeric="tabular-nums"
                            bg={result.won ? tsMix(ts.pri, 18) : ts.inset}
                            color={result.won ? ts.fg : ts.muted}
                            data-result={result.won ? "won" : "lost"}
                            data-testid={`raffle-drawn-ticket-${number}`}
                        >
                            #{number} {result.won ? `Won ${tAmount(asset, result.amount)}` : "No win"}
                        </chakra.li>
                    ))}
                </chakra.ul>
            )}
            {strip.drawn > 0 && (
                <chakra.span fontSize="14px" fontWeight={600} fontVariantNumeric="tabular-nums" data-testid="raffle-tickets-summary">{summary}</chakra.span>
            )}
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
                <TsNotice>You can close this window: the tickets still drawing show under Next burn and as notifications.</TsNotice>
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
 * The Burn section's raffle card, full width under the burn cards (Business Logic R11): T's raffle,
 * the connected wallet's tickets drawing block by block, its recent winners (a side column on wide
 * screens, below on phones) and the ticket dialog, or nothing when the burner runs no raffle for T.
 * Ticket results keep resolving here while the dialog is closed.
 */
export function BurnRaffle({asset}: { asset: Asset }) {
    const tokenRaffle = useTokenRaffle(asset.denom);
    const [dialogOpen, setDialogOpen] = useState(false);
    const {raffle, winners, entries, height, readFailing, isLoading} = tokenRaffle;

    // Tickets already bought keep drawing (and their results stay) even once the raffle is gone.
    if (!raffle) {
        if (entries.length === 0) return null;

        return (
            <TsCard p={{base: "24px", md: "28px"}} display="flex" flexDirection="column" gap="16px" data-testid="burn-raffle">
                {!isLoading && (
                    <chakra.p m="0" color={ts.muted} fontSize="15px" lineHeight="1.5" data-testid="raffle-ended">
                        The {asset.ticker} burn raffle has ended. Tickets bought before still draw here.
                    </chakra.p>
                )}
                <YourTickets asset={asset} entries={entries} height={height} readFailing={readFailing}/>
            </TsCard>
        );
    }

    return (
        <TsCard
            p={{base: "24px", md: "28px"}}
            display="grid"
            gridTemplateColumns={{base: "minmax(0, 1fr)", lg: winners.length > 0 ? "minmax(0, 1fr) 280px" : "minmax(0, 1fr)"}}
            gap={{base: "24px", lg: "32px"}}
            data-testid="burn-raffle"
        >
            <Flex direction="column" gap="20px" minW="0">
                <RaffleCard asset={asset} raffle={raffle} onBuy={() => setDialogOpen(true)}/>
                <YourTickets asset={asset} entries={entries} height={height} readFailing={readFailing}/>
            </Flex>
            {winners.length > 0 && (
                <chakra.aside
                    minW="0"
                    borderStyle="solid"
                    borderColor={ts.border}
                    borderTopWidth={{base: "1px", lg: "0"}}
                    borderLeftWidth={{base: "0", lg: "1px"}}
                    pt={{base: "20px", lg: "0"}}
                    pl={{base: "0", lg: "28px"}}
                >
                    <RecentWinners asset={asset} winners={winners}/>
                </chakra.aside>
            )}
            {dialogOpen && <RaffleDialog asset={asset} raffle={raffle} tokenRaffle={tokenRaffle} onClose={() => setDialogOpen(false)}/>}
        </TsCard>
    );
}
