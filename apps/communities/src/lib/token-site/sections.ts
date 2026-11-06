import {ACTIVITY_SECTION_ID, tokenActivityPath, tokenSectionPath} from "@/lib/token-activity/routes";

/** A link of the token site's header: a section of the token page, or a page of its own. */
export interface SiteSection {
    id: string;
    label: string;
    /** Where it goes; `#<id>` (a section on this page) when absent. */
    href?: string;
}

export interface SiteSectionsInput {
    denom: string;
    /** Something pays the token (R7). */
    hasEarn: boolean;
    /** The token sits in a pool (R8). */
    hasTrade: boolean;
    /**
     * `main`: the token page, every link scrolls to its section ("Activity" to the snippet).
     * `inner`: the Activity, holder and transaction pages, the links go back to the token page
     * and "Activity" opens the Activity page.
     */
    page: "main" | "inner";
}

/** The header links: Stake, Earn, Trade, Burn, Activity, Token (Earn and Trade only when they exist). */
export function siteSections({denom, hasEarn, hasTrade, page}: SiteSectionsInput): SiteSection[] {
    const sections: SiteSection[] = [
        {id: "stake", label: "Stake"},
        ...(hasEarn ? [{id: "earn", label: "Earn"}] : []),
        ...(hasTrade ? [{id: "trade", label: "Trade"}] : []),
        {id: "burn", label: "Burn"},
        {id: ACTIVITY_SECTION_ID, label: "Activity"},
        {id: "details", label: "Token"},
    ];
    if (page === "main") return sections;

    return sections.map((section) => ({
        ...section,
        href: section.id === ACTIVITY_SECTION_ID ? tokenActivityPath(denom) : tokenSectionPath(denom, section.id),
    }));
}
