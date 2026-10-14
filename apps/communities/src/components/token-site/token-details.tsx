'use client';

import React, {useCallback, useEffect, useState} from "react";
import {chakra, Flex} from "@chakra-ui/react";
import {type Asset, getFactoryDenomAdmin, truncateAddress} from "@bze/bze-ui-kit";

import {TsCard, TsChip, TsSection, TsStat, ts} from "./kit";

interface AdminState {
    denom: string;
    /** '' = renounced; undefined = the query failed. */
    admin?: string;
}

/** The tokenfactory admin of `denom`: undefined until known or when the query failed. */
function useDenomAdmin(denom: string): AdminState | undefined {
    const [state, setState] = useState<AdminState | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;
        getFactoryDenomAdmin(denom).then((admin) => {
            if (!cancelled) setState({denom, admin});
        });

        return () => { cancelled = true; };
    }, [denom]);

    return state?.denom === denom ? state : undefined;
}

function CopyDenom({denom}: { denom: string }) {
    const [copied, setCopied] = useState(false);

    const onCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(denom);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            /* clipboard unavailable: ignore */
        }
    }, [denom]);

    return <TsChip onClick={onCopy} aria-label="Copy denom">{copied ? "Copied" : "Copy"}</TsChip>;
}

/** Token details (Business Logic R3): ticker, decimals, supply control, creator and denom. */
export function TokenDetails({asset}: { asset: Asset }) {
    const adminState = useDenomAdmin(asset.denom);
    // factory/<creator>/<subdenom>
    const creator = asset.denom.split("/")[1] ?? "";

    let supplyControl: string | undefined;
    if (adminState && adminState.admin !== undefined) {
        supplyControl = adminState.admin === "" ? "Admin renounced" : `Admin ${truncateAddress(adminState.admin)}`;
    }

    const cell = {px: {base: "18px", md: "28px"}, py: {base: "18px", md: "24px"}} as const;
    const small = {fontSize: "16px", fontWeight: 600} as const;

    return (
        <TsSection id="details" eyebrow="Token" title="Token details">
            <TsCard display="grid" gridTemplateColumns="repeat(auto-fit, minmax(min(260px, 100%), 1fr))">
                <TsStat label="Ticker" value={<chakra.span {...small}>{asset.ticker}</chakra.span>} {...cell}/>
                <TsStat label="Decimals" value={<chakra.span {...small}>{asset.decimals}</chakra.span>} {...cell}/>
                {supplyControl && (
                    <TsStat label="Supply control" value={<chakra.span {...small} data-testid="supply-control">{supplyControl}</chakra.span>} {...cell}/>
                )}
                {creator && <TsStat label="Creator" value={<chakra.span {...small}>{truncateAddress(creator)}</chakra.span>} {...cell}/>}
                <Flex direction="column" gap="8px" gridColumn="1 / -1" borderTopWidth="1px" borderStyle="solid" borderColor={ts.border} {...cell}>
                    <chakra.span fontSize="12px" letterSpacing="0.08em" textTransform="uppercase" fontWeight={600} color={ts.muted}>Denom</chakra.span>
                    <Flex wrap="wrap" align="center" gap="12px">
                        <chakra.code fontFamily="'JetBrains Mono', monospace" fontSize="14px" wordBreak="break-all" bg="transparent" color={ts.fg}>
                            {asset.denom}
                        </chakra.code>
                        <CopyDenom denom={asset.denom}/>
                    </Flex>
                </Flex>
            </TsCard>
        </TsSection>
    );
}
