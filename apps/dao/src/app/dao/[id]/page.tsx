'use client';

import {use} from "react";
import NextLink from "next/link";
import {chakra} from "@chakra-ui/react";
import {PageContainer, PageState} from "@bze/bze-ui-kit";
import {useAsync} from "@/hooks/useAsync";
import {browserScanGetter} from "@/lib/dao-scan";

// A stub: the DAO page is built in BFE-372. It shows the DAO's name from Scan, or its number.
export default function DaoPage({params}: {params: Promise<{id: string}>}) {
    const {id} = use(params);
    const dao = useAsync(id, async () => {
        const {status, body} = await browserScanGetter(`daos/${encodeURIComponent(id)}`);
        return status === 200 && typeof (body as {name?: unknown})?.name === "string" ? (body as {name: string}).name : null;
    });

    return (
        <PageContainer py={{base: "40px", md: "64px"}}>
            <PageState
                kind="empty"
                title={dao.data ?? `DAO ${id}`}
                description="The page of this DAO is coming soon."
                action={<chakra.a asChild color="hg.link" fontWeight="600"><NextLink href="/">Back to the DAOs</NextLink></chakra.a>}
            />
        </PageContainer>
    );
}
