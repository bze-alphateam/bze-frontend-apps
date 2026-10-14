import BigNumber from 'bignumber.js'
import {
    amountToUAmount,
    getFromLocalStorage,
    removeFromLocalStorage,
    setInLocalStorage,
    validateBZEBech32Address,
} from '@bze/bze-ui-kit'
import { validateAmount } from '@/components/token-wizard/validation'

/** "Same for everyone" (one amount, a list of addresses) or "Amount per wallet" (`address, amount`). */
export type RecipientMode = 'same' | 'perWallet'

/** Wallets one MsgMultiSend carries. Longer lists are sent as several transactions (see multisend-run). */
export const MULTISEND_BATCH_SIZE = 100

/** Wallet lines a list can hold; the rest is left out. */
export const MAX_RECIPIENT_LINES = 5_000

export interface Recipient {
    address: string;
    /** Base units. */
    amount: string;
}

export interface RecipientProblem {
    /** 1-based line number in the pasted text. */
    line: number;
    text: string;
    reason: string;
}

export interface ParsedRecipients {
    /** Valid, deduplicated wallets: the outputs of the transaction. */
    ready: Recipient[];
    /** Lines whose wallet was already on the list (merged into the first one). */
    duplicates: number;
    /** Lines left out. */
    problems: RecipientProblem[];
    /** Lines kept, with something worth knowing (an ignored amount). */
    notes: RecipientProblem[];
    /** Sum of `ready` amounts, base units. */
    total: string;
}

const SEPARATORS = /[,;\t ]+/
const LETTER_WORD = /^[A-Za-z]+$/
const BECH32_SHAPE = /^([a-z][a-z0-9]*)1[02-9ac-hj-np-z]+$/i
const DECIMAL = /^\d+(\.\d+)?$/

/** Why an address can't receive here, or '' when it can. */
export function addressProblem(address: string): string {
    // Only bech32-looking strings reach the validator (it logs every failure).
    const shape = BECH32_SHAPE.exec(address)
    if (shape) {
        const { isValid, message } = validateBZEBech32Address(address)
        if (isValid) return ''
        if (message.includes('another network')) {
            return `${shape[1].toLowerCase()}1… is not a BeeZee address. Only bze1… addresses work here`
        }
    }
    return "isn't a valid BeeZee address"
}

/** A display-units amount in base units, or the reason it can't be sent. */
function toBaseUnits(amount: string, decimals: number): { amount?: string; reason?: string } {
    const trimmed = amount.trim()
    if (DECIMAL.test(trimmed) && /[1-9]/.test(trimmed)) {
        const base = new BigNumber(trimmed).shiftedBy(decimals).integerValue(BigNumber.ROUND_DOWN)
        if (base.isZero()) return { reason: `Amount is too small for ${decimals} decimals` }
    }
    const error = validateAmount(trimmed, decimals)
    if (error) return { reason: error.replace(/\.$/, '') }
    return { amount: amountToUAmount(trimmed, decimals) }
}

/**
 * Reads a pasted or uploaded wallet list: one wallet per line, fields split by commas,
 * semicolons, tabs or spaces; blank lines and `#` comments skipped, and a first line that is
 * a header (no valid address, a word like "address") too. Only `ready` entries may become
 * outputs: every other line lands in `problems` with the reason.
 *
 * In `same` mode every wallet gets `sameAmount` (display units; '0' while it is missing or
 * invalid — the form validates it on its own).
 */
