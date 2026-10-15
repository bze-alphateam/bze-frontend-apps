'use client';

import {useCallback} from 'react';
import {usePathname, useRouter, useSearchParams} from 'next/navigation';
import {useStakeLink, type UseStakeLinkOptions} from '@/hooks/useStakeLink';
import {STAKE_LINK_PARAM} from '@/lib/stake-link';

type StakeLinkHandlerProps = Omit<UseStakeLinkOptions, 'stakeParam' | 'clearParam'>;

// Bridges the URL to useStakeLink. useSearchParams needs a Suspense boundary, so the page
// renders this inside one.
export function StakeLinkHandler(props: StakeLinkHandlerProps) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const clearParam = useCallback(() => {
        const next = new URLSearchParams(searchParams.toString());
        next.delete(STAKE_LINK_PARAM);
        const query = next.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, {scroll: false});
    }, [searchParams, router, pathname]);

    useStakeLink({...props, stakeParam: searchParams.get(STAKE_LINK_PARAM), clearParam});

    return null;
}
