'use client';

import {Suspense} from "react";
import {DEFAULT_DENOM_BRANDING} from "@bze/bze-ui-kit";

import {useDenomParam} from "@/hooks/useNavigation";
import {TokenSite} from "@/components/token-site/token-site";
import {TokenSiteTheme} from "@/components/token-site/kit";

// The denom comes from `?denom=` (useSearchParams), which needs a Suspense boundary for the
// static build.
const TokenPageContent = () => {
    const denom = useDenomParam();

    return <TokenSite denom={denom ?? ""}/>;
};

export default function TokenPage() {
    return (
        <Suspense fallback={<TokenSiteTheme kit={DEFAULT_DENOM_BRANDING}><div/></TokenSiteTheme>}>
            <TokenPageContent/>
        </Suspense>
    );
}
