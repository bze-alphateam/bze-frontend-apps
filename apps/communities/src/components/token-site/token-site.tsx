'use client';

import React from "react";
import {Box, chakra, Flex, Skeleton} from "@chakra-ui/react";
import {DEFAULT_DENOM_BRANDING, isFactoryDenom, useAsset} from "@bze/bze-ui-kit";

import {useNavigation} from "@/hooks/useNavigation";
import {useTokenBrandKit} from "@/hooks/token-site/useTokenBrandKit";
import {TokenWalletProvider} from "@/hooks/token-site/useTokenWallet";

import {TokenSiteTheme, TsButton, TsCard, ts, tsContainer} from "./kit";
import {BurnSection} from "./burn";
import {Hero} from "./hero";
import {KeyNumbers} from "./key-numbers";
import {PHONE_ACTION_BAR_SPACE, PhoneActionBar} from "./phone-action-bar";
import {SiteFooter} from "./site-footer";
import {StakeSection} from "./stake";
import {type SiteSection, SiteHeader} from "./site-header";
import {TokenDetails} from "./token-details";
import {WalletDrawer} from "./wallet";

function NotFound() {
    const {navigate} = useNavigation();

    return (
        <Box {...tsContainer} py={{base: "72px", md: "120px"}}>
            <TsCard p={{base: "28px", md: "40px"}} maxW="640px" mx="auto">
                <Flex direction="column" align="center" gap="14px" textAlign="center">
                    <chakra.h1 m="0" fontSize="26px" fontWeight={700}>Token not found</chakra.h1>
                    <chakra.p m="0" color={ts.muted} lineHeight="1.55">
                        We couldn&apos;t find a Token Factory token for this link. It may have been removed,
                        the denom is not a factory token, or the link is incorrect.
                    </chakra.p>
                    <TsButton variant="ghost" onClick={() => navigate("/")}>Browse all tokens</TsButton>
                </Flex>
            </TsCard>
        </Box>
    );
}

function Loading() {
    return (
        <Box {...tsContainer} py={{base: "72px", md: "120px"}} data-testid="token-site-loading">
            <Skeleton height="320px" borderRadius="20px"/>
        </Box>
    );
}

/**
 * The token's standalone site (`/token?denom=…`), themed by its on-chain brand kit and free of
 * BeeZee chrome (Business Logic R1–R3). Only factory denoms get a site.
 */
export function TokenSite({denom}: { denom: string }) {
    const {asset, isLoading} = useAsset(denom);

    // A resolved non-factory denom (BZE, IBC) exists in the assets map but has no site.
    const resolved = !isLoading && asset && isFactoryDenom(asset.denom) ? asset : undefined;
    const kit = useTokenBrandKit(resolved?.denom);

    if (isLoading || (resolved && !kit)) {
        return <TokenSiteTheme kit={DEFAULT_DENOM_BRANDING}><Loading/></TokenSiteTheme>;
    }

    if (!resolved || !kit) {
        return <TokenSiteTheme kit={DEFAULT_DENOM_BRANDING}><NotFound/></TokenSiteTheme>;
    }

    // Stake and Burn always exist (R5, R10); later stories add Earn and Trade when they apply.
    const sections: SiteSection[] = [
        {id: "stake", label: "Stake"},
        {id: "burn", label: "Burn"},
        {id: "details", label: "Token"},
    ];

    return (
        <TokenSiteTheme kit={kit}>
            <TokenWalletProvider>
                <Box pb={{base: PHONE_ACTION_BAR_SPACE, md: "0"}}>
                    <SiteHeader asset={resolved} sections={sections}/>
                    <chakra.main>
                        <Hero asset={resolved} hasStake={true}/>
                        <KeyNumbers denom={resolved.denom}/>
                        <StakeSection asset={resolved}/>
                        <BurnSection asset={resolved}/>
                        <TokenDetails asset={resolved}/>
                    </chakra.main>
                    <SiteFooter asset={resolved}/>
                    <PhoneActionBar asset={resolved} hasStake={true}/>
                </Box>
                <WalletDrawer asset={resolved}/>
            </TokenWalletProvider>
        </TokenSiteTheme>
    );
}
