'use client';

import {Suspense} from "react";

import {Directory, DirectoryLayout, DirectorySkeleton} from "@/components/directory/directory";

// The directory reads its search, filter, sort and page from the URL (useSearchParams), which
// needs a Suspense boundary for the static build.
export default function Home() {
    return (
        <Suspense fallback={<DirectoryLayout><DirectorySkeleton/></DirectoryLayout>}>
            <Directory/>
        </Suspense>
    );
}
