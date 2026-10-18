import { describe, it, expect } from 'vitest'
import { toTxSuccessResponse } from './tx_response'

// Shape of what interchainjs' broadcastResult.wait() resolves to (convertToTxResponse).
const waitResult = () => ({
    height: BigInt(3807212),
    txhash: '850E32FDF2E407F03995B9C4191ACD86793292E1961753574D4A4319199214C7',
    code: 0,
    rawLog: '',
    gasWanted: BigInt(200000),
    events: [],
})

describe('toTxSuccessResponse', () => {
    // Regression: the BigInt height reached onSuccess as-is, so the burner's raffle check
    // (`height + 2 + ticket`) threw and the raffle result never showed.
    it('turns a BigInt height into a number', () => {
        const res = toTxSuccessResponse(waitResult())

        expect(typeof res.height).toBe('number')
        expect(res.height).toBe(3807212)
        expect(res.height + 2).toBe(3807214)
    })

    it('keeps a number height and the other fields', () => {
        const res = toTxSuccessResponse({ ...waitResult(), height: 42 })

        expect(res.height).toBe(42)
        expect(res.txhash).toBe(waitResult().txhash)
        expect(res.code).toBe(0)
        expect(res.gasWanted).toBe(BigInt(200000))
    })

    it('falls back to height 0 when the response has none', () => {
        const { height: _height, ...rest } = waitResult()

        expect(toTxSuccessResponse(rest).height).toBe(0)
    })
})
