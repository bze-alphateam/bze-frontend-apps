import { describe, it, expect } from 'vitest'
import { validateRestEndpoint, convertToWebSocketUrl } from './validation'
import { VALIDATION_ERRORS } from '../constants/settings'

// Only the pure / early-return paths are tested here — anything past URL
// validation opens real network connections and belongs in integration tests.

describe('convertToWebSocketUrl', () => {
    it('converts http to ws', () => {
        expect(convertToWebSocketUrl('http://localhost:26657')).toBe('ws://localhost:26657/')
    })

    it('converts https to wss', () => {
        expect(convertToWebSocketUrl('https://rpc.getbze.com')).toBe('wss://rpc.getbze.com/')
    })

    it('leaves ws/wss URLs untouched (modulo normalization)', () => {
        expect(convertToWebSocketUrl('wss://rpc.getbze.com/websocket')).toBe('wss://rpc.getbze.com/websocket')
    })

    it('returns the input unchanged when it is not a parseable URL', () => {
        expect(convertToWebSocketUrl('not a url')).toBe('not a url')
    })
})

describe('validateRestEndpoint (offline paths)', () => {
    it('rejects empty and whitespace-only endpoints', async () => {
        expect(await validateRestEndpoint('')).toEqual({ isValid: false, error: VALIDATION_ERRORS.EMPTY_ENDPOINT })
        expect(await validateRestEndpoint('   ')).toEqual({ isValid: false, error: VALIDATION_ERRORS.EMPTY_ENDPOINT })
    })

    it('rejects malformed URLs', async () => {
        expect(await validateRestEndpoint('not-a-url')).toEqual({ isValid: false, error: VALIDATION_ERRORS.INVALID_URL })
    })

    it('rejects non-http(s) protocols', async () => {
        expect(await validateRestEndpoint('ws://rpc.getbze.com')).toEqual({
            isValid: false,
            error: VALIDATION_ERRORS.INVALID_REST_PROTOCOL,
        })
    })
})
