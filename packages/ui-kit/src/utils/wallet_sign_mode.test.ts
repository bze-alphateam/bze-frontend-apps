import { describe, expect, it } from 'vitest'
import { beePocketInfo } from '@bze/beepocket-connector'

import { BEEPOCKET_WALLET_NAME, isBeePocketWallet } from './wallet_sign_mode'

describe('BEEPOCKET_WALLET_NAME', () => {
    // ui-kit does not depend on the connector at runtime, so the name is kept here. This pins it
    // to the name the connector registers with interchain-kit.
    it('is the wallet name the BeePocket connector registers', () => {
        expect(BEEPOCKET_WALLET_NAME).toBe(beePocketInfo.name)
        expect(isBeePocketWallet(beePocketInfo.name)).toBe(true)
    })
})
