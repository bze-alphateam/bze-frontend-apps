import type {Metadata} from "next";

import {TokenPage} from "@/components/token-site/token-page";
import {isCommunitiesEnabled} from "@/lib/app-gate";
import {restTokenHeadSource, tokenPageMetadata} from "@/lib/token-site/metadata";

// Server-rendered so shared links and crawlers see the token's own title and description; a
// hidden build serves the placeholder, so it keeps the site-wide head and never asks the node.
export async function generateMetadata({searchParams}: {searchParams: Promise<{denom?: string | string[]}>}): Promise<Metadata> {
    if (!isCommunitiesEnabled()) {
        return {};
    }

    const {denom} = await searchParams;
    return tokenPageMetadata(
        Array.isArray(denom) ? denom[0] : denom,
        restTokenHeadSource(process.env.NEXT_PUBLIC_REST_ENDPOINT ?? ""),
    );
}

export default function Page() {
    return <TokenPage/>;
}
