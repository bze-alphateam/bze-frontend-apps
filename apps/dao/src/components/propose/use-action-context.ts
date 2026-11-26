import {useMemo} from 'react';
import {getChainNativeAssetDenom, useAssets} from '@bze/bze-ui-kit';
import type {ActionContext} from '@/lib/actions/types';
import type {DaoView} from '@/lib/dao-view-loader';
import type {Relations} from '@/lib/propose/relations';
import {useCoinFormat} from '@/components/dao/page/use-coin-format';

/**
 * What the registry's entries read about a DAO: the page's reads, its relations and the app's token
 * knowledge. Null while the chain's rules (`params`) could not be read. `runsNow` is for the admin console,
 * whose actions run in the transaction that is signed.
 */
export function useActionContext(view: DaoView, relations: Relations, runsNow = false): ActionContext | null {
    const {dao, treasury} = view;
    const params = view.params.ok ? view.params.value : null;
    const {getAsset} = useAssets();
    const coins = useCoinFormat();

    return useMemo(() => params && {
        dao,
        params,
        nativeDenom: getChainNativeAssetDenom(),
        subDaos: relations.subDaos,
        incoming: relations.incoming,
        sources: relations.sources,
        treasury: treasury.ok ? treasury.value : null,
        decimalsOf: (denom: string) => getAsset(denom)?.decimals ?? null,
        ticker: coins.ticker,
        ...(runsNow ? {runsNow: true} : {}),
    }, [dao, params, relations, treasury, getAsset, coins.ticker, runsNow]);
}
