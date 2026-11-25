// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ChakraProvider, defaultSystem } from '@chakra-ui/react'

import { DepositLimitNote } from './deposit-limit-note'

afterEach(cleanup)

const renderNote = (sent?: boolean) =>
    render(<ChakraProvider value={defaultSystem}><DepositLimitNote sent={sent} /></ChakraProvider>)

describe('DepositLimitNote', () => {
    it('explains the daily limit and the refund on the source chain', () => {
        renderNote()
        const text = screen.getByTestId('deposit-limit-note').textContent ?? ''
        expect(text).toContain('daily limit per route')
        expect(text).toContain('refunded to you on the source chain')
        expect(text).not.toContain('If your balance does not change')
    })

    it('adds where to look once a deposit was sent', () => {
        renderNote(true)
        expect(screen.getByTestId('deposit-limit-note').textContent)
            .toContain('If your balance does not change, check the source chain: refused deposits are refunded there.')
    })
})
