// Shareable "stake with this validator" links: `<origin>/?stake=<bzevaloper1…>`.
// The BZE Explorer links to this exact shape, so the parameter name and format are a contract.

export const STAKE_LINK_PARAM = 'stake';
export const VALOPER_PREFIX = 'bzevaloper';

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
// BIP-173 limit on the whole string, and the checksum is the last 6 characters.
const MAX_LENGTH = 90;
const CHECKSUM_LENGTH = 6;

function polymod(values: number[]): number {
    let chk = 1;
    for (const value of values) {
        const top = chk >>> 25;
        chk = ((chk & 0x1ffffff) << 5) ^ value;
        for (let i = 0; i < 5; i++) {
            if ((top >>> i) & 1) {
                chk ^= GENERATOR[i];
            }
        }
    }
    return chk;
}

function expandPrefix(prefix: string): number[] {
    const codes = [...prefix].map(c => c.charCodeAt(0));
    return [...codes.map(c => c >> 5), 0, ...codes.map(c => c & 31)];
}

// True for a lowercase bech32 string with the `bzevaloper` prefix and a valid checksum.
export function isValidOperatorAddress(value: string): boolean {
    if (value.length > MAX_LENGTH || value !== value.toLowerCase()) {
        return false;
    }
    const separator = value.lastIndexOf('1');
    if (value.slice(0, separator) !== VALOPER_PREFIX) {
        return false;
    }
    const data = value.slice(separator + 1);
    if (data.length <= CHECKSUM_LENGTH) {
        return false;
    }
    const words: number[] = [];
    for (const c of data) {
        const word = CHARSET.indexOf(c);
        if (word < 0) {
            return false;
        }
        words.push(word);
    }
    return polymod([...expandPrefix(VALOPER_PREFIX), ...words]) === 1;
}

export function buildStakeLink(origin: string, operatorAddress: string): string {
    return `${origin}/?${STAKE_LINK_PARAM}=${operatorAddress}`;
}

// DOM id of a validator row in the All Validators list, used to scroll a followed link into view.
export function validatorRowId(operatorAddress: string): string {
    return `validator-${operatorAddress}`;
}
