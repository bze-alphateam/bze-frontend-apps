export const REACH_PATH = '/reach'

// "Reach another community" (/reach, BFE-270): give your token to the people staking someone
// else's token, once (an airdrop) or every day for N days (a daily prize on its compounded reward).

export type ReachMode = 'once' | 'daily'

/** "PAGE stakers · 4,100,000 staked". */
export const reachCommunitySummary = (ticker: string, staked: string) => `${ticker} stakers · ${staked} staked`

export interface ReachGift {
    /** "200 HONEY": the amount once, or a day. */
    amount: string;
    /** The community's ticker. */
    community: string;
    /** daily: the days and "2,000 HONEY" in all. */
    days?: number;
    total?: string;
}

/** The sentence of each mode, under the How question. */
export function reachSentence(mode: ReachMode, { amount, community, days, total }: ReachGift): string {
    if (mode === 'once') {
        return `${amount} is split right now between everyone staking ${community}, by how much each stakes.`
    }
    const length = days === undefined ? 'N days' : `${days.toLocaleString('en-US')} ${days === 1 ? 'day' : 'days'}`
    return `${amount} a day for ${length}${total ? ` (${total} in all)` : ''}, shared by everyone staking ${community} that day. Days with nobody staking are skipped.`
}

/** The gift is the wallet's own factory token and nothing stakes it yet: its receivers have no reason to keep it. */
export function giftNeedsStakable(giftDenom: string, address: string | undefined, stakableDenoms: ReadonlyArray<string> | undefined): boolean {
    if (!address || !giftDenom.startsWith(`factory/${address}/`) || stakableDenoms === undefined) return false
    return !stakableDenoms.includes(giftDenom)
}

/** What the wizard hands its Done screen (kept in the pending-tx store, so serialisable). */
export interface ReachDoneInput {
    mode: ReachMode;
    communityDenom: string;
    communityTicker: string;
    giftDenom: string;
    giftTicker: string;
    /** "200 HONEY": once, or a day. */
    amount: string;
    days?: number;
}

/** "**HONEY** is on its way to PAGE stakers." */
export const reachDoneTitle = (input: Pick<ReachDoneInput, 'giftTicker' | 'communityTicker'>) =>
    `**${input.giftTicker}** is on its way to ${input.communityTicker} stakers.`

export function reachDoneText({ mode, amount, communityTicker, days }: ReachDoneInput): string {
    return mode === 'once'
        ? `${amount} was split between everyone staking ${communityTicker}. They can claim it right away.`
        : `${amount} a day for ${days ?? 'N'} days, shared by everyone staking ${communityTicker}. Your token shows up as a prize on ${communityTicker}'s Communities page.`
}

/** `/reach`, optionally with the community and the gift preselected. */
export function reachHref(params: { community?: string; gift?: string } = {}): string {
    const q = new URLSearchParams()
    if (params.community) q.set('community', params.community)
    if (params.gift) q.set('gift', params.gift)
    const s = q.toString()
    return s ? `${REACH_PATH}?${s}` : REACH_PATH
}
