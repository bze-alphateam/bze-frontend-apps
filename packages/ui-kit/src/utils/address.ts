import {fromBech32, toBech32} from "@interchainjs/encoding";
import {AddressValidationResult} from "../types/validation";
import {getChainAddressPrefix} from "../constants/chain";
import {stringTruncateFromCenter} from "./strings";

export const truncateAddress = (address: string): string => {
    return stringTruncateFromCenter(address, 12);
}

export const validateBech32Address = (address: string, prefix: string): AddressValidationResult => {
    const result = {
        isValid: false,
        message: ""
    }

    try {
        const { prefix: addressPrefix } = fromBech32(address);
        if (addressPrefix === prefix) {
            result.isValid = true;
            return result;
        }

        result.message = `This address is from another network (${addressPrefix}). Please use an address from the destination network (${prefix}).`
    } catch (e) {
        console.error("invalid address ", e);
        result.message = "Invalid address"
    }

    return result;
}

export const validateBZEBech32Address = (address: string) => validateBech32Address(address, getChainAddressPrefix());

/**
 * The account address behind a validator's operator address (`bzevaloper1…` → `bze1…`):
 * the same key, re-encoded with the chain's account prefix. A validator votes on
 * proposals from this account.
 */
export const valoperToAccountAddress = (operatorAddress: string): string =>
    toBech32(getChainAddressPrefix(), fromBech32(operatorAddress).data);
