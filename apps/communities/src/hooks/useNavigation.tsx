import {usePathname, useRouter, useSearchParams} from "next/navigation";

export const DENOM_PARAM = "denom";

// Canonical token page URL. The denom is always URL-encoded in the query string,
// never in the path (factory denoms contain `/`). See Business Logic §3.
export const tokenPagePath = (denom: string) => `/token?${DENOM_PARAM}=${encodeURIComponent(denom)}`;

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
