import {isNativeDenom} from './denom';

export const getValidatorSupportedDenoms = (): string[] => {
    const denoms = process.env.NEXT_PUBLIC_ATONE_VALIDATOR_SUPPORTED_DENOMS || '';
    return denoms.split(',').map(d => d.trim()).filter(d => d.length > 0);
}

export const getValidatorPageUrl = (): string => {
    return process.env.NEXT_PUBLIC_ATONE_VALIDATOR_PAGE_URL || '';
}

// A pool is supported only when it pairs native BZE with one of the supported denoms
// (e.g. BZE/PHOTON). A pool that merely contains a supported denom next to another
// token (e.g. CTL/ATONE) is not.
export const isPoolSupportedByValidator = (baseDenom: string, quoteDenom: string): boolean => {
    const supportedDenoms = getValidatorSupportedDenoms();
    return (isNativeDenom(baseDenom) && supportedDenoms.includes(quoteDenom))
        || (isNativeDenom(quoteDenom) && supportedDenoms.includes(baseDenom));
}
