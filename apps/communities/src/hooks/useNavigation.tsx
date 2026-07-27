import {usePathname, useRouter, useSearchParams} from "next/navigation";

import {DENOM_PARAM, tokenPagePath} from "@/lib/token-directory";

// tokenPagePath / DENOM_PARAM live in the pure (React-free) directory helper so
// they stay unit-testable; re-exported here for the existing import sites.
export {DENOM_PARAM, tokenPagePath};

// Basic navigation without search params (no Suspense needed)
export const useNavigation = () => {
    const router = useRouter();
    const pathname = usePathname();

    return {
        currentPathName: pathname,
        navigate: router.push,
    };
};

// Reads the token denom from the `?denom=` query param (already URL-decoded by
// URLSearchParams). Uses useSearchParams, so any component that calls this must
// be rendered inside a <Suspense> boundary. Returns null when absent.
export const useDenomParam = (): string | null => {
    const searchParams = useSearchParams();

    return searchParams.get(DENOM_PARAM);
};
