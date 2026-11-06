'use client';

import React from "react";
import {Box, chakra, Flex, Skeleton} from "@chakra-ui/react";
import {LuArrowLeft} from "react-icons/lu";
import {type Asset, DEFAULT_DENOM_BRANDING, isFactoryDenom, isIbcDenom, useAsset, useLiquidityPools} from "@bze/bze-ui-kit";

import {tokenPagePath, useNavigation} from "@/hooks/useNavigation";
import {useEarnOpportunities} from "@/hooks/token-site/useEarnOpportunities";
import {useTokenBrandKit} from "@/hooks/token-site/useTokenBrandKit";
import {TokenFeeModeProvider} from "@/hooks/token-site/useTokenFeeMode";
import {TokenWalletProvider} from "@/hooks/token-site/useTokenWallet";
import {ACTIVITY_SECTION_ID} from "@/lib/token-activity";
import {siteSections} from "@/lib/token-site/sections";
import {isTradable} from "@/lib/token-site/swap";

import {TokenSiteTheme, TsButton, TsCard, TsLink, ts, tsContainer, tsEyebrow} from "../kit";
import {SiteFooter} from "../site-footer";
import {SiteHeader} from "../site-header";
import {WalletDrawer} from "../wallet";

/** Tokens with an Activity page: Token Factory tokens and IBC tokens. */
export const hasActivityPage = (denom: string) => isFactoryDenom(denom) || isIbcDenom(denom);

function NotFound() {
    const {navigate} = useNavigation();

    return (
        <Box {...tsContainer} py={{base: "72px", md: "120px"}}>
            <TsCard p={{base: "28px", md: "40px"}} maxW="640px" mx="auto">
                <Flex direction="column" align="center" gap="14px" textAlign="center">
                    <chakra.h1 m="0" fontSize="26px" fontWeight={700}>Token not found</chakra.h1>
                    <chakra.p m="0" color={ts.muted} lineHeight="1.55">
                        We couldn&apos;t find this token. The link may be incorrect.
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
            <Skeleton height="320px" borderRadius="16px"/>
        </Box>
    );
}

interface InnerHeroProps {
    /** The back link above the eyebrow. */
    back: { href: string; label: string };
    eyebrow: React.ReactNode;
    title: React.ReactNode;
    /** Tags beside the eyebrow (Live, Confirmed) or the title (Creator). */
    children?: React.ReactNode;
    titleId: string;
}

/** The inner pages' hero: a back link, the eyebrow in the primary, the page's title and lead. */
export function InnerHero({back, eyebrow, title, titleId, children}: InnerHeroProps) {
    return (
        <Flex as="section" aria-labelledby={titleId} direction="column" gap="12px" pt={{base: "24px", md: "40px"}} pb={{base: "24px", md: "36px"}}>
            <TsLink
                href={back.href}
                alignSelf="flex-start"
                display="inline-flex"
                alignItems="center"
                gap="6px"
                minH="32px"
                fontSize="14px"
                fontWeight={600}
                color={ts.muted}
                textDecoration="none"
                _hover={{opacity: 0.85}}
            >
                <LuArrowLeft size={14} aria-hidden="true"/>
                {back.label}
            </TsLink>
            <chakra.span {...tsEyebrow} color={ts.pri}>{eyebrow}</chakra.span>
            {title}
            {children}
        </Flex>
    );
}

/**
 * The frame of the token site's inner pages (Activity, holder, transaction): the token's brand
 * kit, its standalone header and footer and its wallet, with the glow at half the token page's
 * strength. `children` renders once the token is known.
 */
export function InnerSite({denom, children}: { denom: string; children: (asset: Asset) => React.ReactNode }) {
    const {asset, isLoading} = useAsset(denom);
    const resolved = asset && hasActivityPage(asset.denom) ? asset : undefined;
    const kit = useTokenBrandKit(resolved?.denom);
    const {pools} = useLiquidityPools();
    const {opportunities} = useEarnOpportunities(resolved?.denom);

    // A known token renders at once, even while balances reload; "not found" waits for the assets.
    if ((!resolved && isLoading) || (resolved && !kit)) {
        return <TokenSiteTheme kit={DEFAULT_DENOM_BRANDING}><Loading/></TokenSiteTheme>;
    }

    if (!resolved || !kit) {
        return <TokenSiteTheme kit={DEFAULT_DENOM_BRANDING}><NotFound/></TokenSiteTheme>;
    }

    // The token page's links, leading back to it; "Activity" is where every inner page belongs.
    const sections = siteSections({
        denom: resolved.denom,
        hasEarn: opportunities.length > 0,
        hasTrade: isTradable(resolved.denom, pools),
        page: "inner",
    });

    return (
        <TokenSiteTheme kit={kit}>
            <TokenFeeModeProvider denom={resolved.denom}>
                <TokenWalletProvider>
                    <Box position="relative">
                        <Box
                            aria-hidden="true"
                            data-testid="token-site-glow"
                            position="absolute"
                            insetX="0"
                            top="0"
                            h={{base: "420px", md: "560px"}}
                            bgImage={ts.glow}
                            opacity={0.5}
                            pointerEvents="none"
                        />
                        <SiteHeader asset={resolved} sections={sections} current={ACTIVITY_SECTION_ID} homeHref={tokenPagePath(resolved.denom)}/>
                        <chakra.main position="relative" {...tsContainer}>
                            {children(resolved)}
                        </chakra.main>
                        <SiteFooter asset={resolved}/>
                    </Box>
                    <WalletDrawer asset={resolved}/>
                </TokenWalletProvider>
            </TokenFeeModeProvider>
        </TokenSiteTheme>
    );
}
