/**
 * The rewards withdraw address (`MsgSetWithdrawAddress`). The chain keeps one per delegator
 * account: it receives the staking rewards of every delegation, whether claimed or paid out
 * automatically when a delegation changes. Unstaked tokens always return to the delegator.
 */

export interface AddressValidation {
    isValid: boolean;
    message: string;
}

export type WithdrawAddressCheck =
    | {ok: true; address: string}
    | {ok: false; message: string};

interface CheckOptions {
    /** The chain's account prefix (`bze`). */
    prefix: string;
    /** The address rewards go to now, when known. */
    current?: string;
    /** Bech32 check for one prefix (ui-kit's `validateBech32Address`). */
    validate: (address: string, prefix: string) => AddressValidation;
}

/**
 * Checks a typed withdraw address. An empty field is not an error yet (`message` is empty).
 * The address must be an account of this chain: a validator operator address or another
 * chain's address is refused here, a blocked module account by the chain itself.
 */
export function checkWithdrawAddress(input: string, {prefix, current, validate}: CheckOptions): WithdrawAddressCheck {
    const trimmed = input.trim();
    if (trimmed === '') {
        return {ok: false, message: ''};
    }
    if (trimmed.toLowerCase().startsWith(`${prefix}valoper`)) {
        return {ok: false, message: `This is a validator address. Enter a wallet address (${prefix}1…).`};
    }
    const result = validate(trimmed, prefix);
    if (!result.isValid) {
        return {ok: false, message: result.message || 'Invalid address'};
    }
    // Bech32 is either all lower or all upper case; the chain stores it lower case.
    const address = trimmed.toLowerCase();
    if (current && address === current) {
        return {ok: false, message: 'Rewards already go to this address.'};
    }
    return {ok: true, address};
}

/** Whether rewards go to the connected wallet itself, to another address, or it is not known yet. */
export type WithdrawTarget = 'self' | 'other' | 'unknown';

export function withdrawTarget(current: string | undefined, self: string | undefined): WithdrawTarget {
    if (!current || !self) {
        return 'unknown';
    }
    return current === self ? 'self' : 'other';
}
