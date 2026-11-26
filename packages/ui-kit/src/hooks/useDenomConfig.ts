import {useMemo} from "react";
import {DenomConfigInfo} from "../query/denom_config";
import {useDenomConfigs} from "./useDenomConfigs";

/**
 * The tokenfactory config (v8.3.0) of one denom. undefined while loading and for denoms that
 * never have one; `status` tells a v8.2.0 node (`unsupported`) and a failed read (`error`) apart.
 */
export function useDenomConfig(denom: string): DenomConfigInfo | undefined {
    const denoms = useMemo(() => [denom], [denom]);
    return useDenomConfigs(denoms).get(denom);
}
