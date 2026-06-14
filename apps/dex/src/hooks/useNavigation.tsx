import {usePathname, useRouter, useSearchParams} from "next/navigation";
import {useCallback, useMemo} from "react";
import {createMarketId} from "@bze/bze-ui-kit";

const ID_PARAM = 'id'

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

    return {
        currentPathName: pathname,
        navigate: router.push,
        toMarketPage,
        toExchangePage,
        toLpPage,
        toPoolsPage,
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

    return {
        ...navigation,
        getQueryParam,
        idParam,
    };
};