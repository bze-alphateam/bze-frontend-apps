import {usePathname, useRouter, useSearchParams} from "next/navigation";
import {useCallback, useMemo} from "react";
import {createMarketId} from "@bze/bze-ui-kit";

const ID_PARAM = 'id'
const DENOM_PARAM = 'denom'

// Denoms can contain '/' (factory/..., ibc/...), so the denom travels in the
// query string (URL-encoded), never in the path.
export const assetPagePath = (denom: string) => `/assets/details?${DENOM_PARAM}=${encodeURIComponent(denom)}`

// Basic navigation without search params (no Suspense needed)
export const useNavigation = () => {
    const router = useRouter();
    const pathname = usePathname();

    const toMarketPage = useCallback((base: string, quote: string) => {
        router.push(`/exchange/market?${ID_PARAM}=${createMarketId(base, quote)}`)
    }, [router]);

    const toExchangePage = useCallback(() => {
        router.push('/exchange')
    }, [router]);

    const toPoolsPage = useCallback(() => {
        router.push('/pools')
    }, [router])

    const toLpPage = useCallback((poolId: string) => {
        router.push(`/pools/details?${ID_PARAM}=${poolId}`)
    }, [router]);

    const toAssetsPage = useCallback(() => {
        router.push('/assets')
    }, [router])

    const toAssetPage = useCallback((denom: string) => {
        router.push(assetPagePath(denom))
    }, [router]);

    return {
        currentPathName: pathname,
        navigate: router.push,
        toMarketPage,
        toExchangePage,
        toLpPage,
        toPoolsPage,
        toAssetsPage,
        toAssetPage,
    };
};

// Extended version with search params (requires Suspense)
export const useNavigationWithParams = () => {
    const navigation = useNavigation();
    const searchParams = useSearchParams();

    const getQueryParam = useCallback((param: string) => {
        return searchParams.get(param)
    }, [searchParams]);

    const idParam = useMemo(() => {
        return searchParams.get(ID_PARAM)
    }, [searchParams]);

    const denomParam = useMemo(() => {
        return searchParams.get(DENOM_PARAM)
    }, [searchParams]);

    return {
        ...navigation,
        getQueryParam,
        idParam,
        denomParam,
    };
};