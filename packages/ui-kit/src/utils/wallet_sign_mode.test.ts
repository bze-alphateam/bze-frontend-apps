import { describe, expect, it } from 'vitest'
import { beePocketInfo } from '@bze/beepocket-connector'

import { BEEPOCKET_WALLET_NAME, isBeePocketWallet, signModeFor } from './wallet_sign_mode'

describe('BEEPOCKET_WALLET_NAME', () => {
    // ui-kit does not depend on the connector at runtime, so the name is kept here. This pins it
    // to the name the connector registers with interchain-kit.
    it('is the wallet name the BeePocket connector registers', () => {
        expect(BEEPOCKET_WALLET_NAME).toBe(beePocketInfo.name)
        expect(isBeePocketWallet(beePocketInfo.name)).toBe(true)
    })
})

describe('signModeFor', () => {
    it('signs BeePocket direct even when amino is asked for', () => {
        expect(signModeFor(BEEPOCKET_WALLET_NAME).direct).toBe(true)
        expect(signModeFor(BEEPOCKET_WALLET_NAME, {useDirectSign: false}).direct).toBe(true)
    })

    // Regression: BeePocket always set its own fee, so the dapp's fee token never reached it.
    it('gives BeePocket our fee unless the options let the wallet set it', () => {
        expect(signModeFor(BEEPOCKET_WALLET_NAME)).toEqual({direct: true, letWalletSetFee: false})
        expect(signModeFor(BEEPOCKET_WALLET_NAME, {letWalletSetFee: false})).toEqual({direct: true, letWalletSetFee: false})
        expect(signModeFor(BEEPOCKET_WALLET_NAME, {letWalletSetFee: true})).toEqual({direct: true, letWalletSetFee: true})
    })

    it('follows the options for every other wallet', () => {
        expect(signModeFor('keplr-extension')).toEqual({direct: false, letWalletSetFee: false})
        expect(signModeFor('keplr-extension', {useDirectSign: true, letWalletSetFee: true})).toEqual({direct: true, letWalletSetFee: true})
        expect(signModeFor(undefined, {useDirectSign: true})).toEqual({direct: true, letWalletSetFee: false})
    })
})
