'use client';

import {Suspense} from "react";
import {DEFAULT_DENOM_BRANDING} from "@bze/bze-ui-kit";

import {useDenomParam} from "@/hooks/useNavigation";

import {TokenSite} from "./token-site";
import {TokenSiteTheme} from "./kit";

// The denom comes from `?denom=` (useSearchParams), which needs a Suspense boundary for the
// static build.
const TokenPageContent = () => {
    const denom = useDenomParam();

    return <TokenSite denom={denom ?? ""}/>;
};

/** The client half of `/token`: the page itself only adds the token's head (see app/token/page.tsx). */
export function TokenPage() {
    return (
        <Suspense fallback={<TokenSiteTheme kit={DEFAULT_DENOM_BRANDING}><div/></TokenSiteTheme>}>
            <TokenPageContent/>
        </Suspense>
    );
}
