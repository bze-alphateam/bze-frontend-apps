// The asset list BZE Scan serves at GET /api/v1/registry/assets (snake_case, as sent).
// Scan builds it from the chain, the chain registry and its curation file, which is
// the source of truth for verified / excluded / stable / deposit / withdraw / notices.

export interface RegistryNotice {
    title: string;
    text: string;
    url?: string;
}

/** A chain as Scan names it: only chain_id is set for a chain the registry does not know. */
export interface RegistryChainInfo {
    chain_name: string | null;
    chain_id: string;
    pretty_name: string;
    logo: string | null;
    bech32_prefix: string | null;
    rest: string[] | null;
    rpc: string[] | null;
}

export interface RegistryCounterparty extends RegistryChainInfo {
    channel_id: string;
    base_denom: string;
}

export interface RegistryOrigin {
    chain_name: string;
    base_denom: string;
    hops: number;
}

export interface RegistryIBC {
    channel_id: string;
    counterparty: RegistryCounterparty;
    origin: RegistryOrigin | null;
    channel_confirmed: boolean;
}

/** A way out of BZE for a native or factory denom. */
export interface RegistryRoute extends RegistryChainInfo {
    channel_id: string;
    counterparty_channel_id: string;
    /** The ICS-20 voucher the denom becomes on the counterparty. */
    counterparty_denom: string;
}

export interface RegistryAsset {
    denom: string;
    kind: 'native' | 'factory' | 'ibc' | 'lp' | string;
    name: string;
    ticker: string;
    decimals: number;
    logo: string | null;
    description: string | null;
    verified: boolean;
    stable: boolean;
    excluded: boolean;
    halted: boolean;
    deposit_allowed: boolean;
    withdraw_allowed: boolean;
    notice: RegistryNotice | null;
    ibc: RegistryIBC | null;
    lp: { base: string; quote: string } | null;
    routes: RegistryRoute[] | null;
    version: string;
}

export interface RegistryAssetsResponse {
    version: string;
    assets: RegistryAsset[];
}
