
export const ASSET_TYPE_FACTORY = "Factory"
export const ASSET_TYPE_IBC = "IBC"
export const ASSET_TYPE_NATIVE = "Native"
export const ASSET_TYPE_LP = "LP"

export const VERIFIED_ASSETS: { [key: string]: boolean } = {
    "factory/testbz1w9vva0muctcrmd9xgret9x4wasw2rrflsdkwfs/faneatiku2": true,
    "factory/testbz1z3mkcr2jz424w6m49frgjmy9uhlrx69p4cvrgf/vidulum": true,
    "factory/testbz1z3mkcr2jz424w6m49frgjmy9uhlrx69p4cvrgf/bitcoinz": true,
    "ubze": true,
    "utbz": true,
    "factory/bze13gzq40che93tgfm9kzmkpjamah5nj0j73pyhqk/uvdl": true,
}

export const EXCLUDED_ASSETS: { [key: string]: boolean } = {
    "factory/testbz1w9vva0muctcrmd9xgret9x4wasw2rrflsdkwfs/faneatiku1": false,
    "factory/bze1972aqfzdg29ugjln74edx0xvcg4ehvysjptk77/1000000000": true,
    "ibc/689DD6F80E4DBCE14877462B182504037FAEAD0699D5804A7F5CB328D33ED24B": true,
    "factory/bze1f0qgels0eu96ev6a67znu70q7rquy9eragn8nw/ucorey": true,
}

/**
 * Assets excluded from the deposit picker. Keyed by BZE-side denom.
 * Set to `true` to hide the asset from the deposit form.
 */
export const DEPOSIT_EXCLUDED_ASSETS: { [key: string]: boolean } = {
    // Lumen — excluded manually, not caught by the 2-hop heuristic
    "ibc/693DDB2D9B4260D67C8136C22D837F37488E0FBD81857D8E9C6022332EA26E33": true,
}

/**
 * Assets excluded from the withdraw picker. Keyed by BZE-side denom.
 * Set to `true` to hide the asset from the withdraw form.
 */
export const WITHDRAW_EXCLUDED_ASSETS: { [key: string]: boolean } = {
}

export const STABLE_COINS: { [key: string]: boolean } = {
    "factory/testbz1z3mkcr2jz424w6m49frgjmy9uhlrx69p4cvrgf/uusdt": true,
    "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/testusd": true,
    // USDC.n — USDC issued on Noble
    "ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4": true,
    // USDC.inj — USDC issued on Injective
    "ibc/81DA528F4C5546208D1D50F84C2D0B388B45D37AA36FCA622A3CB2D8EF014838": true,
}

export interface LegacyAssetNotice {
    title: string;
    text: string;
    /** Optional "learn more" link, e.g. the announcement. */
    url?: string;
}

/**
 * Explanations for assets being wound down, keyed by BZE-side denom. A notice is
 * shown only while the chain refuses new deposits of that asset (txfeecollector
 * `blocked_ibc_inbound` param), see `getLegacyAssetNotice`. Copy and link live here
 * so they can change without touching components.
 */
export const LEGACY_ASSET_NOTICES: { [denom: string]: LegacyAssetNotice } = {
    // USDC.n — Circle is retiring USDC on Noble; chain v8.2.0 blocks new deposits.
    "ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4": {
        title: "USDC.n is being retired",
        text: "USDC.n is USDC issued on the Noble chain, which Circle is retiring. New deposits to BZE are closed; you can still withdraw it to Noble, trade it and send it.",
    },
}

export const getChainNativeAssetDenom = (): string => {
    return process.env.NEXT_PUBLIC_CHAIN_NATIVE_ASSET_DENOM || 'ubze'
}

export const getUSDCDenom = (): string => {
    return process.env.NEXT_PUBLIC_USDC_IBC_DENOM || ''
}
