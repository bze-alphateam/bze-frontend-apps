// Shareable "stake with this validator" links: `<origin>/?stake=<bzevaloper1…>`.
// The BZE Explorer links to this exact shape, so the parameter name and format are a contract.

export const STAKE_LINK_PARAM = 'stake';

export function buildStakeLink(origin: string, operatorAddress: string): string {
    return `${origin}/?${STAKE_LINK_PARAM}=${operatorAddress}`;
}

// DOM id of a validator row in the All Validators list, used to scroll a followed link into view.
export function validatorRowId(operatorAddress: string): string {
    return `validator-${operatorAddress}`;
}
