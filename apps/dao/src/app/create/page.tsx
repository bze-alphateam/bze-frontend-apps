"use client";

import {PageContainer, PageState} from "@bze/bze-ui-kit";

// The route is reserved for the create flow (BFE-378).
export default function CreatePage() {
    return (
        <PageContainer py={{base: "40px", md: "64px"}}>
            <PageState kind="empty" title="Creating a DAO is coming soon" description="The create flow is on its way. For now you can browse the DAOs that exist." />
        </PageContainer>
    );
}
