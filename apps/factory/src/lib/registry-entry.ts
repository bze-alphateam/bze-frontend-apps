import { getChainName, getFromLocalStorage, isTestnetChain, setInLocalStorage } from '@bze/bze-ui-kit'

// "Make it official" (/official, BFE-164): the Cosmos Chain Registry entry of a factory token,
// the links into the registry and the guide's progress, kept per token in this browser.

export const OFFICIAL_PATH = '/official'

/** The registry guide of a token. */
export function officialHref(denom: string): string {
    return `${OFFICIAL_PATH}?denom=${encodeURIComponent(denom)}`
}

export const REGISTRY_REPO_URL = 'https://github.com/cosmos/chain-registry'
const REGISTRY_RAW_URL = 'https://raw.githubusercontent.com/cosmos/chain-registry/master'

/**
 * Whether BeeZee apps read logos from the live registry or from the `chain-registry` npm
 * package bundled at build time. True since BFE-329: the apps read the asset list from BZE
 * Scan, which follows the live registry. It only changes the "after it's merged" copy of the guide.
 */
export const BEEZEE_APPS_READ_LIVE_REGISTRY = true

export const AFTER_MERGE_COPY = BEEZEE_APPS_READ_LIVE_REGISTRY
    ? 'Once it is merged, BeeZee apps show the logo within about an hour. Other wallets follow when they update their lists.'
    : 'Once it is merged, BeeZee apps show it after their next update. Other wallets follow when they update their lists.'

/** The chain's folder in the registry. Testnet tokens aren't listed; the guide still shows the mainnet folder. */
export function registryChainName(): string {
    return isTestnetChain() ? 'beezee' : getChainName()
}

export function registryAssetListUrl(): string {
    return `${REGISTRY_RAW_URL}/${registryChainName()}/assetlist.json`
}

export function registryImageUrl(fileName: string): string {
    return `${REGISTRY_RAW_URL}/${registryChainName()}/images/${fileName}`
}

export type LogoFormat = 'svg' | 'png'

export interface RegistrySocials {
    website?: string;
    x?: string;
}

/** The on-chain bank metadata fields the entry is made from (bzejs `MetadataSDKType`). */
export interface RegistryMetadata {
    description: string;
    denom_units: { denom: string; exponent: number }[];
    base: string;
    display: string;
    name: string;
    symbol: string;
}

export interface RegistryEntryOptions {
    format: LogoFormat;
    fileName: string;
    socials?: RegistrySocials;
}

/**
 * The token's `assetlist.json` entry, in the registry's key order. Denom units are the base unit
 * at exponent 0 and the display unit at its on-chain exponent; aliases are left out, as in the
 * registry's own entries.
 */
export function buildRegistryEntry(metadata: RegistryMetadata, { format, fileName, socials }: RegistryEntryOptions) {
    const displayUnit = metadata.denom_units.find(u => u.denom === metadata.display)
    const logoUrl = registryImageUrl(fileName)
    const cleanSocials: RegistrySocials = {
        ...(socials?.website?.trim() ? { website: socials.website.trim() } : {}),
        ...(socials?.x?.trim() ? { x: socials.x.trim() } : {}),
    }

    return {
        description: metadata.description,
        denom_units: [
            { denom: metadata.base, exponent: 0 },
            ...(displayUnit && displayUnit.denom !== metadata.base ? [{ denom: displayUnit.denom, exponent: displayUnit.exponent }] : []),
        ],
        base: metadata.base,
        name: metadata.name,
        display: metadata.display,
        symbol: metadata.symbol,
        logo_URIs: { [format]: logoUrl },
        images: [{ [format]: logoUrl }],
        type_asset: 'sdk.coin',
        ...(Object.keys(cleanSocials).length > 0 ? { socials: cleanSocials } : {}),
    }
}

/** The entry as it is pasted into `assetlist.json`: two-space indent. */
export function registryEntryJson(metadata: RegistryMetadata, options: RegistryEntryOptions): string {
    return JSON.stringify(buildRegistryEntry(metadata, options), null, 2)
}

/** The logo file name the guide suggests: the display unit, lower case. */
export function suggestLogoFileName(display: string, format: LogoFormat): string {
    const name = display.toLowerCase().replace(/[^a-z0-9._-]/g, '')
    return `${name || 'logo'}.${format}`
}

const PR_URL = /^https:\/\/github\.com\/cosmos\/chain-registry\/pull\/\d+$/

export function isRegistryPrUrl(url: string): boolean {
    return PR_URL.test(url.trim())
}

/** A link for the entry's `socials`: https only, with a real host. */
export function isHttpsUrl(url: string): boolean {
    try {
        const parsed = new URL(url.trim())
        return parsed.protocol === 'https:' && parsed.hostname.includes('.')
    } catch {
        return false
    }
}

/** The steps the user marks done; the fifth (the review) is done when the registry lists the token. */
export const OFFICIAL_STEPS = ['logo', 'links', 'entry', 'submit'] as const
export type OfficialStep = typeof OFFICIAL_STEPS[number]

export interface OfficialProgress {
    format?: LogoFormat;
    fileName?: string;
    /** The checked logo's drawing size and file size, for the Logo summary. */
    width?: number;
    height?: number;
    bytes?: number;
    socials?: RegistrySocials;
    prUrl?: string;
    done: OfficialStep[];
}

export const EMPTY_OFFICIAL_PROGRESS: OfficialProgress = { done: [] }

export const officialProgressKey = (denom: string) => `factory_official_${denom}`

export function loadOfficialProgress(denom: string): OfficialProgress {
    const raw = getFromLocalStorage(officialProgressKey(denom))
    if (!raw) return EMPTY_OFFICIAL_PROGRESS
    try {
        const parsed = JSON.parse(raw) as Partial<OfficialProgress>
        return {
            ...parsed,
            done: Array.isArray(parsed.done) ? parsed.done.filter((s): s is OfficialStep => OFFICIAL_STEPS.includes(s as OfficialStep)) : [],
        }
    } catch {
        return EMPTY_OFFICIAL_PROGRESS
    }
}

/** No expiry: the guide may span weeks of review. */
export function saveOfficialProgress(denom: string, progress: OfficialProgress): void {
    setInLocalStorage(officialProgressKey(denom), JSON.stringify(progress), 0)
}

// The summaries of the guide's done steps (BFE-274).

/** "honey.png · 512×512 · 84 KB ✓"; only the parts that were saved. */
export function logoSummary({ fileName, width, height, bytes }: Pick<OfficialProgress, 'fileName' | 'width' | 'height' | 'bytes'>): string {
    const parts = [
        fileName,
        width !== undefined && height !== undefined ? `${width}×${height}` : undefined,
        bytes !== undefined ? `${Math.max(1, Math.round(bytes / 1024)).toLocaleString('en-US')} KB` : undefined,
    ].filter(Boolean)
    return `${parts.join(' · ')} ✓`
}

/** "Website, X", or "Skipped". */
export function linksSummary(socials?: RegistrySocials): string {
    const names = [socials?.website && 'Website', socials?.x && 'X'].filter(Boolean)
    return names.length > 0 ? names.join(', ') : 'Skipped'
}

/** "PR #1234 opened". */
export function prSummary(prUrl?: string): string {
    const number = prUrl?.trim().replace(/\/+$/, '').split('/').pop()
    return number ? `PR #${number} opened` : ''
}

/** The file name the entry downloads as. */
export const ENTRY_FILE_NAME = 'assetlist-entry.json'
