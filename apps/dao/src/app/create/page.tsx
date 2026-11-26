"use client";

import {useCallback, useMemo} from "react";
import {useRouter} from "next/navigation";
import {useChain} from "@interchain-kit/react";
import {CreateDaoFlow, getChainName, PageContainer, PageHero, type CreateDaoDraft} from "@bze/bze-ui-kit";
import {loadDraft, saveDraft, type DraftStorage} from "@/lib/create-draft";

const browserStorage = (): DraftStorage | undefined => {
    try {
        return typeof window === "undefined" ? undefined : window.localStorage;
    } catch {
        return undefined;
    }
};

export default function CreatePage() {
    const router = useRouter();
    const {address} = useChain(getChainName());
    // the draft of this wallet only; read when the wallet is known (the flow mounts after that)
    const saved = useMemo(() => loadDraft(browserStorage(), address), [address]);
    const onDraftChange = useCallback((draft: CreateDaoDraft | undefined) => saveDraft(browserStorage(), address, draft), [address]);

    return (
        <PageContainer py={{base: "32px", md: "48px"}} display="flex" flexDirection="column" gap="24px">
            <PageHero title="Create a DAO" subtitle="A member list or the stakers of a token, with its own rules. One fee, then it is yours to run." />
            <CreateDaoFlow
                draft={saved}
                onDraftChange={onDraftChange}
                onCreated={(created) => router.push(`/dao/${created.id}`)}
            />
        </PageContainer>
    );
}
