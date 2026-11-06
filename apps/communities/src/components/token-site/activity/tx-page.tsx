'use client';

import React, {Suspense, useMemo} from "react";
import {chakra, Flex} from "@chakra-ui/react";
import {useSearchParams} from "next/navigation";
import {LuArrowRight} from "react-icons/lu";
import {type Asset, DEFAULT_DENOM_BRANDING, useAssets} from "@bze/bze-ui-kit";

import {useScanTx} from "@/hooks/token-activity";
import {useTokenWallet} from "@/hooks/token-site/useTokenWallet";
import {useDenomParam} from "@/hooks/useNavigation";
import {
    activityRow,
    formatUnits,
    MSG,
    ScanError,
    type ScanTx,
    tagOf,
    tokenActivityPath,
    tokenHolderPath,
    type TxGroup,
} from "@/lib/token-activity";
import {type DenomAmount, routeDenoms, summarizeTx} from "@/lib/token-activity/tx-summary";

import {TokenSiteTheme, TsButton, TsCard, TsFeaturedCard, TsLinkButton, TsTag, ts, tsLabel, tsMix} from "../kit";
import {AddressChip} from "./holders-table";
import {InnerHero, InnerSite} from "./inner-site";
import {CopyButton, ErrorCard, ListCard, Shimmer} from "./parts";

/** Symbol and exponent of each denom the transaction moved (Scan's), else the app's assets. */
function useDenomInfo(tx: ScanTx) {
    const {denomTicker, denomDecimals} = useAssets();

    return useMemo(() => {
        const known = new Map<string, { symbol: string; exponent: number }>();
        for (const row of tx.transfers) {
            if (row.symbol && row.exponent !== null && !known.has(row.denom)) known.set(row.denom, {symbol: row.symbol, exponent: row.exponent});
        }
        const info = (denom: string) => known.get(denom) ?? {symbol: denomTicker(denom), exponent: denomDecimals(denom)};
        const coin = ({denom, amount}: DenomAmount) => `${formatUnits(amount, info(denom).exponent)} ${info(denom).symbol}`;

        return {info, coins: (list: DenomAmount[]) => list.map(coin).join(" · ")};
    }, [tx, denomTicker, denomDecimals]);
}

const utcDay = (time: string) => new Intl.DateTimeFormat("en-US", {month: "short", day: "numeric", year: "numeric", timeZone: "UTC"}).format(new Date(time));
const utcClock = (time: string, seconds = false) =>
    new Intl.DateTimeFormat("en-GB", {hour: "2-digit", minute: "2-digit", ...(seconds ? {second: "2-digit"} : {}), hour12: false, timeZone: "UTC"}).format(new Date(time));

/** The token rows of the transaction as an Activity group, for the same tag and title as its row. */
function txGroup(tx: ScanTx, denom: string): TxGroup {
    return {
        txHash: tx.hash,
        height: tx.height,
        txIndex: tx.tx_index,
        time: tx.time,
        moves: tx.transfers
            .filter((row) => row.msg_index !== null && row.denom === denom)
            .map((row) => ({
                ...row,
                height: tx.height,
                tx_index: tx.tx_index,
                tx_hash: tx.hash,
                time: tx.time,
                msg_type: tx.messages.find((message) => message.msg_index === row.msg_index)?.type_url ?? null,
            })),
        feeRows: [],
    };
}

interface DetailRow {
    key: string;
    value: React.ReactNode;
}