export function parseRecipients(text: string, mode: RecipientMode, decimals: number, sameAmount?: string): ParsedRecipients {
    const problems: RecipientProblem[] = []
    const notes: RecipientProblem[] = []
    const byAddress = new Map<string, Recipient>()
    let duplicates = 0
    let dataLines = 0
    let isFirst = true
    let leftOut = 0
    let firstLeftOut = 0

    const sameBase = mode === 'same' ? toBaseUnits(sameAmount ?? '', decimals).amount ?? '0' : '0'

    const lines = text.split(/\r?\n/)
    lines.forEach((raw, index) => {
        const line = index + 1
        const trimmed = raw.trim()
        if (trimmed === '' || trimmed.startsWith('#')) return

        const fields = trimmed.split(SEPARATORS).filter(Boolean)
        const address = fields[0]

        if (isFirst) {
            isFirst = false
            const isHeader = addressProblem(address) !== '' && fields.some(f => LETTER_WORD.test(f))
            if (isHeader) return
        }

        if (dataLines >= MAX_RECIPIENT_LINES) {
            if (leftOut === 0) firstLeftOut = line
            leftOut++
            return
        }
        dataLines++

        const reason = addressProblem(address)
        if (reason) {
            problems.push({ line, text: trimmed, reason })
            return
        }

        let amount = sameBase
        if (mode === 'perWallet') {
            if (fields.length < 2) {
                problems.push({ line, text: trimmed, reason: 'Amount is missing' })
                return
            }
            const parsed = toBaseUnits(fields[1], decimals)
            if (!parsed.amount) {
                problems.push({ line, text: trimmed, reason: parsed.reason ?? 'Enter a valid positive number' })
                return
            }
            amount = parsed.amount
        } else if (fields.length > 1) {
            notes.push({ line, text: trimmed, reason: 'Amount ignored: everyone gets the same' })
        }

        const key = address.toLowerCase()
        const existing = byAddress.get(key)
        if (existing) {
            duplicates++
            if (mode === 'perWallet') {
                existing.amount = new BigNumber(existing.amount).plus(amount).toFixed(0)
            }
            return
        }
        byAddress.set(key, { address: key, amount })
    })

    if (leftOut > 0) {
        problems.push({
            line: firstLeftOut,
            text: `${leftOut.toLocaleString('en-US')} more ${leftOut === 1 ? 'line' : 'lines'}`,
            reason: `Lists are limited to ${MAX_RECIPIENT_LINES.toLocaleString('en-US')} wallets`,
        })
    }

    const ready = [...byAddress.values()]
    const total = ready.reduce((sum, r) => sum.plus(r.amount), new BigNumber(0)).toFixed(0)
    return { ready, duplicates, problems, notes, total }
}

/**
 * The value of a MsgMultiSend paying every recipient from `sender`. The bank module of
 * SDK 0.50 takes exactly one input, and it must equal the sum of the outputs.
 */
export function multiSendValue(sender: string, denom: string, recipients: ReadonlyArray<Recipient>) {
    const total = recipients.reduce((sum, r) => sum.plus(r.amount), new BigNumber(0)).toFixed(0)
    return {
        inputs: [{ address: sender, coins: [{ denom, amount: total }] }],
        outputs: recipients.map(r => ({ address: r.address, coins: [{ denom, amount: r.amount }] })),
    }
}

const EXAMPLE_ADDRESSES = [
    'bze13x5v3t9plqu8ql3h44ltx0ys59uzz43lt6p0tz',
    'bze1sx6ep2vtlzsdj73tseeq3ydahqyt0ey2gs3tg0',
    'bze1uvr5nrhfgvukfgtz82ks9nr9qgvzllumd65n76',
]

/** A small CSV to start from, in the shape `mode` reads. */
export function exampleCsv(mode: RecipientMode): string {
    if (mode === 'same') {
        return ['address', ...EXAMPLE_ADDRESSES].join('\n') + '\n'
    }
    return ['address,amount', ...EXAMPLE_ADDRESSES.map((a, i) => `${a},${(i + 1) * 100}`)].join('\n') + '\n'
}

/** What "Send to a list of wallets" keeps in the browser until the list is sent. */
export interface MultiSendDraft {
    denom: string;
    mode: RecipientMode;
    sameAmount: string;
    text: string;
}

export const MULTISEND_DRAFT_KEY = 'factory_multisend_draft'
export const MULTISEND_DRAFT_TTL = 30 * 24 * 60 * 60

const asString = (v: unknown) => (typeof v === 'string' ? v : '')

/** The saved draft, or undefined when there is none (or it can't be read). */
export function loadMultiSendDraft(): MultiSendDraft | undefined {
    const raw = getFromLocalStorage(MULTISEND_DRAFT_KEY)
    if (!raw) return undefined
    try {
        const parsed = JSON.parse(raw) as Record<string, unknown>
        return {
            denom: asString(parsed.denom),
            mode: parsed.mode === 'perWallet' ? 'perWallet' : 'same',
            sameAmount: asString(parsed.sameAmount),
            text: asString(parsed.text),
        }
    } catch {
        return undefined
    }
}

/** Saves the draft for 30 days; one without a token or a list removes it instead. */
export function saveMultiSendDraft(draft: MultiSendDraft): void {
    if (draft.denom === '' && draft.text.trim() === '' && draft.sameAmount === '') {
        clearMultiSendDraft()
        return
    }
    setInLocalStorage(MULTISEND_DRAFT_KEY, JSON.stringify(draft), MULTISEND_DRAFT_TTL)
}

export function clearMultiSendDraft(): void {
    removeFromLocalStorage(MULTISEND_DRAFT_KEY)
}
