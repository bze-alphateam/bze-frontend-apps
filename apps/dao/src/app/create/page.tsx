"use client";

import {useCallback, useState} from "react";
import {useRouter} from "next/navigation";
import {CreateDaoFlow, PageContainer, PageHero, type CreateDaoDraft} from "@bze/bze-ui-kit";
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
    const [saved] = useState(() => loadDraft(browserStorage()));
    const onDraftChange = useCallback((draft: CreateDaoDraft | undefined) => saveDraft(browserStorage(), draft), []);

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
