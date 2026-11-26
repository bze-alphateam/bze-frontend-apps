'use client';

import {use} from "react";
import NextLink from "next/link";
import {chakra} from "@chakra-ui/react";
import {PageContainer, PageState} from "@bze/bze-ui-kit";

// A stub: the proposal page is built in BFE-373.
export default function ProposalPage({params}: {params: Promise<{id: string}>}) {
    const {id} = use(params);

    return (
        <PageContainer py={{base: "40px", md: "64px"}}>
            <PageState
                kind="empty"
                title={`Proposal ${id}`}
                description="The page of this proposal is coming soon."
                action={<chakra.a asChild color="hg.link" fontWeight="600"><NextLink href="/">Back to the DAOs</NextLink></chakra.a>}
            />
        </PageContainer>
    );
}
