/** A ballot share's source key (`sr/{reward id}` or `dr/{staking denom}`) in words. */
export function sourceLabel(source: string): string {
    if (source.startsWith('sr/')) return `Staking reward ${Number(source.slice(3)) || source.slice(3)}`;
    if (source.startsWith('dr/')) return `Denom Reward of ${source.slice(3)}`;
    return source;
}