function TxContent({asset, tx}: { asset: Asset; tx: ScanTx }) {
    const {open} = useTokenWallet();
    const {info, coins} = useDenomInfo(tx);
    const token = {denom: asset.denom, symbol: asset.ticker, exponent: asset.decimals};
    const summary = summarizeTx(tx, asset.denom);
    const group = txGroup(tx, asset.denom);
    const row = group.moves.length > 0 ? activityRow(group, tx, token) : undefined;
    const typeUrl = summary.message?.type_url;
    const tag = row?.tag ?? tagOf(typeUrl);
    const isSwap = typeUrl === MSG.multiSwap;
    const when = `${utcDay(tx.time)} at ${utcClock(tx.time)} UTC`;

    const paid = summary.paid.length > 0 ? coins(summary.paid) : "Nothing";
    const received = summary.received.length > 0 ? coins(summary.received) : "Nothing";
    const headline = isSwap && summary.paid.length > 0 && summary.received.length > 0
        ? `Swapped ${paid} for ${received}`
        : row?.title ?? "Transaction";

    const route = isSwap && summary.paid[0] ? routeDenoms(summary.paid[0].denom, summary.route) : [];
    const pools = summary.route.length;
    const sentence = isSwap && route.length > 1
        ? ` swapped ${info(route[0]).symbol} for ${info(route[route.length - 1]).symbol} through ${pools} ${pools === 1 ? "pool" : "pools"} on ${when}.`
        : ` signed this transaction on ${when}.`;

    // A one-coin swap's rate: what one unit paid bought.
    const rate = isSwap && summary.paid.length === 1 && summary.received.length === 1 ? (() => {
        const [p, r] = [summary.paid[0], summary.received[0]];
        const value = r.amount.shiftedBy(-info(r.denom).exponent).div(p.amount.shiftedBy(-info(p.denom).exponent));
        return value.isFinite() ? `≈ ${value.decimalPlaces(6).toFormat()} ${info(r.denom).symbol} per ${info(p.denom).symbol}` : undefined;
    })() : undefined;

    const details: DetailRow[] = [
        ...(tx.signer ? [{key: "Who", value: <AddressChip address={tx.signer} href={tokenHolderPath(asset.denom, tx.signer)}/>}] : []),
        ...(route.length > 1 ? [{key: "Route", value: `${route.map((denom) => info(denom).symbol).join(" → ")} · ${pools} ${pools === 1 ? "pool" : "pools"}`}] : []),
        ...(summary.swapFees.length > 0 ? [{key: "Swap fees", value: coins(summary.swapFees)}] : []),
        ...(summary.tradingFee.length > 0 ? [{key: "Trading fee", value: coins(summary.tradingFee)}] : []),
        {key: "Network fee", value: summary.networkFee.length > 0 ? coins(summary.networkFee) : "None"},
        ...(tx.memo ? [{key: "Sent from", value: tx.memo}] : []),
        {key: "When", value: `${utcDay(tx.time)} · ${utcClock(tx.time, true)} UTC`},
        {key: "Block", value: tx.height.toLocaleString("en-US")},
        {key: "Status", value: tx.success ? "Confirmed" : `Failed${tx.error_log ? ` · ${tx.error_log}` : ""}`},
        {key: "Messages", value: tx.msg_types.map((type) => tagOf(type)).join(" · ") || "None"},
    ];

    return (
        <>
            <InnerHero
                back={{href: tokenActivityPath(asset.denom), label: `All ${asset.ticker} activity`}}
                eyebrow={
                    <Flex as="span" align="center" gap="10px" wrap="wrap">
                        {`${asset.ticker} transaction`}
                        <TsTag bg={tx.success ? tsMix(ts.pri, 18) : tsMix(ts.danger, 14)} color={ts.fg} letterSpacing="normal" textTransform="none">
                            {tx.success ? "Confirmed" : "Failed"}
                        </TsTag>
                        <TsTag letterSpacing="normal" textTransform="none">{tag}</TsTag>
                    </Flex>
                }
                titleId="tx-title"
                title={
                    <chakra.h1 id="tx-title" m="0" fontSize={{base: "28px", md: "36px"}} lineHeight="1.1" fontWeight={800} letterSpacing="-0.02em" overflowWrap="anywhere">
                        {headline}
                    </chakra.h1>
                }
            >
                {tx.signer && (
                    <chakra.p m="0" display="flex" alignItems="center" gap="6px" flexWrap="wrap" fontSize="16px" lineHeight="1.55" color={ts.muted}>
                        <AddressChip address={tx.signer} href={tokenHolderPath(asset.denom, tx.signer)}/>
                        {sentence}
                    </chakra.p>
                )}
            </InnerHero>

            <TsFeaturedCard p={{base: "18px", md: "24px 28px"}} display="flex" alignItems="center" gap="16px 28px" flexWrap="wrap" data-testid="tx-summary">
                <Flex flex="1 1 220px" minW="0" direction="column" gap="6px">
                    <chakra.span {...tsLabel}>Paid</chakra.span>
                    <chakra.span fontSize={{base: "26px", md: "32px"}} fontWeight={800} letterSpacing="-0.02em" fontVariantNumeric="tabular-nums" overflowWrap="anywhere">{paid}</chakra.span>
                    {summary.tradingFee.length > 0 && (
                        <chakra.span fontSize="14px" color={ts.muted}>{`plus a ${coins(summary.tradingFee)} trading fee`}</chakra.span>
                    )}
                </Flex>
                <Flex aria-hidden="true" w="48px" h="48px" borderRadius="50%" bg={ts.inset} align="center" justify="center" flex="none" color={ts.pri}>
                    <LuArrowRight size={20}/>
                </Flex>
                <Flex flex="1 1 220px" minW="0" direction="column" gap="6px">
                    <chakra.span {...tsLabel}>Received</chakra.span>
                    <chakra.span fontSize={{base: "26px", md: "32px"}} fontWeight={800} letterSpacing="-0.02em" fontVariantNumeric="tabular-nums" overflowWrap="anywhere">{received}</chakra.span>
                    {rate && <chakra.span fontSize="14px" color={ts.muted}>{rate}</chakra.span>}
                </Flex>
            </TsFeaturedCard>

            <Flex as="section" aria-labelledby="tx-details" direction="column" gap="14px" pt="28px">
                <chakra.h2 id="tx-details" m="0" fontSize="22px" fontWeight={700}>Details</chakra.h2>
                <ListCard as="dl" m="0" data-testid="tx-details">
                    {details.map((detail) => (
                        <chakra.div key={detail.key} display="grid" gridTemplateColumns={{base: "1fr", md: "200px minmax(0, 1fr)"}} gap={{base: "6px", md: "16px"}} alignItems="center" px={{base: "16px", md: "24px"}} py="14px">
                            <chakra.dt {...tsLabel}>{detail.key}</chakra.dt>
                            <chakra.dd m="0" fontSize="15px" fontWeight={600} fontVariantNumeric="tabular-nums" overflowWrap="anywhere">{detail.value}</chakra.dd>
                        </chakra.div>
                    ))}
                    <chakra.div display="grid" gridTemplateColumns={{base: "1fr", md: "200px minmax(0, 1fr)"}} gap={{base: "6px", md: "16px"}} alignItems="center" px={{base: "16px", md: "24px"}} py="14px">
                        <chakra.dt {...tsLabel}>Transaction ID</chakra.dt>
                        <chakra.dd m="0" display="flex" alignItems="center" gap="10px" flexWrap="wrap" minW="0">
                            <chakra.code fontFamily="'JetBrains Mono', monospace" fontSize="13px" overflowWrap="anywhere" minW="0">{tx.hash}</chakra.code>
                            <CopyButton value={tx.hash} label="Copy transaction ID"/>
                        </chakra.dd>
                    </chakra.div>
                </ListCard>
                <Flex gap="12px" wrap="wrap" pt="8px">
                    <TsButton minH="48px" onClick={() => open("get")}>Get {asset.ticker}</TsButton>
                    {tx.signer && (
                        <TsLinkButton variant="ghost" minH="48px" href={tokenHolderPath(asset.denom, tx.signer)}>More from this holder</TsLinkButton>
                    )}
                </Flex>
            </Flex>
        </>
    );
}

