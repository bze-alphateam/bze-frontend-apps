import type {Asset} from "../types/asset";
import type {BlockedIbcInbound} from "../query/txfeecollector_params";
import {LEGACY_ASSET_NOTICES, type LegacyAssetNotice} from "../constants/assets";

/**
 * Whether the chain refuses new deposits of `asset`: an entry of the txfeecollector
 * `blocked_ibc_inbound` param matches its BZE-side channel and its base denom on the
 * counterparty chain (exact comparison, the same match the chain's IBC middleware makes).
 *
 * Fails open: an unknown block list (`undefined`, e.g. the params query failed) or an
 * asset without a complete IBC trace is never blocked.
 */
export const isIbcInboundBlocked = (asset: Asset, blocked: BlockedIbcInbound[] | undefined): boolean => {
    if (!blocked || blocked.length === 0) return false;

    const channelId = asset.IBCData?.chain?.channelId;
    const baseDenom = asset.IBCData?.counterparty?.baseDenom;
    if (!channelId || !baseDenom) return false;

    return blocked.some(b => b.channelId === channelId && b.baseDenom === baseDenom);
};

/**
 * The wind-down notice to show for `asset`, if it has one in `LEGACY_ASSET_NOTICES`
 * and the chain currently refuses its deposits. Before the block is live (empty or
 * unknown list) there is nothing to explain, so this returns `undefined`.
 */
export const getLegacyAssetNotice = (
    asset: Asset | undefined,
    blocked: BlockedIbcInbound[] | undefined,
): LegacyAssetNotice | undefined => {
    if (!asset) return undefined;

    const notice = LEGACY_ASSET_NOTICES[asset.denom];
    if (!notice) return undefined;

    return isIbcInboundBlocked(asset, blocked) ? notice : undefined;
};
