
export const LP_ASSETS_DECIMALS = 12

export interface Asset {
    type: string; //ibc, factory or native
    denom: string; //base denom (blockchain denom)
    decimals: number; //exponent
    name: string;
    ticker: string;
    logo: string; //logo or placeholder
    stable: boolean; //is stablecoin
    verified: boolean; //is verified
    halted?: boolean; //trading halted by governance (tradebin HaltedDenoms); LP shares follow their pool
    supply: bigint; //total supply on BZE chain
    description?: string; //optional description (chain registry or on-chain bank metadata)
    IBCData?: IBCData;
    /**
     * Set only when the asset came from BZE Scan's asset list (/api/v1/registry/assets, or its
     * localStorage copy). Its absence means the asset was built from the chain + the bundled
     * chain-registry package, and the hooks then fall back to the hard-coded curation lists.
     */
    scan?: ScanAssetData;
}

/** What Scan's list says beyond the Asset fields: curation and bridge data. */
export interface ScanAssetData {
    depositAllowed: boolean;
    withdrawAllowed: boolean;
    notice?: LegacyAssetNoticeData;
    /** IBC denoms: the chain at the other end of the BZE channel. */
    counterparty?: ScanChainInfo;
    /** IBC denoms: the chain the denom is native to, when the registry names it. */
    origin?: { chainName: string; baseDenom: string; hops: number };
    /** Native and factory denoms: one way out per counterparty chain. */
    routes: ScanRoute[];
}

export interface LegacyAssetNoticeData {
    title: string;
    text: string;
    url?: string;
}

/** A counterparty chain; chainName and bech32Prefix are '' for a chain the registry does not know. */
export interface ScanChainInfo {
    chainName: string;
    chainId: string;
    prettyName: string;
    logo: string;
    bech32Prefix: string;
    rest: string[];
}

export interface ScanRoute {
    chain: ScanChainInfo;
    /** BZE's end of the channel. */
    channelId: string;
    counterpartyChannelId: string;
    /** The ICS-20 voucher the denom becomes on the counterparty. */
    counterpartyDenom: string;
}

export interface IBCData {
    chain: IBCChainData;
    counterparty: IBCCounterparty;
}

export interface IBCCounterparty {
    chainName: string;
    chainPrettyName: string;
    channelId: string;
    baseDenom: string;
}

interface IBCChainData {
    channelId: string;
}

// we created a custom interface that we can use to mock the traces of type IbcTransition
// this is needed because the IbcTransition type from chain-registry/utils is not actually what we get from the chain-registry
// the IbcTransition type has fields camelCase while the chain-registry returns fields with snake_case
export interface IbcTransitionMock {
    type: "ibc";
    counterparty: {
        chain_name: string;
        base_denom: string;
        channel_id: string;
    };
    chain: {
        channel_id: string;
        path?: string;
    };
}

export interface ChainAssets {
    assets: Map<string, Asset>;
    ibcData: Map<string, IBCData>;
}
