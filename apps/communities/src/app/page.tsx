'use client';

import {Suspense} from "react";

import {Directory, DirectoryLayout, DirectorySkeleton} from "@/components/directory/directory";
import {TopNavBar} from "@/components/ui/navigation/navbar";
import {useLeftoverTokenFeeReset} from "@/hooks/useLeftoverTokenFeeReset";

// The directory is a normal BeeZee app page with the shared top bar (token pages have none).
// It reads its search, filter, sort and page from the URL (useSearchParams), which needs a
// Suspense boundary for the static build.
export default function Home() {
    useLeftoverTokenFeeReset();

    return (
        <>
            <TopNavBar/>
            <Suspense fallback={<DirectoryLayout><DirectorySkeleton/></DirectoryLayout>}>
                <Directory/>
            </Suspense>
        </>
    );
}
