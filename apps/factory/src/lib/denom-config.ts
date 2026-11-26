import BigNumber from 'bignumber.js'
import { validateBZEBech32Address } from '@bze/bze-ui-kit'

// The token page's "Fees and community pool" settings (BFE-385): the three fields of the tokenfactory
// DenomConfig, as percents in the UI and as chain decimal strings in MsgSetDenomConfig. Pure, so the
// form stays a view.

/** Chain bounds in percent: transfer fee 0–5 %, gas surcharge 0–200 %. */
export const MAX_TRANSFER_FEE_PCT = 5
export const MAX_GAS_SURCHARGE_PCT = 200

/** At most 2 decimals of a percent, i.e. 4 of the ratio. */
const MAX_PCT_DECIMALS = 2

/** The three settings as the form holds them: an address ('' = none) and two percent strings. */
export interface FeeSettings {
    communityPool: string;
    transferFeePct: string;
    gasSurchargePct: string;
}

/** What a token without a config has: no pool, no fees. */
export const DEFAULT_FEE_SETTINGS: FeeSettings = { communityPool: '', transferFeePct: '0', gasSurchargePct: '0' }

/** Why a rate field can't be used ('' when it can): required, plain number, 0–max %, at most 2 decimals. */
export function rateError(input: string, maxPct: number, label: string): string {
    const trimmed = input.trim()
    if (!trimmed) return `${label} is required. Use 0 for none.`
    if (!/^\d+(\.\d+)?$/.test(trimmed)) return 'Enter a number, like 1 or 0.5.'
    if ((trimmed.split('.')[1]?.length ?? 0) > MAX_PCT_DECIMALS) return 'At most 2 decimal places.'
    if (new BigNumber(trimmed).gt(maxPct)) return `${label} can be at most ${maxPct}%.`
    return ''
}

export const transferFeeError = (input: string) => rateError(input, MAX_TRANSFER_FEE_PCT, 'Transfer fee')
export const gasSurchargeError = (input: string) => rateError(input, MAX_GAS_SURCHARGE_PCT, 'Gas surcharge')

/**
 * Why the community pool can't be used ('' when it can): empty means none, otherwise a valid `bze1…`
 * address. The chain also refuses module accounts, which only it can tell: that comes back as its
 * "invalid denom config" error.
 */
export function communityPoolError(input: string): string {
    const trimmed = input.trim()
    if (!trimmed) return ''
    const result = validateBZEBech32Address(trimmed)
    return result.isValid ? '' : result.message
}

/** A percent as the chain's ratio string (0.1 % → "0.001", 0 → "0"). Sent for zero too: a missing rate is refused. */
export function pctToChain(pct: string): string {
    return new BigNumber(pct.trim()).div(100).toFixed()
}

/** A chain ratio as a percent string for the form and the summary (0.001 → "0.1"). */
export function ratioToPct(ratio: BigNumber): string {
    return ratio.times(100).toFixed()
}

/** The live config as the form's starting values. */
export function settingsFromConfig(config: { communityPool: string; transferFee: BigNumber; gasSurcharge: BigNumber }): FeeSettings {
    return {
        communityPool: config.communityPool,
        transferFeePct: ratioToPct(config.transferFee),
        gasSurchargePct: ratioToPct(config.gasSurcharge),
    }
}

/** The first problem of the three fields, or '' when the whole config is valid. */
export function settingsError(settings: FeeSettings): string {
    return communityPoolError(settings.communityPool)
        || transferFeeError(settings.transferFeePct)
        || gasSurchargeError(settings.gasSurchargePct)
}

/** One line of the review: a setting whose value changes. `from` / `to` are display texts. */
export interface FeeSettingChange {
    key: keyof FeeSettings;
    label: string;
    from: string;
    to: string;
}

const poolText = (pool: string) => pool.trim() || 'None'
const pctText = (pct: string) => `${new BigNumber(pct.trim()).toFixed()}%`

/** The settings that differ between `before` and `after` (both valid), in form order, as old → new. */
export function settingChanges(before: FeeSettings, after: FeeSettings): FeeSettingChange[] {
    const changes: FeeSettingChange[] = []
    if (before.communityPool.trim() !== after.communityPool.trim()) {
        changes.push({ key: 'communityPool', label: 'Community pool', from: poolText(before.communityPool), to: poolText(after.communityPool) })
    }
    if (!new BigNumber(before.transferFeePct).eq(after.transferFeePct.trim())) {
        changes.push({ key: 'transferFeePct', label: 'Transfer fee', from: pctText(before.transferFeePct), to: pctText(after.transferFeePct) })
    }
    if (!new BigNumber(before.gasSurchargePct).eq(after.gasSurchargePct.trim())) {
        changes.push({ key: 'gasSurchargePct', label: 'Gas surcharge', from: pctText(before.gasSurchargePct), to: pctText(after.gasSurchargePct) })
    }
    return changes
}

/**
 * The whole MsgSetDenomConfig value: always all three fields, zero rates and an empty pool
 * included (the message replaces the config as a whole).
 */
export function denomConfigValue(creator: string, denom: string, settings: FeeSettings) {
    return {
        creator,
        denom,
        communityPool: settings.communityPool.trim(),
        transferFee: pctToChain(settings.transferFeePct),
        gasSurcharge: pctToChain(settings.gasSurchargePct),
    }
}