/** A hash Scan hasn't indexed yet (`/txs/{hash}` answers 404). */
function NotIndexed({hash, onRetry}: { hash: string; onRetry: () => void }) {
    return (
        <TsCard mt={{base: "24px", md: "40px"}} px={{base: "20px", md: "32px"}} py={{base: "32px", md: "44px"}} display="flex" flexDirection="column" alignItems="center" gap="12px" textAlign="center" data-testid="tx-not-indexed">
            <TsTag>
                <chakra.span aria-hidden="true" w="8px" h="8px" borderRadius="50%" bg={ts.pri}/>
                Pending
            </TsTag>
            <chakra.h1 m="0" fontSize="24px" fontWeight={700}>Not indexed yet</chakra.h1>
            <chakra.p m="0" color={ts.muted} fontSize="15px" lineHeight="1.5" maxW="460px">
                BZE Scan hasn&apos;t indexed this transaction yet. New ones usually show up within a few seconds.
            </chakra.p>
            {hash && (
                <chakra.code fontFamily="'JetBrains Mono', monospace" fontSize="13px" px="12px" py="8px" borderRadius="10px" bg={ts.inset} overflowWrap="anywhere" maxW="100%">
                    {hash}
                </chakra.code>
            )}
            <TsButton variant="ghost" onClick={onRetry} borderRadius="12px">Retry</TsButton>
        </TsCard>
    );
}

function TxLoader({asset, hash}: { asset: Asset; hash: string }) {
    const tx = useScanTx(hash || undefined);

    if (!hash || (tx.error instanceof ScanError && tx.error.isNotFound)) {
        return <NotIndexed hash={hash} onRetry={() => void tx.refetch()}/>;
    }
    if (tx.isError) {
        return (
            <Flex direction="column" pt={{base: "24px", md: "40px"}}>
                <ErrorCard onRetry={() => void tx.refetch()}>Couldn&apos;t load this transaction. BZE Scan didn&apos;t answer.</ErrorCard>
            </Flex>
        );
    }
    if (!tx.data) {
        return (
            <Flex direction="column" gap="16px" pt={{base: "24px", md: "40px"}} role="status" aria-label="Loading the transaction">
                <Shimmer h="18px" w="160px"/>
                <Shimmer h="40px" w="70%"/>
                <Shimmer h="140px" borderRadius="16px"/>
                <Shimmer h="360px" borderRadius="16px"/>
            </Flex>
        );
    }

    return <TxContent asset={asset} tx={tx.data}/>;
}

function TxPageContent() {
    const denom = useDenomParam() ?? "";
    const hash = useSearchParams().get("hash") ?? "";

    return <InnerSite denom={denom}>{(asset) => <TxLoader asset={asset} hash={hash}/>}</InnerSite>;
}

/** `/token/tx?denom=&hash=`: one transaction in plain words, seen from the token's site. */
export function TxPage() {
    return (
        <Suspense fallback={<TokenSiteTheme kit={DEFAULT_DENOM_BRANDING}><div/></TokenSiteTheme>}>
            <TxPageContent/>
        </Suspense>
    );
}
