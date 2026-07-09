import {usePathname, useRouter, useSearchParams} from "next/navigation";
import {useCallback, useMemo} from "react";

// Basic navigation without search params (no Suspense needed)
export const useNavigation = () => {
    const router = useRouter();
    const pathname = usePathname();

    return {
        currentPathName: pathname,
        navigate: router.push,
    };
};

// Navigation + query params — callers must render inside a <Suspense> boundary
// (Next.js requirement for useSearchParams). Same idiom as the dex app.
export const useNavigationWithParams = () => {
    const navigation = useNavigation();
    const searchParams = useSearchParams();

    const getQueryParam = useCallback((param: string) => {
        return searchParams.get(param)
    }, [searchParams]);

    const denomParam = useMemo(() => {
        return searchParams.get('denom')
    }, [searchParams]);

    return {
        ...navigation,
        getQueryParam,
        denomParam,
    };
};
